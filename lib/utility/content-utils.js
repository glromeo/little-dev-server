const isStream = require("is-stream");
const getStream = require("get-stream");

const {Readable} = require("stream");

const NODE_FETCH_USER_AGENT = "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)";

module.exports.sendContent = function (stream, content, userAgent) {

    if (isStream(content)) {
        content.pipe(stream);
    } else if (Buffer.isBuffer(content)) {
        stream.end(content, "binary");
    } else {
        // This is to circumvent an issue with node-fetch returning empty response.text()
        // when emoji are used in the response
        stream.end(content, userAgent === NODE_FETCH_USER_AGENT ? "binary" : "utf-8");
    }

};

module.exports.contentText = async function (content) {

    if (typeof content === "string") {
        return content;
    }

    if (Buffer.isBuffer(content)) {
        return content.toString();
    }

    if (isStream(content)) {
        return await getStream(content);
    }

    return content;
};

