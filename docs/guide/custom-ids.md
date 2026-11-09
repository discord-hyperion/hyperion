# Data in custom IDs

Say every ticket message gets a Close button. You don't want a separate handler
per ticket; you want _one_ handler that knows which ticket was clicked. Params
let a button, select menu, or modal carry a little data in its custom ID, and
hand it back to your handler, validated and typed.

## Defining params

`defineParams()` describes the data:

```ts
// src/buttons/close-ticket.ts
import { defineParams } from "@hyperion-js/core";
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

| Option   | What it's for                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `id`     | The route: the fixed start of every custom ID these params build.                                        |
| `keys`   | The schema's fields, in the order they're written into the custom ID.                                    |
| `schema` | Checks the values when a click arrives. Any [Standard Schema](https://standardschema.dev) library works. |

The keys have to name exactly the schema's fields, or it won't compile. Pick any
order, but once you've sent buttons, it's locked in (more on that
[below](#changing-params-later)).

## Building controls

Call `build()` with the params and their values to get a copy of the handler's
template with the values in its custom ID:

```ts fragment
const button = ctx.client.buttons.build(closeTicket, {
    ticketId: "a1b2c3d4",
    owner: user.id,
});
// Its custom ID is "ticket.close:a1b2c3d4:123456789012345678".
```

Select menus and modals have the same `build()`. Building only writes the values
in; the schema checks them when the click comes back.

No template? The params are also a function that returns the custom ID, for any
builder:

```ts fragment
new DangerButtonBuilder()
    .setLabel("Close")
    .setCustomId(closeTicket({ ticketId: "a1b2c3d4", owner: user.id }));
```

Hyperion throws if a custom ID goes over Discord's 100 characters, so keep
values short.

## Reading the data

Give the handler `params` instead of a custom ID, and put them in its type
argument:

```ts fragment
export default defineButton({
    params: closeTicket,
    builder: new DangerButtonBuilder()
        .setCustomId(closeTicket.id) // the template carries the route
        .setLabel("Close"),
    guards: [paramOwner("owner")],
    run: async ctx => {
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
    },
});
```

`ctx.params` is `[issues, value]`, the same shape as [typed input](input.md). If
the custom ID fails the schema, you get the issues and decide what to say.

Select menus and modals take `params` the same way, beside their other
options.

## Don't trust the custom ID

Custom IDs come back from the user's client, so treat params as claims, not
facts. To stop other people using a control you built for one user, check the
user it names against the user who clicked:

```ts fragment
guards: [paramOwner("owner", "Only the ticket's author can close it.")];
```

`paramOwner()` passes only when the params are valid _and_ the named user is the
one who clicked. Params are checked before guards, so this works on buttons,
menus, and modals alike. See [guards](guards.md).

> [!WARNING]
> That only proves the clicker is the user the ID names. It can't tell you the
> ID wasn't edited, or that they still own the ticket. For anything that
> matters, look the ticket up and check its owner in your handler.

## Changing params later

Messages outlive your code. If you change the keys, their order, or what they
mean, old buttons will decode wrongly. So give the new version a new route
(`ticket.close.v2`). You can keep the old handler around to reply "This button
is out of date."

A custom ID that matches a route but has the wrong number of values is ignored,
and logged at debug level, so you can spot a template sent without its values.

## A few rules

- Routes must be unique per kind (buttons, menus, modals), and can't equal a
  fixed custom ID of the same kind.
- A handler has either a custom ID or params, never both.
- Values are text in the custom ID. Use the schema to turn them into numbers or
  booleans: `v.pipe(v.string(), v.toNumber())`.
