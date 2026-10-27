# Framework architecture

This guide holds the implementation constraints shared across subsystems. Use
the [glossary](GLOSSARY.md) for terminology and the
[feature backlog](features.md) for deferred work. Folder presence alone does not
indicate that a feature is implemented.

## Package boundaries

Keep one package with shared root dependencies until a concrete multi-package
requirement arises. Framework source lives in `src`; the consuming development
bot lives in `dev/bot` and sets that directory as its root.

Framework responsibilities are split across `client`, `commands`, `components`,
`contexts`, `guards`, `events`, `registries`, `execution`, `logging`, and `util`.
Each framework folder has an `index.ts` barrel; expose public APIs through
`src/index.ts`. Examples consume the public `@hyperion` entry point. Internal
relative imports avoid making consumers depend on repository-only aliases.
Keep `tsconfig.json` folder aliases synchronized with the layout.

## Client lifecycle

`HyperionClient` extends Discord's `Client` and has a private constructor. Callers
await `HyperionClient.create(options)` before accessing initialized registries.
Initialize registry properties in the constructor instead of concealing lifecycle
gaps with `declare`, definite-assignment assertions, or `Reflect.set()`.

Initialization failures reject the factory and destroy the local client. Login
is separate from initialization and command deployment; additional network
activity must be an explicit part of the relevant operation.

## Discovery and registration

Resolve fixed handler directories under `<root>/src`, including `commands`,
`buttons`, `select-menus`, and `modals`; do not add arbitrary per-handler paths.
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

Use native builders and `toJSON()` for payload validation rather than duplicating
Discord's schema. Keep framework checks for exported classes, executable
handlers, routing names, and duplicates. See [command registration](command-registration.md)
for deployment scope, empty-registry protection, and failure handling, and
[command paths](command-paths.md) for composed parent validation and cleanup.

## Invocation boundaries

Handler definitions are shared; invocation contexts are fresh. Components remain
stateless: application-owned storage handles persistent state and atomic updates.
See the [button](buttons.md), [select-menu](select-menus.md), and [modal](modals.md)
guides for routing, guards, acknowledgment, and response behavior.

Use `client.logger` or `ctx.logger` for structured logging. Preserve configurable
levels, silent mode, JSON output outside interactive terminals, and progress
cleanup after failures. Follow [logging](logging.md) for permitted metadata and
sensitive-data restrictions.
