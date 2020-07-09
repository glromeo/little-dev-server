describe("cors", function () {

    const {Context} = require("../context.js");
    const {useAccessControl} = require("./access-control.js");

    it("no origin", async function () {

        const req = {headers: {}};

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = new Context(req, res);
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([["vary", "origin"]]);
    });

    it("method === OPTIONS", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "origin": "anywhere",
                "access-control-request-method": "POST",
                "access-control-request-headers": "origin, accept"
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = new Context(req, res);
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*"
            }
        });
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["vary", "origin"],
            ["access-control-allow-origin", "*"],
            ["access-control-allow-methods", "GET, HEAD"],
            ["access-control-allow-headers", "origin, accept"]
        ]);
    });

    it("method === OPTIONS alternate", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "origin": "anywhere",
                "access-control-request-method": "POST"
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = new Context(req, res);
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*",
                methods: "GET, HEAD, PUT, POST, DELETE, PATCH",
                headers: "x-requested-with, accept, content-type",
                credentials: true
            }
        });
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["vary", "origin"],
            ["access-control-allow-origin", "*"],
            ["access-control-allow-methods", "GET, HEAD, PUT, POST, DELETE, PATCH"],
            ["access-control-allow-credentials", "true"],
            ["access-control-allow-headers", "x-requested-with, accept, content-type"]
        ]);
    });

    it("method === OPTIONS (missing Access-Control-Request-Method)", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "origin": "anywhere"
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = new Context(req, res);
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...res.entries()]).tomatchobject([
            ["vary", "origin"]
        ]);
    });

    it("method === POST", async function () {

        const req = {method: "POST", headers: {"origin": "anywhere"}};

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = new Context(req, res);
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {expose: "*", credentials: true}});
        await accessControl(ctx, next);

        expect([...res.entries()]).tomatchobject([
            ["vary", "origin"],
            ["access-control-allow-origin", "anywhere"],
            ["access-control-allow-methods", "GET, HEAD"],
            ["access-control-allow-credentials", "true"],
            ["access-control-expose-headers", "*"]
        ]);
    });
});
