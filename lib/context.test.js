describe("context", function () {

    const {mockRequest, mockResponse} = require("../test/test.setup.js");
    const {Context} = require("./context.js");

    const {vary} = require("./context.js");

    it("vary headers are concatenated unless an explicit set is invoked", function () {

        const ctx = new Context(mockRequest(), mockResponse());

        ctx.vary("Origin");
        expect(ctx.response.getHeader("vary")).toBe("Origin");
        ctx.vary("Accept-Encoding");
        expect(ctx.response.getHeader("vary")).toBe("Origin, Accept-Encoding");

        ctx.headers.delete("vary");
        expect(ctx.response.getHeader("vary")).toBeUndefined();
        ctx.vary("Content-Type");
        expect(ctx.response.getHeader("vary")).toBe("Content-Type");
    });

    it("url parsing", function () {

        let ctx;

        ctx = new Context();
        ctx.url = "/";
        expect(ctx).toMatchObject({pathname: "/"});
        ctx = new Context();
        ctx.url = "/abc/def";
        expect(ctx).toMatchObject({pathname: "/abc/def"});
        ctx = new Context();
        ctx.url = "/abc/def#ghi";
        expect(ctx).toMatchObject({pathname: "/abc/def", fragment: "ghi"});
        ctx = new Context();
        ctx.url = "/abc/d%20ef?q=v";
        expect(ctx).toMatchObject({
            pathname: "/abc/d ef",
            search: "?q=v",
            query: expect.objectContaining({
                q: "v"
            })
        });

        ctx = new Context();
        ctx.url = "/abc/def?a%20b=c%3fd#1%202%203";
        expect(ctx).toMatchObject({
            pathname: "/abc/def",
            search: "?a%20b=c%3fd",
            query: expect.objectContaining({
                "a b": "c?d"
            }),
            fragment: "1 2 3"
        });
    });

});
