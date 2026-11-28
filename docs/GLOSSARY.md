# Hyperion

Canonical domain terminology across Hyperion's packages (`@hyperion-js/core`,
`@hyperion-js/jsx`, and `@hyperion-js/sqlite`). Behavior and contracts live in
the implementation; this glossary defines what each term means and which
synonyms to avoid.

## Language

### Client and registries

**Hyperion client**:
The Discord client extended with Hyperion's handler registries, interaction
dispatcher, and logging.
_Avoid_: Bot instance, app

**Registry**:
A client-owned store that discovers, validates, and indexes one kind of handler
(`commands`, `buttons`, `selectMenus`, `modals`, or `events`).
_Avoid_: Manager, loader, cache

**Discovery**:
Scanning a handler directory on disk to classify and load default-exported
handler modules into a registry.
_Avoid_: Registration, deployment

**Deployment**:
Publishing registered application commands to Discord's API for a guild or
globally.
_Avoid_: Discovery, registration

**Interaction dispatcher**:
The execution pipeline that routes an incoming Discord interaction to its
matching handler, runs guards and input validation, and handles errors.
_Avoid_: Router, event bus

**Context**:
The per-invocation object passed to a handler or guard, carrying the client,
the interaction or event arguments, and any validated params or input.
_Avoid_: State, session, request

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
A top-level action invoked directly, such as `/ping`, without selecting a
subcommand.
_Avoid_: Parent command

**Parent command**:
A top-level command that contains subcommands, such as `ticket` in
`/ticket close`. It is not itself an independently executable action.
_Avoid_: Subcommand, subcommand group

**Subcommand**:
An executable action within a parent command, such as `close` in
`/ticket close`. It has its own description and input options.
_Avoid_: Parent command, subcommand group

**Subcommand group**:
A named collection of subcommands within a parent command, such as `settings` in
`/ticket settings view`. The group is not itself an executable action.
_Avoid_: Category, parent command

**Command category**:
An organizational grouping of command definitions that contributes nothing to
their invocation names.
_Avoid_: Subcommand group, parent command

**Command path**:
The relative filesystem path under the commands directory whose `(category)`,
`[parent]`, and `{group}` folder delimiters classify a command module.
_Avoid_: Route, command tree

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
A context-menu command whose target is a selected message, rather than text
parsed from a newly sent message.
_Avoid_: Message-content command, user context-menu command

### Command input

**Command option**:
A named parameter offered by a chat-input command or subcommand, with a Discord
value type and an indication of whether the user must supply it.
_Avoid_: Validated command input

**Input schema**:
A Standard Schema contract that validates raw command options, modal
submissions, or select-menu selections before any input resolver runs.
_Avoid_: Guard, validator function

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
An application definition that responds to a selected client event. Several
event handlers may respond independently to the same client event.
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
An interactive control for choosing one or more values, users, roles,
mentionable entities, or channels.
_Avoid_: Select-menu handler

**Select option**:
A selectable entry in a string select menu, with a visible label and a value
returned when selected.
_Avoid_: Command option, selected value

**Select-menu input resolver**:
An application-defined operation that receives validated select-menu selections
and returns the application values supplied to the select-menu handler.
_Avoid_: Validator, guard

**Validated select-menu input**:
The application values supplied to one select-menu handler after the selection
is validated and any application resolution have completed.
_Avoid_: Raw selected values, choices

**Modal**:
A form presented in response to an interaction, with its submitted values
delivered in a separate interaction.
_Avoid_: Modal handler

**Modal input resolver**:
An application-defined operation that receives validated form values and returns
the application values supplied to the modal handler.
_Avoid_: Validator, guard

**Validated modal input**:
The application values supplied to one modal handler after submission validation
and any application resolution have completed.
_Avoid_: Raw submitted values, form controls

**Modal control**:
A control inside a modal label that submits a value: a text input, select menu,
file upload, radio group, checkbox group, or checkbox.
_Avoid_: Field, form field, input

**Text input**:
A modal control for entering a short or multiline text value.
_Avoid_: Command option, submitted value

**Label**:
The visible name and optional explanatory text associated with a modal control.
_Avoid_: Custom ID, placeholder

**Text display**:
A block of formatted text in a modal or a layout message.
_Avoid_: Text input, submitted value, message content

**Layout component**:
A component that arranges content within a message, such as a container,
section, text display, thumbnail, media gallery, or separator, as opposed to an
interactive control.
_Avoid_: Display component, Components V2 component

**Layout message**:
A message whose visible content is built entirely from layout components and
interactive controls, without plain message content or embeds. Once sent, it
stays a layout message.
_Avoid_: Components V2 message, embed

**Custom ID**:
An application-defined identifier attached to an interactive control or form to
identify its associated interaction.
_Avoid_: Message ID, command name

**Custom-ID params**:
The validated values a component handler declares in its custom ID, available
only to that invocation.
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
Evaluating a JSX view to produce the Discord builder or message payload supplied
to discord.js.
_Avoid_: Sending, handler execution

### Execution

**Invocation**:
A single request to execute a command, component handler, or event handler.
_Avoid_: Handler definition

**Guard**:
An execution check that permits or rejects an invocation before its handler
runs.
_Avoid_: Precondition, autocomplete filter

**Guard factory**:
A function invoked per invocation to produce a fresh guard, such as a guard with
per-invocation state.
_Avoid_: Guard, parameterized guard

**Guard provider**:
A guard, or a guard factory that supplies a guard for a particular invocation.
_Avoid_: Handler

**Autocomplete**:
A request for suggestions for a focused chat-input command option. It does not
execute the command or validate the user's final selection.
_Avoid_: Command invocation, input validation

### Storage

**Database**:
An optional SQLite connection wrapper (`@hyperion-js/sqlite`) that owns
migrations, table helpers, parameterized SQL queries, and key-value namespaces.
_Avoid_: Core store, ORM

**Table helper**:
A schema-validated interface over one real SQLite table for typed row reads,
writes, and filters.
_Avoid_: Model, repository, KV store

**Key-value namespace**:
A scoped plain-JSON store with optional expiry, backed by `@hyperion-js/sqlite`'s
internal `_hyperion_kv` table.
_Avoid_: Table helper, cache

**Migration**:
A versioned, ordered schema change applied once to a SQLite database via
SQLite's `user_version`.
_Avoid_: Seed, sync
