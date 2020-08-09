const log = require("tiny-node-logger");
const {resolve, dirname} = require("path");
const fs = require("fs");
const {memoize} = require("./util/memoize.js");

module.exports.usePlugins = memoize(function (config, watcher) {

    const plugins = new Map();

    watcher.on("all", async function (event, path) {
        if (path.endsWith("server.plugins.js")) {
            log.info(event, path);
            const module = resolve(config.rootDir, path);
            const context = {
                dirname: dirname(module),
                filename: module
            };
            delete require.cache[require.resolve(module)];
            require(module).call(context, config, watcher, function on(name, fn) {
                plugins.set(name, fn);
            });
        }
    });

    for (const basedir of Object.values(config.mount)) {
        const filename = resolve(config.rootDir, basedir, "server.plugins.js");
        if (fs.existsSync(filename)) {
            watcher.add(filename);
        }
    }

    return {
        plugins
    };

});
