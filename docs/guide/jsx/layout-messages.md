# Layout messages

An embed hangs a card under your message text. A **layout message** drops the
plain message entirely and builds everything from pieces: text blocks, images,
dividers, boxes with a coloured edge, and your buttons. (Discord calls this
Components V2.)

```tsx
import {
    ActionRow,
    Button,
    Container,
    H2,
    renderMessage,
    Section,
    Separator,
    Subtext,
    TextDisplay,
    Thumbnail,
} from "@hyperion/jsx";

const message = renderMessage(
    <Container accent={0x5865f2}>
        <Section
            accessory={<Thumbnail url="https://example.com/profile.png" />}
        >
            <TextDisplay>
                <H2>Your profile</H2>
                You're all caught up.
                <Subtext>Check back later for new tasks.</Subtext>
            </TextDisplay>
        </Section>
        <Separator />
        <ActionRow>
            <Button customId="profile.refresh" style="primary">
                Refresh
            </Button>
        </ActionRow>
    </Container>,
    { ephemeral: true },
);
```

Send it with `await interaction.reply(message)`. `renderMessage()` returns the
components together with the flag Discord needs, so there's nothing to remember.
`{ ephemeral: true }` makes the reply private. Leave it out and the same result
also works with `update()` and `editReply()`.

## The pieces

- **`Container`**: a box around other pieces. `accent` colours its edge.
  Containers sit at the top level and don't nest.
- **`TextDisplay`**: a block of text, with the same
  [formatting as embeds](embeds.md#formatting-text).
- **`Section`**: one to three text displays with an `accessory` beside them,
  either a `Thumbnail` or a `Button`.
- **`MediaGallery`**: one to ten images or videos, as `MediaGallery.Item`
  children.
- **`Separator`**: space between pieces. It draws a divider line unless you pass
  `divider={false}`, and `spacing="large"` adds more room.
- **`ActionRow`**: your buttons and menus, at the top level or inside a container.

Put a piece in the wrong place (a `Thumbnail` outside a section, say) and
rendering throws a `JSXRenderError` that points right at it.

## Images

Give each gallery item a URL, plus a short description (alt text) for people who
can't see the image:

```tsx
import { MediaGallery, renderMessage } from "@hyperion/jsx";

const message = renderMessage(
    <MediaGallery>
        <MediaGallery.Item
            url="https://example.com/preview.png"
            description="Preview of the new profile card"
        />
    </MediaGallery>,
);
```

`Thumbnail` and `MediaGallery.Item` also take `spoiler`. To show a file you're
uploading yourself, use an `attachment://filename` URL and pass the file in the
reply's `files` option. The package doesn't upload it for you.

## Updating a layout message

A message that starts as a layout message stays one for good. To change it,
render the new version with `renderMessage()` and pass it to `update()` or
`editReply()`. Leave out `ephemeral`, since a sent message can't change who sees
it. And don't add `content` or `embeds`; put visible text in a `TextDisplay`
instead.

Keep the whole message to 40 components, counting everything nested inside.
Interactive custom IDs must be unique, as they are for any
[buttons and menus](message-components.md).

Next up: [modals](modals.md). The [layout reference](../../jsx-layout.md) lists
every prop and placement rule. Using Hyperion? See how
[buttons in layout messages reach your handlers](../jsx-with-hyperion.md#layout-messages).
