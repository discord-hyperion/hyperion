# Modals

A modal handler runs when a user submits a Discord modal form. Hyperion routes the submission to the handler matching the modal's custom ID. See the discord.js guide on [modals](https://discordjs.guide/legacy/interactions/modals) for an overview of modal builders.

## Defining a modal handler

Place modal handlers in `src/modals/`. The modal builder is the handler's template:

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
            content: `Thanks! You submitted ${message.length} characters of feedback.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

Modal handlers accept these options:

| Option     | Purpose                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `builder`  | Optional form template. Its custom ID becomes the handler's custom ID.                                        |
| `customId` | Fixed custom ID to match when you do not provide a template.                                                  |
| `params`   | Typed parameter definition for dynamic custom IDs. See [Passing data with params](#passing-data-with-params). |
| `input`    | Optional schema for submitted form fields. See [Validating fields](#validating-fields).                       |
| `guards`   | Checks that run before `run()`. See [Guards](guards.md).                                                      |
| `run`      | Function executed on each submission.                                                                         |

Include a `builder` template when using `input` so Hyperion can inspect the form's fields.

## Showing the modal

Call `ctx.client.modals.build()` from a command, button, or select-menu handler:

```ts fragment
await ctx.interaction.showModal(ctx.client.modals.build("feedback.submit"));
```

`build()` returns a fresh copy of the template, so you can pre-fill fields for one user without affecting other users.

## Validating fields

Instead of reading fields manually from `ctx.interaction.components`, pass an `input` schema to receive validated, typed values in `ctx.input`:

```ts fragment
// todoForm has the custom ID "todo.create", which becomes the handler's custom ID.
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

Hyperion passes an object to the schema with one key per form control, named by that control's custom ID:

| Control                       | Value passed to the schema               |
| ----------------------------- | ---------------------------------------- |
| Text input                    | String, or `""` if left empty            |
| Select menu or checkbox group | Array of selected values or Discord IDs  |
| File upload                   | Array of discord.js `Attachment` objects |
| Radio group                   | Selected value, or `null`                |
| Checkbox                      | `true` or `false`                        |

To convert selected IDs into fetched users, roles, or database records, add a `resolve` function. See [Typed input](input.md#resolving-values).

## Passing data with params

When a user submits a modal, the handler that opened it has already finished. To track which record the form applies to, such as which ticket to rename, encode that ID in the modal's custom ID with `params`:

```ts fragment
export const renameTicketForm = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

export default defineModal({
    params: renameTicketForm,
    builder: renameForm, // Must have custom ID "ticket.rename-form"
    input,
    guards: [paramOwner("owner")],
    run: async ctx => {
        const [paramIssues, params] = ctx.params;
        const [inputIssues, value] = ctx.input;
    },
});

// Inside the button or command that opens the modal:
await ctx.interaction.showModal(
    ctx.client.modals.build(renameTicketForm, params),
);
```

Hyperion decodes and validates `params` before running guards, so `paramOwner("owner")` checks that the submitting user matches the `owner` ID encoded when the form opened. See [Data in custom IDs](custom-ids.md) for details.

## Guards

Guards on the command or button that opened a modal do not run when the modal is submitted. Attach guards to the modal handler itself. The opener's guards control who can open the form, and the modal's guards verify permissions again when the user submits it, in case roles changed while the form was open.
