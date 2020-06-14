const {testServer} = require("./test.config.js");
const path = require("path");

const {writeFileSync} = require("fs");

describe("pipeline test", function () {

    jest.setTimeout(30*1000);

    let config, server, watcher, fetch;

    beforeAll(async function () {
        const test = await testServer({port: 3030});
        config = test.config;
        server = test.server;
        watcher = test.watcher;
        fetch = test.fetch;
    });

    afterAll(async function () {
        await server.shutdown();
    });

    it("can serve a static file with headers", async function () {

        config.etag = undefined;

        return fetch(`/public/hello-world.txt?ignored`).then(response => {
            expect(response.ok).toBe(true);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
            expect(response.headers.raw()).toMatchObject({
                "etag": ["\"80-/JdUAISwNpmsH7g1l+aj8Un5rPE\""],
                "content-length": ["12"],
                "content-type": ["text/plain; charset=utf-8"],
                "last-modified": ["Mon, 01 Jun 2020 01:12:35 GMT"]
            });
            expect(response.headers.get('connection')).toMatch("close");
            return response.text();
        }).then(text => {
            expect(text).toEqual("Hello World!");
        });
    });

    it("if the file is missing returns 404", async function () {

        return fetch(`/public/file-not-found`).then(response => {
            expect(response.ok).toBe(false);
            expect(response.status).toBe(404);
            expect(response.statusText).toBe("Not Found");
            expect(Array.from(response.headers.keys())).toStrictEqual(["connection", "date", "transfer-encoding"]);
        });
    });

    it("expect broken javascript file causes 500", async function () {

        return fetch(`/src/broken.js`).then(response => {
            expect(response.ok).toBe(false);
            expect(response.status).toBe(500);
            expect(response.statusText).toBe("Server Error");
            expect(Array.from(response.headers.keys())).toStrictEqual(["connection", "date", "transfer-encoding"]);
            return response.text();
        }).then(text => {
            expect(text).toContain("Unexpected token (2:0)");
        });
    });

    it("can use weak etag", async function () {

        config.etag = {
            weak: true
        };

        return fetch(`/public/hello-world.txt`).then(response => {
            expect(response.headers.get('etag')).toMatch("W/\"80-/JdUAISwNpmsH7g1l+aj8Un5rPE\"");
        });
    });

    it("javascript files are transpiled by babel", async function () {

        return fetch(`/src/sample-component.mjs?ignored`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toMatch("application/javascript; charset=utf-8");
            return response.text();
        }).then(text => {
            expect(text).toContain("import _decorate from \"/web_modules/@babel/runtime/helpers/esm/decorate.js\";");
            expect(text).toContain("<h1>Hello World! =K<");
        });
    });

    it("sass files by default are transpiled by node-sass in plain css", async function () {

        return fetch(`/public/simple-sass.scss`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toMatch("text/css; charset=utf-8");
            return response.text();
        }).then(text => {
            expect(text).toBe("html body{background-color:red}\n");
        });
    });

    it("sass files requested as format=mjs are transpiled by node-sass in module imports", async function () {

        return fetch(`/src/w3.scss?format=mjs`).then(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toMatch("application/javascript; charset=utf-8");
            return response.text();
        }).then(text => {
            expect(text).toContain(`import { css } from "/web_modules/lit-element/lit-element.js";`);
            expect(text).toContain(`html{box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}`);
        });
    });

    it("mount example", async function () {

        await fetch(`/mount-example/hello-world.txt`).then(response => {
            expect(response.ok).toBe(true);
            return response.text();
        }).then(text => {
            expect(text).toEqual("Bonjour Monde!");
        });
    });

    it("cache functionality", async function () {

        const tempFile = path.resolve(config.rootDir, "__temp_file__.scss");

        writeFileSync(tempFile, `
            .cache_functionality_test {
                background-color: white;
            }
        `, 'utf-8');

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".cache_functionality_test");
        });

        const watched = watcher.getWatched();

        expect(watched['.'].length).toBe(1);

        await new Promise(resolve => {

            watcher.on("change", resolve);

            writeFileSync(tempFile, `
                .updated_class {
                    background-color: red;
                }
            `, 'utf-8');
        });

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".updated_class");
        });
    });

});