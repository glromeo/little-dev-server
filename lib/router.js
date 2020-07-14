const log = require("tiny-node-logger/index.js");
const {EMPTY_OBJECT} = require("./utility/content-utils.js");
const {memoize} = require("./utility/memoize.js");
const fastDecodeURIComponent = require("fast-decode-uri-component");

const Symbols = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    OPTIONS: Symbol("options"),
    POST: Symbol("post"),
    PATCH: Symbol("patch"),
    BEFORE: Symbol("before"),
    AFTER: Symbol("after")
};

const VAR = Symbol("var");
const WILDCARD = Symbol("wildcard");

const segmentRegExp = /\/+([^/?#]*)/;

class Router {

    constructor() {
        this.routes = {};
        this.filters = {};
    }

    reset() {
        this.routes = {};
        this.filters = {};
        return this;
    }

    on(method, path, handler) {

        log.debug("creating route: ", method, path, handler);

        const matchSegment = /\/+([^/?#]*)/g;
        let ctx = this.routes;
        let exec, segment;

        while (exec = matchSegment.exec(path)) {
            segment = exec[1];
            if (segment.length === 0) {
                break;
            } else if (segment.startsWith(":")) {
                ctx = ctx[VAR] || (ctx[VAR] = {});
                if (handler.variables === undefined) {
                    handler = handler.bind(null);
                    handler.variables = [];
                }
                handler.variables.push(segment.substring(1));
            } else if (segment === "**") {
                ctx = ctx[WILDCARD] || (ctx[WILDCARD] = {});
                break;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
        }
        if (ctx[method] === undefined) {
            ctx[method] = [handler];
        } else {
            ctx[method] = method === Symbols.BEFORE ? [handler, ...ctx[method]] : [...ctx[method], handler];
        }
        return this;
    }

    get(path, handler) {
        return this.on(Symbols.GET, path, handler);
    }

    put(path, handler) {
        return this.on(Symbols.PUT, path, handler);
    }

    delete(path, handler) {
        return this.on(Symbols.DELETE, path, handler);
    }

    options(path, handler) {
        return this.on(Symbols.OPTIONS, path, handler);
    }

    post(path, handler) {
        return this.on(Symbols.POST, path, handler);
    }

    patch(path, handler) {
        return this.on(Symbols.PATCH, path, handler);
    }

    any(path, handler) {
        this.get(path, handler);
        this.put(path, handler);
        this.delete(path, handler);
        this.options(path, handler);
        this.post(path, handler);
        this.patch(path, handler);
        return this;
    }

    before(path, filter) {
        return this.on(Symbols.BEFORE, path, filter);
    }

    after(path, filter) {
        return this.on(Symbols.AFTER, path, filter);
    }

    route(ctx) {
        log.debug(`routing: ${ctx.req.method} ${ctx.req.url}`);
        ctx.__method__ = Symbols[ctx.req.method];
        const pathname = ctx.req.url;
        const segments = [];
        const routes = this.routes;
        return dispatch(ctx, pathname, segments, routes);
    }
}

async function dispatch(ctx, pathname, segments, routes) {

    if (routes[Symbols.BEFORE]) for (const filter of routes[Symbols.BEFORE]) {
        await service(filter, ctx, pathname, segments);
    }

    const match = pathname !== "/" && segmentRegExp.exec(pathname);
    if (match) {
        const leftover = pathname.substring(match[0].length) || "/";
        const segment = match[1];
        if (segment.length !== 0) {
            let route, bunch = {};
            if ((route = routes[segment])) {
                await dispatch(ctx, leftover, segments, route);
            }
            if ((route = routes[VAR])) {
                segments.push(segment);
                await dispatch(ctx, leftover, segments, route);
                segments.pop();
            }
            if ((route = routes[WILDCARD])) {
                await dispatch(ctx, pathname, segments, route);
            }
        }
    }

    const handlers = routes[ctx.__method__];
    if (handlers) {
        for (const handler of handlers) {
            await service(handler, ctx, pathname, segments);
        }
    }

    if (routes[Symbols.AFTER]) for (const filter of routes[Symbols.AFTER]) {
        await service(filter, ctx, pathname, segments);
    }
}

async function service(callback, ctx, pathname, segments) {
    const params = ctx.params;
    try {
        ctx.pathname = pathname;
        if (callback.variables) {
            ctx.params = {};
            for (let s = 0; s < segments.length; s++) {
                ctx.params[callback.variables[s]] = fastDecodeURIComponent(segments[s]);
            }
        } else {
            ctx.params = EMPTY_OBJECT;
        }
        await callback(ctx);
    } finally {
        ctx.params = params;
    }
}

module.exports = {
    Router,
    useRouter: memoize(function (config = {}, watcher) {
        const router = new Router();
        if (typeof config.routing === "function") {
            config.routing(router, config);
        }
        return router;
    })
};
