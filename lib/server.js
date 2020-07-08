const log = require("tiny-node-logger");

const {createWatcher} = require("./watcher.js");
const {createRequestHandler} = require("./request-handler.js");


function createServer({http2, options}, handler) {
    const secure = !!(options.key && options.cert);
    if (http2) {
        const http2 = require("http2");
        log.info("creating http2 server");
        return http2.createSecureServer(options, handler);
    } else {
        const http = require("http");
        if (secure) {
            log.info("creating https server");
            return http.createSecureServer(options, handler);
        } else {
            log.info("creating http server");
            return http.createServer(handler);
        }
    }
}

module.exports.startServer = async function (config) {

    const {
        host,
        port,
        options
    } = config.server;

    const watcher = createWatcher(config);
    const handler = createRequestHandler(config, watcher);
    const server = createServer(config.server, handler);

    server.on("close", async function () {
        await watcher.close();
        log.info("server closed.");
    });

    const sockets = new Set();

    server.on("connection", function (socket) {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
    });

    server.shutdown = () => new Promise(closed => {
        server.close(closed);
        log.info(`shutting down server, closing ${sockets.size} pending socket...`);
        for (const socket of sockets) {
            socket.destroy();
        }
    });

    await new Promise(listening => server.listen(port, host, listening));

    const protocol = !!(options.key && options.cert) ? "https" : "http";
    log.info(`server started on ${protocol}://${host}:${port}`);

    return {
        server,
        watcher
    };
};
