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

    function transformResource(contentType, filename, content, query) {
        if (contentType === HTML_CONTENT_TYPE) {
            return htmlTransformer(filename, content);
        } else if (contentType === SASS_CONTENT_TYPE || contentType === SCSS_CONTENT_TYPE) {
            return sassTransformer(filename, content, query);
        } else if (contentType === JAVASCRIPT_CONTENT_TYPE || contentType === TYPESCRIPT_CONTENT_TYPE) {
            return babelTransformer(filename, content);
        }
    }

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
            headers,
            links,
            isModule
        } = await readWorkspaceFile(pathname);

        const output = !isModule && await transformResource(headers["content-type"], filename, content, query);
        if (output) {
            content = output.content;
            headers["content-type"] = output.headers["content-type"];
            headers["content-length"] = output.headers["content-length"];
            links = output.links;
        }

        headers["etag"] = etag(`${filename} ${headers["content-length"]} ${headers["last-modified"]}`, config.etag);
        headers["cache-control"] = isModule ? "public, max-age=86400, immutable" : "no-cache";

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

