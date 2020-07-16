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

    on(method, path, callback) {

        const handler = {callback, variables: {}};

        log.debug("creating route: ", method, path, handler);

        let ctx = this.routes;
        let segment, f = -1, fragments = path.substring(1).split(/\/+/);
        while (++f < fragments.length) {
            segment = fragments[f];
            if (segment.startsWith(":")) {
                ctx = ctx[VAR] || (ctx[VAR] = {});
                handler.variables[segment.substring(1)] = f;
            } else if (segment === "*") {
                ctx = ctx[WILDCARD] || (ctx[WILDCARD] = {});
                break;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
        }

        // if (ctx[method] === undefined) {
        //     ctx[method] = [handler];
        // } else {
        //     ctx[method] = method === Symbols.BEFORE ? [handler, ...ctx[method]] : [...ctx[method], handler];
        // }
        ctx[method] = handler;

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

    find(ctx) {
        const method = ctx.req.method;
        const url = ctx.req.url;

        const fragments = url.substring(1).split(/\/+/);

        const q = fragments[fragments.length - 1].lastIndexOf("?");
        if (q !== -1) {
            fragments[fragments.length - 1] = fragments[fragments.length - 1].substring(0, q);
        }

        let routes = this.routes;
        let f = 0;
        while (f < fragments.length) {
            const segment = fragments[f++];
            if (routes[segment]) {
                routes = routes[segment];
            } else if (routes[VAR]) {
                routes = routes[VAR];
            } else if (routes[WILDCARD]) {
                const handler = routes[WILDCARD][method];
                if (handler) {
                    return endpoint(handler, ctx, "/" + fragments.slice(f - 1).join("/"), fragments);
                }
                break;
            }
        }

        const handler = routes[method];
        if (handler) {
            return endpoint(handler, ctx, "/" + fragments.slice(f).join("/"), fragments);
        }
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

function endpoint({callback, variables}, ctx, pathname, segments) {
    return callback;
    if (variables) {
        ctx.params = {};
        for (const [name, index] of Object.entries(variables)) {
            ctx.params[name] = fastDecodeURIComponent(segments[index]);
        }
    } else {
        ctx.params = EMPTY_OBJECT;
    }
    return {
        handler: callback,
        params: ctx.params,
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
