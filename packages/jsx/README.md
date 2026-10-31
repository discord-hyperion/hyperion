# @hyperion/jsx

Synchronous JSX authoring for Discord embeds and modals, without React or a dependency on
`@hyperion/core`. Returns fresh native `EmbedBuilder` or `ModalBuilder` instances
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
registered builder with user-specific values.

No standalone text rendering, additional modal controls, React lifecycle,
automatic updates, or insertion of existing builders is provided.
Validate your complete response separately: Discord's aggregate embed limits apply
across the entire message. Native causes can include supplied values; treat them
appropriately when logging errors.

Run `pnpm --filter @hyperion/jsx benchmark` for the equivalent-output native-builder
comparison. Measurements describe local overhead, not a speed guarantee.
