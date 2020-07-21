"use strict";

import {customElement, html, LitElement} from "lit-element";

@customElement("hello-world")
export class HelloWorld extends LitElement {
    render() {
        return html`<h1>Hello World! 👋🌍</h1>`;
    }
}
