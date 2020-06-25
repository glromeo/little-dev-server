const {
    baseDir,
    fixtureDir,
    webModulesDir,
    testConfig
} = require("../test/test-configuration.js");

const {
    parseCLI,
    config,
    configure,
    reset
} = require("./configuration.js");

const path = require("path");
const fs = require("fs");

describe("configuration", function () {

    describe("clean slate", function () {

        beforeEach(reset);

        it("config is empty until configure has been invoked", function () {
            expect(Object.keys(config).length).toBe(0);
            configure();
            expect(Object.keys(config).length).toBeGreaterThan(2);
        });

        it("can load config from a file", function () {

            parseCLI(`--config="${fixtureDir.path}/server.config.js"`);
            configure();
            expect(config.webModules).toMatch(webModulesDir.path);
            parseCLI();

            configure();
            expect(config.webModules).toMatch(baseDir.join("web_modules"));

            const filename = fixtureDir.join("config-" + Date.now() + ".js");
            fs.writeFileSync(filename, `module.exports = ${JSON.stringify({
                logLevel: "debug"
            }, undefined, " ")}`)
            expect(configure({config: filename})).toMatchObject({logLevel: "debug"});
            fs.unlinkSync(filename);
        });

        it("configure to use fixture as root dir", function () {

            configure({
                rootDir: fixtureDir.path,
                mount: {
                    "/public": [fixtureDir.join("public")]
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

            expect(config.baseDir).toStrictEqual(baseDir.path);
            expect(config.rootDir).toStrictEqual(fixtureDir.path);
            expect(config.nodeModules).toStrictEqual(fixtureDir.join("node_modules"));
            expect(config.webModules).toStrictEqual(webModulesDir.path);
        });

        it("config.rootDir must be a directory", async function () {
            expect(() => configure({rootDir: __filename})).toThrowError("ENODIR: not a valid root directory");
            expect(() => configure({rootDir: `${__dirname}/non_dir/`})).toThrowError("ENOENT: no such file or directory");
        });

        it("can load key & cert from local or root, as well specifying them inline", async function () {
            configure({http2:false})
            expect(config.secureServerOptions).toBeUndefined();
            configure({rootDir: "./test", http2: true, server:{allowHTTP1:true, cert: "no cert"}});
            expect(config.secureServerOptions.key).not.toBeUndefined();
            expect(config.secureServerOptions.cert).toStrictEqual("no cert");
        });

        it("config.ready is called only once", function () {
            const ready = config.ready = jest.fn();
            configure();
            expect(ready).toHaveBeenCalledWith(config);
            configure();
            expect(ready).toHaveBeenCalledTimes(1);
        });

        it("config.update is called at every configure()", function () {

            expect(config.configured).toBe(undefined);
            const updatedRegisteredBeforeConfigure = config.updated = jest.fn();
            expect(updatedRegisteredBeforeConfigure).toHaveBeenCalledTimes(0);
            configure({alpha: 1});
            expect(updatedRegisteredBeforeConfigure).toHaveBeenCalledWith(expect.objectContaining({alpha: 1}));
            configure({beta: 2});
            expect(updatedRegisteredBeforeConfigure).toHaveBeenCalledWith(expect.objectContaining({beta: 2}));
            expect(updatedRegisteredBeforeConfigure).toHaveBeenCalledTimes(2);

            const updatedRegisteredAfterConfigure = config.updated = jest.fn();
            expect(updatedRegisteredAfterConfigure).toHaveBeenCalledTimes(1);
        });

    });

    describe("configured", function () {

        beforeEach(configure);

        it("check default base & root dir", function () {
            expect(config.baseDir).toStrictEqual(baseDir.path);
            expect(config.rootDir).toStrictEqual(process.cwd());
            expect(config.nodeModules).toStrictEqual(path.resolve(config.rootDir, "node_modules"));
            expect(config.webModules).toStrictEqual(path.resolve(config.rootDir, "web_modules"));
        });

        it("can specify root dir from cli", function () {
            expect(config.rootDir).toStrictEqual(process.cwd());
            parseCLI("--root=./test/fixture");
            configure();
            expect(config.rootDir).toStrictEqual(fixtureDir.path);
            parseCLI();
        });

        it("accepts configuration from package.json under devServer", function () {
            expect(config.testOption).toBeUndefined();
            configure({rootDir: fixtureDir.path});
            expect(config.version).toBeUndefined();
            expect(config.testOption).toStrictEqual("testValue");
        });

        it("config.ready is called only once", function () {
            const ready = config.ready = jest.fn();
            expect(ready).toHaveBeenCalledWith(config);
            configure();
            expect(ready).toHaveBeenCalledTimes(1);
        });

    });

});
