# Layout messages

Layout messages (known in Discord's API as Components V2) replace plain message `content` and `embeds` with composable blocks such as text displays, containers, media galleries, dividers, and interactive controls. Render them with `renderMessage()`:

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

Send the result directly with `await interaction.reply(message)`. `renderMessage()` returns `{ components, flags }`, where `flags` is the discord.js flag-name array `["IsComponentsV2"]`—or `["IsComponentsV2", "Ephemeral"]` when you pass `{ ephemeral: true }`—rather than a `MessageFlags` bitfield. To combine extra flags or file attachments, spread `message` into your reply options (such as `{ ...message, flags: [...message.flags, "SuppressNotifications"] }` or `{ ...message, files: [attachment] }`).

## Components

| Component      | Props                                                                       | Placement and children                                                                               |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Container`    | Optional `accent`, `spoiler`                                                | Top-level only (cannot nest inside another `Container`); groups child blocks inside an accented box. |
| `TextDisplay`  | —                                                                           | Rich Markdown text using the same [formatting components as embeds](embeds.md#formatting-text).      |
| `Section`      | Required `accessory` (`Thumbnail` or interactive/link `Button`)             | Pairs 1–3 `TextDisplay` children with a side accessory.                                              |
| `MediaGallery` | —                                                                           | Displays 1–10 images or videos via `MediaGallery.Item` children.                                     |
| `Separator`    | Optional `divider` (`false` hides line), `spacing` (`"small"` or `"large"`) | Inserts vertical space and an optional divider between blocks.                                       |
| `ActionRow`    | —                                                                           | Holds buttons or a select menu, at the top level or inside a `Container`.                            |

Placing a component in an invalid parent (such as a `Thumbnail` outside a `Section`) or rendering an empty layout message throws `JSXRenderError`. Discord's `File` layout component is not implemented yet.

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

`Container`, `Thumbnail`, and `MediaGallery.Item` all accept a `spoiler` prop. To display an uploaded file, set `url` to `attachment://filename` and spread `message` with `files`—`@hyperion-js/jsx` does not upload files itself:

```ts fragment
await interaction.reply({ ...message, files: [attachment] });
```

## Updating a layout message

Once a message is sent as a layout message, it stays a layout message on every subsequent edit—you cannot convert an existing plain or embed message into a layout message or remove the layout flag once sent. Render the updated view with `renderMessage()` without `{ ephemeral: true }` (TypeScript rejects passing an ephemeral layout message to `update()` or `editReply()`), and never pass `content` or `embeds`.

A layout message can contain at most 40 components total, including nested children (`MediaGallery.Item` entries do not count toward this limit). Interactive `customId`s must be unique across the message, just like standard [buttons and menus](message-components.md).

Next, see [Modals](modals.md). For all props and placement rules, see the [JSX layout reference](../../jsx-layout.md). If you use `@hyperion-js/core`, see [Layout messages in JSX with Hyperion](with-hyperion.md#layout-messages).
