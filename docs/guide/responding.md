# Responding

Hyperion doesn't reply for you. Your handler replies, defers, or opens a modal
through `ctx.interaction`, exactly as in plain discord.js. If you need a
refresher, the discord.js guide covers
[response methods](https://discordjs.guide/legacy/slash-commands/response-methods).

This page covers the few things Hyperion _does_ do around responses.

## Automatic deferring

Commands, select menus, and modals with [typed input](input.md) can ask Hyperion
to defer for them:

```ts fragment
const input = defineInput({
    schema,
    defer: true, // a private deferReply()
    // defer: "update", // a deferUpdate(), for select menus and modals
});
```

Hyperion defers after your guards pass and before it validates the input. If a
guard already responded, it doesn't defer again.

## When something goes wrong

If a guard or handler throws, Hyperion catches it, logs it, and sends a generic
error message, so your user never sees the exception. Where the message goes
depends on what already happened:

| State when it failed                       | Hyperion sends                |
| ------------------------------------------ | ----------------------------- |
| Nothing sent yet                           | A private reply               |
| The reply was deferred                     | An edit to the deferred reply |
| You already replied, or deferred an update | A private follow-up           |

A component error after a deferred update never overwrites the original
message. If sending the error itself fails (say, the interaction expired),
that's logged and swallowed too.

When a [guard](guards.md) rejects, its description is sent the same way, unless
the guard replies itself.

## Interactions nobody handles

A button, menu, or modal whose custom ID doesn't match any handler is left
alone, so your own collectors and listeners can still pick it up. Just make sure
only one of them responds.
