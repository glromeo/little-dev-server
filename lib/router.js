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

const segmentRegExp = /\/+([^/?#;]*)/;

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

        if (typeof method === "string") {
            method = Symbols[method];
        }

        log.debug("creating route: ", method, path, handler);

        const matchSegment = /\/+([^/?#]*)/g;
        let ctx = (this.routes[method] || (this.routes[method]={}));
        let exec, segment, s = 0;

        while (exec = matchSegment.exec(path)) {
            segment = exec[1];
            if (segment.length === 0) {
                break;
            } else if (segment.startsWith(":")) {
                ctx = ctx[VAR] || (ctx[VAR] = {});
                if (handler.variables === undefined) {
                    handler = handler.bind(null);
                    handler.variables = {};
                }
                handler.variables[segment.substring(1)] = s;
            } else if (segment === "*") {
                ctx = ctx[WILDCARD] || (ctx[WILDCARD] = {});
                break;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
            ++s;
        }
        // if (ctx[method] === undefined) {
        //     ctx[method] = [handler];
        // } else {
        //     ctx[method] = method === Symbols.BEFORE ? [handler, ...ctx[method]] : [...ctx[method], handler];
        // }
        ctx.__handler__ = handler;
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

    find(req) {
        const pathname = req.url;
        const segments = [];
        const routes = this.routes[Symbols[req.method]];
        return find(pathname, segments, routes);
    }
}

function merge(s, p, ctx, leftover) {

    if (p) {
        if (!s) return p;
    } else {
        return s;
    }

    let r = {};

    const m = ctx.__method__;
    r[m] = p[m] ? s[m] ? [...s[m], ...p[m]] : p[m] : s[m];
    const b = Symbols.BEFORE;
    r[b] = p[b] ? s[b] ? [...s[b], ...p[b]] : p[b] : s[b];
    const a = Symbols.AFTER;
    r[a] = p[a] ? s[a] ? [...s[a], ...p[a]] : p[a] : s[a];
    const v = VAR;
    r[v] = p[v] ? s[v] ? [...s[v], ...p[v]] : p[v] : s[v];
    const w = WILDCARD;
    r[w] = p[w] ? s[w] ? [...s[w], ...p[w]] : p[w] : s[w];

    const match = leftover !== "/" && segmentRegExp.exec(leftover);
    if (match) {
        const sg = match[1];
        if (sg.length !== 0) {
            r[sg] = p[sg] ? s[sg] ? [...s[sg], ...p[sg]] : p[sg] : s[sg];
        }
    }

    return r;
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

            const wildcard = routes[WILDCARD];
            if (wildcard) {
                if (wildcard[Symbols.BEFORE]) for (const filter of wildcard[Symbols.BEFORE]) {
                    await service(filter, ctx, pathname, segments);
                }
            }

            const route = merge(routes[segment], routes[VAR], ctx, leftover);
            if (route) {
                await dispatch(ctx, leftover, [...segments, segment], route);
            }

            if (wildcard) {
                const handlers = wildcard[ctx.__method__];
                if (handlers) for (const handler of handlers) {
                    await service(handler, ctx, pathname, segments);
                }
                if (wildcard[Symbols.AFTER]) for (const filter of wildcard[Symbols.AFTER]) {
                    await service(filter, ctx, pathname, segments);
                }
            }
        }
    }

    const handlers = routes[ctx.__method__];
    if (handlers) for (const handler of handlers) {
        await service(handler, ctx, pathname, segments);
    }
    if (routes[Symbols.AFTER]) for (const filter of routes[Symbols.AFTER]) {
        await service(filter, ctx, pathname, segments);
    }
}

function find(pathname, segments, routes) {

    const match = pathname !== "/" && segmentRegExp.exec(pathname);
    if (match) {
        const leftover = pathname.substring(match[0].length) || "/";
        const segment = match[1];
        if (segment.length !== 0) {

            const wildcard = routes[WILDCARD];

            let route;

            if ((route= routes[segment])) {
                route = find(leftover, segment, route);
                if (route) {
                    return route;
                }
            }

            if ((route= routes[VAR])) {
                route = find(leftover, [...segments, segment], route);
                if (route) {
                    return route;
                }
            }

            if (wildcard) {
                if (routes.__handler__) {
                    return endpoint(routes.__handler__, pathname, segments);
                }
            }
        }
    }

    if (routes.__handler__) {
        return endpoint(routes.__handler__, pathname, segments);
    }
}

async function service(callback, ctx, pathname, segments) {
    const params = ctx.params;
    try {
        ctx.pathname = pathname;
        if (callback.variables) {
            ctx.params = {};
            for (const [name, index] of Object.entries(callback.variables)) {
                ctx.params[name] = fastDecodeURIComponent(segments[index]);
            }
        } else {
            ctx.params = EMPTY_OBJECT;
        }
        await callback(ctx);
    } finally {
        ctx.params = params;
    }
}

function endpoint(callback, pathname, segments) {
    let params = {};
    if (callback.variables) {
        for (const [name, index] of Object.entries(callback.variables)) {
            params[name] = fastDecodeURIComponent(segments[index]);
        }
    } else {
        params = EMPTY_OBJECT;
    }
    return {
        handler: callback,
        params,
        pathname
    };
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
