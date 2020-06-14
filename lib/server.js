const {
    parse: parseURL
} = require("url");

const HttpStatus = require("http-status-codes");
const chokidar = require("chokidar");

const {createPipeline} = require("./pipeline.js");
const {sendContent} = require("./utility/send-content.js");
const {createHttp2Push} = require("./utility/http2-push.js");

const log = require("tiny-node-logger");

function createServer(config = {}, requestHandler) {
    if (config.http2) {
        const http2 = require("http2");
        log.info("creating http2 server");
        return http2.createSecureServer({
            key: config.server?.key ?? config.readFileSync("cert/server.key"),
            cert: config.server?.cert ?? config.readFileSync("cert/server.crt"),
            allowHTTP1: config.server?.allowHTTP1 ?? true,
        }, requestHandler);
    } else {
        const http = require("http");
        log.info("creating http server");
        return http.createServer(requestHandler);
    }
}

module.exports = async function (config) {

    log.debug("server configuration:", config);

    const watcher = chokidar.watch([], {
        ignored: config.watch?.ignored,
        cwd: config.rootDir,
        atomic: false
    });

    const pipeline = createPipeline(config, watcher);

    const http2Push = createHttp2Push(config);

    const server = createServer(config, async (req, res) => {

        try {
            const url = parseURL(req.url, true);

            const {
                filename,
                content,
                headers,
                links,
            } = await pipeline(url);

            if (headers) for (const name of Object.keys(headers)) {
                res.setHeader(name, headers[name]);
            }

            if (config.push && links) {
                http2Push(res.stream, links, pipeline);
            } else if (config.preload) {
                res.setHeader('link', [...links].map(src => {
                    return `<${src}>; rel=preload; as=${src.endsWith(".css") ? 'style' : 'script'}`;
                }))
            }

            sendContent(res, content, req.headers["user-agent"]);

        } catch (error) {

            if (error.redirect) {
                res.writeHead(HttpStatus.PERMANENT_REDIRECT, {
                    'Location': error.redirect
                });
                res.end();
            } else {
                const code = error.code === "ENOENT" ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
                res.writeHead(code, parseFloat(req.httpVersion) < 2 ? HttpStatus.getStatusText(code) : undefined);
                res.end(error.message);
                log.error(code, error.message, error.stack);
            }
        }
    });

    server.on("close", function () {
        watcher.close();
    });

    const sockets = new Set();

    server.on('connection', function (socket) {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    server.shutdown = async function (callback) {
        if (server.listening) return new Promise(closed => {
            server.on("close", function () {
                log.info("server closed.");
                closed();
            });
            server.close(callback);
            log.info(`shutting down server, closing ${sockets.size} pending socket...`);
            for (const socket of sockets) {
                socket.destroy();
            }
        });
    }

    await new Promise(resolve => server.listen(config.port, config.host, resolve));

    log.info(`server started on ${config.http2 ? 'https' : 'http'}://${config.host}:${config.port}`);

    return {
        server,
        watcher,
        config
    };
};