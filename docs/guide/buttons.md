# Buttons

A button handler runs when a user clicks a button your bot sent. Handlers do not store state between clicks. If a button needs data such as a ticket ID, encode it in the [custom ID](custom-ids.md) or load it from storage.

## Defining a button handler

Place button handlers in `src/buttons/`:

```ts
// src/buttons/refresh-profile.ts
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { defineButton } from "@hyperion-js/core";

export default defineButton({
    builder: new PrimaryButtonBuilder()
        .setCustomId("profile.refresh")
        .setLabel("Refresh profile"),
    run: async ctx => {
        await ctx.interaction.update({ content: "Refreshed!" });
    },
});
```

The `builder` acts as the handler's template. Commands copy this template when sending the button, and Hyperion routes clicks matching its custom ID to this handler.

| Option     | Purpose                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| `builder`  | Optional button template. Its custom ID becomes the handler's custom ID.                    |
| `customId` | Fixed custom ID to match when you do not provide a template.                                |
| `params`   | Typed parameter definition for dynamic custom IDs. See [Data in custom IDs](custom-ids.md). |
| `guards`   | Checks that run before `run()`. See [Guards](guards.md).                                    |
| `run`      | Function executed on each click.                                                            |

Provide the custom ID in one place only. TypeScript and runtime loading reject a handler that defines both `builder` and `customId`. Link and premium buttons do not send interactions to your bot and cannot be used as templates.

## Sending the button

Call `ctx.client.buttons.build()` inside a command or handler to get a fresh copy of the template:

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

Each call returns a new builder instance, so you can modify its label or disable it for one message without affecting other messages. `build()` throws if no handler is loaded for that ID or if the handler has no template.

Templates are optional. If you prefer to build buttons manually where you send them, pass `customId` instead of `builder` in `defineButton()`.

## Updating the button after a click

Because handler definitions and templates are shared across all interactions, always call `build()` to get a new copy before editing a button on click. Store the handler in a variable to reference its `customId`:

```ts fragment
const refresh = defineButton({
    builder: refreshButton,
    run: async ctx => {
        const button = ctx.client.buttons
            .build(refresh.customId)
            .setLabel("Refreshed");

        await ctx.interaction.update({
            components: [new ActionRowBuilder().addComponents(button)],
        });
    },
});

export default refresh;
```

## Sharing one handler across many buttons

If you send the same kind of button on many messages, such as a Close button on every ticket, use `params` to encode the ticket ID in each button's custom ID. See [Data in custom IDs](custom-ids.md).

## Guards

Guards on the command that sent a button do not protect later button clicks. Add guards directly to the button handler:

```ts fragment
export default defineButton({
    builder: refreshButton,
    guards: [ownerOnly],
    run: async () => {},
});
```

For how Hyperion handles rejected guards and thrown errors, see [Responding](responding.md).
