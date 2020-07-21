const log = require("tiny-node-logger");
const httpProxy = require("http-proxy");
const findMyWay = require("find-my-way");

module.exports.createRouter = function (config, watcher) {

    const router = findMyWay({
        onBadUrl: (path, req, res) => {
            res.statusCode = 400;
            res.end(`Malformed URL: ${path}`);
        },
        ...config.router
    });

    if (typeof config.middleware === "function") {
        config.middleware(router, config, watcher);
    }

    if (config.proxy) for (const [path, options] of Object.entries(config.proxy)) {
        const proxy = httpProxy.createProxyServer(options);
        router.all(path, proxy.web.bind(proxy));
    }

    return router;
}
