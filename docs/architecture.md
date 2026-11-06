# Framework architecture

This guide holds the implementation constraints shared across subsystems. Use
the [glossary](GLOSSARY.md) for terminology and the
[feature backlog](features.md) for deferred work. Folder presence alone does not
indicate that a feature is implemented.

## Package boundaries

The pnpm workspace contains `@hyperion/core` in `packages/core`, the independent
`@hyperion/jsx` authoring package in `packages/jsx`. Shared tooling, documentation,
and interaction mocks stay at the root. Add future utility or plugin packages when they have a
concrete responsibility.

JSX implementation lives in `packages/jsx/lib`, with its own public root and
compiler runtime exports. It depends on native builders rather than core; see
[JSX authoring](jsx.md). Applications can consume both packages.

Framework responsibilities remain split across `client`, `commands`, `components`,
`contexts`, `guards`, `events`, `registries`, `execution`, `logging`, and `util`.
Each folder has an `index.ts` barrel; expose public APIs through
`packages/core/src/index.ts`. The bot consumes the public `@hyperion/core` export
through a workspace dependency. Local exports resolve source directly, so tsx
development requires no compilation. Internal imports use relative `.ts` paths;
repository-only TypeScript path aliases are unnecessary.

Framework tests live in `packages/core/tests` and `packages/jsx/tests`.
Shared interaction mocks live in `tests/fixtures`. Root
TypeScript settings are inherited by package configs. Run `pnpm typecheck`,
`pnpm test`, and `pnpm check` from the root. See [package development](package-development.md)
for release builds, publication exports, and isolated consumer verification.

## Client lifecycle

`HyperionClient` extends Discord's `Client` and has a private constructor. Callers
await `HyperionClient.create(options)` before accessing initialized registries.
Initialize registry properties in the constructor instead of concealing lifecycle
gaps with `declare`, definite-assignment assertions, or `Reflect.set()`.

Initialization failures reject the factory and destroy the local client.
`destroy()` first removes the interaction dispatcher's listener, so no new
interactions dispatch; interactions already dispatching are not awaited. Event
handlers drain as described in [event handlers](event-handlers.md#shutdown). Login
is separate from initialization and command deployment; additional network
activity must be an explicit part of the relevant operation.

## Discovery and registration

Resolve fixed handler directories under `<root>/src`, including `commands`,
`buttons`, `select-menus`, `modals`, and `events`; do not add arbitrary per-handler paths.
The root defaults to the working directory and accepts a path or file URL.

Scan recursively with `node:fs/promises`. Skip declarations, test modules, hidden
entries, and `node_modules`. Skip index barrels except direct parent/group definitions
described in [command paths](command-paths.md). Modules default-export concrete
handler subclasses with public, zero-argument constructors.

Missing handler folders are optional; other filesystem errors propagate. Stage
definitions before replacing registries so failures preserve loaded state.
Command parents, groups, and executable handlers must be replaced atomically together.
Preserve original failures with `cause` and retain source-file context for builder
failures and indexed Discord validation errors.

Shared discovery returns flat module paths. General filename filtering has one
implementation; the command-path classifier alone interprets folder conventions
and decides which indexes define parents/groups. Ordinary barrels are skipped
before import. Internal loading functions share module construction and the
component staging pipeline while command/component registries remain concrete Collections. Event handlers
use a managed registry with private Collections so mutations cannot bypass queue
and listener ownership. See [event handlers](event-handlers.md) for folder names,
priorities, per-event FIFO, one-shot definitions, reloads, and shutdown deadlines.

The live handler, parent, and group Collections remain authoritative. Loading and
registration derive temporary command hierarchies through one grouping function;
there is no persistent second hierarchy or cached registration payload. Current
membership, ordering, and builder changes are read again for each registration.

Use native builders and `toJSON()` for payload validation rather than duplicating
Discord's schema. Keep framework checks for exported classes, executable
handlers, routing names, and duplicates. See [command registration](command-registration.md)
for deployment scope, empty-registry protection, and failure handling, and
[command paths](command-paths.md) for composed parent validation and cleanup.

Complete payload serialization uses `toJSON()` and respects the SDK's global
validator setting, which is enabled by default. Consumers who disable validators
also disable local payload validation; Hyperion does not duplicate those checks
or override that setting. Partial discovery metadata reads use `toJSON(false)`.
Builder-family suitability, routing-metadata consistency, explicit filesystem
definitions, duplicate routes, and empty-deployment protection remain framework
checks. Native payload errors retain their source context and original cause.

## Component templates

Component registries store shared handler definitions, including their optional
**templates** in `builder`. A template is the reusable native builder for a button,
select menu, or modal. The registry keeps this template alongside the routing
and execution definition; each control returned by `build()` is a fresh copy.

`registry.build("literal.id")` copies the template and sets its fixed custom ID.
`registry.build(definition, values)` uses the params definition to encode the
values into a custom ID, then sets it on a fresh template copy. When Discord
returns that ID, the registry matches the route and decodes the values; the
execution pipeline validates them before guards and exposes them in `ctx.params`.
Building does not validate params against their schema or store invocation data.
See [custom-ID params](custom-id-params.md) for encoding and parsing rules.

## Invocation boundaries

Handler definitions are shared; invocation contexts are fresh. Components remain
stateless: application-owned storage handles persistent state and atomic updates.
See the [button](buttons.md), [select-menu](select-menus.md), and [modal](modals.md)
guides for routing, guards, acknowledgment, and response behavior.

Use `client.logger` or `ctx.logger` for structured logging. Preserve configurable
levels, silent mode, JSON output outside interactive terminals, and progress
cleanup after failures. Follow [logging](logging.md) for permitted metadata and
sensitive-data restrictions.
