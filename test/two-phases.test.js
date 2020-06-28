const {testConfig} = require("./test-configuration.js");
const {merge} = require("../lib/configuration.js");
const path = require("path");
const fs = require("fs");
const {useWebModules} = require("../lib/utility/web-modules.js");
const {useBabelTransformer} = require("../lib/pipeline/babel-transformer.js");

describe("two-phases", function () {

    const rootDir = `${__dirname}/fixture/two-phases`;

    const {babelTransformer} = useBabelTransformer({
        ...testConfig,
        webModules: `${rootDir}/web_modules`,
        nodeModules: [`${rootDir}/node_modules`, `${process.cwd()}/demo/node_modules`]
    });

    beforeAll(function () {
        fs.mkdirSync(`${rootDir}/web_modules`, {recursive: true});
    })

    afterAll(function () {
        fs.rmdirSync(`${rootDir}`, {recursive: true})
    })

    it("bundling few modules", async function () {

        const filename = path.resolve(testConfig.rootDir, "src/hello-world-convoluted.mjs");

        const source = fs.readFileSync(filename, "UTF-8");
        const {content, imports} = await babelTransformer(filename, source);

        console.log(imports);
        console.log(content);
    })

    const {modules, rollupWebModule} = useWebModules(testConfig);

    it("decorate", function () {
        rollupWebModule("@babel/runtime", "@babel/runtime/helpers/esm/decorate", "@babel/runtime/helpers/esm/decorate.js")
        rollupWebModule("date-fns", "date-fns/esm/index", "date-fns/esm/index.js")
    })
})
