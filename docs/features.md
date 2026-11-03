# Feature list

## Implemented

- [x] Independent `@hyperion/jsx` package for native embed, modal, and message component authoring, text
  composition, automatic JSX runtimes, and TSX/JSX handler discovery. See [JSX authoring](jsx.md).

- [x] Filesystem event handlers with typed contexts, filename ordering, per-event
  FIFO queues, one-shot handlers, reloads, and bounded shutdown draining. See
  [event handlers](event-handlers.md).

## Planned

- [ ] Typed custom-ID data exposed through interaction handlers. Buttons, select menus, and the `ParamOwner` guard are implemented; modals and a JSX encoder helper remain. See [custom-ID params](custom-id-params.md).
  - Separate handler definitions from visible button builders; handlers must not require a template button.
  - Let commands or shared views create multiple controls, with each custom ID carrying its own data.
  - Declare parameter contracts through handlers and expose validated invocation-local values through `ctx.params`.
  - Support validator-agnostic schemas through Standard Schema, including defaults and transformations.
  - Preserve primitive types, escape delimiters, and enforce Discord's custom-ID length limit without base64.
  - Keep literal custom IDs compatible, validate before guards, and leave unmatched interactions to application listeners.
  - Apply the design across buttons, select menus, and modals without retaining per-message handler state.
- [ ] Reusable typed input validation and transformation.
  - Chat-input commands and subcommands now support optional Standard Schema-compatible schemas, whole-input resolution after validation, inferred handler input through `defineInput`, and handler-owned validation responses. See [typed command input](input-validation.md).
  - Modal handlers now support text-input schemas, optional whole-input resolution,
    and inferred submission results; see [modal input validation](modal-input-validation.md).
  - Extend validation to additional modal control types and custom-ID parameters.
  - Support application-defined resolvers, including asynchronous validation.
  - Keep expected validation failures separate from unexpected errors across input sources.
- [ ] Guard definitions through `defineGuard()` (under consideration).
  - Match the `defineInput()` and `defineParams()` style: a helper that returns a frozen definition, generic over the context type (`defineGuard<ButtonContext>({ ... })`), defaulting to the command context like `Guard`. A standalone guard has nothing to infer its context from, so inference only helps when the definition names its source (for example `defineGuard({ params: closeTicket, run(ctx) { ... } })`); otherwise supply the context type explicitly.
  - Keep `name`, `description`, `run()`, and optional `onFail()`; allow a parameterized form such as `defineGuard((guildId: string) => ({ ... }))` in place of a class with constructor arguments. A function form needs an explicit `name`, since class guards default it to the class name for logs.
  - Return a `Guard` instance internally. The six `instanceof Guard` checks (command, command-guard freezing, button, select menu, modal, and the guard pipeline) then stay unchanged, instances stay distinguishable from guard factories, and only the authoring surface differs.
  - Guards are constructed in handlers and are not expected to move to filesystem discovery, so they need not follow the handlers' class-only convention. Class-based `Guard` subclasses remain supported for guards with real state, such as `Cooldown`.
  - Convert built-in guards (`OwnerOnly`, `Cooldown`) only if both forms stay supported, and keep guard providers (instances and factories) working for every handler type.
- [ ] Intuitive, declarative embed creation API.
  - Describe embed content, fields, and styling with a typed API that reduces builder boilerplate.
  - Support reusable defaults and templates while retaining access to native Discord builders.
- [ ] Further JSX authoring through `@hyperion/jsx`.
  - Native embeds, modal labels/text inputs/informational text, escaped text composition, reusable components, and TSX/JSX handlers are implemented; see the [JSX guide](jsx.md) and [JSX modals](jsx-modals.md).
  - Action rows, interactive buttons, link buttons, and message string selects are implemented; see
    [JSX message components](jsx-message-components.md) and [JSX select menus](jsx-select-menus.md). Entity selects, premium
    buttons, Components V2 layouts, and additional modal controls remain deferred.
    Standalone text formatting was dropped.
- [ ] Managed interactive collectors.
  - Provide a simple abstraction for creating, tracking, stopping, and cleaning up collectors.
  - Make ownership, timeouts, completion, cancellation, and shutdown cleanup explicit.
  - Keep collector lifecycles separate from stateless filesystem handlers; persistent application state remains application-owned.
- [ ] Integrated development workflow for generated types (deferred).
  - Generate declarations during project setup and before development starts.
    - Watch handler additions, edits, renames, and deletions to keep autocomplete synchronized.
    - Run generation in a fresh worker or process to avoid stale module imports.
    - Provide standalone type generation for CI without starting or logging in the bot.
    - Scaffold TypeScript inclusion and generated-file exclusions for editor tooling.
    - Produce deterministic output, skip unchanged files, and write updates atomically.
    - Consider a `hyperion dev` CLI that manages generation, watching, and the bot process.
    - Explore statically inspectable handler metadata as an alternative to executing constructors.
