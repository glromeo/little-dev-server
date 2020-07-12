const log = require("tiny-node-logger");

const {Context} = require("./context.js");
const {createPipeline} = require("./pipeline.js");
const {useRouter, NO_RESPONSE_REQUIRED} = require("./router.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./middleware/http2-push.js");
const {OK, REQUEST_TIMEOUT} = require("http-status-codes");

module.exports.createRequestHandler = (config, watcher) => {

    const pipeline = createPipeline(config, watcher);
    const http2Push = useHttp2Push(config);

    const router = useRouter(config);

    return async function requestHandler(request, response) {

        const context = new Context(request, response);
        try {
            for (const endpoint of router.route(request)) {
                const {
                    handler,
                    variables,
                    url
                } = endpoint;

                context.apply(url, variables);

                const out = await handler(context);

                const {
                    pathname,
                    content,
                    headers,
                    links
                } = context;

                if (!response.headersSent) {

                    if (config.http2 === "preload" && links) {
                        response.setHeader("link", [...links].map(src => {
                            return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                        }));
                    }

                    context.send(200);
                }

                if (!response.writableEnded) {

                    if (config.http2 === "push" && links) {
                        http2Push(response.stream, pathname, links, pipeline);
                    }

                    return sendContent(response, content, request.headers["user-agent"]);
                }

                if (output !== undefined) {
                    await context.send(OK, output);
                }

                if (out !== undefined) {
                    context.send(out);
                }
            }

            for (const handler of handlers) {
                if (context.ended) {
                    break;
                }
            }

        } catch (error) {
            log.error(`request handler failed to ${request.method}: ${request.url}`);
            log.error(error);
            context.error(error);
        } finally {
            context.close();
        }

    };

};


