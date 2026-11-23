# Logging

Hyperion logs lifecycle events such as loading handlers, deploying commands, and executing interactions. It also provides a scoped logger on every handler context.

## Logging inside handlers

Every command, component, and event handler receives `ctx.logger`:

```ts fragment
run: async ctx => {
    ctx.logger.debug({ step: "lookup" }, "Looking up results");
    await ctx.interaction.reply("Pong!");
},
```

Log entries written through `ctx.logger` automatically include the handler name or custom ID, `interactionId`, `guildId`, and `userId`. This lets you trace a single interaction across concurrent logs. For logs outside a handler, use `client.logger`.

Hyperion uses [Pino](https://getpino.io). Call level methods such as `debug`, `info`, `warn`, and `error`, passing an optional metadata object first and the log message second.

## Configuration

Logging configuration is optional:

```ts fragment
const client = await HyperionClient.create({
    // ...
    logging: {
        level: "debug", // Defaults to "info"
        pretty: true, // Formatted terminal output instead of JSON
        progress: true, // Startup progress spinners
    },
});
```

In an interactive terminal, Hyperion enables pretty output and startup spinners by default. In CI or when stdout is piped, Hyperion outputs JSON and disables spinners. Pass `logging: false` to disable logging completely.

To direct log output to a custom stream, pass a `destination` object that implements a `write(line)` method.

## Sensitive data

Hyperion never logs bot tokens, message content, option values, selected menu values, modal field values, or custom ID parameter values. Avoid logging secrets or private user data in your own log calls and error messages, because thrown errors are written to the log.

## Debug logs

Set `level: "debug"` to log individual guard checks, handler starts, and custom IDs that match a params route but fail to decode. For the complete list of log event names and fields, see the [logging reference](../logging.md).
