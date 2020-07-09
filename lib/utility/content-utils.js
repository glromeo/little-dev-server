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

function isStream(stream) {
    return stream !== null && typeof stream === "object" && typeof stream.pipe === "function";
}

module.exports.contentText = function (content) {

    if (typeof content === "string") {
        return content;
    }

    if (isStream(content)) {
        return new Promise(function (resolve, reject) {
            let text = "";
            content.setEncoding("utf8");
            content.on("data", function (chunk) {
                text += chunk;
            });
            content.on("end", function () {
                resolve(text);
            });
            content.on("error", reject);
        });
    }

    if (Buffer.isBuffer(content)) {
        return content.toString();
    }

    return "";
};

module.exports.EMPTY_OBJECT = Object.freeze(Object.create(null));
