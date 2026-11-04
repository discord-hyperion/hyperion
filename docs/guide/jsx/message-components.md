# Buttons and menus

Buttons and select menus are what make a message do something. Put them in an
`ActionRow`, then render the rows:

```tsx
import { ActionRow, Button, renderComponents } from "@hyperion/jsx";

const components = renderComponents(
    <ActionRow>
        <Button customId="profile.refresh" style="primary">
            Refresh
        </Button>
        <Button url="https://example.com/profile">Open profile</Button>
    </ActionRow>,
);
```

Send them with `await interaction.reply({ content: "Your profile", components })`.
A button either has a `customId` and a style (`primary`, `secondary`, `success`,
or `danger`), or it's a link with a `url`.

The custom ID is how your bot recognises the click later. Match on it in your
`interactionCreate` listener, or use a discord.js collector.

## Select menus

A string select menu lets people pick from choices you supply. Each option has a
label to show and a value your bot receives:

```tsx
import { ActionRow, renderComponents, StringSelect } from "@hyperion/jsx";

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

The picks arrive in `interaction.values`. With `minValues={0}`, people can also
clear their choice. A menu fills a whole row, so give it one to itself. User,
role, mentionable, and channel menus don't have JSX components yet; use the
native builders for those.

## Before you send

- Interactive custom IDs must be unique within one render, and option values
  unique within one menu.
- Labels are plain text.
- `disabled` only changes how a control looks. Check permissions again when you
  handle the click.
- A classic message holds up to five rows. For more room, with text and images
  alongside your controls, see [layout messages](layout-messages.md).

Using Hyperion? Handlers can keep these controls as
[templates](../jsx-with-hyperion.md#buttons-and-menus-as-templates). The
references cover [buttons](../../jsx-message-components.md) and
[string selects](../../jsx-select-menus.md) in full.
