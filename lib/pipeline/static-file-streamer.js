const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const {TYPESCRIPT_CONTENT_TYPE} = require("./babel-transformer.js");

module.exports.createStaticFileStreamer = function (config, watcher) {

    return async function streamStaticFile({filename, stats}) {
        const basename = path.basename(filename);
        return {
            content: fs.createReadStream(filename),
            contentType: basename.endsWith(".ts") ? TYPESCRIPT_CONTENT_TYPE : mime.contentType(basename),
            lastModified: stats.mtime,
            contentLength: stats.size
        }
    }
};
