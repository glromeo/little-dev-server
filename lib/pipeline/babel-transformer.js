const log = require("tiny-node-logger");
const {contentText} = require("../utility/content-utils.js");
const {memoize, blockingTransformer} = require("../utility/memoize.js");
const {useWebModulesPlugin} = require("../utility/web-modules-plugin.js");
const {transformFromAstAsync} = require("@babel/core");
const {JAVASCRIPT_CONTENT_TYPE} = require("../utility/mime-types.js");

module.exports.useBabelTransformer = memoize(config => {

    const {traverseAsync} = useWebModulesPlugin(config);

    const babelTransformer = blockingTransformer(async (filename, content) => {

        const options = config.babel;
        const source = await contentText(content);

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
            contentType: JAVASCRIPT_CONTENT_TYPE,
            contentLength: code.length,
            links: imports
        };
    });

    return {
        babelTransformer
    };
});
