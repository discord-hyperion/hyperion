import { ModalBuilder, TextInputBuilder } from "@discordjs/builders";
import type { ModalSubmitInteraction } from "discord.js";
import {
    type AnyInteraction,
    type ModalContext,
    type ModalOptions,
    OwnerOnly,
} from "../src/index.ts";

export const modalContracts = (ctx: ModalContext) => {
    ctx.interaction satisfies ModalSubmitInteraction;
    ctx.interaction satisfies AnyInteraction;
    ctx.interaction.components.getTextInputValue("message") satisfies string;
    ctx.interaction.components.getStringSelectValues(
        "colour",
    ) satisfies readonly string[];
    if (ctx.interaction.isFromMessage()) {
        ctx.interaction.message.id satisfies string;
    }

    const options: ModalOptions = {
        builder: new ModalBuilder().setCustomId("feedback.submit"),
        guards: [
            ctx => {
                ctx.interaction.components.getTextInputValue(
                    "message",
                ) satisfies string;
                return new OwnerOnly();
            },
        ],
    };
    const wrongBuilder: ModalOptions = {
        // @ts-expect-error Modal handlers require a ModalBuilder.
        builder: new TextInputBuilder(),
    };
    // @ts-expect-error Modal submissions use the v15 components resolver, not fields.
    ctx.interaction.fields;

    return { options, wrongBuilder };
};
