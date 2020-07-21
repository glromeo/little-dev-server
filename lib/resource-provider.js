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

    function formatHrtime(hrtime) {
        return (hrtime[0] + (hrtime[1] / 1e9)).toFixed(3);
    }

    const pendingTasks = new Map();

    function transformResource(contentType, filename, content, query) {
        let task = pendingTasks.get(filename);
        if (task === undefined) {
            switch (contentType) {
                case HTML_CONTENT_TYPE:
                    task = htmlTransformer(filename, content);
                    break;
                case SASS_CONTENT_TYPE:
                case SCSS_CONTENT_TYPE:
                    task = sassTransformer(filename, content, query);
                    break;
                case JAVASCRIPT_CONTENT_TYPE:
                case TYPESCRIPT_CONTENT_TYPE:
                    task = babelTransformer(filename, content);
                    break;
            }
            if (task !== undefined) {
                task = task.finally(out => {
                    pendingTasks.delete(filename);
                    return out;
                });
                pendingTasks.set(filename, task);
            }
        }
        return task;
    }

    async function provideResource(url) {

        if (cache && cache.has(url)) {
            log.debug("retrieved from cache:", url);
            return cache.get(url);
        }

        const {
            pathname,
            query
        } = parseURL(url, true);

        let {
            filename,
            content,
            headers,
            links
        } = await readWorkspaceFile(pathname);

        if (headers["cache-control"] === "no-cache") {
            const hrtime = process.hrtime();
            const transformed = await transformResource(headers["content-type"], filename, content, query);
            if (transformed) {
                content = transformed.content;
                headers["content-type"] = transformed.headers["content-type"];
                headers["content-length"] = transformed.headers["content-length"];
                headers["x-transformer"] = transformed.headers["x-transformer"];
                headers["x-transform-duration"] = `${formatHrtime(process.hrtime(hrtime))}sec`;
                links = transformed.links;
            }
        }

        headers["etag"] = etag(`${pathname} ${headers["content-length"]} ${headers["last-modified"]}`, config.etag);

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
    };
})
;

