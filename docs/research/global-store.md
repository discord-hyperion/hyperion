# Global store research

Researched on 2026-11-03. This note proposes an API; `store` and the
`HyperionStore` extension point are **not implemented**. No dependency or runtime
code changed. Recommendations below are engineering judgments based on the
linked implementation and primary sources.

## Recommendation

Add an application-supplied, typed object to each client as `client.store`.
Use `ctx.client.store` in handlers, guards, resolvers, autocomplete, and events.
Keep the reference readonly while allowing application-owned values to change.
Initialize it before discovery, retain it across handler reloads, and let the
application own its resources. Start with module augmentation for the store
shape if all clients in one TypeScript program can share that shape.

“Global” should mean shared by invocations of one client. This is neither a
process singleton nor durable storage. Two clients should receive distinct
objects unless the application deliberately supplies the same reference. One
container can hold local state, services, and persistent-state adapter references;
each value keeps its own lifetime and consistency contract.

## Existing integration points

The current [client](../../packages/core/src/client/hyperion-client.ts) constructs
registries before asynchronous initialization. Its factory initializes before
returning and destroys the client on initialization failure. Its
[options](../../packages/core/src/client/options.ts) have no store field.
[Architecture](../architecture.md#invocation-boundaries) separates shared handler
definitions from fresh invocation contexts and assigns persistent component
state to the application.

[InteractionContext](../../packages/core/src/contexts/interaction-context.ts) and
[EventContext](../../packages/core/src/events/event-handler.ts) already contain
`HyperionClient`. [Guards](../../packages/core/src/guards/guard.ts) receive their
context; [input resolvers](../../packages/core/src/commands/command-input.ts)
receive the original invocation context. The
[dispatcher](../../packages/core/src/execution/interaction-dispatcher.ts) passes
the client into interaction contexts. A client property therefore supplies one
access path across these surfaces without an initial `ctx.store` alias.

Handler registries keep shared definitions and their optional **templates**:
reusable builders for buttons, select menus, and modals. `build(definition, values)`
encodes a custom ID and sets it on a fresh template copy; Hyperion parses and
validates it when the interaction returns. Templates and routing belong to the
registries; per-invocation values travel in the custom ID. See
[component templates](../architecture.md#component-templates).

A store
holds application values such as caches, cooldowns, or services. It should not
become another handler registry or imply automatic persistence. The existing
[cooldown guard](../../packages/core/src/guards/builtins/cooldown.ts) already
accepts an application-owned `Collection<string, number>`, which could live in
the proposed store. Follow [contributor guidance](../../AGENTS.md) by using
Discord Collections for keyed stores; an object with known named fields does
not need a generic key/value registry. Persistence is explored below as an
application responsibility; framework database integration remains out of scope.

## Proposed authoring example

This is an illustrative consumer API, not runnable against the current release:

```ts
import { HyperionClient, type CommandContext } from "@hyperion-js/core";
import { Collection } from "discord.js";

declare module "@hyperion-js/core" {
    // biome-ignore lint/style/useConsistentTypeDefinitions: Interfaces support module augmentation.
    interface HyperionStore {
        cooldowns: Collection<string, number>;
        maintenance: boolean;
    }
}

const client = await HyperionClient.create({
    name: "Example",
    discord: { intents: [] },
    store: {
        cooldowns: new Collection<string, number>(),
        maintenance: false,
    },
});

const isAvailable = (ctx: CommandContext) => !ctx.client.store.maintenance;
```

The framework would need to export a named, augmentable `HyperionStore`
interface, declare `readonly store: HyperionStore`, and assign the supplied
object in the constructor before loading modules. Interface declarations require
a stated Biome exception under this repository's type-alias convention. The
example access also applies to guard/resolver/event contexts carrying the same
client; module-level code and zero-argument handler constructors should not
expect an ambient current client.

## Typing choices and initialization

| Approach                | Fit and cost                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module augmentation     | Smallest change to existing filesystem classes and context signatures. All consumers of the declaration share one shape. Independent clients can have distinct values, but incompatible store schemas in the same compilation are awkward.               |
| Client/context generics | Expresses a different schema per client. Requires propagation through factory options, contexts, handlers, guards, resolvers, events, and dispatch contracts; supplying `create<MyStore>()` alone cannot specialize separately declared handler classes. |
| Typed keys or tokens    | Allows explicit service dependencies and incremental registration. Requires key identity, collision policy, and missing-value semantics. Useful for a concrete plugin use case; unnecessary machinery for a few named fields.                            |

These tradeoffs follow from TypeScript's
[module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation)
and [generic class/function contracts](https://www.typescriptlang.org/docs/handbook/2/generics.html).
Augmentation patches an existing named declaration; it does not create runtime
values. Generic types carry relationships only where signatures retain them.
Typed property keys can preserve a value type using `Key extends keyof Store`;
a symbol token API would additionally need to associate each token with its
value type and define registration checks. These are proposed designs, not APIs
inferred from the TypeScript documentation.

Avoid declaring a populated store type while silently initializing `{}`.
Prefer requiring `store: HyperionStore` when the augmented contract has required
fields. A conditional options type could permit omission only when `{}`
satisfies that contract, with a fresh empty object per client. Check required
fields rather than merely `keyof`: an interface can contain optional fields.
Requiring `store` for every client is simpler but adds boilerplate for clients
without state. This is an open ergonomics choice.

Type checking can reject an incomplete object in TypeScript, but declarations
are not runtime schemas. JavaScript callers and assertions can bypass them.
Validate the store's basic object shape if supplied, and do not claim required
application fields are runtime-validated without an application schema. If a
future token API offers required retrieval, an absent token should throw a clear
error; ordinary optional retrieval must retain `undefined` in its return type.

## Framework comparison

Sapphire's official
[Container documentation](https://www.sapphirejs.dev/docs/Documentation/api-pieces/interfaces/Container/)
provides an augmentable interface for injected application/plugin references and
includes a `stores: StoreRegistry` member. This establishes a useful precedent
for typed shared access and distinguishes the container from its registry
member. It does not establish a need for Hyperion to adopt Sapphire's container
scope, plugin system, or registry infrastructure. Hyperion already has a client
in each invocation context, so attaching application state there is the smaller
integration.

Node's [AsyncLocalStorage](https://nodejs.org/api/async_context.html#introduction)
propagates state through callbacks and promise chains for an asynchronous
duration. It could support invocation metadata if an explicit future need
appears. It supplies neither persistence nor synchronization and adds no useful
capability for state already reachable through `ctx.client`; do not introduce it
for this feature.

## Lifetime, concurrency, and memory

Assign the store before discovery and listener attachment, so handlers cannot
observe partial setup after `create()` returns. Applications can prepare async
dependencies before calling `create()`. Keep the first version to object
injection rather than adding async factories, lifecycle hooks, or constructor
injection. Handler reload replaces definitions, not application state; this is
consistent with the [existing reload boundary](../event-handlers.md#initialization-and-reload).

Read/modify/write operations spanning `await` can interleave. For example, two
invocations can both read `remaining = 1`, await work, and both consume it.
Expose operations on an application service or use an application-owned queue
when an invariant crosses an async boundary. A plain object or Collection does
not provide transactions. This is a consequence of the execution model: event
queues serialize only one event name, while different event names and
interaction work can progress independently; see
[event ordering](../event-handlers.md#ordering-and-admission) and the
[dispatcher](../../packages/core/src/execution/interaction-dispatcher.ts).

Application caches need bounded size, expiry, and deliberate deletion. Avoid
retaining contexts, interactions, or large SDK objects when an ID suffices.
The initial framework property should provide no automatic clear or resource
disposal: [shutdown](../event-handlers.md#shutdown) may reach its deadline while
an active event handler continues, and client cleanup does not track and drain
interaction executions. Clearing or disposing the store at that point can break
ongoing work. The application must coordinate its own operations and resource
shutdown; a stronger framework disposal guarantee needs separate lifecycle work.
This ownership also applies when `create()` fails after receiving the object.

## Shards and process boundaries

discord.js [ShardingManager](https://discord.js.org/docs/packages/discord.js/main/ShardingManager:Class)
spawns a self-contained process or worker per shard, each with its own client.
A normal client store is therefore local to that client/isolate; neither module
augmentation nor a singleton automatically shares it with other shards.
Node [child processes](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)
have independent memory and V8 instances. Workers support explicit buffer
transfer or shared buffers, as described in
[worker threads](https://nodejs.org/api/worker_threads.html), which does not make
an ordinary object or Collection a shared store.

Applications needing cross-shard coordination must choose an explicit messaging
or external-state design separately. Shard broadcasts do not establish atomic
updates. A process restart loses in-memory state; this proposal adds no durable
storage, replication, or database integration. The linked SDK page describes
the documented design; no live shard operation or network deployment was tested.

## Three responsibilities behind one access path

The following comparison is a design recommendation, not an implemented storage
contract. One typed container can expose all three without pretending they have
the same semantics.

| Responsibility                  | Useful Discord bot examples                                                         | Scope and contract                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared in-memory state          | Disposable lookup caches, local cooldowns, maintenance flags                        | Immediate synchronous access within one client; reset on restart; local queues protect local async invariants.                                                                            |
| Shared services/dependencies    | Moderation policy, translation, remote API clients, ticket operations               | Inject prepared objects once; methods own validation, concurrency, errors, and resource lifecycle. A service may be stateless or hold local/remote state.                                 |
| Persistent or distributed state | Guild configuration, ticket ownership, durable reminders, cooldowns spanning shards | Application-owned async adapter; explicitly choose restart durability, writer coordination, TTL, and failure behavior. Persistence and cross-shard consistency are separate requirements. |

For example, a second **unimplemented proposal** could extend the first example
with `local`, `services`, and `state` fields. These are application-chosen groups,
not required framework namespaces:

```ts
type CooldownService = {
    tryAcquire: (key: string, ttlMs: number) => Promise<boolean>;
};

type GuildSettingsService = {
    getLocale: (guildId: string) => Promise<string>;
    setLocale: (guildId: string, locale: string) => Promise<void>;
};

type BotDependencies = {
    local: { cooldowns: Collection<string, number> };
    services: { cooldowns: CooldownService };
    state: { guildSettings: GuildSettingsService };
};
```

The application could inject a `BotDependencies` object using the proposed
`store` option. Handlers would use `ctx.client.store.local.cooldowns`,
`await ctx.client.store.services.cooldowns.tryAcquire(key, ttlMs)`, or
`await ctx.client.store.state.guildSettings.getLocale(guildId)`. Real projects
could choose flatter names. All implementation classes and creation functions
remain application-owned; this proposal does not require a dependency-injection
library or a bundled storage driver.

### Service construction and ownership

Construct and await required services before `HyperionClient.create()`; a failed
connection or hydration then fails startup before handler discovery. Track which
resources the application created, clean up partial startup on failure, and
dispose owned resources in reverse dependency order after their users stop.
Deliberately shared service objects need one external owner rather than disposal
by every client. The current shutdown limitations above mean `await
client.destroy()` alone is insufficient proof that all service users stopped.
Background service tasks need their own stop/drain contract. Treat these as
application design requirements until framework lifecycle support is designed.

### Restart hydration versus shared writers

A local file snapshot can suit small, infrequently changed settings for a single
deployment with a persistent volume. Hydrate and validate versioned data before
accepting work; represent IDs and serializable records, then reconstruct runtime
Collections or services. A snapshot cannot serialize live connections, closures,
or pending work. Define missing/corrupt-file recovery, migrations, and backups.

Serialize writes, use a temporary file plus replacement, and investigate flush
and filesystem guarantees for the actual deployment. Node's
[file APIs](https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options)
warn against overlapping `writeFile()` calls to the same file without awaiting
completion and provide a `flush` option. This does not establish a complete
crash-safe snapshot protocol. Saving only at shutdown loses updates on abrupt
termination; periodic snapshots have a loss window. Two processes loading and
rewriting separate copies can overwrite each other's changes, even if each file
replacement succeeds. A mounted shared file alone supplies no transactional
coordination across shards or machines.

A network backend can instead serve as a shared authority for all shards through
an async service. Hydrating one mutable copy per shard does not maintain that
authority: choose direct authoritative reads, version checks, or an explicit
cache invalidation policy. Restart survival still depends on the backend's
durability configuration. Redis is an example, not a selected dependency: its
[persistence documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
distinguishes snapshots, append-only logging, and disabled persistence, with
different loss windows. Its default asynchronous
[replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
can lose acknowledged writes during failover; replication alone does not
establish strong consistency or durability.

### Atomic operations, expiry, and failures

Prefer domain operations such as `tryAcquire`, `claimTicket`, or
`updateSettings(expectedVersion, change)` over remote `get` followed by `set`.
The adapter must enforce the invariant at the shared authority. Redis illustrates
the distinction through atomic [INCR](https://redis.io/docs/latest/commands/incr/),
conditional [SET](https://redis.io/docs/latest/commands/set/) with expiry, and
[transactions with WATCH](https://redis.io/docs/latest/develop/using-commands/transactions/)
for optimistic concurrency. These mechanisms do not make an arbitrary sequence
of application reads and writes atomic. A local mutex protects only its process.

TTL determines retention, not durability. Persist absolute expiry timestamps
when restoring timed state; elapsed downtime should not reset a cooldown.
Redis [EXPIRE](https://redis.io/docs/latest/commands/expire/) persists expiry as
absolute timestamps and documents clock sensitivity. Applications should decide
whether expired reminders are skipped or caught up after restart, and whether a
cooldown backend outage rejects work or permits it.

Distinguish an absent record from an unavailable backend. Bound waits and retries;
a timeout after sending a mutation can leave its outcome unknown. Retrying a
non-idempotent operation can duplicate an effect, so operations such as ticket
creation or reminder delivery need an application idempotency/reconciliation
policy. Durable state updates and Discord requests are separate effects; this
container cannot promise exactly-once execution across them. These are design
consequences of adding remote operations, not guarantees supplied by Hyperion.

## Decisions and verification before implementation

Confirm whether one schema per TypeScript program is acceptable before choosing
augmentation. Then choose whether an empty store may be omitted and whether the
public name should be `store` or `state`. Keep per-client ownership and explicit
initialization regardless of naming.

Implementation would need isolated runtime tests for shared reference identity
across invocation surfaces, separate clients, failed creation, and reload
retention. Add type cases for missing fields, incorrect value types, access from
each context, and source/packed-consumer augmentation resolution. These are
future checks, not tests executed during this research.

Research validation: read the current client/options, context types, guard and
resolver contracts, cooldown implementation, interaction dispatcher, architecture,
and event lifecycle reference. Inspected the linked official sources and checked
local Markdown link targets. Expanded research to local snapshots and Redis's
documented durability, replication, transactions, and expiry; no adapter was
installed or evaluated. No bot was started, no credentials or private
environment files were read, and no implementation, deployment, or benchmark was
performed.
