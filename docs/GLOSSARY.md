# Hyperion

Canonical terminology for Hyperion's commands, interactions, and execution checks.
Usage and configuration examples belong in the feature guides.

## Language

### Commands

**Application command**:
A named action exposed through Discord's slash-command interface or Apps context
menu.
_Avoid_: Message-content command

**Chat-input command**:
An application command invoked through Discord's `/` interface, with named input
options. It can be a standalone action or a parent containing subcommands.
_Avoid_: Context-menu command

**Standalone command**:
A top-level action invoked directly, such as `/ping`, without selecting a subcommand.
_Avoid_: Parent command

**Parent command**:
A top-level command that contains subcommands, such as `ticket` in `/ticket close`.
It is not itself an independently executable action.
_Avoid_: Subcommand, subcommand group

**Subcommand**:
An executable action within a parent command, such as `close` in `/ticket close`.
It has its own description and input options.
_Avoid_: Parent command, subcommand group

**Subcommand group**:
A named collection of subcommands within a parent command, such as `settings` in
`/ticket settings view`. The group is not itself an executable action.
_Avoid_: Category, parent command

**Command category**:
An organizational grouping of command definitions that contributes nothing to
their invocation names.
_Avoid_: Subcommand group, parent command

**Parent definition**:
The metadata and shared execution checks associated with a parent command. It
provides configuration rather than an independently executable action.
_Avoid_: Subcommand handler

**Group definition**:
The metadata and shared execution checks associated with a subcommand group. It
provides configuration rather than an independently executable action.
_Avoid_: Subcommand handler, parent definition

**Context-menu command**:
An application command invoked from Discord's Apps menu on a selected user or
message.
_Avoid_: Chat-input command, message-content command

**User context-menu command**:
A context-menu command whose target is a selected user.
_Avoid_: Message context-menu command

**Message context-menu command**:
A context-menu command whose target is a selected message, rather than text parsed
from a newly sent message.
_Avoid_: Message-content command, user context-menu command

### Components

**Component handler**:
A reusable definition of how a button click, select-menu selection, or modal
submission is processed. It is separate from the visible control or form.
_Avoid_: Button, select menu, modal

**Button**:
An interactive message control that a user clicks to trigger an action.
_Avoid_: Button handler

**Select menu**:
An interactive control for choosing one or more values, users, roles, mentionable
entities, or channels.
_Avoid_: Select-menu handler

**Modal**:
A form presented in response to an interaction, with its submitted values delivered
in a separate interaction.
_Avoid_: Modal handler

**Custom ID**:
An application-defined identifier attached to an interactive control or form to
identify its associated interaction.
_Avoid_: Message ID, command name

### Execution

**Invocation**:
A single request to execute a command or component handler for a Discord
interaction.
_Avoid_: Handler definition

**Guard**:
An execution check that permits or rejects an invocation before its handler runs.
_Avoid_: Precondition, autocomplete filter

**Guard provider**:
A guard instance or a factory that supplies a guard for a particular invocation.
_Avoid_: Handler

**Autocomplete**:
A request for suggestions for a focused chat-input command option. It does not
execute the command or validate the user's final selection.
_Avoid_: Command invocation, input validation
