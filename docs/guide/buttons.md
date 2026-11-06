# Buttons

A button handler runs when someone clicks a button your bot sent. Handlers
don't remember anything between clicks, so if a button needs data (like which
ticket it closes), put it in the [custom ID](custom-ids.md) or your own storage.

## A button handler

Put handlers in `src/buttons`:

```ts
// src/buttons/refresh-profile.ts
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { type ButtonContext, ButtonHandler } from "@hyperion/core";

export default class RefreshProfile extends ButtonHandler {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder()
                .setCustomId("profile.refresh")
                .setLabel("Refresh profile"),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.update({ content: "Refreshed!" });
    }
}
```

The builder is the handler's **template**: the button your commands send copies
of. Its custom ID is the one the handler answers to, and it has to match
exactly. The handler takes these options:

| Option     | What it's for                                                                          |
| ---------- | -------------------------------------------------------------------------------------- |
| `builder`  | The template. Its custom ID becomes the handler's.                                     |
| `customId` | The custom ID to answer, when you'd rather not keep a template.                        |
| `params`   | Data in the custom ID instead of a fixed one. See [data in custom IDs](custom-ids.md). |
| `guards`   | Checks before `run()`. See [guards](guards.md).                                        |

Give the custom ID in one place only: a handler with both `builder` and
`customId` won't load. Link and premium buttons never reach your bot, so they
can't be templates.

## Sending the button

In a command, `build()` gives you a copy of the template:

```ts fragment
await ctx.interaction.reply({
    content: "Press refresh to load your profile.",
    components: [
        new ActionRowBuilder().addComponents(
            ctx.client.buttons.build("profile.refresh"),
        ),
    ],
});
```

Every call returns a fresh copy, so change its label or disable it without
affecting anyone else. It throws if the handler isn't loaded or has no
template, which catches typos early.

You don't have to use templates at all. Build the button yourself and give the
handler a `customId`; the handler doesn't care what the button looks like.

## Changing the button after a click

Handlers are shared by everyone, so build a fresh copy rather than editing the
template:

```ts fragment
const button = ctx.client.buttons.build(this.customId).setLabel("Refreshed");
await ctx.interaction.update({
    components: [new ActionRowBuilder().addComponents(button)],
});
```

## Many buttons, one handler

Need a Close button on every ticket? Instead of a handler per ticket, give one
handler params and put the ticket's ID in each button's custom ID. See
[data in custom IDs](custom-ids.md).

## Guards

A command's guards don't carry over to the buttons it sends, so protect the
button itself:

```ts fragment
super({ builder: refreshButton, guards: [ownerOnly] });
```

For what happens when a click fails, see [responding](responding.md).
