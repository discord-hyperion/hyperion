import { JSXRenderError } from "./error.ts";

const element = Symbol("hyperion.jsx.element");
export const Fragment = Symbol("hyperion.jsx.fragment");

export type Child =
    | Element
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly Child[];
export type Component<Props = Record<string, unknown>> = (
    props: Readonly<Props>,
) => Child;
/** Any component, with its props type erased so registries can hold them together. */
type AnyComponent = Component<never>;

export type Element = {
    readonly [element]: true;
    readonly type: AnyComponent | typeof Fragment;
    readonly props: Readonly<Record<string, unknown>>;
};

type Definition = { name: string; props: readonly string[] };
const definitions = new WeakMap<AnyComponent, Definition>();

export const jsx = (
    type: Element["type"],
    props: Record<string, unknown> | null,
    _key?: unknown,
): Element => {
    const { key: _ignored, ...snapshot } = props ?? {};

    return Object.freeze({
        [element]: true as const,
        type,
        props: Object.freeze(snapshot),
    });
};

export const jsxs = jsx;
export const jsxDEV = (
    type: Element["type"],
    props: Record<string, unknown> | null,
    key?: unknown,
    _staticChildren?: boolean,
    _source?: unknown,
    _self?: unknown,
) => jsx(type, props, key);

export const primitive = <Props>(
    name: string,
    props: readonly string[],
): Component<Props> => {
    const component: Component<Props> = values =>
        jsx(component as AnyComponent, values as Record<string, unknown>);

    definitions.set(component as AnyComponent, { name, props });

    return component;
};

export type Node = {
    name: string;
    props: Readonly<Record<string, unknown>>;
    path: string;
    depth: number;
};
export type Value = string | number | Node;

/**
 * How deep `expand` may recurse. Each array level and each authoring-component call
 * counts, not only elements, so this bounds recursive components as well.
 */
const maxDepth = 128;

/** Expand only the current level; renderers decide which children are valid. */
export const expand = (child: unknown, path: string, depth = 0): Value[] => {
    if (depth > maxDepth) {
        throw new JSXRenderError(
            path,
            "Nesting limit exceeded; check for recursive components or children.",
        );
    }

    if (child === null || child === undefined || typeof child === "boolean")
        return [];
    if (typeof child === "string" || typeof child === "number") return [child];

    if (Array.isArray(child)) {
        return child.flatMap((value, index) =>
            expand(value, `${path}[${index}]`, depth + 1),
        );
    }

    if (typeof child === "function") {
        throw new JSXRenderError(
            path,
            "Expected JSX content but got a component; render it as <Component /> instead.",
        );
    }

    if (typeof child !== "object" || !(element in child)) {
        // Observe rejected async components without permitting asynchronous rendering.
        if (child instanceof Promise) {
            void child.catch(() => {});
        }

        throw new JSXRenderError(
            path,
            "Expected synchronous JSX content; promises, builders, and arbitrary objects are unsupported.",
        );
    }

    const node = child as Element;

    if (node.type === Fragment) {
        if (Object.keys(node.props).some(prop => prop !== "children")) {
            throw new JSXRenderError(
                path,
                "Fragments accept only children and key metadata.",
            );
        }

        return expand(node.props.children, path, depth + 1);
    }

    if (typeof node.type !== "function") {
        throw new JSXRenderError(
            path,
            "Expected an imported JSX component; intrinsic elements are unsupported.",
        );
    }

    const definition = definitions.get(node.type);

    if (definition) {
        for (const prop of Object.keys(node.props)) {
            if (!definition.props.includes(prop)) {
                throw new JSXRenderError(
                    `${path}.${definition.name}`,
                    `Unknown prop "${prop}".`,
                );
            }
        }

        return [
            {
                name: definition.name,
                props: node.props,
                path,
                depth: depth + 1,
            },
        ];
    }

    let result: unknown;

    try {
        result = node.type(node.props as never);
    } catch (cause) {
        // Name the component, which is code rather than supplied text, so a parent
        // with several custom components shows which one failed.
        const name = node.type.name ? ` "${node.type.name}"` : "";

        throw new JSXRenderError(path, `Authoring component${name} failed.`, {
            cause,
        });
    }

    return expand(result, path, depth + 1);
};
