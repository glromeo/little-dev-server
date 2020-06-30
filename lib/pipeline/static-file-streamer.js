const fs = require("fs");
const path = require("path");
const mime = require("../utility/mime-types.js");
const {memoize} = require("../utility/memoize.js");

module.exports.useStaticFileStreamer = memoize(function (config) {

    async function streamStaticFile({filename, stats}) {
        return {
            content: fs.createReadStream(filename),
            contentType: mime.contentType(filename),
            lastModified: stats.mtime,
            contentLength: stats.size
        };
    }

    return {
        streamStaticFile
    };
});
