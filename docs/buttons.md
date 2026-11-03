# Buttons

Use a [component handler](GLOSSARY.md#components) to process button clicks.
Hyperion stores handler definitions for routing, but does not retain per-message
state, callbacks, sessions, timers, or update queues. Durable application state
belongs in an application-owned storage layer.
A future SQLite integration can provide persistence without tying it to the
lifetime of a component handler. Database support is not implemented yet.

## Filesystem button handlers

Put button handlers in `<bot root>/src/buttons`. Hyperion loads them recursively
during `HyperionClient.create()`, even when application-command registration is
not configured. A missing folder is skipped. Buttons do not require deployment
to Discord: send them as components of a message.

Each module default-exports a `ButtonHandler` subclass with a public, zero-argument
constructor. As with commands, barrels, declarations, test files, hidden entries,
and `node_modules` are skipped. Duplicate custom IDs, invalid templates, and invalid
handlers fail initialization with their source file. All command and button
modules load before application commands are deployed.

```text
apps/dev-bot/
├── index.ts
└── src/
    ├── commands/
    │   └── (components)/
    │       └── profile.ts
    └── buttons/
        └── refresh-profile.ts
```

## Define a handler

A handler declares where clicks route with `customId`. It may also offer an
optional [template](GLOSSARY.md#components): an interactive builder from the
installed discord.js v15 builder package (`PrimaryButtonBuilder`,
`SecondaryButtonBuilder`, `SuccessButtonBuilder`, or `DangerButtonBuilder`).
Link and premium buttons do not dispatch custom-ID interactions and cannot be
templates.

```ts
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { ButtonHandler, type ButtonContext } from "@hyperion/core";

export default class RefreshButton extends ButtonHandler {
    constructor() {
        super({
            customId: "profile.refresh",
            builder: new PrimaryButtonBuilder().setLabel("Refresh profile"),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.deferUpdate();
        const user = await ctx.client.users.fetch(ctx.interaction.user.id, {
            force: true,
        });
        await ctx.interaction.editReply({
            content: `Profile refreshed: ${user.username}`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Handlers are stored in `client.buttons`, a Discord `Collection` keyed by exact
custom ID. `profile.refresh` matches only that ID; suffixes, wildcards, and regex
routing are not interpreted. Keep IDs stable after construction. The template may
omit its custom ID; if it sets one, it must equal `customId`. Unmatched buttons are ignored so application-owned collectors
and listeners can handle them. Avoid having a collector and a Hyperion handler
both acknowledge the same ID.

## Carry data in the custom ID

To give one handler many controls, each carrying its own values, declare typed
params instead of `customId`. The command sets each button's custom ID with the
encoder; see [custom-ID params](custom-id-params.md) for the wire
format, guard ordering, and stale-button rules.

```ts
export const todoDone = defineParams({
    id: "todo.done",
    keys: ["owner", "todoId"],
    schema: v.object({ owner: v.string(), todoId: v.string() }),
});

export default class TodoDone extends ButtonHandler<typeof todoDone> {
    constructor() {
        super({ params: todoDone });
    }

    async run(ctx: ButtonContext<typeof todoDone>) {
        const [issues, params] = ctx.params;
        if (issues) {
            await ctx.interaction.reply({
                content: "Out of date.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await markDone(params.todoId);
    }
}

// In a command: new PrimaryButtonBuilder().setCustomId(todoDone({ owner, todoId }))
```

A params handler owns its whole `<id>:` namespace and is stored in
`client.buttons.routes`. It may also carry a template. Exact-match routing for
literal handlers is unchanged. Params are decoded and schema-validated before
guards, so guards can read `ctx.params`; a schema failure reaches the handler as
`issues` rather than as an automatic reply.

## Send the button

Inside a command's `run(ctx)`, `build()` returns a fresh copy of the handler's
template with its custom ID set. It throws when no handler is loaded for the ID,
when the handler has no template, or when the ID is a params route.

```ts
import { ActionRowBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";

await ctx.interaction.reply({
    content: "Press refresh to load your profile.",
    flags: MessageFlags.Ephemeral,
    components: [
        new ActionRowBuilder().addComponents(
            ctx.client.buttons.build("profile.refresh"),
        ),
    ],
});
```

Without a template, build the button yourself and set `customId` on it. The
handler does not depend on how the button looks.

The development bot includes this flow as `/profile` and
`src/buttons/refresh-profile.ts`. Its button fetches fresh user data after
acknowledging the click and updates the original message. Startup and live testing
are performed by the developer; automated tests use mocked requests instead.

## Async data and state

`run(ctx)` receives a fresh `ButtonContext` with `client`, `interaction`, and a
scoped `logger`. Fetch async data there using the clicking user or source message
ID as a lookup key. Each click can retrieve current status instead of retaining a
snapshot from when the button was sent.

Handler instances and their templates are shared. Keep invocation data in
local variables, and change labels, styles, or disabled state on a copy from
`build()`, which never alters the template:

```ts
const builder = ctx.client.buttons.build(this.customId).setLabel("Updated");
```

Handlers do not receive command-local closure state. Store persistent
message-specific data in an application service and validate the clicking user's
access before acting on it.
Exact IDs survive process restarts when the same handler is loaded, but any
application state must also survive if the handler needs it. Async code alone does
not protect shared resources against simultaneous clicks; coordinate writes in
the service that owns them.

## Guards, acknowledgment, and errors

Button options accept `guards`, including shared instances and lazy async
factories. `OwnerOnly` works on both commands and buttons. Custom button guards
extend `Guard<ButtonContext>`; a guard reusable across both can accept the broader
`InteractionContext`. Guards on the command that sends a button do not
automatically protect later clicks; attach the required guards to the button.
Rejection stops later guards and the handler. `onFail(ctx)` controls custom
responses just as it does for commands.

Filesystem handlers do not auto-defer. Use `update()` for an immediate message change,
`deferUpdate()` before slow work that will edit the original message, `reply()` /
`deferReply()` for a separate response, or `showModal()` before any acknowledgment.
Choose the acknowledgment policy together with your guards. Interaction deadlines
still apply to async factories and guards.

On rejection or error, a fresh interaction receives an ephemeral reply. After
`deferReply()`, Hyperion edits that response with its original visibility. After
`deferUpdate()`, `update()`, or a reply, it sends an ephemeral follow-up so an error
does not replace the source message. Exceptions produce a generic user message
and are logged; response delivery failures are contained.

Button logs include the registered button ID and `interactionId`, `guildId`, and
`userId`. Lifecycle events are `button.started` (debug), `button.completed` and
`button.rejected` (info), and `button.failed` (error). Failures identify the
`guards` or `handler` stage. Raw interactions, message contents, and fetched
application data are not logged automatically.

## JSX authoring

`@hyperion/jsx` provides `Button` and `renderButton()` for native interactive
templates, and `ActionRow` with `renderComponents()` for message controls.
Core's `ButtonHandler` and JSX's `Button` can be imported together. Link buttons
belong in message rows and cannot be templates. Rendering does not
register callbacks or change exact-ID routing, guards, or acknowledgment.

See [JSX message components](jsx-message-components.md) for complete examples,
plain-label rules, native validation, emoji data, and the distinction between
shared templates and fresh per-message controls. `/jsx-buttons` demonstrates
both renderers in the development bot. Native collectors continue to work with
rendered message controls; avoid competing ownership of the same interactions.
