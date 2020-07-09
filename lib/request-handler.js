const log = require("tiny-node-logger");

const {Context} = require("./context.js");
const {createPipeline} = require("./pipeline.js");
const {createRouter, NO_RESPONSE_REQUIRED} = require("./router.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./utility/http2-push.js");
const HttpStatus = require("http-status-codes");

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

        if (response.writableEnded || response.headersSent) throw NO_RESPONSE_REQUIRED;

        if (output !== undefined && typeof output.then === "function") {
            output = await output;
        }
        if (output !== undefined && output.content !== undefined) {
            return output;
        }

        return formatContent(request, output);

        response.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": contentLength,
            "Last-Modified": lastModified.toUTCString(),
            "ETag": etag(JSON.stringify([
                request.url,
                contentLength,
                lastModified
            ]), config.etag)
        });

        if (links && config.server.http2.push) {
            http2Push(response.stream, pathname, links, pipeline);
        } else if (config.server.http2.preload) {
            response.setHeader("link", [...links].map(src => {
                return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
            }));
        }

        sendContent(response, content, request.headers["user-agent"]);
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
                pathname
            } = router.route(context);

            context.pathname = pathname;
            context.variables = variables;

            await handler.handle(context, next);

        } catch (error) {

            log.error(`request handler failed to ${request.method}: ${request.url}`);
            log.error(error);

            context.error(error);

            // if (exception.redirect) {
            //     response.writeHead(HttpStatus.PERMANENT_REDIRECT, {
            //         "Location": exception.redirect
            //     });
            //     response.end();
            // } else if (!response.writableEnded) {
            //     sendError(exception.code, exception.message, exception.stack);
            // }

        } finally {
            clearTimeout(timeout);
            context.close();
        }

    };

};
