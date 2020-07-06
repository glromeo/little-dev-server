const {createRouter, METHODS: {GET, PUT, POST}} = require("../lib/router.js");
const http = require('http');
const {Readable} = require('stream');

describe("Router", function () {

    let router, req, res;

    function request(url = "/", {
        payload,
        method = "GET",
        headers = {
            "content-type": "application/json",
            "accept": "application/json"
        }
    } = {}) {
        const req = Readable.from(payload ? [typeof payload === "string" ? payload : JSON.stringify(payload)] : []);
        req.method = method;
        req.url = url;
        req.headers = headers;
        return req;
    }

    beforeEach(function () {
        router = createRouter();
        res = {
            writeHead: jest.fn(),
            end: jest.fn(),
            setHeader: jest.fn()
        };
    })

    it("can add handlers and route", function () {

        const h1 = jest.fn();
        const h2 = jest.fn();
        const h3 = jest.fn();
        const h4 = jest.fn();

        router.get("/abc", h1);
        router.get("/abc/def/ghi", h2);
        router.get("/abc/def", h4);
        router.put("/abc/def", h3);
        router.post("/abc/def/jkl", h4);

        // This match is not very effective due to the nature of Symbol()
        expect(router).toMatchObject({
            routes: {
                "abc": {
                    "def": {
                        "ghi": {
                            [Symbol()]: h2
                        },
                        "jkl": {
                            [Symbol()]: h4
                        },
                        [Symbol()]: h3
                    },
                    [Symbol()]: h1
                }
            }
        });

        expect(router.routes["abc"][GET]).toMatchObject({handler: h1});
        expect(router.routes["abc"]["def"]["ghi"][GET]).toMatchObject({handler: h2});
        expect(router.routes["abc"]["def"][PUT]).toMatchObject({handler: h3});
        expect(router.routes["abc"]["def"]["jkl"][POST]).toMatchObject({handler: h4});
    });

    it("can handle path params", async function () {

        let mock1 = jest.fn();
        router.get("/abc/:name", mock1);
        req = request("/abc/def");
        await router.route(req, res);
        expect(mock1).toHaveBeenCalledWith({name: "def"}, undefined, req, res);

        let mock2 = jest.fn();
        router.put("/abc/def/:alias", mock2);
        req = request("/abc/def/ijk", {method: "PUT", payload: {alpha: "beta"}});
        await router.route(req, res);
        expect(mock2).toHaveBeenCalledWith({alias: "ijk"}, {alpha: "beta"}, req, res);
        expect(mock1).toHaveBeenCalledTimes(1);

        let mock3 = jest.fn();
        router.get("/abc/xyz", mock3);
        req = request("/abc/def");
        await router.route(req, res);
        expect(mock3).not.toHaveBeenCalled();
        expect(mock1).toHaveBeenCalledTimes(2);

        req = request("/abc/xyz");
        await router.route(req, res);
        expect(mock3).toHaveBeenCalledTimes(1);

        let mock4 = jest.fn();
        router.get("/abc/def/:alias", mock2);
        router.get("/abc/:name/:address", mock4);
        req = request("/abc/def/ghi");
        await router.route(req, res);
        expect(mock1).toHaveBeenCalledTimes(2);
        expect(mock2).toHaveBeenCalledTimes(2);
        expect(mock4).not.toHaveBeenCalled();

        req = request("/abc/xxx/yyy");
        await router.route(req, res);
        expect(mock4).toHaveBeenCalledWith({name: "xxx", address: "yyy"}, undefined, req, res);
    });

    it("can't register handler twice", async function () {
        router.get("/abc/:name/:address", jest.fn());
        router.post("/abc/:name/:address", jest.fn());
        expect(() => router.get("/abc/:name/:address", jest.fn())).toThrow("route already used for: GET");
    });

    it("can handle get parameters and ** to match the rest of the url", async function () {

        const route = jest.fn();
        router.get("/abc/:name/**", route);

        req = request("/abc/def");
        expect(() => router.route(req, res)).toThrowError("no route found for: GET /abc/def");
        expect(route).toHaveBeenCalledTimes(0);

        req = request("/abc/def/jkl");
        await router.route(req, res);
        expect(route).toHaveBeenCalledWith({"name": "def"}, undefined, req, res);
    });

    it("can handle content type and accept type headers", async function () {

        const route = jest.fn().mockImplementation(function ({name}, message) {
            return message + ' ' + name + ' ' + this.pathname.substring(1);
        });
        router.post("/api/:name/**", route);

        req = request("/api/gianluca/romeo", {
            method: "POST",
            payload: "hello",
            headers: {
                "content-type": "text/plain",
                "accept": "text/plain"
            }
        });

        const {
            content,
            contentType,
            contentLength,
            lastModified
        } = await router.route(req, res)

        expect(route).toHaveBeenCalledWith({"name": "gianluca"}, "hello", req, res);
        expect(content).toMatch(`hello gianluca romeo`);
        expect(contentType).toMatch("text/plain; charset=UTF-8");
        expect(contentLength).toBe(20);
        expect(lastModified).toBeInstanceOf(Date);
    });

    describe("integration test", function () {

        const hostname = '127.0.0.1';
        const port = 7777;
        let server;

        beforeEach(function (done) {
            server = http.createServer();
            server.listen(port, hostname, done);
        });

        afterEach(function (done) {
            server.close(done);
        })

        it("get /echo/:name", async function () {

            router.post("/api/:name", function (params, payload, req, res) {
                return {
                    ...this,
                    params,
                    payload
                };
            })

            server.on('request', async function (req, res) {
                const {
                    content,
                    contentType,
                    contentLength,
                    lastModified
                } = await router.route(req, res);
                res.writeHead(200, {
                    "content-type": contentType,
                    "content-length": contentLength,
                    "last-modified": new Date("Mon, 06 Jul 2020 00:24:03 GMT").toUTCString()
                });
                res.end(content);
            });

            const res = await new Promise(function (resolve, reject) {
                const payload = JSON.stringify({
                    message: "Hello World!"
                });
                http.request({
                    hostname,
                    port,
                    path: "/api/gianluca?surname=romeo",
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "accept": "application/json",
                        "content-length": payload.length
                    }
                }, resolve).on("error", reject).end(payload);
            });

            const data = await new Promise(function (resolve, reject) {
                expect(res.statusCode).toBe(200);
                expect(res.headers["content-type"]).toBe("application/json; charset=UTF-8");
                expect(res.headers["content-length"]).toBe("165");
                expect(res.headers["last-modified"]).toBe("Mon, 06 Jul 2020 00:24:03 GMT");
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("error", reject);
                res.on("end", function () {
                    resolve(data);
                });
            });

            expect(JSON.parse(data)).toMatchObject({
                vars: {
                    "name": "gianluca",
                },
                query: {
                    "surname": "romeo",
                },
                params: {
                    "name": "gianluca",
                    "surname": "romeo",
                },
                payload: {
                    "message": "Hello World!"
                }
            });
        });
    });

});
