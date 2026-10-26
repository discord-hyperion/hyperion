# Logging and startup progress

Hyperion uses Pino for structured logs, pino-pretty for readable terminal output,
and Ora for startup spinners. Configuration is optional:

```ts
const client = await HyperionClient.create({
    // Other client options...
    logging: {
        level: "debug",
        pretty: true,
        progress: true,
    },
});
```

The default level is `info`. Interactive terminals outside CI get coloured,
readable logs and startup spinners. Other environments get JSON logs and no
spinner output. Logs go to stderr by default. Set `pretty: false` to retain JSON
in a terminal, or `progress: false` to disable spinners. `logging: false` or
`level: "silent"` disables logs and progress indicators.

An optional `destination` accepts a Pino-compatible object with a `write(string)`
method. Custom destinations disable startup spinners. Log output is synchronous
at the formatting boundary so progress can clear and redraw around normal logs.
No global console interception or background formatting worker is installed.

## Recorded lifecycle events

- Command loading: start, completion, count, duration, or failure. Debug level
  includes discovered source paths and skipped missing command directories.
- Command registration: start, completion, or failure, plus each deployment's
  route, count, and duration. Empty registries emit a skipped event.
- Initialization: final command, button, select menu, and modal counts and duration.
- Button loading: start, completion, count, duration, or failure. Debug level
  includes discovered source paths and skipped missing button directories.
- Button execution: debug start, info completion or rejection, and error failure.
  Logs carry the registered button ID and invocation metadata. Failed responses
  emit `button.error-response.failed`; unmatched custom IDs are ignored.
- String, user, role, mentionable, and channel select menus: `select-menus.load` startup steps and discovery counts;
  `select-menu.started`, `select-menu.completed`, `select-menu.rejected`, and
  `select-menu.failed` execution events. Invocation logs include `selectMenu`,
  `interactionId`, `guildId`, and `userId`, without logging selected values.
- Modals: `modals.load` startup steps and discovery counts; `modal.started`,
  `modal.completed`, `modal.rejected`, and `modal.failed` execution events.
  Invocation logs include `modal`, `interactionId`, `guildId`, and `userId`,
  without logging submitted values. Failed responses emit
  `modal.error-response.failed`; unmatched custom IDs are ignored.
- Login: start, completion, or failure. Client readiness is a separate event;
  command deployment and login remain separate operations.
- Application ownership: `application.owner.started`, completion, or failure
  when fetching the current bot's personal or team owner. Readiness starts the
  lookup; guards share the request and reuse the cached result for that login.
- Command execution: debug start, info completion, or error failure, including
  duration. Missing handlers emit warnings. Failed error responses emit errors.
- Autocomplete: debug `autocomplete.started`, `autocomplete.completed`, and
  `autocomplete.unavailable`; error `autocomplete.failed` and
  `autocomplete.response.failed`. Invocation logs carry command and interaction
  metadata, never focused input or suggestion values. See
  [autocomplete](autocomplete.md) for fallback behavior.
- Guards: debug `guard.started` and `guard.passed`, info `guard.rejected` and
  `command.rejected`. Guard outcomes include the guard name and check duration.
  Guard errors emit `command.failed` with `stage: "guards"`; handler errors use
  `stage: "handler"`. Guard logs carry the command's invocation metadata.

Progress indicators cover command, button, select menu, and modal loading, application-command registration, and
login. Runtime handlers do not display spinners automatically.

## Handler logging

Use the scoped logger provided with each command invocation:

```ts
async run(ctx: CommandContext) {
    ctx.logger.debug({ checkpoint: "lookup" }, "Looking up results");
    await ctx.interaction.reply("Pong!");
}
```

`ctx.logger` already carries `command`, `interactionId`, `guildId`, and `userId`.
Each invocation receives its own child logger, allowing concurrent executions to
be correlated without mutable state on the command instance. `client.logger` is
also available for application-level messages.

## Error and data handling

Activity and error levels are independent: setting the level to `error` hides
normal activity while retaining failures. Disabling logging entirely does not
disable user-facing error responses. Error records preserve type, message,
stack, and a bounded cause chain; arbitrary properties such as attached request
bodies are excluded.

Hyperion does not log registration credentials, complete options objects, raw
interactions, command arguments, or login return values. Common credential fields
(`token`, `password`, `authorization`, and `secret`) are redacted at the top level
and one object level down. Developers must still avoid embedding secrets in free
text or arbitrary nested application data.

Automated tests use captured log destinations, fake credentials, mocked REST
methods, and a mocked Discord login. They do not load private environment files.
