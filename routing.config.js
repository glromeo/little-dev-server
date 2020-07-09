const {useServeStatic} = require("./lib/middleware/serve-static.js");

module.exports = (router, config) => {

    router.get("/**", useServeStatic(config));
};
