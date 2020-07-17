describe("router", function () {

    const http = require("http");
    const {configure} = require("../lib/config.js");
    const {createRouter} = require("../lib/router.js");

    const config = configure({logLevel: "debug"});

    const router = createRouter(config);

    it("uses configured proxy", async function () {

        await new Promise(resolve => {

            const server = http.createServer(function (req, res) {
                expect(req.url).toBe("/hello");
                server.stop();
                resolve();
            }).listen(9000);

            router.lookup({method: "GET", url: "/api/hello", headers: {}}, {
                end() {
                }
            });
        });
    });
});
