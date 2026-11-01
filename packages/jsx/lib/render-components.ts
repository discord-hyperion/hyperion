import {
    ActionRowBuilder,
    CustomIdButtonBuilder,
    DangerButtonBuilder,
    LinkButtonBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    SuccessButtonBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { type Child, expand, type Node, type Value } from "./runtime.ts";
import { renderTextContent } from "./text.ts";

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

const buildButton = (node: Node) => {
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
            true,
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

const validate = (builder: { toJSON: () => unknown }, path: string) => {
    try {
        builder.toJSON();
    } catch (cause) {
        throw new JSXRenderError(
            path,
            "Native component builder validation failed.",
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

    validate(builder, "Button");

    return builder;
};

/** Render explicit action rows; complete-message constraints remain caller-owned. */
export const renderComponents = (view: Child): ActionRowBuilder[] => {
    const roots = expand(view, "root");
    const rows: ActionRowBuilder[] = [];
    const ids: { id: string; path: string }[] = [];

    for (const [index, root] of roots.entries()) {
        const path = `components[${index}]`;
        if (typeof root !== "object" || root.name !== "ActionRow") {
            throw new JSXRenderError(path, "Expected an explicit ActionRow.");
        }

        const row = new ActionRowBuilder();
        const children = expand(root.props.children, path, root.depth);

        for (const [childIndex, child] of children.entries()) {
            const location = `${path}.children[${childIndex}].Button`;
            const node = buttonNode(child, location);
            const button = buildButton(node);
            if (button instanceof CustomIdButtonBuilder) {
                const id = node.props.customId as string;
                const duplicate = ids.find(entry => entry.id === id);
                if (duplicate) {
                    throw new JSXRenderError(
                        location,
                        `Duplicate button custom ID; first declared at ${duplicate.path}.`,
                    );
                }

                ids.push({ id, path: location });
            }

            row.addComponents(button);
        }

        validate(row, path);
        rows.push(row);
    }

    return rows;
};
