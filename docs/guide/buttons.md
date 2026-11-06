# Buttons

A button handler runs when someone clicks a button your bot sent. Handlers
don't remember anything between clicks, so if a button needs data (like which
ticket it closes), put it in the [custom ID](custom-ids.md) or your own storage.

## A button handler

Put handlers in `src/buttons`. Each one says which custom ID it handles, either
as `customId` or through a **template** in `builder`: the reusable button design
kept with the handler in `client.buttons`. With a template, its custom ID is the
handler's. Your commands send copies of that template.

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

The custom ID has to match exactly: `profile.refresh` only handles
`profile.refresh`. Set it in one place: on the template if there is one, otherwise
as `customId`. Giving both is an error.

Link and premium buttons don't send clicks to your bot, so they can't have
handlers.

## Sending the button

In a command, call `build()` to copy the registered template and set its custom ID:

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

`build()` hands you a fresh copy each time, so change its label or disable it
without affecting anyone else. It throws if the handler isn't loaded or has no
template, which catches typos early.

You don't have to use templates at all. Build the button yourself and set the
custom ID; the handler doesn't care what the button looks like.

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
handler custom-ID params and put the ticket's ID in each
button's custom ID. See [data in custom IDs](custom-ids.md).

## Guards and responses

Add `guards` to restrict who can click. A command's guards don't carry over to
the buttons it sends, so protect the button itself:

```ts fragment
super({ builder: refreshButton, guards: [ownerOnly] });
```

See [guards](guards.md) for writing your own, and [responding](responding.md)
for `update()`, deferring, and what happens when a click fails.
