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

        const {req, res} = ctx;

        vary(res, "Origin");

        const requestOrigin = req.headers["Origin"];

        if (!requestOrigin || req.method === "OPTIONS" && !req.headers["Access-Control-Request-Method"]) {
            return next(ctx);
        }

        res.setHeader("Access-Control-Allow-Origin", origin || requestOrigin);
        res.setHeader("Access-Control-Allow-Methods", methods);
        if (credentials) {
            res.setHeader("Access-Control-Allow-Credentials", "true");
        }

        if (req.method === "OPTIONS") {
            let allowHeaders = headers;
            if (!allowHeaders) {
                allowHeaders = req.headers["Access-Control-Request-Headers"];
            }
            if (allowHeaders) {
                res.setHeader("Access-Control-Allow-Headers", allowHeaders);
            }
            res.statusCode = 204;
            res.end();
        } else {
            if (expose) {
                res.setHeader("Access-Control-Expose-Headers", expose);
            }
            return next(ctx);
        }
    }
})
