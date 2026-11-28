# Feature list

The backlog lists only work that is still open. When a pull request ships or drops
part of an item, it deletes that bullet in the same pull request; when the last
bullet goes, the item moves to [Implemented](#implemented) as one line linking its
guide page. The implementation is the source of truth; this page never repeats it.
`scripts/check-docs.mjs` checks the shape: every planned item is unticked, and every
implemented item links a guide page.

## Planned

- [ ] More JSX components.
  - Premium buttons.
  - Radio groups, checkbox groups, and checkboxes for modals (blocked: the pinned
    `@discordjs/builders` has no builders for them yet). Core modal input already
    extracts them.
  - The layout-message `File` component, after attachment handling is designed.
- [ ] Integrated development workflow for generated types (deferred).
  - Generate declarations during setup and before development starts.
  - Watch handler additions, edits, renames, and deletions to keep autocomplete
    synchronized, generating in a fresh process to avoid stale imports.
  - Provide standalone generation for CI without starting or logging in the bot.
  - Scaffold TypeScript inclusion and generated-file exclusions for editors.
  - Produce deterministic output, skip unchanged files, and write atomically.
  - Consider a `hyperion dev` CLI that manages generation, watching, and the bot.
    Reload by restarting a child process, as `tsx watch` does, not by
    re-importing modules: Node's ESM cache can't evict, so cache-busting imports
    leak, refresh only entry files, and break constructor identity on deeper
    refreshes.
  - Explore statically inspectable handler metadata instead of executing
    handler modules.
- [ ] Generated API reference (blocked).
  - Publish symbol-level reference pages for `@hyperion-js/core` and `@hyperion-js/jsx`
    beside the guide, generated with TypeDoc.
  - Blocked until TypeDoc supports TypeScript 7; the inspected release allows only
    5.x through 6.0.x. Recheck the upstream tracking issue before starting.
  - Decide where the output lives; a separate API prefix on the guide site is the
    least integration. The guide stays the home for explanation.

## Implemented

- Chat-input commands, subcommands, subcommand groups, context-menu commands,
  and deployment that skips unchanged commands. See [commands](guide/commands.md).
- Autocomplete routing. See [autocomplete](guide/autocomplete.md).
- Button, select-menu, and modal handlers with templates and `build()`; a
  template's custom ID is its handler's. See
  [buttons](guide/buttons.md), [select menus](guide/select-menus.md), and
  [modals](guide/modals.md).
- Typed custom-ID params. See [custom IDs](guide/custom-ids.md).
- Guards through `defineGuard()`, with built-in owner, server, permission,
  cooldown, and param-owner guards. See [guards](guide/guards.md).
- Typed input for commands, every modal control, and select menus, with async
  resolvers. See [typed input](guide/input.md).
- Filesystem event handlers. See [events](guide/events.md).
- Logging. See [logging](guide/logging.md).
- `@hyperion-js/jsx`: embeds, text, buttons, all five select menus, modals with
  selects and file uploads, and layout messages. See [JSX](guide/jsx.md),
  [embeds](guide/jsx/embeds.md),
  [message components](guide/jsx/message-components.md),
  [modals](guide/jsx/modals.md), and
  [layout messages](guide/jsx/layout-messages.md).
- `@hyperion-js/sqlite`: validated table helpers, `sql` queries, transactions,
  key-value namespaces, and migrations over `better-sqlite3`. See
  [SQLite storage](guide/sqlite.md).
