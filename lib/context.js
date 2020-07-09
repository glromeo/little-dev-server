const HttpStatus = require("http-status-codes");
const qs = require("qs");

const {contentText, EMPTY_OBJECT} = require("./utility/content-utils.js");

const splitURL = /(?<pathname>\/[^?#]*)?(\?(?<search>[^#]+))?(#(?<fragment>.*))?/;
const QUERY = Symbol("?");

module.exports.Context = class {

    constructor(request, response) {
        this.request = request;
        this.response = response;
        this.headers = new Map();

        this.isHttp2 = parseFloat(this.request.httpVersion) < 2;
    }

    set url(url) {
        const {pathname,search,fragment} = splitURL.exec(url).groups;
        this.pathname = pathname;
        this.search = search;
        this.fragment = fragment;
    }

    get query() {
        if (this[QUERY] === undefined) {
            this[QUERY] = this.search === undefined ? EMPTY_OBJECT : qs.parse(this.search);
        }
        return this[QUERY];
    }

    async payload() {
        let contentType = this.request.headers["content-type"];
        if (contentType) {
            contentType = contentType.split(";")[0];
            const text = await contentText(req);
            switch (contentType) {
                case "application/json":
                    return text ? JSON.parse(text) : EMPTY_OBJECT;
                case "application/x-www-form-urlencoded":
                    return qs.parse(text);
                case "text/plain":
                default:
                    return text;
            }
        }
    }

    vary(header) {
        const vary = this.headers.get("vary");
        if (vary && vary.indexOf(header) === -1) {
            header = vary + ", " + header;
        }
        this.headers.set("vary", header);
    }

    header() {
        if (arguments.length === 2) {
            this.headers.set(arguments[0], arguments[1]);
            return this;
        } else {
            return this.headers.get(arguments[0]);
        }
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
        this.response.end(payload);
    }

    close() {
        if (!this.response.writableEnded) {
            this.response.end();
        }
    }

};