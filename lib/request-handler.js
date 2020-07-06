const log = require("tiny-node-logger");

const {createPipeline} = require("./pipeline.js");
const {createRouter, NO_RESPONSE_REQUIRED} = require("./router.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./utility/http2-push.js");
const HttpStatus = require("http-status-codes");

module.exports.createRequestHandler = (config, watcher) => {

    const {
        routes,
        http2: {
            push,
            preload
        }
    } = config.server;

    const pipeline = createPipeline(config, watcher);
    const http2Push = useHttp2Push(config);

    const router = createRouter(config);

    function next(req, res) {
        const {
            filename,
            content,
            contentType,
            contentLength,
            lastModified,
            etag,
            links
        } = res;

        res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,PATCH,DELETE",
            "Access-Control-Allow-Headers": "X-Requested-With,content-type",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": contentType,
            "Content-Length": contentLength,
            "Last-Modified": lastModified.toUTCString(),
            "ETag": etag
        });

        if (push && links) {
            http2Push(res.stream, filename, links, pipeline);
        } else if (preload) {
            res.setHeader("link", [...links].map(src => {
                return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
            }));
        }

        sendContent(res, content, req.headers["user-agent"]);
    }

    return async function requestHandler(req, res) {
        try {
            await router.route(req, res, next);
        } catch (exception) {
            if (exception.redirect) {
                res.writeHead(HttpStatus.PERMANENT_REDIRECT, {
                    "Location": exception.redirect
                });
                res.end();
            } else {
                const code = exception.code === "ENOENT" ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
                res.writeHead(code, parseFloat(req.httpVersion) < 2 ? HttpStatus.getStatusText(code) : undefined);
                res.end(exception.message);
                log.error(code, exception.message, exception.stack);
            }
        }
    };

};
