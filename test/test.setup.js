const {merge, configure} = require("../lib/configuration.js");
const createServer = require("../lib/server.js");
const fetch = require("node-fetch");
const https = require("https");
const fs = require("fs");

jest.mock("etag");

const etag = require("etag");
etag.mockReturnValue("test-etag");

const testConfig = configure({config: `${__dirname}/fixture/server.config.js`});

const httpsAgentOptions = {
    ca: fs.readFileSync(`cert/rootCA.pem`),
    key: fs.readFileSync(`cert/server.key`),
    cert: fs.readFileSync(`cert/server.crt`),
};

async function testServer(options = {}) {

    const {server, watcher, config} = await createServer(merge(testConfig, options));
    const baseURL = module.exports.baseURL = `https://${config.host}:${config.port}`;
    const agent = new https.Agent(httpsAgentOptions);
    return {
        server,
        watcher,
        config,
        fetch(url, options = {}) {
            options.agent = agent;
            return fetch(baseURL + url, options);
        }
    }
}

module.exports = {
    testConfig,
    testServer
}



