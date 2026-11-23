# Events

Event handlers run when Discord emits client events such as `clientReady` or `messageCreate`. Using `src/events/` gives you sequential file ordering, per-event FIFO queuing with backpressure, error isolation, graceful shutdown draining, and manual reloading. The `src/events/` folder is optional (skipped if absent), and Discord emits only the events covered by your configured `discord.intents`.

## Defining an event handler

Create a top-level folder under `src/events/` named after the exact discord.js event name, such as `clientReady` or `messageCreate`:

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

`ctx` provides three properties: `ctx.client`, `ctx.logger`, and `ctx.args`. The `event` option types `ctx.args` to match discord.js's exact argument tuple—including multi-argument events like `messageUpdate` and partial objects (Hyperion does not auto-fetch partials). During loading, Hyperion verifies that `event` matches the top-level folder directly under `src/events/`.

Set `once: true` to run a handler only on the first accepted emission of that event (handler errors do not rearm it, and overflow-dropped emissions do not consume it). Event handlers do not support `guards` or `input`; check conditions inside `run()`.

## Order

Multiple files can listen to the same event. Hyperion runs them sequentially in filename order:

```files
src/events/messageCreate/
├── 10-audit.ts
├── 20-moderation.ts
└── links/
    └── 30-preview.ts
```

Files with numeric prefixes run first, sorted as integers from lowest to highest (`01-a.ts` and `1-b.ts` collide as duplicate priority `1`). Leave gaps such as `10` and `20` so you can insert another handler without renaming existing files. Different events may reuse the same numbers. Unnumbered files run after numbered files in relative-path order, and subfolders inside an event folder are for organization only—they do not affect numeric priority order.

Hyperion processes one emission of a given event at a time: all handlers for one `messageCreate` finish before the next `messageCreate` starts, while different event types run concurrently. Filename ordering applies only to files in `src/events/`; manual `client.on()` listeners and Hyperion's internal interaction dispatcher run separately.

## Error handling and queuing

If an event handler throws, Hyperion logs the error as `event.failed` (never forwarding it to the client's `error` event) and continues to the next handler in the chain.

When events arrive faster than your handlers finish, Hyperion queues up to `1_000` waiting emissions per event by default, excluding the currently running emission. Setting `maxPendingPerEvent: 0` disables waiting and drops any emission that arrives while one is active. When the queue is full, Hyperion drops the newest emission and logs a warning.

## Configuration

Configure queue limits and shutdown draining in `HyperionClient.create()`:

```ts fragment
const client = await HyperionClient.create({
    // ...
    events: {
        maxPendingPerEvent: 1_000, // Waiting emissions per event (excluding active)
        shutdownTimeoutMs: 10_000, // Maximum wait time during destroy()
    },
});
```

When you call `client.destroy()`, Hyperion detaches its own event listeners (leaving manual listeners intact) and waits up to `shutdownTimeoutMs` for running and already-queued emissions to finish. If the timeout expires, Hyperion discards remaining queued emissions, logs `events.shutdown.timeout`, and destroys the client (already-running JavaScript cannot be forcibly cancelled).

## Reloading event handlers

Call `await client.events.load()` to reload event files from disk. Emissions already in progress finish with the previously loaded handlers, and if reloading fails, Hyperion keeps the existing handlers active.

`client.events.load()` re-imports changed handler entry files from disk, not shared helper modules they import (ordinary Node ESM module caching still applies). A successful reload rearms `once: true` handlers for future emissions without replaying past events. Calling `load()` after `client.destroy()` starts throws an error.

## Handling interactions

You can add a `src/events/interactionCreate/` handler, but Hyperion already routes commands, buttons, select menus, modals, and autocomplete interactions. See [Unmatched interactions](how-hyperion-works.md#unmatched-interactions).

> [!WARNING]
> If you listen to `interactionCreate` manually, ensure that your listener and Hyperion's built-in dispatcher do not both respond to the same interaction.
