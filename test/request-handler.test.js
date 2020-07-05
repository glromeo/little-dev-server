const {createRouter, METHODS: {GET, PUT, POST}} = require("../lib/request-handler.js");
const http = require('http');

describe("Router", function () {

    let router;

    beforeEach(function () {
        router = createRouter();
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
        router.route("GET", "/abc/def");
        expect(mock1).toHaveBeenCalledWith({name: "def"});

        let mock2 = jest.fn();
        router.get("/abc/def/:alias", mock2);
        router.route("GET", "/abc/def/ijk");
        expect(mock2).toHaveBeenCalledWith({alias: "ijk"});
        expect(mock1).toHaveBeenCalledTimes(1);

        let mock3 = jest.fn();
        router.get("/abc/xyz", mock3);
        router.route("GET", "/abc/def");
        expect(mock3).not.toHaveBeenCalled();
        expect(mock1).toHaveBeenCalledTimes(2);

        router.route("GET", "/abc/xyz");
        expect(mock3).toHaveBeenCalledTimes(1);

        let mock4 = jest.fn();
        router.get("/abc/:name/:address", mock4);
        router.route("GET", "/abc/def/ghi");
        expect(mock1).toHaveBeenCalledTimes(2);
        expect(mock2).toHaveBeenCalledTimes(2);
        expect(mock4).not.toHaveBeenCalled();
        router.route("GET", "/abc/xxx/yyy");
        expect(mock4).toHaveBeenCalledWith({name: "xxx", address: "yyy"});
    });

    it("can't register handler twice", async function () {
        router.get("/abc/:name/:address", jest.fn());
        router.post("/abc/:name/:address", jest.fn());
        expect(() => router.get("/abc/:name/:address", jest.fn())).toThrow("route already used for: GET");
    });

    it("can handle get parameters and ** to match the rest of the url", function () {
        const mock = jest.fn();
        router.get("/abc/:name/**", mock);
        expect(router.route("GET", "/abc/def")).toBeUndefined();
        expect(mock).toHaveBeenCalledTimes(0);
        router.route("GET", "/abc/def/jkl");
        expect(mock).toHaveBeenCalledWith({"name": "def"});
    });

    it("can handle content type and accept type headers", async function () {
        const mock = jest.fn();
        router.get("/abc/:name/**", mock);
        router.route("GET", "/abc/def").service({
            headers: {
                "content-type": "application/json"
            }
        });
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

            router.post("/api/:name", function ({params, payload, pathname}) {
                fail();
                return {...params, ...payload};
            })

            server.on('request', function (req, res) {
                router.route(req.method, req.url, req, res);
            })

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
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("error", reject);
                res.on("end", function () {
                    resolve(data);
                });
            });

            expect(JSON.parse(data)).toMatchObject({
                "name": "gianluca",
                "surname": "romeo",
                "message": "Hello World!"
            });
        });
    });

});
