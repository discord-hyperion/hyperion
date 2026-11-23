# Select menus

Select-menu handlers work like [button handlers](buttons.md), except they also require a `componentType` option identifying which kind of menu the handler accepts. Handlers in `src/select-menus/` match message select menus only; select menus inside a modal are handled by the [modal handler](modals.md). See the discord.js guide on [select menus](https://discordjs.guide/legacy/interactive-components/select-menus) for an overview of Discord's menu types.

## Defining a string select menu

Place select-menu handlers in `src/select-menus/`:

```ts
// src/select-menus/choose-colour.ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { defineSelectMenu } from "@hyperion-js/core";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.StringSelect,
    builder: new StringSelectMenuBuilder()
        .setCustomId("colour.choose")
        .setPlaceholder("Choose a colour")
        .addOptions(
            { label: "Blue", value: "blue" },
            { label: "Green", value: "green" },
        ),
    run: async ctx => {
        await ctx.interaction.update({
            content: `You chose ${ctx.interaction.values[0]}.`,
        });
    },
});
```

Select-menu handlers accept these options:

| Option          | Purpose                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `componentType` | Required menu type from `ComponentType`.                                                                    |
| `builder`       | Optional menu template. Its custom ID becomes the handler's custom ID.                                      |
| `customId`      | Fixed custom ID to match when you do not provide a template.                                                |
| `params`        | Typed parameter definition for dynamic custom IDs. See [Data in custom IDs](custom-ids.md).                 |
| `input`         | Optional schema to validate selected values. See [Validating selected values](#validating-selected-values). |
| `guards`        | Checks that run before `run()`. See [Guards](guards.md).                                                    |
| `run`           | Function executed when a user makes a selection.                                                            |

Set either `builder` or `customId`, never both. Dispatch matches both the custom ID and `componentType`, and all five select-menu types share `client.selectMenus`, so every select-menu handler must have a unique custom ID across all menu types.

## User, role, mentionable, and channel menus

Set `componentType` to match the menu type you want to handle, and Hyperion narrows `ctx.interaction` to that menu type:

| `ComponentType`                   | Builder                        | Value passed to `ctx.input`                 |
| --------------------------------- | ------------------------------ | ------------------------------------------- |
| `ComponentType.StringSelect`      | `StringSelectMenuBuilder`      | Selected option value strings               |
| `ComponentType.UserSelect`        | `UserSelectMenuBuilder`        | Selected user snowflake ID strings          |
| `ComponentType.RoleSelect`        | `RoleSelectMenuBuilder`        | Selected role snowflake ID strings          |
| `ComponentType.MentionableSelect` | `MentionableSelectMenuBuilder` | Selected user and role snowflake ID strings |
| `ComponentType.ChannelSelect`     | `ChannelSelectMenuBuilder`     | Selected channel snowflake ID strings       |

```ts fragment
export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    builder: new UserSelectMenuBuilder()
        .setCustomId("user.choose")
        .setPlaceholder("Choose a user"),
    run: async ctx => {
        const names = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ")}`,
        });
    },
});
```

## Sending a menu

Select-menu templates work the same way as [button templates](buttons.md#sending-the-button): call `ctx.client.selectMenus.build()` to get a fresh copy of the shared template:

```ts fragment
await ctx.interaction.reply({
    content: "Pick a colour.",
    components: [
        new ActionRowBuilder().addComponents(
            ctx.client.selectMenus.build("colour.choose"),
        ),
    ],
});
```

## Validating selected values

Selected values arrive from the user's Discord client, so an old message or modified request can submit values your menu no longer offers. Pass `input` with a schema to validate `ctx.interaction.values` before using them, just like [typed input](input.md):

```ts fragment
export default defineSelectMenu({
    customId: "colour.choose",
    componentType: ComponentType.StringSelect,
    input: {
        // The schema receives the selected values as an array of strings.
        schema: v.pipe(v.array(v.picklist(["blue", "green"])), v.length(1)),
    },
    run: async ctx => {
        const [issues, colours] = ctx.input;

        if (issues) {
            await ctx.interaction.reply({
                content: "That colour is not on the list.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({ content: `You chose ${colours[0]}.` });
    },
});
```

When a menu allows empty selections (`minValues` of `0`), clearing the menu passes `[]` to the schema. Set `defer: "update"` on `input` to call `deferUpdate()` automatically before validation (see [Responding and automatic deferring](how-hyperion-works.md#responding-and-automatic-deferring)). To map selected entity IDs into resolved discord.js objects without extra fetches, read `ctx.interaction.users`, `ctx.interaction.roles`, or `ctx.interaction.channels` inside [`input.resolve`](input.md#resolving-values).

## Carrying data in the custom ID

A select menu can carry data decided when sending the menu, such as a ticket ID for an "Assign to" menu, in its custom ID. Decoded values arrive in `ctx.params`, separate from the values the user selected. See [Data in custom IDs](custom-ids.md).

## Guards

Guards on select menus follow the same rules as on [buttons](buttons.md#guards): guards on the command that sent the menu do not protect later selections.
