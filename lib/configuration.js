const log = require("tiny-node-logger");
const path = require("path");
const {statSync, readFileSync} = require("fs");


const deepmerge = require("deepmerge");

function arrayMerge(dest, source, options) {
    return [...new Set([...dest, ...source])];
}

function merge(targetConfig, sourceConfig = {}) {
    return deepmerge(targetConfig, sourceConfig, {arrayMerge});
}


function configure(options = {}) {

    let filename = options.config;
    if (filename) {
        const configPath = path.resolve(process.cwd(), filename);
        options = merge(options, require(configPath));
        options.rootDir = options.rootDir ?? path.dirname(configPath);
    }

    let {
        baseDir = path.resolve(__dirname, ".."),
        rootDir = options.rootDir ?? process.cwd()
    } = options;

    if (!path.isAbsolute(rootDir)) {
        rootDir = path.resolve(process.cwd(), rootDir);
    }
    2
    if (!statSync(rootDir).isDirectory()) {
        throw new Error(`ENODIR: not a valid root directory '${rootDir}'`);
    }

    if (rootDir !== baseDir) try {
        options = merge(require(path.resolve(rootDir, "server.configuration.js")), options);
    } catch (ignored) {
        log.debug("no server.configuration.js at:", rootDir);
    }

    try {
        const packageJson = require(path.resolve(rootDir, "package.json"));
        if (packageJson['devServer']) {
            options = merge(packageJson['devServer'], options);
        }
    } catch (ignored) {
        log.debug("no package.json at:", rootDir);
    }

    const config = merge({

        baseDir,
        rootDir,

        host: "localhost",
        port: 3000,
        http2: true,
        cache: true,
        push: false,
        preload: false,

        nodeModules: options.nodeModules || path.resolve(rootDir, 'node_modules'),
        webModules: options.webModules || path.resolve(rootDir, 'web_modules'),
        resources: options.resources || path.resolve(baseDir, 'resources'),

        babel: {
            babelrc: true,
            caller: {
                name: 'little-dev-server',
                supportsStaticESM: true,
            },
            sourceType: 'module',
            sourceMaps: 'inline',
            plugins: [
                ["@babel/plugin-syntax-import-meta"]
            ]
        },

        sass: {
            extensions: ['.scss', '.css', '.sass'],
            outputStyle: "compressed",
            sourceMapEnabled: true
        },

        watch: {
            path: [],
            ignored: [
                "web_modules/**/*",
                "node_modules/**/*",
                ".*",
                "**/web_modules/**/*",
                "**/node_modules/**/*",
                "**/.*"
            ]
        }

    }, options);

    if (config.logLevel) {
        log.level = config.logLevel;
    }

    config.readFileSync = filename => {
        try {
            return readFileSync(path.resolve(rootDir, filename));
        } catch (ignored) {
            return readFileSync(path.resolve(baseDir, filename));
        }
    };

    return Object.freeze(config);
}

module.exports = {
    merge,
    configure
};
