const etag = require("etag");

module.exports.useETag = config => {

    const {etag: options} = config;

    return async function middleware(context, next) {
        const text = `${context.url} ${context.header("content-length")} ${context.header("last-modified")}`;
        context.header("etag", etag(text, options));
        return next(context);
    }
}