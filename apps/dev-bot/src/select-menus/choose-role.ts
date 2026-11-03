import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default class ChooseRole extends SelectMenuHandler<ComponentType.RoleSelect> {
    constructor() {
        super({
            customId: "role.choose",
            componentType: ComponentType.RoleSelect,
            builder: new RoleSelectMenuBuilder()
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
