# JSX with Hyperion

`@hyperion-js/jsx` integrates directly with `@hyperion-js/core` so you can author handler templates and message responses in `.tsx` files. Configure TypeScript first by following [JSX setup](../jsx.md#setup).

Choose between a handler template and inline JSX based on how much the control varies:
- **Handler `builder` template + `build()`:** Render a shared template (`renderButton()`, `render*Select()`, `renderModal()`) and stamp out copies with `client.*.build()` when the control or form looks the same everywhere, optionally appending `params`.
- **Inline JSX:** Omit `builder` (passing `customId` or `params` on the handler) and render JSX at the call site (`renderComponents()`, `renderMessage()`, `renderModal()`) when labels, options, `disabled` state, pre-filled values, or layout messages vary per message or user.

## Writing handlers as `.tsx` files

Hyperion discovers `.tsx` handler files alongside `.ts` files in every handler folder. Once `tsconfig.json` configures `jsxImportSource` and includes `src/**/*.tsx`, rename any handler file to `.tsx` and write JSX directly inside it with no extra Hyperion option or build step.

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

The button's `customId` becomes the handler's custom ID, so you define it once. Call `ctx.client.buttons.build()` from a command or handler to get an independent copy of the shared template (see [Sending the button](../buttons.md#sending-the-button)):

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

Select-menu templates work the same way using the renderer matching `componentType`: `renderStringSelect()`, `renderUserSelect()`, `renderRoleSelect()`, `renderMentionableSelect()`, or `renderChannelSelect()`. The rendered builder must match the handler's `componentType` or startup loading fails. See [Buttons](../buttons.md) and [Select menus](../select-menus.md) for routing and guards.

## Controls that carry data

When a handler uses [custom-ID params](../custom-ids.md), set the JSX template's `customId` to the `params` route (`params.id`). Calling `build()` appends the encoded values to each copy:

```tsx
// src/buttons/close-ticket.tsx
import { defineButton, defineParams } from "@hyperion-js/core";
import { Button, renderButton } from "@hyperion-js/jsx";
import { MessageFlags } from "discord.js";
import * as v from "valibot";

export const closeTicketId = defineParams({
    id: "ticket.close",
    keys: ["ticketId"],
    schema: v.object({ ticketId: v.string() }),
});

export default defineButton({
    params: closeTicketId,
    builder: renderButton(
        <Button customId={closeTicketId.id} style="danger">
            Close
        </Button>,
    ),
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

Build a copy for a specific ticket from a command:

```ts fragment
const button = ctx.client.buttons.build(closeTicketId, { ticketId });
```

When a user clicks the button, Hyperion decodes and validates the values before passing them to `run()` as `ctx.params`. See [Data in custom IDs](../custom-ids.md) for ownership checks and versioning rules.

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

To show a pre-filled form for one user, call `renderModal(<TodoForm initialName={...} />)` directly (see [Pre-filled forms](modals.md#pre-filled-forms)) and pass that builder to `showModal()`. Keep the `<Modal>` `customId` (or encoded `params` string) matching the registered handler's route so the submission still routes to it. You can combine JSX modal templates with [typed input](../input.md) and custom-ID params; see [Modals](../modals.md).

## Layout messages

Buttons and select menus inside a [layout message](layout-messages.md) route to your Hyperion handlers like any other component. Because `@hyperion-js/jsx` rejects prebuilt `@discordjs/builders` instances as JSX children (`JSXRenderError`), do not call `client.*.build()` inside `renderMessage()` or `renderComponents()`. Instead, render JSX `<Button>` or select elements directly with the handler's fixed `customId` or the params encoder function:

```tsx fragment
const message = renderMessage(
    <Container>
        <TextDisplay>Ticket #{ticketId}</TextDisplay>
        <ActionRow>
            <Button customId={closeTicketId({ ticketId })} style="danger">
                Close
            </Button>
        </ActionRow>
    </Container>,
);
```

If a handler defers, edits its reply into a layout message, and then throws an error, Hyperion cannot edit plain error text into `content` because Discord layout messages forbid `content`. Hyperion sends the error message as an ephemeral follow-up instead; see [Handling errors](../how-hyperion-works.md#handling-errors).

## Next steps

- [How Hyperion works](../how-hyperion-works.md) covers startup, the interaction pipeline, deferring, and error responses.
- [Guards](../guards.md) covers restricting access to handlers.
- [Data in custom IDs](../custom-ids.md) covers parameter encoding and ownership checks.
