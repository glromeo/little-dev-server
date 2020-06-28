const {memoize} = require("../lib/utility/memoize.js");

describe("memoize", function () {

    it("calling with same argument return cached value", function () {
        let target = jest.fn();
        let memoized = memoize(target);
        memoized(0);
        memoized(0);
        expect(target).toHaveBeenCalledTimes(1);
    })

    it("otherwise target gets recomputed", function () {
        let target = jest.fn();
        let memoized = memoize(target);
        memoized(0);
        memoized(1);
        memoized(0);
        expect(target).toHaveBeenCalledTimes(2);
    })

});
