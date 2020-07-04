const log = require("tiny-node-logger");

const {createPipeline} = require("./pipeline.js");
const {sendContent} = require("./utility/content-utils.js");
const {useHttp2Push} = require("./utility/http2-push.js");
const HttpStatus = require("http-status-codes");

const {quickParseURL} = require("../lib/utility/quick-parse-url.js");

module.exports.METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
}

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

module.exports.createRouter = () => {

    class Route {

        constructor(handler) {
            this.handler = handler;
        }

        instantiate(values, url) {

            const {
                pathname,
                search,
                fragment
            } = quickParseURL(url);

            const params = {};
            if (this.params) {
                for (let i = this.params.length - 1; i >= 0; i--) {
                    const name = this.params[i];
                    params[name] = decodeURIComponent(values[i]);
                }
            }

            const query = {};
            if (search) for (const pair of search.split("&")) {
                const [key, value] = pair.split("=");
                query[decodeURIComponent(key)] = decodeURIComponent(value);
            }

            return {
                pathname,
                search,
                query,
                fragment
            }
        }
    }

    const router = {

        routes: {},

        use(method, path, handler) {
            const re = /\/+([^/?#]*)/g;
            let ctx = this.routes;
            let s = 0, route = new Route(handler), exec, segment;
            while (exec = re.exec(path)) {
                segment = exec[1];
                if (segment.startsWith(":")) {
                    ctx = ctx[MATCH_ONE] || (ctx[MATCH_ONE] = {});
                    const name = segment.substring(1);
                    route.params = route.params ? [...route.params, name]:[name];
                } else if (segment === "**") {
                    ctx = ctx[MATCH_MANY] || (ctx[MATCH_MANY] = {});
                } else {
                    ctx = ctx[segment] || (ctx[segment] = {});
                }
                s++;
            }
            if (ctx[method]) {
                throw new Error(`handler already registered for: ${method.description.toUpperCase()} ${path}`);
            }
            ctx[method] = route;
        },

        route(method, url, req, res) {
            return dispatch({
                method,
                url,
                re: /\/+([^/?#]*)/g
            }, this.routes, []);
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
                next = route[ctx.method];
                if (next) {
                    return next.instantiate(segments, ctx.url.substring(lastIndex));
                }
            }
            if ((route = routes[MATCH_ONE])) {
                segments = [...segments, segment];
                let next = dispatch(ctx, routes, route, segments);
                if (next) {
                    return next;
                }
                next = route[ctx.method];
                if (next) {
                    return next.instantiate(segments, ctx.url.substring(lastIndex));
                }
            }
            if ((route = routes[MATCH_MANY])) {
                let next = route[ctx.method];
                if (next) {
                    return next.instantiate(segments, ctx.url.substring(lastIndex));
                }
            }
        }
        ctx.re.lastIndex = lastIndex;
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

    return async function requestHandler(request, response) {

        const {method, url, headers} = request;

        const pathRegEx = /\/+([^/?#]*)/g;
        const result = pathRegEx.exec(url);
        if (result !== null) {
            const segment = result[1];
            routes.get(segment);
        }


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
