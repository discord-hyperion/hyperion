# Hyperion guide

Hyperion is a framework for building Discord bots with discord.js v15. You put
commands, buttons, menus, modals, and event handlers in folders, and Hyperion
loads them, deploys your commands, and routes every interaction to the right
place. You write the parts that make your bot yours.

New here? Start with [getting started](getting-started.md), then pick whatever
your bot needs next.

## Basics

- [Getting started](getting-started.md): create a client and your first command.
- [Commands](commands.md): slash commands, subcommands, and context menus.
- [Responding](responding.md): replying, deferring, and what happens on errors.

## Interactions

- [Buttons](buttons.md)
- [Select menus](select-menus.md)
- [Modals](modals.md)
- [Data in custom IDs](custom-ids.md): one handler for many buttons, each with its own data.
- [Autocomplete](autocomplete.md)

## Validation

- [Guards](guards.md): checks that run before your handler.
- [Typed input](input.md): validate command options and form fields with a schema.

## Everything else

- [Events](events.md): react to Discord events like `messageCreate`.
- [Logging](logging.md)

## Packages

Optional packages that work with any discord.js bot, and fit Hyperion well.
- [JSX](jsx.md): embeds, buttons, layout messages, and forms as JSX.
  [JSX with Hyperion](jsx-with-hyperion.md) keeps them as handler templates.
- [SQLite](storing-data.md): keep data in SQLite with validated tables and
  key-value namespaces.

## How-to

- [Asking before deleting something](confirm-before-acting.md): a confirm button
  only the right person can press.
- [Keeping cooldowns across restarts](persistent-cooldowns.md): a cooldown guard
  backed by SQLite.

## When something breaks

- [Troubleshooting](troubleshooting.md): startup errors and what they mean.

Looking for exact contracts, edge cases, or how something is implemented? The
reference docs one folder up (`docs/*.md`) cover every detail.
