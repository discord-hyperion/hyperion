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

## Making it safe

- [Guards](guards.md): checks that run before your handler.
- [Typed input](input.md): validate command options and form fields with a schema.

## Everything else

- [Events](events.md): react to Discord events like `messageCreate`.
- [Logging](logging.md)
- [JSX guide](jsx.md): embeds, buttons, layout messages, and forms as JSX. It
  works with any discord.js bot.
- [JSX with Hyperion](jsx-with-hyperion.md): keep JSX controls and forms as
  handler templates.

Looking for exact contracts, edge cases, or how something is implemented? The
reference docs one folder up (`docs/*.md`) cover every detail.
