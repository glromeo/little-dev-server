module.exports.useFixture = function (options = {config: `${__dirname}/server.config.js`}) {

    const {configure} = require("../../lib/config.js");
    const {createWatcher} = require("../../lib/watcher.js");
    const {startServer} = require("../../lib/server.js");
    const fetch = require("node-fetch");
    const https = require("https");
    const fs = require("fs");
    const path = require("path");

    options.server = {port: Math.floor(3000 + Math.random() * 6000)};

    const config = configure(options);

    const watcher = createWatcher(config);

    const {Readable, Writable} = require("stream");

    const fixture = {
        baseDir: process.cwd(),
        rootDir: __dirname,
        config,
        server: {
            async start() {
                const {server, address} = await startServer(config, {watcher});
                fixture.server.instance = server;
                fixture.server.address = address;
                return server;
            },
            async stop() {
                if (!fixture.server.instance) {
                    throw "server has not been started yet";
                } else {
                    return await fixture.server.instance.shutdown();
                }
            }
        },
        fetch(pathname, options = {}) {
            if (!fixture.server.address) {
                fail("server must be started before invoking fetch");
            }
            if (!options.agent) {
                options.agent = new https.Agent({
                    ca: fs.readFileSync(`cert/rootCA.pem`),
                    key: fs.readFileSync(`cert/server.key`),
                    cert: fs.readFileSync(`cert/server.crt`)
                });
            }
            return fetch(fixture.server.address + pathname, options);
        },
        watcher,
        mock: {
            req(url = "/", {method = "GET", type = "json", headers = {}, payload = {}} = {}) {
                const content = type === "json" ? JSON.stringify(payload) : qs.stringify(payload);
                const req = Readable.from(method === "GET" || method === "OPTIONS" ? [] : [content]);
                Object.assign(req, {
                    method,
                    mode: "cors",
                    cache: "no-cache",
                    credentials: "same-origin",
                    headers: {
                        "content-type": type === "json" ? "application/json" : "application/x-www-form-urlencoded",
                        ...headers
                    },
                    redirect: "follow",
                    referrerPolicy: "no-referrer"
                });
                return req;
            },
            res(options = {}) {
                const res = new Writable();
                const headers = new Map();
                res._write = jest.fn().mockImplementation(function (chunk, encoding, done) {
                    res.data.push(chunk.toString());
                    done();
                });
                res.getHeader = jest.fn().mockImplementation((name) => headers.get(name));
                res.hasHeader = jest.fn().mockImplementation((name) => headers.has(name));
                res.removeHeader = jest.fn().mockImplementation((name) => headers.delete(name));
                res.setHeader = jest.fn().mockImplementation((name, value) => headers.set(name, value));
                res.end = jest.spyOn(res, "end");
                return res;
            }
        },
        resolve() {
            return path.resolve(__dirname, ...arguments);
        }
    };

    return fixture;
};



