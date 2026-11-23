# Logging

Hyperion logs lifecycle events—loading handlers, deploying commands, and executing interactions—to `stderr` by default, and attaches a scoped logger to every handler context.

## Logging inside handlers

Every command, component, and event handler receives `ctx.logger`. Hyperion uses [Pino](https://getpino.io): call `debug`, `info`, `warn`, or `error` with an optional metadata object first and the message second, and pass thrown errors under the `err` key so Hyperion's error serializer formats the type, message, stack, and up to three levels of `cause`:

```ts fragment
run: async ctx => {
    ctx.logger.debug({ step: "lookup" }, "Looking up results");

    try {
        await ctx.interaction.reply("Pong!");
    } catch (err) {
        ctx.logger.error({ err }, "Failed to send reply");
    }
},
```

`ctx.logger` attaches identifying metadata automatically so you can trace concurrent executions:

| Handler type                                                                 | Automatic metadata fields                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Interaction handlers (commands, buttons, select menus, modals, autocomplete) | Handler identity (`command` + optional `group`/`subcommand`, `button`, `selectMenu`, or `modal`), `interactionId`, `guildId`, `userId` |
| Event handlers                                                               | `eventName`, `source`, `priority`                                                                                                      |

For logs outside a handler, use `client.logger`.

## Configuration

Logging configuration is optional:

```ts fragment
const client = await HyperionClient.create({
    // ...
    logging: {
        level: "debug",
        pretty: true,
        progress: true,
    },
});
```

| Option        | Default                         | Purpose                                                                                            |
| ------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `level`       | `"info"`                        | Minimum log level (`"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"`, or `"silent"`). |
| `pretty`      | `true` in a non-CI `stderr` TTY | Formatted terminal output instead of JSON.                                                         |
| `progress`    | `true` in a non-CI `stderr` TTY | Startup progress spinners. Disabled automatically when a custom `destination` is set.              |
| `destination` | `process.stderr`                | Custom writable target implementing `write(line)`.                                                 |

Logs write to `stderr` by default. In an interactive terminal (`stderr` is a TTY) outside CI, Hyperion enables pretty output and startup spinners; in CI or when `stderr` is piped or redirected, it outputs JSON and disables spinners. Pass `logging: false` or `level: "silent"` to disable logs and spinners without affecting user-facing Discord error replies.

## Sensitive data

Hyperion never logs bot tokens, message content, option values, selected menu values, modal control values, or custom-ID params values. Built-in redaction replaces `token`, `password`, `authorization`, and `secret` keys with `[REDACTED]` at the top level and one level nested. Secrets embedded inside message strings, deeper nested objects, or thrown `Error` messages are still logged, so keep secrets out of log messages and errors.

## Debug logs

Set `level: "debug"` to log discovered handler file paths, skipped missing handler folders at startup, individual guard checks, handler starts, and custom IDs that match a params route but fail to decode. For the complete list of log events and fields, see the [logging reference](../logging.md).
