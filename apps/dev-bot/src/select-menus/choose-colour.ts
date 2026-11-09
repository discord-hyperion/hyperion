import { StringSelectMenuBuilder } from "@discordjs/builders";
import { defineInput, defineSelectMenu } from "@hyperion-js/core";
import { ComponentType, MessageFlags } from "discord.js";
import * as v from "valibot";

// The values come from the client, so a stale or forged pick is checked here.
const input = defineInput({
    schema: v.pipe(v.array(v.picklist(["blue", "green", "red"])), v.length(1)),
});

export default defineSelectMenu({
    componentType: ComponentType.StringSelect,
    builder: new StringSelectMenuBuilder()
        .setCustomId("colour.choose")
        .setPlaceholder("Choose a colour")
        .addOptions(
            { label: "Blue", value: "blue" },
            { label: "Green", value: "green" },
            { label: "Red", value: "red" },
        ),
    input,
    run: async ctx => {
        const [issues, colours] = ctx.input;

        if (issues) {
            await ctx.interaction.reply({
                content: "That colour isn't on the list.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({
            content: `You chose ${colours[0]}.`,
            allowedMentions: { parse: [] },
        });
    },
});
