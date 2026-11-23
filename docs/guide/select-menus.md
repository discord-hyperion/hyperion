# Select menus

Select-menu handlers work like [button handlers](buttons.md), except they also require a `componentType` option to specify which kind of menu the handler accepts. See the discord.js guide on [select menus](https://discordjs.guide/legacy/interactive-components/select-menus) for an overview of Discord's menu types.

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

All five select-menu types share one registry, so every handler must have a unique custom ID across all menu types.

## User, role, mentionable, and channel menus

Set `componentType` to match the menu type you want to handle. Hyperion narrows `ctx.interaction` accordingly, giving you typed properties such as `ctx.interaction.users`:

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

Use `ctx.client.selectMenus.build()` to get a fresh copy of the handler's template:

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

Selected values come from the user's Discord client, so an old message or modified request can send values your menu does not currently offer. Pass `input` with a schema to validate `ctx.interaction.values` before your handler uses them, the same way as [typed input](input.md):

```ts fragment
const input = defineInput({
    // The schema receives the selected values as an array of strings.
    schema: v.pipe(v.array(v.picklist(["blue", "green"])), v.length(1)),
});

export default defineSelectMenu({
    customId: "colour.choose",
    componentType: ComponentType.StringSelect,
    input,
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

For user, role, mentionable, and channel menus, the schema receives the selected Discord IDs as strings.

## Carrying data in the custom ID

A select menu can carry data in its custom ID, such as the ticket ID for an "Assign to" menu. Decoded data arrives in `ctx.params`, separate from the values the user selected. See [Data in custom IDs](custom-ids.md).

## Guards

Guards on select menus work the same way as on [buttons](buttons.md#guards).
