import {
    ActionRowBuilder,
    CustomIdButtonBuilder,
    DangerButtonBuilder,
    LinkButtonBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    StringSelectMenuBuilder,
    SuccessButtonBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { buildStringSelect } from "./render-string-select.ts";
import { type Child, expand, type Node, type Value } from "./runtime.ts";
import { renderTextContent } from "./text.ts";
import { validateComponent } from "./validate-component.ts";

const buttonNode = (value: Value | undefined, path: string): Node => {
    if (typeof value !== "object" || value.name !== "Button") {
        throw new JSXRenderError(path, "Expected a Button.");
    }

    return { ...value, path };
};

const interactive = (node: Node) => {
    const { style, customId } = node.props;

    if (typeof customId !== "string") {
        throw new JSXRenderError(
            node.path,
            "Interactive buttons require an explicit customId.",
        );
    }

    let builder: CustomIdButtonBuilder;
    switch (style) {
        case "primary":
        case 1:
            builder = new PrimaryButtonBuilder();
            break;
        case "secondary":
        case 2:
            builder = new SecondaryButtonBuilder();
            break;
        case "success":
        case 3:
            builder = new SuccessButtonBuilder();
            break;
        case "danger":
        case 4:
            builder = new DangerButtonBuilder();
            break;
        default:
            throw new JSXRenderError(
                node.path,
                "Expected an explicit interactive button style.",
            );
    }

    return builder.setCustomId(customId);
};

export const buildButton = (node: Node) => {
    const link = node.props.url !== undefined;

    if (link && ("customId" in node.props || "style" in node.props)) {
        throw new JSXRenderError(
            node.path,
            "Link buttons cannot specify customId or style.",
        );
    }
    if (link && typeof node.props.url !== "string") {
        throw new JSXRenderError(
            node.path,
            "Link buttons require an explicit string URL.",
        );
    }

    try {
        const builder = link
            ? new LinkButtonBuilder().setURL(node.props.url as string)
            : interactive(node);
        const label = renderTextContent(
            node.props.children,
            `${node.path}.label`,
            node.depth,
            { plain: true },
        );
        if (label.length) builder.setLabel(label);

        if (node.props.emoji !== undefined) {
            builder.setEmoji(
                structuredClone(node.props.emoji) as Parameters<
                    PrimaryButtonBuilder["setEmoji"]
                >[0],
            );
        }
        if (node.props.disabled !== undefined) {
            builder.setDisabled(node.props.disabled as boolean);
        }

        return builder;
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            node.path,
            "Native button construction failed.",
            { cause },
        );
    }
};

/** Render one interactive button suitable for a registered core handler. */
export const renderButton = (view: Child): CustomIdButtonBuilder => {
    const roots = expand(view, "root");
    if (roots.length !== 1) {
        throw new JSXRenderError(
            "root",
            "Expected exactly one interactive Button.",
        );
    }

    const builder = buildButton(buttonNode(roots[0], "Button"));
    if (!(builder instanceof CustomIdButtonBuilder)) {
        throw new JSXRenderError(
            "Button",
            "renderButton accepts only interactive buttons; render link buttons inside action rows.",
        );
    }

    validateComponent(builder, "Button");

    return builder;
};

export type DeclaredIds = { id: string; path: string }[];

/** Reject a custom ID already declared in the same render. */
export const declareId = (ids: DeclaredIds, id: string, path: string) => {
    const duplicate = ids.find(entry => entry.id === id);
    if (duplicate) {
        throw new JSXRenderError(
            path,
            `Duplicate component custom ID; first declared at ${duplicate.path}.`,
        );
    }

    ids.push({ id, path });
};

/** Build one explicit action row; IDs must stay unique across the whole render. */
export const buildRow = (root: Node, path: string, ids: DeclaredIds) => {
    const row = new ActionRowBuilder();
    const children = expand(root.props.children, path, root.depth);

    for (const [childIndex, child] of children.entries()) {
        const childPath = `${path}.children[${childIndex}]`;
        if (
            typeof child !== "object" ||
            (child.name !== "Button" && child.name !== "StringSelect")
        ) {
            throw new JSXRenderError(
                childPath,
                "Expected a Button or StringSelect.",
            );
        }

        const location = `${childPath}.${child.name}`;
        const node = { ...child, path: location };
        const control =
            node.name === "StringSelect"
                ? buildStringSelect(node)
                : buildButton(node);
        if (
            control instanceof CustomIdButtonBuilder ||
            control instanceof StringSelectMenuBuilder
        ) {
            declareId(ids, node.props.customId as string, location);
        }

        row.addComponents(control);
    }

    return row;
};

/** Render explicit action rows; complete-message constraints remain caller-owned. */
export const renderComponents = (view: Child): ActionRowBuilder[] => {
    const roots = expand(view, "root");
    const rows: ActionRowBuilder[] = [];
    const ids: DeclaredIds = [];

    for (const [index, root] of roots.entries()) {
        const path = `components[${index}]`;
        if (typeof root !== "object" || root.name !== "ActionRow") {
            throw new JSXRenderError(path, "Expected an explicit ActionRow.");
        }

        const row = buildRow(root, path, ids);

        validateComponent(row, path);
        rows.push(row);
    }

    return rows;
};
