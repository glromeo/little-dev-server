const {merge, configure} = require("../lib/config.js");
const {resolve} = require("path");
const fetch = require("node-fetch");
const https = require("https");
const fs = require("fs");

const testConfig = configure(resolve(__dirname, 'fixture/server.config.js'));

const httpsAgentOptions = {
    ca: fs.readFileSync(resolve(__dirname, "../cert/rootCA.pem")),
    key: fs.readFileSync(resolve(__dirname, "../cert/server.key")),
    cert: fs.readFileSync(resolve(__dirname, "../cert/server.crt")),
};

const createServer = require("../lib/server.js");

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



