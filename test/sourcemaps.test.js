describe("source maps", function f() {

    const path = require("path");
    const {writeFileSync} = require("fs");

    const rollup = require("rollup");

    const rootDir = path.resolve(__dirname, "fixture/sourcemap");
    const nodeModules = path.resolve(__dirname, "fixture/node_modules");

    const createPluginNodeResolve = require("@rollup/plugin-node-resolve").default;
    const createPluginCommonjs = require("@rollup/plugin-commonjs");
    const createPluginTerser = require("rollup-plugin-terser").terser;

    const pluginNodeResolve = createPluginNodeResolve({
        rootDir,
        customResolveOptions: {basedir: rootDir, paths: [nodeModules], extensions: [".mjs", ".js", ".ts"]}
    });
    const pluginCommonjs = createPluginCommonjs();
    const pluginTerser = createPluginTerser({
        mangle: true,
        output: {
            comments: false
        }
    });

    it("rollup", async function () {

        const bundle = await rollup.rollup({
            input: path.resolve(__dirname, "fixture/node_modules/lit-html/lit-html.js"),
            plugins: [
                pluginNodeResolve,
                pluginCommonjs,
                pluginTerser
            ]
        });

        await bundle.write({
            dir: rootDir,
            format: "esm",
            sourcemap: true
        });

    });

    const {transformFileSync} = require("@babel/core");

    it("babel", async function () {

        const out = transformFileSync(path.resolve(__dirname, "fixture/src/hello-world.mjs"), {
            babelrc: false,
            caller: {
                name: "little-dev-server",
                supportsStaticESM: true
            },
            sourceType: "module",
            sourceMaps: true,
            plugins: [
                ["@babel/plugin-syntax-import-meta"],
                ["@babel/plugin-proposal-decorators", {decoratorsBeforeExport: true}],
                ["@babel/plugin-proposal-class-properties"]
            ]
        })

        const{code, map} = out;

        writeFileSync(path.resolve(rootDir, "hello-world.js"), `${code}\n//# sourceMappingURL=hello-world.js.map\n`);
        writeFileSync(path.resolve(rootDir, "hello-world.js.map"), JSON.stringify(map));
    });

});