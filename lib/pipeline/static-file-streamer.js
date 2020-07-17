const fs = require("fs");
const path = require("path");
const mime = require("../util/mime-types.js");
const {memoize} = require("../util/memoize.js");

module.exports.useResourceStreamer = memoize(function (config) {

    async function streamStaticFile({filename, stats}) {
        const stream = fs.createReadStream(filename);
        stream.contentType = mime.contentType(filename);
        stream.lastModified = stats.mtime;
        stream.contentLength = stats.size;
    }

    return {
        streamStaticFile
    };
});


module.exports.createResourceStreamer = config => {

    const {rootDir} = config;

    return async function resourceStreamer(url) {

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
};
