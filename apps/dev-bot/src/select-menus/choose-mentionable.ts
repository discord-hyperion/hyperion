import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { defineSelectMenu } from "@hyperion-js/core";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.MentionableSelect,
    builder: new MentionableSelectMenuBuilder()
        .setCustomId("mentionable.choose")
        .setPlaceholder("Choose users or roles")
        .setMinValues(0)
        .setMaxValues(5),
    run: async ctx => {
        const { values, users, roles } = ctx.interaction;
        const names = values.map(
            id => users.get(id)?.username ?? roles.get(id)?.name ?? id,
        );

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
