# Typed input

Reading command options manually with `getString()` and validating each value adds boilerplate. Typed input lets you define a schema for your options so Hyperion validates them and passes either typed values or validation issues to `run()`.

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

The command builder still defines the options Discord displays to users, while the schema validates the values and applies defaults. Any [Standard Schema](https://standardschema.dev) library works, including Valibot and Zod.

| Option    | Purpose                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `schema`  | Validates incoming values and determines their TypeScript types.                                                  |
| `resolve` | Optional function that transforms validated values before `run()`. See [Resolving values](#resolving-values).     |
| `defer`   | Optional automatic defer before validation runs. See [Deferring before validation](#deferring-before-validation). |

TypeScript infers `ctx.input` from your schema without manual type annotations. To reuse the same input definition across multiple handlers, wrap it in `defineInput()` and pass that variable to each handler.

`ctx.input` is always a tuple: `[null, value]` when validation succeeds, or `[issues, undefined]` when it fails. Hyperion does not send validation errors automatically, so you control the error reply. After checking `if (issues)` and returning, TypeScript narrows `value` to the validated type.

## Values passed to the schema

For commands and subcommands, Hyperion builds an object with one key per option:

| Option kind                         | Value passed to the schema                          |
| ----------------------------------- | --------------------------------------------------- |
| Omitted optional option             | `undefined`; use `v.optional()` to supply a default |
| String, integer, number, or boolean | The option value                                    |
| User, role, channel, or mentionable | Discord snowflake ID string                         |
| Attachment                          | discord.js `Attachment` object                      |

## Resolving values

Add a `resolve` function to turn validated values into domain objects, such as loading a database record by ID:

```ts fragment
input: {
    schema: v.object({ id: v.string() }),
    defer: true,
    resolve: async ({ id }) => ({ todo: await todos.find(id) }),
},
```

With `resolve` configured, `ctx.input` contains `{ todo }` instead of `{ id }`. Hyperion calls `resolve` only after schema validation succeeds, passing the validated data as the first argument and the handler context as the second argument. Whatever `resolve` returns becomes the value in `ctx.input`, so a missing record can be returned as `null`.

## Deferring before validation

If your schema or `resolve` function performs asynchronous work, set `defer` so Hyperion acknowledges the interaction before validating:

```ts fragment
input: { schema, defer: true }, // Calls deferReply() ephemerally, works on any handler
input: { schema, defer: "update" }, // Calls deferUpdate(), works on select menus and modals
```

When `defer` is set, respond with `editReply()` in `run()`. See [Responding](responding.md).

## Execution order

Hyperion runs input handling in this order:
1. Guards execute.
2. Hyperion defers the interaction if `defer` is configured.
3. The schema validates the raw input.
4. `resolve` runs if configured and validation passed.
5. Your `run()` function executes.

Because guards run first and do not receive `ctx.input`, rejected users never trigger database lookups in `resolve`. If a schema or resolver throws an exception rather than returning validation issues, Hyperion logs the error and sends a generic error reply.

## Other handler types

- Subcommands support `input` the same way as top-level slash commands.
- Modals support `input` for form fields. See [Validating fields](modals.md#validating-fields).
- Select menus support `input` for selected values. See [Validating selected values](select-menus.md#validating-selected-values).
- Context-menu commands have no options and do not accept `input`.
