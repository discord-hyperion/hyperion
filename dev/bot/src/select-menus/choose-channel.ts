import { ChannelSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "@hyperion";
import { ChannelType, type ComponentType } from "discord.js";

export default class ChooseChannel extends SelectMenu<ComponentType.ChannelSelect> {
    constructor() {
        super({
            builder: new ChannelSelectMenuBuilder()
                .setCustomId("channel.choose")
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
