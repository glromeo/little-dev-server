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

        it("can register routes for various http methods according to specificity", () => {

            router.get("/", "1");

            expect([...router.route({method: "GET", url: "/"})]).toMatchObject([{
                handler: "1",
                vars: {},
                pathname: "/"
            }]);

            router.get("/", "2");
            router.any("/", "3");
            router.any("/**", "4");

            function five() {
            }

            router.get("/:segment", five);
            router.get("/def", "6");

            // 4 can't match because there's nothing after / and same for five
            expect([...router.route({method: "GET", url: "/"})]).toMatchObject([
                {handler: "1", vars: {}, pathname: "/"},
                {handler: "2", vars: {}, pathname: "/"},
                {handler: "3", vars: {}, pathname: "/"}]);

            // note that "five" and "4" are more specific than "1" and "2"
            expect([...router.route({method: "GET", url: "/abc"})]).toMatchObject([
                {handler: five, vars: {"segment": "abc"}, pathname: "/"},
                {handler: "4", vars: {}, pathname: "/abc"},
                {handler: "1", vars: {}, pathname: "/abc"},
                {handler: "2", vars: {}, pathname: "/abc"},
                {handler: "3", vars: {}, pathname: "/abc"}
            ]);

            function seven() {
            }

            router.get("/:segment/**", seven);

            expect([...router.route({method: "GET", url: "/def"})]).toMatchObject([
                {handler: "6", vars: {}, pathname: "/"},
                {handler: five, vars: {"segment": "def"}, pathname: "/"},
                {handler: "4", vars: {}, pathname: "/def"},
                {handler: "1", vars: {}, pathname: "/def"},
                {handler: "2", vars: {}, pathname: "/def"},
                {handler: "3", vars: {}, pathname: "/def"}
            ]);
        });

        it("filters", () => {

            const f = function () {
            };
            router.get("/:name/def/**", f);
            router.filter("/abc/:p/**", {
                before() {
                },
                after() {
                }
            });

            const actual = [...router.route({method: "GET", url: "/abc/def/ghi/ijk"})];
            expect(actual).toMatchObject([{
                handler: "1",
                vars: {},
                pathname: "/"
            }, {
                handler: f,
                vars: {name:"abc"},
                pathname: "/ghi/ijk"
            }, {
                handler: "1",
                vars: {},
                pathname: "/"
            }]);

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
                    pathname,

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
