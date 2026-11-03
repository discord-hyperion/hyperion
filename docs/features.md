# Feature list

## Implemented

- [x] Independent `@hyperion/jsx` package for native embed, modal, and message component authoring, text
  composition, automatic JSX runtimes, and TSX/JSX handler discovery. See [JSX authoring](jsx.md).

- [x] Filesystem event handlers with typed contexts, filename ordering, per-event
  FIFO queues, one-shot handlers, reloads, and bounded shutdown draining. See
  [event handlers](event-handlers.md).

## Planned

- [x] Typed custom-ID data exposed through interaction handlers. Buttons, select menus, modals, and the `paramOwner()` guard are implemented. JSX controls take encoded IDs directly (`customId={closeTicket(ticket)}`), so no separate JSX encoder helper is planned. See [custom-ID params](custom-id-params.md).
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
  - Extend validation to additional modal control types.
  - Support application-defined resolvers, including asynchronous validation.
  - Keep expected validation failures separate from unexpected errors across input sources.
- [x] Guard definitions through `defineGuard()`. Guards are execution checks defined as frozen definitions rather than classes; the built-ins are `ownerOnly`, `cooldown()`, and `paramOwner()`. See [guards](guards.md) and [ADR 0003](adr/0003-guards-are-definitions-not-classes.md).
- [x] Intuitive, declarative embed creation API. Superseded by `@hyperion/jsx`: `renderEmbed()` and reusable JSX components cover typed, declarative embeds with native builder output. Further message layout work, including Components V2, continues under JSX authoring.
- [ ] Further JSX authoring through `@hyperion/jsx`.
  - Native embeds, modal labels/text inputs/informational text, escaped text composition, reusable components, and TSX/JSX handlers are implemented; see the [JSX guide](jsx.md) and [JSX modals](jsx-modals.md).
  - Action rows, interactive buttons, link buttons, and message string selects are implemented; see
    [JSX message components](jsx-message-components.md) and [JSX select menus](jsx-select-menus.md).
  - Layout messages (Components V2) with containers, sections, text displays, thumbnails, media galleries, separators, headings, and subtext are implemented; see [JSX layout messages](jsx-layout.md). The `File` component remains deferred until attachment handling is designed.
  - Entity selects, premium buttons, and additional modal controls remain deferred.
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
