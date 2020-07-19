const log = require("tiny-node-logger");

const etag = require("etag");
const {memoize} = require("./util/memoize.js");
const {parse: parseURL} = require("fast-url-parser");
const {relative, resolve} = require("path");
const {toPosix} = require("./util/quick-parse-url.js");
const {useBabelTransformer} = require("./pipeline/babel-transformer.js");
const {useHtmlTransformer} = require("./pipeline/html-transformer.js");
const {useResourceCache} = require("./pipeline/resource-cache.js");
const {useSassTransformer} = require("./pipeline/sass-transformer.js");
const {useWorkspaceFiles} = require("./pipeline/workspace-files.js");

const {
    HTML_CONTENT_TYPE,
    SASS_CONTENT_TYPE,
    SCSS_CONTENT_TYPE,
    JAVASCRIPT_CONTENT_TYPE,
    TYPESCRIPT_CONTENT_TYPE
} = require("./util/mime-types.js");

module.exports.useResourceProvider = memoize(function (config, watcher) {

    const cache = config.cache && useResourceCache(config, watcher);

    const {readWorkspaceFile} = useWorkspaceFiles(config);
    const {htmlTransformer} = useHtmlTransformer(config);
    const {babelTransformer} = useBabelTransformer(config);
    const {sassTransformer} = useSassTransformer(config);

    async function provideResource(url) {

        if (cache && cache.has(url)) {
            log.debug("retrieved from cache:", url);
            return cache.get(url);
        }

        const transpile = !url.startsWith("/web_modules");

        const {
            pathname,
            query
        } = parseURL(url, true);

        let {
            filename,
            content,
            contentLength,
            contentType,
            lastModified,
            links,
            isModule
        } = await readWorkspaceFile(pathname);

        if (!isModule) {

            if (contentType === HTML_CONTENT_TYPE) {

                const out = await htmlTransformer(filename, content);
                content = out.content;
                contentType = out.contentType;
                contentLength = out.contentLength;
                links = out.links;

            } else if (contentType === SASS_CONTENT_TYPE || contentType === SCSS_CONTENT_TYPE) {

                const out = await sassTransformer(filename, content, query);
                content = out.content;
                contentType = out.contentType;
                contentLength = out.contentLength;
                links = out.links; // TODO: sure???

            } else if (contentType === JAVASCRIPT_CONTENT_TYPE || contentType === TYPESCRIPT_CONTENT_TYPE) {

                const out = await babelTransformer(filename, content);
                content = out.content;
                contentType = out.contentType;
                contentLength = out.contentLength;
                links = out.links;

            } else {
                content = await content;
            }

        } else {
            content = await content;
        }

        const headers = {
            "content-type": contentType,
            "content-length": contentLength,
            "last-modified": lastModified.toUTCString(),
            "etag": etag(`${filename} ${contentLength} ${lastModified}`, config.etag),
            "cache-control": isModule ? "public, max-age=86400, immutable" : "no-cache"
        };

        const resource = {
            pathname,
            query,
            filename,
            content,
            headers,
            links
        };

        if (cache) {
            cache.set(url, resource);
        }

        return resource;
    }

    return {
        provideResource
    }
});

