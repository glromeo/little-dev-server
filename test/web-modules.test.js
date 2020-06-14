const {testConfig} = require("./test.config.js");
const {useWebModuleLoader} = require("../lib/utility/web-module-loader.js");
const {useWebModuleBundler} = require("../lib/utility/web-module-bundler.js");

const fs = require("fs");
const path = require("path");

describe("web-module loader/bundler (powered by rollup)", function () {

    const {resolveWebModule} = useWebModuleLoader(testConfig);
    const {modules, bundleWebModule} = useWebModuleBundler(testConfig);

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
