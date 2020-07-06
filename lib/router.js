const log = require("tiny-node-logger/index.js");

const qs = require("qs");
const {quickParseSimpleURL} = require("./utility/quick-parse-url.js");
const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");

const etag = require("etag");

const METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
}

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

const NO_RESPONSE_REQUIRED = Symbol("writableEnded||headersSent");

Object.assign(module.exports, {
    METHODS,
    NO_RESPONSE_REQUIRED
});

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

    async function serve({url, re, segments, req, res}, handler) {

        const ctx = quickParseSimpleURL(url.substring(re.lastIndex));

        ctx.url = url;

        ctx.params = {};
        for (let s = 0; s < segments.length; s++) {
            ctx.params[handler[s]] = decodeURIComponent(segments[s]);
        }

        Object.defineProperty(ctx, "payload", {
            enumerable: true,
            get() {
                return parsePayload(req);
            }
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
            lastModified: new Date(),
            etag: etag(JSON.stringify([
                req.url,
                contentLength,
                lastModified
            ]), config.etag)
        }
    }

    for (const symbol of Object.values(module.exports.METHODS)) {
        router[symbol.description] = router.use.bind(router, symbol);
    }

    if (typeof config.routing === "function") {
        config.routing(config, router);
    }

    return router;
};
