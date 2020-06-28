const {configure} = require("../lib/configuration.js");

const path = require("path");
const fs = require("fs");

describe("configuration", function () {

    it("can load config from a file", function () {

        let config = configure();
        expect(config.webModules).toMatch(`${process.cwd()}/web_modules`);

        config = configure({config: `${__dirname}/fixture/server.config.js`});
        expect(config.webModules).toMatch(`${__dirname}/fixture/web_modules`);

        const configfile = `${__dirname}/fixture/config-${Date.now()}.js`;
        fs.writeFileSync(configfile, `module.exports = ${JSON.stringify({
            logLevel: "debug"
        }, undefined, " ")}`)
        expect(configure({config: configfile})).toMatchObject({logLevel: "debug"});
        fs.unlinkSync(configfile);
    });

    it("configure to use fixture as root dir", function () {

        const config = configure({
            rootDir: `${__dirname}/fixture`,
            mount: {
                "/public": [`${__dirname}/fixture/public`]
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

        expect(config.baseDir).toStrictEqual(process.cwd());
        expect(config.rootDir).toStrictEqual(`${__dirname}/fixture`);
        expect(config.nodeModules).toStrictEqual(`${__dirname}/fixture/node_modules`);
        expect(config.webModules).toStrictEqual(`${__dirname}/fixture/web_modules`);
    });

    it("config.rootDir must be a directory", async function () {
        expect(() => configure({rootDir: __filename})).toThrowError("ENODIR: not a valid root directory");
        expect(() => configure({rootDir: `${__dirname}/non_dir/`})).toThrowError("ENOENT: no such file or directory");
    });

    it("check default base & root dir", function () {
        const config = configure();
        expect(config.baseDir).toStrictEqual(process.cwd());
        expect(config.rootDir).toStrictEqual(process.cwd());
        expect(config.nodeModules).toStrictEqual(path.resolve(config.rootDir, "node_modules"));
        expect(config.webModules).toStrictEqual(path.resolve(config.rootDir, "web_modules"));
    });

    it("accepts configuration from package.json under devServer", function () {
        let config = configure();
        expect(config.testOption).toBeUndefined();
        config = configure({rootDir: `${__dirname}/fixture`});
        expect(config.version).toBeUndefined();
        expect(config.testOption).toStrictEqual("testValue");
    });

});
