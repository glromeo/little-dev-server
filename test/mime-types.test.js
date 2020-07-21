describe("mime types", function () {

    const mime = require("../lib/util/mime-types");

    it("lookup by plain ext without .", function () {
        expect(mime.contentType("js")).toStrictEqual("application/javascript; charset=UTF-8");
        expect(mime.contentType()).toBeUndefined();
    });

    it(". is supported but discouraged", function () {
        expect(mime.contentType(".js")).toStrictEqual("application/javascript; charset=UTF-8");
    });

    it("supports ts, tsx and jsx", function () {
        expect(mime.contentType("ts")).toStrictEqual("application/x-typescript; charset=UTF-8");
        expect(mime.contentType("tsx")).toStrictEqual("application/x-typescript; charset=UTF-8");
        expect(mime.contentType("jsx")).toStrictEqual("application/javascript; charset=UTF-8");
    });

    it("can lookup by full filename (no urls!)", function () {
        expect(mime.contentType("path/file.html")).toStrictEqual("text/html; charset=UTF-8");
        expect(mime.contentType("path/file.html?q=v")).toBeUndefined();
        expect(mime.contentType("path/file")).toBeUndefined();
    });

});
