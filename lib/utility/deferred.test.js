const {Deferred} = require("./deferred.js");

describe("Deferred", function () {

    it("it's just a Promise", function () {
        expect(new Deferred()).toBeInstanceOf(Promise);
    })

    it("it has to be resolved/rejected externally", async function () {

        const resolved = new Deferred();
        const date = new Date();
        setImmediate(() => resolved.resolve(date));
        expect(await resolved).toBe(date);

        const rejected = new Deferred();
        const error = new Error("it's OK");
        setImmediate(() => rejected.reject(error));
        await expect(rejected).rejects.toBe(error);
    })
})