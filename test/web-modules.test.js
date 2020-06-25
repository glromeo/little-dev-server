const {
    baseDir,
    fixtureDir,
    webModulesDir,
    testConfig
} = require("./test-configuration.js");

const {
    parseCLI,
    config,
    configure
} = require("../lib/configuration.js");

const fs = require("fs");
const path = require("path");

describe("web-module loader/bundler (powered by rollup)", function () {

    configure(testConfig);

    const {
        nodeModuleBareUrl,
        parseURL,
        resolveImport,
        modules,
        resolveWebModule,
        bundleWebModule
    } = require("../lib/utility/web-modules.js");

    it("config.clean cleans the web_modules directory", function () {

        const testFile = webModulesDir.join("test-clean");
        fs.mkdirSync(webModulesDir.path, {recursive: true});
        fs.writeFileSync(testFile, "test");

        configure({rootDir: fixtureDir.path, clean: false});
        expect(fs.existsSync(testFile)).toBeTruthy();

        configure({rootDir: fixtureDir.path, clean: true});
        expect(fs.existsSync(testFile)).toBeFalsy();
        expect(fs.existsSync(webModulesDir.path)).toBeTruthy();
    });

    it("nodeModuleBareUrl", async function () {
        expect(nodeModuleBareUrl(`C:${path.sep}little-dev-server${path.sep}node_modules${path.sep}@babel${path.sep}core${path.sep}lib${path.sep}parse.js`)).toStrictEqual("@babel/core/lib/parse.js");
        expect(nodeModuleBareUrl("/little-dev-server/node_modules/@babel/core/lib/parse.js")).toStrictEqual("@babel/core/lib/parse.js");
    });

    it("parseURL", async function () {
        function stripUndefined(obj) {
            const out = {};
            Object.keys(obj).filter(k => obj[k] !== undefined).forEach(k => out[k] = obj[k]);
            return out;
        }

        expect(stripUndefined(parseURL("."))).toStrictEqual({filename: "."});
        expect(stripUndefined(parseURL(".."))).toStrictEqual({filename: ".."});
        expect(stripUndefined(parseURL("../"))).toStrictEqual({filename: "../"});
        expect(stripUndefined(parseURL("../."))).toStrictEqual({filename: "../."});
        expect(stripUndefined(parseURL("/"))).toStrictEqual({filename: "/"});
        expect(stripUndefined(parseURL("/.."))).toStrictEqual({filename: "/.."});
        expect(stripUndefined(parseURL("http://127.0.0.1:8080/echo?query=message"))).toStrictEqual({
            scheme: "http", domain: "127.0.0.1:8080", filename: "/echo", search: "query=message"
        });
        expect(stripUndefined(parseURL("http://username:password@127.0.0.1:8080/echo?query=message"))).toStrictEqual({
            scheme: "http", domain: "username:password@127.0.0.1:8080", filename: "/echo", search: "query=message"
        });
        expect(stripUndefined(parseURL("name"))).toStrictEqual({module: "name"});
        expect(stripUndefined(parseURL(".name.ext"))).toStrictEqual({filename: ".name.ext"});
        expect(stripUndefined(parseURL("name.js?query=q"))).toStrictEqual({filename: "name.js", search: "query=q"});
        expect(stripUndefined(parseURL("./name"))).toStrictEqual({filename: "./name"});
        expect(stripUndefined(parseURL("../a/b/name.ext?query=q&x=y"))).toStrictEqual({
            filename: "../a/b/name.ext",
            search: "query=q&x=y"
        });
        expect(stripUndefined(parseURL("/name"))).toStrictEqual({filename: "/name"});
        expect(stripUndefined(parseURL("/.name"))).toStrictEqual({filename: "/.name"});
        expect(stripUndefined(parseURL("c:/name.ext"))).toStrictEqual({filename: "c:/name.ext"});
        expect(stripUndefined(parseURL("c://name.ext"))).toStrictEqual({scheme: "c", domain: "name.ext"});
        expect(stripUndefined(parseURL("c://name.ext/file"))).toStrictEqual({
            scheme: "c",
            domain: "name.ext",
            filename: "/file"
        });
        expect(stripUndefined(parseURL("ab://name.ext?q=e"))).toStrictEqual({
            scheme: "ab", domain: "name.ext", search: "q=e"
        });
        expect(stripUndefined(parseURL("c://name.ext/?q=e"))).toStrictEqual({
            scheme: "c", domain: "name.ext", filename: "/", search: "q=e"
        });
        expect(stripUndefined(parseURL("/parent/name"))).toStrictEqual({filename: "/parent/name"});
        expect(stripUndefined(parseURL("lit-html"))).toStrictEqual({module: "lit-html"});
        expect(stripUndefined(parseURL("parent/name"))).toStrictEqual({module: "parent", filename: "name"});
        expect(stripUndefined(parseURL("@parent/name"))).toStrictEqual({module: "@parent/name"});
        expect(stripUndefined(parseURL("@parent/module/name"))).toStrictEqual({
            module: "@parent/module", filename: "name",
        });
        expect(stripUndefined(parseURL("@parent/module/name.scss?type=module"))).toStrictEqual({
            module: "@parent/module", filename: "name.scss", search: "type=module"
        });
    });

    it("resolveImport", async function () {
        const base = "/a/b"
        expect(await resolveImport(base, "http://127.0.0.1:8080/echo?query=message")).toBe("http://127.0.0.1:8080/echo?query=message");
        expect(await resolveImport(base, ".")).toStrictEqual("/a/b.js");
        expect(await resolveImport(base, "..")).toStrictEqual("/a.js");
        expect(await resolveImport(base, ".name")).toStrictEqual("/a/b/.name.js");
        expect(await resolveImport(base, ".name.ext")).toStrictEqual("/a/b/.name.ext?type=module");
        expect(await resolveImport(base, "./name")).toStrictEqual("/a/b/name.js");
        expect(await resolveImport(base, "./name.ext?q=e")).toStrictEqual("/a/b/name.ext?type=module&q=e");
        expect(await resolveImport(base, "/name")).toStrictEqual("/name.js");
        expect(await resolveImport(base, "/name.mjs")).toStrictEqual("/name.mjs");
        expect(await resolveImport(base, "c:/name.ext")).toStrictEqual("/a/b/c:/name.ext?type=module");
        expect(await resolveImport(base, "file://c/name.ext")).toStrictEqual("file://c/name.ext");
        expect(await resolveImport(base, "ab://name.ext")).toStrictEqual("ab://name.ext");
        expect(await resolveImport(base, "/parent/name")).toStrictEqual("/parent/name.js");
        try {
            await resolveImport(base, "parent/name");
            fail();
        } catch(error) {
            expect(error.message).toMatch(`Cannot find module 'parent/package.json'`);
        }

        expect(await resolveImport(base, "lit-html")).toStrictEqual("/web_modules/lit-html/lit-html.js");

        expect(await resolveImport(base, "@polymer/paper-checkbox")).toStrictEqual("/web_modules/@polymer/paper-checkbox/paper-checkbox.js");
        expect(await resolveImport(base, "@polymer/paper-checkbox/demo/index.html")).toStrictEqual("/web_modules/@polymer/paper-checkbox/demo/index.html?type=module");
        expect(await resolveImport(base, "@webcomponents/shadycss/apply-shim.min.js")).toStrictEqual("/web_modules/@webcomponents/shadycss/apply-shim.min.js");
    });

    it("graphql-tag", async function () {
        const graphqlTagModule = await resolveWebModule("graphql-tag");
        expect(graphqlTagModule).toMatchObject({
            "bundle": {},
            "dependencies": [],
            "files": {},
            "main": "src/index.js",
            "name": "graphql-tag",
            "stats": {
                "size": 19377
            }
        });
    });

    it("graphql language parser", async function () {
        const webPkg = await bundleWebModule("graphql", "language/parser.js", "graphql/language/parser");
        expect(webPkg.imports.sort()).toMatchObject([
            "error/GraphQLError.mjs",
            "error/syntaxError.mjs",
            "jsutils/defineToJSON.mjs",
            "jsutils/defineToStringTag.mjs",
            "jsutils/devAssert.mjs",
            "jsutils/inspect.mjs",
            "jsutils/isObjectLike.mjs",
            "jsutils/nodejsCustomInspectSymbol.mjs",
            "language/blockString.mjs",
            "language/directiveLocation.mjs",
            "language/kinds.mjs",
            "language/lexer.mjs",
            "language/location.mjs",
            "language/parser.mjs",
            "language/printLocation.mjs",
            "language/source.mjs",
            "language/tokenKind.mjs",
        ]);
    });

    it("lit-element (resolved by rollup) then lit-html", async function () {

        expect(await bundleWebModule("lit-element", "lit-element.js", "lit-element")).toStrictEqual({
            "filename": "lit-element.js",
            "imports": expect.arrayContaining([
                "lit-element.js",
                "lib/updating-element.js",
                "lib/decorators.js",
                "lib/css-tag.js",
            ])
        });

        modules.set("lit-element", {
            bundle: new Set([
                "lit-element.js",
                "lib/updating-element.js",
                "lib/decorators.js",
                "lib/css-tag.js",
            ])
        })

        expect(await bundleWebModule("lit-html", "lit-html.js", "lit-html/lit-html")).toStrictEqual({
            "filename": "lit-html.js",
            "imports": expect.arrayContaining([
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
                "lib/template.js"
            ])
        });
    });

    it("lit-html/lib/render.js", async function () {

        const webPkg = await resolveWebModule("lit-html");
        expect(webPkg).toMatchObject({
            "name": "lit-html",
            "main": "lit-html.js",
            "origin": expect.stringContaining("/little-dev-server/demo/node_modules/lit-html"),
            "dependencies": [],
            "bundle": new Set([
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
                "lib/template.js"
            ]),
            "stats": {
                "size": 154681
            }
        })
        expect(await webPkg.resolve("lib/render.js")).toMatch("lit-html.js");

        // expect(await bundleWebModule("lit-html", "lit-html/directives/unsafe-html", "lit-html/directives/unsafe-html.js")).toStrictEqual({
        //     imports: [
        //         "lit-html/directives/unsafe-html.js"            ]
        // });

        // expect(await bundleWebModule("date-fns", "date-fns\\esm\\index", "D:\\Workspace\\@codebite\\node_modules\\date-fns\\esm\\index.js")).toBeUndefined();

        // expect(await bundleWebModule("@babel/runtime", "@babel/runtime/helpers/esm/decorate", "/Users/Gianluca/Workbench/Workspace/@codebite/node_modules/@babel/runtime/helpers/esm/decorate.js")).toBeUndefined();

        // expect(await bundleWebModule("@babel/runtime", "@babel\\runtime\\helpers\\esm\\decorate", "D:\\Workspace\\@codebite\\node_modules\\@babel\\runtime\\helpers\\esm\\decorate.js")).toBeUndefined();
    })
})
