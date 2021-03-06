const log = require("tiny-node-logger");

const {createWatcher} = require("./watcher.js");
const {createRequestHandler} = require("./request-handler.js");
const {contentText} = require("./util/content-utils.js");

module.exports.startServer = async function (config, base = {}) {

    const {
        host,
        port,
        options = {}
    } = config.server;

    const secure = options.key && options.cert;

    const watcher = base.watcher || createWatcher(config);
    const handler = base.handler || createRequestHandler(config, watcher);

    let module, server;

    if (config.http2) {
        /**
         *
         * @type {Object}
         */
        module = require("http2");
        if (secure) {
            server = module.createSecureServer(options, handler);
        } else {
            server = module.createServer(options, handler);
        }
    } else {
        if (secure) {
            module = require("https");
            server = module.createServer(options, handler);
        } else {
            module = require("http");
            server = module.createServer(options, handler);
        }
    }

    const sockets = new Set();

    server.on("connection", function (socket) {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
    });

    const exitHooks = [];

    exitHooks.push(() => {
        if (sockets.size > 0) {
            log.info(`closing ${sockets.size} pending socket...`);
            for (const socket of sockets) {
                socket.destroy();
                sockets.delete(socket);
            }
        }
    });

    exitHooks.push(async () => {
        log.info(`closing chokidar watcher...`);
        await watcher.close();
    });

    if (typeof config.onexit === "function") {
        log.debug("registered custom shutdown hook");
        exitHooks.push(async () => await config.onexit(server));
    }

    const closed = new Promise(resolve => {
        server.on("close", resolve);
    }).then(() => {
        log.info("server closed");
    });

    server.shutdown = async function () {
        server.shutdown = async function () {
            await closed;
            log.info("server already closed");
        };
        for (const hook of exitHooks) {
            await hook();
        }
        server.close();
        return closed;
    };

    await new Promise(listening => server.listen(port, host, listening));

    const protocol = secure ? "https" : "http";
    const address = `${protocol}://${host}:${port}`;
    log.info(`server started on ${address}`);

    const WebSocket = require("ws");
    const wss = new WebSocket.Server({server}); // todo: refactor to use path

    const {usePlugins} = require("./plugins.js");
    const {plugins} = usePlugins(config, watcher);

    wss.on("connection", ws => {

        const send = (header, payload = null) => {
            ws.send(`${header}:${JSON.stringify(payload)}`);
        };

        ws.on("message", message => {
            const sep = message.indexOf(":");
            let action, body;
            if (sep !== -1) {
                action = message.substring(0, sep);
                body = JSON.parse(message.substring(sep + 1));
            } else {
                action = message;
            }
            log.info("ws:", action, body);
            if (plugins.has(action)) {
                plugins.get(action).call(plugins, body, send);
            }
        });

        send("connected", {since: new Date().toUTCString()});
    });

    return {
        config,
        module,
        server,
        watcher,
        address
    };
};
