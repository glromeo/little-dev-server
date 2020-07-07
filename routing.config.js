const {useServeStatic} = require("./lib/servlet/serve-static.js");

module.exports = (router, config) => {

    const {serveStatic} = useServeStatic(config);

    router.get("/**", function (ctx) {
        return serveStatic(ctx);
    })
}
