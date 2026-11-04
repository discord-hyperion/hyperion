import {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { type Child, expand, type Node } from "./runtime.ts";
import { validateComponent } from "./validate-component.ts";

const plainString = (node: Node, prop: string) => {
    const value = node.props[prop];

    if (typeof value !== "string") {
        throw new JSXRenderError(
            `${node.path}.${prop}`,
            "Expected an explicit plain string.",
        );
    }

    return value;
};

const buildOption = (node: Node) => {
    try {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(plainString(node, "label"))
            .setValue(plainString(node, "value"));

        if (node.props.description !== undefined) {
            option.setDescription(plainString(node, "description"));
        }

        if (node.props.emoji !== undefined) {
            option.setEmoji(
                structuredClone(node.props.emoji) as Parameters<
                    StringSelectMenuOptionBuilder["setEmoji"]
                >[0],
            );
        }

        if (node.props.default !== undefined) {
            option.setDefault(node.props.default as boolean);
        }

        return option;
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            node.path,
            "Native select option construction failed.",
            { cause },
        );
    }
};

/** Construct without serializing; containing rows validate their children. */
export const buildStringSelect = (node: Node) => {
    try {
        const menu = new StringSelectMenuBuilder().setCustomId(
            plainString(node, "customId"),
        );
        const values: { value: string; path: string }[] = [];
        const options = expand(
            node.props.children,
            `${node.path}.options`,
            node.depth,
        );

        if (node.props.placeholder !== undefined) {
            menu.setPlaceholder(plainString(node, "placeholder"));
        }

        if (node.props.minValues !== undefined) {
            menu.setMinValues(node.props.minValues as number);
        }

        if (node.props.maxValues !== undefined) {
            menu.setMaxValues(node.props.maxValues as number);
        }

        if (node.props.disabled !== undefined) {
            menu.setDisabled(node.props.disabled as boolean);
        }

        for (const [index, option] of options.entries()) {
            const path = `${node.path}.options[${index}]`;

            if (
                typeof option !== "object" ||
                option.name !== "StringSelect.Option"
            ) {
                throw new JSXRenderError(
                    path,
                    "Expected a StringSelect.Option.",
                );
            }

            const current = { ...option, path };
            const value = plainString(current, "value");
            const duplicate = values.find(entry => entry.value === value);

            if (duplicate) {
                throw new JSXRenderError(
                    path,
                    `Duplicate option value; first declared at ${duplicate.path}.`,
                );
            }

            values.push({ value, path });
            menu.addOptions(buildOption(current));
        }

        return menu;
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            node.path,
            "Native string select construction failed.",
            { cause },
        );
    }
};

/** Render one native string-select builder for existing interaction handlers. */
export const renderStringSelect = (view: Child): StringSelectMenuBuilder => {
    const roots = expand(view, "root");
    const root = roots[0];

    if (
        roots.length !== 1 ||
        !root ||
        typeof root !== "object" ||
        root.name !== "StringSelect"
    ) {
        throw new JSXRenderError("root", "Expected exactly one StringSelect.");
    }

    const builder = buildStringSelect({ ...root, path: "StringSelect" });
    validateComponent(builder, "StringSelect");

    return builder;
};
