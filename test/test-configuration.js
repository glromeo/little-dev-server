const {parseCLI, config, configure} = require("../lib/configuration.js");

const path = require("path");

class TestPath {
    constructor(filename) {
        this.path = path.resolve(__dirname, filename);
    }
    join(filename) {
        return path.resolve(this.path, filename);
    }
}

const base = new TestPath("..");
const fixture = new TestPath("fixture");
const webModulesDir = new TestPath("fixture/web_modules");

module.exports = {
    baseDir: base,
    fixtureDir: fixture,
    webModulesDir,
    parseCLI,
    testConfig: {
        rootDir: fixture.path,
        clean: true
    }
}
