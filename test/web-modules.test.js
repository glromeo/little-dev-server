const fs = require("fs");
const path = require("path");
const {configure} = require("../lib/configuration.js");
const {useWebModules} = require("../lib/utility/web-modules.js");

describe("web-module loader/bundler (powered by rollup)", function () {

    const webModulesDir = `${__dirname}/fixture/web_modules`;

    const {
        modules,
        resolveImport,
        resolveWebModule,
        rollupWebModule
    } = useWebModules(configure({rootDir: `${__dirname}/fixture`}));

    it("config.clean cleans the web_modules directory", function () {

        const testFile = `${webModulesDir}/test-clean`;
        fs.mkdirSync(webModulesDir, {recursive: true});
        fs.writeFileSync(testFile, "test");

        useWebModules(configure({rootDir: `${__dirname}/fixture`, clean: false}));
        expect(fs.existsSync(testFile)).toBeTruthy();

        useWebModules(configure({rootDir: `${__dirname}/fixture`, clean: true}));
        expect(fs.existsSync(testFile)).toBeFalsy();
        expect(fs.existsSync(webModulesDir)).toBeTruthy();
    });

    it("resolveImport", async function () {
        const base = `${__dirname}/fixture/alpha/beta/gamma.js`
        expect(await resolveImport(base, "http://127.0.0.1:8080/echo?query=message")).toBe("http://127.0.0.1:8080/echo?query=message");
        expect(await resolveImport(base, ".")).toStrictEqual("./gamma.js");
        expect(await resolveImport(base, "..")).toStrictEqual("../index.js");
        expect(await resolveImport(base, ".delta")).toStrictEqual("./.delta.js");
        expect(await resolveImport(base, "epsilon")).toStrictEqual("./epsilon.mjs");
        expect(await resolveImport(base, ".delta.sigma")).toStrictEqual("/alpha/beta/.delta.sigma?type=module");
        expect(await resolveImport(base, "./delta")).toStrictEqual("./delta.js");
        expect(await resolveImport(base, "./delta.sigma?q=e")).toStrictEqual("./delta.sigma?type=module&q=e");
        expect(await resolveImport(base, "/server.config.js")).toStrictEqual("/server.config.js");
        expect(await resolveImport(base, "/server.config")).toStrictEqual("/server.config");
        expect(await resolveImport(base, "c:/delta.sigma")).toStrictEqual("/alpha/beta/c:/delta.sigma?type=module");
        expect(await resolveImport(base, "file://c/delta.sigma")).toStrictEqual("file://c/delta.sigma");
        expect(await resolveImport(base, "ab://delta.sigma")).toStrictEqual("ab://delta.sigma");
        expect(await resolveImport(base, "/parent/delta")).toStrictEqual("/parent/delta.js");
        try {
            await resolveImport(base, "parent/name");
            fail();
        } catch (error) {
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
        const webPkg = await rollupWebModule("graphql", "language/parser");
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

        expect(await rollupWebModule("lit-element", "lit-element.js")).toStrictEqual({
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

        expect(await rollupWebModule("lit-html", "lit-html.js")).toStrictEqual({
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

    it("resolve web module: lit-html", async function () {

        const webPkg = await resolveWebModule("lit-html");
        expect(webPkg).toMatchObject({
            "name": "lit-html",
            "main": "lit-html.js",
            "origin": path.join(__dirname, "fixture", "node_modules", "lit-html"),
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
            ])
        })

        expect(await webPkg.resolve("lib/render.js")).toMatch("lit-html.js");
    });

    it("bundle web module recognises what has been bundled in lit-html and avoids duplication", async function () {

        modules.set("lit-html", {
            "name": "lit-html",
            "main": "lit-html.js",
            "origin": path.join(__dirname, "fixture", "node_modules", "lit-html"),
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
            ])
        });

        expect(await rollupWebModule("lit-html", "directives/unsafe-html")).toStrictEqual({
            filename: "directives/unsafe-html.js",
            imports: [
                "directives/unsafe-html.js"
            ]
        });

        // expect(await rollupWebModule("date-fns", "date-fns\\esm\\index", "D:\\Workspace\\@codebite\\node_modules\\date-fns\\esm\\index.js")).toBeUndefined();
        //
        // expect(await rollupWebModule("@babel/runtime", "@babel/runtime/helpers/esm/decorate", "/Users/Gianluca/Workbench/Workspace/@codebite/node_modules/@babel/runtime/helpers/esm/decorate.js")).toBeUndefined();
        //
        // expect(await rollupWebModule("@babel/runtime", "@babel\\runtime\\helpers\\esm\\decorate", "D:\\Workspace\\@codebite\\node_modules\\@babel\\runtime\\helpers\\esm\\decorate.js")).toBeUndefined();
    })
})
