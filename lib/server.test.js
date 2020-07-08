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
        const route = jest.fn();
        const {server, address} = await startServer(configure({
            logLevel: "debug",
            server: {
                http2: false,
                options: {
                    cert: false
                }
            },
            routing: router => router.get("/**", route),
            onexit: onexit
        }));
        const response = await new Promise(resolve => http.get(`${address}/health`, resolve));
        expect(response.statusCode).toBe(200);
        expect(await contentText(response)).toBe("");
        await server.shutdown();
        expect(onexit).toHaveBeenCalledWith(server);
    });

    it("can start/stop an http2 server", async () => {
        const onexit = jest.fn();
        const {server, watcher} = await startServer(configure({logLevel: "debug", onexit: onexit}));
        await server.shutdown();
        expect(onexit).toHaveBeenCalledWith(server);
    });

    it("can start/stop a server with pending connections", async () => {
        const {server, watcher} = await startServer(configure({
            logLevel: "debug",
            routes: {
                "/": {
                    "GET": (req, res) => {
                        res.headers
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

});


