const log = require("tiny-node-logger/index.js");

const {quickParseSimpleURL} = require("./utility/quick-parse-url.js");
const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");
const etag = require("etag");

const METHODS = {
    GET: Symbol("get"),
    PUT: Symbol("put"),
    DELETE: Symbol("delete"),
    POST: Symbol("post"),
    OPTIONS: Symbol("options")
};

module.exports.METHODS = METHODS;

const MATCH_ONE = Symbol(":*");
const MATCH_MANY = Symbol("**");

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
            ctx[method] = ctx[method] === undefined ? handler : [...ctx[method]];
        },

        route({request}) {
            const route = dispatch({
                request,
                matchSegment: /\/+([^/?#]*)/g,
                variables: []
            }, this.routes);
            if (!route) {
                throw new Error(`no route found for: ${request.method} ${request.url}`);
            }
            return route;
        }
    };

    function dispatch(context, routes) {

        const {request: {method, url}, matchSegment} = context;

        const lastMatchIndex = matchSegment.lastIndex;
        const exec = matchSegment.exec(url);
        if (exec) {
            const segment = exec[1];
            let route;
            if ((route = routes[segment])) {
                let next = dispatch(context, route);
                if (next) {
                    return next;
                }
                route = route[METHODS[method]];
                if (route) {
                    return service(context, route);
                }
            }
            if ((route = routes[MATCH_ONE])) {
                context.variables.push(segment);
                let next = dispatch(context, route);
                if (next) {
                    return next;
                }
                route = route[METHODS[method]];
                if (route) {
                    return service(context, route);
                }
            }
            if ((route = routes[MATCH_MANY])) {
                route = route[METHODS[method]];
                if (route) {
                    matchSegment.lastIndex = lastMatchIndex;
                    return service(context, route);
                }
            }
        }
        matchSegment.lastIndex = lastMatchIndex;
    }

    function service({request, matchSegment, variables}, handler) {

        return {
            get variables() {
                if (variables.length) {
                    this[PARAMS] = {};
                    for (let s = 0; s < variables.length; s++) {
                        this[PARAMS][this.handler[s]] = decodeURIComponent(variables[s]);
                    }
                }
            }
        }
        Object.assign(context, quickParseSimpleURL(request.url, matchSegment.lastIndex));
    }

    for (const symbol of Object.values(module.exports.METHODS)) {
        router[symbol.description] = router.use.bind(router, symbol);
    }

    if (typeof config.routing === "function") {
        config.routing(router, config);
    }

    return router;
};
