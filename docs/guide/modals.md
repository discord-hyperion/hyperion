# Modals

A modal is a pop-up form. You show it in response to a command or a click, the
user fills it in, and the submission arrives later as a separate interaction.
Hyperion routes that submission to a modal handler by its custom ID.

## A modal handler

Put handlers in `src/modals`. The registry keeps the handler’s `builder` as a reusable **template**, because
it reads the form's fields when the submission comes back. The form's custom ID
is the handler's, so there's no separate `customId`:

```ts
// src/modals/submit-feedback.ts
import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { type ModalContext, ModalHandler } from "@hyperion/core";
import { MessageFlags, TextInputStyle } from "discord.js";

export default class SubmitFeedback extends ModalHandler {
    constructor() {
        super({
            builder: new ModalBuilder()
                .setCustomId("feedback.submit")
                .setTitle("Feedback")
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Your feedback")
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("feedback.message")
                                .setStyle(TextInputStyle.Paragraph),
                        ),
                ),
        });
    }

    async run(ctx: ModalContext) {
        const message =
            ctx.interaction.components.getTextInputValue("feedback.message");

        await ctx.interaction.reply({
            content: `Thanks! That's ${message.length} characters of feedback.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
```

In discord.js v15, text inputs sit inside labels, and you read values through
`ctx.interaction.components` (not the older `.fields`).

## Showing the modal

From a command, button, or select-menu handler:

```ts
await ctx.interaction.showModal(ctx.client.modals.build("feedback.submit"));
```

`build()` gives you a fresh copy of the form, so you can pre-fill values for this
user without touching anyone else's. Remember that showing a modal _is_ the
response, so don't reply or defer first.

## Validating the fields

Rather than reading each field by hand, give the handler an input schema and get
typed values in `ctx.input`:

```ts
const input = defineInput({
    schema: v.object({ title: v.pipe(v.string(), v.trim(), v.minLength(1)) }),
});

type CreateTodoSpec = { input: typeof input };

export default class CreateTodo extends ModalHandler<CreateTodoSpec> {
    constructor() {
        // todoForm's custom ID, "todo.create", is the handler's.
        super({ builder: todoForm, input });
    }

    async run(ctx: ModalContext<CreateTodoSpec>) {
        const [issues, value] = ctx.input;
        if (issues) {
            await ctx.interaction.reply({
                content: issues[0].message,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ctx.interaction.reply(`Created "${value.title}".`);
    }
}
```

Each control in the form shows up under its custom ID. Text inputs give you a
string, and empty ones arrive as `""`, so let the schema decide what's allowed.
Other controls work the same way:
- Select menus and checkbox groups give an array of the picked values. For user,
  role, and channel selects, that's their IDs.
- File uploads give an array of discord.js `Attachment`s, so your schema can check
  size and type.
- A radio group gives the picked value, or `null`. A checkbox gives `true` or
  `false`.

Need the picked users or roles themselves? Read them in a resolver with
`ctx.interaction.components.getSelectedUsers()` and friends. See
[typed input](input.md) for resolvers and deferring.

## Remembering what the form is about

By the time the submission arrives, the code that showed the modal has finished.
So how does a "Rename ticket" form know _which_ ticket? Put it in the modal's
custom ID with params:

```ts
export const renameTicketForm = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

type RenameTicketSpec = {
    input: typeof input;
    params: typeof renameTicketForm;
};

export default class RenameTicket extends ModalHandler<RenameTicketSpec> {
    constructor() {
        super({
            params: renameTicketForm,
            builder: renameForm, // its custom ID is the route, "ticket.rename-form"
            input,
            guards: [paramOwner("owner")],
        });
    }

    async run(ctx: ModalContext<RenameTicketSpec>) {
        const [paramIssues, params] = ctx.params; // which ticket
        const [inputIssues, value] = ctx.input; // what the user typed
    }
}

// In the Rename button's handler:
await ctx.interaction.showModal(
    ctx.client.modals.build(renameTicketForm, params),
);
```

The params are checked before your guards run, so `paramOwner("owner")` can make
sure only the ticket's author submits it. See [data in custom IDs](custom-ids.md)
for how params work.

## Guards and responses

Guards on the command or button that opened the form don't apply to the
submission, so add them to the modal handler too. The opener's guards decide who
sees the form; the modal's guards decide what gets accepted. A form can stay open
for a while, and things like roles can change before it's submitted. Responding works as usual,
see [responding](responding.md). To change the message the form was opened
from, check `ctx.interaction.isFromMessage()` and then call `update()`.
