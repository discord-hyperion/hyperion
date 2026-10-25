import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "@hyperion";
import type { ComponentType } from "discord.js";

export default class ChooseRole extends SelectMenu<ComponentType.RoleSelect> {
    constructor() {
        super({
            builder: new RoleSelectMenuBuilder()
                .setCustomId("role.choose")
                .setPlaceholder("Choose a role")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.RoleSelect>) {
        const roleNames = ctx.interaction.roles.map(role => role.name);

        await ctx.interaction.update({
            content: `Selected roles: ${roleNames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
