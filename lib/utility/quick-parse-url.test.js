const fs = require("fs");
const path = require("path");

const {quickParseURL, nodeModuleBareUrl, isBare} = require("./quick-parse-url.js");

describe("quick parse URL", function () {

    it("nodeModuleBareUrl", async function () {
        expect(nodeModuleBareUrl(`C:${path.sep}little-dev-server${path.sep}node_modules${path.sep}@babel${path.sep}core${path.sep}lib${path.sep}parse.js`)).toStrictEqual("@babel/core/lib/parse.js");
        expect(nodeModuleBareUrl("/little-dev-server/node_modules/@babel/core/lib/parse.js")).toStrictEqual("@babel/core/lib/parse.js");
    });

    it("quickParseURL", async function () {
        function stripUndefined(obj) {
            const out = {};
            Object.keys(obj).filter(k => obj[k] !== undefined && k !== "href").forEach(k => out[k] = obj[k]);
            return out;
        }

        expect(stripUndefined(quickParseURL())).toStrictEqual({module: "undefined"});

        expect(stripUndefined(quickParseURL("."))).toStrictEqual({pathname: "."});
        expect(stripUndefined(quickParseURL(".."))).toStrictEqual({pathname: ".."});
        expect(stripUndefined(quickParseURL("../"))).toStrictEqual({pathname: "../"});
        expect(stripUndefined(quickParseURL("../."))).toStrictEqual({pathname: "../."});
        expect(stripUndefined(quickParseURL("/"))).toStrictEqual({pathname: "/"});
        expect(stripUndefined(quickParseURL("/.."))).toStrictEqual({pathname: "/.."});
        expect(stripUndefined(quickParseURL("http://127.0.0.1:8080/echo?query=message"))).toStrictEqual({
            scheme: "http", domain: "127.0.0.1:8080", pathname: "/echo", search: "query=message"
        });
        expect(stripUndefined(quickParseURL("http://username:password@127.0.0.1:8080/echo?query=message"))).toStrictEqual({
            scheme: "http", domain: "username:password@127.0.0.1:8080", pathname: "/echo", search: "query=message"
        });
        expect(stripUndefined(quickParseURL("name"))).toStrictEqual({module: "name"});
        expect(stripUndefined(quickParseURL(".name.ext"))).toStrictEqual({pathname: ".name.ext"});
        expect(stripUndefined(quickParseURL("name.js?query=q"))).toStrictEqual({
            pathname: "name.js",
            search: "query=q"
        });
        expect(stripUndefined(quickParseURL("./name"))).toStrictEqual({pathname: "./name"});
        expect(stripUndefined(quickParseURL("../a/b/name.ext?query=q&x=y"))).toStrictEqual({
            pathname: "../a/b/name.ext",
            search: "query=q&x=y"
        });
        expect(stripUndefined(quickParseURL("/name"))).toStrictEqual({pathname: "/name"});
        expect(stripUndefined(quickParseURL("/.name"))).toStrictEqual({pathname: "/.name"});
        expect(stripUndefined(quickParseURL("c:/name.ext"))).toStrictEqual({pathname: "c:/name.ext"});
        expect(stripUndefined(quickParseURL("c://name.ext"))).toStrictEqual({scheme: "c", domain: "name.ext"});
        expect(stripUndefined(quickParseURL("c://name.ext/file"))).toStrictEqual({
            scheme: "c",
            domain: "name.ext",
            pathname: "/file"
        });
        expect(stripUndefined(quickParseURL("ab://name.ext?q=e"))).toStrictEqual({
            scheme: "ab", domain: "name.ext", search: "q=e"
        });
        expect(stripUndefined(quickParseURL("c://name.ext/?q=e"))).toStrictEqual({
            scheme: "c", domain: "name.ext", pathname: "/", search: "q=e"
        });
        expect(stripUndefined(quickParseURL("/parent/name"))).toStrictEqual({pathname: "/parent/name"});
        expect(stripUndefined(quickParseURL("lit-html"))).toStrictEqual({module: "lit-html"});
        expect(stripUndefined(quickParseURL("parent/name"))).toStrictEqual({module: "parent", pathname: "name"});
        expect(stripUndefined(quickParseURL("@parent/name"))).toStrictEqual({module: "@parent/name"});
        expect(stripUndefined(quickParseURL("@parent/module/name"))).toStrictEqual({
            module: "@parent/module", pathname: "name"
        });
        expect(stripUndefined(quickParseURL("@parent/module/name.scss?type=module"))).toStrictEqual({
            module: "@parent/module", pathname: "name.scss", search: "type=module"
        });
    });

    it("isBare", function () {
        expect(!isBare(".")).toBe(true);
        expect(!isBare("..")).toBe(true);
        expect(!isBare("./")).toBe(true);
        expect(!isBare("../")).toBe(true);
        expect(!isBare(".a")).toBe(false);
        expect(!isBare("..a")).toBe(false);
    });

});
