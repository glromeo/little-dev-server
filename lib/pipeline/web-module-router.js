const {useWebModuleLoader} = require("../utility/web-module-loader.js");
const log = require("tiny-node-logger");
const {splitModuleUrl} = require("../utility/web-modules");
const {resolve, join} = require("path");
const {JAVASCRIPT_CONTENT_TYPE} = require("./babel-transformer.js");

module.exports.createWebModuleRouter = config => {

    const {webModules} = config;

    const {resolveWebModule} = useWebModuleLoader(config);

    return async function ({route, filename}) {

        log.debug("web module router:", filename);

        const [name, path] = splitModuleUrl(filename);
        const webPkg = await resolveWebModule(name);
        const target = path === webPkg.main ? path : await webPkg.resolve(path);

        if (path !== target) throw {
            redirect: join(route, name, target),
            contentType: JAVASCRIPT_CONTENT_TYPE // todo: resolve from mime type
        }

        return {
            filename: resolve(webModules, name, target),
            stats: webPkg.stats,
            isWebModule: true
        }
    }
}
