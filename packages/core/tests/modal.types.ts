import { ModalBuilder, TextInputBuilder } from "@discordjs/builders";
import type { ModalSubmitInteraction } from "discord.js";
import {
    type AnyInteraction,
    type ModalContext,
    type ModalHandlerOptions,
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

    const options: ModalHandlerOptions = {
        customId: "feedback.submit",
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
    const wrongBuilder: ModalHandlerOptions = {
        customId: "feedback.submit",
        // @ts-expect-error Modal templates must be ModalBuilder instances.
        builder: new TextInputBuilder(),
    };
    // @ts-expect-error Modal submissions use the v15 components resolver, not fields.
    ctx.interaction.fields;

    return { options, wrongBuilder };
};
