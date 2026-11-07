# Asking before deleting something

Some commands are hard to undo. By the end of this page, `/todo delete` will
reply with a Delete button that only the person who asked can press, and nothing
is deleted until they do.

It uses [data in custom IDs](custom-ids.md) to carry the todo and its owner,
and a [guard](guards.md) to check the clicker.

## Steps

1. Describe what the button carries. It sits next to the button handler, so the
   command can import it too:

   ```ts fragment
   // src/buttons/delete-todo.ts
   export const deleteTodo = defineParams({
       id: "todo.delete",
       keys: ["todoId", "owner"],
       schema: v.object({ todoId: v.string(), owner: v.string() }),
   });
   ```

2. Write the button handler in the same file. The template is the button
   people see, and `paramOwner("owner")` turns everyone else away:

   ```ts fragment
   export default defineButton({
       params: deleteTodo,
       builder: new DangerButtonBuilder()
           .setCustomId(deleteTodo.id)
           .setLabel("Delete"),
       guards: [paramOwner("owner", "Only you can delete your todo.")],
       async run(ctx) {
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
               content: deleted ? "Deleted." : "That todo was already gone.",
               components: [],
           });
       },
   });
   ```

   The handler deletes by ID only after the guard has checked the owner. If
   your todos can change hands, also check the stored owner before deleting:
   the custom ID only tells you who the button was built for.

3. In the command, reply with a copy of the button, built for this todo and
   this user. Making the reply ephemeral keeps the button out of everyone
   else's sight, and ignoring it is the same as cancelling:

   ```ts fragment
   // In /todo delete's run()
   const button = ctx.client.buttons.build(deleteTodo, {
       todoId: id,
       owner: ctx.interaction.user.id,
   });

   await ctx.interaction.reply({
       content: `Delete "${todo.title}"? This can't be undone.`,
       components: [new ActionRowBuilder().addComponents(button)],
       flags: MessageFlags.Ephemeral,
   });
   ```

## Check it worked

Run `/todo delete` and press Delete: the message changes to "Deleted." and the
todo is gone. To check the guard, send the reply without
`MessageFlags.Ephemeral` and have someone else press the button. They get "Only
you can delete your todo." privately, and the todo stays.

> [!WARNING]
> Change `keys` or their order after you've sent buttons, and the old buttons
> decode wrongly. Give the new version a new `id` instead, as
> [changing params later](custom-ids.md#changing-params-later) explains.
