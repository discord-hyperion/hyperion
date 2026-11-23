# FAQ

## Does Hyperion support prefix message commands?

No. Hyperion does not support prefix-based message commands and has no plans to add them. Reading message content requires the privileged `MessageContent` intent, which Discord restricts past 100 servers, and Discord has standardized on application commands instead.

## Why does Hyperion pin prerelease versions of discord.js v15 and @discordjs/builders?

Hyperion targets discord.js v15 APIs—including layout messages and updated modal controls—that are still in prerelease. Pinning matching dev builds in `peerDependencies` prevents incompatibilities between `discord.js` and `@discordjs/builders` until v15 stabilizes. See [Getting started](getting-started.md).

## Can I mix Hyperion with plain discord.js collectors or event listeners?

Yes. `HyperionClient` extends discord.js's `Client`, so `client.on()`, `client.once()`, and collectors work alongside Hyperion. Unmatched button, select-menu, and modal custom IDs are ignored silently by Hyperion, and `client.destroy()` detaches only Hyperion's own listeners—just avoid handling the same custom ID or `interactionCreate` interaction in both places. See [Unmatched interactions](how-hyperion-works.md#unmatched-interactions) and [Handling interactions](events.md#handling-interactions).

## Does Hyperion load .env files or compile TypeScript?

Neither. Pass environment variables with Node's `--env-file=.env` flag or your host environment, and run TypeScript directly with `tsx` or compile ahead of time with `tsc`. Hyperion discovers `.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`, `.cjs`, and `.jsx` files; point `root` at either your source or compiled output, not both. See [Getting started](getting-started.md).

## Can I use @hyperion-js/jsx or @hyperion-js/sqlite without @hyperion-js/core?

Yes. Both packages are independent of `@hyperion-js/core`: `@hyperion-js/jsx` depends only on `@discordjs/builders` and `@discordjs/formatters` for any discord.js v15 bot, and `@hyperion-js/sqlite` depends only on `better-sqlite3` and `@standard-schema/spec` for any Node.js app. See [JSX](jsx.md) and [SQLite](sqlite.md).

## Does Hyperion support hot-reloading handlers?

Partially. Hyperion has no file watcher or full module-graph HMR. For event handlers, `await client.events.load()` re-imports changed handler entry files from disk (shared imported helpers stay cached by Node's ESM loader, and `once: true` handlers rearm). Commands, buttons, select menus, and modals are loaded without cache-busting—restart the process (for example with `tsx watch` in development) when editing them. See [Reloading event handlers](events.md#reloading-event-handlers).
