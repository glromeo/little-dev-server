const log = require("tiny-node-logger");
const {memoize} = require("../util/memoize.js");
const {useWebModulesPlugin} = require("../util/web-modules-plugin.js");
const {transformFromAstAsync} = require("@babel/core");
const {JAVASCRIPT_CONTENT_TYPE} = require("../util/mime-types.js");

module.exports.useBabelTransformer = memoize(config => {

    const {traverseAsync} = useWebModulesPlugin(config);

    async function babelTransformer(filename, content) {

        const options = config.babel;
        const source = content;

        const {parsedAst, rewritePlugin} = await traverseAsync(filename, source, options);
        const {code, metadata: {imports}} = await transformFromAstAsync(parsedAst, source, {
            ...options,
            plugins: [
                ...options.plugins,
                rewritePlugin
            ],
            filename: filename
        });

        return {
            content: code,
            headers: {
                "content-type": JAVASCRIPT_CONTENT_TYPE,
                "content-length": Buffer.byteLength(code),
                "x-transformer": "babel-transformer"
            },
            links: imports
        };
    }

    return {
        babelTransformer
    }
});
