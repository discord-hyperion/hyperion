import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "@hyperion";
import type { ComponentType } from "discord.js";

export default class ChooseMentionable extends SelectMenu<ComponentType.MentionableSelect> {
    constructor() {
        super({
            builder: new MentionableSelectMenuBuilder()
                .setCustomId("mentionable.choose")
                .setPlaceholder("Choose users or roles")
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.MentionableSelect>) {
        const { values, users, roles } = ctx.interaction;
        const names = values.map(
            id => users.get(id)?.username ?? roles.get(id)?.name ?? id,
        );

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
