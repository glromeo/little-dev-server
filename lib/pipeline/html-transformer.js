const log = require("tiny-node-logger");
const path = require("path");
const {memoize} = require("../util/memoize.js");
const {isBare} = require("../util/quick-parse-url.js");
const {useBabelTransformer} = require("../pipeline/babel-transformer");
const {useWebModules} = require("../util/web-modules.js");
const {HTML_CONTENT_TYPE} = require("../util/mime-types.js");
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

        const imports = new Set();
        let scriptCount = 0;
        let scriptContext;
        let html = [];

        const dirname = path.dirname(filename);
        const basename = path.basename(filename);

        const stream = new htmlparser2.Parser({

            onprocessinginstruction(name, data) {
                html.push(processingInstruction(data));
            },

            onopentag(name, attribs) {

                if (name === "script" && !scriptContext) {
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
                        } else {
                            html.push(openTag(name, Object.entries(attribs)));
                            ++scriptCount;
                            scriptContext = html;
                            html = [];
                        }
                        return;
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
                if (name === "script" && scriptContext) {
                    const text = html.join("");
                    html = scriptContext;
                    const scriptname = filename + " <" + scriptCount + "> [sm]";
                    html.push(
                        babelTransformer(scriptname, text).then(({content, links}) => {
                            for (const importUrl of links) {
                                imports.add(importUrl);
                            }
                            return content;
                        })
                    );
                    scriptContext = undefined;
                }
                html.push(closeTag(name));
            },

            ontext(text) {
                html.push(text);
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
            xmlMode: false,
            decodeEntities: true,
            recognizeCDATA: true,
            recognizeSelfClosing: true
        });

        stream.end(content);
    });

    async function htmlTransformer(filename, content) {
        const {html, imports} = await transformHtmlAsync(filename, content);
        return {
            content: html,
            headers: {
                "content-type": HTML_CONTENT_TYPE,
                "content-length": Buffer.byteLength(html),
                "x-transformer": "html-transformer"
            },
            links: imports
        };
    }

    return {
        htmlTransformer
    };
});
