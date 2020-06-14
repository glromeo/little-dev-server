const path = require("path");
const {readFileSync} = require("fs");

const baseDir = __dirname;
const rootDir = process.cwd();

module.exports = {

    baseDir,
    rootDir,

    nodeModules: path.resolve(rootDir, 'node_modules'),
    webModules: path.resolve(rootDir, 'web_modules'),
    resources: path.resolve(baseDir, 'resources'),

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

    require(filename) {
        try {
            return require(path.resolve(this.rootDir, filename))
        } catch (e) {
            try {
                return require(path.resolve(this.baseDir, filename))
            } catch (e) {
                return {};
            }
        }
    },

    readFileSync(filename, options) {
        try {
            return readFileSync(path.resolve(this.rootDir, filename), options)
        } catch (e) {
            try {
                return readFileSync(path.resolve(this.baseDir, filename), options)
            } catch (e) {
                return undefined;
            }
        }
    }
}
