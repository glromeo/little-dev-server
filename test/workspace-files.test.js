describe("workspace files", function () {

    const {useFixture} = require("./fixture/index.js");
    const {server: {start, stop}, fetch, rootDir} = useFixture();

    const path = require("path");
    const fs = require("fs");
    const HttpStatus = require("http-status-codes");

    const {useWorkspaceFiles} = require("../lib/pipeline/workspace-files.js");
    const {readWorkspaceFile} = useWorkspaceFiles({rootDir});

    describe("unit tests", function () {

        const {size, mtime} = fs.statSync(`${rootDir}/package.json`);

        it("can serve a json file", async function () {
            const {content, headers} = await readWorkspaceFile("/package.json");
            expect(JSON.parse(content).name).toBe("@test/fixture");
            expect(headers["content-type"]).toBe("application/json; charset=UTF-8");
            expect(headers["content-length"]).toBe(size);
            expect(headers["last-modified"]).toMatch(mtime.toUTCString());
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
                message: `Error: ENOENT: no such file or directory, stat '${path.join(rootDir, "/missing.file")}'`
            });
        });
    });

    describe("integration tests", function () {

        beforeAll(start);
        afterAll(stop);

        it("can serve package.json", async function () {
            const response = await fetch("/package.json");
            expect(response.ok).toBe(true);
            expect(response.headers.get("content-type")).toBe("application/json; charset=UTF-8");
            const packageJson = await response.json();
            expect(packageJson.name).toBe("@test/fixture");
        });
    });
});

