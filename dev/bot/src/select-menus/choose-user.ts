import { UserSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "@hyperion";
import type { ComponentType } from "discord.js";

export default class ChooseUser extends SelectMenu<ComponentType.UserSelect> {
    constructor() {
        super({
            builder: new UserSelectMenuBuilder()
                .setCustomId("user.choose")
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
