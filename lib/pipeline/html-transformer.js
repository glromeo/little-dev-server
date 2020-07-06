const log = require("tiny-node-logger");
const path = require("path");
const {memoize, once} = require("../utility/memoize.js");
const {isBare} = require("../utility/quick-parse-url.js");
const {useBabelTransformer} = require("../pipeline/babel-transformer");
const {useWebModules} = require("../utility/web-modules.js");
const {contentText} = require("../utility/content-utils.js");
const {HTML_CONTENT_TYPE} = require("../utility/mime-types.js");
const htmlparser2 = require("htmlparser2");

module.exports.useHtmlTransformer = memoize(config => {

    const {babelTransformer} = useBabelTransformer(config);
    const {resolveImport} = useWebModules(config);

    function openTag(name, attrs) {
        return "<" + name + " " + attrs.map(([name, value]) => value ? `${name}="${value}"` : name).join(" ") + ">";
    }

    function closeTag(name) {
        return "</" + name + ">";
    }

    function processingInstruction(data) {
        return "<" + data + ">";
    }

    function comment(text) {
        return "<!--" + text + "-->";
    }

    const transformHtmlAsync = async (filename, content) => new Promise(async (resolve, reject) => {

        let currentModule, imports = new Set();
        let html = [];

        const dirname = path.dirname(filename);

        new htmlparser2.Parser({

            onprocessinginstruction(name, data) {
                html.push(processingInstruction(data));
            },

            onopentag(name, attribs) {

                if (name === "script") {
                    const type = attribs["type"];
                    if (type === "module") {
                        const src = attribs["src"];
                        if (src && src.value) {
                            html.push(
                                resolveImport(dirname, src).then(relativeUrl => {
                                    if (!isBare(relativeUrl)) {
                                        imports.add(relativeUrl);
                                    }
                                    attribs["src"] = relativeUrl;
                                    return openTag(name, Object.entries(attribs));
                                })
                            );
                            return;
                        } else {
                            currentModule = filename;
                        }
                    }
                }

                const attrs = Object.entries(attribs);
                if (attrs.length > 0) {
                    html.push(openTag(name, attrs));
                } else {
                    html.push("<" + name + ">");
                }
            },

            onclosetag(name) {
                if (name === "script" && currentModule) {
                    currentModule = undefined;
                }
                html.push(closeTag(name));
            },

            ontext(text) {

                if (currentModule && text.trim()) {
                    html.push(
                        babelTransformer(currentModule, text).then(({content, links}) => {
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
                html.push(comment(text));
            },

            oncdatastart() {
                html.push("<![CDATA[");
            },

            oncdataend() {
                html.push("]]>");
            },

            onerror(error) {
                log.error("failed to transform html file: ", filename);
                reject(error);
            },

            async onend() {
                for (let h = 0; h < html.length; h++) if (typeof html[h] !== "string") try {
                    html[h] = await html[h];
                } catch (error) {
                    reject(error);
                }
                resolve({
                    html: html.join(""),
                    imports
                });
            }

        }, {
            decodeEntities: true,
            recognizeCDATA: true,
            recognizeSelfClosing: true
        }).end(
            await contentText(content)
        );
    });

    const htmlTransformer = once(async (filename, content) => {
        const {html, imports} = await transformHtmlAsync(filename, content);
        return {
            content: html,
            contentLength: html.length,
            contentType: HTML_CONTENT_TYPE,
            links: imports
        };
    });

    return {
        htmlTransformer
    };
});
