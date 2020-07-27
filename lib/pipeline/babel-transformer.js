const log = require("tiny-node-logger");
const {memoize} = require("../util/memoize.js");
const {useWebModulesPlugin} = require("../util/web-modules-plugin.js");
const {transformFromAstAsync} = require("@babel/core");
const {JAVASCRIPT_CONTENT_TYPE} = require("../util/mime-types.js");

const path = require("path");

module.exports.useBabelTransformer = memoize((config, sourceMaps = false) => {

    const {traverseAsync} = useWebModulesPlugin(config);

    async function babelTransformer(filename, content) {

        const options = {
            ...config.babel,
            sourceMaps
        };

        const source = content;

        let {parsedAst, rewritePlugin} = await traverseAsync(filename, source, options);
        let {code, map, metadata: {imports}} = await transformFromAstAsync(parsedAst, source, {
            ...options,
            plugins: [
                ...options.plugins,
                rewritePlugin
            ],
            filename: filename
        });

        if (map) {
            code += "\n//# sourceMappingURL=" + path.basename(filename) + ".map\n";
        } else {
            code += "\n";
        }

        return {
            content: code,
            headers: {
                "content-type": JAVASCRIPT_CONTENT_TYPE,
                "content-length": Buffer.byteLength(code),
                "x-transformer": "babel-transformer"
            },
            map,
            links: imports
        };
    }

    return {
        babelTransformer
    };
});
