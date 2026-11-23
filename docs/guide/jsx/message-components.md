# Buttons and menus

Group interactive buttons and select menus inside `<ActionRow>` elements and render them with `renderComponents()`:

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

Send the rendered array with `interaction.reply({ components })`. Interactive buttons require a `customId` and a `style` of `primary`, `secondary`, `success`, or `danger`. Link buttons take a `url` instead of a `customId` and `style`.

## Select menus

Use `<StringSelect>` when users pick from static options you define. Each `<StringSelect.Option>` has a visible `label` and a `value` sent back to your bot:

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

For Discord entity pickers, use the dedicated select component for that entity type:

| Component           | Selection type  | Pre-selection prop             |
| ------------------- | --------------- | ------------------------------ |
| `UserSelect`        | Users           | `defaultUsers`                 |
| `RoleSelect`        | Roles           | `defaultRoles`                 |
| `MentionableSelect` | Users and roles | `defaultUsers`, `defaultRoles` |
| `ChannelSelect`     | Channels        | `defaultChannels`              |

Entity select menus do not take option children. Pass arrays of Discord IDs to pre-select defaults:

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

## Rules and limits

- Every interactive custom ID must be unique within a single render, and option values must be unique within a single string select menu.
- Button and option labels accept plain text only.
- Setting `disabled` only changes the UI state in Discord. Always verify permissions again when handling the interaction.
- Standard messages hold at most five action rows. To combine text blocks, images, and controls in one layout, see [Layout messages](layout-messages.md).

If you use `@hyperion-js/core`, handlers can store rendered buttons and menus as [templates](../jsx-with-hyperion.md#buttons-and-menus-as-templates). For full prop lists, see the [JSX message components reference](../../jsx-message-components.md) and [JSX select menus reference](../../jsx-select-menus.md).
