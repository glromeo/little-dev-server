const deepmerge = require("deepmerge");
const path = require("path");
const {statSync, existsSync} = require("fs");

const log = require("tiny-node-logger");

function arrayMerge(dest, source, options) {
    return [...new Set([...dest, ...source])];
}

function merge(targetConfig, sourceConfig = {}) {
    return deepmerge(targetConfig, sourceConfig, {arrayMerge});
}

function load(options) {

    const base = require("../server.config.js");

    options = options.config || options;

    if (typeof options === "string") {
        const dirname = path.dirname(options);
        options = merge(options, require(options));
        options.rootDir = options.rootDir || dirname;
    } else {
        options.rootDir = options.rootDir || base.rootDir;
    }

    if (!statSync(options.rootDir).isDirectory()) {
        throw new Error(`ENODIR: not a valid root directory '${options.rootDir}'`);
    }

    if (options.rootDir !== base.baseDir) {
        const rootConfig = path.resolve(options.rootDir, "server.config.js");
        if (existsSync(rootConfig)) {
            return merge(merge(base, require(rootConfig)), options);
        }
    }

    return merge(base, options);
}

function configure(options = {}) {

    const config = load(options);

    if (config.logLevel) {
        log.level = config.logLevel;
    }

    config.customResolveOptions = merge({
        basedir: config.rootDir,
        moduleDirectory: config.nodeModules
    }, config.customResolveOptions);

    return config;
}

module.exports = {
    merge,
    configure
}
