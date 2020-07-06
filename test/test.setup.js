const {merge, configure} = require("../lib/configuration.js");
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
    cert: fs.readFileSync(`cert/server.crt`),
};

async function testServer(options = {}) {

    const config = merge(testConfig, options);
    const {server, watcher} = await startServer(config);
    const baseURL = `https://${config.server.host}:${config.server.port}`;
    const agent = new https.Agent(httpsAgentOptions);
    return {
        config,
        server,
        watcher,
        baseURL,
        fetch(pathname, options = {}) {
            options.agent = agent;
            return fetch(baseURL + pathname, options);
        }
    }
}

module.exports = {
    fixtureDir,
    testConfig,
    testServer,
}



