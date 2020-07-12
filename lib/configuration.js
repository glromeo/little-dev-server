const log = require("tiny-node-logger");
const {dirname, resolve, isAbsolute} = require("path");
const fs = require("fs");

function merge(dst, src) {
    if (src !== undefined && src !== null) {
        if (dst.constructor === Object && src.constructor === Object) {
            const merged = {...dst};
            for (const k of Object.keys(src)) {
                merged[k] = k in dst ? merge(dst[k], src[k]) : src[k];
            }
            return merged;
        }
        if (dst.constructor === Array && src.constructor === Array) {
            const merged = new Set(dst);
            for (const item of src) {
                merged.add(item);
            }
            return [...merged];
        }
    }
    return src;
}

function configure(options = {}) {

    let filename = options.config;
    if (filename) {
        const configPath = resolve(process.cwd(), filename);
        options = merge(options, require(configPath));
        options.rootDir = options.rootDir || dirname(configPath);
    }

    let {
        baseDir = resolve(__dirname, ".."),
        rootDir = options.rootDir || process.cwd()
    } = options;

    if (!isAbsolute(rootDir)) {
        rootDir = options.rootDir = resolve(process.cwd(), rootDir);
    }

    if (!fs.statSync(rootDir).isDirectory()) {
        throw new Error(`ENODIR: not a valid root directory '${rootDir}'`);
    }

    if (rootDir !== baseDir) try {
        options = merge(require(resolve(rootDir, "server.config.js")), options);
    } catch (ignored) {
        log.debug("no server.configuration.js at:", rootDir);
    }

    try {
        const packageJson = require(resolve(rootDir, "package.json"));
        if (packageJson["devServer"]) {
            options = merge(packageJson["devServer"], options);
        }
    } catch (ignored) {
        log.debug("no package.json at:", rootDir);
    }

    function readFileLocal(filename) {
        try {
            return fs.readFileSync(resolve(rootDir, filename));
        } catch (ignored) {
            return fs.readFileSync(resolve(baseDir, filename));
        }
    }

    function requireLocal(filename) {
        try {
            return require(resolve(rootDir, filename));
        } catch (ignored) {
            return require(resolve(baseDir, filename));
        }
    }

    const config = merge({

        baseDir,
        rootDir,

        readFile: readFileLocal,
        require: requireLocal,

        server: {
            host: "localhost",
            port: 3000,
            options: {
                key: readFileLocal("cert/server.key"),
                cert: readFileLocal("cert/server.crt"),
                allowHTTP1: true
            }
        },

        http2: "push",

        clean: false,
        cache: true,

        cors: {
            origin: "*",
            methods: "GET, HEAD, PUT, POST, DELETE, PATCH",
            headers: "X-Requested-With, Accept, Content-Type",
            credentials: true
        },

        etag: {
            weak: false
        },

        nodeModules: options.nodeModules || resolve(rootDir, "node_modules"),
        webModules: options.webModules || resolve(rootDir, "web_modules"),
        resources: options.resources || resolve(baseDir, "resources"),

        babel: {
            babelrc: true,
            caller: {
                name: "little-dev-server",
                supportsStaticESM: true
            },
            sourceType: "module",
            sourceMaps: "inline",
            plugins: [
                ["@babel/plugin-syntax-import-meta"]
            ]
        },

        sass: {
            extensions: [".scss", ".css", ".sass"],
            outputStyle: "compressed",
            sourceMapEnabled: true
        },

        watch: {
            path: [],
            options: {
                ignored: [
                    "web_modules/**/*",
                    "node_modules/**/*",
                    ".*",
                    "**/web_modules/**/*",
                    "**/node_modules/**/*",
                    "**/.*"
                ],
                cwd: rootDir,
                atomic: false
            }
        },

        request: {
            timeout: 120000
        },

        routing: requireLocal("routing.config.js")

    }, options);

    if (config.logLevel) {
        log.level = config.logLevel;
    }

    log.debug("configured:", config);

    return Object.freeze(config);
}

module.exports = {
    merge,
    configure
};
