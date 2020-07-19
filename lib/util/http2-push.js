const log = require("tiny-node-logger");
const {memoize} = require("../util/memoize.js");
const http2 = require("http2");
const HttpStatus = require("http-status-codes");
const path = require("path");
const {useResourceProvider} = require("../resource-provider.js");
const {toPosix} = require("../util/quick-parse-url.js");

const {HTTP2_HEADER_PATH, NGHTTP2_REFUSED_STREAM} = http2.constants;

module.exports.useHttp2Push = memoize((config, watcher) => {

    const {provideResource} = useResourceProvider(config, watcher);

    const serverPush = (stream, url) => new Promise(async (resolve, reject) => {
        try {
            const {
                content,
                headers
            } = await provideResource(url);

            stream.pushStream({[HTTP2_HEADER_PATH]: url}, function (err, push) {
                if (err) {
                    reject(err);
                } else {
                    push.on("close", resolve);

                    push.on("error", function (err) {
                        if (push.rstCode === NGHTTP2_REFUSED_STREAM) {
                            log.warn("NGHTTP2_REFUSED_STREAM", url);
                        } else if (err.code === "ERR_HTTP2_STREAM_ERROR") {
                            log.warn("ERR_HTTP2_STREAM_ERROR", pathname);
                        } else {
                            log.error(err.code, url, err.message);
                        }
                    });

                    const response = {
                        ":status": HttpStatus.OK,
                    };

                    if (headers) for (const name of Object.keys(headers)) {
                        response[name.toLowerCase()] = headers[name];
                    }

                    push.respond(response);
                    push.end(content);
                }
            });

        } catch (error) {
            reject(error);
        }
    });

    function resolveURL(dirname, url) {
        return "/" + toPosix(path.resolve(config.rootDir, path.resolve(dirname, url)));
    }

    async function http2Push(stream, pathname, links) {
        if (stream) {
            const dirname = path.posix.dirname(pathname);
            for (let link of links) {
                const url = link.charAt(0) === "/" ? link : resolveURL(dirname, link);
                if (stream.pushAllowed) {
                    await serverPush(stream, url).catch(error => {
                        log.warn("error pushing:", link, "from:", pathname, error);
                    });
                } else {
                    log.warn("cannot push:", link, "stream of:", pathname, "won't allow");
                }
            }
        }
    }

    return {
        http2Push
    }
})
