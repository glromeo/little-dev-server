const log = require("tiny-node-logger/index.js");
const {EMPTY_OBJECT} = require("./utility/content-utils.js");
const {memoize} = require("./utility/memoize.js");
const fastDecodeURIComponent = require("fast-decode-uri-component");

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");
const HANDLERS = Symbol("...");

class Router {

    constructor() {
        this.routes = {};
    }

    reset() {
        this.routes = {};
        return this;
    }

    on(method, path, handler) {
        log.debug("creating route: ", method, path, handler);
        const matchSegment = /\/+([^/?#]*)/g;
        let ctx = this.routes[method] || (this.routes[method] = {});
        let exec, segment;
        while (exec = matchSegment.exec(path)) {
            segment = exec[1];
            if (segment.length === 0) {
                break;
            } else if (segment.startsWith(":")) {
                ctx = ctx[MATCH_ONE] || (ctx[MATCH_ONE] = {});
                if (handler.parameters === undefined) {
                    handler.parameters = [];
                }
                handler.parameters.push(segment.substring(1));
            } else if (segment === "**") {
                if (ctx[MATCH_MANY] === undefined) {
                    ctx[MATCH_MANY] = [handler];
                } else {
                    ctx[MATCH_MANY].push(handler);
                }
                return this;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
        }
        if (ctx[HANDLERS] === undefined) {
            ctx[HANDLERS] = [handler];
        } else {
            ctx[HANDLERS].push(handler);
        }
        return this;
    }

    get(path, handler) {
        return this.on("GET", path, handler);
    }

    put(path, handler) {
        return this.on("PUT", path, handler);
    }

    delete(path, handler) {
        return this.on("DELETE", path, handler);
    }

    options(path, handler) {
        return this.on("OPTIONS", path, handler);
    }

    post(path, handler) {
        return this.on("POST", path, handler);
    }

    patch(path, handler) {
        return this.on("PATCH", path, handler);
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

    route(request) {
        log.debug(`routing: ${request.method} ${request.url}`);
        return dispatch(
            request.url,
            /\/+([^/?#]*)/g,
            [],
            this.routes[request.method]
        );
    }
}

function* dispatch(url, re, segments, route) {

    const lastMatchIndex = re.lastIndex;
    const exec = re.exec(url);
    if (exec) {
        const segment = exec[1];
        if (segment.length !== 0) {
            let next;
            if ((next = route[segment])) {
                if (re.lastIndex < url.length) {
                    yield* dispatch(url, re, segments, route[segment]);
                }
                if (next[HANDLERS]) {
                    const pathname = url.substring(re.lastIndex);
                    for (const handler of route[HANDLERS]) {
                        yield endpoint(handler, pathname, segments);
                    }
                }
            }
            if ((next = route[MATCH_ONE])) {
                segments.push(segment);
                if (re.lastIndex < url.length) {
                    yield* dispatch(url, re, segment, route[MATCH_ONE]);
                }
                if (next[HANDLERS]) {
                    const pathname = url.substring(re.lastIndex);
                    for (const handler of route[HANDLERS]) {
                        yield endpoint(handler, pathname, segments);
                    }
                }
                segments.pop();
            }
            if (route[MATCH_MANY]) {
                const pathname = url.substring(lastMatchIndex);
                for (const handler of route[MATCH_MANY]) {
                    yield endpoint(handler, pathname, segments);
                }
            }
        }
    }
    re.lastIndex = lastMatchIndex;

    if (route[HANDLERS]) {
        const pathname = url.substring(re.lastIndex);
        for (const handler of route[HANDLERS]) {
            yield endpoint(handler, pathname, segments);
        }
    }
}

function endpoint(handler, pathname, segments) {
    let variables;
    if (handler.parameters) {
        variables = {};
        for (let s = 0; s < segments.length; s++) {
            variables[handler.parameters[s]] = fastDecodeURIComponent(segments[s]);
        }
    } else {
        variables = EMPTY_OBJECT;
    }
    return {
        handler,
        variables,
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
