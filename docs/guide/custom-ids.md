# Data in custom IDs

When many messages share the same button, menu, or modal, such as a Close button on every ticket, you need one handler that knows which ticket was clicked. Custom ID params let you encode small values into a control's custom ID and receive them validated and typed in your handler.

## Defining params

Define the route, key order, and validation schema with `defineParams()`:

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

| Option   | Purpose                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`     | Route prefix written at the start of every generated custom ID.                                                        |
| `keys`   | Schema field names in the exact order they are serialized into the custom ID.                                          |
| `schema` | Validates decoded values when an interaction arrives. Any [Standard Schema](https://standardschema.dev) library works. |

`keys` must list every field in `schema` and no extras, or TypeScript rejects the definition. You can choose any key order initially, but once messages with that button are sent, changing the order breaks existing buttons. See [Changing params later](#changing-params-later).

## Building controls

Pass the params definition and values to `build()` to copy the handler's template with an encoded custom ID:

```ts fragment
const button = ctx.client.buttons.build(closeTicket, {
    ticketId: "a1b2c3d4",
    owner: user.id,
});
// Resulting custom ID: "ticket.close:a1b2c3d4:123456789012345678"
```

Select menus and modals support `build(definition, values)` in the same way. `build()` serializes the values into the custom ID without running the schema; validation runs when the interaction returns.

If your handler does not use a template, call the params definition as a function to generate the custom ID string for any builder:

```ts fragment
new DangerButtonBuilder()
    .setLabel("Close")
    .setCustomId(closeTicket({ ticketId: "a1b2c3d4", owner: user.id }));
```

Hyperion throws an error if the encoded custom ID exceeds Discord's 100-character limit, so keep routes and values short.

## Reading params in a handler

Pass `params` to `defineButton()`, `defineSelectMenu()`, or `defineModal()`. When using a template, set the template's custom ID to `params.id`:

```ts fragment
export default defineButton({
    params: closeTicket,
    builder: new DangerButtonBuilder()
        .setCustomId(closeTicket.id)
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

`ctx.params` is a tuple of `[null, value]` on success or `[issues, undefined]` on validation failure, matching the shape of [typed input](input.md). When validation fails, your handler decides what to reply.

## Verifying ownership

Custom IDs come back from the user's client, so treat decoded values as untrusted input. To restrict a control to the user it was created for, add the `paramOwner()` guard:

```ts fragment
guards: [paramOwner("owner", "Only the ticket author can close it.")];
```

`paramOwner()` passes only when the params pass schema validation and the named field equals `ctx.interaction.user.id`. Because Hyperion validates params before running guards, `paramOwner()` works on buttons, select menus, and modals. See [Guards](guards.md).

> [!WARNING]
> `paramOwner()` checks only that the clicking user matches the ID stored in the custom ID. It cannot verify that the user still owns the resource in your database. For sensitive actions, look up the record and verify ownership in your handler.

## Changing params later

Messages stay in Discord channels after you redeploy your bot. If you add, remove, or reorder `keys` on an existing route, buttons on older messages will decode incorrectly. Instead, create a new route name such as `ticket.close.v2`. You can keep the old handler registered to reply that the button is out of date.

If an incoming custom ID matches a route prefix but has the wrong number of values, Hyperion ignores it and logs the mismatch at debug level.

## Rules

- Routes must be unique within each component kind and cannot match a fixed custom ID of the same kind.
- A handler accepts either `customId` or `params`, never both.
- Values are stored as strings in the custom ID. Convert numbers or booleans in your schema, for example with `v.pipe(v.string(), v.toNumber())`.
