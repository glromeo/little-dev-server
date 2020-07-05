const isStream = stream =>
    stream !== null &&
    typeof stream === 'object' &&
    typeof stream.pipe === 'function';

isStream.writable = stream =>
    isStream(stream) &&
    stream.writable !== false &&
    typeof stream._write === 'function' &&
    typeof stream._writableState === 'object';

isStream.readable = stream =>
    isStream(stream) &&
    stream.readable !== false &&
    typeof stream._read === 'function' &&
    typeof stream._readableState === 'object';

isStream.duplex = stream =>
    isStream.writable(stream) &&
    isStream.readable(stream);

isStream.transform = stream =>
    isStream.duplex(stream) &&
    typeof stream._transform === 'function' &&
    typeof stream._transformState === 'object';

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

module.exports.contentText = function (content) {

    if (typeof content === "string") {
        return content;
    }

    if (Buffer.isBuffer(content)) {
        return content.toString();
    }

    if (isStream(content)) {
        return new Promise(function (resolve, reject) {
            let text = "";
            content.on("data", function (chunk) {
                text += chunk;
            });
            content.on("end", function () {
                resolve(text);
            });
            content.on("error", reject);
        });
    }

    return content;
};

