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
- Initialization: final command count and duration.
- Login: start, completion, or failure. Client readiness is a separate event;
  command deployment and login remain separate operations.
- Command execution: debug start, info completion, or error failure, including
  duration. Missing handlers emit warnings. Failed error responses emit errors.

Progress indicators cover command loading, application-command registration, and
login. Runtime handlers do not display spinners automatically.

## Handler logging

Use the scoped logger provided with each command invocation:

```ts
public override async run(ctx: CommandContext): Promise<void> {
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
