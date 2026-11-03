import type {
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    InteractionUpdateOptions,
} from "discord.js";
import {
    Container,
    H2,
    renderMessage,
    Section,
    Separator,
    TextDisplay,
    Thumbnail,
} from "../lib/index.ts";

const view = (
    <Container accent={0x5865f2}>
        <Section accessory={<Thumbnail url="https://example.com/a.png" />}>
            <TextDisplay>
                <H2>Title</H2>
            </TextDisplay>
        </Section>
        <Separator spacing="small" />
    </Container>
);

const message = renderMessage(view);
message satisfies InteractionReplyOptions;
message satisfies InteractionUpdateOptions;
message satisfies InteractionEditReplyOptions;

const ephemeral = renderMessage(view, { ephemeral: true });
ephemeral satisfies InteractionReplyOptions;
// @ts-expect-error A sent message's visibility cannot change on update.
ephemeral satisfies InteractionUpdateOptions;

// @ts-expect-error Separator spacing is "small" or "large".
<Separator spacing="medium" />;
// @ts-expect-error Sections require an accessory.
<Section>
    <TextDisplay>Text</TextDisplay>
</Section>;
// @ts-expect-error Thumbnails require a url.
<Thumbnail />;
// @ts-expect-error Accent colours are numbers.
<Container accent="#ff0000" />;
