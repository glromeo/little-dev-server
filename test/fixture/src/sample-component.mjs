"use strict";

import {customElement, html, LitElement} from "lit-element";

@customElement("sample-component")
export class SampleComponent extends LitElement {
    render() {
        return html`<h1>Hello World! 👋🌍</h1>`;
    }
}
