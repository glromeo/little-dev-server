const {testServer} = require("./test-configuration.js");

describe("babel transformer integration tests", function () {

    let config, server, fetch;

    beforeAll(async function () {
        const context = await testServer({port: 3050});
        config = context.config;
        server = context.server;
        fetch = context.fetch;
    });

    afterAll(async function () {
        await server.shutdown();
    });

    it("can resolve bare import graphql-tag", async function () {

        const js = await fetch("/src/graphql-tag-importer.js").then(response => {
            expect(response.status).toBe(200);
            return response.text();
        });

        expect(js).toContain("import gql from \"/web_modules/graphql-tag/src/index.js\";");
    });

    it("can transpile cjs to es2015", async function () {

        const js = await fetch("/web_modules/graphql-tag/src/index.js").then(response => {
            expect(response.status).toBe(200);
            return response.text();
        });

        const expected = expect(js);
        expected.toContain("import parser from '/web_modules/graphql/language/parser';");
        expected.toContain("var src = gql;\n\nexport default src;");
    })

    it("graphql parser.js has a default export", async function () {

        const js = await fetch("/web_modules/graphql/language/parser.mjs").then(response => {
            expect(response.status).toBe(200);
            return response.text();
        });

        expect(js).toContain("import { isCollection, forEach, getAsyncIterator, $$asyncIterator, isAsyncIterable } from '/web_modules/iterall';\n");
    })

    it("can resolve lit-element", async function () {

        const js = await fetch("/src/hello-world.mjs").then(response => {
            expect(response.status).toBe(200);
            return response.text();
        });

        const expected = expect(js);
        expect(js).toContain("import { customElement, html, LitElement } from \"/web_modules/lit-element/lit-element.js\";");
    })

    it("can resolve scss", async function () {

        const js = await fetch("/src/styled-component.mjs").then(response => {
            expect(response.status).toBe(200);
            return response.text();
        });

        const expected = expect(js);
        expect(js).toContain("import style from \"/src/w3.scss?type=module\";");
    })

})
