const HttpStatus = require("http-status-codes");
const qs = require("qs");
const {TEXT_CONTENT_TYPE} = require("./utility/mime-types.js");

const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");

const splitURL = /(?<pathname>\/[^?#]*)?(?<search>\?[^#]+)?(#(?<fragment>.*))?/;

const QUERY = Symbol("query");
const PAYLOAD = Symbol("payload");

module.exports.Context = class {

    constructor(request, response) {
        this.request = request;
        this.response = response;

        this.isHttp2 = parseFloat(this.request.httpVersion) < 2;
    }

    set url(url) {
        const {pathname, search, fragment} = splitURL.exec(url).groups;
        this.pathname = pathname;
        this.search = search;
        this.fragment = fragment;
    }

    get query() {
        if (this[QUERY] === undefined) {
            this[QUERY] = this.search === undefined ? EMPTY_OBJECT : qs.parse(this.search.substring(1));
        }
        return this[QUERY];
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

    vary(header) {
        const vary = this.response.getHeader("vary");
        if (vary && vary.indexOf(header) === -1) {
            header = vary + ", " + header;
        }
        this.response.setHeader("vary", header);
    }

    header() {
        const name = arguments[0];
        if (arguments.length === 2) {
            let value = arguments[1];
            if (value === undefined) {
                this.response.removeHeader(name);
                return;
            }
            if (value instanceof Date) {
                this.response.setHeader(name, value.toUTCString());
                return;
            }
            this.response.setHeader(name, value);
            return this;
        } else {
            return this.request.headers[name];
        }
    }

    redirect(location) {
        this.response.writeHead(HttpStatus.PERMANENT_REDIRECT, {
            "Location": location
        });
        this.response.end();
    }

    error(statusCode = HttpStatus.INTERNAL_SERVER_ERROR, statusMessage, payload) {

        if (typeof statusCode === "object") {
            const {
                code,
                message,
                stack
            } = statusCode;

            switch (code) {
                case "ENOENT":
                    statusCode = HttpStatus.NOT_FOUND;
                    break;
                default:
                    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            }

            payload = stack || message;
        }

        this.response.statusCode = statusCode;
        this.response.statusMessage = this.isHttp2 ? undefined : statusMessage || HttpStatus.getStatusText(statusCode);
        this.response.setHeader("content-type", TEXT_CONTENT_TYPE);
        this.response.setHeader("content-length", payload.length);
        this.response.setHeader("last-modified", new Date().toUTCString());
        this.response.end(payload);
    }

    close() {
        if (!this.response.writableEnded) {
            this.response.end();
        }
    }

};
