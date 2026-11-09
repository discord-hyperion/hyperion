import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { defineSelectMenu } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.RoleSelect,
    builder: new RoleSelectMenuBuilder()
        .setCustomId("role.choose")
        .setPlaceholder("Choose a role")
        .setMinValues(1)
        .setMaxValues(1),
    run: async ctx => {
        const roleNames = ctx.interaction.roles.map(role => role.name);

        await ctx.interaction.update({
            content: `Selected roles: ${roleNames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
