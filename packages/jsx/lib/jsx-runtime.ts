import type { Child, Element as JSXElement } from "./runtime.ts";

export { Fragment, jsx, jsxs } from "./runtime.ts";

export namespace JSX {
    export type Element = JSXElement;
    export type ElementType = (props: never) => Child;
    export type ElementChildrenAttribute = { children: unknown };
    export type IntrinsicAttributes = { key?: string | number };
    export type IntrinsicElements = Record<never, never>;
}
