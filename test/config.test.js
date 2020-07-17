describe("configuration", function () {

    const {configure} = require("../lib/config.js");

    const {fixtureDir} = require("./.setup.js");
    const {resolve, join} = require("path");
    const fs = require("fs");

    const baseDir = process.cwd();
    const rootDir = fixtureDir;

    it("can load config from a file", function () {

        let config = configure();
        expect(config.webModules).toMatch(join(baseDir, "web_modules"));

        config = configure({config: join(rootDir, "server.config.js")});
        expect(config.webModules).toMatch(join(rootDir, "web_modules"));

        const configfile = join(rootDir, "config-" + Date.now() + ".js");
        fs.writeFileSync(configfile, `module.exports = ${JSON.stringify({
            logLevel: "debug"
        }, undefined, " ")}`);
        expect(configure({config: configfile})).toMatchObject({logLevel: "debug"});
        fs.unlinkSync(configfile);
    });

    it("configure to use fixture as root dir", function () {

        const config = configure({
            rootDir: `${rootDir}`,
            mount: {
                "/public": [join(rootDir, "public")]
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
                    }]
                ])
            },
            push: true,
            cache: true,
            clean: true
        });

        expect(config.baseDir).toStrictEqual(process.cwd());
        expect(config.rootDir).toStrictEqual(rootDir);
        expect(config.nodeModules).toStrictEqual([join(rootDir, "node_modules"), join(baseDir, "demo", "node_modules")]);
        expect(config.webModules).toStrictEqual(join(rootDir, "web_modules"));
    });

    it("config.rootDir must be a directory", async function () {
        expect(() => configure({rootDir: __filename})).toThrowError("ENODIR: not a valid root directory");
        expect(() => configure({rootDir: join(fixtureDir, "non_dir")})).toThrowError("ENOENT: no such file or directory");
    });

    it("check default base & root dir", function () {
        const config = configure();
        expect(config.baseDir).toStrictEqual(process.cwd());
        expect(config.rootDir).toStrictEqual(process.cwd());
        expect(config.nodeModules).toStrictEqual(resolve(config.rootDir, "node_modules"));
        expect(config.webModules).toStrictEqual(resolve(config.rootDir, "web_modules"));
    });

    it("undefined or null clear a default value", function () {
        let config = configure({server: {options: undefined}});
        expect(config.server.options).toBeUndefined();
        config = configure({http2: null});
        expect(config.http2).toBeNull();
        config = configure({http2: false});
        expect(config.http2).toBe(false);
    });

});
