/**
 *
 * @param target
 * @return target
 */
module.exports.memoize = target => {
    const memo = new Map();
    return arg => {
        if (!memo.has(arg)) {
            memo.set(arg, target(arg));
        }
        return memo.get(arg);
    }
}

module.exports.blockingTransformer = transformer => {
    const pendingTasks = new Map();
    return async function () {
        const key = arguments[0];
        if (!pendingTasks.has(key)) {
            pendingTasks.set(key, transformer.apply(this, arguments));
        }
        try {
            return await pendingTasks.get(key);
        } finally {
            pendingTasks.delete(key);
        }
    };
}
