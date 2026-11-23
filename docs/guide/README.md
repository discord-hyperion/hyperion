# Intro

Hyperion is a TypeScript framework for building Discord bots with discord.js v15. Put your commands, buttons, select menus, modals, and event handlers in folders, and Hyperion loads them, deploys your commands, and routes incoming interactions.

Hyperion is in beta until discord.js v15 reaches a stable release. Expect breaking changes between versions until 1.0.

Start with [Getting started](getting-started.md), then read the pages for the features your bot uses.

## Basics

- [Getting started](getting-started.md). Create a client and write your first command.
- [How Hyperion works](how-hyperion-works.md). Understand startup discovery and deployment, the interaction pipeline, responding, and error handling.
- [Commands](commands.md). Define slash commands, subcommands, and context menus.

## Interactions

- [Buttons](buttons.md). Handle button clicks and reuse button templates.
- [Select menus](select-menus.md). Handle string, user, role, mentionable, and channel menus.
- [Modals](modals.md). Show forms and validate submitted modal controls.
- [Data in custom IDs](custom-ids.md). Pass typed data through a control's custom ID.
- [Autocomplete](autocomplete.md). Return dynamic option suggestions while a user types.

## Validation

- [Guards](guards.md). Run permission, ownership, and rate-limit checks before a handler executes.
- [Typed input](input.md). Validate command options, select menus, and modal controls with a schema.

## Events & logging

- [Events](events.md). Run ordered handlers for Discord client events such as `messageCreate`.
- [Logging](logging.md). Configure Pino logging and use the scoped `ctx.logger`.

## Packages

These optional packages work with any discord.js bot, with or without `@hyperion-js/core`.
- [JSX](jsx.md). Write embeds, buttons, select menus, layout messages, and modals as JSX. See [JSX with Hyperion](jsx/with-hyperion.md) for using JSX with Hyperion handlers.
- [SQLite](sqlite.md). Store data in SQLite with schema-validated tables and key-value namespaces.

## Mini-guides

- [Confirming destructive actions](confirm-before-acting.md). Send a delete confirmation button that only the original user can click.
- [Keeping cooldowns across restarts](persistent-cooldowns.md). Build a cooldown guard backed by SQLite.

## Help

- [Troubleshooting](troubleshooting.md). Startup errors, runtime issues, and how to fix them.
- [FAQ](faq.md). Answers to common adoption and architecture questions.
