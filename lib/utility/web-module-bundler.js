const log = require("tiny-node-logger");

const {existsSync, mkdirSync, rmdirSync, promises: fs} = require("fs");
const path = require("path");

const rollup = require("rollup");
const pluginNodeResolve = require("@rollup/plugin-node-resolve").default;
const pluginCommonjs = require("@rollup/plugin-commonjs");
const pluginSourcemaps = require("rollup-plugin-sourcemaps");
const {stripExt} = require("./web-modules.js");
const {splitModuleUrl, nodeBasename} = require("./web-modules");
const {useMemo} = require("./memoize.js");

const {Slash, FullStop, AtSign} = require("./char-codes");

module.exports.useWebModuleBundler = useMemo(config => {

    const {webModules, customResolveOptions} = config;

    if (!existsSync(webModules)) {
        mkdirSync(webModules, {recursive: true});
    }
    if (config.clean) {
        rmdirSync(webModules, {recursive: true});
        mkdirSync(webModules, {recursive: true});
        log.info("cleaned web_modules direcotry");
    }

    const modules = new Map();

    const rollupPlugins = [
        pluginNodeResolve({customResolveOptions}),
        pluginCommonjs(),
        pluginSourcemaps()
    ]

    return {
        modules,
        async bundleWebModule(name, target, source) {

            if (!path.extname(target)) {
                throw new Error("target is missing ex: " + target);
            }

            const web_module = path.join(config.webModules, name, target);

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
                                const absolutePath = path.resolve(path.dirname(base), source);
                                const bare = nodeBasename(absolutePath);
                                const [name, file] = splitModuleUrl(bare);
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

                const moduleUrl = nodeBasename(module.id);
                cachedModules.set(moduleUrl, module);

                for (const s of module.ast.body) if (s.type === "ExportAllDeclaration") {
                    let from = s.source.value;
                    if (from.charCodeAt(0) === FullStop) {
                        from = nodeBasename(path.resolve(path.dirname(module.id), from));
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
                code += `import __default from "${(nodeBasename(main.id))}";\nexport default __default;\n`
                break;
            }

            await fs.mkdir(path.dirname(web_module), {recursive: true});
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
                    return nodeBasename(f).substring(name.length+1);
                })
            };
        }
    }
});
