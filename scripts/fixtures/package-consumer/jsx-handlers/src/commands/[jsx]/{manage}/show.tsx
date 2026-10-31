import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion/core";
import { Embed, renderEmbed } from "@hyperion/jsx";
export default class extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("show")
                .setDescription("JSX embed"),
        });
    }
    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            embeds: [
                renderEmbed(
                    <Embed>
                        <Embed.Title>TSX handler</Embed.Title>
                    </Embed>,
                ),
            ],
        });
    }
}
