describe("request-handler", function () {

    const {parse: parseURL} = require("fast-url-parser");

    it("fast-url-parser", function () {
        const parsed = parseURL("/web_modules/@domain/name/path/file?a=b&c=d", true);
        expect("parsed").toMatchObject({
            pathname: "/"
        });
    });
});