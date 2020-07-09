const log = require("tiny-node-logger");

const {Context} = require("./context.js");
const {createPipeline} = require("./pipeline.js");
const {createRouter, NO_RESPONSE_REQUIRED} = require("./router.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./utility/http2-push.js");
const HttpStatus = require("http-status-codes");
const computeETag = require("etag");

module.exports.createRequestHandler = (config, watcher) => {

    const pipeline = createPipeline(config, watcher);
    const http2Push = useHttp2Push(config);

    const router = createRouter(config);

    function next(context) {

        const {
            request,
            response,
            pathname,
            content,
            contentType,
            contentLength,
            lastModified,
            etag,
            links
        } = context;

        if (!response.headersSent) {

            if (config.http2 === "preload" && links) {
                response.setHeader("link", [...links].map(src => {
                    return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                }));
            }

            response.writeHead(200, {
                "content-type": contentType,
                "content-length": contentLength,
                "last-modified": lastModified.toUTCString(),
                "etag": computeETag(JSON.stringify([request.url, contentLength, lastModified]), config.etag)
            });
        }

        if (!response.writableEnded) {

            if (config.http2 === "push" && links) {
                http2Push(response.stream, pathname, links, pipeline);
            }

            sendContent(response, content, request.headers["user-agent"]);
        }
    }

    return async function requestHandler(request, response) {

        const context = new Context(request, response);

        const timeout = setTimeout(() => {
            context.error(HttpStatus.REQUEST_TIMEOUT, `${request.method} for ${request.url} timed out`);
        }, config.request.timeout);

        try {
            const {
                handler,
                variables,
                url
            } = router.route(context);

            context.url = url;
            context.variables = variables;

            let output = await handler(context, next);

            if (output !== undefined) {
                if (output.content === undefined) {
                    let accept = request.headers["accept"];
                    if (accept) {
                        accept = accept.split(",")[0];
                    }
                    let content, contentType;
                    if (accept === "application/json") {
                        content = typeof output === "object" ? JSON.stringify(output) : "";
                        contentType = "application/json; charset=UTF-8";
                    }
                    if (accept === "text/plain" || accept === undefined) {
                        content = String(output);
                        contentType = "text/plain; charset=UTF-8";
                    }
                    output = {
                        content,
                        contentType,
                        contentLength: content.length,
                        lastModified: new Date()
                    }
                }
                await next({
                    ...context,
                    ...output
                });
            }

        } catch (error) {

            log.error(`request handler failed to ${request.method}: ${request.url}`);
            log.error(error);

            context.error(error);

        } finally {
            clearTimeout(timeout);
            context.close();
        }

    };

};


