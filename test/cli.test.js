describe("cli", function () {

    const path = require("path");

    jest.mock("../lib/request-handler.js", function () {
        return {
            createRequestHandler: jest.fn()
        };
    });

    beforeEach(function () {
        jest.resetModules();
    });

    it("can start a server specifying --config", async function () {
        const argv = process.argv;
        const filename = "test/fixture/cli/custom-server.config.js";
        process.argv = [
            "node.exe",
            "little-dev-server",
            "--config",
            filename
        ];

        delete require.cache[require.resolve("../lib/cli.js")];
        const {server, config} = await require("../lib/cli.js");

        expect(config.test_property).toBe("custom config");

        await server.shutdown();
    });

    it("can start a server specifying --root", async function () {
        const argv = process.argv;
        process.argv = [
            "node.exe",
            "little-dev-server",
            "--root",
            "./test/fixture/cli"
        ];

        delete require.cache[require.resolve("../lib/cli.js")];
        const {server, config} = await require("../lib/cli.js");

        expect(config.test_property).toBe(path.resolve(process.cwd(), "test/fixture/cli/server.config.js"));

        await server.shutdown();
    });

});