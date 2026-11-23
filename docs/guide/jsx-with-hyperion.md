# JSX with Hyperion

`@hyperion-js/jsx` works standalone with any discord.js bot, and it integrates directly with `@hyperion-js/core`. Hyperion component handlers can store a template builder on `builder`, which you can author with `@hyperion-js/jsx`. If you have not configured `@hyperion-js/jsx` yet, start with the [JSX guide](jsx.md).

## Writing handlers as `.tsx` files

Hyperion discovers `.tsx` handler files alongside `.ts` files in every handler directory. Once you configure the JSX transform in `tsconfig.json` as shown in [JSX setup](jsx.md#setup), rename any handler file to `.tsx` and write JSX directly inside it. No extra Hyperion flag or build step is required.

Make sure `tsconfig.json` includes `src/**/*.tsx` so your editor and type checker cover your handler files.

## Buttons and menus as templates

Use `renderButton()` to define a button handler's `builder` template in JSX:

```tsx
// src/buttons/refresh-profile.tsx
import { defineButton } from "@hyperion-js/core";
import { Button, renderButton } from "@hyperion-js/jsx";

export default defineButton({
    builder: renderButton(
        <Button customId="profile.refresh" style="primary">
            Refresh
        </Button>,
    ),
    run: async ctx => {
        await ctx.interaction.update({ content: "Refreshed!" });
    },
});
```

The button's `customId` becomes the handler's custom ID, so you only define it once.

Inside a command or another handler, call `build()` on the registry to get a copy of the template:

```ts fragment
import { ActionRowBuilder } from "@discordjs/builders";

await ctx.interaction.reply({
    content: "Your profile",
    components: [
        new ActionRowBuilder().addComponents(
            ctx.client.buttons.build("profile.refresh"),
        ),
    ],
});
```

`build()` returns a fresh copy with the custom ID set, so you can change its label or disable it without modifying the shared template.

Select menus work the same way using the matching render function for each menu type, such as `renderStringSelect()` or `renderUserSelect()`. See [Buttons](buttons.md) and [Select menus](select-menus.md) for routing and guards.

## Controls that carry data

When a handler uses [custom ID params](custom-ids.md), set the JSX template's `customId` to the params route ID. Calling `build()` then appends the encoded parameter values:

```tsx
// src/buttons/close-ticket.tsx
import { defineButton, defineParams } from "@hyperion-js/core";
import { Button, renderButton } from "@hyperion-js/jsx";
import * as v from "valibot";

export const closeTicket = defineParams({
    id: "ticket.close",
    keys: ["ticketId"],
    schema: v.object({ ticketId: v.string() }),
});

export default defineButton({
    params: closeTicket,
    builder: renderButton(
        <Button customId="ticket.close" style="danger">
            Close
        </Button>,
    ),
    run: async ctx => {
        const [issues, params] = ctx.params;

        if (issues) return;

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId} closed.`,
            components: [],
        });
    },
});
```

In a command, build a copy for a specific ticket:

```ts fragment
const button = ctx.client.buttons.build(closeTicket, { ticketId });
```

When a user clicks the button, Hyperion decodes and validates the values and passes them to `run()` as `ctx.params`. See [Data in custom IDs](custom-ids.md) for ownership checks and versioning rules.

## Forms as templates

Define a modal handler's template with `renderModal()`:

```tsx
// src/modals/create-todo.tsx
import { defineModal } from "@hyperion-js/core";
import { Modal, renderModal } from "@hyperion-js/jsx";

const TodoForm = () => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" maxLength={100} />
        </Modal.Label>
    </Modal>
);

export default defineModal({
    builder: renderModal(<TodoForm />),
    run: async ctx => {
        const name = ctx.interaction.components.getTextInputValue("name");

        await ctx.interaction.reply(`Created "${name}".`);
    },
});
```

Show a copy of the template from a command or component handler:

```ts fragment
await ctx.interaction.showModal(ctx.client.modals.build("todo.create"));
```

To show a pre-filled form for one user, render your JSX component directly with props and the same `customId`, as shown in [Pre-filled forms](jsx/modals.md#pre-filled-forms), and pass that modal to `showModal()`. The handler's shared template remains unchanged.

You can also combine JSX modal templates with [typed input](input.md) and custom ID params. See [Modals](modals.md) for full details.

## Layout messages

Buttons and select menus inside a [layout message](jsx/layout-messages.md) route to your Hyperion handlers like any other component. Pass the same custom IDs, or call `build()`, inside your `renderMessage()` view.

If a handler defers, edits its reply into a layout message, and then throws an error, Hyperion cannot edit error text into `content` because Discord layout messages forbid `content`. Hyperion sends the error message as an ephemeral follow-up instead.

## Next steps

- [Responding](responding.md) explains deferring and error responses.
- [Guards](guards.md) explains restricting access to handlers.
- [Data in custom IDs](custom-ids.md) explains parameter encoding and ownership checks.
