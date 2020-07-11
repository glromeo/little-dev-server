const log = require("tiny-node-logger");
const path = require("path");
const {contentText} = require("../utility/content-utils.js");

const {memoize} = require("../utility/memoize.js");

module.exports.useResourceCache = function (config, watcher) {

    const cache = new Map();
    const watched = new Map();

    function watch(filename, url) {
        watched.set(filename, url);
        watcher.add(filename);
    }

    watcher.on("all", function (event, path) {
        log.info(event, path);
        if (event === "change" || event === "unlink") {
            const key = path.resolve(config.rootDir, path);
            const url = watched.get(key);
            if (url) {
                cache.delete(url);
                watched.delete(key);
            }
        }
    });

    async function store(out) {
        out.content = await contentText(out.content);
        cache.set(url, out);
        return out;
    }

    return config.cache ? async function resourceCache(context, next) {

        const url = context.request.url;

        if (cache.has(url)) {
            log.debug("retrieved from cache:", url);
            return next(await cache.get(url));
        } else {
            return cache.set(url, next(context, store)).get(url);
        }

    } : (ctx, next) => next(ctx);
};
