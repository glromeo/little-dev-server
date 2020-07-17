const log = require("tiny-node-logger");
const {memoize} = require("./utility/memoize.js");
const httpProxy = require("http-proxy");
const findMyWay = require("find-my-way");
const {useWorkspace} = require("./middleware/workspace.js");

module.exports.useRouter = memoize(function (config, watcher) {

    const router = findMyWay({
        onBadUrl: (path, req, res) => {
            res.statusCode = 400;
            res.end(`Malformed URL: ${path}`);
        },
        defaultRoute: useWorkspace(config, watcher),
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
})
