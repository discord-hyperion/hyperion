# Events

Event handlers react to things happening on Discord: the bot coming online, a
message being sent, someone joining. Drop a file in the right folder and
Hyperion runs it every time that event fires.

## An event handler

The first folder under `src/events` is the event's name, spelled exactly as
discord.js spells it (`clientReady`, `messageCreate`, …):

```ts
// src/events/clientReady/10-startup-message.ts
import { defineEvent } from "@hyperion/core";
import { Events } from "discord.js";

export default defineEvent({
    event: Events.ClientReady,
    once: true,
    async run(ctx) {
        const [client] = ctx.args;
        ctx.logger.info({ userId: client.user.id }, "Ready!");
    },
});
```

`event` names the event again, which types `ctx.args`: the event's arguments, in
the order discord.js passes them. Hyperion checks it matches the folder when it
loads the file. `once: true` runs the handler for the first occurrence only.

## Order

Several handlers can listen to the same event. They run one after another, in
filename order:

```files
src/events/messageCreate/
├── 10-audit.ts
├── 20-moderation.ts
└── links/
    └── 30-preview.ts
```

Numbered files run first, lowest number first (gaps are fine, so you can slot in
`15-…` later). Unnumbered files run after them. Two files can't share a number
for the same event. Subfolders are just for organising.

Each event also runs one occurrence at a time: the whole chain finishes for one
message before the next message starts. Different events don't wait for each
other.

## When things go wrong

If a handler throws, Hyperion logs it and moves on to the next handler. One
broken handler won't stop the rest.

If events arrive faster than you handle them, up to 1,000 per event wait in
line. After that, the newest ones are dropped (and logged).

## Settings

```ts fragment
const client = await HyperionClient.create({
    // …
    events: {
        maxPendingPerEvent: 1_000, // how many can wait per event
        shutdownTimeoutMs: 10_000, // how long destroy() waits for running handlers
    },
});
```

On `client.destroy()`, Hyperion stops taking new events and gives running ones
up to `shutdownTimeoutMs` to finish.

## Reloading

`await client.events.load()` reloads your event files from disk. Anything already
running finishes with the old version. If the reload fails, the old handlers keep
working.

## Interactions

You _can_ handle `interactionCreate` here, but Hyperion already routes commands,
buttons, menus, and modals for you.

> [!WARNING]
> If you add your own, make sure only one place responds to each interaction.
