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

### Command input

**Command option**:
A named parameter offered by a chat-input command or subcommand, with a Discord
value type and an indication of whether the user must supply it.
_Avoid_: Validated command input

**Command input resolver**:
An application-defined operation that receives validated command option values
and returns the application values supplied to the command handler.
_Avoid_: Validator, guard

**Validated command input**:
The application values supplied to one command handler after option validation
and any application resolution have completed.
_Avoid_: Command options, raw option values

### Events

**Client event**:
A notification emitted by the Discord client, with the arguments associated with
that event.
_Avoid_: Application command, custom-ID interaction

**Event occurrence**:
One emission of a client event, carrying the arguments supplied to its matching
event handlers.
_Avoid_: Event handler, handler invocation

**Event handler**:
An application definition that responds to a selected client event. Several event
handlers may respond independently to the same client event.
_Avoid_: Client event, component handler

### Components

**Component handler**:
A reusable definition of how a button click, select-menu selection, or modal
submission is processed. It declares where submissions route, not how the
control or form looks; it may carry a template for that.
_Avoid_: Button, select menu, modal

**Template**:
An optional default control or form a component handler offers its callers. Each
use gets a fresh copy with the custom ID set; the template itself never changes.
_Avoid_: View, form factory

**Button**:
An interactive message control that a user clicks to trigger an action.
_Avoid_: Button handler

**Action row**:
A horizontal group of interactive controls within a message or form.
_Avoid_: Handler group, command group

**Select menu**:
An interactive control for choosing one or more values, users, roles, mentionable
entities, or channels.
_Avoid_: Select-menu handler

**Select option**:
A selectable entry in a string select menu, with a visible label and a value
returned when selected.
_Avoid_: Command option, selected value

**Modal**:
A form presented in response to an interaction, with its submitted values delivered
in a separate interaction.
_Avoid_: Modal handler

**Modal input resolver**:
An application-defined operation that receives validated form values and returns
the application values supplied to the modal handler.
_Avoid_: Validator, guard

**Validated modal input**:
The application values supplied to one modal handler after submission validation
and any application resolution have completed.
_Avoid_: Raw submitted values, form controls

**Text input**:
A form control for entering a short or multiline text value.
_Avoid_: Command option, submitted value

**Label**:
The visible name and optional explanatory text associated with a form control.
_Avoid_: Custom ID, placeholder

**Text display**:
Informational formatted text presented alongside interactive controls.
_Avoid_: Text input, submitted value

**Custom ID**:
An application-defined identifier attached to an interactive control or form to
identify its associated interaction.
_Avoid_: Message ID, command name

**Custom-ID params**:
The validated values a component handler declares in its custom ID, available only
to that invocation.
_Avoid_: Payload, state

**Route**:
The first segment of a custom ID that carries params, identifying the component
handler that processes it.
_Avoid_: Handler ID, prefix

### JSX authoring

**JSX view**:
A composable description of content that can be rendered for Discord.
_Avoid_: Component handler, rendered embed

**Authoring component**:
A reusable function that describes part of a JSX view from supplied properties.
_Avoid_: Component handler, interactive control

**Rendering**:
Evaluating a JSX view to produce the content supplied to Discord.
_Avoid_: Sending, handler execution

### Execution

**Invocation**:
A single request to execute a command, component handler, or event handler.
_Avoid_: Handler definition

**Guard**:
An execution check that permits or rejects an invocation before its handler runs.
_Avoid_: Precondition, autocomplete filter

**Guard provider**:
A guard, or a factory that supplies a guard for a particular invocation.
_Avoid_: Handler

**Autocomplete**:
A request for suggestions for a focused chat-input command option. It does not
execute the command or validate the user's final selection.
_Avoid_: Command invocation, input validation
