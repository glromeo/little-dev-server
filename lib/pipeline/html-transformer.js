const htmlparser2 = require("htmlparser2");
const {createBabelTransformer} = require("../pipeline/babel-transformer");
const contentText = require("../utility/content-text");
const {usePluginWebModules} = require("../babel/plugin-web-modules.js");
const log = require("tiny-node-logger");

module.exports.HTML_CONTENT_TYPE = "text/html; charset=utf-8";

module.exports.createHtmlTransformer = function (config, watcher) {

    const {rewriteUrl} = usePluginWebModules(config);

    const babelTransformer = createBabelTransformer(config, watcher);

    const pendingTasks = new Map();

    async function transform(filename, content) {

        const pendingTask = pendingTasks.get(filename);
        if (pendingTask) {
            return (await pendingTask);
        }

        const transformTask = new Promise(async (resolve, reject) => {

            let currentModule, imports = new Set();

            let html = [];

            const parser = new htmlparser2.Parser(
                {
                    onprocessinginstruction(name, data) {
                        html.push('<' + data + '>');
                    },
                    onopentag(name, attribs) {

                        if (name === 'script') {
                            const type = attribs["type"];
                            if (type === "module") {
                                const src = attribs["src"];
                                if (src) {
                                    // rewriteUrl(src).then(...)
                                    attribs["src"] = rewriteUrl(src);
                                    imports.add(src.value);
                                } else {
                                    currentModule = filename;
                                }
                            }
                        }

                        const keys = Object.keys(attribs);
                        if (keys.length > 0) {
                            html.push('<' + name + ' ' + keys.map(name => {
                                const value = attribs[name];
                                return value ? `${name}="${value}"` : name;
                            }).join(' ') + '>');
                        } else {
                            html.push('<' + name + '>');
                        }
                    },
                    onclosetag(name) {
                        if (name === 'script' && currentModule) {
                            currentModule = undefined;
                        }
                        html.push('</' + name + '>');
                    },
                    ontext(text) {

                        if (currentModule && text.trim()) {
                            html.push(
                                babelTransformer({
                                    filename: currentModule,
                                    content: text
                                }).then(({content, links}) => {
                                    for (const importUrl of links) {
                                        imports.add(importUrl);
                                    }
                                    return content;
                                })
                            );
                        } else {
                            html.push(text);
                        }
                    },
                    oncomment(text) {
                        html.push('<!--' + text + '-->');
                    },
                    oncdatastart() {
                        html.push('<![CDATA[');
                    },
                    oncdataend() {
                        html.push(']]>');
                    },
                    onerror(error) {
                        log.error("failed to transform html file: ", filename);
                        reject(error)
                    },
                    async onend() {
                        for (let h = 0; h < html.length; h++) if (typeof html[h] !== "string") try {
                            html[h] = await html[h];
                        } catch (error) {
                            reject(error);
                        }
                        resolve({
                            html: html.join(''),
                            imports
                        });
                    }
                },
                {
                    decodeEntities: true,
                    recognizeCDATA: true,
                    recognizeSelfClosing: true
                }
            );

            parser.end(
                await contentText(content)
            );
        });

        pendingTasks.set(filename, transformTask);
        try {
            return await transformTask;
        } finally {
            pendingTasks.delete(filename);
        }
    }

    return async function htmlTransformer({filename, content}) {
        const {html, imports} = await transform(filename, content);
        return {
            content: html,
            contentLength: html.length,
            contentType: module.exports.HTML_CONTENT_TYPE,
            links: imports
        }
    }
};
