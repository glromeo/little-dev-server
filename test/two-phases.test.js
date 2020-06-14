const {testConfig} = require("./test.config.js");
const {merge} = require("../lib/config.js");
const path = require("path");
const fs = require("fs");
const {useWebModuleBundler} = require("../lib/utility/web-module-bundler.js");
const {useWebModuleLoader} = require("../lib/utility/web-module-loader.js");
const {createBabelTransformer} = require("../lib/pipeline/babel-transformer.js");

describe("two-phases", function () {

    const babelTransformer = createBabelTransformer({...testConfig, webModules: "temp/two-phases/web_modules"});

    beforeAll(function () {
        fs.mkdirSync("temp/two-phases/web_modules", {recursive: true});
    })

    afterAll(function () {
        fs.rmdirSync("./temp/two-phases", {recursive: true})
    })

    it("useWebModuleLoader returns the same instance when called twice", async function () {
        expect(useWebModuleLoader(testConfig)).toStrictEqual(useWebModuleLoader(testConfig));
    })

    it("bundling few modules", async function () {

        const filename = path.resolve(testConfig.rootDir, "src/hello-world-convoluted.mjs");

        const source = fs.readFileSync(filename, "UTF-8");
        const {content, imports} = await babelTransformer({filename, content: source});

        console.log(imports);
        console.log(content);
    })

    const {modules, bundleWebModule} = useWebModuleBundler(testConfig);

    it("decorate", function () {
        bundleWebModule("@babel/runtime", "@babel/runtime/helpers/esm/decorate", "@babel/runtime/helpers/esm/decorate.js")
        bundleWebModule("date-fns", "date-fns/esm/index", "date-fns/esm/index.js")
    })
})
