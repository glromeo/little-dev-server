const {memoize} = require("../utility/memoize.js");

module.exports.useAccessControl = memoize(config => {

    const {
        origin,
        credentials,
        methods = "GET, HEAD",
        expose,
        headers
    } = config.cors;

    return function middleware(context, next) {

        const {request, response} = context;

        context.vary("origin");

        const requestOrigin = request.headers["origin"];

        if (!requestOrigin || request.method === "OPTIONS" && !request.headers["access-control-request-method"]) {
            return next(context);
        }

        response.setHeader("access-control-allow-origin", origin || requestOrigin);
        response.setHeader("access-control-allow-methods", methods);
        if (credentials) {
            response.setHeader("access-control-allow-credentials", "true");
        }

        if (request.method === "OPTIONS") {
            let allowHeaders = headers;
            if (!allowHeaders) {
                allowHeaders = request.headers["access-control-request-headers"];
            }
            if (allowHeaders) {
                response.setHeader("access-control-allow-headers", allowHeaders);
            }
            response.statusCode = 204;
            response.end();
        } else {
            if (expose) {
                response.setHeader("access-control-expose-headers", expose);
            }
            return next(context);
        }
    };
});
