# Modals

A modal handler runs when a user submits a Discord modal form. Hyperion routes each submission to the handler matching the modal's custom ID. See the discord.js guide on [modals](https://discordjs.guide/legacy/interactions/modals) for an overview of Discord modal builders.

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
| `input`    | Optional schema for submitted modal controls. See [Validating modal controls](#validating-modal-controls).    |
| `guards`   | Checks that run before `run()`. See [Guards](guards.md).                                                      |
| `run`      | Function executed on each submission.                                                                         |

`builder` is optional even when using `input`—Hyperion reads modal controls directly from the submitted interaction—but keeping a template next to the schema keeps modal-control custom IDs and validation rules in one file.

## Showing the modal

Modal templates work like [button templates](buttons.md#sending-the-button): call `ctx.client.modals.build()` from a command, button, or select-menu handler to get a fresh copy of the template:

```ts fragment
await ctx.interaction.showModal(ctx.client.modals.build("feedback.submit"));
```

Because `build()` returns an independent copy, you can pre-fill modal controls for one user without affecting other users.

> [!WARNING]
> `showModal()` acknowledges the opening interaction. Never reply, defer, or enable `input.defer` on the command or component handler that opens the modal. Setting `input.defer` on the modal handler itself applies to the later submission, not opening the form.

When a modal is opened from a button or select menu rather than a slash command, `ctx.interaction.isFromMessage()` returns `true` and lets you update the source message directly (or set `input: { schema, defer: "update" }`). Using `defer: "update"` on a modal opened from a slash command fails at the `input` stage.

## Validating modal controls

Instead of reading submitted modal controls manually from `ctx.interaction.components`, pass an `input` schema to receive validated, typed values in `ctx.input`:

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

Hyperion passes an object to the schema with one key per modal control, named by that control's custom ID:

| Modal control                 | Value passed to the schema                                            |
| ----------------------------- | --------------------------------------------------------------------- |
| Text input                    | String, or `""` if left empty                                         |
| Select menu or checkbox group | Array of selected values or Discord IDs (`[]` if optional and empty)  |
| File upload                   | Array of discord.js `Attachment` objects (`[]` if optional and empty) |
| Radio group                   | Selected value, or `null`                                             |
| Checkbox                      | `true` or `false`                                                     |

Dotted control custom IDs (such as `"feedback.message"`) become literal flat keys on the object rather than nested objects. Duplicate control custom IDs in the same submission fail input processing when `input` is configured. To convert selected IDs into fetched users, roles, or database records, add a `resolve` function; see [Resolving values](input.md#resolving-values).

## Passing data with params

When a user submits a modal, the handler that opened it has already finished. Encode identifiers such as the target ticket ID in the modal's custom ID with `params`:

```ts fragment
export const renameTicketFormId = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

export default defineModal({
    params: renameTicketFormId,
    builder: renameForm, // Must have custom ID "ticket.rename-form"
    input,
    guards: [paramOwner("owner")],
    run: async ctx => {
        const [paramIssues, params] = ctx.params;
        const [inputIssues, value] = ctx.input;

        if (paramIssues || inputIssues) {
            await ctx.interaction.reply({
                content: "That form submission is invalid or out of date.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.reply(
            `Renamed ticket ${params.ticketId} to "${value.title}".`,
        );
    },
});

// Inside the button or command that opens the modal:
await ctx.interaction.showModal(
    ctx.client.modals.build(renameTicketFormId, params),
);
```

Hyperion validates `params` before guards run, so `paramOwner("owner")` verifies the submitting user before `input` or `run()` executes. If `params` fail validation and guards still allow execution, `input` still runs so `run()` receives both tuples. See the [interaction pipeline](how-hyperion-works.md#interaction-pipeline) and [Data in custom IDs](custom-ids.md).

## Guards

Guards on the command or button that opened a modal do not run when the modal is submitted. Attach guards to the modal handler itself: the opener's guards control who can open the form, and the modal's guards verify permissions again on submission in case roles changed while the form was open.

`client.modals` has its own custom-ID namespace separate from buttons and select menus. For how Hyperion handles rejected guards and thrown errors, see [Handling errors](how-hyperion-works.md#handling-errors).
