describe("resource cache", function () {

    const log = require("tiny-node-logger");

    const {useFixture} = require("./fixture/index.js");
    const {server: {start, stop}, fetch, watcher, resolve} = useFixture({
        config: `${__dirname}/fixture/server.config.js`,
        cache: true
    });

    beforeAll(start);
    afterAll(stop);

    const {writeFileSync, unlinkSync} = require("fs");

    it("cache functionality", async function () {

        const tempFile = resolve("__temp_file__.scss");

        await new Promise(resolve => {
            watcher.on("ready", resolve);
            watcher.add(".nothing");
        });

        writeFileSync(tempFile, `
            .cache_functionality_test {
                background-color: white;
            }
        `, "utf-8");

        expect(watcher.getWatched()["."]).toBe(undefined);

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".cache_functionality_test");
        });

        expect(watcher.getWatched()["."].length).toBe(1);

        await new Promise(resolve => {
            watcher.on("change", resolve);
            writeFileSync(tempFile, `
                .updated_class {
                    background-color: red;
                }
            `, "utf-8");
        });

        expect((watcher.getWatched())["."].length).toBe(1);

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".updated_class");
        });

        unlinkSync(tempFile);

        await new Promise(resolve => watcher.on("unlink", resolve));

        expect((watcher.getWatched())["."].length).toBe(0);
    });

})
;
