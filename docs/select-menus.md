# String select menus

Hyperion loads default-exported `SelectMenu` subclasses from
`<root>/src/select-menus`, recursively. Missing directories are optional. Each
handler needs a zero-argument constructor, a `StringSelectMenuBuilder` with a
unique custom ID, and `run(ctx)`. Invalid builders and duplicate IDs fail startup
before command deployment. Loading is atomic: a failed reload preserves the
previous registry.

This first implementation supports string selects. User, role, mentionable, and
channel selects, and selects embedded in modals, are not dispatched yet.

## Define a handler

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

The optional `guards` array accepts `Guard<SelectMenuContext>` instances or lazy,
async factories. Shared guards such as `OwnerOnly` also work. Every component
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

The dev bot includes `/colour` and `src/select-menus/choose-colour.ts` as a
complete example.
