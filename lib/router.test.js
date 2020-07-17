describe("router", function () {

    const http = require('http');
    const {configure} = require("./configuration.js");
    const {useRouter} = require('./router.js');

    const config = configure({logLevel: "debug"});

    const router = useRouter(config);

    it("uses configured proxy", async function () {

        await new Promise(resolve => {

            const server = http.createServer(function (req, res) {
                expect(req.url).toBe("/hello");
                server.stop();
                resolve();
            }).listen(9000);

            router.lookup({method: "GET", url: "/api/hello", headers:{}},{end(){}});
        });
    })
})
