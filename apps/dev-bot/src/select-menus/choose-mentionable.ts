import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

type ChooseMentionableSpec = {
    componentType: ComponentType.MentionableSelect;
};

export default class ChooseMentionable extends SelectMenuHandler<ChooseMentionableSpec> {
    constructor() {
        super({
            componentType: ComponentType.MentionableSelect,
            builder: new MentionableSelectMenuBuilder()
                .setCustomId("mentionable.choose")
                .setPlaceholder("Choose users or roles")
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ChooseMentionableSpec>) {
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
