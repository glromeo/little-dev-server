const log = require("tiny-node-logger");
const http2 = require("http2");
const HttpStatus = require("http-status-codes");
const path = require("path");
const {quickParseURL} = require("./quick-parse-url.js");
const {sendContent} = require("./content-utils.js");
const {FullStop} = require("../utility/char-codes.js");

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

module.exports.http2Push = function (stream, filename, links, pipeline) {
    if (stream) {
        const dirname = path.dirname(filename);
        for (let link of links) {
            const cc = link.charCodeAt(0);
            if (cc === FullStop) {
                link = path.resolve(dirname, link);
            }
            const url = quickParseURL(link);
            pipeline(url).then(out => {
                if (out.error) {
                    log.warn("cannot push:", link, out.error);
                } else if (!stream.pushAllowed) {
                    log.warn("cannot push:", link, "stream won't allow");
                } else {
                    log.debug("pushing:", out.filename);
                    try {
                        return serverPush(stream, url, out);
                    } catch (error) {
                        log.error(error.code, error.filename);
                    }
                }
            }).catch(error => {
                log.warn("cannot push:", link, error);
            });
        }
    }
}
