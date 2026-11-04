# JSX with Hyperion

`@hyperion/jsx` works fine on its own, but it fits Hyperion especially well.
Hyperion handlers can keep a **template**, a ready-made button, menu, or form,
and JSX is a comfortable way to write one. This page covers how the two fit
together. New to the JSX package? Start with the [JSX guide](jsx.md).

## Handlers as `.tsx` files

Hyperion discovers `.tsx` handlers just like `.ts` ones. Set up the JSX
transform as described in the [JSX guide](jsx.md#setup), then name your handler
files `.tsx`. There's no flag to turn on and no build step.

Make sure your `tsconfig.json` includes your handler folders (`src/**/*.tsx`),
not only your entry file. Otherwise your editor can't type them.

## Buttons and menus as templates

A button handler can carry the button's design as its `builder`. `renderButton()`
is the JSX way to write one:

```tsx
// src/buttons/refresh-profile.tsx
import { type ButtonContext, ButtonHandler } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default class RefreshProfile extends ButtonHandler {
    constructor() {
        super({
            customId: "profile.refresh",
            builder: renderButton(
                <Button customId="profile.refresh" style="primary">
                    Refresh
                </Button>,
            ),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.update({ content: "Refreshed!" });
    }
}
```

JSX buttons need a `customId`, so you write it twice: once on the handler, once
on the button. Hyperion checks that they match when it loads the handler.

When a command needs the button, it asks the registry for a copy:

```ts
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

`build()` gives you a fresh copy with the custom ID filled in, so you can change
its label or disable it without touching the shared template.
`renderStringSelect()` does the same job for select menus. The core guide's
[buttons](buttons.md) and [select menus](select-menus.md) pages cover routing,
guards, and responding.

## Controls that carry data

One handler can serve many buttons if each carries its own data in its custom
ID. With a params handler, the template's custom ID is the route, and `build()`
writes the values after it:

```tsx
// src/buttons/close-ticket.tsx
import {
    type ButtonContext,
    ButtonHandler,
    defineParams,
} from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";
import * as v from "valibot";

export const closeTicket = defineParams({
    id: "ticket.close",
    keys: ["ticketId"],
    schema: v.object({ ticketId: v.string() }),
});

export default class CloseTicket extends ButtonHandler<typeof closeTicket> {
    constructor() {
        super({
            params: closeTicket,
            builder: renderButton(
                <Button customId="ticket.close" style="danger">
                    Close
                </Button>,
            ),
        });
    }

    async run(ctx: ButtonContext<typeof closeTicket>) {
        const [issues, params] = ctx.params;
        if (issues) return;

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId} closed.`,
            components: [],
        });
    }
}
```

A command then calls `ctx.client.buttons.build(closeTicket, { ticketId })` for
each ticket's button. When someone clicks, Hyperion reads the values back out of
the custom ID, validates them, and hands them to your handler as `ctx.params`.
[Data in custom IDs](custom-ids.md) explains the details, including how to check
that the person clicking owns the ticket.

## Forms as templates

A modal handler keeps its form the same way, with `renderModal()`:

```tsx
// src/modals/create-todo.tsx
import { type ModalContext, ModalHandler } from "@hyperion/core";
import { Modal, renderModal } from "@hyperion/jsx";

const TodoForm = () => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" maxLength={100} />
        </Modal.Label>
    </Modal>
);

export default class CreateTodo extends ModalHandler {
    constructor() {
        super({ customId: "todo.create", builder: renderModal(<TodoForm />) });
    }

    async run(ctx: ModalContext) {
        const name = ctx.interaction.components.getTextInputValue("name");

        await ctx.interaction.reply(`Created "${name}".`);
    }
}
```

To open the form, a command calls
`ctx.interaction.showModal(ctx.client.modals.build("todo.create"))`. To
pre-fill it for one person, render the view yourself with the same modal custom
ID, as in the [modals](jsx/modals.md#pre-filled-forms) page, and show that
instead. Either way, the shared template stays unchanged.

Rather than reading each field by hand, you can let [typed input](input.md)
validate the submission, and use params (as with buttons above) when the form
needs to remember something, like which ticket you're renaming. The core guide's
[modals](modals.md) page covers all of it.

## Layout messages

Buttons inside a [layout message](jsx/layout-messages.md) are routed to your
handlers like any other. Use the same custom IDs, or `build()` copies, inside
your `renderMessage()` view.

If a handler defers, edits its reply into a layout message, and then fails,
Hyperion can't put its usual error text into the message (layout messages can't
have `content`). It sends the error as a private follow-up instead, so your
user still sees something.

## Where next

- [Responding](responding.md): replying, deferring, and what happens on errors.
- [Guards](guards.md): restrict who can click.
- [Data in custom IDs](custom-ids.md): params, validation, and ownership checks.
