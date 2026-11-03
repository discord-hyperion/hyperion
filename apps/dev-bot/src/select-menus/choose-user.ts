import { UserSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default class ChooseUser extends SelectMenuHandler<ComponentType.UserSelect> {
    constructor() {
        super({
            customId: "user.choose",
            componentType: ComponentType.UserSelect,
            builder: new UserSelectMenuBuilder()
                .setPlaceholder("Choose a user")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.UserSelect>) {
        const usernames = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected users: ${usernames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
