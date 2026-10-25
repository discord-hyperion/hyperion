# Feature list

## Planned

- [ ] Integrated development workflow for generated types (deferred).
  - Generate declarations during project setup and before development starts.
    - Watch handler additions, edits, renames, and deletions to keep autocomplete synchronized.
    - Run generation in a fresh worker or process to avoid stale module imports.
    - Provide standalone type generation for CI without starting or logging in the bot.
    - Scaffold TypeScript inclusion and generated-file exclusions for editor tooling.
    - Produce deterministic output, skip unchanged files, and write updates atomically.
    - Consider a `hyperion dev` CLI that manages generation, watching, and the bot process.
    - Explore statically inspectable handler metadata as an alternative to executing constructors.
