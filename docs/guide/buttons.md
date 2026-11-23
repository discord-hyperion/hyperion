# Buttons

A button handler runs when a user clicks a button your bot sent. Because routing is based on the button's custom ID, handlers survive bot restarts without maintaining per-message collectors. Handlers do not store state between clicks, so encode per-message data such as a ticket ID in the [custom ID](custom-ids.md) or load it from storage.

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

Use `builder` when the button's appearance is reusable so callers get consistent copies from `build()`. Use `customId` when callers construct the button inline (for example with [JSX](jsx/with-hyperion.md) or per-message layouts) and only need routing.

Provide the custom ID in one place only: TypeScript and startup validation reject a handler that sets both `builder` and `customId`. Link and premium buttons do not send interactions and cannot be used as templates. Fixed-ID handlers match only the exact custom ID (no prefixes, wildcards, or regex), and unmatched clicks are ignored so your own collectors still work (see [Unmatched interactions](how-hyperion-works.md#unmatched-interactions)).

## Sending the button

A handler's `builder` is a single shared template. Calling `ctx.client.buttons.build()` clones that template into a fresh copy you can customize per message:

```text
Handler template (shared, stays unchanged)
  "profile.refresh"  label: "Refresh profile"
        │
        ├── build("profile.refresh") ─▶ copy A (sent on message 1)
        └── build("profile.refresh") ─▶ copy B ─▶ .setDisabled(true)
```

Mutating a copy returned by `build()` never modifies the shared template or copies sent on other messages. Select-menu and modal handlers use the same template-and-copy model via `client.selectMenus.build()` and `client.modals.build()`.

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

`build()` throws if no handler is loaded for that ID, if the handler has no template, or if you pass a `params` route string without its values.

## Updating the button after a click

Always call `build()` to get a new copy before editing a button on click. Assigning the handler to a variable lets you pass `refresh.customId` instead of repeating the string literal:

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

When many messages share the same kind of button, such as a Close button on every ticket, use `params` to encode the ticket ID in each button's custom ID. See [Data in custom IDs](custom-ids.md).

## Guards

> [!WARNING]
> Guards on the command that sent a button do not protect later button clicks. Attach guards directly to the button handler.

```ts fragment
export default defineButton({
    builder: refreshButton,
    guards: [ownerOnly],
    run: async ctx => {
        await ctx.interaction.update({ content: "Refreshed!" });
    },
});
```

For how Hyperion handles rejected guards and thrown errors, see [Handling errors](how-hyperion-works.md#handling-errors).
