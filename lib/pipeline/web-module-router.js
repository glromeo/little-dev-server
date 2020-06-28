const log = require("tiny-node-logger/index.js");
const {splitModulePathname} = require("../utility/quick-parse-url.js");
const {useWebModules} = require("../utility/web-modules.js");
const {resolve, join} = require("path");
const {JAVASCRIPT_CONTENT_TYPE} = require("./babel-transformer.js");

module.exports.createWebModuleRouter = config => {

    const {resolveWebModule} = useWebModules(config);

    return async function ({route, filename}) {

        log.debug("web module router:", filename);

        const [name, path] = splitModulePathname(filename);
        const webPkg = await resolveWebModule(name);
        const target = path === webPkg.main ? path : await webPkg.resolve(path);

        if (path !== target) throw {
            redirect: join(route, name, target),
            contentType: JAVASCRIPT_CONTENT_TYPE // todo: resolve from mime type
        }

        return {
            filename: resolve(config.webModules, name, target),
            stats: webPkg.stats,
            isWebModule: true
        }
    }
}
