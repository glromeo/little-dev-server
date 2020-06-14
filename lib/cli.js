#!/usr/bin/env node

const createServer = require("./server.js");
const {configure} = require("./config.js");
const log = require("tiny-node-logger");

const argv = require('yargs')
    .option('root', {
        alias: 'r',
        description: 'Specify root directory (defaults to process cwd)',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

const config = configure({rootDir: argv.root});

createServer(config).then(({server}) => {

    process.on('exit', function () {
        log.debug("exiting...");
        server.shutdown(function () {
            log.debug("done");
        });
    }).on('SIGINT', function () {
        process.exit(0);
    }).on('unhandledRejection', (reason, p) => {
        log.error('Unhandled Rejection at Promise', p, reason);
    }).on('uncaughtException', err => {
        log.error('Uncaught Exception thrown', err);
        process.exit(1);
    });

}).catch(error => {
    log.error('unable to start server', error);
    process.exit(0);
});
