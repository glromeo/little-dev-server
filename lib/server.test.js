describe("server", function () {

    const http = require("http");
    const http2 = require("http2");
    const https = require("https");
    const {OK, getStatusText} = require("http-status-codes");
    const {useRouter} = require("./router.js");

    const fs = require("fs");
    const {configure} = require("./configuration.js");
    const {startServer} = require("./server.js");
    const {contentText} = require("./utility/content-utils.js");
    const fetch = require("node-fetch");

    const logLevel = "debug";

    jest.mock("./request-handler.js", function () {
        return {
            createRequestHandler(config, watcher) {
                expect(watcher).toBeDefined();
                return function (req, res) {
                    if (req.method === "POST") {
                        res.writeHead(200, "OK", {
                            "content-type": req.headers["content-type"]
                        });
                        req.pipe(res);
                    } else {
                        res.writeHead(200, "OK", {
                            "content-type": "text/plain; charset=UTF-8"
                        });
                        res.end("HELLO");
                    }
                };
            }
        };
    });

    describe("basic http functionality", function () {

        const config = configure({
            logLevel,
            server: {
                options: undefined
            },
            http2: false,
            onexit: jest.fn()
        });

        let module, server, address;

        beforeAll(async function () {
            const instance = await startServer(config);
            module = instance.module;
            server = instance.server;
            address = instance.address;
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("the server was started using http module", function () {
            expect(module).toStrictEqual(http);
        });

        it("simple get functionality", async function () {
            expect(await fetch(`${address}/`).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.text();
            })).toMatch("HELLO");
        });

        it("simple post functionality", async function () {
            expect(await fetch(`${address}/`, {
                method: "POST",
                headers: {"content-type": "application/json; charset=UTF-8"},
                body: JSON.stringify({message: "HELLO"})
            }).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.json();
            }).then(({message}) => {
                return message;
            })).toMatch("HELLO");
        });
    });

    describe("basic https functionality", function () {

        const config = configure({
            logLevel,
            http2: false,
            onexit: jest.fn()
        });

        let module, server, address;

        beforeAll(async function () {
            const instance = await startServer(config);
            module = instance.module;
            server = instance.server;
            address = instance.address;
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("the server was started using http module", function () {
            expect(module).toStrictEqual(https);
        });

        it("simple get functionality", async function () {
            expect(await fetch(`${address}/`).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.text();
            })).toMatch("HELLO");
        });

        it("simple post functionality", async function () {
            expect(await fetch(`${address}/`, {
                method: "POST",
                headers: {"content-type": "application/json; charset=UTF-8"},
                body: JSON.stringify({message: "HELLO"})
            }).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.json();
            }).then(({message}) => {
                return message;
            })).toMatch("HELLO");
        });
    });

    describe("basic http2 functionality", function () {

        const config = configure({
            logLevel,
            http2: "preload",
            onexit: jest.fn()
        });

        let module, server, address;

        beforeAll(async function () {
            const instance = await startServer(config);
            module = instance.module;
            server = instance.server;
            address = instance.address;
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("the server was started using http module", function () {
            expect(module).toStrictEqual(http2);
        });

        it("simple get functionality", async function () {
            expect(await fetch(`${address}/`).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.text();
            })).toMatch("HELLO");
        });

        it("simple post functionality", async function () {
            expect(await fetch(`${address}/`, {
                method: "POST",
                headers: {"content-type": "application/json; charset=UTF-8"},
                body: JSON.stringify({message: "HELLO"})
            }).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.json();
            }).then(({message}) => {
                return message;
            })).toMatch("HELLO");
        });

        it("http2 connect", async function () {

            const client = http2.connect(`${address}`, {
                ca: await config.readFile("cert/rootCA.pem")
            });

            client.on("error", fail);

            await Promise.all([
                new Promise(async done => {
                    const get = client.request({
                        ":path": "/",
                        ":method": "GET"
                    });
                    get.on("response", async (headers, flags) => {
                        expect(headers[":status"]).toBe(200);
                        expect(headers["content-type"]).toBe("text/plain; charset=UTF-8");
                        expect(flags).toBe(4);
                        expect(await contentText(get)).toMatch("HELLO");
                        done();
                    });
                }),
                new Promise(async done => {
                    const post = client.request({
                        ":path": "/",
                        ":method": "POST",
                        "content-type": "application/json; charset=UTF-8"
                    });
                    post.on("response", async (headers, flags) => {
                        expect(headers[":status"]).toBe(404);
                        expect(headers["content-type"]).toBe("application/json; charset=UTF-8");
                        expect(flags).toBe(4);
                        expect(JSON.parse(await contentText(post))).toMatchObject({
                            message: "HELLO"
                        });
                        done();
                    });
                })
            ]);

            client.close();
        });
    });

    it("can start/stop a server with pending connections", async () => {
        const {server} = await startServer(configure({
            logLevel: "debug",
            routes: {
                "/": {
                    "GET": (req, res) => {
                        res.headers;
                        setInterval(() => {
                            res.send(Date.now());
                        }, 1000);
                    }
                }
            }
        }));
        await server.shutdown();
    });

});


