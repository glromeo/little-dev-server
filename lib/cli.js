#!/usr/bin/env node

const {startServer} = require("./server.js");
const {configure} = require("./configuration.js");
const log = require("tiny-node-logger");

const {
    config,
    rootDir
} = require("yargs")
    .scriptName("little-dev-server")
    .usage("$0 <cmd> [args]")
    .option("config", {
        description: "Specify server config file (this will override base config as appropriate)",
        type: "string"
    })
    .option("root", {
        alias: ["rootDir", "r"],
        description: "root directory (defaults to process current working directory)",
        type: "string"
    })
    .help()
    .alias("help", "h").argv;

startServer(configure({
    config,
    rootDir
})).then(({server}) => {

    process.on("exit", function () {
        log.debug("exiting...");
        server.shutdown(function () {
            log.debug("done");
        });
    }).on("SIGINT", function () {
        process.exit(0);
    }).on("unhandledRejection", (reason, p) => {
        log.error("Unhandled Rejection at Promise", p, reason);
    }).on("uncaughtException", err => {
        log.error("Uncaught Exception thrown", err);
        process.exit(1);
    });

}).catch(error => {
    log.error("unable to start server", error);
    process.exit(0);
});
