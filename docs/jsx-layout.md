# JSX layout messages

`@hyperion/jsx` renders layout messages (Discord's "Components V2") through
`renderMessage()`. Terms follow the [glossary](GLOSSARY.md#components): a
**layout message** is built entirely from **layout components** and interactive
controls, with no `content` or `embeds`.

## API

```tsx
import {
    ActionRow,
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
} from "@hyperion/jsx";

await ctx.interaction.reply(
    renderMessage(
        <Container accent={0x5865f2}>
            <Section accessory={<Thumbnail url={avatarUrl} />}>
                <TextDisplay>
                    <H2>Ticket {ticketId}</H2>
                    {subject}
                    <Subtext>Opened by {username}</Subtext>
                </TextDisplay>
            </Section>
            <Separator />
            <ActionRow>
                <Button customId={closeTicket(ticket)} style="danger">
                    Close
                </Button>
            </ActionRow>
        </Container>,
        { ephemeral: true },
    ),
);
```

`renderMessage(view, options?)` returns `{ components, flags }`:
- `flags` is `["IsComponentsV2"]`, or `["IsComponentsV2", "Ephemeral"]` with
  `{ ephemeral: true }`. The package does not depend on discord.js, so flags use
  discord.js flag names rather than `MessageFlags` values.
- Without `ephemeral`, the result satisfies `InteractionReplyOptions`,
  `InteractionUpdateOptions`, and `InteractionEditReplyOptions`. With it, the
  result satisfies reply and follow-up options only; edit options reject
  `Ephemeral`, because visibility cannot change after sending.
- Every update to a layout message must resend the V2 flag; spreading the result
  does this. Discord does not allow removing the flag once a message is sent.
- Each call returns fresh native builders.

## Components

| Component           | Props                                               | Native builder            |
| ------------------- | --------------------------------------------------- | ------------------------- |
| `Container`         | `accent?: number`, `spoiler?: boolean`              | `ContainerBuilder`        |
| `Section`           | `accessory` (required), children                    | `SectionBuilder`          |
| `TextDisplay`       | text children                                       | `TextDisplayBuilder`      |
| `Thumbnail`         | `url`, `description?`, `spoiler?`                   | `ThumbnailBuilder`        |
| `MediaGallery`      | `MediaGallery.Item` children                        | `MediaGalleryBuilder`     |
| `MediaGallery.Item` | `url`, `description?`, `spoiler?`                   | `MediaGalleryItemBuilder` |
| `Separator`         | `divider?: boolean`, `spacing?: "small" \| "large"` | `SeparatorBuilder`        |

`ActionRow`, `Button`, and every select menu render at the top level or inside a
`Container`, as in [message components](jsx-message-components.md) and
[select menus](jsx-select-menus.md). `File` is not implemented: it requires uploaded
attachments, and Discord only shows attachments that a component references.
Media URLs may still be `attachment://name` references; uploading the file in
`files` remains the caller's responsibility.

## Structural rules

Checked at render time, throwing `JSXRenderError` with a structural path:
- Top level: `Container`, `Section`, `TextDisplay`, `MediaGallery`, `Separator`,
  `ActionRow`. Bare text must be wrapped in `TextDisplay`.
- `Container` appears only at the top level and never nests.
- `Section` has one to three `TextDisplay` children and exactly one `accessory`:
  a `Thumbnail` or a `Button` (interactive or link).
- `Thumbnail` appears only as a section accessory.
- `MediaGallery` has one to ten `MediaGallery.Item` children.
- `Button` and the select menus appear only inside an `ActionRow`, or a button as
  an accessory. `Modal.FileUpload` throws; it belongs in modals.
- At most 40 components, counting every nested component, row child, and
  accessory. Gallery items are not components and do not count.
- Interactive custom IDs are unique across the whole render, including
  accessories.
- An empty render is rejected.

Field values (URL format, description length, accent range) are left to native
`toJSON()` validation, which respects the global validator setting. Native
failures are wrapped in `JSXRenderError` with the component path and the
original `cause`.

## Headings and subtext

`H1`, `H2`, `H3`, and `Subtext` render Discord's `#`, `##`, `###`, and `-#`
line prefixes through `@discordjs/formatters`. They are allowed in
`TextDisplay`, `Modal.TextDisplay`, `Embed.Description`, and `Embed.Field`
values. Elsewhere, including field names, titles, and inside inline formatting
or links, they throw. Each occupies its own line: the renderer inserts line
breaks around them. Their content must fit on one line.

## Core error responses

A handler can defer, edit its reply into a layout message, then fail. The
generic error response first edits the deferred reply's `content`; when that
edit fails (a layout message cannot take content), it sends an ephemeral
follow-up and logs `<kind>.error-response.fallback` at debug level. See
[command registration](command-registration.md#command-execution).
