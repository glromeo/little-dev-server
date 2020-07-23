#!/usr/bin/env node

const log = require("tiny-node-logger");
const {startServer} = require("./server.js");
const {configure} = require("./config.js");

const args = require("yargs")
    .scriptName("little-dev-server")
    .usage("$0 <cmd> [args]")
    .option("config", {
        description: "Specify server config file (this will override base config as appropriate)",
        type: "string"
    })
    .option("root", {
        alias: ["rootDir", "r"],
        description: "root directory (defaults to the process current working directory)",
        type: "string"
    })
    .help()
    .alias("help", "h").argv;

module.exports = startServer(configure(args)).then(out => {

    const {server} = out;

    process
        .on("exit", () => {
            log.info("done")
        })
        .on("SIGINT", async () => {
            log.info("ctrl+c detected...")
            await server.shutdown();
            process.exit(0);
        })
        .on("unhandledRejection", (reason, p) => {
            log.error("Unhandled Rejection at Promise", p, reason);
        })
        .on("uncaughtException", err => {
            log.error("Uncaught Exception thrown", err);
        });

    return out;

}).catch(error => {
    log.error("unable to start server", error);
    process.exit(2);
});
