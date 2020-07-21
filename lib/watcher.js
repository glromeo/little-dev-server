const log = require("tiny-node-logger");

const chokidar = require("chokidar");

module.exports.createWatcher = function (config) {

    const options = config.watch;

    log.debug("created chokidar watcher for cwd:", options.cwd);

    const watcher = chokidar.watch([], options);

    watcher.on("all", (event, file) => log.debug("watcher", event, file));
    watcher.on("ready", () => log.info("watcher is ready"));

    return watcher;
};