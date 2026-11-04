import {
    type ChannelSelectMenuBuilder,
    FileUploadBuilder,
    LabelBuilder,
    type MentionableSelectMenuBuilder,
    ModalBuilder,
    type RoleSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    type UserSelectMenuBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { buildSelect, selectNames } from "./render-select.ts";
import { buildStringSelect } from "./render-string-select.ts";
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

const renderFileUpload = (node: Node, path: string) => {
    const upload = new FileUploadBuilder().setCustomId(
        plain(node, "customId", path),
    );

    if (node.props.minValues !== undefined) {
        upload.setMinValues(node.props.minValues as number);
    }

    if (node.props.maxValues !== undefined) {
        upload.setMaxValues(node.props.maxValues as number);
    }

    if (node.props.required !== undefined) {
        upload.setRequired(node.props.required as boolean);
    }

    if (node.props.fileTypes !== undefined) {
        upload.setFileTypes(
            structuredClone(node.props.fileTypes) as Extract<
                Parameters<FileUploadBuilder["setFileTypes"]>[0],
                unknown[]
            >,
        );
    }

    return upload;
};

const modalControls = "a Modal.TextInput, select menu, or Modal.FileUpload";

/** Put one modal control into its label, returning the control's custom ID. */
const addControl = (label: LabelBuilder, control: Node, path: string) => {
    const location = `${path}.${control.name.replace(/^Modal\./, "")}`;
    const node = { ...control, path: location };

    switch (control.name) {
        case "Modal.TextInput": {
            const { input, customId } = renderInput(control, location);

            label.setTextInputComponent(input);

            return { customId, location };
        }

        case "Modal.FileUpload":
            label.setFileUploadComponent(renderFileUpload(control, location));

            return { customId: control.props.customId as string, location };

        case "StringSelect":
            label.setStringSelectMenuComponent(
                buildStringSelect(node, "modal"),
            );

            return { customId: control.props.customId as string, location };

        default: {
            const select = buildSelect(node, "modal");

            if (control.name === "UserSelect") {
                label.setUserSelectMenuComponent(
                    select as UserSelectMenuBuilder,
                );
            } else if (control.name === "RoleSelect") {
                label.setRoleSelectMenuComponent(
                    select as RoleSelectMenuBuilder,
                );
            } else if (control.name === "MentionableSelect") {
                label.setMentionableSelectMenuComponent(
                    select as MentionableSelectMenuBuilder,
                );
            } else {
                label.setChannelSelectMenuComponent(
                    select as ChannelSelectMenuBuilder,
                );
            }

            return { customId: control.props.customId as string, location };
        }
    }
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
                        { blocks: true },
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
            (control.name !== "Modal.TextInput" &&
                control.name !== "Modal.FileUpload" &&
                !selectNames.has(control.name))
        ) {
            throw new JSXRenderError(
                `${path}.Label`,
                `Expected exactly one modal control: ${modalControls}.`,
            );
        }

        if (section.props.description !== undefined) {
            label.setDescription(
                plain(section, "description", `${path}.Label`),
            );
        }

        const { customId, location } = addControl(
            label,
            control,
            `${path}.Label`,
        );
        const duplicate = inputs.find(entry => entry.customId === customId);

        if (duplicate) {
            throw new JSXRenderError(
                location,
                `Duplicate control custom ID; first declared at ${duplicate.path}.`,
            );
        }

        inputs.push({ customId, path: location });
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
