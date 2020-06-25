const log = require("tiny-node-logger");
const path = require("path");
const deepmerge = require("deepmerge");
const {statSync, readFileSync} = require("fs");

const config = {};

const LISTENERS = Symbol();
const NOTIFY = Symbol();

Object.defineProperty(config, LISTENERS, {
    value: new Set()
});

Object.defineProperty(config, "ready", {
    set(callback) {
        if (config.configured) {
            callback(config);
        } else {
            config[LISTENERS].add(function firstUpdateListener(config) {
                config[LISTENERS].delete(firstUpdateListener);
                callback(config);
            });
        }
    }
});

Object.defineProperty(config, "updated", {
    set(callback) {
        if (config.configured) {
            callback(config);
        }
        config[LISTENERS].add(callback);
    }
});

function arrayMerge(dest, source, options) {
    return [...new Set([...dest, ...source])];
}

function merge(targetConfig, sourceConfig = {}) {
    return deepmerge(targetConfig, sourceConfig, {arrayMerge});
}

function tryAndReadFileSync(filename) {
    try {
        return readFileSync(path.resolve(config.rootDir, filename));
    } catch (ignored) {
        return readFileSync(path.resolve(config.baseDir, filename));
    }
}

const yargs = require('yargs')
    .scriptName("little-dev-server")
    .usage('$0 <cmd> [args]')
    .option('config', {
        description: 'Specify server config file (this will override base config as appropriate)',
        type: 'string',
    })
    .option('root', {
        alias: ['r'],
        description: 'root directory (defaults to process current working directory)',
        type: 'string',
    })
    .help()
    .alias('help', 'h')

let argv = yargs.argv;

function parseCLI(line) {
    return argv = line ? yargs.parse(line.split(" ")) : yargs.parse([]);
}

function configure(options = {}) {

    let filename = options.config || argv.config;
    if (filename) {
        const configPath = path.resolve(process.cwd(), filename);
        options = merge(options, require(configPath));
        options.rootDir = options.rootDir ?? path.dirname(configPath);
    }

    let {
        baseDir = path.resolve(__dirname, ".."),
        rootDir = argv.root ?? process.cwd()
    } = options;

    if (!path.isAbsolute(rootDir)) {
        rootDir = path.resolve(process.cwd(), rootDir);
    }
    if (!statSync(rootDir).isDirectory()) {
        throw new Error(`ENODIR: not a valid root directory '${rootDir}'`);
    }

    try {
        const packageJson = require(path.resolve(rootDir, "package.json"));
        if (packageJson['devServer']) {
            options = merge(options, packageJson['devServer']);
        }
    } catch (ignored) {
        log.debug("no package.json at:", rootDir);
    }

    for (const p of Object.getOwnPropertyNames(config)) {
        delete config[p];
    }

    Object.assign(config, merge({

        baseDir,
        rootDir,

        nodeModules: options.nodeModules ?? path.resolve(rootDir, 'node_modules'),
        webModules: options.webModules ?? path.resolve(rootDir, 'web_modules'),
        resources: options.resources ?? path.resolve(baseDir, 'resources'),

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
            ignored: [
                "**/web_modules/**/*",
                "**/node_modules/**/*",
                ".*",
                "**/.*"
            ]
        },

        host: "localhost",
        port: 3000,
        http2: true,
        cache: true,
        push: false,
        preload: false,

    }, options));

    if (config.logLevel) {
        log.level = config.logLevel;
    }

    if (config.http2) {
        config.secureServerOptions = {
            key: config.server?.key ?? tryAndReadFileSync("cert/server.key"),
            cert: config.server?.cert ?? tryAndReadFileSync("cert/server.crt"),
            allowHTTP1: config.server?.allowHTTP1 ?? true,
        }
    }

    config.customResolveOptions = merge({
        basedir: config.rootDir
    }, config.customResolveOptions);

    for (const listener of config[LISTENERS]) {
        listener(config);
    }

    config.configured = Date.now();

    return config;
}

module.exports = {
    merge,
    config,
    parseCLI,
    configure,
    reset() {
        Object.getOwnPropertyNames(config).forEach(name => delete config[name]);
        config[LISTENERS].clear();
    }
};
