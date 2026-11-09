import { ChannelSelectMenuBuilder } from "@discordjs/builders";
import { defineSelectMenu } from "@hyperion-js/core";
import { ChannelType, ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.ChannelSelect,
    builder: new ChannelSelectMenuBuilder()
        .setCustomId("channel.choose")
        .setPlaceholder("Choose text or voice channels")
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        .setMinValues(0)
        .setMaxValues(5),
    run: async ctx => {
        const names = ctx.interaction.values.map(id => {
            const channel = ctx.interaction.channels.get(id);

            return channel && "name" in channel ? (channel.name ?? id) : id;
        });

        await ctx.interaction.update({
            content: `Selected channels: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
