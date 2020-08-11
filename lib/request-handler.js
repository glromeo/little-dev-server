const log = require("tiny-node-logger");

const HttpStatus = require("http-status-codes");
const corsMiddleware = require("cors");
const {createRouter} = require("./router.js");
const {useResourceProvider} = require("./resource-provider.js");
const {useHttp2Push} = require("./util/http2-push.js");
const {contentType} = require("./util/mime-types.js");

module.exports.createRequestHandler = (config, watcher) => {

    const {http2} = config;

    const {provideResource} = useResourceProvider(config, watcher);
    const {http2Push} = useHttp2Push(config, watcher);

    const router = createRouter(config.router);

    const {createReadStream} = require("fs");
    const {join} = require("path");
    const {parse: parseURL} = require("fast-url-parser");

    router.get("/resources/*", (req, res) => {
        const {pathname} = parseURL(req.url);
        const filename = join(config.resources, pathname.substring(10));
        res.writeHead(HttpStatus.OK, {
            "content-type": contentType(filename),
            "cache-control": "public, max-age=86400, immutable"
        });
        createReadStream(filename).pipe(res);
    });

    router.get("/*", async (req, res) => {

        log.debug(req.method, req.url);

        try {
            const {
                pathname,
                content,
                headers,
                links
            } = await provideResource(req.url, req.headers);

            if (links && http2 === "push") {
                res.writeHead(200, headers);
                res.write(content);
                await http2Push(res.stream, pathname, links, req.headers);
                res.end();
                return;
            }

            if (links && http2 === "preload") {
                res.setHeader("link", [...links].map(
                    src => `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`
                ));
            }

            res.writeHead(200, headers);
            res.end(content);

        } catch ({code, headers = {}, message, stack}) {
            if (stack) {
                log.error(HttpStatus.INTERNAL_SERVER_ERROR, stack);
                res.writeHead(HttpStatus.INTERNAL_SERVER_ERROR, headers);
                res.end(stack);
            } else {
                res.writeHead(code, headers);
                res.end(message);
            }
        }
    });

    const cors = corsMiddleware(config.cors);
    const next = (req, res) => function (err) {
        if (err) {
            throw err;
        } else {
            router.lookup(req, res);
        }
    };

    return function handler(req, res) {
        cors(req, res, next(req, res));
    };
};
