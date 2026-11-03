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
            customId: "colour.choose",
            componentType: ComponentType.StringSelect,
            builder: new StringSelectMenuBuilder()
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

For user, role, mentionable, and channel menus, pass the kind as a generic too.
That types `ctx.interaction` correctly, so `.users`, `.roles`, or `.channels`
are right there:

```ts
export default class ChooseUser extends SelectMenuHandler<ComponentType.UserSelect> {
    constructor() {
        super({
            customId: "user.choose",
            componentType: ComponentType.UserSelect,
            builder: new UserSelectMenuBuilder().setPlaceholder(
                "Choose a user",
            ),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.UserSelect>) {
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

All five kinds share one registry, so custom IDs must be unique across them.

## Sending a menu

The registry keeps the handler's `builder` as a **template**. Call `build()` to
copy that template, set its custom ID, and put the menu in a row.

```ts
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

## Menus with data

A menu can carry data in its custom ID too, for example which ticket an
"Assign to…" menu belongs to. The data and the user's pick arrive separately:
`ctx.params` and `ctx.interaction.values`. See [data in custom IDs](custom-ids.md).

## Guards and responses

Guards and responses work exactly as for [buttons](buttons.md#guards-and-responses).
