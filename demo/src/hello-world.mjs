"use strict";
import {format, parse} from "date-fns";
import {customElement, html, LitElement, query} from "lit-element";
import {unsafeHTML} from "lit-html/directives/unsafe-html";
import {css} from "lit-element/lit-element.js";
import {html as lithtml, render} from "lit-html";

@customElement("hello-world")
export class HelloWorld extends LitElement {

    static styles = [css`:host { background-color: white; }`];

    @query(".placeholder")
    pp;

    updated(_changedProperties) {
        render(lithtml`<span>👋🌍</span>`, this.pp);
    }

    render() {
        console.log(parse("12:30:00", "HH:mm:ss", new Date()), format(parse("12:30:00", "HH:mm:ss", new Date()), "HH.mm.ss"));
        return html`${unsafeHTML("<h1>Hello World!! <span class='placeholder'></span></h1>")}`;
    }
}
