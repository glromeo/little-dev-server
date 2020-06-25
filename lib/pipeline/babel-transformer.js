const contentText = require("../utility/content-text");
const {transformFromAstAsync} = require("@babel/core");
const {traverseAsync} = require("../babel/plugin-web-modules");

module.exports.JAVASCRIPT_CONTENT_TYPE = "application/javascript; charset=utf-8";
module.exports.TYPESCRIPT_CONTENT_TYPE = "application/x-typescript; charset=utf-8";

module.exports.createBabelTransformer = function (config, watcher) {

    const transform = async (filename, content) => {

        const options = config.babel;
        const source = await contentText(content);

        const {parsedAst, rewritePlugin} = await traverseAsync(filename, source, options);

        const {code, metadata: {imports}} = transformFromAstAsync(parsedAst, source, {
            ...options,
            plugins: [
                ...options.plugins,
                rewritePlugin
            ], filename: filename
        });

        return {
            content: code,
            contentType: module.exports.JAVASCRIPT_CONTENT_TYPE,
            contentLength: code.length,
            links: imports
        }
    };

    const pendingTasks = new Map();

    return async function babelTransformer({filename, content}) {
        if (!pendingTasks.has(filename)) {
            pendingTasks.set(filename, transform(filename, content));
        }
        try {
            return await pendingTasks.get(filename);
        } finally {
            pendingTasks.delete(filename);
        }
    }
};
