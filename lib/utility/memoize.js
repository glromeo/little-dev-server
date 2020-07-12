module.exports.memoize = target => {
    return function (arg) {
        if (target.memo !== arg) {
            if (target.hasOwnProperty("value")) {
                if (target.memos === undefined) {
                    target.memos = [target.memo];
                    target.values = [target.value];
                } else {
                    let m = target.memos.length;
                    while (--m >= 0) if (target.memos[m] === arg) return target.values[m];
                    target.memos.push(target.memo);
                    target.values.push(target.value);
                }
            }
            target.memo = arg;
            target.value = target.call(this, arg);
        }
        return target.value;
    };
};

module.exports.once = bi => {
    const pending = new Map();
    return function (key, value) {
        if (!pending.has(key)) {
            const promise = bi.call(this, key, value);
            promise.finally(function () {
                return pending.delete(key);
            });
            pending.set(key, promise);
        }
        return pending.get(key);
    };
};
