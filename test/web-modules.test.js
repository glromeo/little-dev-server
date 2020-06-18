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
        isRewriteRequired,
        parseWebModuleURL,
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

    it("nodeBasename", async function () {
        expect(nodeModuleBareUrl("C:\\little-dev-server\\node_modules\\@babel\\core\\lib\\parse.js")).toStrictEqual("@babel/core/lib/parse.js");
        expect(nodeModuleBareUrl("/little-dev-server/node_modules/@babel/core/lib/parse.js")).toStrictEqual("@babel/core/lib/parse.js");
    });

    it("isRewriteRequired", async function () {
        expect(isRewriteRequired(".")).toBe(true);
        expect(isRewriteRequired(".name")).toBe(true);
        expect(isRewriteRequired(".name.ts")).toBe(true);
        expect(isRewriteRequired("./name")).toBe(true);
        expect(isRewriteRequired("./name.ext")).toBe(false);
        expect(isRewriteRequired("/name")).toBe(true);
        expect(isRewriteRequired("/name.ext")).toBe(false);
        expect(isRewriteRequired("c:/name.ext")).toBe(true);
        expect(isRewriteRequired("c://name.ext")).toBe(true);
        expect(isRewriteRequired("ab://name.ext")).toBe(false);
        expect(isRewriteRequired("http://127.0.0.1:8080/echo?query=message")).toBe(false);
    });

    it("parseWebModuleURL", async function () {
        expect(parseWebModuleURL(".")).toStrictEqual({module: ".", filename: ".", ext: undefined});
        expect(parseWebModuleURL(".name")).toStrictEqual({module: ".", filename: ".name", ext: undefined});
        expect(parseWebModuleURL(".name.ext")).toStrictEqual({module: ".", filename: ".name", ext: ".ext"});
        expect(parseWebModuleURL("./name")).toStrictEqual({module: ".", filename: "name", ext: undefined});
        expect(parseWebModuleURL("./name.ext")).toStrictEqual({module: ".", filename: "name", ext: ".ext"});
        expect(parseWebModuleURL("/name")).toStrictEqual({module: undefined, filename: "/name", ext: undefined});
        expect(parseWebModuleURL("/name.ext")).toStrictEqual({module: undefined, filename: "/name", ext: ".ext"});
        expect(parseWebModuleURL("c:/name.ext")).toStrictEqual({module: "c:", filename: "name", ext: ".ext"});
        expect(parseWebModuleURL("c://name.ext")).toStrictEqual({url:"c://name.ext"});
        expect(parseWebModuleURL("ab://name.ext")).toStrictEqual({url:"ab://name.ext"});
        expect(parseWebModuleURL("http://127.0.0.1:8080/echo?query=message")).toBe({url:"http://127.0.0.1:8080/echo?query=message"});
        expect(parseWebModuleURL("/parent/name")).toStrictEqual({module: undefined, filename: "/parent/name", ext: undefined});
        expect(parseWebModuleURL("parent/name")).toStrictEqual({module: "parent", filename: "name", ext: undefined});
        expect(parseWebModuleURL("@parent/name")).toStrictEqual({module: "@parent/name", filename: undefined, ext: undefined});
        expect(parseWebModuleURL("@parent/module/name")).toStrictEqual({module: "@parent/module", filename: "name", ext: undefined});
    });

    it("isRewriteRequired", async function () {
        const base = "/a/b/c.js"
        expect(resolveWebModuleImport(base,".")).toStrictEqual("/a/b/c.js");
        expect(resolveWebModuleImport(base,".name")).toStrictEqual("/a/b/.name.js");
        expect(resolveWebModuleImport(base,".name.ext")).toStrictEqual("/a/b/.name.ext");
        expect(resolveWebModuleImport(base,"./name")).toStrictEqual("/a/b/name.js");
        expect(resolveWebModuleImport(base,"./name.ext")).toStrictEqual("/a/b/name.ext");
        expect(resolveWebModuleImport(base,"/name")).toStrictEqual("/name.js");
        expect(resolveWebModuleImport(base,"/name.ext")).toStrictEqual("/name.ext");
        expect(resolveWebModuleImport(base,"c:/name.ext")).toStrictEqual("c:/name.ext");
        expect(resolveWebModuleImport(base,"c://name.ext")).toStrictEqual("c://name.ext");
        expect(resolveWebModuleImport(base,"ab://name.ext")).toStrictEqual("ab://name.ext");
        expect(resolveWebModuleImport(base,"http://127.0.0.1:8080/echo?query=message")).toBe("http://127.0.0.1:8080/echo?query=message");
        expect(resolveWebModuleImport(base,"/parent/name")).toStrictEqual("/parent/name");
        expect(resolveWebModuleImport(base,"parent/name")).toStrictEqual("parent/name");
        expect(resolveWebModuleImport(base,"@parent/name")).toStrictEqual("@parent/name");
        expect(resolveWebModuleImport(base,"@parent/module/name")).toStrictEqual("@parent/module/name");
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
