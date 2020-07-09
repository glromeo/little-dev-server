describe("server", function () {

    const http = require("http");
    const http2 = require("http2");
    const https = require("https");
    const fs = require("fs");
    const {configure} = require("./configuration.js");
    const {startServer} = require("./server.js");
    const {testServer} = require("../test/test.setup.js");
    const {contentText} = require("./utility/content-utils.js");

    it("can start/stop an http server", async () => {

        const onexit = jest.fn();

        const {module, server, address} = await startServer(configure({
            logLevel: "info",
            server: {
                options: undefined
            },
            http2: false,
            routing: router => {
                router.get("/hello", () => "Hello World! ...from the http server");
                router.get("/not-found", () => fs.readFileSync("404_HTTP"));
            },
            onexit: onexit
        }));

        // by having removed the options the server was started using http
        expect(module).toStrictEqual(http);

        try {
            const success = await new Promise(resolve => http.get(`${address}/hello`, resolve));
            expect(await contentText(success)).toMatch("Hello World! ...from the http server");
            expect(success.statusCode).toBe(200);
            expect(success.statusMessage).toBe("OK");

            const failure = await new Promise(resolve => http.get(`${address}/not-found`, resolve));
            expect(await contentText(failure)).toMatch("Error: ENOENT: no such file or directory, open '404_HTTP'");
            expect(failure.statusCode).toBe(404);
            expect(failure.statusMessage).toBe("Not Found");

        } finally {
            await server.shutdown();
            expect(onexit).toHaveBeenCalledWith(server);
        }
    });

    it("can start/stop an https server", async () => {

        const onexit = jest.fn();

        const {config, module, server, address} = await startServer(configure({
            logLevel: "info",
            http2: false,
            routing: router => {
                router.get("/hello", () => "Hello World! ...from the https server");
                router.get("/not-found", () => fs.readFileSync("404_HTTPS"));
            },
            onexit: onexit
        }));

        // key &% cert are loaded from cert folder and put in options by configure
        expect(module).toStrictEqual(https);

        try {
            const success = await new Promise(async resolve => https.get(`${address}/hello`, {
                ca: await config.readFile("cert/rootCA.pem")
            }, resolve));
            expect(await contentText(success)).toMatch("Hello World! ...from the https server");
            expect(success.statusCode).toBe(200);
            expect(success.statusMessage).toBe("OK");

            const failure = await new Promise(async resolve => https.get(`${address}/not-found`, {
                ca: await config.readFile("cert/rootCA.pem")
            }, resolve));
            expect(await contentText(failure)).toMatch("Error: ENOENT: no such file or directory, open '404_HTTPS'");
            expect(failure.statusCode).toBe(404);
            expect(failure.statusMessage).toBe("Not Found");

        } finally {
            await server.shutdown();
            expect(onexit).toHaveBeenCalledWith(server);
        }
    });

    it("can start/stop an http2 server", async () => {

        const onexit = jest.fn();

        const {config, module, server, address} = await startServer(configure({
            logLevel: "info",
            http2: true,
            routing: router => {
                router.get("/hello", () => "Hello World! ...from the http2 server");
                router.get("/not-found", () => fs.readFileSync("404_HTTP2"));
            },
            onexit: onexit
        }));

        // key &% cert are loaded from cert folder and put in options by configure
        expect(module).toStrictEqual(http2);

        try {
            const client = http2.connect(`https://${config.server.host}:${config.server.port}`, {
                ca: await config.readFile("cert/rootCA.pem")
            });

            client.on("error", fail);

            await Promise.all([
                new Promise(async done => {
                    const success = client.request({":path": "/hello"});
                    success.on("response", async (headers, flags) => {
                        expect(headers[":status"]).toBe(200);
                        expect(headers["content-type"]).toBe("text/plain; charset=UTF-8");
                        expect(flags).toBe(4);
                        expect(await contentText(success)).toMatch("Hello World! ...from the http2 server");
                        done();
                    });
                }),
                new Promise(async done => {
                    const failure = client.request({":path": "/not-found"});
                    failure.on("response", async (headers, flags) => {
                        expect(headers[":status"]).toBe(404);
                        expect(headers["content-type"]).toBeUndefined();
                        expect(flags).toBe(4);
                        expect(await contentText(failure)).toMatch("Error: ENOENT: no such file or directory, open '404_HTTP2'");
                        done();
                    });
                })
            ]);

            client.close();

        } finally {
            await server.shutdown();
            expect(onexit).toHaveBeenCalledWith(server);
        }
    });

    it("can start/stop a server with pending connections", async () => {
        const {server, watcher} = await startServer(configure({
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

    describe("integration tests", function () {

        let config, server, watcher, fetch;

        beforeAll(async function () {
            const test = await testServer({server: {port: 3040}});
            config = test.config;
            server = test.server;
            watcher = test.watcher;
            fetch = test.fetch;
        });

        afterAll(async function () {
            await server.shutdown();
        });

        it("can serve https", async function () {

            const res = await new Promise(done => require("https").get({
                hostname: config.server.host,
                port: config.server.port,
                path: "/public/hello-world.txt",
                ca: fs.readFileSync(path.resolve(__dirname, "../cert/rootCA.pem"))
            }, done));

            expect(res.statusCode).toBe(200);
            expect(res.headers["content-type"]).toBe("text/plain; charset=UTF-8");

            const data = await contentText(res);

            expect(data).toMatch("Hello World!");
        });

        it("can serve http2", () => new Promise(done => {

            const client = require("http2").connect(`https://${config.server.host}:${config.server.port}`, {
                ca: fs.readFileSync(path.resolve(__dirname, "../cert/rootCA.pem"))
            });
            client.on("error", fail);

            const req = client.request({":path": "/public/hello-world.txt"});

            req.on("response", (headers, flags) => {
                expect(headers[":status"]).toBe(200);
                expect(headers["content-type"]).toBe("text/plain; charset=UTF-8");
                expect(flags).toBe(4);
            });

            let data = "";
            req.setEncoding("utf8");
            req.on("data", (chunk) => data += chunk);
            req.on("end", () => {
                expect(data).toMatch("Hello World!");
                client.close();
                done();
            });

            req.end();
        }));

    });

}, "server");


