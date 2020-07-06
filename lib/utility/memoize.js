module.exports.memoize = target => {
    const memo = new Map();
    return arg => {
        if (!memo.has(arg)) {
            memo.set(arg, target(arg));
        }
        return memo.get(arg);
    };
};

module.exports.once = bi => {
    const pending = new Map();
    return function (key, value) {
        if (!pending.has(key)) {
            const promise = bi.call(this, key, value);
            promise.finally(function () {
                return pending.delete(key);
            })
            pending.set(key, promise);
        }
        return pending.get(key);
    };
};
