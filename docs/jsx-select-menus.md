# JSX select menu design

`@hyperion/jsx` supports string selects through `StringSelect`,
`StringSelect.Option`, `renderStringSelect()`, and the existing row renderer, and
user, role, mentionable, and channel selects through `UserSelect`, `RoleSelect`,
`MentionableSelect`, and `ChannelSelect` ([entity selects](#entity-selects)). The
same components render in message action rows and in modal labels; see
[JSX modals](jsx-modals.md#modal-controls).

## Existing foundation

`@hyperion/jsx` provides explicit action rows and fresh native message controls
through `renderComponents()`. Native core select-menu handlers already support
string and entity selects, exact custom-ID/type routing, guards, and shared
builder definitions. See [message component authoring](jsx-message-components.md)
and [select menus](select-menus.md).

The proposed extension concerns authoring. Application-owned state,
authorization, acknowledgment, and interaction handling retain their existing
boundaries. Native builders own payload validation; JSX adds structural and uniqueness checks.

## Scope and vocabulary

- Initially support message string selects, including explicit options,
  single/multiple selection, placeholders, disabled state, and default selections.
- Entity selects and modal placement were added later; see
  [entity selects](#entity-selects) and [placement](#placement).
- Use `StringSelect` with namespaced `StringSelect.Option` children inside
  existing action rows. Option labels are explicit plain-string props.
- Preserve reusable synchronous authoring components, fragments, mapped options,
  and the existing runtime's conditional-child behavior.
- Extend authoring without changing routing, interaction handling, guards,
  application-owned state, or acknowledgment.

## Renderers and props

Add `renderStringSelect()` returning one fresh native `StringSelectMenuBuilder`,
suitable for the existing core string-select handler. Use `renderComponents()`
with an explicit action row when authoring a message.

`StringSelect` requires `customId` and accepts optional `placeholder`, `minValues`,
`maxValues`, `disabled`, and `required` (see [placement](#placement)). Supply options only through children; omit a parallel
options-data prop. Leave optional native fields omitted unless supplied, preserve
zero minimums and false disabled values, and omit numeric IDs.

`StringSelect.Option` requires plain-string `label` and `value`, with optional
plain-string `description`, native emoji data, and boolean `default`. It accepts
no children or formatting primitives. Skip omitted boolean setters, preserve
explicit false, and clone emoji data to keep returned builders independent.

## Uniqueness and validation

Extend custom-ID uniqueness checks across interactive buttons and selects in one
`renderComponents()` result. Report both structural paths without echoing IDs.
Separate renders may reuse IDs, and core registry namespaces remain unchanged.

Reject duplicate option values within one menu with both option paths, without
echoing the value. Different menus may reuse option values. This check remains
active when native validators are disabled.

Delegate native schema constraints to builders. Serialize standalone selects once
through `toJSON()` without an override; nested selects are validated through row
serialization. Native menus validate their option payloads, so do not separately
validate every option first. Respect global validation settings while retaining
JSX nesting, prop, and uniqueness checks independently.

Do not add stricter numeric/count/default consistency checks where the installed
native validators omit them. They currently validate explicit min/max ordering
and minimum-versus-option count, but do not enforce integer selection counts,
maximum-versus-option count, implicit-default consistency, or default-selection
count. Document these boundaries without claiming live Discord acceptance.

Keep explicit rows. Native row validation owns single-select cardinality and
button/select mixing constraints; do not automatically move controls into rows.
Complete-message limits remain caller-owned, as with existing button rendering.

## Structural and runtime contract

`renderStringSelect()` requires exactly one `StringSelect` after expansion.
`renderComponents()` accepts explicit rows containing buttons or any select menu;
string-select children expand to options only. Reject bare root selects/options,
nested menus, option text/children, unsupported controls (including
`Modal.FileUpload`), unknown props, numeric IDs, prebuilt builders, and promises. Empty `renderComponents()`
roots continue returning `[]`; empty selects fail native option-count validation
when enabled.

Reuse synchronous deferred evaluation, fragments, arrays, conditional omissions,
ignored keys, shallow readonly props, and recursion limits. Preserve option order
without automatic sorting. Return independently fresh menu/option builders and
clone application-owned emoji data without freezing application objects.

Wrap failures with `JSXRenderError`, structural locations, and original causes.
Generated messages do not echo supplied values; native causes may contain them.
Do not log automatically or truncate invalid content.

## Handler example

```tsx
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { StringSelect, renderStringSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

export default class extends SelectMenuHandler {
    constructor() {
        super({
            customId: "todo.priority",
            componentType: ComponentType.StringSelect,
            builder: renderStringSelect(
                <StringSelect
                    customId="todo.priority"
                    placeholder="Choose priority"
                >
                    <StringSelect.Option label="Low" value="low" />
                    <StringSelect.Option label="High" value="high" />
                </StringSelect>,
            ),
        });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `Selected: ${ctx.interaction.values.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

The default core generic remains string-select, with a native
`StringSelectMenuInteraction`. Option values are strings, not inferred literal
unions on the handler context. JSX does not add schema validation, automatic
registration, callbacks, or changes to guard and acknowledgment behavior.

## Message example

```tsx
import type { CommandContext } from "@hyperion/core";
import { ActionRow, StringSelect, renderComponents } from "@hyperion/jsx";

export const showPriority = async (
    ctx: CommandContext,
    currentPriority: string,
) => {
    const components = renderComponents(
        <ActionRow>
            <StringSelect
                customId="todo.priority"
                placeholder="Choose priority"
            >
                {["low", "high"].map(value => (
                    <StringSelect.Option
                        key={value}
                        label={value === "high" ? "High" : "Low"}
                        value={value}
                        default={value === currentPriority}
                    />
                ))}
            </StringSelect>
        </ActionRow>,
    );

    await ctx.interaction.reply({ content: "Choose a priority", components });
};
```

Render a fresh view for each message rather than mutating the shared handler
builder. Revalidate authorization and application state when processing a
selection. Defaults describe the displayed selection; they do not persist state.
Native collectors remain available; avoid having both a collector and a
registered handler acknowledge the same interaction.

For multiple selection, supply `minValues` and `maxValues` explicitly; a zero
minimum permits clearing a selection. The handler receives all selected string
values through the existing `interaction.values` array. Leaving optional fields
omitted retains native/API behavior instead of synthesizing JSX defaults.

## Verification and documentation

Add public type/negative-type contracts before implementation. Cover native
builder identity for core handlers, message reply/update types, and unchanged
string-select context typing. Use stable negative assertions that remain attached
to diagnostics after formatting.

Cover props/defaults including undefined, false, zero, empty strings, and malformed
nulls; literal labels/descriptions, emoji metadata validation, preserved
option order, nested reusable components, mapped/conditional options, repeated
renders, and independent emoji data. Cover duplicate values and cross-control
IDs, both error locations, and reuse across separate menus/renders.

Exercise native limits, empty menus, row cardinality/mixing, validator-disabled
behavior, structural errors, unknown props, and cause preservation. Preserve
existing button and modal rendering tests.

Extend standalone source/packed fixtures, production/development runtime smoke
tests, and core discovery/dispatch consumers. Keep JSX independent of core,
React, and a discord.js runtime dependency. Add a self-contained string-select example,
JSX minor changeset, guide/README examples for both renderers, and current backlog
updates. Document native validator gaps and unsupported scope explicitly.

Run required type/tests/Biome checks plus package-consumer verification without
private environment files, bot startup, login, deployment, or publication.

## Props, defaults, and native limits

- Menu: required plain-string `customId`; optional plain-string `placeholder`,
  numeric `minValues`/`maxValues`, boolean `disabled` and `required`, and
  structural children.
- Option: required plain-string `label`/`value`; optional plain-string
  `description`, native emoji object, and boolean `default`. No children.
- Optional props supplied as undefined are skipped. Native fields remain omitted;
  zero minimums, empty placeholders, and explicit false booleans survive.
- Empty labels/values/descriptions fail native validation when enabled; strings
  are never trimmed, escaped, or coerced. Malformed metadata types fail JSX's
  plain-string checks. Native boolean/count constraints respect global validation.

The installed builders require 1–25 options; label/value length is 1–100,
optional description length is 1–100, custom ID length is 1–100, and optional
placeholder length is at most 150 (including empty strings). Minimum values
range from 0–25 and maximum values from 1–25. Numeric IDs and raw option-data
props are outside this JSX API.

Native setters can retain emoji objects. Rendering clones emoji data and creates
new option builders, so later application mutations cannot change already
rendered output. Shared JSX descriptions may still reference application objects;
a later render reads their current values without freezing them.

## Entity selects

`UserSelect`, `RoleSelect`, `MentionableSelect`, and `ChannelSelect` render fresh
native `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`,
`MentionableSelectMenuBuilder`, and `ChannelSelectMenuBuilder`. They share the
`StringSelect` menu props and take no children; Discord supplies the choices.

| Component           | Extra props                       | Native setters                              |
| ------------------- | --------------------------------- | ------------------------------------------- |
| `UserSelect`        | `defaultUsers`                    | `setDefaultUsers()`                         |
| `RoleSelect`        | `defaultRoles`                    | `setDefaultRoles()`                         |
| `MentionableSelect` | `defaultUsers`, `defaultRoles`    | `addDefaultUsers()`, `addDefaultRoles()`    |
| `ChannelSelect`     | `defaultChannels`, `channelTypes` | `setDefaultChannels()`, `setChannelTypes()` |

Defaults are arrays of ID strings; anything else fails with a path ending in the
prop name. `channelTypes` takes native `ChannelType` values and is cloned. The
number of defaults must fall within `minValues`/`maxValues`, which native
validation checks. There is no standalone `render…Select()` for entity selects;
render them inside an `ActionRow` or a `Modal.Label`.

## Placement

Every select renders inside an `ActionRow` in a message (`renderComponents()` or
a layout message) and inside a `Modal.Label` in a modal (`renderModal()`).
Anywhere else in a layout message fails with "must be inside an ActionRow".
- `disabled` is message-only. Discord rejects disabled components in modals, so
  `renderModal()` rejects a `disabled` select with a path ending in `.disabled`.
- `required` is modal-only in effect (Discord's default there is `true`). Discord
  ignores it in messages, so message renderers pass it through rather than reject
  it.
- Custom IDs stay unique per render across every control kind.
