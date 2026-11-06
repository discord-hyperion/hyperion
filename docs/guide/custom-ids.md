# Data in custom IDs

Say every ticket message gets a Close button. You don't want a separate handler
per ticket; you want _one_ handler that knows which ticket was clicked. Custom-ID
params let a button, select menu, or modal carry a little data in its custom ID,
and hand it back to your handler, validated and typed.

## Defining params

`defineParams()` describes the data: a route, the keys in order, and a schema
for the values.

```ts
// src/buttons/close-ticket.ts
import { defineParams } from "@hyperion/core";
import * as v from "valibot";

export const closeTicket = defineParams({
    id: "ticket.close",
    keys: ["ticketId", "owner"],
    schema: v.object({
        ticketId: v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/)),
        owner: v.string(),
    }),
});
```

Any [Standard Schema](https://standardschema.dev) library works (Valibot, Zod,
ArkType, …). The `keys` must name exactly the schema's fields, or it won't
compile. Their order is up to you, but once you've sent buttons, the order is
locked in (more on that below).

## Templates and building controls

Give your handler a **template** in `builder`. The registry keeps it as the
reusable design for your controls. Call `build()` with the params definition and
values to create a fresh control with an encoded custom ID:

```ts
const button = ctx.client.buttons.build(closeTicket, {
    ticketId: "a1b2c3d4",
    owner: user.id,
});
// The copy's custom ID is "ticket.close:a1b2c3d4:123456789012345678".
```

When someone clicks, Hyperion parses that ID using the handler's params
definition, validates the values, and supplies the result in `ctx.params`.
Building encodes the values; schema validation happens when the click arrives.
The shared template stays unchanged, so each ticket can have its own button.
Select-menu and modal registries offer the same `build(definition, values)` API.
For a fixed ID with no params, use `build("literal.id")` instead.

## Building a custom ID directly

The definition is also a function. Call it to get a custom ID:

```ts
closeTicket({ ticketId: "a1b2c3d4", owner: user.id });
// "ticket.close:a1b2c3d4:123456789012345678"
```

Use it anywhere a custom ID goes:

```ts
new DangerButtonBuilder().setLabel("Close").setCustomId(closeTicket(ticket));
```

If the handler has a template, `ctx.client.buttons.build(closeTicket, ticket)`
returns a copy with the custom ID already set. Discord caps custom IDs at 100
characters, and Hyperion throws if you go over, so keep values short.

## Reading the data

Give the handler `params` instead of a `customId`:

```ts
type CloseTicketButtonSpec = { params: typeof closeTicket };

export default class CloseTicketButton extends ButtonHandler<CloseTicketButtonSpec> {
    constructor() {
        super({
            params: closeTicket,
            builder: new DangerButtonBuilder()
                .setCustomId(closeTicket.id)
                .setLabel("Close"),
            guards: [paramOwner("owner")],
        });
    }

    async run(ctx: ButtonContext<CloseTicketButtonSpec>) {
        const [issues, params] = ctx.params;
        if (issues) {
            await ctx.interaction.reply({
                content: "This button is out of date.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId} closed.`,
            components: [],
        });
    }
}
```

`ctx.params` is `[issues, value]`, the same shape as [typed input](input.md). If
the custom ID fails the schema, you get the issues and decide what to say.

Select menus and modals work the same way: put `params` in the type argument
next to their other keys, such as `{ componentType, params }` for a user select
or `{ params, input }` for a modal.

## Don't trust the custom ID

Custom IDs come back from the user's client, so someone determined can change
them. Never use params alone to decide who's allowed to do something. Instead,
check them against the user who clicked:

```ts
guards: [paramOwner("owner", "Only the ticket's author can close it.")];
```

`paramOwner()` passes only when the params are valid _and_ the `owner` value is
the clicking user's ID. Params are checked before guards, so this works on
buttons, menus, and modals alike. See [guards](guards.md).

## Changing params later

Messages outlive your code. If you change `keys`, their order, or what they mean,
old buttons will decode wrongly. So give the new version a new `id`
(`ticket.close.v2`). You can keep the old handler around to reply "This button
is out of date."

A custom ID that matches a route but has the wrong number of values is ignored,
and logged at debug level, so you can spot a template sent without its values.

## A few rules

- Routes must be unique per kind (buttons, menus, modals), and can't equal a
  literal custom ID of the same kind.
- A handler has either `customId` or `params`, never both.
- Values are text on the wire. Use the schema to turn them into numbers or
  booleans (`v.pipe(v.string(), v.toNumber())`).
