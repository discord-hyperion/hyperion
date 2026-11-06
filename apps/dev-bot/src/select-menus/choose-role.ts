import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

type ChooseRoleSpec = { componentType: ComponentType.RoleSelect };

export default class ChooseRole extends SelectMenuHandler<ChooseRoleSpec> {
    constructor() {
        super({
            componentType: ComponentType.RoleSelect,
            builder: new RoleSelectMenuBuilder()
                .setCustomId("role.choose")
                .setPlaceholder("Choose a role")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ChooseRoleSpec>) {
        const roleNames = ctx.interaction.roles.map(role => role.name);

        await ctx.interaction.update({
            content: `Selected roles: ${roleNames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
