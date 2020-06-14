const {createRouter} = require("./pipeline/router.js");
const {createStaticFileStreamer} = require("./pipeline/static-file-streamer.js");
const {createHtmlTransformer, HTML_CONTENT_TYPE} = require("./pipeline/html-transformer.js");
const {createBabelTransformer, JAVASCRIPT_CONTENT_TYPE, TYPESCRIPT_CONTENT_TYPE} = require("./pipeline/babel-transformer.js");
const {createSassTransformer, SCSS_CONTENT_TYPE} = require("./pipeline/sass-transformer.js");
const {createWebModuleRouter} = require("./pipeline/web-module-router.js")
const {resolve} = require("path");

const etag = require("etag");

const log = require("tiny-node-logger");

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

    const {routes, route} = createRouter(config);

    routes.set("/web_modules", createWebModuleRouter(config));

    const staticFileStreamer = createStaticFileStreamer(config);
    const htmlTransformer = createHtmlTransformer(config);
    const babelTransformer = createBabelTransformer(config);
    const sassTransformer = createSassTransformer(config);

    const zlib = require("zlib");
    const util = require("util");
    const deflate = util.promisify(zlib.deflate);

    return async function pipeline(url) {

        if (cache && cache.has(url)) {
            return cache.get(url);
        }

        let {
            filename,
            stats,
            isWebModule
        } = await route(url);

        let {
            content,
            contentType,
            lastModified,
            contentLength,
            links
        } = await staticFileStreamer({filename, stats});

        let cacheable = false;

        if (!isWebModule) {

            if (contentType === HTML_CONTENT_TYPE) {
                const out = await htmlTransformer({filename, content});
                content = out.content;
                contentLength = out.contentLength;
                links = out.links;
                cacheable = true;
            }

            if (contentType === SCSS_CONTENT_TYPE) {
                const out = await sassTransformer({filename, content, format: url.query?.format});
                content = out.content;
                contentLength = out.contentLength;
                contentType = out.contentType;
                links = out.links; // TODO: sure???
                cacheable = true;
            }

            if (contentType === JAVASCRIPT_CONTENT_TYPE || contentType === TYPESCRIPT_CONTENT_TYPE) {
                const out = await babelTransformer({filename, content});
                content = out.content;
                contentLength = out.contentLength;
                contentType = out.contentType;
                links = out.links;
                cacheable = true;
            }
        }

        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
            'Access-Control-Allow-Headers': 'X-Requested-With,content-type',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': contentType,
            'Content-Length': contentLength,
            'ETag': etag(JSON.stringify([
                filename,
                contentLength,
                lastModified
            ]), config.etag),
            'Last-Modified': lastModified,
        };

        if (cacheable) {

            // out.content = await deflate(out.content);
            // out.contentEncoding = "deflate";
            // out.contentLength = out.content.length;
            //
            // res.write(buffer, 'binary')

            if (cache) cache.set(url, {
                filename,
                content,
                headers,
                links
            });

            if (!isWebModule) {

                watch(filename, url);

                if (links) for (const link of links) {
                    watch(link, url)
                }

            } else {
                headers['Cache-Control'] = "public, max-age=86400, immutable";
            }
        } else {
            headers['Cache-Control'] = "public, max-age=86400, immutable";
        }

        return {
            filename,
            content,
            headers,
            links
        }
    }
}

