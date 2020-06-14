const log = require("tiny-node-logger");
const {existsSync, promises: fs} = require("fs");
const path = require("path");
const {useMemo} = require("./memoize.js");
const {promisify} = require("util");
const {useWebModuleBundler} = require("./web-module-bundler.js");

const resolveAsync = promisify(require("resolve"));

module.exports.useWebModuleLoader = useMemo(config => {

    const {webModules, customResolveOptions} = config;

    const {modules, bundleWebModule} = useWebModuleBundler(config);

    function resolvePackageJson(module) {
        const filename = path.join(module, "package.json");
        return resolveAsync(filename, customResolveOptions);
    }

    async function readWebPackageFile(name) {
        const text = await fs.readFile(path.resolve(webModules, name, "webpackage.json"), "UTF-8");
        return JSON.parse(text);
    }

    async function writeWebPackageFile(name, webPkg) {
        const filename = path.resolve(webModules, name, "webpackage.json");
        const text = JSON.stringify(webPkg, undefined, "  ");
        try {
            await fs.mkdir(path.dirname(filename), {recursive: true});
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
                    barename = existsSync(path.resolve(this.origin, tentative)) ? tentative : barename + ".js";
                }

                if (!this.files.has(barename)) {
                    this.files.set(barename, new Promise(async (resolve, reject) => {
                        try {
                            log.info("web_module:", this.name, "resolving:", barename);

                            const {filename} = await bundleWebModule(
                                this.name,
                                barename,
                                path.join(this.origin, barename)
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
            log.info(path.resolve(webModules, name, "webpackage.json"), "not found, bundling it!");
        }

        const filename = await resolvePackageJson(name);
        const pkg = require(filename);
        const origin = path.dirname(filename);
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
            const {imports} = await bundleWebModule(name, main, path.join(origin, main));
            webPkg.bundle = imports;

            const stats = await fs.stat(path.join(webModules, name, webPkg.main));
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

    return {
        resolveWebModule
    }
})
