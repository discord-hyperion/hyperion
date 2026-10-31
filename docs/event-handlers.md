# Event handlers

Filesystem event handlers respond to Discord client events with typed argument
contexts and ordered execution. Client initialization and discovery follow
[architecture](architecture.md).

## Scope and developer interface

Support typed Discord client events through class-based filesystem handlers.
Application event buses, custom Hyperion lifecycle events, automatic file
watching, generated types, and changes to custom-ID handling are outside this
initial feature.

```text
<root>/src/events/
├── clientReady/
│   ├── 10-startup-message.ts
│   └── 20-details.ts
└── messageCreate/
    ├── 10-audit.ts
    └── moderation/20-check.ts
```

The first folder under `events` selects the event using Discord's exact event
name and casing. Deeper folders organize files. Handler modules under unknown
event folders or directly under `events` fail discovery. A missing event directory is
optional, consistent with existing discovery. Declarations, tests, hidden files,
dependencies, and ordinary index barrels follow existing discovery exclusions.

Each module default-exports a concrete class with a public zero-argument
constructor. Several definitions may handle the same event.

```ts
// src/events/clientReady/10-startup-message.ts
import { EventHandler, type EventContext } from "@hyperion/core";
import { Events } from "discord.js";

export default class extends EventHandler<Events.ClientReady> {
    constructor() {
        super({ once: true });
    }

    async run(ctx: EventContext<Events.ClientReady>) {
        const [client] = ctx.args;
        ctx.logger.info({ userId: client.user.id }, "Startup handler running");
    }
}
```

Repeated execution is the default; a handler needing no options may omit its
constructor. The constructor does not repeat the event selected by its folder.
Definitions are reused for a client; each invocation receives a fresh context.

`EventContext<Event>` contains the Hyperion `client`, scoped `logger`, and the
SDK argument tuple as `args`. Preserve argument order, zero/multiple arguments,
readiness types, and partial-object possibilities from `ClientEventTypes`.
Event arguments remain SDK objects; they are not interaction contexts or cloned
application snapshots.

The generic supplies compile-time argument types; it is erased at runtime.
Developers must match it to the event folder. This first feature does not generate
types or claim automatic compiler verification of filesystem placement.

Applications access a managed registry:

```ts
client.events.size; // Loaded handler definitions, not distinct event names.
await client.events.load(); // Load/reload from the client's configured root.
```

Configure queues and shutdown through client options:

```ts
const client = await HyperionClient.create({
    name: "Example",
    discord: { intents: [] },
    events: {
        maxPendingPerEvent: 1_000,
        shutdownTimeoutMs: 10_000,
    },
});
```

Both options accept nonnegative integers; zero permits no waiting occurrences or
no drain waiting respectively. Queue limits must be safe integers and shutdown
timeouts must fit a Node timer (at most 2,147,483,647 milliseconds).

Keep listener/queue bookkeeping private. Direct `.set()`, `.delete()`, and
`.clear()` mutations are not part of this interface. Store keyed internal state
using Discord Collections as appropriate.

## Ordering and admission

Within an event occurrence, await handlers sequentially:
1. Numbered filenames in ascending numeric priority.
2. Unnumbered files in deterministic relative-path order.

Use ordinary nonnegative integer prefixes such as `10-startup-message.ts` and
`20-details.ts`; gaps permit insertion at `15-check-status.ts`. Compare numbers
rather than digit strings. Duplicate numeric priorities for the same event fail
loading and identify both paths; different events may reuse priorities.

Maintain one FIFO queue per event name. Finish an occurrence's entire handler
chain before starting the next occurrence of that event. Different event names
may progress independently; they have no shared completion order.

Each event queue permits 1,000 waiting occurrences by default, excluding its
active occurrence. Make that limit configurable. If full, discard the newest
arrival and log event name and queue count without its payload. Queues are
in-memory, without durable delivery or automatic retries.

Filename ordering governs filesystem handlers only. Existing SDK, internal
Hyperion, and application-added listeners remain separate. For example, internal
ready logging/owner prefetch and interaction dispatch are not moved into these
ordered chains. Filesystem `interactionCreate` handlers therefore do not gain
exclusive response ownership or automatic acknowledgment coordination.

## One-shot definitions

`once: true` selects the first accepted occurrence after attachment. Reserve that
one-shot invocation when admitting the occurrence so another queued occurrence
cannot select it again. An overflow-discarded arrival is not accepted and does
not consume it. A handler failure does not rearm it.

A successful reload creates fresh attachments with unconsumed one-shot state.
They may run on a future occurrence; reload never replays a past event. Accepted
work from an earlier attachment still belongs to that earlier definition.

## Initialization and reload

Load and validate all event definitions during client initialization. Attach
owned listeners at the end of successful initialization, before `create()` returns
and before login. Events emitted before attachment are not replayed.

`load()` stages a complete replacement. Validation or import failures leave the
working definitions/listeners active. On success, swap future dispatch to the
replacement without duplicate listener attachment or competing queues.

Each accepted occurrence retains its handler list. Already-running and waiting
occurrences finish with their original definitions; occurrences admitted after
the swap use the replacement, preserving the existing FIFO order.

Reload should refresh handler entry modules from disk. This is manual definition
reload, not whole-dependency-graph hot reload: shared imported helpers and SDK
modules retain ordinary ESM caching. Preserve framework/SDK constructor identity;
complete graph refresh and file watching remain separate development-tooling work.

## Failures and logging

Catch both synchronous throws and rejected promises from each handler. Log the
failure and continue with the next handler and subsequent occurrences. Do not
retry or forward handler failures into the client's `error` event.

Scope logs to bounded metadata such as event name, handler source, and priority.
Never log raw argument tuples, message content, or other event payloads. Follow
[logging](logging.md) for error serialization and sensitive-data constraints.
Handlers receive no automatic interaction replies, deferrals, or fetching of
partial objects.

## Shutdown

On `destroy()`, stop accepting new event-handler work and detach only listeners
owned by this feature. Preserve unrelated application, SDK, and internal listeners.
Allow accepted work to drain before closing the Discord client.

Use a configurable 10-second deadline by default. At the deadline, discard
remaining waiting occurrences, log remaining counts without payloads, and
continue client destruction. Already-running JavaScript cannot be forcibly
cancelled; the deadline limits waiting, not execution. Do not start queued work
after the deadline. Repeated cleanup must not duplicate listener removal or work.

## Verification criteria

Use isolated emitted events, temporary modules, controlled promises, and mocked
SDK behavior. No tests require login, live tokens, deployment, or private files.
- Discover nested modules and optional missing roots; reject unknown event
  folders, root-level handlers, invalid exports, and duplicate numeric priorities.
- Verify numeric ordering, unnumbered fallback, per-event FIFO, independence of
  different event names, and scoped duplicate-priority checks.
- Use controlled promises to demonstrate actual awaited execution and queue
  behavior, rather than relying on timers or listener-registration order alone.
- Verify zero/multiple arguments, ready/partial SDK types, and negative type cases.
  Do not claim those tests establish generic/folder consistency.
- Cover queue limits, overflow accounting, one-shot reservation before waiting,
  one-shot failure consumption, and rearming only on successful reload.
- Cover synchronous and asynchronous failures without blocking later handlers,
  generating unhandled rejections, or logging payloads.
- Verify initialization attachment timing, failed replacement preservation,
  changed handler entry modules, snapshot behavior during reload, continued FIFO,
  and absence of duplicate listeners.
- Preserve internal ready/interaction behavior and application-added listeners.
- Verify graceful draining, deadline expiry, discarded waiting work, idle/repeated
  destruction, and cleanup after failed initialization.
- Prove event support through public root exports in source and packed consumers.

The behavior/type coverage lives in `packages/core/tests/events.test.ts` and
`events.types.ts`, with a ready-handler example test in `apps/dev-bot/tests`.
The source and packed-consumer checks also discover and execute ordered events.
Run the repository's required type, test, and Biome checks and `pnpm verify:package`.

## Installed SDK evidence

The inspected discord.js v15 client extends an async emitter with the
`ClientEventTypes` map. Native emission invokes listeners without awaiting them;
Hyperion's ordered execution therefore needs its own coordinator. Native `once`
consumes a listener before invocation and does not rearm on rejection.

Native listener removal does not cancel already-running work. SDK client
`destroy()` does not explicitly remove all client listeners or drain their
promises. The SDK listener-wait helper snapshots currently tracked promises,
rather than guaranteeing a drain of all later or indirectly scheduled work.

Sources: installed `node_modules/discord.js/typings/index.d.ts`,
`node_modules/discord.js/src/client/Client.js`, `@vladfrangu/async_event_emitter`
2.4.7 implementation/types, and Hyperion's client, interaction dispatcher, and
shared discovery/loader. These facts informed the event-handler contract and its isolated verification.
