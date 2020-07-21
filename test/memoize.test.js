describe("memoize & once", function () {

    const {memoize, once} = require("../lib/util/memoize.js");

    describe("memoize", function () {

        it("calling the memoized function with undefined invokes underlying function", function () {
            let target = jest.fn();
            let memoized = memoize(target);
            memoized();
            memoized();
            expect(target).toHaveBeenCalledTimes(1);
        });

        it("calling the memoized function with same argument returns the cached value", function () {

            let target = jest.fn();
            let single = memoize(target);
            single(0);
            single(0);
            expect(target).toHaveBeenCalledTimes(1);

            let multi = memoize(target);
            multi(0, 0);
            multi(0, 0);
            expect(target).toHaveBeenCalledTimes(2);
        });

        it("otherwise the underlying function gets recomputed and cached", function () {

            let target = jest.fn();
            let single = memoize(target);
            single(0);
            single(1);
            single(0);
            single(1);
            expect(target).toHaveBeenCalledTimes(2);

            let multi = memoize(target);
            multi(0, 0);
            multi(0, 1);
            multi(1, 0);
            multi(1, 1);
            multi(0, 0);
            multi(0, 1);
            multi(1, 0);
            multi(1, 1);
            expect(target).toHaveBeenCalledTimes(6);
        });

        it("can handle undefined", function () {
            let target = jest.fn();
            let memoized = memoize(target);
            memoized(undefined);
            memoized(undefined);
            memoized(1);
            memoized(2);
            memoized(3);
            memoized(undefined);
            memoized(undefined);
            expect(target).toHaveBeenCalledTimes(4);
        });
    });

});
