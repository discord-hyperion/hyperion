# @hyperion/core

Hyperion is a TypeScript framework for Discord bots using discord.js v15.
You define commands, components, events, and guards with functions, and it
discovers them, deploys your commands, and types every interaction context.

```ts
import { defineCommand } from "@hyperion/core";
import { ChatInputCommandBuilder } from "@discordjs/builders";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("ping")
        .setDescription("Check whether the bot is responding."),
    run: async ctx => {
        await ctx.interaction.reply("Pong!");
    },
});
```

Use Node.js 24.17.0 or newer and the exact discord.js and @discordjs/builders
prereleases declared as peers in this package. The initial TypeScript consumer
verification baseline is 7.x. Minimum-version checks are required before release.

The published package exposes its root entry point as ESM JavaScript with
TypeScript declarations. CommonJS callers can use dynamic import. Workspace
development resolves TypeScript source directly through tsx without a build.

See the [guide](https://hyperion-docs-6h7.pages.dev) to get started.
