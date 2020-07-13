const HttpStatus = require("http-status-codes");
const qs = require("qs");
const {TEXT_CONTENT_TYPE} = require("./utility/mime-types.js");

const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");

const splitURL = /(?<pathname>\/[^?#]*)?(?<search>\?[^#]+)?(#(?<fragment>.*))?/;

const QUERY = Symbol("query");
const PAYLOAD = Symbol("payload");

module.exports.Context = class {

    constructor(request, response) {
        this.headers = new Map();
        this.request = request;
        this.response = response;
        this.isHttp2 = parseFloat(this.request.httpVersion) >= 2;
    }

    get method() {
        return this.request.method;
    }

    get url() {
        return this.request.url;
    }

    get query() {
        if (this[QUERY] === undefined) {
            this[QUERY] = this.search === undefined ? EMPTY_OBJECT : qs.parse(this.search.substring(1));
        }
        return this[QUERY];
    }

    apply(url = "/", variables = {}) {
        const {pathname, search, fragment} = splitURL.exec(url).groups;
        this.pathname = decodeURI(pathname);
        this.search = search;
        this.fragment = decodeURIComponent(fragment);
        this.variables = variables;
        return this;
    }

    vary(header) {
        const vary = this.headers.get("vary");
        if (vary && vary.indexOf(header) === -1) {
            header = vary + ", " + header;
        }
        this.headers.set("vary", header);
        return this;
    }

    header() {
        const name = arguments[0];
        if (arguments.length === 2) {
            let value = arguments[1];
            if (value === undefined) {
                this.headers.delete(name);
                return;
            }
            if (value instanceof Date) {
                this.headers.set(name, value.toUTCString());
                return;
            }
            this.headers.set(name, value);
            return this;
        } else {
            return this.request.headers[name];
        }
    }

    redirect(location) {
        this.header("Location", location);
        this.send(HttpStatus.PERMANENT_REDIRECT);
    }

    error({code, message, stack}) {
        switch (code) {
            case "ENOENT":
                return this.send(HttpStatus.NOT_FOUND, stack || message);
            default:
                return this.send(HttpStatus.INTERNAL_SERVER_ERROR, stack || message);
        }
    }

    get payload() {
        if (!this.hasOwnProperty(PAYLOAD)) {
            this[PAYLOAD] = contentText(this.request).then(text => {
                let contentType = this.request.headers["content-type"];
                if (contentType) {
                    contentType = contentType.split(";")[0];
                }
                switch (contentType) {
                    case "application/json":
                        return text ? JSON.parse(text) : EMPTY_OBJECT;
                    case "application/x-www-form-urlencoded":
                        return qs.parse(text);
                    case "text/plain":
                    default:
                        return text;
                }
            });
        }
        return this[PAYLOAD];
    }

    status(statusCode) {
        this.response.statusCode = statusCode || this.content !== undefined ? HttpStatus.OK : HttpStatus.NO_CONTENT;
        if (!this.isHttp2) {
            this.response.statusMessage = HttpStatus.getStatusText(statusCode);
        }
        for (const [name, value] of this.headers.entries()) {
            this.response.setHeader(name, value);
        }
        return this;
    }

    send(payload) {
        if (typeof payload === "string") {
            this.header("content-type", TEXT_CONTENT_TYPE);
            this.header("content-length", payload.length);
            this.header("last-modified", new Date());
        }
        if (typeof payload === "object") {

            if (payload.headers === undefined) {

                let accept = this.request.headers["accept"];
                if (accept) {
                    accept = accept.split(",")[0];
                }

                if (accept === "application/json") {
                    payload = typeof payload === "object" ? JSON.stringify(payload) : "";
                    this.header("content-type", "application/json; charset=UTF-8");
                }
                if (accept === "text/plain" || accept === undefined) {
                    payload = String(payload);
                    this.header("content-type", "text/plain; charset=UTF-8");
                }

                this.header("content-length", payload.length);
                this.header("last-modified", new Date());

            } else {
                for (const [key, value] of payload.headers) {
                    this.header(key.toLowerCase(), value);
                }
                payload = payload.content;
            }
        }
        this.response.end(payload);
    }

    close() {
        if (!this.response.writableEnded) {
            if (!this.response.headersSent) {
                if (!this.this.response.statusCode) {
                    this.this.response.statusCode = this.content !== undefined ? HttpStatus.OK : HttpStatus.NO_CONTENT;
                }

                this.response.writeHead()
            }
            this.response.end();
        }
        const closed = () => {
            throw new Error("context already closed");
        }
        for (const method of Object.keys(this.constructor.prototype)) if (typeof this[method] === "function") {
            this[method] = closed;
        }
    }
}
