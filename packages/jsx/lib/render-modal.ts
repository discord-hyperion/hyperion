import {
    LabelBuilder,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { type Child, expand, type Node } from "./runtime.ts";
import { renderTextContent } from "./text.ts";

const plain = (node: Node, prop: string, path: string) => {
    const value = node.props[prop];

    if (typeof value !== "string") {
        throw new JSXRenderError(
            `${path}.${prop}`,
            "Expected an explicit plain string.",
        );
    }

    return value;
};

const renderInput = (node: Node, path: string) => {
    const customId = plain(node, "customId", path);
    const style = node.props.style === undefined ? "short" : node.props.style;
    const input = new TextInputBuilder()
        .setCustomId(customId)
        .setStyle(
            (style === "short"
                ? 1
                : style === "paragraph"
                  ? 2
                  : style) as Parameters<TextInputBuilder["setStyle"]>[0],
        )
        .setRequired(node.props.required as boolean | undefined);

    if (node.props.placeholder !== undefined) {
        input.setPlaceholder(plain(node, "placeholder", path));
    }

    if (node.props.value !== undefined) {
        input.setValue(plain(node, "value", path));
    }

    if (node.props.minLength !== undefined) {
        input.setMinLength(node.props.minLength as number);
    }

    if (node.props.maxLength !== undefined) {
        input.setMaxLength(node.props.maxLength as number);
    }

    return { input, customId };
};

export const renderModal = (view: Child): ModalBuilder => {
    const roots = expand(view, "root");
    const root = roots[0];

    if (
        roots.length !== 1 ||
        !root ||
        typeof root !== "object" ||
        root.name !== "Modal"
    ) {
        throw new JSXRenderError("root", "Expected exactly one Modal.");
    }

    const builder = new ModalBuilder()
        .setCustomId(plain(root, "customId", "Modal"))
        .setTitle(plain(root, "title", "Modal"));
    const inputs: { customId: string; path: string }[] = [];
    const children = expand(root.props.children, "Modal", root.depth);

    for (const [index, section] of children.entries()) {
        const path = `Modal.children[${index}]`;

        if (typeof section !== "object") {
            throw new JSXRenderError(
                path,
                "Expected a modal label or text display, not bare text.",
            );
        }

        if (section.name === "Modal.TextDisplay") {
            builder.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    renderTextContent(
                        section.props.children,
                        `${path}.TextDisplay`,
                        section.depth,
                    ),
                ),
            );
            continue;
        }

        if (section.name !== "Modal.Label") {
            throw new JSXRenderError(
                path,
                "Expected a modal label or text display.",
            );
        }

        const label = new LabelBuilder().setLabel(
            plain(section, "text", `${path}.Label`),
        );
        const controls = expand(
            section.props.children,
            `${path}.Label`,
            section.depth,
        );
        const control = controls[0];

        if (
            controls.length !== 1 ||
            !control ||
            typeof control !== "object" ||
            control.name !== "Modal.TextInput"
        ) {
            throw new JSXRenderError(
                `${path}.Label`,
                "Expected exactly one Modal.TextInput.",
            );
        }

        if (section.props.description !== undefined) {
            label.setDescription(
                plain(section, "description", `${path}.Label`),
            );
        }

        const location = `${path}.Label.TextInput`;
        const { input, customId } = renderInput(control, location);
        const duplicate = inputs.find(entry => entry.customId === customId);

        if (duplicate) {
            throw new JSXRenderError(
                location,
                `Duplicate input custom ID; first declared at ${duplicate.path}.`,
            );
        }

        inputs.push({ customId, path: location });
        label.setTextInputComponent(input);
        builder.addLabelComponents(label);
    }

    try {
        builder.toJSON();
    } catch (cause) {
        throw new JSXRenderError(
            "Modal",
            "Native modal builder validation failed.",
            { cause },
        );
    }

    return builder;
};
