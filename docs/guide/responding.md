# Responding

Hyperion doesn't reply for you. Your handler decides whether to reply, defer, or
open a modal, exactly like plain discord.js. This page covers the few things
Hyperion _does_ do around responses, so you're never surprised.

## Replying

Use the discord.js methods on `ctx.interaction`:

```ts
await ctx.interaction.reply({
    content: "Done!",
    flags: MessageFlags.Ephemeral,
});
```

Slow work? Defer first, then edit:

```ts
await ctx.interaction.deferReply();
const report = await buildReport();
await ctx.interaction.editReply(report);
```

For buttons and select menus, `update()` and `deferUpdate()` change the message
the component is on instead of sending a new one.

A few reminders from Discord itself:
- You have three seconds to respond (or defer).
- Opening a modal counts as the response, so call `showModal()` before anything else.
- A modal submission can't open another modal.

## Automatic deferring

Commands and modals with [typed input](input.md) can set `defer: true`. Hyperion
then defers privately after your guards pass and before validating the input.
If a guard already responded, it won't defer again.

## When something goes wrong

If a guard or handler throws, Hyperion catches it, logs it, and sends a generic
error message. Your user never sees the exception. Where that message goes
depends on what already happened:

| State when it failed                           | Hyperion sends                |
| ---------------------------------------------- | ----------------------------- |
| Nothing sent yet                               | A private reply               |
| You called `deferReply()`                      | An edit to the deferred reply |
| You already replied, or called `deferUpdate()` | A private follow-up           |

A component error after `deferUpdate()` never overwrites the original message.
If sending the error itself fails (say, the interaction expired), that's logged
and swallowed too.

When a [guard](guards.md) rejects, its `description` is sent the same way,
unless the guard has an `onFail()` that replies itself.

## Interactions nobody handles

A button, menu, or modal whose custom ID doesn't match any handler is left
alone, so your own collectors and listeners can still pick it up. Just make sure
only one of them responds.
