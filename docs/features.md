# Feature list

## Planned

- [ ] Subcommand groups through `{group}` folders (deferred until after subcommands).
- [ ] Typed custom-ID data exposed through interaction handlers (deferred).
  - Separate handler definitions from visible button builders; handlers must not require a template button.
  - Let commands or shared views create multiple controls, with each custom ID carrying its own data.
  - Declare parameter contracts through handlers and expose validated invocation-local values through `ctx.params`.
  - Support validator-agnostic schemas through Standard Schema, including defaults and transformations.
  - Preserve primitive types, escape delimiters, and enforce Discord's custom-ID length limit without base64.
  - Keep literal custom IDs compatible, validate before guards, and leave unmatched interactions to application listeners.
  - Apply the design across buttons, select menus, and modals without retaining per-message handler state.
- [ ] Reusable typed input validation and transformation.
  - Resolve slash-command options, modal fields, and custom-ID parameters into validated values.
  - Support application-defined resolvers, including asynchronous validation.
  - Distinguish expected validation failures from unexpected errors and provide configurable user-facing responses.
- [ ] Intuitive, declarative embed creation API.
  - Describe embed content, fields, and styling with a typed API that reduces builder boilerplate.
  - Support reusable defaults and templates while retaining access to native Discord builders.
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
