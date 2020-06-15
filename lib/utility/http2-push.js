const http2 = require("http2");
const HttpStatus = require("http-status-codes");
const {parse: parseURL} = require("url");
const path = require("path");
const {sendContent} = require("./send-content.js");
const {FullStop} = require("../utility/char-codes.js");
const log = require("tiny-node-logger");

module.exports.createHttp2Push = function (config) {

    const {HTTP2_HEADER_PATH, NGHTTP2_REFUSED_STREAM} = http2.constants;

    const serverPush = (stream, url, out) => new Promise(close => {
        const {
            content,
            headers
        } = out;

        stream.pushStream({[HTTP2_HEADER_PATH]: url.pathname}, (err, pushedStream) => {

            pushedStream.on("close", close);

            pushedStream.on('error', function (err) {
                if (pushedStream.rstCode === NGHTTP2_REFUSED_STREAM) {
                    log.warn("NGHTTP2_REFUSED_STREAM", url.pathname);
                } else if (err.code === 'ERR_HTTP2_STREAM_ERROR') {
                    log.warn("ERR_HTTP2_STREAM_ERROR", pathname);
                } else {
                    log.error(err.code, pathname, err.message);
                }
            });

            const response = {
                ':status': HttpStatus.OK
            };

            if (headers) for (const name of Object.keys(headers)) {
                response[name.toLowerCase()] = headers[name];
            }

            pushedStream.respond(response);

            sendContent(pushedStream, content);
        })
    });

    return function (stream, filename, links, pipeline) {
        if (stream) {
            const dirname = path.dirname(filename);
            return Promise.all([...links].map(async (link) => {
                const cc = link.charCodeAt(0);
                if (cc === FullStop) {
                    link = path.resolve(dirname, link);
                }
                const url = parseURL(path.resolve("/", path.relative(config.rootDir, link)));
                const out = await pipeline(url);
                if (out.error || !stream.pushAllowed) {
                    log.debug("can't push:", out.filename);
                } else {
                    log.debug("pushing:", out.filename);
                    try {
                        return serverPush(stream, url, out);
                    } catch (error) {
                        log.error(error.code, error.filename);
                    }
                }
            }));
        }
    }
};
