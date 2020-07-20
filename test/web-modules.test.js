describe("web modules", function () {

    const fs = require("fs");
    const path = require("path");
    const {toPosix} = require("../lib/util/quick-parse-url.js");
    const {configure} = require("../lib/config.js");
    const {useWebModules} = require("../lib/util/web-modules.js");

    const fixturedir = path.join(__dirname, "fixture");
    const webModulesDir = path.join(fixturedir, "web_modules");

    const {
        modules,
        resolveImport,
        resolveWebModule,
        rollupWebModule
    } = useWebModules(configure({rootDir: fixturedir}));

    beforeEach(function () {
        modules.init();
    });

    it("if config.clean is set the web_modules directory is wiped out at initialization", function () {

        const testFile = path.join(webModulesDir, "test-clean");
        fs.mkdirSync(webModulesDir, {recursive: true});
        fs.writeFileSync(testFile, "test");

        const configuration = configure({rootDir: fixturedir, clean: false});
        useWebModules(configuration);
        expect(fs.existsSync(testFile)).toBeTruthy();

        // ...remember that useXXX is memoized
        useWebModules(configuration);
        expect(fs.existsSync(testFile)).toBeTruthy();

        useWebModules(configure({rootDir: fixturedir, clean: true}));
        expect(fs.existsSync(testFile)).toBeFalsy();
        expect(fs.existsSync(webModulesDir)).toBeTruthy();
    });

    it("javascript import resolution", async function () {

        const basedir = path.join(fixturedir, "alpha", "beta");

        // urls go unmodified
        await expect(resolveImport(basedir, "http://127.0.0.1:8080/echo?query=message")).resolves.toBe(
            "http://127.0.0.1:8080/echo?query=message"
        );
        await expect(resolveImport(basedir, "file:///echo.do?query=message")).resolves.toBe(
            "file:///echo.do?query=message"
        );

        // modules are resolved from local workspaces
        await expect(resolveImport(basedir, "@test/fixture")).resolves.toBe(
            "/alpha/index.js"
        );
        await expect(resolveImport(basedir, "package-a")).resolves.toBe(
            "/workspace-a/index.mjs"
        );
        await expect(resolveImport(basedir, "package-b")).resolves.toBe(
            "/workspaces/workspace-b/index.mjs"
        );
        await expect(resolveImport(basedir, "package-c")).rejects.toMatchObject({
            message: expect.stringContaining("Cannot find module 'package-c/package.json'")
        });

        // ...if they are present
        await expect(resolveImport(basedir, "parent/name")).rejects.toMatchObject({
            message: expect.stringContaining(`Cannot find module 'parent/package.json'`)
        });

        // import "." is meaningless
        await expect(resolveImport(basedir, ".")).rejects.toMatchObject({
            message: expect.stringContaining("Cannot find module")
        });

        // import "." is the parent module so in the fixture resolves to the index file
        await expect(resolveImport(basedir, "..")).resolves.toBe(
            "/alpha/index.js"
        );

        // import are resolved from the basedir following require semantic

        // there's no delta in fixture/alpha/beta
        await expect(resolveImport(basedir, "delta")).rejects.toMatchObject({
            message: expect.stringContaining("Cannot find module 'delta/package.json'")
        });
        // should resolve fixture/alpha/beta/epsilon.mjs
        await expect(resolveImport(basedir, "./epsilon")).resolves.toBe(
            "/alpha/beta/epsilon.mjs"
        );
        // should resolve fixture/alpha/beta/delta.sigma adding query for type=module
        await expect(resolveImport(basedir, "./delta.sigma")).resolves.toBe(
            "/alpha/beta/delta.sigma?type=module"
        );
        // ...leaving any existing query alone
        await expect(resolveImport(basedir, "./delta.sigma?q=e")).resolves.toBe(
            "/alpha/beta/delta.sigma?type=module&q=e"
        );

        // there's src in fixture (root dir) yet it's not a package
        await expect(resolveImport(fixturedir, "src")).rejects.toMatchObject({
            message: expect.stringContaining("Cannot find module 'src/package.json'")
        });
        // ...it has index.js though!
        await expect(resolveImport(fixturedir, "./src")).resolves.toBe(
            "/src/index.js"
        );

        // absolute files are resolved from root dir
        await expect(resolveImport(basedir, "/server.config.js")).resolves.toBe(
            "/server.config.js"
        );
        // ...even if they miss their ext
        await expect(resolveImport(basedir, "/src/broken")).resolves.toBe(
            "/src/broken.js"
        );

        // web_modules are bundled on demand and resolved urls point to their main file when possible

        await expect(resolveImport(basedir, "lit-html")).resolves.toBe(
            "/web_modules/lit-html/lit-html.js"
        );
        await expect(resolveImport(basedir, "lit-html/lit-html.js")).resolves.toBe(
            "/web_modules/lit-html/lit-html.js"
        );
        await expect(resolveImport(basedir, "lit-html/lib/parts.js")).resolves.toBe(
            "/web_modules/lit-html/lit-html.js"
        );
        await expect(resolveImport(basedir, "lit-html/lib/shady-render.js")).resolves.toBe(
            "/web_modules/lit-html/lib/shady-render.js"
        );
        await expect(resolveImport(basedir, "lit-html/directives/unsafe-html.js")).resolves.toBe(
            "/web_modules/lit-html/directives/unsafe-html.js"
        );

        // ...it works with namespaces too
        await expect(resolveImport(basedir, "@polymer/paper-checkbox")).resolves.toBe(
            "/web_modules/@polymer/paper-checkbox/paper-checkbox.js"
        );
        // it can handle non javascript files by copying them over and resolving using query type=module
        await expect(resolveImport(basedir, "@polymer/paper-checkbox/demo/index.html")).resolves.toBe(
            "/web_modules/@polymer/paper-checkbox/demo/index.html?type=module"
        );
    });

    it("importing non modules is discouraged but works", async function () {
        const basedir = path.join(fixturedir, "alpha", "beta");
        await expect(resolveImport(basedir, "@webcomponents/shadycss/apply-shim.min.js")).resolves.toBe(
            "/web_modules/@webcomponents/shadycss/apply-shim.min.js"
        );
    });

    it("graphql-tag (and graphql pulled in as dependency)", async function () {
        const graphqlTagModule = await resolveWebModule("graphql-tag");
        expect(graphqlTagModule).toMatchObject({
            "bundle": {},
            "dependencies": [],
            "files": {},
            "main": "src/index.js",
            "name": "graphql-tag",
            "stats": {
                "size": 12881
            }
        });
        expect(fs.readFileSync(path.resolve(fixturedir, "web_modules/graphql-tag/src/index.js"), "UTF-8")).toMatch(
            `import e from '/web_modules/graphql/language/parser';`
        );
        // the resolveImport should prefer mjs over js
        expect(await resolveImport(fixturedir, "graphql/language/parser")).toMatch(
            "/web_modules/graphql/language/parser.mjs"
        );
        // because of the main entry point the size is quite big!
        expect(modules.get("graphql").bundle.size).toBe(126);
    });

    it("lit-element (resolved by rollup) then lit-html", async function () {

        await expect(rollupWebModule("lit-element", "lit-element.js")).resolves.toMatchObject({
            "filename": "lit-element.js",
            "imports": expect.arrayContaining([
                "lit-element.js",
                "lib/updating-element.js",
                "lib/decorators.js",
                "lib/css-tag.js"
            ])
        });

        modules.set("lit-element", {
            bundle: new Set([
                "lit-element.js",
                "lib/updating-element.js",
                "lib/decorators.js",
                "lib/css-tag.js"
            ])
        });

        await expect(rollupWebModule("lit-html", "lit-html.js")).resolves.toMatchObject({
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
        });

        await expect(webPkg.resolve("lib/render.js")).resolves.toMatch("lit-html.js");
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

        await expect(rollupWebModule("lit-html", "directives/unsafe-html")).resolves.toMatchObject({
            filename: "directives/unsafe-html.js",
            imports: [
                "directives/unsafe-html.js"
            ]
        });
    });
});
