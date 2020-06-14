const path = require("path");
const fs = require("fs");
const url = require("url");
const {extname, resolve, join} = require("path");

const {ensureDirSync} = require("../utility/ensure-dir.js");

const log = require("tiny-node-logger");

module.exports.createRouter = function (config, watcher) {

    const DOT_CHARCODE = '.'.charCodeAt(0);

    const rootDir = config.rootDir || process.cwd();

    const isHidden = name => name.charCodeAt(0) === DOT_CHARCODE;

    const routes = new Map();

    /**
     * TODO: Watch every added file/dir and update the mount
     * @param path
     * @param roots
     */
    function mount(path, roots) {

        const route = routes.get(path) || routes.set(path, new Map()).get(path);

        for (let root of Array.isArray(roots) ? roots : [roots]) if (!route.has(root)) try {
            root = ensureDirSync(resolve(rootDir, root));
            const ls = fs.readdirSync(root).filter(dir => !isHidden(dir));
            route.set(root, new Set(ls));
        } catch (e) {
            throw new Error(`Unable to mount ${path}: ${e.message}`);
        }
    }

    mount("/", config.rootDir);
    mount("/resources", config.resources);

    if (config.mount) for (const [route, roots] of Object.entries(config.mount)) {
        mount(route, roots);
    }

    function head(pathname) {
        const end = pathname.indexOf('/', 1);
        return end > 0 ? pathname.substring(0, end) : pathname;
    }

    function tail(pathname) {
        const end = pathname.indexOf('/', 1);
        return end > 0 ? pathname.substring(end + 1) : pathname;
    }

    function routePath(route, pathname) {
        const h = head(pathname);
        for (const [root, list] of route.entries()) {
            if (list.has(h)) return resolve(root, pathname);
        }
    }

    return {
        routes,
        async route(url) {

            const {
                pathname,
                query
            } = url;
            log.debug("get:", url.href);

            const route = head(pathname);
            const handler = routes.get(route) || routes.get("/");

            if (typeof handler === "function") {
                return handler({
                    url,
                    route,
                    filename: tail(pathname)
                });
            }

            let filename = handler && routePath(handler, tail(pathname)) || join(rootDir, pathname);

            try {
                const stats = fs.statSync(filename);
                if (stats.isDirectory()) {
                    try {
                        const main = require(path.join(filename + "/package.json")).main;
                        return {redirect: path.join(pathname, main)}
                    } catch (e) {
                        return {redirect: path.join(pathname, "index.html")};
                    }
                }
                return {
                    route,
                    filename,
                    stats: {
                        size: stats.size,
                        atime: stats.atime.toUTCString(),
                        mtime: stats.mtime.toUTCString(),
                        ctime: stats.ctime.toUTCString(),
                        birthtime: stats.birthtime.toUTCString(),
                    }
                }
            } catch (error) {
                if (error.code === "ENOENT" && pathname === "/favicon.ico") {
                    throw {redirect: "/resources/javascript.png"};
                }
                throw {
                    code: error.code,
                    message: "no such file or directory: " + path.relative(config.rootDir, filename)
                };
            }
        }
    }
};
