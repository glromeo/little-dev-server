const log = require("tiny-node-logger/index.js");
const {splitModulePathname} = require("../util/quick-parse-url.js");
const {useWebModules} = require("../util/web-modules.js");
const {promises: fs} = require("fs");
const path = require("path");
const mime = require("../util/mime-types.js");

const HttpStatus = require("http-status-codes");

module.exports.useWorkspaceFiles = config => {

    const {rootDir} = config;

    const {resolveWebModule} = useWebModules(config);

    async function rewriteWebModule(pathname) {

        const {resolve, join} = path.posix;

        log.debug("loading web module:", pathname);

        const {module, filename} = splitModulePathname(pathname);
        const webPkg = await resolveWebModule(module);

        if (webPkg.local) {
            return webPkg.resolve(filename);
        } else {
            const target = filename === webPkg.main ? filename : await webPkg.resolve(filename);
            const location = join("/web_modules", module, target);
            if (filename !== target) throw {
                code: HttpStatus.PERMANENT_REDIRECT,
                headers: {"location": location}
            }
            return location;
        }
    }

    async function readWorkspaceFile(pathname) {

        if (pathname.startsWith("/web_modules")) {
            pathname = await rewriteWebModule(pathname.substring(13));
        }

        const filename = path.join(rootDir, pathname);

        const stats = await fs.stat(filename).catch(error => {
            if (error.code === "ENOENT") {
                if (pathname === "/favicon.ico") {
                    throw {code: HttpStatus.PERMANENT_REDIRECT, headers: {"location": "/resources/javascript.png"}};
                } else {
                    throw {code: HttpStatus.NOT_FOUND, message: error.stack};
                }
            } else {
                throw {code: HttpStatus.INTERNAL_SERVER_ERROR, message: error.stack};
            }
        });

        if (stats.isDirectory()) {
            throw {code: HttpStatus.PERMANENT_REDIRECT, headers: {"location": path.posix.join(pathname, "index.html")}};
        } else {
            return {
                filename,
                content: await fs.readFile(filename, "UTF-8"),
                headers: {
                    "content-type": mime.contentType(filename),
                    "content-length": stats.size,
                    "last-modified": stats.mtime.toUTCString()
                }
            }
        }
    }

    return {
        readWorkspaceFile
    }
}
