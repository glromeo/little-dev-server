const log = require("tiny-node-logger");

const http = require("http");
const http2 = require("http2");

const onexit = require("signal-exit");

const {createWatcher} = require("./watcher.js");
const {createRequestHandler} = require("./request-handler.js");

module.exports.startServer = async function (config) {

    const {
        host,
        port,
        options = {}
    } = config.server;

    const secure = options.key && options.cert;

    const watcher = createWatcher(config);
    const handler = createRequestHandler(config, watcher);

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
        log.info(`closing ${sockets.size} pending socket...`);
        for (const socket of sockets) {
            socket.destroy();
        }
    });

    exitHooks.push(async () => {
        log.info(`closing chokidar watcher...`);
        await watcher.close();
    });

    exitHooks.push(onexit(() => server.shutdown()));

    if (typeof config.onexit === "function") {
        log.debug("registered custom shutdown hook");
        exitHooks.push(async () => await config.onexit(server));
    }

    const closed = new Promise(resolve => {
        server.on("close", async function () {
            log.info("shutting down server...");
            for (const hook of exitHooks) await hook();
            log.info("server closed.");
            resolve();
        });
    });

    server.shutdown = async function () {
        server.close();
        return closed;
    };

    await new Promise(listening => server.listen(port, host, listening));

    const protocol = secure ? "https" : "http";
    const address = `${protocol}://${host}:${port}`;
    log.info(`server started on ${address}`);

    return {
        config,
        module,
        server,
        watcher,
        address
    };
};
