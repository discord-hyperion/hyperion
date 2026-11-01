# JSX message component design

`@hyperion/jsx` supports native action-row and button authoring through
`ActionRow`, `Button`, `renderComponents()`, and `renderButton()`.

## Existing foundation

The independent `@hyperion/jsx` package renders embeds and modals to native
builders. It provides synchronous reusable components, fragments, conditional
children, fresh output, structural errors, and native validation. See
[JSX authoring](jsx.md).

Core button handlers retain shared native builders, exact custom-ID routing,
guards, and invocation-local contexts. Application-owned persistent state and
authorization remain separate from form or message rendering. See
[buttons](buttons.md).

Managed collectors and the local verification helper were declined. This design
does not revive either feature or the deferred custom-ID data feature.

## Scope

- Initially support action rows, interactive buttons, and link buttons.
- Defer select menus, premium purchase buttons, and Components V2 layouts.
- Produce native builders without changing handler builders, routing, guards,
  acknowledgment, or native collectors. Do not add click callbacks or automatic
  registration.
- Per-user disabled state is presentation. Application handlers remain
  responsible for checking current authorization.

## Rendering API

`renderComponents()` accepts explicit action rows and returns fresh native
`ActionRowBuilder[]`. Fragments, arrays, reusable synchronous components, and
conditional children compose rows without automatically packing bare buttons.
An empty root returns `[]`, permitting callers to clear message controls.

`renderButton()` accepts exactly one interactive button and returns a native
custom-ID button builder suitable for a core button handler. Link buttons are
supported within `renderComponents()` but rejected by `renderButton()` because
they cannot define interaction handlers.

Labels use plain-text children, including literal interpolation, fragments, and
reusable components. Preserve text without Markdown escaping. Reject formatting
primitives such as `Bold`, and omit a separate `label` prop. Emoji-only buttons
may omit label children.

Interactive buttons require an explicit `customId` and style. Accept `primary`,
`secondary`, `success`, and `danger` plus their native enum values. Link buttons
are selected by a `url` prop and do not accept custom IDs or interactive styles.
Reject conflicting variant props rather than silently ignoring them.

Accept the native emoji object (`name`, `id`, `animated`) and delegate emoji
validation to builders. Do not add an emoji-string parser.

Reject duplicate interactive custom IDs across all rows within one
`renderComponents()` call, identifying both structural paths without echoing
supplied values. Separate renders may reuse IDs. Do not generate IDs or impose
global uniqueness.

## Validation and composition

Validate each row through native `toJSON()` without an override. Let row
serialization validate its buttons, avoiding a separate validation pass for each
nested button. Validate standalone `renderButton()` output once. Respect the
native global validator setting. JSX structure, variant suitability, unknown
props, and duplicate-ID checks remain active when native validation is disabled.

Whole-message constraints belong to the caller. Document the five-row limit for
legacy messages; this renderer does not validate a complete message or controls
appended afterward. Do not silently truncate or repack rows.

Omit numeric component `id` props. Keep routing custom IDs explicit. Both variants
accept optional boolean `disabled`; skip its setter for omitted/undefined values,
preserve explicit false, and let native validation reject malformed values.

Accept only action rows at the message-render root and buttons within each row.
Reject bare buttons, nested rows, text outside buttons, unsupported controls,
prebuilt builders, and promises. Continue supporting fragments, synchronous
reusable components, arrays, conditional omissions, ignored keys, and the existing
nesting limit. Labels concatenate their expanded plain-text children without
automatic separators; zero remains text, while nullish/boolean children are
omitted. Omitted label children permit emoji-only buttons; native builders own
label/emoji presence and length constraints.

Keep output independently fresh on repeated renders, including nested builders.
Wrap failures in `JSXRenderError` with structural paths and original causes;
generated messages do not echo supplied values, and native causes remain
inspectable. Do not log automatically. Returned builders can be composed through
native APIs after rendering; that subsequent composition is caller-owned.

## Handler authoring example

The single-button renderer supplies the builder required by core:

```tsx
import { Button as ButtonHandler, type ButtonContext } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default class extends ButtonHandler {
    constructor() {
        super({
            builder: renderButton(
                <Button customId="profile.refresh" style="primary">
                    Refresh profile
                </Button>,
            ),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.reply({ content: "Refresh requested." });
    }
}
```

The JSX `Button` describes a visible control; core's `Button` describes its click
handler. Alias the handler import when both are used. Discovery and guards stay
unchanged. Do not store per-user values on the shared handler or mutate its
registered builder for individual messages.

## Message authoring example

```tsx
import type { CommandContext } from "@hyperion/core";
import { ActionRow, Button, renderComponents } from "@hyperion/jsx";

export const showProfileControls = async (
    ctx: CommandContext,
    refreshDisabled: boolean,
) => {
    const components = renderComponents(
        <>
            <ActionRow>
                <Button
                    customId="profile.refresh"
                    style="primary"
                    disabled={refreshDisabled}
                >
                    Refresh profile
                </Button>
            </ActionRow>
            <ActionRow>
                <Button url="https://example.com/profile">Open profile</Button>
            </ActionRow>
        </>,
    );

    await ctx.interaction.reply({ content: "Profile controls", components });
};
```

The interactive button targets the handler above by exact custom ID. The link
button navigates without invoking a handler. Applications may instead use native
collectors; avoid processing the same interaction in both a handler and a
collector. Recheck authorization when processing clicks, even if a button was
disabled according to a status read when rendering.

## Verification scope

Cover all four interactive variants, links, string/native styles, literal labels,
emoji-only buttons, omitted/false/null disabled values, conflicting props, native
validation failures, and validator-disabled structural checks. Verify duplicate
IDs across rows, both reported paths, separate-render reuse, empty roots,
composition/nesting errors, and fresh independent output.

Test public authoring types and negative cases before implementation, including
the custom-ID builder return type accepted by core handlers. JSX elements erase
some source prop detail, so structural/variant restrictions also need runtime
tests. Preserve standalone operation without core, React, or a discord.js runtime
dependency. Verify source/packed consumers, automatic runtime entry points,
native builder identity, and reply/update type compatibility.

Update the JSX guide's deferred scope, backlog, and standalone package examples.
Add a JSX minor changeset and a dev-bot flow using existing exact-ID routing.
Run required type/tests/Biome checks and package-consumer verification without
startup, private credentials, login, deployment, or publishing.

## Documentation requirements

Document both renderers with imports and complete usage examples: a registered
core handler authored through `renderButton()`, a multi-row message authored
through `renderComponents()`, and link buttons that do not dispatch interactions.
Explain the distinction between authoring components and core handlers, required
builder types, fresh per-message state, native collector compatibility, and
application-owned authorization. State empty-root behavior, plain labels, and
unsupported nesting/controls explicitly.

## Verified implementation constraints

The installed builders provide concrete interactive button variants and a link
variant. Omitted disabled props must skip the native setter, because calling
`setDisabled(undefined)` sets true. Native rows validate button counts and child
schemas but do not reject duplicate button custom IDs. Native message reply and
update types accept arrays of action-row builders.

## Props and defaults

- `ActionRow` accepts structural children only; each expanded child must be a button.
- Interactive `Button` requires `customId` and `style`. There is no default style.
- Link `Button` requires `url`, with neither `style` nor `customId`. Native URL
  validation supports HTTP, HTTPS, and Discord URLs; masked-link text formatting
  has a separate HTTP(S)-only policy.
- Both variants accept label children, native emoji data, and optional `disabled`.
  Omitted or undefined disabled props leave the native field omitted. Explicit
  false stays false. Empty composed labels omit the label field, permitting
  emoji-only buttons; a button with neither label nor emoji fails native validation.
- There is no `label`, numeric `id`, SKU, or click-callback prop.

The installed builders enforce labels of 1–80 characters, interactive custom IDs
of 1–100 characters, and 1–5 buttons per row. JSX does not reproduce these schemas.
Native disabled validation also rejects explicit null when enabled. Errors include
structural paths; native validation causes may contain supplied values.

## Development bot

`/jsx-buttons` sends a two-row example containing an interactive button and a link.
Its optional `disabled` boolean demonstrates fresh per-message presentation. The
`jsx.refresh` handler is authored with `renderButton()` and updates the message
through existing button dispatch. It stores no per-user state and introduces no
collector or authorization shortcut.
