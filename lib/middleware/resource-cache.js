const log = require("tiny-node-logger");

const {memoize} = require("../utility/memoize.js");

module.exports.useResourceCache = memoize(function (config, watcher) {

    const cache = new Map();
    const watched = new Map();

    function watch(filename, url) {
        watched.set(filename, url);
        watcher.add(filename);
    }

    watcher.on("all", function (event, path) {
        log.info(event, path);
        if (event === "change" || event === "unlink") {
            const key = resolve(config.rootDir, path);
            const url = watched.get(key);
            if (url) {
                cache.delete(url);
                watched.delete(key);
            }
        }
    });

    return config.cache ? async function middleware(ctx, next) {

        const url = ctx.req.url;

        if (cache.has(url)) {
            log.debug("retrieved from cache:", url);
            return cache.get(url);
        } else {
            const out = await next(ctx);

            cache.set(url, {
                ...out,
                content: await out.content,
                headers: ctx.res.getHeaders()
            });
        }

    } : (ctx, next) => next(ctx);
});