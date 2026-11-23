# Events

Event handlers run when Discord emits client events such as `clientReady` or `messageCreate`. Place handler files in folders named after the event, and Hyperion loads and binds them automatically.

## Defining an event handler

Create a subfolder under `src/events/` whose name matches the exact discord.js event name, such as `clientReady` or `messageCreate`:

```ts
// src/events/clientReady/10-startup-message.ts
import { defineEvent } from "@hyperion-js/core";
import { Events } from "discord.js";

export default defineEvent({
    event: Events.ClientReady,
    once: true,
    run: async ctx => {
        const [client] = ctx.args;
        ctx.logger.info({ userId: client.user.id }, "Ready!");
    },
});
```

The `event` property types `ctx.args` to match the arguments discord.js emits for that event. During loading, Hyperion verifies that `event` matches the parent folder name. Set `once: true` to run the handler only on the first emission.

## Order

Multiple files can listen to the same event. Hyperion runs them sequentially in filename order:

```files
src/events/messageCreate/
├── 10-audit.ts
├── 20-moderation.ts
└── links/
    └── 30-preview.ts
```

Files with numeric prefixes run first, from lowest number to highest. Leave gaps between numbers, such as `10` and `20`, so you can insert another handler later without renaming existing files. Unnumbered files run after all numbered files. Two handlers for the same event cannot share the same numeric prefix. Subfolders inside an event folder are for organization only and do not affect execution order.

Hyperion also processes one emission of an event at a time. All handlers for one `messageCreate` event finish before the next `messageCreate` event starts. Different event types run concurrently and do not block each other.

## Error handling and queuing

If an event handler throws an error, Hyperion logs the failure and continues to the next handler in the chain. One failing handler does not block the others.

When events arrive faster than your handlers finish, Hyperion queues up to 1,000 pending emissions per event by default. If the queue is full, Hyperion drops the newest emission and logs a warning.

## Configuration

Configure queue limits and shutdown draining in `HyperionClient.create()`:

```ts fragment
const client = await HyperionClient.create({
    // ...
    events: {
        maxPendingPerEvent: 1_000, // Maximum queued emissions per event
        shutdownTimeoutMs: 10_000, // Maximum wait time during destroy()
    },
});
```

When you call `client.destroy()`, Hyperion stops accepting new events and waits up to `shutdownTimeoutMs` for running handlers to finish.

## Reloading event handlers

Call `await client.events.load()` to reload event files from disk. Emissions already in progress finish with the previously loaded handlers. If reloading fails, Hyperion keeps the existing handlers active.

## Handling interactions

You can add a `src/events/interactionCreate/` handler, but Hyperion already routes commands, buttons, select menus, modals, and autocomplete interactions.

> [!WARNING]
> If you listen to `interactionCreate` manually, ensure that your listener and Hyperion's built-in router do not both respond to the same interaction.
