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
        options = merge(require(configPath), options);
        if (!options.rootDir) {
            options.rootDir = dirname(configPath);
        }
    }

    options.baseDir = options.baseDir || resolve(__dirname, "..");
    options.rootDir = options.rootDir || process.cwd();

    if (options.rootDir !== options.baseDir) try {
        options = merge(require(resolve(options.rootDir, "server.config.js")), options);
    } catch (ignored) {
        log.debug("no server.config.js at:", options.rootDir);
    }

    if (!isAbsolute(options.rootDir)) {
        options.rootDir = resolve(process.cwd(), options.rootDir);
    }

    let {baseDir, rootDir} = options;

    if (!fs.statSync(rootDir).isDirectory()) {
        throw new Error(`ENODIR: not a valid root directory '${rootDir}'`);
    }

    function readLocalFile(filename) {
        try {
            return fs.readFileSync(resolve(rootDir, filename));
        } catch (ignored) {
            return fs.readFileSync(resolve(baseDir, filename));
        }
    }

    const config = merge({

        baseDir,
        rootDir,

        server: {
            host: "localhost",
            port: 3000,
            options: {
                key: readLocalFile("cert/server.key"),
                cert: readLocalFile("cert/server.crt"),
                allowHTTP1: true
            }
        },

        http2: "push",

        clean: false,
        cache: true,
        deflate: true,

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

        mount: {},

        watch: {
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
        },

        router: {
            ignoreTrailingSlash: true,
            allowUnsafeRegex: true
        },

        middleware: (router, config) => {
        },

        proxy: {
            "/api": {target: "http://localhost:9000"}
        },

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

        web_modules: {
            standalone: [],
            terser: {
                mangle: true,
                output: {
                    comments: false
                }
            }
        }

    }, options);

    if (config.logLevel) {
        log.level = config.logLevel;
    }

    log.details = true;
    log.debug("configured:", config);

    return Object.freeze(config);
}

module.exports = {
    merge,
    configure
};
