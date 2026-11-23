# Buttons and menus

Group interactive buttons and select menus inside explicit `<ActionRow>` elements and render them into `@discordjs/builders` action rows with `renderComponents()`:

```tsx
import { ActionRow, Button, renderComponents } from "@hyperion-js/jsx";

const components = renderComponents(
    <ActionRow>
        <Button customId="profile.refresh" style="primary">
            Refresh
        </Button>
        <Button url="https://example.com/profile">Open profile</Button>
    </ActionRow>,
);
```

Send the rendered array with `interaction.reply({ components })`. Interactive buttons require `customId` and a `style` of `primary`, `secondary`, `success`, or `danger`; link buttons take `url` instead. `<Button>` takes its label as plain-text children (there is no `label` prop; omit children for an emoji-only button) and accepts optional `emoji` (a native Discord emoji object) and `disabled` props.

`renderComponents()` requires explicit `<ActionRow>` wrappers—it never auto-packs bare buttons. Passing an empty view returns `[]`, which is useful for clearing components on `update()`, and `renderComponents()` does not enforce Discord's five-row message cap.

## Select menus

Use `<StringSelect>` when users choose from static options. Unlike `<Button>`, `<StringSelect.Option>` takes `label` and `value` as props (along with optional `description`, `emoji`, and `default`) and accepts no children:

```tsx
import { ActionRow, renderComponents, StringSelect } from "@hyperion-js/jsx";

const components = renderComponents(
    <ActionRow>
        <StringSelect
            customId="todo.priority"
            placeholder="Choose priority"
            minValues={0}
            maxValues={1}
        >
            <StringSelect.Option label="Low" value="low" />
            <StringSelect.Option
                label="High"
                value="high"
                description="Needs attention"
            />
        </StringSelect>
    </ActionRow>,
);
```

A select menu fills an `<ActionRow>` by itself and cannot share a row with buttons or another select menu.

For Discord entity pickers, use the dedicated select component for that entity type:

| Component           | Selection type  | Pre-selection prop             |
| ------------------- | --------------- | ------------------------------ |
| `UserSelect`        | Users           | `defaultUsers`                 |
| `RoleSelect`        | Roles           | `defaultRoles`                 |
| `MentionableSelect` | Users and roles | `defaultUsers`, `defaultRoles` |
| `ChannelSelect`     | Channels        | `defaultChannels`              |

Entity select menus accept no option children. Pass arrays of Discord snowflake IDs to pre-select defaults:

```tsx fragment
import { ActionRow, ChannelSelect, renderComponents } from "@hyperion-js/jsx";
import { ChannelType } from "discord.js";

const components = renderComponents(
    <ActionRow>
        <ChannelSelect
            customId="report.channel"
            channelTypes={[ChannelType.GuildText]}
            defaultChannels={[interaction.channelId]}
        />
    </ActionRow>,
);
```

These same select components also work inside [JSX modals](modals.md).

## Single-control renderers

When you need a single builder—for manual `ActionRowBuilder` composition or a `@hyperion-js/core` handler template—use `renderButton()`, `renderStringSelect()`, `renderUserSelect()`, `renderRoleSelect()`, `renderMentionableSelect()`, or `renderChannelSelect()`. `renderButton()` accepts interactive buttons only, not link buttons.

## Rules and limits

- Every interactive `customId` must be unique within a single render, and option `value`s must be unique within a single `<StringSelect>`.
- Button and option labels accept plain text only.
- Setting `disabled` only changes Discord's UI state. Always verify permissions again when handling the interaction.
- Standard messages hold at most five action rows. To combine text blocks, images, and controls in one layout, see [Layout messages](layout-messages.md).

If you use `@hyperion-js/core`, handlers can store rendered buttons and menus as [templates](with-hyperion.md#buttons-and-menus-as-templates). For full prop lists, see the [JSX message components reference](../../jsx-message-components.md) and [JSX select menus reference](../../jsx-select-menus.md).
