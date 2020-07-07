describe("cors", function () {

    const {useAccessControl} = require("./access-control.js");

    it("no Origin", async function () {

        const req = {headers: {}};

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = {req, res};
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([["Vary", "Origin"]]);
    })

    it("method === OPTIONS", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "Origin": "anywhere",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Origin, Accept"
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = {req, res};
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*",
            }
        });
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["Vary", "Origin"],
            ["Access-Control-Allow-Origin", "*"],
            ["Access-Control-Allow-Methods", "GET, HEAD"],
            ["Access-Control-Allow-Headers", "Origin, Accept"]
        ]);
    })

    it("method === OPTIONS alternate", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "Origin": "anywhere",
                "Access-Control-Request-Method": "POST"
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = {req, res};
        const next = jest.fn();

        const accessControl = useAccessControl({
            cors: {
                origin: "*",
                methods: "GET, HEAD, PUT, POST, DELETE, PATCH",
                headers: "X-Requested-With, Accept, Content-Type",
                credentials: true
            }
        });
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["Vary", "Origin"],
            ["Access-Control-Allow-Origin", "*"],
            ["Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, DELETE, PATCH"],
            ["Access-Control-Allow-Credentials", "true"],
            ["Access-Control-Allow-Headers", "X-Requested-With, Accept, Content-Type"]
        ]);
    })

    it("method === OPTIONS (missing Access-Control-Request-Method)", async function () {

        const req = {
            method: "OPTIONS",
            headers: {
                "Origin": "anywhere",
            }
        };

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = {req, res};
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {}});
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["Vary", "Origin"]
        ]);
    })

    it("method === POST", async function () {

        const req = {method: "POST", headers: {"Origin": "anywhere"}};

        const res = new Map();
        res.setHeader = res.set;
        res.getHeader = res.get;
        res.end = jest.fn();

        const ctx = {req, res};
        const next = jest.fn();

        const accessControl = useAccessControl({cors: {expose: "*", credentials: true}});
        await accessControl(ctx, next);

        expect([...res.entries()]).toMatchObject([
            ["Vary", "Origin"],
            ["Access-Control-Allow-Origin", "anywhere"],
            ["Access-Control-Allow-Methods", "GET, HEAD"],
            ["Access-Control-Allow-Credentials", "true"],
            ["Access-Control-Expose-Headers", "*"]
        ]);
    })
})
