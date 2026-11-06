# Typed command input

Chat-input commands and executable subcommands can declare an optional Standard
Schema-compatible schema and a whole-input resolver. The pipeline is:

`guards → optional private deferral → extract options → validate schema → resolve → handler`

See the [feature backlog](features.md), [command-input terminology](GLOSSARY.md#command-input),
and [input-validation decision](adr/0002-standard-schema-with-optional-input-resolvers.md).

## Configuration

Group processing options under `input: { schema, resolve, defer }`. The schema
is required whenever `input` is configured. Commands without `input` retain the
original context and have no `ctx.input`. Context-menu commands do not support
input schemas.

Native Discord builders define visible options, required flags, and choices.
The schema validates extracted options and applies application defaults and
transformations. Hyperion does not generate builders or inspect validator-specific
schema internals to compare fields with builder options.

The optional `resolve` callback receives the **complete schema output** and the
original invocation context. Its argument is typed from the schema output, so
schema defaults and transformations are available before the callback runs. It
can use several fields to fetch or create an application value, rename fields,
or return multiple fields. The resolved result replaces the complete handler
input; raw fields are not merged back in.

Resolvers return ordinary application values. A missing todo can be returned as
`null`, included in `{ todo: null }`, or replaced with an application default.
These are successful results, and the handler's result type retains any nulls.
Resolver results are not passed through a second validation step. Applications
that need output validation can perform it explicitly within the resolver.

Schemas may themselves perform async transformations. Applications should choose
where to perform a lookup rather than fetching the same value in both the schema
and resolver. The old per-option `resolvers` map is rejected; there are no source
or destination key mappings.

`defer: true` privately defers after guards and before input processing. Omission
or `false` leaves acknowledgment to the application. Acknowledgment by a guard
is preserved; automatic deferral never acknowledges twice. Applications needing
public responses manage acknowledgment themselves.

`defer: "update"` calls `deferUpdate()` instead, for handlers that finish by
editing the message the interaction came from. Select menus and modals accept
it. A modal not opened from a message component has no message to update, so
the deferral throws and reports the `input` stage. Commands reject it in their
constructor, and `Command`/`Subcommand` reject it as a type error.

## Handler results and failures

`ctx.input` is a readonly discriminated tuple:
- Success: `[null, input]`, containing the resolver output, or schema output if
  no resolver was configured.
- Expected schema failure: `[issues, undefined]`, exposing the schema's Standard
  Schema issues directly, including messages and optional paths.

Schema failure skips `resolve` and calls the handler with issues. The handler
chooses the response and must return after handling issues to narrow `input`.
No partial input or automatic validation response is provided. Resolver and schema
exceptions stop processing, skip the handler, and use the existing generic error
pipeline with `stage: "input"`. Expected issues and input values are not logged.

Parent, group, and leaf guards run before schema validation. They and the resolver
receive the original context without `ctx.input`. Rejected guards skip all input
processing. Existing cooldown consumption rules remain in effect even when
validation or resolution later fails.

## Definition types

Use `defineInput` to infer resolver arguments from the schema and handler values
from the resolver return type. The helper does not run validation or resolution.
Pass the complete definition as the single generic on `Subcommand`, `Command`,
and `CommandContext`:

```ts fragment
const input = defineInput({
    schema: getTodoSchema,
    defer: true,
    resolve: async ({ id }) => ({
        todo: await fakeApi.getTodo(id),
    }),
});

class GetTodo extends Subcommand<typeof input> {
    constructor() {
        super({ builder: todoBuilder, input });
    }

    async run(ctx: CommandContext<typeof input>) {
        const [issues, value] = ctx.input;
        if (issues) {
            await ctx.interaction.editReply({
                content: issues.map(issue => issue.message).join("\n"),
            });
            return;
        }

        if (!value.todo) {
            await ctx.interaction.editReply("Todo not found.");
            return;
        }

        await ctx.interaction.editReply(value.todo.name);
    }
}
```

Import `defineInput`, `Subcommand`, and `CommandContext` from Hyperion. Here
`getTodoSchema` validates an object containing `id`, `todoBuilder` declares the
matching string option, and `fakeApi.getTodo` returns `Todo | null`. The inferred
handler value is `{ todo: Todo | null }` without a separate result type. A
resolver may return multiple fields or provide defaults in the same way.

Standalone chat-input definitions use `Command<typeof input>` with the same
`CommandContext<typeof input>`. Without a resolver, `defineInput({ schema })`
preserves the schema's output type, including defaults and transformations.
Resolver promises are awaited; schemas deliberately producing promises retain
those values when no resolver is configured.

Schema-free commands and contexts retain their existing generic defaults. User
and message context-menu commands still use `Command<ApplicationCommandType.User>`
and `CommandContext<ApplicationCommandType.User>`, or the corresponding message
type. Their builders and targets stay typed, and they cannot configure input.
The input-definition shorthand always describes a chat-input command.

The schema/result generic combination is replaced by the complete input
definition. `defineInput` avoids repeating schema output and resolver return
types, while classes still need an explicit `run(ctx: CommandContext<typeof input>)`
annotation because TypeScript does not infer overriding method parameters from
the base class. No class factory or `CommandContextFor` helper is introduced.

## Extraction and shared definitions

- Omitted options are supplied as `undefined`; the schema handles optional values
  and defaults. Preserve supplied `0`, `false`, and empty strings.
- User, role, channel, and mentionable options supply snowflake strings. Attachments
  supply resolved attachment values. Native interaction getters remain available.
  Entity IDs do not establish membership or authorization.
- Extract only the selected executable command or subcommand's options. The whole
  schema output reaches the resolver once, even when some options were omitted.
- Definitions and schemas are shared; invocation input and contexts are fresh.
  Constructors copy/freeze the input configuration without freezing application
  schema objects or executing validation and resolution.
- Discovery and deployment never execute schemas or resolvers.

## Modals and select menus

Modal and select-menu handlers also accept `input`, with the same `defineInput`
helper. Pass it in the handler's object type argument:
`ModalHandler<{ input: typeof input }>` with `ModalContext<{ input: typeof input }>`,
or `SelectMenuHandler<{ input: typeof input }>` with the matching
`SelectMenuContext`. Their pipeline adds custom-ID params first:
`params → guards → optional deferral → extract → schema → resolve → handler`.

| Handler     | The schema receives                                                      |
| ----------- | ------------------------------------------------------------------------ |
| Modal       | an object keyed by modal-control custom ID                               |
| Select menu | a copy of `interaction.values`: picked values, or IDs for entity selects |

When a resolver uses context, annotate its second parameter (`ctx: ModalContext`
or `ctx: SelectMenuContext<…>`); schema values and resolver results remain
inferred. Unannotated resolver context defaults to the chat-input command
context for compatibility. See
[modal input validation](modal-input-validation.md) and
[select menus](select-menus.md#validate-the-selection).
