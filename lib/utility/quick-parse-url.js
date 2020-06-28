const {sep} = require("path");
const {Slash, FullStop, AtSign} = require("./char-codes.js");

const urlRegex = /(^(?<scheme>\w+):\/\/(?<domain>[^/?#]+))?((?<module>(@[\w-]+\/)?[^._/?#][^:/?#]*)(\/|$))?(?<pathname>[^?#]+)?(\?(?<search>[^#]+))?(#(?<fragment>.*))?/;

module.exports.quickParseURL = function (url = ".") {

    let match = urlRegex.exec(url);
    if (!match) {
        match = {};
    }

    const groups = match.groups;

    groups.href = url;

    let query;

    if (groups.search) Object.defineProperty(groups, "query", {
        get() {
            if (query === undefined) {
                query = {};
                for (const pair of this.search.split("&")) {
                    const [key, value] = pair.split('=');
                    query[decodeURIComponent(key)] = decodeURIComponent(value);
                }
            }
            return query;
        }
    });

    return groups;
}

module.exports.isBare = function (url) {
    let cc = url.charCodeAt(0);
    if (cc === Slash) return false;
    if (cc === FullStop) {
        if (url.length === 1) return false;
        cc = url.charCodeAt(1);
        if (cc === Slash) return false;
        if (cc === FullStop) {
            if (url.length === 2) return false;
            cc = url.charCodeAt(2);
            if (cc === Slash) return false;
        }
    }
    return true;
};

function nodeModulesRelativePath(filename) {
    const index = filename.lastIndexOf("/node_modules/");
    return index !== -1 ? filename.substring(index + 14) : filename;
}

const windowsSepRegex = /\\/g;

module.exports.nodeModuleBareUrl = sep === '/'
    ? nodeModulesRelativePath
    : filename => nodeModulesRelativePath(filename.replace(windowsSepRegex, '/'));


module.exports.splitModulePathname = pathname => {
    const sep = pathname.charCodeAt(0) === AtSign ? pathname.indexOf('/', pathname.indexOf('/', 1) + 1) : pathname.indexOf('/', 1);
    let module = pathname.substring(0, sep);
    let filename = pathname.substring(sep + 1);
    if (!module) {
        module = filename;
        filename = undefined;
    }
    return [module, filename];
}

module.exports.toPosix = sep === '/'
    ? pathname => pathname
    : pathname => pathname.replace(/\\/g, '/')

module.exports.posixDirname = filename => {
    const slashIndex = filename.lastIndexOf('/');
    return slashIndex !== -1 ? filename.substring(0, slashIndex) : filename;
}