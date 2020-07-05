const log = require("tiny-node-logger");

const {createPipeline} = require("./pipeline.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./utility/http2-push.js");
const HttpStatus = require("http-status-codes");

const {quickParseSimpleURL} = require("../lib/utility/quick-parse-url.js");
const qs = require("qs");
const {contentText} = require("./utility/content-utils");

const METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
}

module.exports.METHODS = METHODS;

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

const EMPTY_PAYLOAD = Object.freeze(Object.create(null));

module.exports.createRouter = () => {

    const router = {

        routes: {},

        use(method, path, handler) {
            const re = /\/+([^/?#]*)/g;
            let ctx = this.routes;
            let p = 0, exec, segment, route = {handler, params: {}};
            while (exec = re.exec(path)) {
                segment = exec[1];
                if (segment.startsWith(":")) {
                    ctx = ctx[MATCH_ONE] || (ctx[MATCH_ONE] = {});
                    const name = segment.substring(1);
                    route.params[name] = p++;
                } else if (segment === "**") {
                    ctx = ctx[MATCH_MANY] || (ctx[MATCH_MANY] = {});
                } else {
                    ctx = ctx[segment] || (ctx[segment] = {});
                }
            }
            if (ctx[method]) {
                throw new Error(`route already used for: ${method.description.toUpperCase()} ${path}`);
            }
            ctx[method] = route;
        },

        route(method, url, req, res) {
            const service = dispatch({
                method: METHODS[method],
                url,
                re: /\/+([^/?#]*)/g
            }, this.routes, []);
            if (service) {
                return service(req, res);
            }
        }
    }

    function dispatch(ctx, routes, segments) {
        const lastIndex = ctx.re.lastIndex;
        const exec = ctx.re.exec(ctx.url);
        if (exec) {
            const segment = exec[1];
            let route;
            if ((route = routes[segment])) {
                let next = dispatch(ctx, route, segments);
                if (next) {
                    return next;
                }
                const handler = route[ctx.method];
                if (handler) {
                    return createEndpoint(handler, segments, ctx.url.substring(ctx.re.lastIndex));
                }
            }
            if ((route = routes[MATCH_ONE])) {
                segments = [...segments, segment];
                let next = dispatch(ctx, route, segments);
                if (next) {
                    return next;
                }
                const handler = route[ctx.method];
                if (handler) {
                    return createEndpoint(handler, segments, ctx.url.substring(ctx.re.lastIndex));
                }
            }
            if ((route = routes[MATCH_MANY])) {
                const handler = route[ctx.method];
                if (handler) {
                    return createEndpoint(handler, segments, ctx.url.substring(ctx.re.lastIndex));
                }
            }
        }
        ctx.re.lastIndex = lastIndex;
    }

    function createEndpoint(route, segments, url) {

        const {
            pathname,
            search,
            query,
            fragment
        } = quickParseSimpleURL(url);

        const vars = {};
        for (const name of Object.keys(route.params)) {
            vars[name] = decodeURIComponent(segments[route.params[name]]);
        }

        const params = {...vars, ...query};
        const handler = route.handler.bind({
            pathname,
            vars,
            query,
            params,
            fragment
        });

        return async function service(req, res) {

            let payload, contentType = req.headers["content-type"];
            if (contentType) {
                contentType = contentType.split(";")[0];
                switch (contentType) {
                    case "application/json":
                        payload = JSON.parse(await contentText(req))
                        break;
                    case "application/x-www-form-urlencoded":
                        payload = qs.parse(await contentText(req))
                        break;
                    case "text/plain":
                    default:
                        payload = await contentText(req);
                }
            } else {
                payload = EMPTY_PAYLOAD;
            }

            let output = handler(params, payload, req, res);

            if (output !== undefined) {
                let accept = req.headers["accept"];
                if (accept) {
                    accept = accept.split(",")[0];
                }
                if (accept === "application/json") {
                    res.setHeader("content-type", "application/json; charset=UTF-8");
                    output = JSON.stringify(output)
                }
                if (accept === "text/plain" || accept === undefined) {
                    res.setHeader("content-type", "text/plain; charset=UTF-8");
                }
                res.statusCode = 200;
                res.end(String(output));
            }
        }
    }

    for (const symbol of Object.values(module.exports.METHODS)) {
        router[symbol.description] = router.use.bind(router, symbol);
    }

    return router;
};

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

    });

    return async function requestHandler(request, response) {

        const {method, url, headers} = request;


        const userAgent = headers["user-agent"];

        try {
            const {
                filename,
                content,
                headers,
                links
            } = await pipeline(request.url);

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
