const log = require("tiny-node-logger");
const path = require("path");
const {mkdirSync, readdirSync, promises: fs} = require("fs");
const {extname, resolve, join} = require("path");
const {quickParseSimpleURL} = require("../utility/quick-parse-url.js");

module.exports.createRouter = function (config) {

    const routes = new Map();

    /**
     * TODO: Watch every added file/dir and update the mount
     *
     * @param path
     * @param roots
     */
    function mount(path, roots) {

        const route = routes.get(path) || routes.set(path, new Map()).get(path);

        for (let root of Array.isArray(roots) ? roots : [roots]) if (!route.has(root)) try {
            mkdirSync(resolve(config.rootDir, root), {recursive: true});
            const ls = readdirSync(root).filter(dir => dir.charAt(0) !== ".");
            route.set(root, new Set(ls));
        } catch (error) {
            if (error.code !== "EEXIST") {
                throw new Error(`Unable to mount ${path}: ${error.message}`);
            }
        }
    }

    mount("/", config.rootDir);
    mount("/resources", config.resources);

    if (config.mount) for (const [route, roots] of Object.entries(config.mount)) {
        mount(route, roots);
    }

    function head(pathname) {
        const end = pathname.indexOf("/", 1);
        return end > 0 ? pathname.substring(0, end) : pathname;
    }

    function tail(pathname) {
        const end = pathname.indexOf("/", 1);
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
                search,
                query
            } = quickParseSimpleURL(url, true);

            log.debug("get:", url);

            const route = head(pathname);
            const handler = routes.get(route) || routes.get("/");

            if (typeof handler === "function") {
                return {...await handler({route, filename: tail(pathname)}), query};
            }

            let filename = handler && routePath(handler, tail(pathname)) || join(config.rootDir, pathname);

            try {
                const stats = await fs.stat(filename);
                if (stats.isDirectory()) {
                    try {
                        const main = require(path.join(filename + "/package.json")).main;
                        return {redirect: path.join(pathname, main)};
                    } catch (e) {
                        return {redirect: path.join(pathname, "index.html")};
                    }
                }
                return {
                    route,
                    filename,
                    query,
                    stats: {
                        size: stats.size,
                        atime: stats.atime.toUTCString(),
                        mtime: stats.mtime.toUTCString(),
                        ctime: stats.ctime.toUTCString(),
                        birthtime: stats.birthtime.toUTCString()
                    }
                };
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
    };
};
