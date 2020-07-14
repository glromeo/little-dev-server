describe("cli", function () {

    const path = require("path");

    jest.mock("./request-handler.js", function () {
        return {
            createRequestHandler: jest.fn()
        };
    });

    beforeEach(function () {
        jest.resetModules();
    });

    it("can start a server specifying --config", async function () {
        const argv = process.argv;
        const filename = "./fixture/cli/custom-server.config.js";
        process.argv = [
            "node.exe",
            "little-dev-server",
            "--config",
            filename
        ];

        delete require.cache[require.resolve("./cli.js")];
        const {server, config} = await require("./cli.js");

        expect(config.test_property).toBe("custom config");

        await server.shutdown();
    });

    it("can start a server specifying --root", async function () {
        const argv = process.argv;
        process.argv = [
            "node.exe",
            "little-dev-server",
            "--root",
            "./fixture/cli"
        ];

        delete require.cache[require.resolve("./cli.js")];
        const {server, config} = await require("./cli.js");

        expect(config.test_property).toBe(path.resolve(process.cwd(), "./fixture/cli/server.config.js"));

        await server.shutdown();
    });

});