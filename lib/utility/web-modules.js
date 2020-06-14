const {FullStop, Slash, AtSign} = require("../utility/char-codes.js");

function isRewriteRequired(importUrl) {
    const cc = importUrl.charCodeAt(0);
    if (cc === FullStop || cc === Slash) {
        const notExt = importUrl.lastIndexOf('.') === -1;
        return notExt;
    }
    const notUrl = importUrl.indexOf('://') === -1;
    return notUrl;
}

function splitModuleUrl(url) {
    const sep = url.charCodeAt(0) === AtSign ? url.indexOf('/', url.indexOf('/', 1) + 1) : url.indexOf('/', 1);
    let module = url.substring(0, sep);
    let filename = url.substring(sep + 1);
    if (!module) {
        module = filename;
        filename = undefined;
    }
    return [module, filename];
}

const sepRegex = /\\/g;
function nodeBasename(filename) {
    return filename.substring(filename.lastIndexOf("node_modules") + 13).replace(sepRegex, '/');
}

const {resolve} = require("path");

function resolveUrl(base, relativeUrl) {
    return resolve(base, relativeUrl).replace(sepRegex, '/');
}

function stripExt(main) {
    const ext = main.lastIndexOf('.');
    return ext > 0 ? main.substring(0, ext) : main;
}

module.exports = {
    stripExt,
    splitModuleUrl,
    nodeBasename,
    resolveUrl,
    isRewriteRequired,
}
