# Feature list

The backlog lists only work that is still open. When a pull request ships or drops
part of an item, it deletes that bullet in the same pull request; when the last
bullet goes, the item moves to [Implemented](#implemented) as one line linking its
reference doc. Reference docs describe what exists; this page never repeats them.
`scripts/check-docs.mjs` checks the shape: every planned item is unticked, and every
implemented item links a reference doc.

## Planned

- [ ] Typed input for more interaction sources.
  - Extract modal controls other than text inputs: string, user, role, mentionable,
    and channel selects, file uploads, radio groups, checkbox groups, and
    checkboxes. They are readable only through native getters today. Decide whether
    schemas receive IDs or resolved objects for entity selects and uploads.
  - Add `input` to select-menu handlers, so `interaction.values` is validated like
    other input.
- [ ] More JSX components.
  - User, role, mentionable, and channel select menus for messages.
  - Premium buttons.
  - Modal controls beyond labels, text inputs, and text displays: selects, file
    uploads, radio groups, and checkboxes. Pairs with the modal input work above.
  - The layout-message `File` component, after attachment handling is designed.
- [ ] Managed interactive collectors.
  - Needs a reason to exist first: a thin wrapper over discord.js collectors adds
    little.
  - Make ownership, timeouts, completion, cancellation, and shutdown cleanup
    explicit, separate from stateless filesystem handlers.
- [ ] Integrated development workflow for generated types (deferred).
  - Generate declarations during setup and before development starts.
  - Watch handler additions, edits, renames, and deletions to keep autocomplete
    synchronized, generating in a fresh process to avoid stale imports.
  - Provide standalone generation for CI without starting or logging in the bot.
  - Scaffold TypeScript inclusion and generated-file exclusions for editors.
  - Produce deterministic output, skip unchanged files, and write atomically.
  - Consider a `hyperion dev` CLI that manages generation, watching, and the bot.
  - Explore statically inspectable handler metadata instead of executing
    constructors.
- [ ] Generated API reference (blocked).
  - Publish symbol-level reference pages for `@hyperion/core` and `@hyperion/jsx`
    beside the guide, generated with TypeDoc.
  - Blocked until TypeDoc supports TypeScript 7; the inspected release allows only
    5.x through 6.0.x. Recheck the upstream tracking issue before starting. See
    [documentation site generators](research/documentation-site-generators.md#typedoc-is-complementary-with-a-ts7-blocker).
  - Decide where the output lives; a separate API prefix on the guide site is the
    least integration. The guide stays the home for explanation.

## Implemented

- Chat-input commands, subcommands, and deployment. See
  [command registration](command-registration.md) and [command paths](command-paths.md).
- Subcommand groups. See [subcommand groups](subcommand-groups.md).
- Context-menu commands with typed lookup. See
  [context-menu commands](context-menu-commands.md).
- Autocomplete routing. See [autocomplete](autocomplete.md).
- Button, select-menu, and modal handlers with templates and `build()`. See
  [buttons](buttons.md), [select menus](select-menus.md), and [modals](modals.md).
- Typed custom-ID params. See [custom-ID params](custom-id-params.md).
- Guards through `defineGuard()`. See [guards](guards.md).
- Typed input for commands and modal text inputs, with async resolvers. See
  [typed command input](input-validation.md) and
  [modal input validation](modal-input-validation.md).
- Filesystem event handlers. See [event handlers](event-handlers.md).
- Logging. See [logging](logging.md).
- `@hyperion/jsx`: embeds, text, buttons, string selects, modals, and layout
  messages. See [JSX authoring](jsx.md),
  [message components](jsx-message-components.md),
  [select menus](jsx-select-menus.md), [modals](jsx-modals.md), and
  [layout messages](jsx-layout.md).
