const sass = require("node-sass");
const path = require("path");
const resolve = require("resolve");
const fs = require("fs");

const log = require("tiny-node-logger");

const contentText = require("../utility/content-text");

const mime = require("mime-types");

module.exports.SASS_CONTENT_TYPE = "text/x-sass; charset=utf-8";
module.exports.SCSS_CONTENT_TYPE = "text/x-scss; charset=utf-8";

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

const TILDE_CHARCODE = '~'.charCodeAt(0);

function isBare(url) {
    return TILDE_CHARCODE === url.charCodeAt(0);
}

function isFile(file) {
    try {
        const stat = fs.statSync(file);
        return stat.isFile() || stat.isFIFO();
    } catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return false;
        throw e;
    }
}

module.exports.createSassTransformer = function (config, watcher) {

    const importCache = new Map();

    const extensions = ['.scss', '.css', '.sass'];

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
            const fragment = path.join(path.dirname(url), '_' + path.basename(url));
            return resolveSync(fragment, basedir);
        }
    }

    const cachingImporter = basefile => function (url, file, done) {

        const filename = file === "stdin" ? basefile : file;
        let basedir = path.resolve(config.rootDir, path.dirname(filename));

        if (url[0] === '@') {
            url = '~' + url;
            basedir = path.resolve(config.rootDir, 'node_modules');
        }

        if (isBare(url)) {
            if (!importCache.has(url)) {
                const filename = resolveBareImport(url, basedir);
                if (filename.endsWith(".css")) {
                    importCache.set(url, {
                        contents: fs.readFileSync(filename, 'utf-8')
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
                const fragment = path.join(path.dirname(relative), '_' + path.basename(relative));
                if (fs.existsSync(fragment)) {
                    return done({file: fragment});
                } else {
                    return done({contents: fs.readFileSync(relative.replace(ext, ".css"), 'utf-8')});
                }
            }
        }
    };


    const pendingTasks = new Map();

    async function transform(filename, content) {

        const pendingTask = pendingTasks.get(filename);
        if (pendingTask) {
            return (await pendingTask);
        }

        // todo: test scss source maps in browser

        const compileTask = new Promise(async (resolve, reject) => {
            sass.render({
                ...config.sass,
                data: await contentText(content),
                importer: cachingImporter(filename),
                outFile: filename + ".map",
                sourceMap: config.sass.sourceMaps,
                sourceMapEmbed: config.sass.sourceMaps
            }, function (error, result) {
                if (!error) {
                    resolve(result);
                } else {
                    logger.error("unable to transform sass file:", filename);
                    reject(error);
                }
            })
        });

        pendingTasks.set(filename, compileTask);
        try {
            return await compileTask;
        } finally {
            pendingTasks.delete(filename);
        }
    }

    function getFormat(query) {
        const item = query.split("&").find(item => item.startsWith("format"));
        return item ? item.split("=")[1] : ".css";
    }

    return async function sassTransformer({filename, content, format}) {

        const {css, map, stats} = await transform(filename, content);

        content = css.toString("utf-8");
        if (format === "mjs") {
            content = cssToEsm(content);
            return {
                content: content,
                contentLength: content.length,
                contentType: mime.contentType(format),
                links: stats.includedFiles
            }
        } else {
            return {
                content: content,
                contentLength: content.length,
                contentType: mime.contentType(".css"),
                links: stats.includedFiles
            }
        }

    }
};
