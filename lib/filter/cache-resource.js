const {memoize} = require("../utility/memoize.js");

module.exports.useCacheResource = memoize(function (config, watch) {

    function cacheResouce(ctx, next) {

    }

    return {
        cacheResouce
    }
})