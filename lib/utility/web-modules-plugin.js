const log = require("tiny-node-logger/index.js");
const {toPosix} = require("./quick-parse-url.js");
const {memoize} = require("../utility/memoize.js");
const {isBare} = require("./quick-parse-url.js");
const {parseSync, traverse} = require("@babel/core");
const {useWebModules} = require("./web-modules.js");
const path = require("path");

module.exports.useWebModulesPlugin = memoize(config => {

    const {resolveImport} = useWebModules(config);

    function resolveBabelRuntime(importUrl) {
        const indexOfBabelNamespace = importUrl.lastIndexOf("@babel");
        if (indexOfBabelNamespace !== -1) {
            return "/web_modules/" + toPosix(importUrl.substring(indexOfBabelNamespace)) + ".js";
        }
    }

    function rewriteWebModulesPlugin({types}) {

        let filename, imports, importMap;

        function rewriteImport(path, source) {

            const importUrl = source.node.value;
            const resolvedUrl = importMap.get(importUrl) || resolveBabelRuntime(importUrl) || importUrl;

            if (importUrl !== resolvedUrl) try {
                log.debug("resolved import:", `'${importUrl}'`, "as:", resolvedUrl);
                source.replaceWith(types.stringLiteral(resolvedUrl));
            } catch (error) {
                throw path.buildCodeFrameError(`Could not rewrite import '${importUrl}'. ${error.message}`);
            }

            if (!isBare(resolvedUrl)) {
                imports.add(resolvedUrl);
                log.debug(filename, "collected link:", resolvedUrl);
            }
        }

        return {
            inherits: require("@babel/plugin-syntax-dynamic-import").default,
            pre(state) {
                filename = this.filename;
                importMap = this.opts.importMap;
                imports = new Set();
            },
            post(state) {
                this.file.metadata.imports = imports;
            },
            visitor: {
                "CallExpression"(path, state) {
                    const isImport = path.node.callee.type === "Import";
                    const isRequire = path.node.callee.name === "require";
                    if (isImport || isRequire) {
                        const [source] = path.get("arguments");
                        if (source.type === "StringLiteral") {
                            rewriteImport(path, source);
                        } else {
                            log.warn("unexpected: 'source.type is not a StringLiteral' at:", path, "in:", this.filename);
                        }
                    }
                },
                "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(path, state) {
                    const source = path.get("source");
                    if (source.node !== null) {
                        rewriteImport(path, source);
                    }
                }
            }
        };
    }

    async function traverseAsync(filename, source, options) {

        const parsedAst = parseSync(source, options);
        const importMap = new Map();

        const dirname = path.dirname(filename);

        traverse(parsedAst, {
            "CallExpression"(path, state) {
                const isImport = path.node.callee.type === "Import";
                const isRequire = path.node.callee.name === "require";
                if (isImport || isRequire) {
                    const [source] = path.get("arguments");
                    if (source.type === "StringLiteral") {
                        const importUrl = source.node.value;
                        importMap.set(importUrl, resolveImport(dirname, importUrl));
                    } else {
                        log.error`unexpected: 'source.type is not a StringLiteral' at: ${path}, in: ${this.filename}`;
                    }
                }
            },
            "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(path, state) {
                const source = path.get("source");
                if (source.node !== null) {
                    const importUrl = source.node.value;
                    importMap.set(importUrl, resolveImport(dirname, importUrl));
                }
            }
        });

        for (const [key, value] of importMap.entries()) try {
            importMap.set(key, await value);
        } catch (error) {
            log.error("could not resolve import:", key, "in:", filename, error);
            throw new Error(`Error resolving import '${key}' in: ${filename}`);
        }

        return {parsedAst, rewritePlugin: [rewriteWebModulesPlugin, {importMap}]};
    }

    return {
        traverseAsync
    };

});
