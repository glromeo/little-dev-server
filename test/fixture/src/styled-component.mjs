"use strict";

import {customElement, html, LitElement} from "lit-element";

import style from "./w3.scss";

@customElement("styled-component")
export class StyledComponent extends LitElement {
    static styles = [style];

    render() {
        return html`<h1>Hello World! 👋🌍</h1>`;
    }
}
