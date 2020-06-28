const {Slash, AtSign} = require("../lib/utility/char-codes.js");
const {Suite} = require('benchmark');

const {posix} = require("path");

const bases = `
/cubilia/curae.jsp
/sed.png
/in/libero/ut/massa/volutpat/convallis/
/amet/sapien/dignissim/vestibulum.js
`.split('\n');

const paths = `
.
..
.name
../../../etc
./cubilia/curae.jsp
/sed.png
/in/libero/ut/massa/volutpat/convallis/
amet/sapien/dignissim/vestibulum.js
`.split('\n');

const re = /(.[^.]+$)?/;

new Suite()
    .add('posix resolve', function () {
        bases.forEach(base => {
            paths.forEach(path => {
                posix.extname(posix.resolve(base, path));
            });
        });
    })
    .add('posix resolve', function () {
        bases.forEach(base => {
            paths.forEach(path => {
                re.exec(posix.resolve(base, path));
            });
        });
    })
    // .add('posix resolve', function () {
    //     bases.forEach(base => {
    //         paths.forEach(path => {
    //             posix.resolve(base, path);
    //         });
    //     });
    // })
    // .add('posix join', function () {
    //     bases.forEach(base => {
    //         paths.forEach(path => {
    //             posix.join(base, path)
    //         });
    //     });
    // })
    // .add('string concatenation', function () {
    //     bases.forEach(base => {
    //         paths.forEach(path => {
    //             const c = base + path;
    //         });
    //     });
    // })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({'async': true});
