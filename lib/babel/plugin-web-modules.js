const log = require("tiny-node-logger");
const {resolveImport} = require("../utility/web-modules.js");
const {parseSync, traverse} = require("@babel/core");

function resolveBabelRuntime(importUrl) {
    const indexOfBabelNamespace = importUrl.lastIndexOf("@babel");
    if (indexOfBabelNamespace !== -1) {
        return "/web_modules/" + importUrl.substring(indexOfBabelNamespace).replace(/\\/g, '/') + ".js"
    }
}

function rewriteWebModulesPlugin({types}) {

    let filename, imports, importMap;

    function rewriteImport(path, source) {

        const importUrl = source.node.value;
        const relativeUrl = importMap.get(importUrl) ?? resolveBabelRuntime(importUrl) ?? importUrl;

        if (importUrl !== relativeUrl) try {
            log.debug("resolved import:", `'${importUrl}'`, "as:", relativeUrl);
            source.replaceWith(types.stringLiteral(relativeUrl));
        } catch (error) {
            throw path.buildCodeFrameError(`Could not resolve import '${importUrl}'. ${error.message}`);
        }

        if (relativeUrl) {
            imports.add(relativeUrl);
            log.debug(filename, "collected link:", relativeUrl);
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
            'CallExpression'(path, state) {
                const isImport = path.node.callee.type === 'Import';
                const isRequire = path.node.callee.name === 'require';
                if (isImport || isRequire) {
                    const [source] = path.get('arguments');
                    if (source.type === 'StringLiteral') {
                        rewriteImport(path, source);
                    } else {
                        log.warn("unexpected: 'source.type is not a StringLiteral' at:", path, "in:", this.filename);
                    }
                }
            },
            'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, state) {
                const source = path.get('source');
                if (source.node !== null) {
                    rewriteImport(path, source);
                }
            }
        },
    };
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
                    importMap.set(importUrl, resolveImport(filename, importUrl));
                } else {
                    log.error`unexpected: 'source.type is not a StringLiteral' at: ${path}, in: ${this.filename}`
                }
            }
        },
        'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, state) {
            const source = path.get('source');
            if (source.node !== null) {
                const importUrl = source.node.value;
                importMap.set(importUrl, resolveImport(filename, importUrl));
            }
        }
    });

    for (const [key, value] of importMap.entries()) {
        importMap.set(key, await value);
    }

    return {parsedAst, rewritePlugin: [rewriteWebModulesPlugin, {importMap}]};
}

module.exports = {
    traverseAsync
}
