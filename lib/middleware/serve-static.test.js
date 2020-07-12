describe("serve static", function () {

    const path = require("path");
    const {Context} = require("../context.js");
    const {contentText} = require("../utility/content-utils.js");
    const {useServeStatic} = require("./serve-static.js");
    const {testServer, fixtureDir} = require("../../test/test.setup.js");

    const Middleware = require("../utility/middleware.js");
    const {mockResponse} = require("../../test/test.setup.js");
    const {mockRequest} = require("../../test/test.setup.js");

    const {NOT_FOUND} = require("http-status-codes");

    const serveStatic = useServeStatic({rootDir: fixtureDir});

    let context;

    beforeEach(()=>{
        context = new Context(mockRequest(), mockResponse());
    })

    describe("unit tests", function () {

        it("can serve a json file", async function () {
            const {content, headers} = await Middleware.call(serveStatic, context.apply("/package.json"))
            const text = await contentText(content);
            expect(JSON.parse(text).name).toBe("@test/fixture");
            expect(headers.get("content-type")).toBe("application/json; charset=UTF-8");
            expect(headers.get("content-length")).toBe(524);
            expect(headers.get("last-modified")).toMatchObject(new Date("2020-07-09T13:47:47.378Z"));
        });

        it("redirects missing /favicon.ico to /resources/javascript.png", async function () {
            const next = jest.fn();
            context.redirect = jest.fn();
            await serveStatic(context.apply("/favicon.ico"), next);
            expect(next).not.toHaveBeenCalled();
            expect(context.redirect).toHaveBeenCalledWith("/resources/javascript.png");
        });

        it("fails if it's a missing file", async function () {
            const next = jest.fn();
            context.send = jest.fn();
            await serveStatic(context.apply("/missing.file"), next);
            expect(next).not.toHaveBeenCalled();
            expect(context.send).toHaveBeenCalledWith(
                NOT_FOUND, `Error: ENOENT: no such file or directory, stat '${path.join(fixtureDir, "/missing.file")}'`
            );
        });
    });

    describe("integration tests", function () {

        let server, fetch;

        beforeAll(async function () {
            const setup = await testServer({
                rootDir: fixtureDir,
                routing: router => {
                    router.get("/**", serveStatic)
                }
            });
            server = setup.server;
            fetch = setup.fetch;
        });

        afterAll(async function () {
            await server.shutdown();
        });

        it("can serve package.json", async function () {
            const response = await fetch("/package.json");
            expect(response.ok).toBe(true);
            expect(response.headers.get("content-type")).toBe("application/json; charset=UTF-8");
            const packageJson = await response.json();
            expect(packageJson.name).toBe("@test/fixture");
        });
    });
});

