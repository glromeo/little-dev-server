const log = require("tiny-node-logger/index.js");

const qs = require("qs");
const {quickParseSimpleURL} = require("./utility/quick-parse-url.js");
const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");

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

module.exports.createRouter = (config, watcher) => {

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

        route(req, res) {
            const dispatched = dispatch({
                method: METHODS[req.method],
                url: req.url,
                re: /\/+([^/?#]*)/g,
                req,
                res,
                segments: []
            }, this.routes);
            if (!dispatched) {
                throw new Error(`no route found for: ${req.method} ${req.url}`);
            }
            return dispatched;
        }
    }

    function dispatch(ctx, routes) {
        const lastIndex = ctx.re.lastIndex;
        const exec = ctx.re.exec(ctx.url);
        if (exec) {
            const segment = exec[1];
            let route;
            if ((route = routes[segment])) {
                let next = dispatch(ctx, route);
                if (next) {
                    return next;
                }
                route = route[ctx.method];
                if (route) {
                    return serve(ctx, route);
                }
            }
            if ((route = routes[MATCH_ONE])) {
                ctx.segments.push(segment);
                let next = dispatch(ctx, route);
                if (next) {
                    return next;
                }
                route = route[ctx.method];
                if (route) {
                    return serve(ctx, route);
                }
            }
            if ((route = routes[MATCH_MANY])) {
                route = route[ctx.method];
                if (route) {
                    ctx.re.lastIndex = lastIndex;
                    return serve(ctx, route);
                }
            }
        }
        ctx.re.lastIndex = lastIndex;
    }

    async function serve({url, re, segments, req, res}, {params, handler}) {

        const ctx = quickParseSimpleURL(url.substring(re.lastIndex));

        ctx.vars = pathVariables(params, segments);
        ctx.payload = req.method === "PUT" || req.method === "POST" ? await readPayload(req) : undefined;

        let output = handler.call(ctx, {...ctx.vars, ...ctx.query}, ctx.payload, req, res);

        if (output !== undefined) {
            if (typeof output.then === "function") {
                output = await output;
            }
            let accept = req.headers['accept'],
                content,
                contentType;
            if (accept) {
                accept = accept.split(",")[0];
            }
            if (accept === "application/json") {
                content = JSON.stringify(output)
                contentType = "application/json; charset=UTF-8";
            }
            if (accept === "text/plain" || accept === undefined) {
                content = String(output)
                contentType = "text/plain; charset=UTF-8";
            }
            return {
                content,
                contentType,
                contentLength: content.length,
                lastModified: new Date()
            }
        }
    }

    function pathVariables(params, values) {
        const names = Object.keys(params);
        if (names.length) {
            const vars = {};
            for (const name of names) {
                vars[name] = decodeURIComponent(values[params[name]]);
            }
            return vars;
        } else {
            return EMPTY_OBJECT;
        }
    }

    async function readPayload(req) {
        let contentType = req.headers["content-type"];
        if (contentType) {
            contentType = contentType.split(";")[0];
            const text = await contentText(req);
            switch (contentType) {
                case "application/json":
                    return JSON.parse(text)
                case "application/x-www-form-urlencoded":
                    return qs.parse(text)
                case "text/plain":
                default:
                    return text;
            }
        } else {
            return EMPTY_OBJECT;
        }
    }

    for (const symbol of Object.values(module.exports.METHODS)) {
        router[symbol.description] = router.use.bind(router, symbol);
    }

    return router;
};
