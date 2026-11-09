import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import {
    ActionRow,
    Bold,
    Button,
    Container,
    H2,
    MediaGallery,
    renderMessage,
    Section,
    Separator,
    Subtext,
    TextDisplay,
    Thumbnail,
} from "@hyperion-js/jsx";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("layout")
        .setDescription(
            "Show a layout message (Components V2) authored with JSX.",
        ),
    run: async ctx => {
        const { user } = ctx.interaction;
        const avatar = user.displayAvatarURL();

        // Layout messages have no `content`; every visible piece is a component.
        await ctx.interaction.reply(
            renderMessage(
                <Container accent={0x5865f2}>
                    <Section accessory={<Thumbnail url={avatar} />}>
                        <TextDisplay>
                            <H2>Hello, {user.username}</H2>
                            This message is a <Bold>layout message</Bold>.
                            <Subtext>Authored with @hyperion-js/jsx</Subtext>
                        </TextDisplay>
                    </Section>
                    <Separator />
                    <MediaGallery>
                        <MediaGallery.Item
                            url={avatar}
                            description="Your avatar"
                        />
                    </MediaGallery>
                    <ActionRow>
                        <Button url="https://github.com/favylicious/discord-hyperion">
                            View Hyperion
                        </Button>
                    </ActionRow>
                </Container>,
                { ephemeral: true },
            ),
        );
    },
});
