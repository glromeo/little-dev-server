const log = require("tiny-node-logger/index.js");

const {memoize} = require("../utility/memoize.js");
const {quickParseURL, isBare, nodeModuleBareUrl, splitModulePathname, toPosix} = require("./quick-parse-url.js");
const {mkdirSync, rmdirSync, promises: fs} = require("fs");
const path = require("path");
const {posix} = path;
const {promisify} = require("util");
const resolveAsync = promisify(require("resolve"));

const rollup = require("rollup");
const createPluginNodeResolve = require("@rollup/plugin-node-resolve").default;
const createPluginCommonjs = require("@rollup/plugin-commonjs");
const createPluginSourcemaps = require("rollup-plugin-sourcemaps");
const glob = require("glob");

module.exports.useWebModules = memoize(config => {

    const {rootDir, webModules, nodeModules} = config;

    function rootDirRelative(pathname) {
        return "/" + toPosix(path.relative(rootDir, pathname));
    }

    const customResolveOptions = {basedir: rootDir, paths: nodeModules, extensions: [".mjs", ".js", ".ts"]};

    if (config.clean) {
        rmdirSync(webModules, {recursive: true});
        log.info("cleaned web_modules direcotry");
    }
    mkdirSync(webModules, {recursive: true});

    const modules = new Map();

    function loadLocalPackage(origin) {

        log.info("loading:", origin);

        try {
            const packageJson = require(path.join(origin, "package.json"));
            const main = packageJson.module || packageJson["jsnext:main"] || packageJson.main;
            const {name, workspaces} = packageJson;

            function resolve(pathname = ".") {
                return resolveAsync(path.join(origin, pathname), customResolveOptions).then(rootDirRelative);
            }

            modules.set(name, {
                local: true,
                name,
                main,
                origin,
                resolve
            });

            if (workspaces) for (const workspace of workspaces) {
                for (const packageJsonFile of glob.sync(workspace + "/package.json", {
                    cwd: origin,
                    nonnull: true
                })) loadLocalPackage(path.dirname(path.join(origin, packageJsonFile)));
            }

        } catch (ignored) {
            log.info("no package.json found at:", origin);
        }
    }

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
            pathname = webPkg.local ? await webPkg.resolve(pathname) : `/web_modules/${module}/${await webPkg.resolve(pathname)}`;
            const ext = posix.extname(pathname);
            if (ext && ext !== ".js" && ext !== ".mjs") {
                search = search ? "type=module&" + search : "type=module";
            }
        } else {
            const ext = posix.extname(pathname);
            let resolved = pathname.charAt(0) === "/" ? path.join(rootDir, pathname) : path.resolve(basedir, pathname);
            if (ext) {
                if (ext !== ".js" && ext !== ".mjs" && ext !== ".ts") {
                    search = search ? "type=module&" + search : "type=module";
                }
            } else {
                resolved = await resolveAsync(resolved, customResolveOptions);
            }
            pathname = rootDirRelative(resolved);
        }

        if (search) {
            return pathname + "?" + search;
        } else {
            return pathname;
        }
    }

    async function readWebPackageFile(module, filename, encoding = "UTF-8") {
        const pathname = path.join(webModules, module, filename);
        return fs.readFile(pathname, encoding);
    }

    async function writeWebPackageFile(module, filename, content) {
        const pathname = path.join(webModules, module, filename);
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
            async resolve(pathname) {

                if (!pathname) {
                    if (this.main) {
                        pathname = this.main;
                    } else {
                        throw new Error("web package doesn't have a main file");
                    }
                }

                if (this.bundle.has(pathname)) {
                    return this.main || pathname;
                }

                const ext = posix.extname(pathname);
                if (!ext) {
                    const absolute = path.join(this.origin, pathname);
                    pathname += path.extname(await resolveAsync(absolute, customResolveOptions));
                } else if (ext !== ".js" && ext !== ".mjs") {
                    const source = path.resolve(this.origin, pathname);
                    const content = await fs.readFile(source);
                    const target = await writeWebPackageFile(this.name, pathname, content);
                    log.info(`copied: ${source} to: ${target}`);
                    return pathname;
                }

                if (!this.files.has(pathname)) {
                    this.files.set(pathname, new Promise(async (resolve, reject) => {
                        try {
                            log.info("web_module:", this.name, "resolving:", pathname);
                            const {filename} = await rollupWebModule(this.name, pathname);
                            resolve(filename);
                        } catch (e) {
                            reject(e);
                        }
                    }));
                }

                return this.files.get(pathname);
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
        const main = pkg.module || pkg["jsnext:main"] || pkg.main;
        const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];

        for (const dependency of dependencies) {
            await resolveWebModule(dependency);
        }

        const webPkg = {
            name,
            main: main && main.startsWith("./") ? main.substring(2) : main,
            origin,
            dependencies,
            bundle: []
        };

        if (main) {
            const {imports} = await rollupWebModule(name, main);
            webPkg.bundle = imports;

            const stats = await fs.stat(path.join(webModules, name, webPkg.main));
            webPkg.stats = {
                size: stats.size,
                atime: stats.atime.toUTCString(),
                mtime: stats.mtime.toUTCString(),
                ctime: stats.ctime.toUTCString(),
                birthtime: stats.birthtime.toUTCString()
            };

        } else {

            const utcDate = new Date().toUTCString();
            webPkg.bundle = [];
            webPkg.stats = {
                size: 0,
                atime: utcDate,
                mtime: utcDate,
                ctime: utcDate,
                birthtime: utcDate
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
            code += `export * from "${value}";\n`;
            imports.delete(value);
        }
        for (const [value, identifiers] of imports) {
            code += `export {${[...identifiers].join(", ")}} from "${value}";\n`;
        }

        const mainModule = modules[modules.length - 1];
        for (const s of mainModule.ast.body) if (s.type === "ExportDefaultDeclaration") {
            code += `import __default from "${(nodeModuleBareUrl(mainModule.id))}";\n`;
            code += `export default __default;\n`;
            break;
        }

        return {code, moduleCache};
    }

    const pluginNodeResolve = createPluginNodeResolve({
        rootDir,
        customResolveOptions
    });
    const pluginCommonjs = createPluginCommonjs();
    const pluginSourcemaps = createPluginSourcemaps();

    function isValidPathname(pathname) {
        return pathname !== undefined && pathname.charAt(0) !== 0;
    }

    function rollupOnWarn({code, message, loc, importer}, warn) {
        if (code === "UNUSED_EXTERNAL_IMPORT" || code === "THIS_IS_UNDEFINED") return;
        if (code === "NON_EXISTENT_EXPORT") throw new Error(message);
        if (code === "UNRESOLVED_IMPORT" && importer.endsWith("commonjs-external")) {
            return;
        }
        if (loc) {
            log.warn(message, "in:", loc.file, "at line:", loc.line, "column:", loc.column);
        } else {
            log.warn(message);
        }
    }

    /**
     * Rollup Web Module
     *
     * @param module
     * @param filename
     * @returns {Promise<{filename: *, imports: []}|{filename: *, imports}|{code: string, map: null}|null|{external: boolean, id: string}|*>}
     */
    async function rollupWebModule(module, filename) {

        const startTime = Date.now();

        const {cache, watchFiles} = await rollup.rollup({
            input: `${module}/${filename}`,
            plugins: [
                {
                    name: "rollup-plugin-rewrite-web-modules",
                    resolveId(source, from) {
                        if (isValidPathname(source) && isValidPathname(from)) {
                            if (isBare(source)) {
                                if (!source.startsWith(module)) {
                                    return {id: `\0web_modules/${source}`, external: true};
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
            ],
            onwarn: rollupOnWarn
        });

        const imports = watchFiles.filter(isValidPathname).map(function moduleRelative(filename) {
            return nodeModuleBareUrl(filename).substring(module.length + 1);
        });

        filename = imports[0];

        const {code, moduleCache} = await createBundleEntryModule(cache);

        if (!code) {
            const source = cache.modules[0].code;
            await writeWebPackageFile(module, filename, source);
            return {
                filename,
                imports: []
            };
        }

        const target = await writeWebPackageFile(module, filename, code);

        const bundle = await rollup.rollup({
            input: target,
            cache: cache,
            plugins: [
                {
                    name: "rollup-plugin-resolve-web-modules",
                    async resolveId(source) {
                        return moduleCache.get(source) || null;
                    },
                    renderChunk(code) {
                        return {code: code.replace(/\0web_/g, "/web_"), map: null};
                    }
                },
                pluginCommonjs,
                pluginSourcemaps
            ]
        });

        await bundle.write({
            file: target,
            format: "esm",
            sourcemap: "inline"
        });

        const elapsed = Date.now() - startTime;

        log.info("rolled up:", target, "in:", elapsed + "ms");

        return {
            filename,
            imports,
            elapsed
        };
    }

    modules.init = function () {
        modules.clear();
        loadLocalPackage(path.join(rootDir));
    };

    modules.init();

    return {
        modules,
        resolveImport,
        resolveWebModule,
        rollupWebModule
    };

});
