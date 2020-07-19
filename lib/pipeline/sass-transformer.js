const log = require("tiny-node-logger");
const {memoize, once} = require("../util/memoize.js");

const sass = require("node-sass");
const path = require("path");
const resolve = require("resolve");

const fs = require("fs");

const {
    JAVASCRIPT_CONTENT_TYPE,
    CSS_CONTENT_TYPE
} = require("../util/mime-types.js");

const cssToEsm = css => `
import {css} from "/web_modules/lit-element/lit-element.js";
export const cssResult = css\`
    ${css.replace(/`/g, "\\`")}
\`;
if (!cssResult.cssText) {
    throw new Error("css text is undefined, this is most likely due to an error in the sass source file.");
}
export default cssResult;
`;

function isFile(file) {
    try {
        const stat = fs.statSync(file);
        return stat.isFile() || stat.isFIFO();
    } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return false;
        throw e;
    }
}

module.exports.useSassTransformer = memoize(config => {

    const importCache = new Map();

    const extensions = [".scss", ".css", ".sass"];

    function resolveSync(fragment, basedir) {
        return resolve.sync(fragment, {
            basedir: basedir,
            extensions: extensions,
            isFile: isFile,
            moduleDirectory: config.nodeModules,
            preserveSymlinks: false
        });
    }

    function resolveBareImport(url, basedir) {
        url = url.substring(1);
        try {
            return resolveSync(url, basedir);
        } catch (e) {
            const fragment = path.join(path.dirname(url), "_" + path.basename(url));
            return resolveSync(fragment, basedir);
        }
    }

    const cachingImporter = basefile => function (url, file, done) {

        const filename = file === "stdin" ? basefile : file;
        let basedir = path.resolve(config.rootDir, path.dirname(filename));

        if (url[0] === "@") {
            url = "~" + url;
            basedir = path.resolve(config.rootDir, "node_modules");
        }

        if (url.charAt(0) === "~") {
            if (!importCache.has(url)) {
                const filename = resolveBareImport(url, basedir);
                if (filename.endsWith(".css")) {
                    importCache.set(url, {
                        contents: fs.readFileSync(filename, "utf-8")
                    });
                } else {
                    importCache.set(url, {
                        file: filename
                    });
                }
            }
            return done(importCache.get(url));
        } else {
            let ext = path.extname(url);
            let basename = path.basename(url, ext);
            ext = ext || path.extname(filename);
            let relative = path.resolve(
                basedir,
                path.dirname(url),
                basename + ext
            );
            if (fs.existsSync(relative)) {
                return done({file: relative});
            } else {
                const fragment = path.join(path.dirname(relative), "_" + path.basename(relative));
                if (fs.existsSync(fragment)) {
                    return done({file: fragment});
                } else {
                    return done({contents: fs.readFileSync(relative.replace(ext, ".css"), "utf-8")});
                }
            }
        }
    };

    function getFormat(query) {
        const item = query.split("&").find(item => item.startsWith("format"));
        return item ? item.split("=")[1] : ".css";
    }

    const sassTransformer = once(async function sassTransformer(filename, content, query) {

        // todo: test scss source maps in browser

        const {css, map, stats} = await new Promise(async (resolve, reject) => {
            sass.render({
                ...config.sass,
                data: content,
                importer: cachingImporter(filename),
                outFile: filename + ".map",
                sourceMap: config.sass.sourceMaps,
                sourceMapEmbed: config.sass.sourceMaps
            }, function (error, result) {
                if (!error) {
                    resolve(result);
                } else {
                    log.error("unable to transform sass file:", filename);
                    reject(error);
                }
            });
        });

        const imports = new Set(stats.includedFiles.filter(f => f));

        content = css.toString("utf-8");
        if (query !== undefined && query.type === "module") {
            content = cssToEsm(content);
            return {
                content: content,
                contentLength: content.length,
                contentType: JAVASCRIPT_CONTENT_TYPE,
                links: imports
            };
        } else {
            return {
                content: content,
                headers: {
                    "content-type": CSS_CONTENT_TYPE,
                    "content-length": Buffer.byteLength(content)
                },
                links: imports
            };
        }
    });

    return {
        sassTransformer
    };
});
