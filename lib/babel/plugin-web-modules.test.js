jest.mock('fs', () => {
    const {vol} = require('memfs');
    vol.fromJSON({}, "/web_modules");
    const {ufs} = require('unionfs');
    ufs.use(jest.requireActual('fs')).use(vol);
    return ufs;
});

const {config} = require("../configuration.js");
const {traverseAsync} = require("./plugin-web-modules.js");

describe("plugin-web-modules", function () {

    const fixtureDir = `${process.cwd()}/test/fixture`;

    beforeAll(function () {

        Object.assign(config, {
            webModules: '/web_modules',
            customResolveOptions: {
                basedir: `${fixtureDir}/node_modules`
            },
            babel: {
                babelrc: true,
                caller: {
                    name: 'little-dev-server',
                    supportsStaticESM: true,
                },
                sourceType: 'module',
                sourceMaps: 'inline',
                plugins: [
                    ["@babel/plugin-syntax-import-meta"],
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
                ]
            }
        });

    });

    it("lit-element & lit-html directive", async function () {

        const {
            parsedAst,
            rewritePlugin: [rewriteWebModulesPlugin, {importMap}]
        } = await traverseAsync("test:traverseAsync", `
            'use strict';
            
            import {customElement, html, LitElement} from "lit-element";
            import {unsafeHTML} from "lit-html/directives/unsafe-html";
            
            @customElement("hello-world")
            export class HelloWorld extends LitElement {
              render() {
                  return html\`<h1>Hello World! 👋🌍</h1>\`;
              }
            }
        `, config.babel);

        expect(importMap.size).toBe(2);
        expect([...importMap.keys()]).toMatchObject(["lit-element", "lit-html/directives/unsafe-html"]);
        expect(importMap.get("lit-element")).toMatch("/web_modules/lit-element/lit-element.js");
        expect(importMap.get("lit-html/directives/unsafe-html")).toMatch("/web_modules/lit-html/directives/unsafe-html.js");

        const fs = require("fs");
        expect(fs.readdirSync("/web_modules")).toMatchObject(["lit-element", "lit-html"]);
        expect(JSON.parse(fs.readFileSync("/web_modules/lit-html/webpackage.json", "utf-8"))).toMatchObject({
            "bundle": [
                "lit-html.js",
                "lib/default-template-processor.js",
                "lib/template-result.js",
                "lib/directive.js",
                "lib/dom.js",
                "lib/part.js",
                "lib/parts.js",
                "lib/render.js",
                "lib/template-factory.js",
                "lib/template-instance.js",
                "lib/template.js",
            ],
            "main": "lit-html.js",
            "name": "lit-html",
            "origin": `${fixtureDir}/node_modules/lit-html`,
        });
    });
})
