const {merge, configure} = require("../lib/config.js");
const {startServer} = require("../lib/server.js");
const fetch = require("node-fetch");
const https = require("https");
const fs = require("fs");
const path = require("path");

const fixtureDir = path.join(__dirname, "fixture");

const testConfig = configure({config: `${fixtureDir}/server.config.js`});

const httpsAgentOptions = {
    ca: fs.readFileSync(`cert/rootCA.pem`),
    key: fs.readFileSync(`cert/server.key`),
    cert: fs.readFileSync(`cert/server.crt`)
};

async function testServer(options = {}) {

    const config = merge(testConfig, options);
    const {server, watcher, address} = await startServer(config);
    const agent = new https.Agent(httpsAgentOptions);
    return {
        config,
        server,
        watcher,
        address,
        fetch(pathname, options = {}) {
            options.agent = agent;
            return fetch(address + pathname, options);
        }
    };
}

const {Readable, Writable} = require("stream");

module.exports = {

    fixtureDir,
    testConfig,
    testServer,

    mockRequest(url = "/", {method = "GET", type = "json", headers = {}, payload = {}} = {}) {

        const content = type === "json" ? JSON.stringify(payload) : qs.stringify(payload);

        const request = Readable.from(method === "GET" || method === "OPTIONS" ? [] : [content]);

        Object.assign(request, {
            method,
            mode: "cors",
            cache: "no-cache",
            credentials: "same-origin",
            headers: {
                "Content-Type": type === "json" ? "application/json" : "application/x-www-form-urlencoded",
                ...headers
            },
            redirect: "follow",
            referrerPolicy: "no-referrer"
        });
        return request;
    },

    mockResponse(options = {}) {
        const response = new Writable();
        const headers = new Map();
        response._write = jest.fn().mockImplementation(function (chunk, encoding, done) {
            response.data.push(chunk.toString());
            done();
        });
        response.getHeader = jest.fn().mockImplementation((name) => headers.get(name));
        response.hasHeader = jest.fn().mockImplementation((name) => headers.has(name));
        response.removeHeader = jest.fn().mockImplementation((name) => headers.delete(name));
        response.setHeader = jest.fn().mockImplementation((name, value) => headers.set(name, value));
        response.end = jest.spyOn(response, "end");
        return response;
    }
};



