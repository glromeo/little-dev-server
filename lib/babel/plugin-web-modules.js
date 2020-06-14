const {useMemo} = require("../utility/memoize.js");
const log = require("tiny-node-logger");
const {FullStop, Slash} = require("../utility/char-codes.js");
const {parseSync, traverse} = require("@babel/core");
const {useWebModuleLoader} = require("../utility/web-module-loader.js");
const {splitModuleUrl, resolveUrl, isRewriteRequired} = require("../utility/web-modules.js");

module.exports.usePluginWebModules = useMemo(config => {

    const {resolveWebModule} = useWebModuleLoader(config);

    async function resolveWebModuleImport(filename, importUrl) {
        const cc = importUrl.charCodeAt(0);
        if (cc === FullStop || cc === Slash) {
            importUrl = resolveUrl(filename, importUrl);
        }
        const [name, path] = splitModuleUrl(importUrl);
        const webPkg = await resolveWebModule(name);
        return `/web_modules/${name}/${path ? await webPkg.resolve(path) : webPkg.main}`;
    }

    function rewriteFormat(relativeUrl) {
        if (relativeUrl.endsWith(".scss")) {
            return relativeUrl + "?format=mjs";
        }
        return relativeUrl;
    }

    function rewriteBare(importUrl) {
        const cc = importUrl.charCodeAt(0);
        if (cc === FullStop || cc === Slash) {
            if (importUrl.lastIndexOf('.') !== -1) {
                return importUrl;
            }
        }
        const isUrl = importUrl.indexOf('://') > 0;
        if (isUrl) {
            return importUrl;
        }
        return `/web_modules/${importUrl}`;
    }

    function resolveBabelRuntime(importUrl) {
        const indexOfBabelNamespace = importUrl.lastIndexOf("@babel");
        if (indexOfBabelNamespace !== -1) {
            return "/web_modules/" + importUrl.substring(indexOfBabelNamespace) + ".js"
        }
        return importUrl;
    }

    function rewriteWebModulesPlugin({types}) {

        function rewriteImport(path, source) {

            const {filename, imports, opts: {importMap}} = this;

            const importUrl = source.node.value;
            const relativeUrl = rewriteFormat(importMap.get(importUrl) || resolveBabelRuntime(importUrl) || importUrl);

            if (importUrl === relativeUrl) {
                log.debug("ignored import path:", importUrl);
                imports.add(importUrl);
                log.debug(filename, "collected link:", importUrl);
            } else try {
                log.debug("resolved module:", `'${importUrl}'`, "as:", relativeUrl);
                imports.add(relativeUrl);
                log.debug(filename, "collected link:", relativeUrl);
                const resolvedUrl = relativeUrl;
                source.replaceWith(types.stringLiteral(resolvedUrl));
            } catch (error) {
                throw path.buildCodeFrameError(`Could not resolve import '${importUrl}'. ${error.message}`);
            }
        }

        return {
            inherits: require("@babel/plugin-syntax-dynamic-import").default,
            pre(state) {
                this.rewriteImport = rewriteImport;
                this.imports = new Set();
            },
            post(state) {
                this.file.metadata.imports = this.imports;
            },
            visitor: {
                'CallExpression'(path, state) {
                    const isImport = path.node.callee.type === 'Import';
                    const isRequire = path.node.callee.name === 'require';
                    if (isImport || isRequire) {
                        const [source] = path.get('arguments');
                        if (source.type === 'StringLiteral') {
                            state.rewriteImport(path, source);
                        } else {
                            log.warn("unexpected: 'source.type is not a StringLiteral' at:", path, "in:", this.filename);
                        }
                    }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, state) {
                    const source = path.get('source');
                    if (source.node !== null) {
                        state.rewriteImport(path, source);
                    }
                }
            },
        };
    }

    function rewriteUrl(url) {
        return rewriteFormat(rewriteBare(url));
    }

    async function traverseAsync(filename, source, options) {

        const parsedAst = parseSync(source, options);

        const importMap = new Map();

        traverse(parsedAst, {
            'CallExpression'(path, state) {
                const isImport = path.node.callee.type === 'Import';
                const isRequire = path.node.callee.name === 'require';
                if (isImport || isRequire) {
                    const [source] = path.get('arguments');
                    if (source.type === 'StringLiteral') {
                        const importUrl = source.node.value;
                        if (!importMap.has(importUrl) && isRewriteRequired(importUrl)) {
                            importMap.set(importUrl, resolveWebModuleImport(filename, importUrl));
                        }
                    } else {
                        log.warn("unexpected: 'source.type is not a StringLiteral' at:", path, "in:", this.filename);
                    }
                }
            },
            'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, state) {
                const source = path.get('source');
                if (source.node !== null) {
                    const importUrl = source.node.value;
                    if (!importMap.has(importUrl) && isRewriteRequired(importUrl)) {
                        importMap.set(importUrl, resolveWebModuleImport(filename, importUrl));
                    }
                }
            }
        });

        for (const [key, value] of importMap.entries()) {
            importMap.set(key, await value);
        }

        return {parsedAst, rewritePlugin: [rewriteWebModulesPlugin, {importMap}]};
    }

    return {
        traverseAsync,
        rewriteUrl
    }
});
