describe("context", function () {

    const {mockRequest, mockResponse} = require("../test/test.setup.js");
    const {Context} = require("./context.js");

    const {vary} = require("./context.js");

    it("vary headers are concatenated unless an explicit set is invoked", function () {

        const ctx = new Context(mockRequest(), mockResponse());

        ctx.vary("Origin");
        expect(ctx.header("vary")).toBe("Origin");
        ctx.vary("Accept-Encoding");
        expect(ctx.header("vary")).toBe("Origin, Accept-Encoding");

        ctx.headers.delete("vary");
        expect(ctx.headers.get("vary")).toBeUndefined();
        ctx.vary("Content-Type");
        expect(ctx.headers.get("vary")).toBe("Content-Type");
    });


});