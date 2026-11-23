# How Hyperion works

Hyperion initializes your bot in two phases: `HyperionClient.create()` loads, validates, and deploys your handlers before you connect, and an interaction dispatcher routes incoming Discord interactions through a fixed pipeline.

## Startup

```text
HyperionClient.create(options)
  1. Discover   scan src/{commands,buttons,select-menus,modals,events}
  2. Validate   check exports, builders, routes (fail fast)
  3. Deploy     diff & push commands (when commands option is set)
  4. Ready      attach dispatcher ─▶ call client.login(token)
```

Hyperion scans the five fixed folders under `<root>/src/`, skipping any folder that does not exist. Omitting the `commands` option skips loading and deploying `src/commands/`. Validation finishes before any Discord REST request is sent, and if startup fails at any step, Hyperion destroys the partially initialized client before throwing.

Logging in is separate (`await client.login(token)`) so you can attach additional listeners, open a database, or inspect loaded registries before connecting to the Discord gateway.

## Interaction pipeline

```text
Discord interaction
 ├─ Autocomplete ──▶ autocomplete() ──▶ respond([]) fallback
 ├─ Unmatched
 │   ├─ Command ───▶ ephemeral "no longer available" reply
 │   └─ Component ─▶ ignored (for your own collectors/listeners)
 └─ Matched handler
     1. params   decode & validate custom ID ─▶ ctx.params tuple
     2. guards   parent ─▶ group ─▶ handler
     │            └─ false ─▶ onFail() or description (stop)
     3. defer    deferReply() or deferUpdate() (if input.defer set)
     4. input    validate schema ─▶ resolve() ─▶ ctx.input tuple
     5. run()    your handler replies, updates, or shows a modal

     Thrown error at any step ─▶ logged + generic error reply
```

On component handlers, `params` decode and validate before `guards` run, which is why [`paramOwner()`](custom-ids.md#verifying-ownership) can inspect `ctx.params`. By contrast, `input` runs after `guards`, so rejected users never trigger database lookups in `input.resolve`.

Guard rejections stop execution immediately. Validation failures in `params` or `input.schema` do not stop execution: Hyperion skips `input.resolve` and passes `[issues, undefined]` to `run()` so your handler decides what to reply. Handler definitions are shared and stateless, and every interaction receives a fresh `ctx` containing `client`, `interaction`, and `logger`.

## Responding and automatic deferring

Hyperion never replies to interactions automatically. Call `reply()`, `deferReply()`, `update()`, `deferUpdate()`, or `showModal()` on `ctx.interaction`, just like plain discord.js. See the discord.js guide on [response methods](https://discordjs.guide/legacy/slash-commands/response-methods) for platform rules.

Commands, subcommands, select menus, and modals that use [typed input](input.md) can ask Hyperion to defer automatically before validating input:

```ts fragment
input: {
    schema,
    defer: true, // Calls deferReply({ flags: MessageFlags.Ephemeral })
    // defer: "update", // Calls deferUpdate() on select menus and component-opened modals
},
```

Auto-defer runs after guards pass and skips if a guard already replied or deferred. `defer: "update"` works only on select menus and modals opened from a message component; using it on a modal opened from a slash command fails at the `input` stage.

## Handling errors

If a guard, schema, resolver, or `run()` function throws an exception, Hyperion catches it, logs the error, and sends a generic error message so internal details are never exposed to users. How Hyperion delivers that message depends on the interaction's acknowledgment state:

| Interaction state when the error occurred | What Hyperion sends           |
| ----------------------------------------- | ----------------------------- |
| Not acknowledged yet                      | An ephemeral reply            |
| Reply was deferred                        | An edit to the deferred reply |
| Already replied, or update was deferred   | An ephemeral follow-up        |

When a deferred reply has already been edited into a [layout message](jsx/layout-messages.md), Discord forbids editing plain `content` onto it, so Hyperion falls back to an ephemeral follow-up. If sending the error response itself fails (for example, because the interaction expired), Hyperion logs and swallows that failure.

When a [guard](guards.md) rejects an interaction without a custom `onFail()` handler, Hyperion delivers the guard's `description` using the same table.

## Unmatched interactions

Unmatched commands and unmatched components behave differently:
- **Unmatched commands** (such as a stale command still registered in Discord) receive an ephemeral _"This command is no longer available."_ reply.
- **Unmatched buttons, select menus, and modals** are ignored silently so your own discord.js collectors and event listeners can handle them. Never let both a collector and a Hyperion handler acknowledge the same custom ID.
