# Select menus

Select menus work just like [buttons](buttons.md), with one extra thing to
declare: which kind of menu it is. Discord has five kinds: string (your own
options), user, role, mentionable (users and roles), and channel.

## A string menu

Put handlers in `src/select-menus`:

```ts
// src/select-menus/choose-colour.ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default class ChooseColour extends SelectMenuHandler {
    constructor() {
        super({
            componentType: ComponentType.StringSelect,
            builder: new StringSelectMenuBuilder()
                .setCustomId("colour.choose")
                .setPlaceholder("Choose a colour")
                .addOptions(
                    { label: "Blue", value: "blue" },
                    { label: "Green", value: "green" },
                ),
        });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `You chose ${ctx.interaction.values[0]}.`,
        });
    }
}
```

`ctx.interaction.values` holds whatever the user picked, as strings.

## The other kinds

For user, role, mentionable, and channel menus, also put the kind in the type
argument. That types `ctx.interaction` correctly, so `.users`, `.roles`, or
`.channels` are right there:

```ts fragment
type ChooseUserSpec = { componentType: ComponentType.UserSelect };

export default class ChooseUser extends SelectMenuHandler<ChooseUserSpec> {
    constructor() {
        super({
            componentType: ComponentType.UserSelect,
            builder: new UserSelectMenuBuilder()
                .setCustomId("user.choose")
                .setPlaceholder("Choose a user"),
        });
    }

    async run(ctx: SelectMenuContext<ChooseUserSpec>) {
        const names = ctx.interaction.users.map(user => user.username);
        await ctx.interaction.update({
            content: `Selected: ${names.join(", ")}`,
        });
    }
}
```

Discord fills in the options for these kinds, so don't call `addOptions()`.
A few things worth knowing:
- Member and role data depends on the server and cache, so check
  `inCachedGuild()` before relying on cached-only methods.
- Picking a role or channel just gives you data; it doesn't assign or change anything.
- With `setMinValues(0)`, users can clear their selection and you'll get an empty list.

All five kinds share one registry, so custom IDs must be unique across them. A
handler with a template takes the template's custom ID, so don't pass `customId`
as well.

## Sending a menu

The registry keeps the handler's `builder` as a **template**. Call `build()` to
copy that template, set its custom ID, and put the menu in a row.

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

A menu takes up a whole row on its own.

## Checking the pick

Values come from the user's client, so an old message or a tampered request can
send something your menu never offered. Add `input` to check them first, the same
way as [command input](input.md):

```ts fragment
const input = defineInput({
    schema: v.pipe(v.array(v.picklist(["blue", "green"])), v.length(1)),
});

type ChooseColourSpec = { input: typeof input };

export default class ChooseColour extends SelectMenuHandler<ChooseColourSpec> {
    constructor() {
        super({
            customId: "colour.choose",
            componentType: ComponentType.StringSelect,
            input,
        });
    }

    async run(ctx: SelectMenuContext<ChooseColourSpec>) {
        const [issues, colours] = ctx.input;

        if (issues) {
            await ctx.interaction.reply({
                content: "That colour isn't on the list.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({ content: `You chose ${colours[0]}.` });
    }
}
```

The schema gets the picked values as a list of strings. For user, role,
mentionable, and channel menus that's the selected IDs. Add
`defer: "update"` to acknowledge before slow work and finish with
`editReply()`.

## Menus with data

A menu can carry data in its custom ID too, for example which ticket an
"Assign to…" menu belongs to. The data and the user's pick arrive separately:
`ctx.params` and `ctx.interaction.values`. See [data in custom IDs](custom-ids.md).

## Guards and responses

Guards and responses work exactly as for [buttons](buttons.md#guards-and-responses).
