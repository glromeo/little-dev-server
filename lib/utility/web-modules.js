const log = require("tiny-node-logger");

const {config} = require("../configuration.js");

const {readFileSync, existsSync, mkdirSync, rmdirSync, promises: fs} = require("fs");
const path = require("path");
const {sep, posix} = path;
const {promisify} = require("util");
const resolveAsync = promisify(require("resolve"));
const rollup = require("rollup");
const pluginNodeResolve = require("@rollup/plugin-node-resolve").default;
const pluginCommonjs = require("@rollup/plugin-commonjs");
const pluginSourcemaps = require("rollup-plugin-sourcemaps");

const {Slash, FullStop, AtSign, Colon} = require("./char-codes.js");

const modules = new Map();

const rollupPlugins = {};


config.updated = function () {

    if (config.clean) {
        rmdirSync(config.webModules, {recursive: true});
        log.info("cleaned web_modules direcotry");
    }
    mkdirSync(config.webModules, {recursive: true});

    modules.clear();

    Object.assign(rollupPlugins, {
        nodeResolve: pluginNodeResolve({
            customResolveOptions: config.customResolveOptions
        }),
        commonjs: pluginCommonjs(),
        sourcemaps: pluginSourcemaps()
    });
}


const nodeModulesRelativePath = filename => filename.substring(filename.lastIndexOf("/node_modules/") + 14);
const windowsSepRegex = /\\/g;

const nodeModuleBareUrl = sep === '/'
    ? nodeModulesRelativePath
    : filename => nodeModulesRelativePath(filename.replace(windowsSepRegex, '/'));


const urlRegex = /(^(?<scheme>\w+):\/\/(?<domain>[^/?#]+))?((?<module>(@[\w-]+\/)?[^._/?#][^:/?#]*)(\/|$))?(?<filename>[^?#]+)?(\?(?<search>[^#]+))?(#(?<fragment>.*))?/;

function parseURL(url = ".") {

    let match = urlRegex.exec(url);
    if (!match) {
        match = {};
    }

    return match.groups;
}

const resolveCache = new Map();

async function resolveImport(base, url) {

    let {
        scheme,
        module,
        filename,
        search
    } = parseURL(url);

    if (scheme !== undefined) {
        return url;
    }

    if (module === undefined) {
        filename = posix.resolve(base, filename);
    } else {
        const webPkg = await resolveWebModule(module);
        filename = `/web_modules/${module}/${await webPkg.resolve(filename)}`;
    }

    const ext = posix.extname(filename);
    if (ext !== ".js" && ext !== ".mjs") {
        if (ext) {
            search = search ? "type=module&" + search : "type=module";
        } else {
            filename = filename + ".js";
        }
    }

    if (search) {
        return filename + "?" + search;
    } else {
        return filename;
    }
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
        async resolve(barename) {

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

            if (!posix.extname(barename)) {
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

            return this.files.get(barename);
        }
    });
}

function cacheUnary(cache, fn) {
    return async function (arg) {
        let pending = cache.get(arg);
        if (pending === undefined) {
            cache.set(arg, pending = fn(arg));
            cache.set(arg, await pending);
        }
        return pending;
    };
}

const resolveWebModule = cacheUnary(modules, async function (name) {

    log.info("resolving web module:", name);

    try {
        const webPkg = await readWebPackageFile(name);
        return finalizeWebPackage(webPkg);
    } catch (ignored) {
        log.info(posix.resolve(config.webModules, name, "webpackage.json"), "not found, bundling it!");
    }

    const filename = await resolvePackageJson(name);
    const pkg = JSON.parse(await fs.readFile(filename, "UTF-8"));
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

        const utcDate = new Date().toUTCString();
        webPkg.bundle = [];
        webPkg.stats = {
            size: 0,
            atime: utcDate,
            mtime: utcDate,
            ctime: utcDate,
            birthtime: utcDate,
        };
    }

    await writeWebPackageFile(name, webPkg);
    return finalizeWebPackage(webPkg);
});

async function createBundleEntryModule({modules}) {

    const exportNamedDeclarations = new Map();
    const exportAllDeclarations = new Set();
    const moduleCache = new Map();

    for (const module of modules) {

        const moduleUrl = nodeModuleBareUrl(module.id);
        moduleCache.set(moduleUrl, module);

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

    const mainModule = modules[modules.length - 1];
    for (const s of mainModule.ast.body) if (s.type === "ExportDefaultDeclaration") {
        code += `import __default from "${(nodeModuleBareUrl(mainModule.id))}";\n`;
        code += `export default __default;\n`
        break;
    }

    return {code, moduleCache};
}

async function writeFile(filename, code) {
    if (filename.indexOf(path.sep) !== -1) {
        await fs.mkdir(path.dirname(filename), {recursive: true});
    }
    await fs.writeFile(filename, code);
}

async function writeBundle(web_module, bundle) {
    await bundle.write({
        file: web_module,
        format: "esm",
        sourcemap: "inline"
    });
}

async function bundleWebModule(name, target, source) {

    const ext = posix.extname(target);
    if (!ext) {
        throw new Error("target is missing ex: " + target);
    }

    const web_module = posix.join(config.webModules, name, target);

    if (ext !== ".js" && ext !== ".mjs") {
        const content = await fs.readFile(source);
        await fs.writeFile(web_module, content);
        log.info("done copying:", name, target, source);
        return {
            filename: target,
            imports: []
        };
    }

    const {cache, watchFiles} = await rollup.rollup({
        input: source,
        plugins: [
            {
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
                            if (!bare.startsWith(name + "/")) {
                                const {module: name, filename: file} = parseURL(bare);
                                const webPkg = modules.get(name);
                                if (webPkg && webPkg.main) {
                                    if (webPkg.bundle.has(file)) {
                                        return {id: `\0web_modules/${name}/${webPkg.main}`, external: true};
                                    } else {
                                        return {id: `\0web_modules/${bare}`, external: true};
                                    }
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
            },
            rollupPlugins.nodeResolve,
            rollupPlugins.commonjs,
            rollupPlugins.sourcemaps
        ]
    });

    const {code, moduleCache} = await createBundleEntryModule(cache);

    await writeFile(web_module, code);

    await writeBundle(web_module, await rollup.rollup({
        input: web_module,
        cache: cache,
        plugins: [
            {
                name: "rollup-plugin-web-modules",
                async resolveId(source, base) {
                    return moduleCache.get(source) || null;
                },
                renderChunk(code, info, opts) {
                    return {code: code.replace(/\0web_/g, '/web_'), map: null};
                },
            },
            rollupPlugins.commonjs,
            rollupPlugins.sourcemaps
        ]
    }));

    log.info("done rollup:", name, target, source);

    return {
        filename: target,
        imports: watchFiles.filter(f => f.charCodeAt(0) !== 0).map(f => {
            return nodeModuleBareUrl(f).substring(name.length + 1);
        })
    };
}


module.exports = {
    nodeModuleBareUrl,
    parseURL,
    resolveImport,
    resolveWebModule
}
