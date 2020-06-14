module.exports.useMemo = target => {
    let key;
    let value;
    return arg => arg === key ? value : value = target(key = arg);
}
