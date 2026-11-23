# Layout messages

Layout messages, known in Discord's API as Components V2, replace plain message `content` and `embeds` with composable blocks such as text displays, containers, media galleries, dividers, and interactive controls. Render them with `renderMessage()`:

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
} from "@hyperion-js/jsx";

const message = renderMessage(
    <Container accent={0x5865f2}>
        <Section
            accessory={<Thumbnail url="https://example.com/profile.png" />}
        >
            <TextDisplay>
                <H2>Your profile</H2>
                You are all caught up.
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

Send the result directly with `await interaction.reply(message)`. `renderMessage()` returns both `components` and the `MessageFlags.IsComponentsV2` flag Discord requires. Pass `{ ephemeral: true }` for an ephemeral reply, or omit options when passing the result to `update()` or `editReply()`.

## Components

- **`Container`.** Groups child components inside a box with an optional `accent` color bar. Containers belong at the top level and cannot nest inside another container.
- **`TextDisplay`.** Renders Markdown text using the same [formatting components as embeds](embeds.md#formatting-text).
- **`Section`.** Pairs one to three `TextDisplay` children with a side `accessory`, either a `Thumbnail` or a `Button`.
- **`MediaGallery`.** Displays one to ten images or videos via `MediaGallery.Item` children.
- **`Separator`.** Inserts vertical space and a divider line between blocks. Pass `divider={false}` to hide the line or `spacing="large"` for extra spacing.
- **`ActionRow`.** Holds buttons or a select menu, either at the top level or inside a `Container`.

Placing a component in an invalid parent, such as a `Thumbnail` outside a `Section`, throws a `JSXRenderError` pointing to the invalid element.

## Images and attachments

Give each `MediaGallery.Item` a `url` and a `description` for alt text:

```tsx
import { MediaGallery, renderMessage } from "@hyperion-js/jsx";

const message = renderMessage(
    <MediaGallery>
        <MediaGallery.Item
            url="https://example.com/preview.png"
            description="Preview of the new profile card"
        />
    </MediaGallery>,
);
```

Both `Thumbnail` and `MediaGallery.Item` accept a `spoiler` prop. To display an uploaded file, set `url` to `attachment://filename` and attach the file through the reply's `files` option. `@hyperion-js/jsx` does not upload files for you.

## Updating a layout message

Once a message is sent as a layout message, it stays a layout message on every subsequent edit. Render the updated view with `renderMessage()` and pass it to `update()` or `editReply()`. Do not pass `ephemeral` when editing, because Discord cannot change a sent message's visibility. Do not pass `content` or `embeds`; put visible text inside `TextDisplay` components instead.

A layout message can contain at most 40 components total, including nested children. Interactive custom IDs must be unique across the message, just like standard [buttons and menus](message-components.md).

Next, see [Modals](modals.md). For all props and placement rules, see the [JSX layout reference](../../jsx-layout.md). If you use `@hyperion-js/core`, see [Layout messages in JSX with Hyperion](../jsx-with-hyperion.md#layout-messages).
