const log = require("tiny-node-logger");

const {Context} = require("./context.js");
const {createPipeline} = require("./pipeline.js");
const {useRouter, NO_RESPONSE_REQUIRED} = require("./router.js");
const {sendContent} = require("./utility/content-utils.js");
const {OK, REQUEST_TIMEOUT} = require("http-status-codes");
const {useHttp2Push} = require("./middleware/http2-push.js");

module.exports.createRequestHandler = (config, watcher) => {

    const router = useRouter(config);
    const http2Push = useHttp2Push(config);

    return async function requestHandler(req, res) {

        try {
            for (const endpoint of router.route(req)) {
                const {
                    handler,
                    variables,
                    pathname
                } = endpoint;

                context.apply(pathname, variables);

                const output = await handler(req, res);

                if (context.closed) {
                    return;
                }

                if (output !== undefined) {
                    await context.send(OK, output);
                } else {
                    const {
                        pathname,
                        content,
                        links
                    } = context;
                    if (!context.opened) {
                        if (config.http2 === "preload" && links) {
                            context.header("link", [...links].map(src => {
                                return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
                            }));
                        }
                        context.open(OK);
                    }
                    if (!context.closed) {
                        if (config.http2 === "push" && links) {
                            http2Push(res.stream, links);
                        }
                        context.send(OK, content);
                    }
                }
            }

        } catch (error) {
            log.error(`request handler failed to ${req.method}: ${req.url}`);
            log.error(error);
            context.error(error);
        } finally {
            context.close();
        }

    };

};


