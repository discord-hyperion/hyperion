import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { Bold, Br, Code, CodeBlock, Embed, renderEmbed } from "@hyperion/jsx";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("jsx-demo")
        .setDescription("Show an embed authored with Hyperion JSX."),
    async run(ctx) {
        const embed = renderEmbed(
            <Embed color={0x57f287}>
                <Embed.Title>Todo preview</Embed.Title>
                <Embed.Description>
                    <Bold>Review JSX embeds</Bold>
                    <Br />
                    This example creates a native Discord embed.
                    <Br />
                    <CodeBlock language="ts">Hello</CodeBlock>
                    <Bold>
                        <Code>World</Code>
                    </Bold>
                </Embed.Description>
                <Embed.Field name="Status" inline>
                    Ready for review
                </Embed.Field>
                <Embed.Footer text="Hyperion development bot" />
            </Embed>,
        );

        await ctx.interaction.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
});
