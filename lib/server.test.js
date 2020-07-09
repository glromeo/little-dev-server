describe("server", function () {

    const http = require("http");
    const http2 = require("http2");
    const https = require("https");
    const fs = require("fs");
    const {configure} = require("./configuration.js");
    const {startServer} = require("./server.js");
    const {contentText} = require("./utility/content-utils.js");
    const fetch = require("node-fetch");

    it("can start/stop an http server", async () => {

        const onexit = jest.fn();

        const {module, server, address} = await startServer(configure({
            logLevel: "info",
            server: {
                options: undefined
            },
            http2: false,
            routing: router => {

                router.get("/hello", ctx => {
                    expect(ctx.header("origin")).toMatch("localhost");
                    return "Hello World! ...from the http server";
                });

                router.get("/echo", ctx => {
                    expect(ctx.search).toMatch("?message=hello%20world");
                    return ctx.query.message;
                });

                router.get("/not-found", () => fs.readFileSync("404_HTTP"));

                router.post("/echo", async ({request, payload}) => {
                    expect(request.headers["content-type"]).toMatch("application/json");
                    expect(request.headers["content-length"]).toStrictEqual("19");
                    expect(request.headers["accept"]).toStrictEqual("application/json");
                    const {message} = await payload;
                    return {echo: message + " back!"};
                });
            },
            onexit: onexit
        }));

        // by having removed the options the server was started using http
        expect(module).toStrictEqual(http);

        try {
            const success = await new Promise(resolve => http.get(`${address}/hello`, {
                headers: {
                    origin: "localhost"
                }
            }, resolve));
            expect(await contentText(success)).toMatch("Hello World! ...from the http server");
            expect(success.statusCode).toBe(200);
            expect(success.statusMessage).toBe("OK");

            const get = await new Promise(resolve => http.get(`${address}/echo?message=hello%20world`, resolve));
            expect(await contentText(get)).toMatch("hello world");

            const failure = await new Promise(resolve => http.get(`${address}/not-found`, resolve));
            expect(await contentText(failure)).toMatch("Error: ENOENT: no such file or directory, open '404_HTTP'");
            expect(failure.statusCode).toBe(404);
            expect(failure.statusMessage).toBe("Not Found");

            const data = JSON.stringify({message: "hello"});
            const post = await fetch(`${address}/echo`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "content-length": data.length,
                    "accept": "application/json",
                },
                body: data
            });
            expect(post.ok).toBe(true);
            expect(await post.json()).toMatchObject({echo: "hello back!"});
            expect(post.headers.get("content-type")).toBe("application/json; charset=UTF-8");
            expect(post.headers.get("content-length")).toStrictEqual("22");
            expect(post.headers.get("last-modified")).toMatch(new Date().toUTCString().substring(0, 20));
            expect(post.statusText).toBe("OK");
            expect(post.status).toBe(200);

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
            http2: "preload",
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
                        expect(headers["content-type"]).toBe("text/plain; charset=UTF-8");
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

});


