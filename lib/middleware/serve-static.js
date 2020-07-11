const {createReadStream, promises: fs} = require("fs");
const path = require("path");
const mime = require("../utility/mime-types.js");
const {memoize} = require("../utility/memoize.js");

const {NOT_FOUND} = require("http-status-codes");

module.exports.useServeStatic = memoize(config => {

    const {rootDir} = config;

    return async function middleware(context, next) {

        const {pathname} = context;

        const filename = path.join(rootDir, pathname);
        try {
            const stats = await fs.stat(filename);
            if (stats.isDirectory()) {
                context.redirect(path.join(filename, "index.html"));
            } else {
                context.content = createReadStream(filename);
                context.header("content-type", mime.contentType(filename));
                context.header("content-length", stats.size);
                context.header("last-modified", stats.mtime);
                return next(context);
            }
        } catch (error) {
            if (pathname === "/favicon.ico" && error.code === "ENOENT") {
                context.redirect("/resources/javascript.png");
            } else {
                context.error(error);
            }
        }
    };
});
