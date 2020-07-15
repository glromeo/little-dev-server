const {useResourceCache} = require("./lib/middleware/resource-cache.js");
const {useServeStatic} = require("./lib/middleware/serve-static.js");
const {useETag} = require("./lib/middleware/etag.js");

module.exports = (router, config) => {
    router.get("/**", [
        useResourceCache(config),
        useServeStatic(config),
        useHttp2Push(config),
        useETag(config)
    ]);
};
