function computeOrRetrieve(target, args) {
    if (target.hasOwnProperty("value")) {
        if (target.memos === undefined) {
            target.memos = [target.memo];
            target.values = [target.value];
        } else {
            let m = target.memos.length;
            while (--m >= 0) {
                const memo = target.memos[m];
                let same = memo !== undefined && memo.length === args.length;
                let a = args.length;
                while (same && --a >= 0) same = memo[a] === args[a];
                if (same) {
                    return target.values[m];
                }
            }
            target.memos.push(target.memo);
            target.values.push(target.value);
        }
    }
    target.memo = args;
    target.value = target.apply(this, args);
    return target.value;
}

module.exports.memoize = target => {
    return function () {
        if (target.memo === undefined || target.memo.length !== arguments.length) {
            return computeOrRetrieve(target, arguments);
        }
        let a = arguments.length;
        while (--a >= 0) {
            if (target.memo[a] !== arguments[a]) return computeOrRetrieve(target, arguments);
        }
        return target.value;
    };
};

module.exports.once = target => {
    const pending = new Map();
    return function () {
        const key = arguments[0];
        if (!pending.has(key)) {
            const promise = target.apply(this, arguments);
            promise.finally(function () {
                return pending.delete(key);
            });
            pending.set(key, promise);
        }
        return pending.get(key);
    };
};
