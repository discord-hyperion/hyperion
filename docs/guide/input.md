# Typed input

Typed input validates command options, select-menu selections, and modal controls with any [Standard Schema](https://standardschema.dev) library (such as Valibot or Zod) and passes `[null, value]` or `[issues, undefined]` to `run()`.

## Defining command input

Pass an `input` object with a `schema` to `defineCommand()`:

```ts
// src/commands/echo.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";
import * as v from "valibot";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("echo")
        .setDescription("Repeat a message.")
        .addStringOptions(option =>
            option
                .setName("text")
                .setDescription("What to say")
                .setRequired(true),
        )
        .addIntegerOptions(option =>
            option.setName("times").setDescription("How many times"),
        ),
    input: {
        schema: v.object({
            text: v.pipe(
                v.string(),
                v.trim(),
                v.minLength(1, "Enter at least one character."),
            ),
            times: v.optional(v.number(), 1),
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

        await ctx.interaction.reply(value.text.repeat(value.times));
    },
});
```

The command builder defines the options Discord displays to users, while `schema` validates incoming values and applies defaults. Hyperion does not check schema property names against builder option names at startup, so a misspelled key arrives as `undefined` at runtime.

| Option    | Purpose                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `schema`  | Validates incoming values and infers their TypeScript types.                                                      |
| `resolve` | Optional function that transforms validated values before `run()`. See [Resolving values](#resolving-values).     |
| `defer`   | Optional automatic defer before validation runs. See [Deferring before validation](#deferring-before-validation). |

`ctx.input` is always `[null, value]` on success or `[issues, undefined]` on validation failure. Hyperion does not send validation errors automatically; check `if (issues)` and reply however your command needs, and TypeScript narrows `value` afterward.

To share one input definition across handlers or type an external helper function with `CommandContext<typeof input>`, wrap it in `defineInput()`:

```ts fragment
const todoInput = defineInput({
    schema: v.object({ id: v.string() }),
});

const handleTodo = async (ctx: CommandContext<typeof todoInput>) => {
    const [issues, value] = ctx.input;
    // ...
};
```

Standalone `defineInput()` defaults `resolve`'s `ctx` parameter to `CommandContext`. When sharing a resolver for modals or select menus, annotate `ctx` explicitly (for example `ctx: ModalContext` or `ctx: SelectMenuContext<...>`). Inline `input: { ... }` inside `defineModal()` or `defineSelectMenu()` infers `ctx` automatically.

## Values passed to the schema

For commands and subcommands, Hyperion builds an object with one key per option:

| Option kind                         | Value passed to the schema                          |
| ----------------------------------- | --------------------------------------------------- |
| Omitted optional option             | `undefined`; use `v.optional()` to supply a default |
| String, integer, number, or boolean | The option value                                    |
| User, role, channel, or mentionable | Discord snowflake ID string                         |
| Attachment                          | discord.js `Attachment` object                      |

Supplied `0`, `false`, and `""` values are preserved—only omitted options are `undefined`. User, role, channel, and mentionable options pass snowflake ID strings rather than resolved objects; read `ctx.interaction.options.getUser(...)` inside `resolve` or `run` when you need the resolved object, and never treat a snowflake ID as proof of server membership or permissions. Schemas may validate asynchronously.

## Resolving values

Add a `resolve` function to turn validated values into domain objects, such as loading a database record by ID:

```ts fragment
input: {
    schema: v.object({ id: v.string() }),
    resolve: async ({ id }, ctx) => ({
        todo: await todos.find(id, ctx.interaction.guildId),
    }),
},
```

Hyperion calls `resolve` only after `schema` passes, passing the validated data first and the handler context second. Whatever `resolve` returns replaces the schema output completely in `ctx.input` (raw fields are not merged back in), so `ctx.input` contains `{ todo }` instead of `{ id }`. Returning `null` or `{ todo: null }` produces a successful `[null, value]` result rather than a validation issue; throw only for unexpected errors.

## Deferring before validation

When `schema` or `resolve` does asynchronous work, set `defer` so Hyperion acknowledges the interaction before validating:

```ts fragment
// Ephemeral deferReply() — works on commands, subcommands, select menus, and modals
input: { schema, defer: true },

// deferUpdate() — works on select menus and modals opened from a message component
input: { schema, defer: "update" },
```

`defer: true` calls `deferReply({ flags: MessageFlags.Ephemeral })`; if you need a public reply, omit `defer` and call `deferReply()` manually in `run()`. `defer: "update"` calls `deferUpdate()` and fails at the `input` stage on commands or on modals opened from a slash command.

After `defer: true`, respond with `editReply()` in `run()`. After `defer: "update"`, `editReply()` edits the source message, so send ephemeral validation errors with `followUp({ flags: MessageFlags.Ephemeral })` instead. Auto-defer skips if a guard already acknowledged the interaction, and you should never set `defer: true` on a handler that opens a modal with `showModal()`. See [Responding and automatic deferring](how-hyperion-works.md#responding-and-automatic-deferring).

## Execution order

Hyperion runs `params` (on components), then `guards`, then `input.defer`, then `input.schema` and `input.resolve`, and finally `run()`; see the [interaction pipeline](how-hyperion-works.md#interaction-pipeline). Because guards run first and cannot read `ctx.input`, rejected users never trigger database lookups in `resolve`. Expected schema validation issues pass `[issues, undefined]` to `run()` without logging, whereas thrown schema or resolver exceptions skip `run()`, log with `stage: "input"`, and trigger the generic error reply.

## Other handler types

- Subcommands support `input` the same way as standalone slash commands.
- Modals support `input` for submitted modal controls. See [Validating modal controls](modals.md#validating-modal-controls).
- Select menus support `input` for selected values. See [Validating selected values](select-menus.md#validating-selected-values).
- Buttons do not accept `input`; pass data through [custom-ID params](custom-ids.md) instead.
- Context-menu commands have no options and do not accept `input`.
