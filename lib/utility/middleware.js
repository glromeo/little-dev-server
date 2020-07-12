module.exports = {
    call(middleware, context) {
        return new Promise(resolve => middleware(context, resolve));
    }
}
