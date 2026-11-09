# Modals

A modal handler runs when someone submits a form your bot showed. Hyperion
routes the submission to the handler by the form's custom ID. If you need a
refresher on building forms, see the discord.js guide on
[modals](https://discordjs.guide/legacy/interactions/modals).

## A modal handler

Put handlers in `src/modals`. The form itself is the handler's template:

```ts
// src/modals/submit-feedback.ts
import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { defineModal } from "@hyperion-js/core";
import { MessageFlags, TextInputStyle } from "discord.js";

export default defineModal({
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
    run: async ctx => {
        const message =
            ctx.interaction.components.getTextInputValue("feedback.message");

        await ctx.interaction.reply({
            content: `Thanks! That's ${message.length} characters of feedback.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

The options match a select menu's, without the kind:

| Option     | What it's for                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `builder`  | The form template. Its custom ID becomes the handler's.                                               |
| `customId` | The custom ID to answer, when there's no template.                                                    |
| `params`   | Data in the custom ID. See [remembering what the form is about](#remembering-what-the-form-is-about). |
| `input`    | A schema for the fields. See [validating the fields](#validating-the-fields).                         |
| `guards`   | Checks before `run()`. See [guards](guards.md).                                                       |
| `run`      | Runs on each submission.                                                                              |

Keep a template whenever you can: typed input reads the form's fields from it.

## Showing the modal

From a command, button, or select-menu handler:

```ts fragment
await ctx.interaction.showModal(ctx.client.modals.build("feedback.submit"));
```

`build()` gives you a fresh copy of the form, so you can pre-fill values for
this user without touching anyone else's.

## Validating the fields

Rather than reading each field by hand, give the handler an input schema and get
typed values in `ctx.input`:

```ts fragment
// todoForm's custom ID, "todo.create", is the handler's.
export default defineModal({
    builder: todoForm,
    input: {
        schema: v.object({
            title: v.pipe(v.string(), v.trim(), v.minLength(1)),
        }),
    },
    run: async ctx => {
        const [issues, value] = ctx.input;
        if (issues) {
            await ctx.interaction.reply({
                content: issues.map(issue => issue.message).join("\n"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ctx.interaction.reply(`Created "${value.title}".`);
    },
});
```

The schema gets one key per control, named by the control's custom ID:

| Control                       | The schema gets                      |
| ----------------------------- | ------------------------------------ |
| Text input                    | A string; `""` when left empty       |
| Select menu or checkbox group | An array of picked values, or IDs    |
| File upload                   | An array of discord.js `Attachment`s |
| Radio group                   | The picked value, or `null`          |
| Checkbox                      | `true` or `false`                    |

To turn picked IDs into users or roles, use a resolver. See
[typed input](input.md#resolving-the-values).

## Remembering what the form is about

By the time the submission arrives, the code that showed the modal has finished.
So how does a "Rename ticket" form know _which_ ticket? Put it in the modal's
custom ID with params:

```ts fragment
export const renameTicketForm = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

export default defineModal({
    params: renameTicketForm,
    builder: renameForm, // its custom ID is the route, "ticket.rename-form"
    input,
    guards: [paramOwner("owner")],
    run: async ctx => {
        const [paramIssues, params] = ctx.params; // which ticket
        const [inputIssues, value] = ctx.input; // what the user typed
    },
});

// In the Rename button's handler:
await ctx.interaction.showModal(
    ctx.client.modals.build(renameTicketForm, params),
);
```

Params are checked before your guards run, so `paramOwner("owner")` makes sure
only the user the form was opened for can submit it. See
[data in custom IDs](custom-ids.md) for how params work.

## Guards

Guards on whatever opened the form don't apply to the submission, so add them to
the modal handler too. The opener's guards decide who sees the form, and the
modal's guards decide what gets accepted. Roles can change while a form is open,
so check again here.
