const log = require("tiny-node-logger");
const path = require("path");
const deepmerge = require("deepmerge");
const {existsSync, readFileSync} = require("fs");

const config = {};

function arrayMerge(dest, source, options) {
    return [...new Set([...dest, ...source])];
}

function merge(targetConfig, sourceConfig = {}) {
    return deepmerge(targetConfig, sourceConfig, {arrayMerge});
}

const yargs = require('yargs')
    .scriptName("little-dev-server")
    .usage('$0 <cmd> [args]')
    .option('config', {
        description: 'Specify server config file (this will override base config as appropriate)',
        type: 'string',
    })
    .option('root', {
        alias: 'r',
        description: 'Specify root directory (defaults to process cwd)',
        type: 'string',
    })
    .option('http2', {
        alias: 'h2',
        description: 'enable http2',
        type: 'boolean',
    })
    .option('cache', {
        alias: 'c',
        description: 'enable cache',
        type: 'boolean',
    })
    .option('push', {
        alias: 'p',
        description: 'enable http2 push (requires --http2)',
        type: 'boolean',
    })
    .help()
    .alias('help', 'h')

let argv = yargs.argv;

function parseCLI(line) {
    return argv = line ? yargs.parse(line.split(" ")) : yargs.argv;
}

const processAgv = new Map([
    ["root", function (value = "") {
        return ["rootDir", value.chatAt(0) === "." ? path.resolve(process.cwd(), value) : value];
    }]
]);

function renameArgvOptions(argv) {
    const options = {};
    for (const key of Object.keys(argv)) if (processAgv[key]) {
        const [alias, value] = processAgv[key](argv[key]);
        options[alias] = value;
    } else {
        options[key] = argv[key];
    }
    return options;
}

function configure(options = renameArgvOptions(argv)) {

    if (options.config) {
        const dirname = path.dirname(options.config);
        options = merge(options, require(options.config));
        options.rootDir = options.rootDir || dirname;
    }

    const {
        baseDir = path.resolve(__dirname, ".."),
        rootDir = process.cwd()
    } = options;

    const packageJsonFilename = path.resolve(rootDir, "package.json");
    if (existsSync(packageJsonFilename)) {
        const packageJson = require(packageJsonFilename);
        if (packageJson['devServer']) {
            options = merge(packageJson['devServer'], options);
        }
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
                [require("@babel/plugin-syntax-import-meta")]
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

    config.customResolveOptions = merge({
        basedir: config.rootDir,
        moduleDirectory: config.nodeModules
    }, config.customResolveOptions);

    return config;
}

module.exports = {
    merge,
    config,
    parseCLI,
    configure
};
