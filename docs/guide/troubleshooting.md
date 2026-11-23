# Troubleshooting

Hyperion validates your handlers during `HyperionClient.create()`, so most configuration mistakes fail at startup. In the messages below, `"..."` represents a file path, command name, or value from your project. When an error starts with `"Failed to load"`, the underlying cause follows the colon or appears under `[cause]`.

## Startup and commands

### Commands did not deploy ("No commands found; skipping deployment")

During `HyperionClient.create()`, Hyperion skips deployment instead of throwing when `options.commands` is omitted or `<root>/src/commands/` is missing or empty. This most often happens when `root` defaults to `process.cwd()` and you launch the bot from a different directory. Set `root` explicitly relative to your entry file:

```ts fragment
const client = await HyperionClient.create({
    root: new URL("./", import.meta.url),
    // ...
});
```

Confirm that `commands` is configured and that your command files live under `src/commands/` next to that entry file. Set `logging: { level: "debug" }` to print the exact directories Hyperion scans.

### No commands were found; refusing to overwrite commands with an empty list.

This throws when you call `client.commands.register()` directly while the command registry is empty—either `client.commands.load()` was never called, or `root` pointed at a directory with no command files. Load commands first and verify `root` points at the directory containing `src/commands/`. See [Deploying](commands.md#deploying).

### Expected a default export from define...().

Every file inside a handler folder must default-export the result of the matching `define*()` function, such as `defineCommand()` in `src/commands/`. Named exports, missing `export default` statements, helper files placed inside a handler folder, or subcommand mismatches (such as using `defineCommand()` inside a `[parent]` folder instead of `defineSubcommand()`, or in `[parent]/index.ts` instead of `defineParentCommand()`) all trigger this error. Move shared helpers to a separate directory such as `src/lib/`.

### Duplicate command name "..." in "...".

Two command files register the same command name. Standalone commands and subcommands take their Discord name from `.setName()` on the builder rather than from the filename, so copying an existing file without updating `.setName()` causes this error.

### Invalid command folder "..."; use (category), [parent], or {group}.

A subfolder under `src/commands/` has empty, mismatched, or malformed delimiters (such as `()`, `[ticket)`, or `foo[bar]`). Use `(category)` (or a plain unmarked folder name) for command categories, `[parent]` for parent commands, or `{group}` for subcommand groups. See [Folder convention](commands.md#folder-convention).

### Missing parent definition for "..." (referenced by "...").

A `[parent]` folder contains subcommands without a `[parent]/index.ts` file exporting `defineParentCommand()`. The sibling error `Missing group definition for "..." (referenced by "...").` means a `{group}` folder is missing `{group}/index.ts` exporting `defineSubcommandGroup()`. Add the missing `index.ts` definition; see [Subcommands](commands.md#subcommands).

### Parent commands cannot define options or subcommands directly.

A parent builder in `[parent]/index.ts` called `addSubcommands()` or added options directly. Keep the parent builder to top-level metadata only and put each subcommand in its own `defineSubcommand()` file under `[parent]`. The sibling error `Parent builder name "..." must match folder name "...".` occurs when `.setName()` on a parent builder disagrees with the `[parent]` folder name. See [Subcommands](commands.md#subcommands).

### Failed to register application commands at "...": ...

Discord rejected the command deployment request; the text after the colon is Discord's error message. For invalid command definitions, Hyperion appends `body[N]: "<name>" (<file>)` lines pointing to the offending file. Verify that `token` and `applicationId` belong to the same application, and if Discord returns `Missing Access` for a guild, re-invite the bot to that server with the `applications.commands` scope.

## Components

### Button handlers with a template take its custom ID; remove customId.

The handler specifies both `builder` and `customId`. Remove `customId` so the template's custom ID is used. The same rule applies to select menus and modals, as does the sibling error `... handlers accept either a customId or params, not both.`

### Button templates need the params route "..." as their custom ID.

A handler using [custom-ID params](custom-ids.md) must set its template's custom ID to the route via `.setCustomId(definition.id)`. If the template uses a different custom ID, Hyperion throws `... template custom ID "..." doesn't match the params route "..."` instead.

### Button custom IDs must not exceed 100 characters.

Discord limits custom IDs to 100 characters. Shorten the static custom ID, or shorten the params route and values. The related error `Custom ID for "..." exceeds 100 characters.` throws when `build()` or a params encoder generates a string over 100 characters.

## Events

### Duplicate priority ... for event "..." in "..." and "...".

Two handlers for the same event share the same numeric filename prefix. Prefixes parse as integers, so `01-a.ts` and `1-b.ts` collide as priority `1`. Change one of the numbers; gaps are allowed. See [Order](events.md#order).

### Event handler "..." must be inside a folder named after a Discord client event.

Place event files inside a top-level folder under `src/events/` matching the exact discord.js event name and casing, such as `src/events/messageCreate/` rather than `src/events/message-create/` or directly inside `src/events/`.

### Event handler is for "..." but is in the "..." folder.

The `event` option passed to `defineEvent()` does not match the top-level event folder under `src/events/`. Move the file into the matching event folder or update the `event` option.

## SQLite

### A "..." row failed validation: ...

A `@hyperion-js/sqlite` table read or write failed its schema, and nothing was written. If a SQLite column can be empty, mark that property nullable because SQLite returns `null` rather than `undefined`. Key-value namespaces throw the sibling error `The "..." value for "..." failed validation: ...`, and async schemas throw `... uses a schema that validates asynchronously; @hyperion-js/sqlite needs a synchronous schema.` See [SQLite](sqlite.md).

### ... isn't a safe integer.

A JavaScript number passed to SQLite exceeded `Number.MAX_SAFE_INTEGER`, almost always a Discord snowflake ID. Store IDs in `TEXT` columns and pass them as strings.

## Runtime

### Input defer: "update" needs an interaction from a message, such as a component or a modal it opened.

A modal handler configured with `input: { defer: "update" }` was opened from a slash command instead of a button or select menu, so there is no source message to update. Switch to `defer: true`, or omit `defer` and branch on `ctx.interaction.isFromMessage()` in `run()`. See [Modals](modals.md#showing-the-modal) and [Deferring before validation](input.md#deferring-before-validation).

### "This interaction failed" in Discord

Discord displays this message when an interaction is not acknowledged within three seconds. Check these causes:
- **Unmatched custom ID:** Hyperion ignores unmatched component custom IDs. Verify the custom ID matches exactly, and for `params` handlers make sure you built the control with `build(def, values)` or the params encoder rather than sending the template directly (`logging: { level: "debug" }` logs `*.params.undecodable` on segment-count mismatches).
- **Mismatched select-menu type:** A select-menu handler's `componentType` does not match the menu sent, leaving the interaction unmatched.
- **Unanswered `onFail()`:** A guard's custom `onFail()` returned without replying. See [Custom rejection replies](guards.md#custom-rejection-replies).
- **Late acknowledgment:** Your handler did slow work before replying, updating, or deferring. See [Responding and automatic deferring](how-hyperion-works.md#responding-and-automatic-deferring).
