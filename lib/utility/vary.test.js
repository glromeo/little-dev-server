describe("vary", function () {

    const {vary} = require("./vary.js");

    const res = new Map();
    res.setHeader = res.set;
    res.getHeader = res.get;
    res.hasHeader = res.has;

    it("unit test", function () {
        vary(res, "Origin");
        expect(res.getHeader("Vary")).toBe("Origin");
        vary(res, "Accept-Encoding");
        expect(res.getHeader("Vary")).toBe("Origin, Accept-Encoding");
    })
})