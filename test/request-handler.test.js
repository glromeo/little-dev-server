const {createRouter, METHODS} = require("../lib/request-handler.js");

describe("Router", function () {

    let router;

    beforeEach(function () {
        router = createRouter();
    })

    const h1 = (req, res) => {
    };
    const h2 = (req, res) => {
    };
    const h3 = (req, res) => {
    };
    const h4 = (req, res) => {
    };

    it("can add handlers and route", function () {

        router.get("/abc", h1);
        router.get("/abc/def/ghi", h2);
        router.get("/abc/def", h4);
        router.put("/abc/def", h3);
        router.post("/abc/def/jkl", h4);

        // This match is not very effective due to the nature of Symbol()
        expect(router).toMatchObject({
            routes: {
                "abc": {
                    "def": {
                        "ghi": {
                            [Symbol()]: h2
                        },
                        "jkl": {
                            [Symbol()]: h4
                        },
                        [Symbol()]: h3
                    },
                    [Symbol()]: h1
                }
            }
        });

        const {GET, PUT, POST} = METHODS;

        expect(router.routes["abc"][GET]).toMatchObject({handler: h1, params: []});
        expect(router.routes["abc"]["def"]["ghi"][GET]).toMatchObject({handler: h2, params: []});
        expect(router.routes["abc"]["def"][PUT]).toMatchObject({handler: h3, params: []});
        expect(router.routes["abc"]["def"]["jkl"][POST]).toMatchObject({handler: h4, params: []});
    });

    it("can handle globs", async function () {

        const {GET, PUT, POST} = METHODS;

        let mock1 = jest.fn();
        router.get("/abc/:name", mock1);
        router.route(GET, "/abc/def");
        expect(mock1).toHaveBeenCalledWith({name: "def"});

        let mock2 = jest.fn();
        router.get("/abc/def/:alias", mock2);
        router.route(GET, "/abc/def/ijk");
        expect(mock2).toHaveBeenCalledWith({alias: "ijk"});
        expect(mock1).toHaveBeenCalledTimes(1);

        let mock3 = jest.fn();
        router.get("/abc/xyz", mock3);
        router.route(GET, "/abc/def");
        expect(mock3).not.toHaveBeenCalled();
        expect(mock1).toHaveBeenCalledTimes(2);

        router.route(GET, "/abc/xyz");
        expect(mock3).toHaveBeenCalledTimes(1);

        let mock4 = jest.fn();
        router.get("/abc/:name/:address", mock4);
        router.route(GET, "/abc/def/ghi");
        expect(mock1).toHaveBeenCalledTimes(2);
        expect(mock2).toHaveBeenCalledTimes(2);
        expect(mock4).not.toHaveBeenCalled();
        router.route(GET, "/abc/xxx/yyy");
        expect(mock4).toHaveBeenCalledWith({name: "xxx", address: "yyy"});
    });

    it("can't register handler twice", async function () {
        router.get("/abc/:name/:address", jest.fn());
        router.post("/abc/:name/:address", jest.fn());
        expect(()=>router.get("/abc/:name/:address", jest.fn())).toThrow("handler already registered for: GET");
    });


});