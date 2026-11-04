import { type Attachment, ComponentType, type ModalData } from "discord.js";
import type { ModalContext, ModalHandler } from "../components/modal.ts";
import { resolveInput } from "./resolve-input.ts";

/** A schema input value for one submitted modal control. */
type ControlValue =
    | string
    | readonly string[]
    | readonly Attachment[]
    | boolean
    | null;

const isStringArray = (value: unknown): value is readonly string[] =>
    Array.isArray(value) && value.every(item => typeof item === "string");

/**
 * Read one modal control's value, or `undefined` for controls outside the
 * extraction scope. Messages never include submitted values or custom IDs.
 */
const controlValue = (control: ModalData): ControlValue | undefined => {
    switch (control.type) {
        case ComponentType.TextInput:
            if (typeof control.value !== "string") {
                throw new TypeError(
                    "Submitted text inputs must contain string values.",
                );
            }

            return control.value;
        case ComponentType.StringSelect:
        case ComponentType.UserSelect:
        case ComponentType.RoleSelect:
        case ComponentType.MentionableSelect:
        case ComponentType.ChannelSelect:
        case ComponentType.CheckboxGroup:
            if (!isStringArray(control.values)) {
                throw new TypeError(
                    "Submitted select menus and checkbox groups must contain string arrays.",
                );
            }

            return [...control.values];
        case ComponentType.FileUpload: {
            const attachments = isStringArray(control.values)
                ? control.values.map(id => control.attachments?.get(id))
                : undefined;

            if (
                !attachments?.every(
                    (attachment): attachment is Attachment =>
                        attachment !== undefined,
                )
            ) {
                throw new TypeError(
                    "Submitted file uploads must resolve every uploaded file.",
                );
            }

            return attachments;
        }
        case ComponentType.RadioGroup:
            if (typeof control.value !== "string" && control.value !== null) {
                throw new TypeError(
                    "Submitted radio groups must contain a string or null.",
                );
            }

            return control.value;
        case ComponentType.Checkbox:
            if (typeof control.value !== "boolean") {
                throw new TypeError(
                    "Submitted checkboxes must contain boolean values.",
                );
            }

            return control.value;
        default:
            return undefined;
    }
};

/** Read structured data before SDK hoisting can hide duplicate custom IDs. */
const extractModalInput = (ctx: ModalContext) => {
    const entries: [string, ControlValue][] = [];
    const ids = new Set<string>();

    for (const container of ctx.interaction.components.data) {
        const controls: readonly ModalData[] =
            container.type === ComponentType.ActionRow
                ? container.components
                : container.type === ComponentType.Label
                  ? [container.component]
                  : [];

        for (const control of controls) {
            const value = controlValue(control);
            if (value === undefined) continue;

            if (ids.has(control.customId)) {
                throw new TypeError(
                    "Modal input contains duplicate modal-control custom IDs.",
                );
            }

            ids.add(control.customId);
            entries.push([control.customId, value]);
        }
    }

    return Object.fromEntries(entries);
};

export const resolveModalInput = async (
    modal: ModalHandler,
    ctx: ModalContext,
) => {
    if (!modal.input) return undefined;

    return resolveInput(modal.input, ctx, () => extractModalInput(ctx));
};
