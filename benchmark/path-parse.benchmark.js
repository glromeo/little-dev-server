const {AtSign} = require("../lib/utility/char-codes.js");
const {Suite} = require('benchmark');

const path = require("path");

new Suite()
    .add('v1', function () {
        path.posix.join("/a/b/c", "d/e/f")
    })
    .add('v2', function () {
        path.posix.resolve("/a/b/c.ext", "d/e/f")
    })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({'async': true});