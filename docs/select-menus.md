# Select menus

For control and handler terminology, see the [component glossary](GLOSSARY.md#components).

Hyperion loads default-exported `SelectMenuHandler` subclasses from
`<root>/src/select-menus`, recursively. Missing directories are optional. Each
handler needs a zero-argument constructor, a unique ID, its `componentType`, and
`run(ctx)`. It may also offer an optional [template](GLOSSARY.md#components)
builder of the same select type. A handler gets its ID from exactly one source: `customId`, a template whose
custom ID becomes the handler's, or `params`, whose route the optional template
must carry as its custom ID. Passing `customId` beside a template is a type error
and throws. So does a template without a custom ID, or a params template whose
custom ID isn't the route. Loading also rejects a template whose custom ID changed
after construction. Invalid
templates and duplicate IDs fail startup
before command deployment. Loading is atomic: a failed reload preserves the
previous registry.

String, user, role, mentionable, and channel message selects are supported.
Selects embedded in modals are read by the [modal handler](modals.md) through
the submission's components resolver, not dispatched to message select handlers.

## Templates

The select-menu registry stores handlers with their optional **templates** in
`builder`. Each template defines a reusable menu of the declared `componentType`.
`build("colour.choose")` copies it with a fixed custom ID;
`build(definition, values)` copies it with an encoded params ID. Hyperion parses
that ID when the selection arrives, separately from the user's selected values.
Every build leaves the shared template unchanged.

## Define a string handler

```ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default class ChooseColour extends SelectMenuHandler {
    constructor() {
        super({
            componentType: ComponentType.StringSelect,
            builder: new StringSelectMenuBuilder()
                .setCustomId("colour.choose")
                .setPlaceholder("Choose a colour")
                .addOptions(
                    { label: "Blue", value: "blue" },
                    { label: "Green", value: "green" },
                ),
        });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `You chose ${ctx.interaction.values[0]}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

`ctx.interaction` is a Discord.js `StringSelectMenuInteraction`, so `values` and
message-update methods are available directly. Multi-select menus return all
selected values in that array. `componentType` is always declared, and a template
must match it. Templates are shared: callers get copies through `build()`, so
never mutate the template itself.

## Type arguments

`SelectMenuHandler` and `SelectMenuContext` take one object type argument with
optional keys, named like the constructor options:

| Key             | Type                         | Default                      |
| --------------- | ---------------------------- | ---------------------------- |
| `componentType` | a select `ComponentType`     | `ComponentType.StringSelect` |
| `params`        | `typeof` a params definition | no `ctx.params`              |
| `input`         | `typeof` an input definition | no `ctx.input`               |

With no type argument, the handler is a string select without params or input.
Name the object once with a type alias and pass it to both the handler and its
context. Unknown keys are type errors, so a misspelled `inptu` fails to compile
instead of meaning "no input". An input whose resolver expects another select
type or other params is also a type error. See the
[type-argument decision](adr/0004-component-handlers-take-one-object-type-argument.md).

## Define a user handler

Set `componentType` in the type argument and pass the same value to the
constructor. This pairs a `UserSelectMenuBuilder` template with a Discord.js `UserSelectMenuInteraction`, including
resolved `.users` and `.members` collections alongside the selected IDs in
`.values`. Member data depends on guild context; do not assume every selected
user has a cached guild member.

```ts
import { UserSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { ComponentType } from "discord.js";

type ChooseUserSpec = { componentType: ComponentType.UserSelect };

export default class ChooseUser extends SelectMenuHandler<ChooseUserSpec> {
    constructor() {
        super({
            componentType: ComponentType.UserSelect,
            builder: new UserSelectMenuBuilder()
                .setCustomId("user.choose")
                .setPlaceholder("Choose a user")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ChooseUserSpec>) {
        const names = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Discord supplies the user options; do not call `addOptions()` on a user builder.
String selects need no type argument.
All supported types share `client.selectMenus` and must have unique IDs within it. The
registry returns a union of typed handlers; narrow `menu.componentType` before
accessing type-specific template methods. Dispatch checks the ID and component
type together before running guards or a handler.

## Define a role handler

Use `ComponentType.RoleSelect` to pair `RoleSelectMenuBuilder` with
`RoleSelectMenuInteraction`. The selected role IDs are in `.values`, with resolved
roles in `.roles`. Resolved entries can be Discord.js roles or API role objects,
depending on guild cache state; `.name` is available on either. Narrow with
`inCachedGuild()` before relying on cached-role methods.

```ts
import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { ComponentType } from "discord.js";

type ChooseRoleSpec = { componentType: ComponentType.RoleSelect };

export default class ChooseRole extends SelectMenuHandler<ChooseRoleSpec> {
    constructor() {
        super({
            componentType: ComponentType.RoleSelect,
            builder: new RoleSelectMenuBuilder()
                .setCustomId("role.choose")
                .setPlaceholder("Choose a role")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ChooseRoleSpec>) {
        const names = ctx.interaction.roles.map(role => role.name);

        await ctx.interaction.update({
            content: `Selected roles: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Discord supplies the server's role options, so role builders do not use
`addOptions()`. Selecting a role supplies data to your handler; it does not assign
that role to anyone. Use `setContexts(InteractionContextType.Guild)` on the
command that sends the menu to restrict it to servers.

## Define a mentionable handler

`ComponentType.MentionableSelect` pairs a `MentionableSelectMenuBuilder` with
`MentionableSelectMenuInteraction`. It offers users and roles in the same menu.
Selected IDs are in `.values`, resolved users in `.users`, guild members in
`.members`, and roles in `.roles`. These collections can be empty depending on
the selection and guild data; a role selection does not have a user entry.

```ts
import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { ComponentType } from "discord.js";

type ChooseMentionableSpec = { componentType: ComponentType.MentionableSelect };

export default class ChooseMentionable extends SelectMenuHandler<ChooseMentionableSpec> {
    constructor() {
        super({
            componentType: ComponentType.MentionableSelect,
            builder: new MentionableSelectMenuBuilder()
                .setCustomId("mentionable.choose")
                .setPlaceholder("Choose users or roles")
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ChooseMentionableSpec>) {
        const { values, users, roles } = ctx.interaction;
        const names = values.map(
            id => users.get(id)?.username ?? roles.get(id)?.name ?? id,
        );

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Iterating `.values` preserves the selected order when users and roles are mixed.
With `minValues` set to zero, clearing the selection produces an empty array; the
example displays `None`. Discord supplies options, so do not call `addOptions()`.
Selecting entries returns data without pinging users, assigning roles, or storing message state.

## Define a channel handler

Use `ComponentType.ChannelSelect` to pair `ChannelSelectMenuBuilder` with
`ChannelSelectMenuInteraction`. Selected IDs are in `.values` and resolved
channels in `.channels`. Depending on cache state, entries can be Discord.js
channels or API channel objects. Narrow with `inCachedGuild()` and check the
channel type before using cache-specific methods.

```ts
import { ChannelSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenuHandler, type SelectMenuContext } from "@hyperion/core";
import { ChannelType, ComponentType } from "discord.js";

type ChooseChannelSpec = { componentType: ComponentType.ChannelSelect };

export default class ChooseChannel extends SelectMenuHandler<ChooseChannelSpec> {
    constructor() {
        super({
            componentType: ComponentType.ChannelSelect,
            builder: new ChannelSelectMenuBuilder()
                .setCustomId("channel.choose")
                .setPlaceholder("Choose text or voice channels")
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ChooseChannelSpec>) {
        const names = ctx.interaction.values.map(id => {
            const channel = ctx.interaction.channels.get(id);
            return channel && "name" in channel ? (channel.name ?? id) : id;
        });

        await ctx.interaction.update({
            content: `Selected channels: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Discord supplies the channel options; do not call `addOptions()`. Use
`setChannelTypes()` to restrict the offered channel types, or omit it to leave
them unrestricted. With `minValues` set to zero, users can clear their selection.
The example preserves selected order and falls back to IDs for missing names.
Selection supplies data; it does not change channel permissions or persist
application state.

## Send a menu

Inside a command, `build()` returns a fresh copy of the handler's template with
its custom ID set. It throws when no handler is loaded for the ID, when the
handler has no template, or when a params route is passed as a string.
For params, use `build(definition, values)` so the generated ID includes the
values needed for decoding.

```ts
await ctx.interaction.reply({
    content: "Choose a colour.",
    components: [
        new ActionRowBuilder().addComponents(
            ctx.client.selectMenus.build("colour.choose"),
        ),
    ],
});
```

Without a template, build the menu yourself and set `customId` on it.

Import `ActionRowBuilder` from `@discordjs/builders`. Select menus are sent as
message components and do not require application-command registration. Routing
matches the exact custom ID. Unknown IDs are ignored for application-owned
collectors and listeners; avoid acknowledging the same interaction twice.

## Carry data in the custom ID

A select menu can declare typed [custom-ID params](custom-id-params.md) instead
of `customId`. The command sets each menu's custom ID with the encoder:

```ts
export const assignTicket = defineParams({
    id: "ticket.assign",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

type AssignTicketSpec = {
    componentType: ComponentType.UserSelect;
    params: typeof assignTicket;
};

export default class AssignTicket extends SelectMenuHandler<AssignTicketSpec> {
    constructor() {
        super({
            componentType: ComponentType.UserSelect,
            params: assignTicket,
            builder: new UserSelectMenuBuilder()
                .setCustomId(assignTicket.id)
                .setPlaceholder("Assign to…"),
            guards: [paramOwner("owner")],
        });
    }

    async run(ctx: SelectMenuContext<AssignTicketSpec>) {
        const [issues, params] = ctx.params; // From the custom ID.
        const assignee = ctx.interaction.users.first(); // From the click.
    }
}

// In a command: ctx.client.selectMenus.build(assignTicket, { ticketId, owner })
```

Params describe what the bot decided when it sent the menu; the selection is
what the user chose. A params handler is stored in `client.selectMenus.routes`
and may also carry a template, which
`client.selectMenus.build(assignTicket, { ticketId, owner })` copies with the
encoded custom ID. Routes are unique across every select type. A click
of another select type is unmatched before its params are decoded.

## Validate the selection

Selected values come from the client, so a stale menu or a forged interaction
can send values the menu never offered. Add `input` to validate them before the
handler runs, with the same [`defineInput`](input-validation.md) as commands and
modals:

```ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import {
    defineInput,
    type SelectMenuContext,
    SelectMenuHandler,
} from "@hyperion/core";
import { ComponentType, MessageFlags } from "discord.js";
import * as v from "valibot";

const input = defineInput({
    schema: v.pipe(v.array(v.picklist(["blue", "green", "red"])), v.length(1)),
});

type ChooseColourSpec = { input: typeof input };

export default class ChooseColour extends SelectMenuHandler<ChooseColourSpec> {
    constructor() {
        super({
            componentType: ComponentType.StringSelect,
            builder: new StringSelectMenuBuilder()
                .setCustomId("colour.choose")
                .addOptions(
                    { label: "Blue", value: "blue" },
                    { label: "Green", value: "green" },
                    { label: "Red", value: "red" },
                ),
            input,
        });
    }

    async run(ctx: SelectMenuContext<ChooseColourSpec>) {
        const [issues, colours] = ctx.input;

        if (issues) {
            await ctx.interaction.reply({
                content: "That colour isn't on the list.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({ content: `You chose ${colours[0]}.` });
    }
}
```

- The schema receives a copy of `interaction.values`: a `string[]` of the picked
  option values, or of the selected IDs for user, role, mentionable, and channel
  selects. An empty selection is `[]`. It is the same shape the select has
  inside a modal.
- Processing runs after params and guards:
  `params → guards → optional deferral → schema → resolver → handler`. Guards
  and the resolver see `ctx.params` but never `ctx.input`.
- A resolver can read resolved entities from `ctx.interaction` (`.users`,
  `.members`, `.roles`, `.channels`), for example to turn IDs into members.
- `ctx.input` is `[null, value]` after success, or `[issues, undefined]` when the
  schema fails. Schema issues reach the handler, which owns the response. A
  schema or resolver that throws skips the handler and reports the `input`
  stage through the error pipeline.
- `defer: true` privately defers a reply. `defer: "update"` calls
  `deferUpdate()` instead, so the handler finishes with `editReply()` on the
  menu's message. Neither defers an interaction that a guard already
  acknowledged.
- Nothing checks that the schema suits the select type; a picklist on a user
  select simply reports issues for every ID.

## Guards, async work, and errors

The optional `guards` array accepts instances or lazy async factories for
`Guard<SelectMenuContext>` (string selects) or
`Guard<SelectMenuContext<{ componentType: … }>>` with the handler's select type.
Shared guards such as `ownerOnly` also work. Every component
must declare its own guards; a command's guards do not apply to its menus.

Handlers control acknowledgment. Use `update()` for immediate message changes,
`deferUpdate()` before slow work followed by `editReply()`, or `showModal()` to
open a modal. Hyperion acknowledges before the handler only when `input.defer` is
set; see [validate the selection](#validate-the-selection).

Guard and handler failures use the shared error pipeline: an initial reply is
private, deferred replies are edited, and replied interactions or deferred
message updates receive private follow-ups. An error after `deferUpdate()` does
not overwrite the original message.

Use `ctx.logger` for correlated logs. Selected values are not logged by the
framework. Handlers stay stateless: fetch async data and persist application
state in application-owned storage rather than fields on a shared handler.

## JSX select authoring

`@hyperion/jsx` can author a native template for every select type with
`renderStringSelect()`, `renderUserSelect()`, `renderRoleSelect()`,
`renderMentionableSelect()`, and `renderChannelSelect()`, and render any of them
inside an `ActionRow` with `renderComponents()` for a fresh message instance.
Routing, guards, input, acknowledgment, and native collectors are unchanged; JSX
renders builders and adds no handler callbacks.

See [JSX select menus](jsx-select-menus.md) for complete handler and message
examples, props, defaults, and uniqueness scopes.
