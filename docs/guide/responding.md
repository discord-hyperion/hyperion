# Responding

Hyperion does not reply to interactions automatically. Your handler calls `reply()`, `deferReply()`, `update()`, `deferUpdate()`, or `showModal()` on `ctx.interaction`, just like plain discord.js. See the discord.js guide on [response methods](https://discordjs.guide/legacy/slash-commands/response-methods) if you need a refresher.

This page explains how Hyperion handles automatic deferring, errors, and unmatched interactions.

## Automatic deferring

Commands, select menus, and modals that use [typed input](input.md) can ask Hyperion to defer automatically before validating input:

```ts fragment
const input = defineInput({
    schema,
    defer: true, // Calls deferReply() with MessageFlags.Ephemeral
    // defer: "update", // Calls deferUpdate(), available on select menus and modals
});
```

Hyperion defers after guards pass and before schema validation runs. If a guard already replied or deferred, Hyperion skips the defer call.

## Handling errors

If a guard or handler throws an exception, Hyperion catches it, logs the error, and sends a generic error message to the user so internal error details are never exposed. How Hyperion sends that message depends on the interaction's state:

| Interaction state when the error occurred | What Hyperion sends           |
| ----------------------------------------- | ----------------------------- |
| Not acknowledged yet                      | An ephemeral reply            |
| Reply was deferred                        | An edit to the deferred reply |
| Already replied, or update was deferred   | An ephemeral follow-up        |

When a component handler fails after `deferUpdate()`, Hyperion sends an ephemeral follow-up instead of overwriting the original message. If sending the error response fails, for example because the interaction expired, Hyperion logs and swallows that failure as well.

When a [guard](guards.md) rejects an interaction without a custom `onFail()` handler, Hyperion sends the guard's `description` using the same rules.

## Unmatched interactions

If a button, select menu, or modal has a custom ID that does not match any registered handler, Hyperion ignores it. Your own discord.js collectors and event listeners can still handle those interactions. Make sure only one listener responds to any given interaction.
