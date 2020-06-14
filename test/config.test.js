const {configure} = require("../lib/config.js");
const path = require("path");
const fs = require("fs");

const fixtureDir = path.resolve(__dirname, "fixture");

describe("configuration", function () {

    it("without parameters configure returns the default configuration", function () {

        const actual = configure();

        const baseDir = path.resolve(__dirname, "..");
        const rootDir = process.cwd();

        expect(actual).toMatchObject({
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
            customResolveOptions: {
                basedir: rootDir
            },
            host: "localhost",
            port: 3000,
            http2: true,
            cache: true,
            push: false,
            preload: false
        });
    })

    it("config.rootDir must be a directory", async function () {

        expect(() => configure({rootDir: __filename})).toThrowError("ENODIR: not a valid root directory");

        expect(() => configure({rootDir: `${__dirname}/non_dir/`})).toThrowError("ENOENT: no such file or directory");
    });

    it("server.config.js in rootDir overrides default config", async function () {

        expect(configure({rootDir: fixtureDir})).toMatchObject({
            rootDir: fixtureDir,
            nodeModules: [path.resolve(fixtureDir, 'node_modules'), path.resolve(fixtureDir, '../../demo/node_modules')],
            webModules: path.resolve(fixtureDir, "web_modules"),
            mount: {
                "/public": [path.resolve(fixtureDir, "public")]
            },
            babel: {
                plugins: expect.arrayContaining([
                    ["@babel/plugin-proposal-decorators", {decoratorsBeforeExport: true}],
                    ["@babel/plugin-proposal-class-properties"],
                    ["@babel/plugin-transform-runtime", {
                        "corejs": false,
                        "helpers": true,
                        "regenerator": false,
                        "useESModules": true,
                        "absoluteRuntime": true,
                        "version": "7.5.5"
                    }],
                ])
            },
            push: true,
            cache: true,
            clean: true
        });
    });

    it("local config as function", async function () {
        const filename = path.resolve(fixtureDir, "config-" + Date.now() + ".js");
        fs.writeFileSync(filename, `module.exports = ${JSON.stringify({
            logLevel: "debug"
        }, undefined, " ")}`)
        expect(configure({config: filename})).toMatchObject({logLevel: "debug"});
        fs.unlinkSync(filename);
    });
});
