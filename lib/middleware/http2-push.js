const log = require("tiny-node-logger/index.js");
const http2 = require("http2");
const HttpStatus = require("http-status-codes");
const path = require("path");
const {memoize} = require("../utility/memoize.js");
const {toPosix} = require("../utility/quick-parse-url.js");
const {sendContent} = require("../utility/content-utils.js");

const {HTTP2_HEADER_PATH, NGHTTP2_REFUSED_STREAM} = http2.constants;

module.exports.useHttp2Push = memoize(config => {

    const serverPush = (stream, url, out) => new Promise(close => {
        const {
            content,
            headers
        } = out;

        stream.pushStream({[HTTP2_HEADER_PATH]: url}, (err, pushedStream) => {

            pushedStream.on("close", close);

            pushedStream.on("error", function (err) {
                if (pushedStream.rstCode === NGHTTP2_REFUSED_STREAM) {
                    log.warn("NGHTTP2_REFUSED_STREAM", url);
                } else if (err.code === "ERR_HTTP2_STREAM_ERROR") {
                    log.warn("ERR_HTTP2_STREAM_ERROR", pathname);
                } else {
                    log.error(err.code, url, err.message);
                }
            });

            const response = {
                ":status": HttpStatus.OK
            };

            if (headers) for (const name of Object.keys(headers)) {
                response[name.toLowerCase()] = headers[name];
            }

            pushedStream.respond(response);

            sendContent(pushedStream, content);
        });
    });

    function http2Push(stream, filename, links, pipeline) {
        if (stream) {
            const dirname = path.dirname(filename);
            for (let link of links) {

                const cc = link.charAt(0);
                const url = cc === "." ? "/" + toPosix(path.relative(config.rootDir, path.resolve(dirname, link))) : link;

                pipeline(url).then(out => {
                    if (out.error) {
                        log.warn("cannot push:", link, out.error);
                    } else if (!stream.pushAllowed) {
                        log.warn("cannot push:", link, "stream of:", filename, "won't allow");
                    } else {
                        log.debug("pushing:", out.filename);
                        return serverPush(stream, url, out);
                    }
                }).catch(error => {
                    log.warn("error pushing:", link, "from:", filename, error);
                });
            }
        }
    }

    return function middleware(context, next) {

        const {
            pathname,
            response,
            links
        } = context;

        if (config.http2 === "preload" && links) {
            context.header("link", [...links].map(function (src) {
                return `<${src}>; rel=preload; as=${src.endsWith(".css") ? "style" : "script"}`;
            }));
        }

        if (config.http2 === "push" && links) {
            http2Push(response.stream, pathname, links);
        }

        return next(context);
    }
});
