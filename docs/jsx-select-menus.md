# JSX select menus

`StringSelect` (with `StringSelect.Option` children), `UserSelect`, `RoleSelect`,
`MentionableSelect`, and `ChannelSelect` describe select menus. They render inside
a message `ActionRow` through `renderComponents()` or a layout message, and inside
a `Modal.Label` through `renderModal()`; see [placement](#placement).
`renderStringSelect()`, `renderUserSelect()`, `renderRoleSelect()`,
`renderMentionableSelect()`, and `renderChannelSelect()` each render one select as
a core handler template.
Shared runtime behaviour is in [JSX authoring](jsx.md#runtime-behaviour).

## Shared menu props

Every select takes:
- `customId` (required plain string);
- `placeholder` (plain string), `minValues`, and `maxValues`;
- `disabled` (messages only) and `required` (modals; see [placement](#placement)).

Omitted or `undefined` props leave the native field out. Zero minimums, empty
placeholders, and explicit `false` are kept. Strings are never trimmed, escaped,
or coerced; non-string metadata throws. There is no numeric `id` prop.

For multiple selection, set `minValues` and `maxValues` explicitly; a zero minimum
lets people clear their choice. Handlers receive picks in `interaction.values`.

## String selects

`StringSelect` takes its options only as `StringSelect.Option` children (no
options-data prop). Children expand through fragments, arrays, reusable components,
and conditionals, and keep their order.

`StringSelect.Option` requires plain-string `label` and `value` and takes an
optional plain-string `description`, native `emoji` object, and boolean `default`.
It takes no children or formatting components. Emoji data is cloned, so later
changes to application objects don't reach rendered output.

Option values must be unique within one menu; a duplicate throws with both option
paths, without the value. Different menus may reuse values.

Native limits: 1–25 options; label, value, description, and custom ID 1–100
characters; placeholder at most 150; minimum values 0–25 and maximum 1–25. Native
validation checks min/max ordering and minimum-versus-option count. It does not
check integer counts, maximum-versus-option count, or how many options are
`default`; JSX adds no stricter checks. An empty select fails native option-count
validation when validators are enabled.

## Entity selects

`UserSelect`, `RoleSelect`, `MentionableSelect`, and `ChannelSelect` render fresh
native `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`,
`MentionableSelectMenuBuilder`, and `ChannelSelectMenuBuilder`. Discord supplies
their choices, so they take no children.

| Component           | Extra props                       | Native setters                              |
| ------------------- | --------------------------------- | ------------------------------------------- |
| `UserSelect`        | `defaultUsers`                    | `setDefaultUsers()`                         |
| `RoleSelect`        | `defaultRoles`                    | `setDefaultRoles()`                         |
| `MentionableSelect` | `defaultUsers`, `defaultRoles`    | `addDefaultUsers()`, `addDefaultRoles()`    |
| `ChannelSelect`     | `defaultChannels`, `channelTypes` | `setDefaultChannels()`, `setChannelTypes()` |

Defaults are arrays of ID strings; anything else throws with a path ending in the
prop name. `channelTypes` takes native `ChannelType` values and is cloned. The
number of defaults isn't checked against `minValues`/`maxValues`; native
validation doesn't check it either, so keep them consistent.

## Placement

- **Messages:** a select sits alone in an `ActionRow`. Anywhere else in a layout
  message throws "must be inside an ActionRow".
- **Modals:** a select is the one control inside a `Modal.Label`; see
  [modal controls](jsx-modals.md#modal-controls).
- `disabled` is message-only. Discord rejects disabled components in modals, so
  `renderModal()` throws on a `disabled` select with a path ending in `.disabled`.
- `required` applies in modals, where Discord's default is `true`. Discord ignores
  it in messages, so message renderers pass it through.
- Custom IDs are unique per render across every control kind.

## Rendering and validation

Each standalone renderer requires exactly one select of its own kind after
expansion, renders it for a message, and validates it once with `toJSON()`. Any
other root, including a different select kind, throws at `root` with "Expected
exactly one UserSelect." (naming the renderer's kind). Each returns its own
builder: `StringSelectMenuBuilder`, `UserSelectMenuBuilder`,
`RoleSelectMenuBuilder`, `MentionableSelectMenuBuilder`, or
`ChannelSelectMenuBuilder`, which must match the handler's `componentType`. Inside rows, the row's validation covers its
select. Bare selects or options at the root, nested menus, option text, unknown
props, prebuilt builders, and promises throw. Duplicate option values and IDs are
checked even when native validators are disabled.

## Handler template

```tsx
import { defineSelectMenu } from "@hyperion/core";
import { StringSelect, renderStringSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.StringSelect,
    builder: renderStringSelect(
        <StringSelect customId="todo.priority" placeholder="Choose priority">
            <StringSelect.Option label="Low" value="low" />
            <StringSelect.Option label="High" value="high" />
        </StringSelect>,
    ),
    run: async ctx => {
        await ctx.interaction.update({
            content: `Selected: ${ctx.interaction.values.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
```

The handler context is the native `StringSelectMenuInteraction`; option values
are strings, not inferred literal unions. To validate them, add core
[select-menu input](select-menus.md#validate-the-selection).

Entity selects work the same way with their own renderer and `componentType`:

```tsx
import { defineSelectMenu } from "@hyperion/core";
import { UserSelect, renderUserSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    builder: renderUserSelect(
        <UserSelect customId="user.choose" maxValues={1} />,
    ),
    run: async ctx => {
        const names = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
```

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

Render a fresh view per message instead of changing the shared handler template.
`default` only describes what's shown; it stores nothing. Check authorization and
application state again when the selection arrives.
