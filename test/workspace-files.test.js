describe("workspace files", function () {

    const {useWorkspaceFiles} = require("../lib/pipeline/workspace-files.js");
    const path = require("path");
    const HttpStatus = require("http-status-codes");
    const {testServer, fixtureDir} = require("./.setup.js");

    const {readWorkspaceFile} = useWorkspaceFiles({rootDir: fixtureDir});

    describe("unit tests", function () {

        it("can serve a json file", async function () {
            const {content, headers} = await readWorkspaceFile("/package.json");
            expect(JSON.parse(content).name).toBe("@test/fixture");
            expect(headers["content-type"]).toBe("application/json; charset=UTF-8");
            expect(headers["content-length"]).toBe(548);
            expect(headers["last-modified"]).toMatch("Sun, 19 Jul 2020 08:20:28 GMT");
        });

        it("redirects missing /favicon.ico to /resources/javascript.png", async function () {
            await expect(readWorkspaceFile("/favicon.ico")).rejects.toMatchObject({
                code: HttpStatus.PERMANENT_REDIRECT,
                headers: {"location": "/resources/javascript.png"}
            });
        });

        it("fails if it's a missing file", async function () {
            await expect(readWorkspaceFile("/missing.file")).rejects.toMatchObject({
                code: HttpStatus.NOT_FOUND,
                message: `Error: ENOENT: no such file or directory, stat '${path.join(fixtureDir, "/missing.file")}'`
            });
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
            expect(response.headers.get("content-type")).toBe("application/json; charset=UTF-8");
            const packageJson = await response.json();
            expect(packageJson.name).toBe("@test/fixture");
        });
    });
});

