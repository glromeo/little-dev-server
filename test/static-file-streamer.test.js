const {contentText} = require("../lib/utility/content-utils.js");
const {fixtureDir} = require("./test.setup.js");
const {useStaticFileStreamer} = require("../lib/pipeline/static-file-streamer.js");
const path = require("path");

describe("static file streamer", function () {

    const {streamStaticFile} = useStaticFileStreamer({rootDir: fixtureDir});

    it("can serve a file", async function () {
        const {
            content,
            contentType,
            contentLength,
            lastModified
        } = await streamStaticFile("/package.json");
        const text = await contentText(content);
        expect(JSON.parse(text).name).toBe("@test/fixture");
        expect(contentType).toBe("application/json; charset=UTF-8");
        expect(contentLength).toBe(512);
        expect(lastModified).toMatchObject(new Date("2020-06-30T18:56:21.203Z"));
    })

    it("redirects missing /favicon.ico to /resources/javascript.png", async function () {
        await expect(streamStaticFile("/favicon.ico")).rejects.toStrictEqual({redirect: "/resources/javascript.png"});
    });

    it("fails if it's a missing file", async function () {
        await expect(streamStaticFile("/missing.file")).rejects.toStrictEqual({
            code: "ENOENT",
            message: "no such file or directory: " + path.join(fixtureDir, "/missing.file")
        });
    });
})
