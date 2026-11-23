# Troubleshooting

Hyperion validates your handlers during `HyperionClient.create()`, so most configuration mistakes fail at startup with an error describing what went wrong. In the messages below, `"..."` represents a file path, command name, or value from your project. When an error starts with "Failed to load", the underlying reason follows the colon or appears under `[cause]`.

## No commands were found; refusing to overwrite commands with an empty list.

Hyperion found no command files and refused to deploy an empty list, which would remove your existing commands from Discord. This usually happens when `root` defaults to the current working directory and you start the bot from a different folder. Set `root` explicitly to your entry file's directory:

```ts fragment
const client = await HyperionClient.create({
    root: new URL("./", import.meta.url),
    // ...
});
```

Confirm that your command files are inside `src/commands/` next to that entry file.

## Expected a default export from define...().

Every file inside a handler folder must default-export the result of the matching `define*()` function, such as `defineCommand()` in `src/commands/`. Named exports, missing `export default` statements, or non-handler helper files placed inside a handler folder all trigger this error. Move shared helpers to a separate directory such as `src/lib/`.

## Duplicate command name "..." in "...".

Two command files register the same command name. Discord command names come from `.setName()` on the builder, not from the filename, so copying an existing command file without updating `.setName()` causes this error.

## Invalid command folder "..."; use (category), [parent], or {group}.

Every subfolder under `src/commands/` must use one of the three delimiter styles: `(category)` for categories, `[parent]` for parent commands, or `{group}` for subcommand groups. See [Folder convention](commands.md#folder-convention).

## Button handlers with a template take its custom ID; remove customId.

The handler specifies both `builder` and `customId`. Because the template's custom ID becomes the handler's custom ID, remove `customId`. The same rule applies to select menus and modals.

## Button templates need the params route "..." as their custom ID.

A handler that uses [custom ID params](custom-ids.md) must set its template's custom ID to the params route via `.setCustomId(definition.id)`. If the template uses a different custom ID, Hyperion throws `... template custom ID "..." doesn't match the params route "..."` instead.

## Button custom IDs must not exceed 100 characters.

Discord limits custom IDs to 100 characters. Shorten the static custom ID, or shorten the params route and values. The related error `Custom ID for "..." exceeds 100 characters.` occurs when `build()` or a params function encodes a custom ID longer than 100 characters.

## Duplicate priority ... for event "..." in "..." and "...".

Two handlers in the same event folder share the same numeric filename prefix. Change one of the numbers. Gaps between numbers are allowed. See [Events](events.md#order).

## Event handler "..." must be inside a folder named after a Discord client event.

Place event handler files inside a folder whose name matches the exact discord.js event name and casing, such as `src/events/messageCreate/` rather than `src/events/message-create/`.

## Event handler is for "..." but is in the "..." folder.

The `event` option passed to `defineEvent()` does not match the parent folder name. Move the file into the matching event folder or update the `event` option.

## Failed to register application commands at "...": ...

Discord rejected the command deployment request, and the text after the colon is Discord's error message. Verify that `token` and `applicationId` belong to the same Discord application and that the bot is a member of every server listed in `guildIds`.

## A "..." row failed validation: ...

A `@hyperion-js/sqlite` read or write failed its table schema, and nothing was written. The schema validation issues follow the colon. If a SQLite column can be empty, mark that field nullable in your schema because SQLite returns `null` rather than `undefined`. See [SQLite](storing-data.md).

## ... isn't a safe integer.

A JavaScript number passed to SQLite exceeded `Number.MAX_SAFE_INTEGER`. This almost always happens with Discord snowflake IDs. Store IDs in `TEXT` columns and pass them as strings.

## "This interaction failed" in Discord

Discord displays this message when your bot does not acknowledge an interaction within three seconds. Because Hyperion ignores custom IDs that do not match a registered handler, check these two things:
- The control's custom ID matches the handler's custom ID exactly. For params handlers, construct the control with `build()` or the params function so the route and values are encoded properly.
- Your handler replies, updates, or defers before slow work finishes. See [Responding](responding.md).
