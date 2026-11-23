# Confirming destructive actions

This guide shows how to add a confirmation button to a `/todo delete` command so nothing is deleted until the original user clicks Delete. It combines [custom ID params](custom-ids.md) to store the todo ID and owner with the `paramOwner()` [guard](guards.md) to verify who clicked.

## Steps

1. Define the params next to the button handler so the command can import them:

   ```ts fragment
   // src/buttons/delete-todo.ts
   export const deleteTodo = defineParams({
       id: "todo.delete",
       keys: ["todoId", "owner"],
       schema: v.object({ todoId: v.string(), owner: v.string() }),
   });
   ```

2. Add the button handler in the same file. Set `builder` to the confirmation button template and attach `paramOwner("owner")` to reject other users:

   ```ts fragment
   export default defineButton({
       params: deleteTodo,
       builder: new DangerButtonBuilder()
           .setCustomId(deleteTodo.id)
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

           const deleted = todos.delete({ id: params.todoId });

           await ctx.interaction.update({
               content: deleted ? "Deleted." : "That todo was already deleted.",
               components: [],
           });
       },
   });
   ```

   The handler deletes the record only after `paramOwner()` verifies the user. If todos can transfer ownership after the button is sent, also check the owner stored in your database before deleting.

3. In your `/todo delete` command, build a copy of the button with the todo ID and the requesting user's ID, and send it in an ephemeral reply:

   ```ts fragment
   // Inside /todo delete run()
   const button = ctx.client.buttons.build(deleteTodo, {
       todoId: id,
       owner: ctx.interaction.user.id,
   });

   await ctx.interaction.reply({
       content: `Delete "${todo.title}"? This cannot be undone.`,
       components: [new ActionRowBuilder().addComponents(button)],
       flags: MessageFlags.Ephemeral,
   });
   ```

   Sending the confirmation ephemerally keeps the button private to the user, and dismissing the message cancels the deletion without needing a separate Cancel button.

## Verifying it works

Run `/todo delete` and click Delete. The message should update to "Deleted." and remove the todo from storage. To verify the guard, temporarily remove `flags: MessageFlags.Ephemeral` and ask another user to click the button. They should receive the ephemeral rejection "Only you can delete your todo.", and the todo should remain intact.

> [!WARNING]
> Do not add, remove, or reorder `keys` after sending buttons to Discord, because existing buttons will decode incorrectly. Use a new `id` route instead, as explained in [Changing params later](custom-ids.md#changing-params-later).
