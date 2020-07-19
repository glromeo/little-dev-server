describe("etag", function () {

    const {useETag} = require("../lib/pipeline/etag.js");

    it("adds etag header", async function () {

        const stream = {
            pathname: "/",
            headers: {
                "content-length": 0,
                "last-modified": "Sat, 18 Jul 2020 00:35:51 GMT"
            }
        };

        const etag = useETag({});
        await etag(stream);

        expect(stream.headers["etag"]).toMatch(`"21-wH7HSXFtIXmUmnlo8vsNZ6KYMgA"`);
    });

    it("adds etag weak header", async function () {

        const stream = {
            pathname: "/",
            headers: {
                "content-length": 0,
                "last-modified": "Sat, 18 Jul 2020 00:35:51 GMT"
            }
        };

        const etag = useETag({etag: {weak: true}});
        await etag(stream);

        expect(stream.headers["etag"]).toMatch(`W/"21-wH7HSXFtIXmUmnlo8vsNZ6KYMgA"`);
    });
});
