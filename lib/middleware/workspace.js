const log = require("tiny-node-logger");

const {memoize} = require("../utility/memoize.js");
const {createPipeline} = require("../pipeline.js");
const {sendContent} = require("../utility/content-utils.js");
const {useHttp2Push} = require("./http2-push.js");
const HttpStatus = require("http-status-codes");

module.exports.useWorkspace = memoize((config, watcher) => {

    const {
        http2: {
            push,
            preload
        }
    } = config.server;

    const pipeline = createPipeline(config, watcher);
    const http2Push = useHttp2Push(config);

    return async function handler(request, response) {

        try {
            const {
                filename,
                content,
                headers,
                links
            } = await router.route(request, response);

            if (headers) for (const name of Object.keys(headers)) {
                response.setHeader(name, headers[name]);
            }

            if (push && links) {
                http2Push(response.stream, filename, links, pipeline);
            } else if (preload) {
                response.setHeader("link", [...links].map(src => {
                    return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                }));
            }

            sendContent(response, content, request.headers["user-agent"]);

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

});
