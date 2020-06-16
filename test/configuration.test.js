const {parseCLI, config, configure} = require("../lib/configuration.js");
const path = require("path");

const basedir = path.resolve(__dirname, "..");
const fixturedir = path.resolve(__dirname, "fixture");

describe("configuration (bare)", function () {

    it("config is empty until configure has been invoked", function () {
        expect(Object.keys(config).length).toBe(0);
        configure();
        expect(Object.keys(config).length).toBeGreaterThan(2);
    });

    it("can load config from a file", function () {

        parseCLI(`--config="${fixturedir}/server.config.js"`);
        configure();
        expect(config.webModules).toMatch(path.resolve(fixturedir, "web_modules"));

        parseCLI();
        configure();
        expect(config.webModules).toMatch(path.resolve(basedir, "web_modules"));
    });
});

describe("configuration (configured)", function () {

    beforeEach(function () {
        parseCLI();
        configure();
    })

    it("check default base & root dir", function () {
        expect(config.baseDir).toStrictEqual(basedir);
        expect(config.rootDir).toStrictEqual(process.cwd());
        expect(config.nodeModules).toStrictEqual(path.resolve(config.rootDir, "node_modules"));
        expect(config.webModules).toStrictEqual(path.resolve(config.rootDir, "web_modules"));
    });

    it("can specify root dir from cli", function () {
        expect(config.rootDir).toStrictEqual(process.cwd());
        parseCLI("--root=./test/fixture");
        configure();
        expect(config.rootDir).toStrictEqual(fixturedir);
    });

    it("accepts configuration from package.json under devServer", function () {
        expect(config.testOption).toBeUndefined();
        configure({rootDir: fixturedir});
        expect(config.version).toBeUndefined();
        expect(config.testOption).toStrictEqual("testValue");
    });

    it("configure to use fixture as root dir", function () {

        configure({
            rootDir: fixturedir,
            mount: {
                "/public": [path.resolve(fixturedir, "public")]
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

        expect(config.baseDir).toStrictEqual(basedir);
        expect(config.rootDir).toStrictEqual(fixturedir);
        expect(config.nodeModules).toStrictEqual(path.resolve(fixturedir, "node_modules"));
        expect(config.webModules).toStrictEqual(path.resolve(fixturedir, "web_modules"));
    });
});