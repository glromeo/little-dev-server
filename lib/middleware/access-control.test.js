describe("cors", function () {

    const {Context} = require("../context.js");
    const {useAccessControl} = require("./access-control.js");

    it("no client origin", async function () {

        const ctx = new Context({method: "POST", url: "/", headers: {}}, {});
        ctx.header = jest.spyOn(ctx, "header");
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...ctx.headers]).toMatchObject([["vary", "origin"]]);
        expect(ctx.header).toHaveBeenCalledWith("origin");
        expect(next).toHaveBeenCalled();
    });

    it("OPTIONS method but no 'access-control-request-method'", async function () {

        const ctx = new Context({method: "OPTIONS", url: "/", headers: {origin: "localhost"}}, {});
        ctx.header = jest.spyOn(ctx, "header");
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...ctx.headers]).toMatchObject([["vary", "origin"]]);
        expect(ctx.header).toHaveBeenCalledWith("origin");
        expect(next).toHaveBeenCalled();
    });

    it("OPTIONS method with 'access-control-request-method'", async function () {

        const ctx = new Context({
            method: "OPTIONS", url: "/", headers: {
                "origin": "localhost",
                "access-control-request-method": "POST",
                "access-control-request-headers": "origin, accept"
            }
        }, {});
        ctx.send = jest.fn();
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*"
            }
        });
        await accessControl(ctx, next);

        expect([...ctx.headers]).toMatchObject([
            ["vary", "origin"],
            ["access-control-allow-origin", "*"],
            ["access-control-allow-methods", "GET, HEAD"],
            ["access-control-allow-headers", "origin, accept"]
        ]);
        expect(ctx.send).toHaveBeenCalled();
    });

    it("OPTIONS method with headers and credentials in config", async function () {

        const ctx = new Context({
            method: "OPTIONS", url: "/", headers: {
                "origin": "anywhere",
                "access-control-request-method": "DELETE",
                "access-control-request-headers": "origin, accept"
            }
        }, {});
        ctx.send = jest.fn();
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                methods: "GET, HEAD, PUT, POST, DELETE, PATCH",
                headers: "x-requested-with, accept, content-type",
                credentials: true
            }
        });
        await accessControl(ctx, next);

        expect([...ctx.headers]).toMatchObject([
            ["vary", "origin"],
            ["access-control-allow-origin", "anywhere"],
            ["access-control-allow-methods", "GET, HEAD, PUT, POST, DELETE, PATCH"],
            ["access-control-allow-credentials", "true"],
            ["access-control-allow-headers", "x-requested-with, accept, content-type"]
        ]);
        expect(ctx.send).toHaveBeenCalled();
    });

    it("method === POST", async function () {

        const ctx = new Context({method: "POST", url: "/", headers: {"origin": "anywhere"}}, {});
        ctx.send = jest.fn();
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*",
                methods: "GET, HEAD",
                headers: "x-requested-with, accept, content-type",
                credentials: true,
                expose: "*"
            }
        });
        await accessControl(ctx, next);

        expect([...ctx.headers]).toMatchObject([
            ["vary", "origin"],
            ["access-control-allow-origin", "*"],
            ["access-control-allow-methods", "GET, HEAD"],
            ["access-control-allow-credentials", "true"],
            ["access-control-expose-headers", "*"]
        ]);
        expect(ctx.send).not.toHaveBeenCalled();
    });
});
