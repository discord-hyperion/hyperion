import {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import {
    applySelectProps,
    type Placement,
    plainString,
} from "./render-select.ts";
import { type Child, expand, type Node } from "./runtime.ts";
import { validateComponent } from "./validate-component.ts";

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
export const buildStringSelect = (node: Node, placement: Placement) => {
    try {
        const menu = new StringSelectMenuBuilder();
        const values: { value: string; path: string }[] = [];
        const options = expand(
            node.props.children,
            `${node.path}.options`,
            node.depth,
        );

        applySelectProps(menu, node, placement);

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

    const builder = buildStringSelect(
        { ...root, path: "StringSelect" },
        "message",
    );
    validateComponent(builder, "StringSelect");

    return builder;
};
