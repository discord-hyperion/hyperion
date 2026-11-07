# Select menus

Select menus work just like [buttons](buttons.md), with one extra option: which
kind of menu the handler answers. If you need a refresher on the kinds
themselves, see the discord.js guide on
[select menus](https://discordjs.guide/legacy/interactive-components/select-menus).

## A string menu

Put handlers in `src/select-menus`:

```ts
// src/select-menus/choose-colour.ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { defineSelectMenu } from "@hyperion/core";
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
    async run(ctx) {
        await ctx.interaction.update({
            content: `You chose ${ctx.interaction.values[0]}.`,
        });
    },
});
```

A select-menu handler takes the same options as a button handler, plus two:

| Option          | What it's for                                                                |
| --------------- | ---------------------------------------------------------------------------- |
| `componentType` | The kind of menu. Required.                                                  |
| `builder`       | The template. Its custom ID becomes the handler's.                           |
| `customId`      | The custom ID to answer, when there's no template.                           |
| `params`        | Data in the custom ID. See [data in custom IDs](custom-ids.md).              |
| `input`         | A schema for the picked values. See [checking the pick](#checking-the-pick). |
| `guards`        | Checks before `run()`. See [guards](guards.md).                              |
| `run`           | Runs on each click.                                                          |

All five kinds share one registry, so custom IDs must be unique across them.

## The other kinds

For a user, role, mentionable, or channel menu, set `componentType` to that
kind. It types `ctx.interaction` for the menu, so the picked users are right
there:

```ts fragment
export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    builder: new UserSelectMenuBuilder()
        .setCustomId("user.choose")
        .setPlaceholder("Choose a user"),
    async run(ctx) {
        const names = ctx.interaction.users.map(user => user.username);
        await ctx.interaction.update({
            content: `Selected: ${names.join(", ")}`,
        });
    },
});
```

## Sending a menu

`build()` copies the template, the same as for buttons:

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

## Checking the pick

Values come from the user's client, so an old message or a tampered request can
send something your menu never offered. Give the handler `input` to check them
first, the same way as [command input](input.md):

```ts fragment
const input = defineInput({
    // The schema gets the picked values, as strings.
    schema: v.pipe(v.array(v.picklist(["blue", "green"])), v.length(1)),
});

export default defineSelectMenu({
    customId: "colour.choose",
    componentType: ComponentType.StringSelect,
    input,
    async run(ctx) {
        const [issues, colours] = ctx.input;

        if (issues) {
            await ctx.interaction.reply({
                content: "That colour isn't on the list.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({ content: `You chose ${colours[0]}.` });
    },
});
```

For user, role, mentionable, and channel menus, the schema gets the picked IDs.

## Menus with data

A menu can carry data in its custom ID too, for example which ticket an
"Assign to…" menu belongs to. The data arrives in `ctx.params`, separately from
what the user picked. See [data in custom IDs](custom-ids.md).

## Guards

Guards work exactly as for [buttons](buttons.md#guards).
