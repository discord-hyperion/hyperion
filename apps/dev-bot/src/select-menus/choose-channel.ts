import { ChannelSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ChannelType, ComponentType } from "discord.js";

export default class ChooseChannel extends SelectMenuHandler<ComponentType.ChannelSelect> {
    constructor() {
        super({
            customId: "channel.choose",
            componentType: ComponentType.ChannelSelect,
            builder: new ChannelSelectMenuBuilder()
                .setPlaceholder("Choose text or voice channels")
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.ChannelSelect>) {
        const names = ctx.interaction.values.map(id => {
            const channel = ctx.interaction.channels.get(id);
            return channel && "name" in channel ? (channel.name ?? id) : id;
        });

        await ctx.interaction.update({
            content: `Selected channels: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
