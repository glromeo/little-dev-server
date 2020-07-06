const {useStaticFileStreamer} = require("./pipeline/static-file-streamer.js");
const {useHtmlTransformer} = require("./pipeline/html-transformer.js");
const {useBabelTransformer} = require("./pipeline/babel-transformer.js");
const {useSassTransformer} = require("./pipeline/sass-transformer.js");
const {createWebModuleRouter} = require("./pipeline/web-module-router.js");
const {relative, resolve} = require("path");

const {
    HTML_CONTENT_TYPE,
    SASS_CONTENT_TYPE,
    SCSS_CONTENT_TYPE,
    JAVASCRIPT_CONTENT_TYPE,
    TYPESCRIPT_CONTENT_TYPE
} = require("./utility/mime-types.js");

const etag = require("etag");

const log = require("tiny-node-logger");
const {toPosix} = require("./utility/quick-parse-url.js");

module.exports.createPipeline = function (config, watcher) {

    const cache = config.cache && new Map();
    const watched = new Map();

    function watch(filename, url) {
        watched.set(filename, url);
        watcher.add(filename);
    }

    watcher.on("all", function (event, path) {
        log.info(event, path);
        if (event === "change" || event === "unlink") {
            const key = resolve(config.rootDir, path);
            const url = watched.get(key);
            if (url) {
                cache.delete(url);
                watched.delete(key);
            }
        }
    });

    const {streamStaticFile} = useStaticFileStreamer(config);
    const {htmlTransformer} = useHtmlTransformer(config);
    const {babelTransformer} = useBabelTransformer(config);
    const {sassTransformer} = useSassTransformer(config);

    const zlib = require("zlib");
    const util = require("util");
    const deflate = util.promisify(zlib.deflate);

    return async function pipeline(url, query) {

        if (cache && cache.has(url)) {
            log.debug("retrieved from cache:", url);
            return cache.get(url);
        }

        let {
            transpile = true,
            query,
            filename,
            stats
        } = this;

        let {
            content,
            contentType,
            lastModified,
            contentLength,
            links
        } = await streamStaticFile(filename);

        let cacheable = false;

        if (transpile) {

            if (contentType === HTML_CONTENT_TYPE) {

                const out = await htmlTransformer(filename, content);
                content = out.content;
                contentLength = out.contentLength;
                links = out.links;
                cacheable = true;

            } else if (contentType === SASS_CONTENT_TYPE || contentType === SCSS_CONTENT_TYPE) {

                const out = await sassTransformer(filename, content, query);
                content = out.content;
                contentLength = out.contentLength;
                contentType = out.contentType;
                links = out.links; // TODO: sure???
                cacheable = true;

            } else if (contentType === JAVASCRIPT_CONTENT_TYPE || contentType === TYPESCRIPT_CONTENT_TYPE) {

                const out = await babelTransformer(filename, content);
                content = out.content;
                contentLength = out.contentLength;
                contentType = out.contentType;
                links = out.links;
                cacheable = true;
            }
        }

        if (cacheable) {
            content = await deflate(content);
            contentLength = content.length;
        }

        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
            "Access-Control-Allow-Headers": "X-Requested-With,content-type",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": contentType,
            "Content-Length": contentLength,
            "ETag": etag(JSON.stringify([
                toPosix(relative(config.rootDir, filename)),
                contentLength,
                lastModified
            ]), config.etag),
            "Last-Modified": lastModified
        };

        if (cacheable) {

            headers["Content-Encoding"] = "deflate";

            if (transpile) {

                watch(filename, url);

                if (links) for (const link of links) {
                    watch(link, url);
                }

            } else {
                headers["Cache-Control"] = "public, max-age=86400, immutable";
            }

            if (cache) cache.set(url, {
                filename,
                content,
                headers,
                links
            });

        } else {
            headers["Cache-Control"] = "public, max-age=86400, immutable";
        }

        return {
            filename,
            content,
            headers,
            links,
            etag: etag(JSON.stringify([
                toPosix(pathname),
                contentLength,
                lastModified
            ]), config.etag)
        };
    };
};

