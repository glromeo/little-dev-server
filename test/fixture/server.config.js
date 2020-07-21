const {resolve} = require("path");

module.exports = {
    nodeModules: [resolve(__dirname, "node_modules"), resolve(__dirname, "../../demo/node_modules")],
    webModules: resolve(__dirname, "web_modules"),
    mount: {
        "/mount-example": resolve(__dirname, "public/override"),
        "/public": resolve(__dirname, "public")
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
            }]
        ]
    },
    cache: false,
    clean: true,
    customResolveOptions: {
        basedir: __dirname
    },
    logLevel: "info"
};
