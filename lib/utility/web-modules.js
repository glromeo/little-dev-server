const log = require("tiny-node-logger");

const {config} = require("../configuration.js");

const {existsSync, mkdirSync, rmdirSync, promises: fs} = require("fs");
const {sep, posix} = require("path");
const {promisify} = require("util");
const resolveAsync = promisify(require("resolve"));
const rollup = require("rollup");
const pluginNodeResolve = require("@rollup/plugin-node-resolve").default;
const pluginCommonjs = require("@rollup/plugin-commonjs");
const pluginSourcemaps = require("rollup-plugin-sourcemaps");

const {Slash, FullStop, AtSign, Colon} = require("./char-codes.js");

const modules = new Map();

const rollupPlugins = [];

config.updated = function () {

    if (config.clean) {
        rmdirSync(config.webModules, {recursive: true});
        log.info("cleaned web_modules direcotry");
    }
    mkdirSync(config.webModules, {recursive: true});

    modules.clear();

    rollupPlugins.length = 0;
    rollupPlugins.push(
        pluginNodeResolve({
            customResolveOptions: config.customResolveOptions
        }),
        pluginCommonjs(),
        pluginSourcemaps()
    );
}

const nodeModulesRelativePath = filename => filename.substring(filename.lastIndexOf("/node_modules/") + 14);
const windowsSepRegex = /\\/g;

const nodeModuleBareUrl = sep === '/'
    ? nodeModulesRelativePath
    : filename => nodeModulesRelativePath(filename.replace(windowsSepRegex, '/'));


function stripExt(filename) {
    const ext = filename.lastIndexOf('.');
    return ext > 0 ? filename.substring(0, ext) : filename;
}

function isRewriteRequired(path) {
    let cc = path.charCodeAt(0);
    if (cc === Slash) {
        return path.lastIndexOf('.') <= 0;
    } else if (cc === FullStop) {
        cc = path.charCodeAt(1);
        if (cc === Slash) {
            return !(path.lastIndexOf('.') > 0);
        } else if (cc === FullStop) {

        }
        return path.charCodeAt(1) !== Slash || !(path.lastIndexOf('.') > 0);
    }
    return true;
}

const urlRegex = /((?<scheme>\w+):\/\/)?(?<domain>(@\w+\/)?[^/?]+)?(?<filename>\/[^?]*)\??(?<search>.*)?/;
const filenameRegex = /(?<filename>([^])*[.]?[.]?[^.]+(?<ext>\.[^.]+$)?)/;

function parseURL(url = ".") {

    const match = url.charCodeAt(0) === FullStop ? filenameRegex.exec(url) : urlRegex.exec(url);
    if (!match) {
        return {};
    }

    let {
        scheme,
        domain,
        filename,
        search
    } = match.groups;

    if (filename === undefined && domain !== undefined && domain.charCodeAt(0) !== AtSign) {
        let pos = domain.lastIndexOf("?");
        if (pos === -1) {
            filename = domain;
        } else if (pos === 0) {
            search = domain;
        } else {
            filename = domain.substr(0, pos);
            search = domain.substr(pos + 1);
        }
        domain = undefined;
    }

    return {
        scheme,
        domain,
        filename,
        search
    };
}

async function rewriteImport(base, url) {

    let {
        scheme,
        domain,
        filename,
        search
    } = parseURL(url);

    if (scheme !== undefined) {
        return url;
    }

    if (domain === undefined) {
        if (filename?.charCodeAt(0) !== Slash) filename = posix.resolve(base, filename);
    } else {
        return posix.resolve(base, url);
    }

    const webPkg = await resolveWebModule(module);
    return `/web_modules/${name}/${path ? await webPkg.resolve(path) : webPkg.main}`;
}


function resolvePackageJson(module) {
    const filename = posix.join(module, "package.json");
    return resolveAsync(filename, config.customResolveOptions);
}

async function readWebPackageFile(name) {
    const text = await fs.readFile(posix.resolve(config.webModules, name, "webpackage.json"), "UTF-8");
    return JSON.parse(text);
}

async function writeWebPackageFile(name, webPkg) {
    const filename = posix.resolve(config.webModules, name, "webpackage.json");
    const text = JSON.stringify(webPkg, undefined, "  ");
    try {
        await fs.mkdir(posix.dirname(filename), {recursive: true});
        await fs.writeFile(filename, text);
    } catch (e) {
        log.error("unable to write web package:", filename, e);
    }
}

function finalizeWebPackage(webPkg) {
    return Object.freeze({
        ...(webPkg),
        bundle: new Set(webPkg.bundle),
        files: new Map(),
        resolve: async function (barename) {

            if (!barename) {
                if (this.main) {
                    barename = this.main;
                } else {
                    throw new Error("web package doesn't have a main file");
                }
            }

            if (this.bundle.has(barename)) {
                return this.main || barename;
            }

            if (barename.lastIndexOf('.') === -1) {
                const tentative = barename + ".mjs";
                barename = existsSync(posix.resolve(this.origin, tentative)) ? tentative : barename + ".js";
            }

            if (!this.files.has(barename)) {
                this.files.set(barename, new Promise(async (resolve, reject) => {
                    try {
                        log.info("web_module:", this.name, "resolving:", barename);

                        const {filename} = await bundleWebModule(
                            this.name,
                            barename,
                            posix.join(this.origin, barename)
                        );
                        resolve(filename);
                    } catch (e) {
                        reject(e);
                    }
                }));
            }

            return await this.files.get(barename);
        }
    });
}

function useModulesCache(fn) {
    return async function (name) {
        let webPkg = modules.get(name);
        if (webPkg === undefined) {
            modules.set(name, webPkg = fn(name));
            modules.set(name, webPkg = await webPkg);
        }
        return await webPkg;
    };
}

const resolveWebModule = useModulesCache(async function (name) {

    log.info("resolveWebModule:", name);

    try {
        const webPkg = await readWebPackageFile(name);
        return finalizeWebPackage(webPkg);
    } catch (ignored) {
        log.info(posix.resolve(config.webModules, name, "webpackage.json"), "not found, bundling it!");
    }

    const filename = await resolvePackageJson(name);
    const pkg = require(filename);
    const origin = posix.dirname(filename);
    const main = pkg.module || pkg['jsnext:main'] || pkg.main;
    const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];

    for (const dependency of dependencies) {
        await resolveWebModule(dependency);
    }

    const webPkg = {
        name,
        main: main?.charAt(0) === "." ? main.substring(2) : main,
        origin,
        dependencies,
        bundle: [],
    }

    if (main) {
        const {imports} = await bundleWebModule(name, main, posix.join(origin, main));
        webPkg.bundle = imports;

        const stats = await fs.stat(posix.join(config.webModules, name, webPkg.main));
        webPkg.stats = {
            size: stats.size,
            atime: stats.atime.toUTCString(),
            mtime: stats.mtime.toUTCString(),
            ctime: stats.ctime.toUTCString(),
            birthtime: stats.birthtime.toUTCString(),
        }

    } else {

        webPkg.bundle = [];
        webPkg.stats = {
            size: 0,
            atime: new Date().toUTCString(),
            mtime: new Date().toUTCString(),
            ctime: new Date().toUTCString(),
            birthtime: new Date().toUTCString(),
        };
    }

    await writeWebPackageFile(name, webPkg);
    return finalizeWebPackage(webPkg);
});

async function bundleWebModule(name, target, source) {

    if (!posix.extname(target)) {
        throw new Error("target is missing ex: " + target);
    }

    const web_module = posix.join(config.webModules, name, target);

    const bundle = await rollup.rollup({
        input: source,
        plugins: [{
            name: "rollup-plugin-all-external",
            resolveId(source, base) {
                if (source.charCodeAt(0) === 0) {
                    return null;
                }
                if (base) {
                    if (base.charCodeAt(0) === 0) {
                        return null
                    }
                    if (source.charCodeAt(0) === FullStop) {
                        const absolutePath = posix.resolve(posix.dirname(base), source);
                        const bare = nodeModuleBareUrl(absolutePath);
                        const [name, file] = parseModuleUrl(bare);
                        const webPkg = modules.get(name);
                        if (webPkg && webPkg.main) {
                            if (webPkg.bundle.has(file)) {
                                return {id: `\0web_modules/${name}/${webPkg.main}`, external: true};
                            } else {
                                return {id: `\0web_modules/${bare}`, external: true};
                            }
                        }
                    } else {
                        if (!source.startsWith(name)) {
                            return {id: `\0web_modules/${source}`, external: true}
                        }
                    }
                }
                return null;
            }
        }, ...rollupPlugins]
    });

    const exportNamedDeclarations = new Map();
    const exportAllDeclarations = new Set();
    const cachedModules = new Map();
    for (const module of bundle.cache.modules) {

        const moduleUrl = nodeModuleBareUrl(module.id);
        cachedModules.set(moduleUrl, module);

        for (const s of module.ast.body) if (s.type === "ExportAllDeclaration") {
            let from = s.source.value;
            if (from.charCodeAt(0) === FullStop) {
                from = nodeModuleBareUrl(posix.resolve(posix.dirname(module.id), from));
            }
            exportAllDeclarations.add(from);
        }
        for (const s of module.ast.body) if (s.type === "ExportNamedDeclaration") {
            if (s.specifiers) {
                for (const {exported} of s.specifiers) {
                    const {name} = exported;
                    exportNamedDeclarations.set(name, moduleUrl);
                }
            }
            if (s.declaration) {
                const {id, declarations} = s.declaration;
                if (declarations) {
                    for (const {id} of declarations) {
                        const {name} = id;
                        exportNamedDeclarations.set(name, moduleUrl);
                    }
                }
                if (id) {
                    const {name} = id;
                    exportNamedDeclarations.set(name, moduleUrl);
                }
            }
        }
    }

    const imports = new Map();
    for (const [id, from] of exportNamedDeclarations) {
        (imports.get(from) || imports.set(from, []).get(from)).push(id);
    }

    let code = "";
    for (const from of exportAllDeclarations) {
        code += `export * from "${from}";\n`
        imports.delete(from);
    }
    for (const [from, identifiers] of imports) {
        code += `export {${[...identifiers].join(", ")}} from "${from}";\n`
    }

    const main = bundle.cache.modules[bundle.cache.modules.length - 1];
    for (const s of main.ast.body) if (s.type === "ExportDefaultDeclaration") {
        code += `import __default from "${(nodeModuleBareUrl(main.id))}";\nexport default __default;\n`
        break;
    }

    await fs.mkdir(posix.dirname(web_module), {recursive: true});
    await fs.writeFile(web_module, code);

    const full = await rollup.rollup({
        input: web_module,
        cache: bundle.cache,
        plugins: [{
            name: "rollup-plugin-web-modules",
            async resolveId(source, base) {
                return cachedModules.get(source) || null;
            },
            renderChunk(code, info, opts) {
                return {code: code.replace(/\0web_/g, '/web_'), map: null};
            },
        }, rollupPlugins[1], rollupPlugins[2]]
    });
    await full.write({
        file: web_module,
        format: "esm",
        sourcemap: "inline"
    });

    log.info("done rollup:", name, target, source);

    return {
        filename: target,
        imports: bundle.watchFiles.filter(f => f.charCodeAt(0) !== 0).map(f => {
            return nodeModuleBareUrl(f).substring(name.length + 1);
        })
    };
}


module.exports = {
    nodeModuleBareUrl,
    hasExt: function (filename) {
        return filename.lastIndexOf('.') > 0;
    },
    stripExt,
    isRewriteRequired,
    parseURL,
    rewriteImport
}