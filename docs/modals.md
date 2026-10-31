# Modals

For form, handler, and custom-ID terminology, see the [component glossary](GLOSSARY.md#components).

Hyperion discovers default-exported `Modal` subclasses recursively under
`<root>/src/modals` and stores them in `client.modals`, keyed by exact custom ID.
The directory is optional. Each handler needs a public zero-argument constructor,
a `ModalBuilder` from `@discordjs/builders`, and `run(ctx)`.

Discovery validates builders locally through `toJSON()` before application-command
deployment. Invalid exports, builders, guards, or duplicate IDs reject client
initialization with source-file context and the original cause. Reloads are
atomic: a failure preserves the previously loaded registry. Modals have no REST
registration and loading them does not log the bot in.

## JSX authoring

`@hyperion/jsx` can author the native builder with `Modal`, `Modal.Label`,
`Modal.TextInput`, `Modal.TextDisplay`, and `renderModal()`. Alias core's handler
class as `ModalHandler` when importing both APIs. See [JSX modals](jsx-modals.md)
for defaults, validation, and fresh per-user initial values. JSX does not change
this guide's submission, guard, acknowledgment, or exact-ID routing contract.

## Define a modal

```ts
import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { Modal, type ModalContext } from "@hyperion/core";
import { MessageFlags, TextInputStyle } from "discord.js";

export default class SubmitFeedback extends Modal {
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
belong to the modal submission; they do not invoke `SelectMenu` handlers.

## Open a modal

Inside a command, button, or message select-menu handler:

```ts
const modal = ctx.client.modals.get("feedback.submit");

if (!modal) throw new Error("The feedback modal was not loaded.");

await ctx.interaction.showModal(modal.builder);
```

Opening a modal acknowledges the originating interaction. Do not reply or defer
that interaction before calling `showModal()`. Submission is a separate
interaction routed to `Modal.run()`. Modal submissions cannot open another modal.
The development bot's `/feedback` command demonstrates opening and submitting
the filesystem modal in `apps/dev-bot/src/modals/submit-feedback.ts`.

Unmatched modal IDs remain untouched for application-owned collectors and
listeners. Avoid acknowledging the same submission in both a filesystem handler
and a collector. Modal IDs are unique within `client.modals`; they do not share a
namespace with buttons or message selects.

## Guards and acknowledgment

`guards` accepts ordered `Guard<ModalContext>` instances or lazy per-invocation
factories. Shared interaction guards such as `OwnerOnly` and `Cooldown` work too.
Factories do not run during discovery. A rejection or exception stops later
guards and the handler. A custom `onFail(ctx)` owns the rejection response.
Guards on the originating command or component do not automatically apply to
the modal submission; declare submission guards on the `Modal` itself.

Hyperion does not automatically acknowledge submissions. Use `reply()` or
`deferReply()` followed by `editReply()` for a separate response. For a modal
opened from a message component, narrow with `ctx.interaction.isFromMessage()`
before using `update()` to change the source message. A deferred message update
can be completed with `editReply()`.

Guard and handler failures use the shared error pipeline: new interactions get
an ephemeral reply, deferred replies are edited, and replied interactions or
deferred message updates receive ephemeral follow-ups. An error after
`deferUpdate()` never overwrites the source message. Failed error responses are
logged and contained.

## State and logging

Handlers and builders are shared definitions, not per-user sessions. Do not
mutate the registered builder or store submitted values on handler instances.
Fetch and persist application state in application-owned storage, and perform
authorization again when processing the submission. The feedback demo only
reports the submitted character count; it does not persist feedback.

`ctx.logger` carries `modal`, `interactionId`, `guildId`, and `userId`. Framework
logs include execution duration and guard/handler failure stage, but not raw
interactions or submitted values. Do not put private form contents in logs or
error messages yourself.
