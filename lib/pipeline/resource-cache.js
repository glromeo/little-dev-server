const log = require("tiny-node-logger");

const {relative} = require("path");
const util = require("util");
const zlib = require("zlib");
const {JSON_CONTENT_TYPE} = require("../util/mime-types.js");
const {memoize} = require("../util/memoize.js");

module.exports.useResourceCache = memoize(function (config, watcher) {

    const deflate = util.promisify(zlib.deflate);
    const watched = new Map();

    function watch(filename, url) {
        const urls = watched.get(filename);
        if (urls) {
            if (typeof urls === "string") {
                watched.set(filename, [urls, url]);
            } else {
                urls.push(url);
            }
        } else {
            watched.set(filename, url);
        }
        watcher.add(filename);
    }

    const cache = new class extends Map {

        async set(url, resource) {
            if (false && config.deflate) {
                deflate(resource.content).then(deflated => {
                    super.set(url, {
                        ...resource,
                        content: deflated,
                        headers: {
                            ...resource.headers,
                            "content-length": Buffer.byteLength(deflated),
                            "content-encoding": "deflate"
                        }
                    });
                });
            }
            const key = relative(config.rootDir, resource.filename);
            watch(key, url);
            super.set(url, resource);
        }

        storeSourceMap(url, map) {
            const content = JSON.stringify(map);
            super.set(url + ".map", {
                content: content,
                headers: {
                    "content-type": JSON_CONTENT_TYPE,
                    "content-length": Buffer.byteLength(content),
                    "last-modified": new Date().toUTCString(),
                    "cache-control": "no-cache"
                }
            });
        }
    };

    watcher.on("all", function (event, path) {
        log.info(event, path);
        if (event === "change" || event === "unlink") {
            const key = path;
            const urls = watched.get(key);
            if (urls) {
                if (typeof urls === "string") {
                    cache.delete(urls);
                } else for (const url of urls) {
                    cache.delete(url);
                }
            }
            if (event === "unlink") {
                watched.delete(key);
                watcher.unwatch(key);
            }
        }
    });

    return cache;

});
