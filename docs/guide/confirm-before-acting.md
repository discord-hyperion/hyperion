# Confirming destructive actions

Add a confirmation button to a `/todo delete` command so nothing is deleted until the original user clicks Delete. This pattern pairs [custom-ID params](custom-ids.md) with the `paramOwner()` [guard](guards.md).

## Steps

1. Define the params next to the button handler so the command can import them:

   ```ts fragment
   // src/buttons/delete-todo.ts
   import { DangerButtonBuilder } from "@discordjs/builders";
   import { defineButton, defineParams, paramOwner } from "@hyperion-js/core";
   import * as v from "valibot";
   import { todos } from "../database.ts";

   export const deleteTodoId = defineParams({
       id: "todo.delete",
       keys: ["todoId", "owner"],
       schema: v.object({ todoId: v.string(), owner: v.string() }),
   });
   ```

2. Add the button handler in the same file, using `builder` for the confirmation button template and `paramOwner("owner")` to reject other users:

   ```ts fragment
   export default defineButton({
       params: deleteTodoId,
       builder: new DangerButtonBuilder()
           .setCustomId(deleteTodoId.id)
           .setLabel("Delete"),
       guards: [paramOwner("owner", "Only you can delete your todo.")],
       run: async ctx => {
           const [issues, params] = ctx.params;

           if (issues) {
               await ctx.interaction.update({
                   content: "This button is out of date.",
                   components: [],
               });

               return;
           }

           const deleted = todos.delete({
               id: params.todoId,
               owner: ctx.interaction.user.id,
           });

           await ctx.interaction.update({
               content: deleted ? "Deleted." : "That todo was already deleted.",
               components: [],
           });
       },
   });
   ```

   Scoping [`todos.delete()`](sqlite.md) by both `id` and `owner` verifies current storage ownership even if records can transfer after the button is sent. Remember that guards on `/todo delete` (such as `requirePermissions()`) do not run on button clicks—attach any required permission guards to the button handler as well (see [Button guards](buttons.md#guards)).

3. In `/todo delete`, build a copy of the button with the todo ID and requesting user ID, and send it in an ephemeral reply:

   ```ts fragment
   // Import ActionRowBuilder from "@discordjs/builders", MessageFlags from "discord.js",
   // and deleteTodoId from "../buttons/delete-todo.ts".
   const button = ctx.client.buttons.build(deleteTodoId, {
       todoId: id,
       owner: ctx.interaction.user.id,
   });

   await ctx.interaction.reply({
       content: `Delete "${todo.title}"? This cannot be undone.`,
       components: [new ActionRowBuilder().addComponents(button)],
       flags: MessageFlags.Ephemeral,
   });
   ```

   Ephemeral confirmations expire after 15 minutes (Discord's interaction token window), and dismissing the message cancels the deletion. For public confirmations, add a Cancel button and re-check permissions on the handler.

## Verifying it works

Run `/todo delete` and click Delete. The message should update to `"Deleted."` and remove the todo from storage. To verify the guard, temporarily remove `flags: MessageFlags.Ephemeral` and ask another user to click the button: they should receive the ephemeral rejection `"Only you can delete your todo."`, and the todo should remain intact.

> [!WARNING]
> Do not add, remove, or reorder `keys` after sending buttons to Discord, because existing buttons will decode incorrectly. Use a new route `id` instead, as explained in [Changing params later](custom-ids.md#changing-params-later).
