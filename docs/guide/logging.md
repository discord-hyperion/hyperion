# Logging

Hyperion logs what it's doing (loading handlers, deploying commands, running
interactions) and gives you a logger that's already tagged with the right
details.

## Logging from a handler

Every handler gets `ctx.logger`:

```ts fragment
async run(ctx: CommandContext) {
    ctx.logger.debug({ step: "lookup" }, "Looking up results");
    await ctx.interaction.reply("Pong!");
}
```

Each log line already includes the command (or button, menu, modal), the
interaction ID, the server, and the user, so you can follow one interaction
through the logs even when lots run at once. For messages that aren't about an
interaction, use `client.logger`.

The logger is [Pino](https://getpino.io), so it works the way Pino's does: a
method per level, with an optional object of extra fields first.

## Configuring it

All of this is optional:

```ts fragment
const client = await HyperionClient.create({
    // …
    logging: {
        level: "debug", // default: "info"
        pretty: true, // coloured output instead of JSON
        progress: true, // startup spinners
    },
});
```

In a terminal you get coloured logs and spinners by default. In CI or when
piping output, you get JSON and no spinners. `logging: false` turns everything off.

To send logs somewhere else, pass `destination`: any object with a
`write(line)` method.

## Keep secrets out

Hyperion never logs tokens, message content, option values, selected values, or
form fields, and keeps the data in custom IDs out of logs too. Do the same in
your own log lines and error messages, since errors end up in the logs.

## Seeing more

Set `level: "debug"` to see each guard pass, each handler start, and custom IDs
that matched a route but couldn't be decoded. The full list of events lives in
the [logging reference](../logging.md).
