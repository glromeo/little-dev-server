const {createReadStream, promises: fs} = require("fs");
const path = require("path");
const mime = require("../utility/mime-types.js");
const {memoize} = require("../utility/memoize.js");

module.exports.useStaticFileStreamer = memoize(function (config) {

    async function streamStaticFile(pathname) {
        const filename = path.join(config.rootDir, pathname);
        try {
            const stats = await fs.stat(filename);
            if (stats.isDirectory()) {
                return {redirect: path.join(filename, "index.html")};
            }
            return {
                content: createReadStream(filename),
                contentType: mime.contentType(filename),
                contentLength: stats.size,
                lastModified: stats.mtime
            };
        } catch (error) {
            if (error.code === "ENOENT" && pathname === "/favicon.ico") {
                throw {redirect: "/resources/javascript.png"};
            }
            throw {
                code: error.code,
                message: "no such file or directory: " + filename
            };
        }
    }

    return {
        streamStaticFile
    };
});
