# Select menus

For control and handler terminology, see the [component glossary](GLOSSARY.md#components).

Hyperion loads default-exported `SelectMenu` subclasses from
`<root>/src/select-menus`, recursively. Missing directories are optional. Each
handler needs a zero-argument constructor, a supported builder with a unique
custom ID, and `run(ctx)`. Invalid builders and duplicate IDs fail startup
before command deployment. Loading is atomic: a failed reload preserves the
previous registry.

String, user, role, mentionable, and channel message selects are supported.
Selects embedded in modals are read by the [modal handler](modals.md) through
the submission's components resolver, not dispatched to message select handlers.

## Define a string handler

```ts
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "discord-hyperion";

export default class ChooseColour extends SelectMenu {
    constructor() {
        super({
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
message-update methods are available directly. Multi-select builders return all
selected values in that array. Builder definitions are shared templates: avoid
mutating them during invocations.

## Define a user handler

Set the generic component type on the handler and its context. This pairs a
`UserSelectMenuBuilder` with a Discord.js `UserSelectMenuInteraction`, including
resolved `.users` and `.members` collections alongside the selected IDs in
`.values`. Member data depends on guild context; do not assume every selected
user has a cached guild member.

```ts
import { UserSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "discord-hyperion";
import { ComponentType } from "discord.js";

export default class ChooseUser extends SelectMenu<ComponentType.UserSelect> {
    constructor() {
        super({
            builder: new UserSelectMenuBuilder()
                .setCustomId("user.choose")
                .setPlaceholder("Choose a user")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.UserSelect>) {
        const names = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected: ${names.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
```

Discord supplies the user options; do not call `addOptions()` on a user builder.
String selects retain the default generic, so existing handlers need no changes.
All supported types share `client.selectMenus` and must have unique IDs within it. The
registry returns a union of typed handlers; narrow `menu.componentType` before
accessing type-specific builder methods. Dispatch checks the ID and component
type together before running guards or a handler.

## Define a role handler

Use `ComponentType.RoleSelect` to pair `RoleSelectMenuBuilder` with
`RoleSelectMenuInteraction`. The selected role IDs are in `.values`, with resolved
roles in `.roles`. Resolved entries can be Discord.js roles or API role objects,
depending on guild cache state; `.name` is available on either. Narrow with
`inCachedGuild()` before relying on cached-role methods.

```ts
import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "discord-hyperion";
import type { ComponentType } from "discord.js";

export default class ChooseRole extends SelectMenu<ComponentType.RoleSelect> {
    constructor() {
        super({
            builder: new RoleSelectMenuBuilder()
                .setCustomId("role.choose")
                .setPlaceholder("Choose a role")
                .setMinValues(1)
                .setMaxValues(1),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.RoleSelect>) {
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
that role to anyone. The dev bot's `/role` command uses
`setContexts(InteractionContextType.Guild)` to make the example server-only.

## Define a mentionable handler

`ComponentType.MentionableSelect` pairs a `MentionableSelectMenuBuilder` with
`MentionableSelectMenuInteraction`. It offers users and roles in the same menu.
Selected IDs are in `.values`, resolved users in `.users`, guild members in
`.members`, and roles in `.roles`. These collections can be empty depending on
the selection and guild data; a role selection does not have a user entry.

```ts
import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "discord-hyperion";
import type { ComponentType } from "discord.js";

export default class ChooseMentionable extends SelectMenu<ComponentType.MentionableSelect> {
    constructor() {
        super({
            builder: new MentionableSelectMenuBuilder()
                .setCustomId("mentionable.choose")
                .setPlaceholder("Choose users or roles")
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.MentionableSelect>) {
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
The server-only `/mentionable` dev command sends this menu. Selecting entries
returns data without pinging users, assigning roles, or storing message state.

## Define a channel handler

Use `ComponentType.ChannelSelect` to pair `ChannelSelectMenuBuilder` with
`ChannelSelectMenuInteraction`. Selected IDs are in `.values` and resolved
channels in `.channels`. Depending on cache state, entries can be Discord.js
channels or API channel objects. Narrow with `inCachedGuild()` and check the
channel type before using cache-specific methods.

```ts
import { ChannelSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "discord-hyperion";
import { ChannelType, type ComponentType } from "discord.js";

export default class ChooseChannel extends SelectMenu<ComponentType.ChannelSelect> {
    constructor() {
        super({
            builder: new ChannelSelectMenuBuilder()
                .setCustomId("channel.choose")
                .setPlaceholder("Choose text or voice channels")
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
                .setMinValues(0)
                .setMaxValues(5),
        });
    }

    async run(ctx: SelectMenuContext<ComponentType.ChannelSelect>) {
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
The server-only `/channel` dev command sends this menu. Selection supplies data;
it does not change channel permissions or persist application state.

## Send a menu

Inside a command, retrieve the registered definition and place its builder in an
action row:

```ts
const menu = ctx.client.selectMenus.get("colour.choose");

if (!menu) throw new Error("Colour menu was not loaded.");

await ctx.interaction.reply({
    content: "Choose a colour.",
    components: [new ActionRowBuilder().addComponents(menu.builder)],
});
```

Import `ActionRowBuilder` from `@discordjs/builders`. Select menus are sent as
message components and do not require application-command registration. Routing
matches the exact custom ID. Unknown IDs are ignored for application-owned
collectors and listeners; avoid acknowledging the same interaction twice.

## Guards, async work, and errors

The optional `guards` array accepts instances or lazy async factories for
`Guard<SelectMenuContext>` (string selects) or
`Guard<SelectMenuContext<ComponentType.UserSelect>>` (user selects), or
`Guard<SelectMenuContext<ComponentType.RoleSelect>>` (role selects), or
`Guard<SelectMenuContext<ComponentType.MentionableSelect>>` (mentionable selects), or
`Guard<SelectMenuContext<ComponentType.ChannelSelect>>` (channel selects).
Shared guards such as `OwnerOnly` also work. Every component
must declare its own guards; a command's guards do not apply to its menus.

Handlers control acknowledgment. Use `update()` for immediate message changes,
`deferUpdate()` before slow work followed by `editReply()`, or `showModal()` to
open a modal. Hyperion does not acknowledge before running the handler.

Guard and handler failures use the shared error pipeline: an initial reply is
private, deferred replies are edited, and replied interactions or deferred
message updates receive private follow-ups. An error after `deferUpdate()` does
not overwrite the original message.

Use `ctx.logger` for correlated logs. Selected values are not logged by the
framework. Handlers stay stateless: fetch async data and persist application
state in application-owned storage rather than fields on a shared handler.

The dev bot includes `/colour`, `/user`, `/role`, `/mentionable`, and `/channel`, with matching
handlers in `src/select-menus/choose-colour.ts`, `choose-user.ts`, `choose-role.ts`,
`choose-mentionable.ts`, and `choose-channel.ts`.
