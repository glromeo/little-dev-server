const {memoize} = require("../utility/memoize.js");

module.exports.useAccessControl = config => {

    const {
        origin,
        credentials,
        methods = "GET, HEAD",
        expose,
        headers
    } = config.cors;

    return function middleware(ctx, next) {

        ctx.vary("origin");

        const clientOrigin = ctx.header("origin");

        if (!clientOrigin || ctx.method === "OPTIONS" && !ctx.header("access-control-request-method")) {
            return next(ctx);
        }

        ctx.header("access-control-allow-origin", origin || clientOrigin);
        ctx.header("access-control-allow-methods", methods);
        if (credentials) {
            ctx.header("access-control-allow-credentials", "true");
        }

        if (ctx.method === "OPTIONS") {
            let allowHeaders = headers;
            if (!allowHeaders) {
                allowHeaders = ctx.header("access-control-request-headers");
            }
            if (allowHeaders) {
                ctx.header("access-control-allow-headers", allowHeaders);
            }
            ctx.send();
        } else {
            if (expose) {
                ctx.header("access-control-expose-headers", expose);
            }
            return next(ctx);
        }
    };
}
