import { ComponentType } from "discord.js";
import type { Modal, ModalContext } from "../components/modal.ts";
import { resolveInput } from "./resolve-input.ts";

/** Read structured data before SDK hoisting can hide duplicate custom IDs. */
const extractModalInput = (ctx: ModalContext) => {
    const entries: [string, string][] = [];
    const ids = new Set<string>();

    for (const container of ctx.interaction.components.data) {
        const controls =
            container.type === ComponentType.ActionRow
                ? container.components
                : container.type === ComponentType.Label
                  ? [container.component]
                  : [];

        for (const control of controls) {
            if (control.type !== ComponentType.TextInput) continue;
            if (ids.has(control.customId)) {
                throw new TypeError(
                    "Modal input contains duplicate text-input custom IDs.",
                );
            }
            if (typeof control.value !== "string") {
                throw new TypeError(
                    "Submitted text inputs must contain string values.",
                );
            }

            ids.add(control.customId);
            entries.push([control.customId, control.value]);
        }
    }

    return Object.fromEntries(entries);
};

export const resolveModalInput = async (modal: Modal, ctx: ModalContext) => {
    if (!modal.input) return undefined;

    return resolveInput(modal.input, ctx, () => extractModalInput(ctx));
};
