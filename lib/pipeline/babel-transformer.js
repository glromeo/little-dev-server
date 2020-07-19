const log = require("tiny-node-logger");
const {memoize, once} = require("../util/memoize.js");
const {useWebModulesPlugin} = require("../util/web-modules-plugin.js");
const {transformFromAstAsync} = require("@babel/core");
const {JAVASCRIPT_CONTENT_TYPE} = require("../util/mime-types.js");

module.exports.useBabelTransformer = memoize(config => {

    const {traverseAsync} = useWebModulesPlugin(config);

    const babelTransformer = once(async (filename, content) => {

        const options = config.babel;
        const source = content;

        const {parsedAst, rewritePlugin} = await traverseAsync(filename, source, options);
        const startTime = Date.now();
        const {code, metadata: {imports}} = await transformFromAstAsync(parsedAst, source, {
            ...options,
            plugins: [
                ...options.plugins,
                rewritePlugin
            ],
            filename: filename
        });
        log.debug("transformed:", filename, "in:", Date.now() - startTime);

        return {
            content: code,
            headers: {
                "content-type": JAVASCRIPT_CONTENT_TYPE,
                "content-length": Buffer.byteLength(code),
            },
            links: imports
        };
    });

    return {
        babelTransformer
    };
});
