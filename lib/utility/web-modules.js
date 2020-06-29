const log = require("tiny-node-logger/index.js");

const {memoize} = require("../utility/memoize.js");
const {quickParseURL, isBare, nodeModuleBareUrl, splitModulePathname, toPosix} = require("./quick-parse-url.js");
const {existsSync, mkdirSync, rmdirSync, promises: fs} = require("fs");
const path = require("path");
const {posix} = path;
const {promisify} = require("util");
const resolveAsync = promisify(require("resolve"));

const rollup = require("rollup");
const createPluginNodeResolve = require("@rollup/plugin-node-resolve").default;
const createPluginCommonjs = require("@rollup/plugin-commonjs");
const createPluginSourcemaps = require("rollup-plugin-sourcemaps");
const {posixBasedir} = require("./quick-parse-url.js");

const {FullStop, Slash} = require("./char-codes.js");

module.exports.useWebModules = memoize(config => {

    const customResolveOptions = {basedir: config.rootDir, paths: config.nodeModules, extensions: [".mjs", ".js"]};

    if (config.clean) {
        rmdirSync(config.webModules, {recursive: true});
        log.info("cleaned web_modules direcotry");
    }
    mkdirSync(config.webModules, {recursive: true});

    const modules = new Map();

    async function resolveImport(basedir, url) {

        let {
            scheme,
            module,
            pathname,
            search
        } = quickParseURL(url);

        if (scheme !== undefined) {
            return url;
        }

        if (module !== undefined) {
            const webPkg = await resolveWebModule(module);
            pathname = `/web_modules/${module}/${await webPkg.resolve(pathname)}`;
            const ext = posix.extname(pathname);
            if (ext && ext !== ".js" && ext !== ".mjs") {
                search = search ? "type=module&" + search : "type=module";
            }
        } else {
            const ext = posix.extname(pathname);
            let resolved = pathname.charCodeAt(0) === Slash ? path.join(config.rootDir, pathname) : path.resolve(basedir, pathname);
            if (ext) {
                if (ext !== ".js" && ext !== ".mjs") {
                    search = search ? "type=module&" + search : "type=module";
                }
            } else {
                resolved = await resolveAsync(resolved, customResolveOptions);
            }
            pathname = "/" + toPosix(path.relative(config.rootDir, resolved));
        }

        if (search) {
            return pathname + "?" + search;
        } else {
            return pathname;
        }
    }

    async function readWebPackageFile(module, filename, encoding = "UTF-8") {
        const pathname = path.join(config.webModules, module, filename);
        return fs.readFile(pathname, encoding)
    }

    async function writeWebPackageFile(module, filename, content) {
        const pathname = path.join(config.webModules, module, filename);
        while (true) try {
            await fs.writeFile(pathname, content);
            return pathname;
        } catch (e) {
            if (e.code === "ENOENT") await fs.mkdir(path.dirname(pathname), {recursive: true});
        }
    }

    function hydrateWebPackage(webPkg) {
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

                const ext = posix.extname(barename);
                if (!ext) {
                    const tentative = barename + ".mjs";
                    barename = existsSync(path.resolve(this.origin, tentative)) ? tentative : barename + ".js";
                } else if (ext !== ".js" && ext !== ".mjs") {
                    const source = path.resolve(this.origin, barename);
                    const content = await fs.readFile(source);
                    const target = await writeWebPackageFile(this.name, barename, content);
                    log.info(`copied: ${source} to: ${target}`);
                    return barename;
                }

                if (!this.files.has(barename)) {
                    this.files.set(barename, new Promise(async (resolve, reject) => {
                        try {
                            log.info("web_module:", this.name, "resolving:", barename);
                            const {filename} = await rollupWebModule(this.name, barename);
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

    async function loadWebPackage(name) {
        return JSON.parse(await readWebPackageFile(name, "webpackage.json"));
    }

    async function createWebPackage(name) {

        const filename = await resolveAsync(posix.join(name, "package.json"), customResolveOptions);
        const pkg = JSON.parse(await fs.readFile(filename, "UTF-8"));
        const origin = path.dirname(filename);
        const main = pkg.module || pkg['jsnext:main'] || pkg.main;
        const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];

        for (const dependency of dependencies) {
            await resolveWebModule(dependency);
        }

        const webPkg = {
            name,
            main: main && main.startsWith("./") ? main.substring(2) : main,
            origin,
            dependencies,
            bundle: [],
        }

        if (main) {
            const {imports} = await rollupWebModule(name, main);
            webPkg.bundle = imports;

            const stats = await fs.stat(path.join(config.webModules, name, webPkg.main));
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

        await writeWebPackageFile(name, "webpackage.json", JSON.stringify(webPkg, undefined, "  "));

        return webPkg;
    }

    function useModulesCache(resolveWebModule) {
        return function (name) {
            if (!modules.has(name)) {
                modules.set(name, resolveWebModule(name).then(module => {
                    modules.set(name, module);
                    return module;
                }));
            }
            return modules.get(name);
        };
    }

    const resolveWebModule = useModulesCache(async function (name) {
        try {
            log.info("load web package: ", name);
            return hydrateWebPackage(await loadWebPackage(name));
        } catch (ignored) {
            log.info("create web package: ", name);
            return hydrateWebPackage(await createWebPackage(name));
        }
    });

    async function createBundleEntryModule({modules}) {

        const exportNamedDeclarations = new Map();
        const exportAllDeclarations = new Set();
        const moduleCache = new Map();

        for (const module of modules) {

            const moduleUrl = nodeModuleBareUrl(module.id);
            moduleCache.set(moduleUrl, module);

            for (const s of module.ast.body) if (s.type === "ExportAllDeclaration") {
                let value = s.source.value;
                if (!isBare(value)) {
                    value = nodeModuleBareUrl(path.resolve(path.dirname(module.id), value));
                }
                exportAllDeclarations.add(value);
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
        for (const [id, value] of exportNamedDeclarations) {
            (imports.get(value) || imports.set(value, []).get(value)).push(id);
        }

        let code = "";
        for (const value of exportAllDeclarations) {
            code += `export * from "${value}";\n`
            imports.delete(value);
        }
        for (const [value, identifiers] of imports) {
            code += `export {${[...identifiers].join(", ")}} from "${value}";\n`
        }

        const mainModule = modules[modules.length - 1];
        for (const s of mainModule.ast.body) if (s.type === "ExportDefaultDeclaration") {
            code += `import __default from "${(nodeModuleBareUrl(mainModule.id))}";\n`;
            code += `export default __default;\n`
            break;
        }

        return {code, moduleCache};
    }

    const pluginNodeResolve = createPluginNodeResolve({
        rootDir: config.rootDir,
        customResolveOptions
    });
    const pluginCommonjs = createPluginCommonjs();
    const pluginSourcemaps = createPluginSourcemaps();

    function isValidPathname(pathname) {
        return pathname !== undefined && pathname.charCodeAt(0) !== 0;
    }

    async function rollupWebModule(module, filename) {

        const {cache, watchFiles} = await rollup.rollup({
            input: `${module}/${filename}`,
            plugins: [
                {
                    name: "rollup-plugin-rewrite-web-modules",
                    resolveId(source, from) {
                        if (isValidPathname(source) && isValidPathname(from)) {
                            if (isBare(source)) {
                                if (!source.startsWith(module)) {
                                    return {id: `\0web_modules/${source}`, external: true}
                                }
                            } else {
                                const bare = nodeModuleBareUrl(path.resolve(path.dirname(from), source));
                                const [name, file] = splitModulePathname(bare);
                                const webPkg = modules.get(name);
                                if (webPkg && webPkg.main) {
                                    if (webPkg.bundle.has(file)) {
                                        return {id: `\0web_modules/${name}/${webPkg.main}`, external: true};
                                    } else {
                                        return {id: `\0web_modules/${bare}`, external: true};
                                    }
                                }
                            }
                        }
                        return null;
                    }
                },
                pluginNodeResolve,
                pluginCommonjs,
                pluginSourcemaps
            ]
        });

        const imports = watchFiles.filter(isValidPathname).map(function moduleRelative(filename) {
            return nodeModuleBareUrl(filename).substring(module.length + 1);
        });

        filename = imports[0];

        const {code, moduleCache} = await createBundleEntryModule(cache);

        const web_module = await writeWebPackageFile(module, filename, code);

        const bundle = await rollup.rollup({
            input: web_module,
            cache: cache,
            plugins: [
                {
                    name: "rollup-plugin-resolve-web-modules",
                    async resolveId(source) {
                        return moduleCache.get(source) || null;
                    },
                    renderChunk(code) {
                        return {code: code.replace(/\0web_/g, '/web_'), map: null};
                    },
                },
                pluginCommonjs,
                pluginSourcemaps
            ]
        });

        await bundle.write({
            file: web_module,
            format: "esm",
            sourcemap: "inline"
        });

        log.info("rolled up:", web_module);

        return {
            filename,
            imports
        };
    }

    return {
        modules,
        resolveImport,
        resolveWebModule,
        rollupWebModule
    }

})
;
