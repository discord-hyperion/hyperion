# Data in custom IDs

When many messages share the same button, select menu, or modal—such as a Close button on every ticket—use custom-ID params to encode small identifiers into the control's custom ID and receive them validated and typed in your handler.

```text
Send:   build(closeTicketId, { ticketId: "a1b2c3d4", owner: "123" })
          └─▶ custom ID: "ticket.close:a1b2c3d4:123" (not validated)
                         │
                    Discord message
                    (no bot memory)
                         │
Click:  "ticket.close:a1b2c3d4:123"
          └─▶ match route "ticket.close"
          └─▶ decode & validate params ─▶ ctx.params
          └─▶ guards (e.g. paramOwner) ─▶ run()
```

Encoding during `build()` checks Discord's 100-character limit without running the schema. Because the values live on the Discord message rather than in bot memory, buttons keep working across bot restarts. When the interaction arrives, Hyperion decodes and validates `params` before guards run.

## Defining params

Define the route, positional key order, and validation schema with `defineParams()`:

```ts
// src/buttons/close-ticket.ts
import { defineParams } from "@hyperion-js/core";
import * as v from "valibot";

export const closeTicketId = defineParams({
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
| `id`     | Route written as the first segment of every generated custom ID.                                                       |
| `keys`   | Schema property names in the exact order they are serialized into the custom ID.                                       |
| `schema` | Validates decoded values when an interaction arrives. Any [Standard Schema](https://standardschema.dev) library works. |

Standard Schema does not expose an object's property order at runtime, so `keys` locks the positional wire format (`<route>:<value1>:<value2>`). `keys` must list every property in `schema` and no extras, or TypeScript rejects the definition.

Store only small, non-sensitive identifiers in `params`—never secrets or mutable state—because custom IDs are visible to Discord clients, frozen on the message, and capped at 100 characters. The `id` route cannot contain `:` or `%`; the encoder accepts `string | number | boolean` values, stringifies them, and escapes `:` and `%` inside values automatically.

## Building controls

Pass the params definition and values to `build()` to clone the handler's template with the encoded custom ID:

```ts fragment
const button = ctx.client.buttons.build(closeTicketId, {
    ticketId: "a1b2c3d4",
    owner: user.id,
});
// Resulting custom ID: "ticket.close:a1b2c3d4:123456789012345678"
```

Select menus and modals support `build(definition, values)` in the same way. If your handler does not use a template, call the params definition as a function to encode the custom ID string for any builder:

```ts fragment
new DangerButtonBuilder()
    .setLabel("Close")
    .setCustomId(closeTicketId({ ticketId: "a1b2c3d4", owner: user.id }));
```

Hyperion throws if the encoded custom ID exceeds Discord's 100-character limit, so keep routes and values short.

## Reading params in a handler

Pass `params` to `defineButton()`, `defineSelectMenu()`, or `defineModal()`. When using a template, set the template's custom ID to `params.id`—startup validates that they match, and `build()` replaces it with the encoded string on each copy:

```ts fragment
export default defineButton({
    params: closeTicketId,
    builder: new DangerButtonBuilder()
        .setCustomId(closeTicketId.id)
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

`ctx.params` is `[null, value]` on success or `[issues, undefined]` on validation failure, matching [typed input](input.md). When validation fails, your handler decides what to reply.

## Verifying ownership

Custom IDs arrive from the user's Discord client, so treat decoded values as untrusted input. To restrict a control to the user it was created for, add the `paramOwner()` guard:

```ts fragment
guards: [paramOwner("owner", "Only the ticket author can close it.")];
```

`paramOwner()` passes only when `params` pass schema validation and the named property equals `ctx.interaction.user.id`. Because `params` validation failures still reach guards, `paramOwner()` rejects invalid params automatically; any custom guard that reads `ctx.params` must check for `issues` and return `false`. See [Guards](guards.md).

> [!WARNING]
> `paramOwner()` checks only that the clicking user matches the ID stored in the custom ID. It cannot verify that the user still owns the resource in your database. For sensitive actions, look up the record and verify ownership in your handler.

## Changing params later

Messages stay in Discord channels after you redeploy your bot. Adding, removing, or reordering `keys` on an existing route causes controls on older messages to decode incorrectly. Create a new route name such as `ticket.close.v2` instead, and keep the old handler registered if you want it to tell users the control is out of date.

If an incoming custom ID matches a route but has the wrong number of values—including when you accidentally send a `params` template directly without calling `build(def, values)`—Hyperion ignores it and logs the mismatch at `debug` level.

## Rules

- Routes must be unique within each registry and cannot collide with a fixed custom ID in the same registry. All five select-menu types share one registry, while a button, a select menu, and a modal may share the same route.
- A handler accepts either `customId` or `params`, never both.
- Decoded values arrive as strings. Convert numbers or booleans in your schema, such as `v.pipe(v.string(), v.toNumber())`.
