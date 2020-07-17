const log = require("tiny-node-logger/index.js");
const {splitModulePathname} = require("../utility/quick-parse-url.js");
const {useWebModules} = require("../utility/web-modules.js");
const {resolve, join} = require("path");
const {promises: fs} = require("fs");
const {JAVASCRIPT_CONTENT_TYPE} = require("../pipeline/babel-transformer.js");

module.exports.createWebModulesMiddleware = config => {

    const {resolveWebModule} = useWebModules(config);

    return async function (req, res) {

        log.debug("web module router:", filename);

        const [name, path] = splitModulePathname(filename);
        const webPkg = await resolveWebModule(name);

        if (webPkg.local) {

            const pathname = path.join(config.rootDir, await webPkg.resolve(path));
            return {
                filename: pathname,
                stats: await fs.stat(pathname),
                transpile: true
            };

        } else {

            const target = path === webPkg.main ? path : await webPkg.resolve(path);
            if (path !== target) throw {
                redirect: join(route, name, target),
                contentType: JAVASCRIPT_CONTENT_TYPE // todo: resolve from mime type
            };

            return {
                filename: resolve(config.webModules, name, target),
                stats: webPkg.stats,
                transpile: false
            };
        }
    };
};
