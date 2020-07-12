const log = require("tiny-node-logger/index.js");
const {memoize} = require("./utility/memoize.js");

const METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
};

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

class Router {

    constructor() {
        this.routes = {};
    }

    use(method, path, handler) {
        log.debug("creating route: ", method, path, handler);
        const matchSegment = /\/+([^/?#]*)/g;
        let ctx = this.routes;
        let p = 0, exec, segment;
        while (exec = matchSegment.exec(path)) {
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
        ctx[method] = ctx[method] === undefined ? handler : [...ctx[method]];
    }

    get(path, handler) {
        return this.use(METHODS.GET, path, handler);
    }

    put(path, handler) {
        return this.use(METHODS.PUT, path, handler);
    }

    delete(path, handler) {
        return this.use(METHODS.DELETE, path, handler);
    }

    post(path, handler) {
        return this.use(METHODS.POST, path, handler);
    }

    options(path, handler) {
        return this.use(METHODS.OPTIONS, path, handler);
    }

    route(request) {
        log.debug(`routing: ${request.method} ${request.url}`);
        const route = dispatch({
            request,
            matchSegment: /\/+([^/?#]*)/g,
            segments: []
        }, this.routes);
        if (!route) {
            throw new Error(`no route found for: ${request.method} ${request.url}`);
        }
        log.debug("dispatched to:", route);
        return route;
    }
}

function dispatch(context, router) {

    const {request: {method, url}, matchSegment} = context;

    const lastMatchIndex = matchSegment.lastIndex;
    const exec = matchSegment.exec(url);
    if (exec) {
        const segment = exec[1];
        let route;
        if ((route = router[segment])) {
            let next = dispatch(context, route);
            if (next) {
                return next;
            }
            route = route[METHODS[method]];
            if (route) {
                return service(context, route);
            }
        }
        if ((route = router[MATCH_ONE])) {
            context.segments.push(segment);
            let next = dispatch(context, route);
            if (next) {
                return next;
            }
            route = route[METHODS[method]];
            if (route) {
                return service(context, route);
            }
        }
        if ((route = router[MATCH_MANY])) {
            route = route[METHODS[method]];
            if (route) {
                matchSegment.lastIndex = lastMatchIndex;
                return service(context, route);
            }
        }
    }
    matchSegment.lastIndex = lastMatchIndex;
}

function service({request, matchSegment, segments}, handler) {
    const variables = {};
    if (segments.length) {
        for (let s = 0; s < segments.length; s++) {
            variables[handler[s]] = decodeURIComponent(segments[s]);
        }
    }
    return {
        handler,
        variables,
        url: request.url.substring(matchSegment.lastIndex)
    };
}

module.exports = {
    METHODS,
    Router,
    useRouter: memoize(function (config = {}, watcher) {
        const router = new Router();
        if (typeof config.routing === "function") {
            config.routing(router, config);
        }
        return router;
    })
};
