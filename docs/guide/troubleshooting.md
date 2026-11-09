# Troubleshooting

Hyperion checks your handlers while `create()` runs, so most mistakes stop the
bot at startup with a message saying what's wrong. Find yours below. Messages
that name a file show it as `"…"` here. When an error starts with "Failed to
load", the real reason follows the colon, or is printed under it as `[cause]`.

## No commands were found; refusing to overwrite commands with an empty list.

Hyperion didn't find any command files, and deploying an empty list would
delete every command you have. Usually it's looking in the wrong folder: the
root defaults to the working directory, so starting the bot from elsewhere
misses your `src`. Point it at your entry file's folder:

```ts fragment
const client = await HyperionClient.create({
    root: new URL("./", import.meta.url),
    // …
});
```

Check your commands are under `src/commands` next to that file.

## Expected a default export from define…().

A handler file has to `export default` what the right define function returns
for its folder, such as `defineCommand()` in `src/commands`. A named export, a
forgotten `export default`, or a helper file sitting in a handler folder all
cause this. Move helpers somewhere else, such as `src/lib`.

## Duplicate command name "…" in "…".

Two files define a command with the same name. The name comes from the builder,
not the file name, so a copied file with an unchanged `.setName()` is the usual
culprit.

## Invalid command folder "…"; use (category), [parent], or {group}.

Every folder under `src/commands` needs one of three wrappers: round brackets
for a category, square for a parent command, or curly for a subcommand group.
See [organising with folders](commands.md#organising-with-folders).

## Button handlers with a template take its custom ID; remove customId.

You gave a handler both `builder` and `customId`. The template's custom ID is
the handler's, so delete `customId`. The same goes for select menus and modals.

## Button templates need the params route "…" as their custom ID.

A handler with [params](custom-ids.md) needs its template to carry the params
route: `.setCustomId(definition.id)`. A different ID gives
`… template custom ID "…" doesn't match the params route "…".` instead.

## Button custom IDs must not exceed 100 characters.

Discord caps custom IDs at 100 characters. Shorten the ID, or for params,
shorten the route or the values; `Custom ID for "…" exceeds 100 characters.`
means `build()` or the params definition produced one that's too long.

## Duplicate priority … for event "…" in "…" and "…".

Two handlers for the same event start with the same number. Renumber one; gaps
are fine. See [events](events.md#order).

## Event handler "…" must be inside a folder named after a Discord client event.

Event files go in a folder named exactly after the discord.js event, with its
casing: `src/events/messageCreate/`, not `src/events/message-create/`.

## Event handler is for "…" but is in the "…" folder.

A handler's `event` has to match the folder it's in. Move the file, or change
`event` to the folder's event.

## Failed to register application commands at "…": …

Discord refused the deployment, and the text after the colon is its answer.
Check that the token and application ID belong to the same application, and
that the bot was invited to each server in `guildIds`.

## A "…" row failed validation: …

A `@hyperion-js/sqlite` write or read didn't match the table's schema, and nothing
was written. The schema's messages follow the colon. If a column can be empty,
make its schema nullable: SQLite gives back `null`, not `undefined`. See
[storing data](storing-data.md).

## … isn't a safe integer.

A number was too big to store exactly, almost always a Discord ID. Store IDs as
`TEXT` and keep them as strings.

## "This interaction failed" in Discord

Discord shows this when your bot doesn't respond within three seconds. Hyperion
leaves any custom ID it has no handler for alone, so check:
- The custom ID matches the handler's exactly. For params, the button has to
  come from `build()` or the definition, so the values are encoded.
- The handler responds, or defers first if its work takes longer. See
  [responding](responding.md).
