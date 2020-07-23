describe("server", function () {

    const http = require("http");
    const http2 = require("http2");
    const https = require("https");

    const fs = require("fs");
    const {configure} = require("../lib/config.js");
    const {startServer} = require("../lib/server.js");
    const {contentText} = require("../lib/util/content-utils.js");
    const fetch = require("node-fetch");

    const logLevel = "debug";

    jest.mock("../lib/request-handler.js", function () {
        return {
            createRequestHandler(config, watcher) {
                expect(watcher).toBeDefined();
                return function (req, res) {
                    const isHttp2 = parseFloat(req.httpVersion) >= 2;
                    if (req.method === "POST") {
                        res.writeHead(200, isHttp2 ? undefined : "OK", {
                            "content-type": req.headers["content-type"]
                        });
                        req.pipe(res);
                    } else {
                        res.writeHead(200, isHttp2 ? undefined : "OK", {
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
            config.server.port = 8080;
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
                expect(res.headers.get("content-type")).toBe("application/json; charset=UTF-8");
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

        let module, server, address, agent;

        beforeAll(async function () {
            config.server.port = 8443;
            const instance = await startServer(config);
            module = instance.module;
            server = instance.server;
            address = instance.address;
            agent = new https.Agent({
                ca: fs.readFileSync(`cert/rootCA.pem`)
            });
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("the server was started using http module", function () {
            expect(module).toStrictEqual(https);
        });

        it("simple get functionality", async function () {
            expect(await fetch(`${address}/`, {agent}).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.text();
            })).toMatch("HELLO");
        });

        it("simple post functionality", async function () {
            expect(await fetch(`${address}/`, {
                agent,
                method: "POST",
                headers: {"content-type": "application/json; charset=UTF-8"},
                body: JSON.stringify({message: "HELLO"})
            }).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("application/json; charset=UTF-8");
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

        let module, server, address, agent;

        beforeAll(async function () {
            config.server.port = 9443;
            const instance = await startServer(config);
            module = instance.module;
            server = instance.server;
            address = instance.address;
            agent = new https.Agent({
                ca: fs.readFileSync(`cert/rootCA.pem`)
            });
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("the server was started using http module", function () {
            expect(module).toStrictEqual(http2);
        });

        it("simple get functionality", async function () {
            expect(await fetch(`${address}/`, {agent}).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
                return res.text();
            })).toMatch("HELLO");
        });

        it("simple post functionality", async function () {
            expect(await fetch(`${address}/`, {
                agent,
                method: "POST",
                headers: {"content-type": "application/json; charset=UTF-8"},
                body: JSON.stringify({message: "HELLO"})
            }).then(res => {
                expect(res.ok).toBe(true);
                expect(res.headers.get("content-type")).toBe("application/json; charset=UTF-8");
                return res.json();
            }).then(({message}) => {
                return message;
            })).toMatch("HELLO");
        });

        it("http2 connect", async function () {

            const client = http2.connect(`${address}`, {
                ca: fs.readFileSync(`cert/rootCA.pem`)
            });

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
                        expect(headers[":status"]).toBe(200);
                        expect(headers["content-type"]).toBe("application/json; charset=UTF-8");
                        expect(flags).toBe(4);
                        expect(JSON.parse(await contentText(post))).toMatchObject({
                            message: "HELLO H2"
                        });
                        done();
                    });
                    post.end(JSON.stringify({message: "HELLO H2"}));
                })
            ]);

            await new Promise(closed => client.close(closed));
        });
    });

    describe("http2 over http", function () {

        const config = configure({
            logLevel,
            server: {
                options: undefined
            },
            http2: "link",
            onexit: jest.fn()
        });

        let server, address, agent;

        beforeAll(async function () {
            config.server.port = 9090;
            const instance = await startServer(config);
            server = instance.server;
            address = instance.address;
            agent = new https.Agent({
                ca: fs.readFileSync(`cert/rootCA.pem`)
            });
        });

        afterAll(async function () {
            await server.shutdown();
            expect(config.onexit).toHaveBeenCalledWith(server);
        });

        it("can start/stop a server with pending connections", async exit => {

            const client = http2.connect(`${address}`);

            client.on("close", exit);

            const closed = new Promise(closed => {
                client.on("error", function (err) {
                    expect(err.code).toMatch("ECONNRESET");
                    client.close(closed);
                });
            });

            await new Promise(next => {
                const req = client.request({
                    ":path": "/",
                    ":method": "POST",
                    "content-type": "text/plain; charset=UTF-8"
                });
                req.on('error', function (err) {
                    expect(err.code).toMatch("ECONNRESET");
                })
                req.on("response", (headers, flags) => {
                    expect(headers[":status"]).toBe(200);
                    expect(headers["content-type"]).toBe("text/plain; charset=UTF-8");
                    expect(flags).toBe(4);
                    next();
                    req.end("late message");
                });
            });

            await server.shutdown();

            await closed;

            expect(client.closed).toBe(true);
        });

    });

});


