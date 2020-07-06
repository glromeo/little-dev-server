const {useServeStatic} = require("./lib/servlet/serve-static.js");

module.exports = (config, router) => {

    const {serveStatic} = useServeStatic(config);

    router.get("/**", function (ctx) {
        return serveStatic(ctx);
    })
}