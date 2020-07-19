const log = require("tiny-node-logger");

const util = require("util");
const zlib = require("zlib");
const {memoize} = require("../util/memoize.js");

module.exports.useResourceCache = memoize(function (config, watcher) {

    const deflate = util.promisify(zlib.deflate);
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

    return new class extends Map {
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
            watch(resource.filename, url);
            super.set(url, resource);
        }
    }

})
