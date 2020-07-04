const log = require("tiny-node-logger");

const chokidar = require("chokidar");

module.exports.createWatcher = function (config) {

    const {
        paths,
        options
    } = config.watch;

    return chokidar.watch(paths, options);
};