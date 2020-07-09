const {memoize} = require("../utility/memoize.js");
const {vary} = require("../utility/vary.js");

module.exports.useAccessControl = memoize(config => {

    const {
        origin,
        credentials,
        methods = "GET, HEAD",
        expose,
        headers
    } = config.cors;

    return function middleware(ctx, next) {

        vary(ctx.response, "Origin");

        const requestOrigin = ctx.request.headers["Origin"];

        if (!requestOrigin || ctx.request.method === "OPTIONS" && !ctx.request.headers["Access-Control-Request-Method"]) {
            return next(ctx);
        }

        ctx.response.setHeader("Access-Control-Allow-Origin", origin || requestOrigin);
        ctx.response.setHeader("Access-Control-Allow-Methods", methods);
        if (credentials) {
            ctx.response.setHeader("Access-Control-Allow-Credentials", "true");
        }

        if (ctx.request.method === "OPTIONS") {
            let allowHeaders = headers;
            if (!allowHeaders) {
                allowHeaders = ctx.request.headers["Access-Control-Request-Headers"];
            }
            if (allowHeaders) {
                ctx.response.setHeader("Access-Control-Allow-Headers", allowHeaders);
            }
            ctx.response.statusCode = 204;
            ctx.response.end();
        } else {
            if (expose) {
                ctx.response.setHeader("Access-Control-Expose-Headers", expose);
            }
            return next(ctx);
        }
    };
});
