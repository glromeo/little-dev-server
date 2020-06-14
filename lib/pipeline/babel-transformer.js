const contentText = require("../utility/content-text");
const {transformFromAstSync} = require("@babel/core");
const {usePluginWebModules} = require("../babel/plugin-web-modules");

module.exports.JAVASCRIPT_CONTENT_TYPE = "application/javascript; charset=utf-8";
module.exports.TYPESCRIPT_CONTENT_TYPE = "application/x-typescript; charset=utf-8";

module.exports.createBabelTransformer = function (config, watcher) {

    const options = config.babel;

    const {traverseAsync} = usePluginWebModules(config);

    const pendingTasks = new Map();

    const transform = async (filename, content) => {
        const pendingTask = pendingTasks.get(filename);
        if (pendingTask) {
            return (await pendingTask);
        }
        const source = await contentText(content);

        const {parsedAst, rewritePlugin} = await traverseAsync(filename, source, options);

        const transformTask = transformFromAstSync(parsedAst, source, {
            ...options, plugins: [
                ...options.plugins,
                rewritePlugin
            ], filename: filename
        });
        pendingTasks.set(filename, transformTask);
        try {
            const output = await transformTask;
            return output;
        } finally {
            pendingTasks.delete(filename);
        }
    };

    return async function babelTransformer({filename, content}) {
        const {code, metadata: {imports}} = await transform(filename, content);
        return {
            content: code,
            contentType: module.exports.JAVASCRIPT_CONTENT_TYPE,
            contentLength: code.length,
            links: imports
        }
    }
};
