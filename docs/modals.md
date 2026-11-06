# Modals

For form, handler, and custom-ID terminology, see the [component glossary](GLOSSARY.md#components).

Hyperion discovers default-exported `ModalHandler` subclasses recursively under
`<root>/src/modals` and stores them in `client.modals`, keyed by exact custom ID.
The directory is optional. Each handler needs a public zero-argument constructor,
an ID, and `run(ctx)`. It should also offer its form as a
[template](GLOSSARY.md#components): a `ModalBuilder` from `@discordjs/builders`.
The template is optional, but recommended, because `input` reads the form's
text-input custom IDs and keeping both in one handler keeps them in agreement.

Discovery validates templates locally through `toJSON()`, with the custom ID set,
before application-command deployment. A handler gets its ID from exactly one source: `customId`, a template whose
custom ID becomes the handler's, or `params`, whose route the optional template
must carry as its custom ID. Passing `customId` beside a template is a type error
and throws. So does a template without a custom ID, or a params template whose
custom ID isn't the route. Loading also rejects a template whose custom ID changed
after construction. Invalid exports, templates, guards, or duplicate IDs reject client
initialization with source-file context and the original cause. Reloads are
atomic: a failure preserves the previously loaded registry. Modals have no REST
registration and loading them does not log the bot in.

## JSX authoring

`@hyperion/jsx` can author the native builder with `Modal`, `Modal.Label`,
`Modal.TextInput`, `Modal.TextDisplay`, and `renderModal()`. Core's
`ModalHandler` and JSX's `Modal` can be imported together. See [JSX modals](jsx-modals.md)
for defaults, validation, and fresh per-user initial values. JSX does not change
this guide's submission, guard, acknowledgment, or exact-ID routing contract.

## Define a modal

```ts
import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { ModalHandler, type ModalContext } from "@hyperion/core";
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
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(1_000),
                        ),
                ),
        });
    }

    async run(ctx: ModalContext) {
        const message =
            ctx.interaction.components.getTextInputValue("feedback.message");

        await ctx.interaction.reply({
            content: `Received ${message.length} characters of feedback. This demo does not store submissions.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
```

This uses the installed discord.js v15 APIs: labels wrap text inputs, and
`ctx.interaction` is a `ModalSubmitInteraction` with a `.components` resolver,
not the older `.fields` API. Other builder-supported modal components are passed
through unchanged. For example, read embedded string selects with
`ctx.interaction.components.getStringSelectValues(customId)`. Embedded selects
belong to the modal submission; they do not invoke `SelectMenuHandler` handlers.

## Templates

The modal registry retains the handler's reusable form **template** in `builder`.
`build("feedback.submit")` creates a fresh form with a fixed ID.
`build(definition, values)` creates a fresh form with an encoded custom ID that
Hyperion can parse on submission. Params identify the form's application data;
text-input IDs identify fields within it. Neither build changes the template.

## Open a modal

Inside a command, button, or message select-menu handler:

```ts fragment
await ctx.interaction.showModal(ctx.client.modals.build("feedback.submit"));
```

`build()` returns a fresh copy of the template with its custom ID set, so callers
can adjust it (for example with initial values) without changing the shared
template. It throws when no handler is loaded for the ID or the handler has no
template.

Opening a modal acknowledges the originating interaction. Do not reply or defer
that interaction before calling `showModal()`. Submission is a separate
interaction routed to `ModalHandler.run()`. Modal submissions cannot open another modal.

Unmatched modal IDs remain untouched for application-owned collectors and
listeners. Avoid acknowledging the same submission in both a filesystem handler
and a collector. Modal IDs are unique within `client.modals`; they do not share a
namespace with buttons or message selects.

## Carry data in the custom ID

A submission is a separate interaction, so the code that showed the modal has
already returned. To tell the modal handler which record the form is about,
declare typed [custom-ID params](custom-id-params.md) instead of `customId`:

```ts fragment
export const renameTicketForm = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

const input = defineInput({
    schema: v.object({ title: v.pipe(v.string(), v.trim(), v.minLength(1)) }),
});

type RenameTicketSpec = {
    params: typeof renameTicketForm;
    input: typeof input;
};

export default class RenameTicket extends ModalHandler<RenameTicketSpec> {
    constructor() {
        super({
            params: renameTicketForm,
            builder: new ModalBuilder()
                .setCustomId(renameTicketForm.id)
                .setTitle("Rename ticket") /* … "title" text input */,
            input,
            guards: [paramOwner("owner")],
        });
    }

    async run(ctx: ModalContext<RenameTicketSpec>) {
        const [paramIssues, params] = ctx.params; // Which ticket, from the custom ID.
        const [inputIssues, value] = ctx.input; // The new title, from the form.
    }
}

// In a button handler:
await ctx.interaction.showModal(
    ctx.client.modals.build(renameTicketForm, { ticketId, owner }),
);
```

Params are decoded and validated before guards, so guards (such as
`paramOwner()`) can read `ctx.params` but never `ctx.input`. Input then runs, even
when params have issues, so the handler receives both tuples and chooses the
response. A params handler is stored in `client.modals.routes`.
`build(definition, values)` returns a fresh copy of the form with the encoded
custom ID, which Hyperion decodes and validates when the form is submitted.

## Guards and acknowledgment

`guards` accepts ordered `Guard<ModalContext>` instances or lazy per-invocation
factories. Shared interaction guards such as `ownerOnly` and `cooldown()` work too.
Factories do not run during discovery. A rejection or exception stops later
guards and the handler. A custom `onFail(ctx)` owns the rejection response.
Guards on the originating command or component do not automatically apply to
the modal submission; declare submission guards on the `ModalHandler` itself.
Opener guards decide who sees the form; submission guards decide what gets
accepted. The form can stay open while roles or application state change, and
the submitted custom ID comes from the client, so check again on submission.

Without `input.defer`, Hyperion does not automatically acknowledge submissions. Use `reply()` or
`deferReply()` followed by `editReply()` for a separate response. For a modal
opened from a message component, narrow with `ctx.interaction.isFromMessage()`
before using `update()` to change the source message. A deferred message update
can be completed with `editReply()`. `input.defer: "update"` makes that
deferral automatic; it fails at the `input` stage for a modal not opened from a
message component.

Guard and handler failures use the shared error pipeline: new interactions get
an ephemeral reply, deferred replies are edited, and replied interactions or
deferred message updates receive ephemeral follow-ups. An error after
`deferUpdate()` never overwrites the source message. Failed error responses are
logged and contained.

## Type arguments

`ModalHandler` and `ModalContext` take one object type argument with the
optional keys `params` and `input`, named like the constructor options. With no
type argument there are neither. Name the object once with a type alias and pass
it to both. Unknown keys are type errors, as is an input whose resolver expects
other params.

## Typed submission input

Modal handlers can optionally configure `input` with a Standard Schema-compatible
schema, deferral, and whole-input resolution. Use `defineInput`,
`ModalHandler<{ input: typeof input }>`, and `ModalContext<{ input: typeof input }>` to infer handler
values. The optional `builder` supplies the shared form template; `customId` or
`params` defines routing. Keep a template to use `client.modals.build()`, or author
the form separately with a matching custom ID and text-input IDs.

Processing runs after guards. Expected validation issues reach the handler through
`ctx.input`; schema/resolver exceptions and extraction failures use the existing
error pipeline with `stage: "input"`. Input values and expected issues are not
logged. Schema-free handlers retain their existing contexts and acknowledgment
behavior. See [modal input validation](modal-input-validation.md) for extraction
rules and a complete example.

## State and logging

Handlers and builders are shared definitions, not per-user sessions. Do not
mutate the registered builder or store submitted values on handler instances.
Fetch and persist application state in application-owned storage, and perform
authorization again when processing the submission. The feedback demo only
reports the submitted character count; it does not persist feedback.

`ctx.logger` carries `modal`, `interactionId`, `guildId`, and `userId`. Framework
logs include execution duration and guard/input/handler failure stage, but not raw
interactions or submitted values. Do not put private form contents in logs or
error messages yourself.
