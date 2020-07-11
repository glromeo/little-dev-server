describe("resource cache", function () {

    const path = require("path");
    const {contentText} = require("../utility/content-utils.js");
    const {useResourceCache} = require("./resource-cache.js");
    const {fixtureDir, testServer} = require("../../test/test.setup.js");

    let changeCallback;

    const disabledResourceCache = useResourceCache({cache: false}, {
        on(ignored, callback) {
        }
    });

    const resourceCache = useResourceCache({
        rootDir: fixtureDir,
        routing: router => {
            router.get("/**", useServer);
        },
        cache: true
    }, {
        on(ignored, callback) {
            changeCallback = callback;
        }
    });

    describe("unit tests", function () {

        it("if config.cache is falsy then caching is just disabled", async function () {
            const next = jest.fn().mockImplementation(ctx => ctx);
            disabledResourceCache({request: {url: "/xyz"}}, next);
            disabledResourceCache({request: {url: "/xyz"}}, next);
            expect(next).toHaveBeenCalledTimes(2);
        });

        it("can retrieve from the cache without invoking next", async function () {
            const next = jest.fn().mockImplementation(ctx => ctx);
            resourceCache({request: {url: "/xyz"}}, next);
            resourceCache({request: {url: "/xyz"}}, next);
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe("integration tests", function () {

        let server, fetch;

        beforeAll(async function () {
            const setup = await testServer({rootDir: fixtureDir});
            server = setup.server;
            fetch = setup.fetch;
        });

        afterAll(async function () {
            await server.shutdown();
        });

        it("can serve package.json", async function () {
            const response = await fetch("/package.json");
            expect(response.ok).toBe(true);
            expect(response.headers["content-type"]).toBe("application/json; encoding=UTF-8");
            const packageJson = await response.json();
            expect(packageJson.name).toBe("@test/fixture");
        });
    });
});
