# @hyperion/core

Hyperion is a TypeScript framework for Discord bots using discord.js v15.
It provides class-based commands, components, guards, discovery, and typed
interaction contexts.

```ts
import { Command, type CommandContext } from "@hyperion/core";
import { ChatInputCommandBuilder } from "@discordjs/builders";

export default class extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong!");
    }
}
```

Use Node.js 24.17.0 or newer and the exact discord.js and @discordjs/builders
prereleases declared as peers in this package. The initial TypeScript consumer
verification baseline is 7.x. Minimum-version checks are required before release.

The published package exposes its root entry point as ESM JavaScript with
TypeScript declarations. CommonJS callers can use dynamic import. Workspace
development resolves TypeScript source directly through tsx without a build.

See the [guide](https://hyperion-docs-6h7.pages.dev) to get started.
