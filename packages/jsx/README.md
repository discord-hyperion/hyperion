# @hyperion/jsx

Synchronous JSX authoring for Discord embeds, modals, and message controls, without React or a dependency on
`@hyperion/core`. Returns fresh native embed, modal, button, or action-row builders
from the pinned compatible `@discordjs/builders` peer.

```tsx
import { Bold, Embed, renderEmbed } from "@hyperion/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready for review</Bold>
        </Embed.Description>
    </Embed>,
);
```

Use `jsx: "react-jsx"` and `jsxImportSource: "@hyperion/jsx"` in your TypeScript
configuration. The option name does not require React. Compile for plain Node or
run TypeScript through a JSX-aware runner such as `tsx`.

Text in descriptions and fields is escaped by default; explicit formatting
components use the pinned `@discordjs/formatters` helpers after JSX-specific
validation. Italic uses `_text_`. Literal escaping remains composition-aware so
separate JSX children cannot accidentally assemble Markdown. Titles, author names, and footer text remain plain.
`Raw` inserts intentional unescaped Markdown. Mention components do not configure
`allowedMentions`; the caller owns that response setting.

Reusable function components are synchronous and evaluated on every render.
Fragments, arrays, conditionals, and numeric zero are supported. Rendering checks
nesting and props, and calls native `toJSON()` without overriding global validator
settings. Invalid content throws `JSXRenderError`, with structural context and an
original cause when available. It does not log automatically.

`Modal` and `renderModal()` also support labels, text inputs, and informational
text displays. Input style defaults to short (`"paragraph"` and native style enum
values are supported); inputs default to required. Custom IDs are explicit and
duplicate input IDs within a form are rejected. Each render creates a fresh native
`ModalBuilder`, suitable for personalized values without mutating shared handler
definitions. Submission parsing and routing stay application-owned.

```tsx
import { Modal, renderModal } from "@hyperion/jsx";

const form = renderModal(
    <Modal customId="todo.create" title="Create todo">
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" maxLength={100} />
        </Modal.Label>
    </Modal>,
);
```

Supply `form` to `interaction.showModal()`. The caller owns acknowledgment and
submission handling. Use a fresh render for per-user initial values and preserve
the registered handler's custom ID when using core. Never mutate a shared
registered template with user-specific values.

No standalone text rendering, additional modal controls, React lifecycle,
automatic updates, or insertion of existing builders is provided.
Validate your complete response separately: Discord's aggregate embed limits apply
across the entire message. Native causes can include supplied values; treat them
appropriately when logging errors.

Run `pnpm --filter @hyperion/jsx benchmark` for the equivalent-output native-builder
comparison. Measurements describe local overhead, not a speed guarantee.

## Message buttons

```tsx
import {
    ActionRow,
    Button,
    renderButton,
    renderComponents,
} from "@hyperion/jsx";

// A native custom-ID builder, suitable as a core ButtonHandler template.
const handlerBuilder = renderButton(
    <Button customId="profile.refresh" style="primary">
        Refresh
    </Button>,
);

// Native rows, suitable for interaction reply/update components.
const components = renderComponents(
    <ActionRow>
        <Button
            customId="profile.refresh"
            style="primary"
            emoji={{ name: "🔄" }}
        >
            Refresh
        </Button>
        <Button url="https://example.com/profile">Open profile</Button>
    </ActionRow>,
);
```

Interactive buttons require an explicit custom ID and style (`primary`,
`secondary`, `success`, `danger`, or corresponding native enum values). Link
buttons use `url` instead of style/custom ID. Both support native emoji objects,
plain label children, and optional `disabled`. Omitted disabled stays omitted;
false is preserved. Labels are literal, with no Markdown escaping or formatting
components. Numeric IDs, premium buttons, entity selects, and existing builder children
are unsupported.

`renderComponents()` requires explicit rows and returns an empty array for an
empty root. Duplicate interactive IDs are rejected across one rendered set of
rows; separate renders may reuse IDs. `renderButton()` accepts one interactive
button and rejects links. Each render creates independent builders. Native row
validation respects the global validator setting; JSX structure and duplicate
checks remain active. Validate whole-message constraints separately, including
the five-row limit for legacy messages.

Rendering adds no handlers, collectors, state, or authorization. Core handlers
continue routing by exact ID. Clone or freshly render per-user views, and check
current authorization when handling clicks. See the
[complete message component guide](https://github.com/favylicious/discord-hyperion/blob/main/docs/jsx-message-components.md)
for handler and message examples, limits, and the `/jsx-buttons` development demo.

## Message string selects

```tsx
import {
    ActionRow,
    StringSelect,
    renderComponents,
    renderStringSelect,
} from "@hyperion/jsx";

const Priority = () => (
    <StringSelect
        customId="todo.priority"
        placeholder="Choose priority"
        minValues={0}
        maxValues={1}
    >
        <StringSelect.Option label="Low" value="low" default={false} />
        <StringSelect.Option
            label="High"
            value="high"
            description="Needs attention"
        />
    </StringSelect>
);

// Native StringSelectMenuBuilder for a core string-select handler.
const handlerBuilder = renderStringSelect(<Priority />);
// Native action rows for reply/update payloads.
const components = renderComponents(
    <ActionRow>
        <Priority />
    </ActionRow>,
);
```

Options require plain-string labels and values; description, native emoji data,
and boolean `default` are optional. Menus require custom IDs and optionally accept
placeholder, min/max values, and disabled state. Omitted/undefined props retain
native omissions; false booleans, zero minimums, and empty placeholders survive.
Option children, formatting primitives, raw options arrays, numeric IDs, and
modal-only `required` are unsupported.

Duplicate option values are rejected within one menu. Interactive IDs must be
unique across both buttons and selects within one `renderComponents()` call.
Separate renders may reuse IDs. Native row validation requires a select to occupy
its own row. Native validation owns payload/count limits and respects its global
setting; JSX structural and uniqueness checks remain active independently.

The pinned native validator does not enforce integer counts, maximum-versus-option
count, implicit-default consistency, or default-selection count. JSX adds no
stricter replacement schema. Defaults describe presentation, not persisted state;
handlers still receive string values and must check current authorization.

See the [complete JSX select guide](https://github.com/favylicious/discord-hyperion/blob/main/docs/jsx-select-menus.md)
for native limits, handler/message examples, and the `/jsx-select` demo. Entity
selects and modal select authoring remain deferred.

## Layout messages

`renderMessage()` builds layout messages (Discord's Components V2) from
`Container`, `Section`, `TextDisplay`, `Thumbnail`, `MediaGallery`, `Separator`,
and the existing message controls. It returns `{ components, flags }` with the
V2 flag set; pass `{ ephemeral: true }` for a private reply.

```tsx
import {
    Container,
    H2,
    renderMessage,
    Section,
    TextDisplay,
    Thumbnail,
} from "@hyperion/jsx";

await interaction.reply(
    renderMessage(
        <Container accent={0x5865f2}>
            <Section accessory={<Thumbnail url={avatarUrl} />}>
                <TextDisplay>
                    <H2>Profile</H2>
                    {username}
                </TextDisplay>
            </Section>
        </Container>,
    ),
);
```

Placement rules (thumbnails only as section accessories, one to three text
displays per section, at most 40 components) are checked at render time.
`H1`–`H3` and `Subtext` also work in embed descriptions and field values. See
the [layout message reference](https://github.com/favylicious/discord-hyperion/blob/main/docs/jsx-layout.md).
