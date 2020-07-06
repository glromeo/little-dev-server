describe("memoize & once", function () {

    const {memoize, once} = require("./memoize.js");
    const {Deferred} = require("./deferred.js");

    describe("memoize", function () {

        it("calling the memoized function with same argument returns the cached value", function () {
            let target = jest.fn();
            let memoized = memoize(target);
            memoized(0);
            memoized(0);
            expect(target).toHaveBeenCalledTimes(1);
        })

        it("otherwise the underlying function gets recomputed and cached", function () {
            let target = jest.fn();
            let memoized = memoize(target);
            memoized(0);
            memoized(1);
            memoized(0);
            memoized(1);
            expect(target).toHaveBeenCalledTimes(2);
        })

    });

    describe("once", function () {

        it("prevents back other async tasks with the same key", async function () {
            let task = jest.fn().mockImplementation((key, value) => {
                return new Deferred();
            });
            let onced = once(task);
            const t1 = onced(0, "1");
            const t2 = onced(0, "2");
            expect(task).toHaveBeenCalledTimes(1);
            expect(task).toHaveBeenCalledWith(0, "1");
            expect(t1).toBe(t2);
            await t1.resolve();
            expect(onced(0, "3")).not.toBe(t1);
            expect(onced(0, "4")).not.toBe(t1);
            expect(task).toHaveBeenCalledTimes(2);
            expect(task).toHaveBeenCalledWith(0, "3");
        })

        it("different keys cause separate invocations", async function () {
            let task = jest.fn().mockImplementation((key, value) => {
                return new Deferred();
            });
            let onced = once(task);
            const t1 = onced(0, "1");
            const t2 = onced(1, "2");
            expect(task).toHaveBeenCalledTimes(2);
            expect(task).toHaveBeenCalledWith(0, "1");
            expect(task).toHaveBeenCalledWith(1, "2");
            expect(t1).not.toBe(t2);
        })


    });

});