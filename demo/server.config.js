const {resolve} = require("path");

const rootDir = __dirname;

module.exports = {
    rootDir: rootDir,
    nodeModules: [resolve(rootDir, 'node_modules'), resolve(rootDir, '..', 'node_modules')],
    webModules: resolve(rootDir, "web_modules"),
    mount: {
        "/public": [resolve(rootDir, "public")]
    },
    babel: {
        plugins: [
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
    },
    push: true,
    cache: false,
    clean: true,
    logLevel: "debug"
}
