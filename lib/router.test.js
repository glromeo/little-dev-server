describe("router", function () {

    const {useRouter} = require("./router.js");
    const http = require("http");
    const {Readable} = require("stream");

    describe("unit test", function () {

        const router = useRouter();
        let r;

        beforeEach(function () {

            router.reset();

            r = new Proxy({},
                {
                    get(target, name) {
                        if (!target.hasOwnProperty(name)) {
                            target[name] = jest.fn();
                            target[name].toString = () => {
                                return name;
                            };
                        }
                        return target[name];
                    }
                });
        });

        it("can register routes for various http methods according to specificity", async () => {

            const actual = [];

            const cb = id => (ctx) => {
                actual.push({id, pathname: ctx.pathname, params: ctx.params});
            };

            router.get("/", cb(1));

            await router.route({req: {method: "GET", url: "/"}});

            expect(actual).toMatchObject([
                {id: 1, params: {}, pathname: "/"}
            ]);

            router.get("/", cb(2));
            router.any("/", cb(3));
            router.any("/**", cb(4));
            router.get("/:segment", cb(5));
            router.get("/def", cb(6));

            // 4 can't match because there's nothing after / and same for five

            actual.length = 0;
            await router.route({req: {method: "GET", url: "/"}});

            expect(actual).toMatchObject([
                {id: 1, params: {}, pathname: "/"},
                {id: 2, params: {}, pathname: "/"},
                {id: 3, params: {}, pathname: "/"}
            ]);

            // note that "five" and "4" are more specific than "1" and "2"
            actual.length = 0;
            await router.route({req: {method: "GET", url: "/abc"}});

            expect(actual).toMatchObject([
                {id: 5, params: {"segment": "abc"}, pathname: "/"},
                {id: 4, params: {}, pathname: "/abc"},
                {id: 1, params: {}, pathname: "/abc"},
                {id: 2, params: {}, pathname: "/abc"},
                {id: 3, params: {}, pathname: "/abc"}
            ]);

            router.get("/:segment/**", cb(7));

            actual.length = 0;
            await router.route({req: {method: "GET", url: "/def"}});

            expect(actual).toMatchObject([
                {id: 6, params: {}, pathname: "/"},
                {id: 5, params: {"segment": "def"}, pathname: "/"},
                {id: 4, params: {}, pathname: "/def"},
                {id: 1, params: {}, pathname: "/def"},
                {id: 2, params: {}, pathname: "/def"},
                {id: 3, params: {}, pathname: "/def"}
            ]);
        });

        it("filters", async () => {

            const actual = [];

            const cb = id => (ctx) => {
                actual.push({id, pathname: ctx.pathname, params: ctx.params});
            };

            router.get("/:name/def/**", cb(1));
            router.after("/**", cb("after"));
            router.before("/**", cb("before"));

            actual.length = 0;
            await router.route({req: {method: "GET", url: "/abc/def/ghi/ijk"}});

            // filters only apply if there are endpoints at the matching url

            expect(actual).toMatchObject([
                {id: "before", params: {}, pathname: "/abc/def/ghi/ijk"},
                {id: 1, params: {name: "abc"}, pathname: "/ghi/ijk"},
                {id: "after", params: {}, pathname: "/abc/def/ghi/ijk"}
            ]);

            router.get("/:x/:y/:z", cb(2));

            actual.length = 0;
            await router.route({req: {method: "GET", url: "/abc/def/ghi/ijk"}});

            expect(actual).toMatchObject([
                {id: "before", params: {}, pathname: "/abc/def/ghi/ijk"},
                {id: 2, params: {x: "abc", y: "def", z: "ghi"}, pathname: "/ijk"},
                {id: 1, params: {name: "abc"}, pathname: "/ghi/ijk"},
                {id: "after", params: {}, pathname: "/abc/def/ghi/ijk"}
            ]);

        });
    });

    describe("integration test", function () {

        const Context = require("./context.js");

        const hostname = "127.0.0.1";
        const port = 7777;
        let server, router;

        beforeEach(function (done) {
            server = http.createServer();
            server.listen(port, hostname, done);
            router = useRouter();
        });

        afterEach(function (done) {
            server.close(done);
        });

        it("get /echo/:name", async function () {

            router.post("/api/:name", async function ({pathname, params, query, payload}) {
                return {pathname, params, query, payload: await payload};
            });

            server.on("request", async function (req, res) {
                const ctx = new Context(req, res);
                const {
                    handler,
                    vars,
                    pathname
                } = router.route(req);
                const {
                    content,
                    contentType,
                    contentLength,
                    lastModified
                } = await handler({
                    pathname

                });
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
                expect(res.headers["content-length"]).toBe("95");
                expect(res.headers["last-modified"]).toBe("Mon, 06 Jul 2020 00:24:03 GMT");
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("error", reject);
                res.on("end", function () {
                    resolve(data);
                });
            });

            expect(JSON.parse(data)).toMatchObject({
                params: {
                    "name": "gianluca"
                },
                query: {
                    "surname": "romeo"
                },
                payload: {
                    "message": "Hello World!"
                }
            });
        });
    });

});
