const {sep} = require("path");
const {EMPTY_OBJECT} = require("./content-utils.js");

const urlRegExp = /(^(?<scheme>\w+):\/\/(?<domain>[^/?#]+)?)?((?<module>(@[\w-]+\/)?[^._/?#][^:/?#]*)(\/|$))?(?<pathname>[^?#]+)?(\?(?<search>[^#]+))?(#(?<fragment>.*))?/;

module.exports.quickParseURL = function (url) {

    let match = urlRegExp.exec(url);
    if (!match) {
        match = {};
    }

    const {
        scheme,
        domain,
        module,
        pathname,
        search,
        fragment
    } = match.groups;

    return {
        href: url,
        scheme,
        domain,
        module,
        pathname,
        search,
        fragment
    };
};

const simpleUrlRegExp = /(?<pathname>\/[^?#]*)?(\?(?<search>[^#]+))?(#(?<fragment>.*))?/;

module.exports.quickParseSimpleURL = function (url, from) {
    return simpleUrlRegExp.exec(from ? url.substring(from) : url).groups;
};


module.exports.isBare = function (url) {
    let cc = url.charAt(0);
    if (cc === "/") return false;
    if (cc === ".") {
        if (url.length === 1) return false;
        cc = url.charAt(1);
        if (cc === "/") return false;
        if (cc === ".") {
            if (url.length === 2) return false;
            cc = url.charAt(2);
            if (cc === "/") return false;
        }
    }
    return true;
};

function nodeModulesRelativePath(filename) {
    const index = filename.lastIndexOf("/node_modules/");
    return index !== -1 ? filename.substring(index + 14) : filename;
}

const backslashRegExp = /\\/g;

module.exports.nodeModuleBareUrl = sep === "/"
    ? nodeModulesRelativePath
    : filename => nodeModulesRelativePath(filename.replace(backslashRegExp, "/"));


module.exports.splitModulePathname = pathname => {
    const sep = pathname.charAt(0) === "@" ? pathname.indexOf("/", pathname.indexOf("/", 1) + 1) : pathname.indexOf("/", 1);
    let module = pathname.substring(0, sep);
    let filename = pathname.substring(sep + 1);
    if (!module) {
        module = filename;
        filename = undefined;
    }
    return [module, filename];
};

module.exports.toPosix = sep === "/"
    ? pathname => pathname
    : pathname => pathname.replace(/\\/g, "/");

module.exports.posixBasedir = (basedir, filename) => {
    const absolute = path.resolve(basedir, path.dirname(filename));
    const relative = path.relative(absolute);
    return "/" + toPosix(relative);
};
