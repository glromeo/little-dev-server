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

        const ready = new Promise(resolve => {
            watcher.on("ready", resolve);
            watcher.add(".nothing");
        });

        log.info("waiting for watcher to be ready");

        await ready;

        writeFileSync(tempFile, `
            .cache_functionality_test {
                background-color: white;
            }
        `, "utf-8");
        log.info(tempFile, "written");

        expect(watcher.getWatched()["."]).toBe(undefined);

        log.info("fetching for the first time");

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".cache_functionality_test");
        });

        expect(watcher.getWatched()["."].length).toBe(1);

        const changed = new Promise(async resolve => {
            watcher.on("change", (event, file) => {
                log.info(event, file);
                resolve();
            });
            await new Promise(resolve => setTimeout(resolve, 150));
            writeFileSync(tempFile, `
                .updated_class {
                    background-color: red;
                }
            `, "utf-8");
            log.info(tempFile, "written");
        });

        log.info("waiting for the change to be detected by the watcher");

        await changed;

        expect((watcher.getWatched())["."].length).toBe(1);

        log.info("fetching for the second time");

        await fetch(`/__temp_file__.scss`).then(res => res.text()).then(text => {
            expect(text).toContain(".updated_class");
        });

        const unlinked = new Promise(resolve => {
            watcher.on("unlink", resolve);
            unlinkSync(tempFile);
            log.info(tempFile, "deleted");
        });

        log.info("waiting for the unlink");

        await unlinked;

        expect((watcher.getWatched())["."].length).toBe(0);
    });

})
;
