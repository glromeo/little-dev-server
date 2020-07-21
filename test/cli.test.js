describe("cli", function () {

    beforeEach(function () {
        jest.resetModules();
        jest.mock("../lib/server.js", () => ({
            startServer: jest.fn().mockImplementation(async config => ({config}))
        }));
        delete require.cache[require.resolve("../lib/cli.js")];
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

        await require("../lib/cli.js");

        expect(require("../lib/server.js").startServer).toHaveBeenCalledWith(
            expect.objectContaining({
                test_property: "custom config"
            })
        );
    });

    it("can start a server specifying --root", async function () {
        const argv = process.argv;
        process.argv = [
            "node.exe",
            "little-dev-server",
            "--root",
            "./test/fixture/cli"
        ];

        await require("../lib/cli.js");

        expect(require("../lib/server.js").startServer).toHaveBeenCalledWith(
            expect.objectContaining({
                test_property: require("path").resolve(process.cwd(), "test/fixture/cli/server.config.js")
            })
        );
    });

});