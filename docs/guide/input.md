# Typed input

Reading options one by one with `getString()` gets tedious, and you still have to
check every value yourself. Typed input lets you describe the options with a
schema instead. Hyperion validates them and hands your handler typed values, or
the list of problems.

## A command with input

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, defineInput } from "@hyperion/core";
import { MessageFlags } from "discord.js";
import * as v from "valibot";

const input = defineInput({
    schema: v.object({
        text: v.pipe(v.string(), v.trim(), v.minLength(1, "Say something!")),
        times: v.optional(v.number(), 1),
    }),
});

export default class EchoCommand extends Command<typeof input> {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("echo")
                .setDescription("Repeat a message.")
                .addStringOptions(o =>
                    o
                        .setName("text")
                        .setDescription("What to say")
                        .setRequired(true),
                )
                .addIntegerOptions(o =>
                    o.setName("times").setDescription("How many times"),
                ),
            input,
        });
    }

    async run(ctx: CommandContext<typeof input>) {
        const [issues, value] = ctx.input;
        if (issues) {
            await ctx.interaction.reply({
                content: issues.map(issue => issue.message).join("\n"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ctx.interaction.reply(value.text.repeat(value.times));
    }
}
```

The builder still decides what Discord shows, and the schema decides what's
valid and fills in defaults. Any [Standard Schema](https://standardschema.dev)
library works. `defineInput()` takes:

| Option    | What it's for                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `schema`  | Checks the options and gives them their types.                                                                      |
| `resolve` | Optional. Turns the checked values into what your handler needs. See [resolving the values](#resolving-the-values). |
| `defer`   | Optional. Defers before validating. See [deferring](#deferring).                                                    |

`ctx.input` is either `[null, value]` or `[issues, undefined]`. Hyperion never
replies to validation problems for you, so you choose the wording. Return after
handling issues and TypeScript knows `value` is safe.

## What the schema receives

The schema gets one key per option of the command, or of the subcommand that
ran:

| Option                           | The schema gets                               |
| -------------------------------- | --------------------------------------------- |
| Left out by the user             | `undefined`; use `v.optional()` for a default |
| String, integer, number, boolean | The value                                     |
| User, role, channel, mentionable | The ID                                        |
| Attachment                       | The attachment                                |

## Resolving the values

Often you want the _thing_ an option points to, not the raw value. Add `resolve`
to turn validated values into whatever your handler needs:

```ts fragment
const input = defineInput({
    schema: v.object({ id: v.string() }),
    defer: true,
    resolve: async ({ id }) => ({ todo: await todos.find(id) }),
});
```

Now `ctx.input` holds `{ todo }` instead of `{ id }`. The resolver only runs when
validation passes, and whatever it returns becomes the handler's input, so a
missing todo can simply be `null`. Its second argument is the handler's context.

## Deferring

Lookups can be slow, so Hyperion can defer before validating:

```ts fragment
defineInput({ schema, defer: true }); // a private reply, for any handler
defineInput({ schema, defer: "update" }); // the message, for select menus and modals
```

Either way, finish with `editReply()`. See [responding](responding.md).

## The order things happen

```
guards → defer (optional) → validate → resolve → your handler
```

Guards run first and never see `ctx.input`, so a rejected user never triggers
your lookups. If the schema or resolver _throws_ (rather than reporting issues),
the user gets the generic error message.

## Subcommands, modals, select menus, and context menus

- Subcommands work the same way: `Subcommand<typeof input>`.
- Modal forms use the same `defineInput()`; see [modals](modals.md#validating-the-fields).
- Select menus too; see [select menus](select-menus.md#checking-the-pick).
- Context-menu commands have no options, so they don't take input.
