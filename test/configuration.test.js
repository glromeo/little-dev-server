const {parseCLI, config, configure} = require("../lib/configuration.js");
const path = require("path");

describe("configuration", function () {

    const basedir = path.resolve(__dirname, "..");
    const fixturedir = path.resolve(__dirname, "fixture");

    it("config is empty until configure has been invoked", function () {
        expect(Object.keys(config).length).toBe(0);
        configure();
        expect(Object.keys(config).length).toBeGreaterThan(2);
    });

    it("default base & root dir", function () {
        configure();
        expect(config.baseDir).toStrictEqual(basedir);
        expect(config.rootDir).toStrictEqual(process.cwd());
        expect(config.nodeModules).toStrictEqual(path.resolve(basedir, "node_modules"));
        expect(config.webModules).toStrictEqual(path.resolve(basedir, "web_modules"));

        expect(config.http2).toBeTruthy();
        config.http2 = false;

        parseCLI("--root=./fixture -p");
        configure();

        expect(config.rootDir).toStrictEqual(fixturedir);
        expect(config.http2).not.toBeTruthy();
        expect(config.push).toBeTruthy();
    });

    it("accepts configuration from package.json under devServer", function () {
        configure();
        expect(config.testOption).toBeUndefined();
        configure({rootDir:fixturedir});
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