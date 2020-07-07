describe("resource cache", function () {

    const path = require("path");
    const {contentText} = require("../utility/content-utils.js");
    const {useResourceCache} = require("./resource-cache.js");
    const {testServer, fixtureDir} = require("../../test/test.setup.js");

    const {serveStatic} = useServeStatic({rootDir: fixtureDir});

    describe("unit tests", function () {

        it("can serve a file", async function () {
            const {
                content,
                contentType,
                contentLength,
                lastModified
            } = await serveStatic({pathname: "/package.json"});

            const text = await contentText(content);

            expect(JSON.parse(text).name).toBe("@test/fixture");
            expect(contentType).toBe("application/json; charset=UTF-8");
            expect(contentLength).toBe(535);
            expect(lastModified).toMatchObject(new Date("2020-06-30T07:27:16.361Z"));
        })

        it("redirects missing /favicon.ico to /resources/javascript.png", async function () {
            await expect(serveStatic({pathname: "/favicon.ico"}))
                .rejects
                .toStrictEqual({redirect: "/resources/javascript.png"});
        });

        it("fails if it's a missing file", async function () {
            await expect(serveStatic({pathname: "/missing.file"}))
                .rejects
                .toStrictEqual({
                    code: "ENOENT",
                    message: "no such file or directory: " + path.join(fixtureDir, "/missing.file")
                });
        });
    })

    describe("integration tests", function () {

        let server, fetch;

        beforeAll(async function () {
            const setup = await testServer({rootDir: fixtureDir});
            server = setup.server;
            fetch = setup.fetch;
        })

        afterAll(async function () {
            await server.shutdown();
        })

        it("can serve package.json", async function () {
            const response = await fetch("/package.json");
            expect(response.ok).toBe(true);
            expect(response.headers["content-type"]).toBe("application/json; encoding=UTF-8");
            const packageJson = await response.json();
            expect(packageJson.name).toBe("@test/fixture");
        })
    })
})
