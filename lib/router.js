const log = require("tiny-node-logger/index.js");
const {EMPTY_OBJECT} = require("./utility/content-utils.js");
const {memoize} = require("./utility/memoize.js");
const fastDecodeURIComponent = require("fast-decode-uri-component");

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
        let ctx = this.routes[method] || (this.routes[method] = {});
        let exec, segment;
        while (exec = matchSegment.exec(path)) {
            segment = exec[1];
            if (segment.length === 0) {
                break;
            } else if (segment.startsWith(":")) {
                ctx = ctx.__var__ || (ctx.__var__ = {});
                if (handler.vars === undefined) {
                    handler.vars = [];
                }
                handler.vars.push(segment.substring(1));
            } else if (segment === "**") {
                if (ctx.__wildcard__ === undefined) {
                    ctx.__wildcard__ = [handler];
                } else {
                    ctx.__wildcard__.push(handler);
                }
                return this;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
        }
        if (ctx.__handlers__ === undefined) {
            ctx.__handlers__ = [handler];
        } else {
            ctx.__handlers__.push(handler);
        }
        return this;
    }

    around(path, filter) {
        log.debug("creating filter: ", path, filter.before, filter.after);
        const matchSegment = /\/+([^/?#]*)/g;
        let ctx = this.filters || (this.filters = {});
        let exec, segment;
        while (exec = matchSegment.exec(path)) {
            segment = exec[1];
            if (segment.length === 0) {
                break;
            } else if (segment.startsWith(":")) {
                ctx = ctx.__var__ || (ctx.__var__ = {});
                if (filter.vars === undefined) {
                    filter.vars = [];
                }
                filter.vars.push(segment.substring(1));
            } else if (segment === "**") {
                if (ctx.__wildcard__ === undefined) {
                    ctx.__wildcard__ = [filter];
                } else {
                    ctx.__wildcard__.push(filter);
                }
                return this;
            } else {
                ctx = ctx[segment] || (ctx[segment] = {});
            }
        }
        if (ctx.__filters__ === undefined) {
            ctx.__filters__ = [{
                before: filter.before.bind(filter),
                after: filter.after.bind(filter),
            }];
        } else {
            ctx.__filters__.push({
                before: filter.before.bind(filter),
                after: filter.after.bind(filter),
            });
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

    filter(path, filter) {
        return this.on("FILTER", path, filter);
    }

    route({method, url}) {
        log.debug(`routing: ${method} ${url}`);
        return dispatch(
            url,
            /\/+([^/?#]*)/g,
            [],
            this.routes[method],
            this.filters
        );
    }
}

function* dispatch(url, re, segments, route, filters) {

    const pathname = url.substring(re.lastIndex);

    if (filters.__filters__) {
        for (const filter of route.__filters__) if (filter.before) {
            yield endpoint(filter.before, pathname, segments);
        }
    }

    const lastMatchIndex = re.lastIndex;
    const exec = re.exec(url);
    if (exec) {
        const segment = exec[1];
        if (segment.length !== 0) {
            let next;
            if ((next = route[segment])) {
                if (re.lastIndex < url.length) {
                    const lastMatchIndex = re.lastIndex;
                    yield* dispatch(url, re, segments, route[segment]);
                    re.lastIndex = lastMatchIndex;
                }
                if (next.__handlers__) {
                    const pathname = url.substring(re.lastIndex);
                    for (const handler of next.__handlers__) {
                        yield endpoint(handler, pathname || "/", segments);
                    }
                }
            }
            if ((next = route.__var__)) {
                segments.push(segment);
                if (re.lastIndex < url.length) {
                    yield* dispatch(url, re, segments, route.__var__);
                }
                if (next.__handlers__) {
                    const pathname = url.substring(re.lastIndex);
                    for (const handler of next.__handlers__) {
                        yield endpoint(handler, pathname || "/", segments);
                    }
                }
                segments.pop();
            }
            if (route.__wildcard__) {
                const pathname = url.substring(lastMatchIndex);
                for (const handler of route.__wildcard__) {
                    yield endpoint(handler, pathname, segments);
                }
            }
        }
    }
    re.lastIndex = lastMatchIndex;

    if (route.__handlers__) {
        for (const handler of route.__handlers__) {
            yield endpoint(handler, pathname, segments);
        }
    }

    if (filters.__filters__) {
        for (const filter of route.__filters__) if (filter.after) {
            yield endpoint(filter.after, pathname, segments);
        }
    }
}

function endpoint(handler, pathname, segments) {
    let vars;
    if (handler.vars) {
        vars = {};
        for (let s = 0; s < segments.length; s++) {
            vars[handler.vars[s]] = fastDecodeURIComponent(segments[s]);
        }
    } else {
        vars = EMPTY_OBJECT;
    }
    return {
        handler,
        vars,
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
