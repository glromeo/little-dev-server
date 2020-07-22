describe("pipeline test", function () {

    jest.mock("etag");
    const etag = require("etag");
    etag.mockReturnValue("test-etag");

    const {useFixture} = require("./fixture/index.js");
    const {server:{start, stop}, fetch, resolve, config} = useFixture();

    const {statSync} = require("fs");

    beforeAll(start);
    afterAll(stop);

    it("can serve a static file with headers", async function () {

        const {size, mtime} = statSync(resolve("public/hello-world.txt"));

        const response = await fetch(`/public/hello-world.txt?ignored`);
        const text = await response.text();
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(response.headers.raw()).toMatchObject({
            "etag": ["test-etag"],
            "content-length": [`${size}`],
            "content-type": ["text/plain; charset=UTF-8"],
            "last-modified": [mtime.toUTCString()]
        });
        expect(response.headers.get("connection")).toMatch("close");
        expect(etag).toHaveBeenCalledWith(
            expect.stringMatching(`/public/hello-world.txt ${size} ${mtime.toUTCString()}`),
            config.etag
        );
        expect(text).toEqual("Hello World!");
    });

    it("if the file is missing returns 404", async function () {
        const response = await fetch(`/public/file-not-found`);
        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect([...response.headers.keys()]).toStrictEqual([
            "access-control-allow-credentials",
            "access-control-allow-origin",
            "connection",
            "date",
            "transfer-encoding"
        ]);
    });

    it("expect a broken javascript file to cause 500", async function () {
        const response = await fetch(`/src/broken.js`);
        expect(response.ok).toBe(false);
        expect(response.status).toBe(500);
        expect(response.statusText).toBe("Internal Server Error");
        expect([...response.headers.keys()]).toStrictEqual([
            "access-control-allow-credentials",
            "access-control-allow-origin",
            "connection",
            "date",
            "transfer-encoding"
        ]);
        const text = await response.text();
        expect(text).toContain("Unexpected token (2:0)");
    });

    it("javascript files are transpiled by babel", async function () {

        return fetch(`/src/sample-component.mjs?ignored`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toMatch("application/javascript; charset=UTF-8");
            return response.text();
        }).then(text => {
            expect(text).toContain("import _decorate from \"/web_modules/@babel/runtime/helpers/esm/decorate.js\";");
            expect(text).toContain("<h1>Hello World! 👋🌍<");
        });
    });

    it("sass files by default are transpiled by node-sass in plain css", async function () {

        return fetch(`/public/simple-sass.scss`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toMatch("text/css; charset=UTF-8");
            return response.text();
        }).then(text => {
            expect(text).toBe("html body{background-color:red}\n");
        });
    });

    it("sass files requested as type=module are transpiled by node-sass in module imports", async function () {

        return fetch(`/src/w3.scss?type=module`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toMatch("application/javascript; charset=UTF-8");
            return response.text();
        }).then(text => {
            expect(text).toContain(`import {css} from "/web_modules/lit-element/lit-element.js";`);
            expect(text).toContain(`html{box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}`);
        });
    });

    it("mount example", async function () {
        const response = await fetch(`/mount-example/hello-world.txt`);
        expect(response.ok).toBe(true);
        await expect(response.text()).resolves.toMatch("Bonjour Monde!");
    });

})

