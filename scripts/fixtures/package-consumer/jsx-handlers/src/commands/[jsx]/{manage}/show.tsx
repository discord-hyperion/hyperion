import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { Embed, renderEmbed } from "@hyperion-js/jsx";
export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("show")
        .setDescription("JSX embed"),
    run: async ctx => {
        await ctx.interaction.reply({
            embeds: [
                renderEmbed(
                    <Embed>
                        <Embed.Title>TSX handler</Embed.Title>
                    </Embed>,
                ),
            ],
        });
    },
});
