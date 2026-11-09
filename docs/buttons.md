# Buttons

Use a [component handler](GLOSSARY.md#components) to process button clicks.
Hyperion stores handler definitions for routing, but does not retain per-message
state, callbacks, sessions, timers, or update queues. Durable application state
belongs in an application-owned storage layer.
Database integration is outside the framework’s current scope.

## Filesystem button handlers

Put button handlers in `<bot root>/src/buttons`. Hyperion loads them recursively
during `HyperionClient.create()`, even when application-command registration is
not configured. A missing folder is skipped. Buttons do not require deployment
to Discord: send them as components of a message.

Each module default-exports the handler `defineButton()` returns. As with
commands, barrels, declarations, test files, hidden entries,
and `node_modules` are skipped. Duplicate custom IDs, invalid templates, and invalid
handlers fail initialization with their source file. All command and button
modules load before application commands are deployed.

```text
my-bot/
├── index.ts
└── src/
    ├── commands/
    │   └── (components)/
    │       └── profile.ts
    └── buttons/
        └── refresh-profile.ts
```

## Templates

The button registry stores handlers with their optional **templates** in
`builder`. A template defines the reusable button appearance; `build()` creates
an independent button from it and sets the custom ID. Use
`build("profile.refresh")` for a fixed ID, or `build(definition, values)` to encode
params into an ID that Hyperion can parse when the button is clicked.
The shared template stays unchanged.

## Define a handler

A handler declares where clicks route with `customId`, or with the custom ID of
its [template](GLOSSARY.md#components): an interactive builder from the
installed discord.js v15 builder package (`PrimaryButtonBuilder`,
`SecondaryButtonBuilder`, `SuccessButtonBuilder`, or `DangerButtonBuilder`).
Link and premium buttons do not dispatch custom-ID interactions and cannot be
templates.

```ts
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { defineButton } from "@hyperion-js/core";

export default defineButton({
    builder: new PrimaryButtonBuilder()
        .setCustomId("profile.refresh")
        .setLabel("Refresh profile"),
    run: async ctx => {
        await ctx.interaction.deferUpdate();
        const user = await ctx.client.users.fetch(ctx.interaction.user.id, {
            force: true,
        });
        await ctx.interaction.editReply({
            content: `Profile refreshed: ${user.username}`,
            allowedMentions: { parse: [] },
        });
    },
});
```

Handlers are stored in `client.buttons`, a Discord `Collection` keyed by exact
custom ID. `profile.refresh` matches only that ID; suffixes, wildcards, and regex
routing are not interpreted. Keep IDs stable after construction.

A handler gets its ID from exactly one source: `customId`, a template whose
custom ID becomes the handler's, or `params`, whose route the optional template
must carry as its custom ID. Passing `customId` beside a template is a type error
and throws. So does a template without a custom ID, or a params template whose
custom ID isn't the route. Loading also rejects a template whose custom ID changed
after construction.

Unmatched buttons are ignored so application-owned collectors
and listeners can handle them. Avoid having a collector and a Hyperion handler
both acknowledge the same ID.

## Carry data in the custom ID

To give one handler many controls, each carrying its own values, declare typed
params instead of `customId`. The registry builds each button from its template
and encodes the supplied values into its custom ID; see [custom-ID params](custom-id-params.md) for the wire
format, guard ordering, and stale-button rules.

```ts fragment
export const todoDone = defineParams({
    id: "todo.done",
    keys: ["owner", "todoId"],
    schema: v.object({ owner: v.string(), todoId: v.string() }),
});

export default defineButton({
    params: todoDone,
    builder: new PrimaryButtonBuilder()
        .setCustomId(todoDone.id)
        .setLabel("Done"),
    run: async ctx => {
        const [issues, params] = ctx.params;
        if (issues) {
            await ctx.interaction.reply({
                content: "Out of date.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await markDone(params.todoId);
    },
});

// In a command: ctx.client.buttons.build(todoDone, { owner, todoId })
```

A params handler owns its whole `<id>:` namespace and is stored in
`client.buttons.routes`. It may also carry a template, which
`client.buttons.build(todoDone, { owner, todoId })` copies with the encoded
custom ID. Exact-match routing for
literal handlers is unchanged. Params are decoded and schema-validated before
guards, so guards can read `ctx.params`; a schema failure reaches the handler as
`issues` rather than as an automatic reply.

## Send the button

Inside a command's `run(ctx)`, `build()` returns a fresh copy of the handler's
template with its custom ID set. It throws when no handler is loaded for the ID,
when the handler has no template, or when a params route is passed as a string.
For params, use `build(definition, values)` so the generated ID includes the
values needed for decoding.

```ts fragment
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

## Async data and state

`run(ctx)` receives a fresh `ButtonContext` with `client`, `interaction`, and a
scoped `logger`. Fetch async data there using the clicking user or source message
ID as a lookup key. Each click can retrieve current status instead of retaining a
snapshot from when the button was sent.

Handler instances and their templates are shared. Keep invocation data in
local variables, and change labels, styles, or disabled state on a copy from
`build()`, which never alters the template:

```ts fragment
const refresh = defineButton({
    builder,
    run: async ctx => {
        const copy = ctx.client.buttons
            .build(refresh.customId)
            .setLabel("Updated");
        await ctx.interaction.update({
            components: [new ActionRowBuilder().addComponents(copy)],
        });
    },
});
```

Handlers do not receive command-local closure state. Store persistent
message-specific data in an application service and validate the clicking user's
access before acting on it.
Exact IDs survive process restarts when the same handler is loaded, but any
application state must also survive if the handler needs it. Async code alone does
not protect shared resources against simultaneous clicks; coordinate writes in
the service that owns them.

## Guards, acknowledgment, and errors

Button options accept `guards`, including shared guards and lazy async
factories. `ownerOnly` works on both commands and buttons. Custom button guards
are `defineGuard<ButtonContext>({ … })` definitions; a guard reusable across both can accept the broader
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

`@hyperion-js/jsx` provides `Button` and `renderButton()` for native interactive
templates, and `ActionRow` with `renderComponents()` for message controls.
Core's `ButtonHandler` and JSX's `Button` can be imported together. Link buttons
belong in message rows and cannot be templates. Rendering does not
register callbacks or change exact-ID routing, guards, or acknowledgment.

See [JSX message components](jsx-message-components.md) for complete examples,
plain-label rules, native validation, emoji data, and the distinction between
shared templates and fresh per-message controls. Native collectors continue to
work with rendered message controls; avoid competing ownership of the same interactions.
