const mime = require("../lib/utility/mime-types");

describe("mime types", function () {

    it("lookup by ext", function () {
        expect(mime.contentType("js")).toStrictEqual("application/javascript; charset=UTF-8");
        expect(mime.contentType()).toBeUndefined();
    });

    it("lookup by filename", function () {
        expect(mime.contentType("path/file.html")).toStrictEqual("text/html");
        expect(mime.contentType("path/file")).toBeUndefined();
    });

});
