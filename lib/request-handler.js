const log = require("tiny-node-logger");

const {createPipeline} = require("./pipeline.js");
const {createRouter} = require("./router.js");
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

    const router = createRouter();

    router.get("/web_modules/**", function () {
        return pipeline(this.pathname);
    });

    router.get("/**", function () {
        return pipeline(this.pathname);
    });

    return async function requestHandler(request, response) {

        try {
            const {
                filename,
                content,
                contentType,
                contentLength,
                lastModified,
                etag,
                links
            } = await router.route(request, response);

            response.writeHead(200, {
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
                http2Push(response.stream, filename, links, pipeline);
            } else if (preload) {
                response.setHeader("link", [...links].map(src => {
                    return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                }));
            }

            sendContent(response, content, request.headers["user-agent"]);

        } catch (error) {

            if (error.redirect) {
                response.writeHead(HttpStatus.PERMANENT_REDIRECT, {
                    "Location": error.redirect
                });
                response.end();
            } else {
                const code = error.code === "ENOENT" ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
                response.writeHead(code, parseFloat(request.httpVersion) < 2 ? HttpStatus.getStatusText(code) : undefined);
                response.end(error.message);
                log.error(code, error.message, error.stack);
            }
        }
    };

};
