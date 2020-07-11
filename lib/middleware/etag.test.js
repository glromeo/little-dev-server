describe("etag", function () {

    const {Context} = require("../context.js");
    const {useETag} = require("./etag.js");

    it("adds etag header", async function () {

        const ctx = new Context({method: "POST", url: "/", headers: {}}, {});
        ctx.header = jest.spyOn(ctx, "header");

        const etag = useETag({});
        const next = jest.fn();
        await etag(ctx, next);

        expect([...ctx.headers]).toMatchObject([["etag", `"15-L5KQZoM7Pe+8KAdhrQ32jGUFMyQ"`]]);
        expect(ctx.header).toHaveBeenCalledWith("content-length");
        expect(ctx.header).toHaveBeenCalledWith("last-modified");
        expect(next).toHaveBeenCalled();
    });

    it("adds etag weak header", async function () {

        const ctx = new Context({method: "POST", url: "/", headers: {}}, {});
        ctx.header = jest.spyOn(ctx, "header");

        const etag = useETag({etag:{weak:true}});
        const next = jest.fn();
        await etag(ctx, next);

        expect([...ctx.headers]).toMatchObject([["etag", `W/"15-L5KQZoM7Pe+8KAdhrQ32jGUFMyQ"`]]);
        expect(ctx.header).toHaveBeenCalledWith("content-length");
        expect(ctx.header).toHaveBeenCalledWith("last-modified");
        expect(next).toHaveBeenCalled();
    });
});
