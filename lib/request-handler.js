const log = require("tiny-node-logger");

const corsMiddleware = require("cors");

const {createRouter} = require("./router.js");
const {createPipeline} = require("./pipeline.js");
const {sendContent} = require("./util/content-utils.js");
const {useHttp2Push} = require("./util/http2-push.js");
const HttpStatus = require("http-status-codes");
const {serveWebModules} = require("./middleware/serve-web-modules.js");
const {serveWorkspaceFiles} = require("./middleware/serve-workspace-files.js");
const {parse: parseURL} = require("fast-url-parser");

module.exports.createRequestHandler = (config, watcher) => {

    const {
        http2: {
            push,
            preload
        }
    } = config.server;

    const streamResource = createResourceStreamer(config, watcher);
    const http2Push = useHttp2Push(config);

    async function serveResource(req, res) {

        try {
            const {
                pathname,
                query
            } = parseURL(req.url, true);

            const stream = streamResource(req.url, query);

            if (stream.headers) {
                res.writeHead(200, stream.headers);
            }

            if (push && links) {
                http2Push(response.stream, filename, links, pipeline);
            } else if (preload) {
                response.setHeader("link", [...links].map(src => {
                    return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                }));
            }

            sendContent(response, content, req.headers["user-agent"]);

        } catch (exception) {
            if (exception.redirect) {
                res.writeHead(HttpStatus.PERMANENT_REDIRECT, {
                    "Location": exception.redirect
                });
                res.end();
            } else {
                serveError(exception, req, res);
            }
        }
    }

    function serveError({code, message, stack}, req, res) {
        code = code === "ENOENT" ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
        res.writeHead(code, parseFloat(req.httpVersion) < 2 ? HttpStatus.getStatusText(code) : undefined);
        res.end(message);
        log.error(code, message, stack);
    }

    const router = createRouter(config.router);

    router.get("/web_modules/*", serveWebModules(config));
    router.get("/*", serveWorkspaceFiles(config));

    const cors = corsMiddleware(config.cors);
    const next = (req, res) => function (err) {
        if (err) {
            serveError(err, req, res);
        } else {
            router.lookup(req, res);
        }
    };

    return function handler(req, res) {
        cors(req, res, next(req, res));
    };
};
