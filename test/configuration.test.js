const {parseCLI, config, configure} = require("../lib/configuration.js");
const path = require("path");
const fs = require("fs");

const basedir = path.resolve(__dirname, "..");
const fixturedir = path.resolve(__dirname, "fixture");

describe("configuration", function () {

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

        const filename = path.resolve(fixturedir, "config-" + Date.now() + ".js");
        fs.writeFileSync(filename, `module.exports = ${JSON.stringify({
            logLevel: "debug"
        }, undefined, " ")}`)
        expect(configure({config: filename})).toMatchObject({logLevel: "debug"});
        fs.unlinkSync(filename);
    });

    it("check default base & root dir", function () {
        configure();
        expect(config.baseDir).toStrictEqual(basedir);
        expect(config.rootDir).toStrictEqual(process.cwd());
        expect(config.nodeModules).toStrictEqual(path.resolve(config.rootDir, "node_modules"));
        expect(config.webModules).toStrictEqual(path.resolve(config.rootDir, "web_modules"));
    });

    it("can specify root dir from cli", function () {
        configure();
        expect(config.rootDir).toStrictEqual(process.cwd());
        parseCLI("--root=./test/fixture");
        configure();
        expect(config.rootDir).toStrictEqual(fixturedir);
        parseCLI();
    });

    it("accepts configuration from package.json under devServer", function () {
        configure();
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

});
