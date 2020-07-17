const log = require("tiny-node-logger");

const chokidar = require("chokidar");

module.exports.createWatcher = function (config) {

    const {
        paths,
        options
    } = config.watch;

    log.debug("created chokidar watcher for paths:", paths);

    return chokidar.watch(paths, options);
};