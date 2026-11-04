import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import type { Node } from "./runtime.ts";

/** Where a select is rendered: an action row in a message, or a label in a modal. */
export type Placement = "message" | "modal";

export const selectNames = new Set([
    "StringSelect",
    "UserSelect",
    "RoleSelect",
    "MentionableSelect",
    "ChannelSelect",
]);

type SelectBuilder = {
    setCustomId: (customId: string) => unknown;
    setPlaceholder: (placeholder: string) => unknown;
    setMinValues: (minValues: number) => unknown;
    setMaxValues: (maxValues: number) => unknown;
    setDisabled: (disabled?: boolean) => unknown;
    setRequired: (required?: boolean) => unknown;
};

export const plainString = (node: Node, prop: string) => {
    const value = node.props[prop];

    if (typeof value !== "string") {
        throw new JSXRenderError(
            `${node.path}.${prop}`,
            "Expected an explicit plain string.",
        );
    }

    return value;
};

/** IDs given as an array of plain strings, copied so later edits don't leak in. */
const ids = (node: Node, prop: string): string[] => {
    const value = node.props[prop];

    if (
        !Array.isArray(value) ||
        !value.every(item => typeof item === "string")
    ) {
        throw new JSXRenderError(
            `${node.path}.${prop}`,
            "Expected an array of ID strings.",
        );
    }

    return [...value];
};

/**
 * Apply the props every select shares. Discord rejects `disabled` in modals; it
 * ignores `required` in messages, so that passes through.
 */
export const applySelectProps = (
    menu: SelectBuilder,
    node: Node,
    placement: Placement,
) => {
    menu.setCustomId(plainString(node, "customId"));

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
        if (placement === "modal") {
            throw new JSXRenderError(
                `${node.path}.disabled`,
                "Modals can't contain disabled components; remove disabled.",
            );
        }

        menu.setDisabled(node.props.disabled as boolean);
    }

    if (node.props.required !== undefined) {
        menu.setRequired(node.props.required as boolean);
    }
};

const buildEntitySelect = (node: Node, placement: Placement) => {
    const has = (prop: string) => node.props[prop] !== undefined;

    switch (node.name) {
        case "UserSelect": {
            const menu = new UserSelectMenuBuilder();

            applySelectProps(menu, node, placement);

            if (has("defaultUsers")) {
                menu.setDefaultUsers(ids(node, "defaultUsers"));
            }

            return menu;
        }

        case "RoleSelect": {
            const menu = new RoleSelectMenuBuilder();

            applySelectProps(menu, node, placement);

            if (has("defaultRoles")) {
                menu.setDefaultRoles(ids(node, "defaultRoles"));
            }

            return menu;
        }

        case "MentionableSelect": {
            const menu = new MentionableSelectMenuBuilder();

            applySelectProps(menu, node, placement);

            if (has("defaultUsers")) {
                menu.addDefaultUsers(ids(node, "defaultUsers"));
            }

            if (has("defaultRoles")) {
                menu.addDefaultRoles(ids(node, "defaultRoles"));
            }

            return menu;
        }

        default: {
            const menu = new ChannelSelectMenuBuilder();

            applySelectProps(menu, node, placement);

            if (has("defaultChannels")) {
                menu.setDefaultChannels(ids(node, "defaultChannels"));
            }

            if (has("channelTypes")) {
                menu.setChannelTypes(
                    structuredClone(node.props.channelTypes) as Extract<
                        Parameters<
                            ChannelSelectMenuBuilder["setChannelTypes"]
                        >[0],
                        unknown[]
                    >,
                );
            }

            return menu;
        }
    }
};

/** Build a user, role, mentionable, or channel select without serializing it. */
export const buildSelect = (node: Node, placement: Placement) => {
    try {
        return buildEntitySelect(node, placement);
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            node.path,
            `Native ${node.name} construction failed.`,
            { cause },
        );
    }
};
