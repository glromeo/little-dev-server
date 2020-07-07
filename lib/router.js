const log = require("tiny-node-logger/index.js");

const {quickParseSimpleURL} = require("./utility/quick-parse-url.js");
const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");
const qs = require("qs");
const etag = require("etag");

const METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
}

module.exports.METHODS = METHODS;

const getMethod = ctx => METHODS[ctx.req.method];

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

const QUERY = Symbol("?");

module.exports.createRouter = (config = {}, watcher) => {

    const router = {

        routes: {},

        use(method, path, handler) {
            const re = /\/+([^/?#]*)/g;
            let ctx = this.routes;
            let p = 0, exec, segment;
            while (exec = re.exec(path)) {
                segment = exec[1];
                if (segment.startsWith(":")) {
                    ctx = ctx[MATCH_ONE] || (ctx[MATCH_ONE] = {});
                    handler[p++] = segment.substring(1);
                } else if (segment === "**") {
                    ctx = ctx[MATCH_MANY] || (ctx[MATCH_MANY] = {});
                } else {
                    ctx = ctx[segment] || (ctx[segment] = {});
                }
            }
            if (ctx[method]) {
                throw new Error(`route already used for: ${method.description.toUpperCase()} ${path}`);
            }
            ctx[method] = handler;
        },

        route(ctx, next) {
            const dispatched = dispatch(ctx, this.routes, /\/+([^/?#]*)/g, []);
            if (!dispatched) {
                throw new Error(`no route found for: ${ctx.req.method} ${ctx.req.url}`);
            }
            return dispatched;
        }
    }

    function dispatch(ctx, routes, re, vars) {
        const lastIndex = re.lastIndex;
        const exec = re.exec(ctx.req.url);
        if (exec) {
            const segment = exec[1];
            let route;
            if ((route = routes[segment])) {
                let next = dispatch(ctx, route, re, vars);
                if (next) {
                    return next;
                }
                route = route[getMethod(ctx)];
                if (route) {
                    return serve(ctx, route, re, vars);
                }
            }
            if ((route = routes[MATCH_ONE])) {
                vars.push(segment);
                let next = dispatch(ctx, route, re, vars);
                if (next) {
                    return next;
                }
                route = route[getMethod(ctx)];
                if (route) {
                    return serve(ctx, route, re, vars);
                }
            }
            if ((route = routes[MATCH_MANY])) {
                route = route[getMethod(ctx)];
                if (route) {
                    re.lastIndex = lastIndex;
                    return serve(ctx, route, re, vars);
                }
            }
        }
        re.lastIndex = lastIndex;
    }

    /**
     *
     * @param ctx
     * @param handler
     * @param re
     * @param vars
     * @returns {Promise<{contentLength: number, lastModified: Date, contentType: string, content: string}|*>}
     */
    async function serve(ctx, handler, re, vars) {

        const {req, res} = ctx;

        Object.assign(ctx, quickParseSimpleURL(req.url, re.lastIndex));

        defineGetter(ctx, "query", function () {
            if (this[QUERY] === undefined) {
                this[QUERY] = this.search === undefined ? EMPTY_OBJECT : qs.parse(this.search);
            }
            return this[QUERY];
        })

        ctx.params = {};
        for (let s = 0; s < vars.length; s++) {
            ctx.params[handler[s]] = decodeURIComponent(vars[s]);
        }

        defineGetter(ctx, "payload", function () {
            return parsePayload(req);
        })

        let output = handler(ctx, req, res);

        if (res.writableEnded || res.headersSent) throw NO_RESPONSE_REQUIRED;

        if (output !== undefined && typeof output.then === "function") {
            output = await output;
        }
        if (output !== undefined && output.content !== undefined) {
            return output;
        }

        return formatContent(req, output);
    }

    const defineGetter = (ctx, name, get) => Object.defineProperty(ctx, name, {enumerable: true, get});

    async function parsePayload(req) {
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

    function formatContent(req, output) {
        let accept = req.headers["accept"];
        if (accept) {
            accept = accept.split(",")[0];
        }
        let content, contentType;
        if (accept === "application/json") {
            content = typeof output === "object" ? JSON.stringify(output) : "";
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

    for (const symbol of Object.values(module.exports.METHODS)) {
        router[symbol.description] = router.use.bind(router, symbol);
    }

    if (typeof config.routing === "function") {
        config.routing(router, config);
    }

    return router;
};
