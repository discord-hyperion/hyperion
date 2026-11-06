# Custom-ID params

Status: implemented for buttons, select menus, and modals. This guide specifies typed
custom-ID data exposed through `ctx.params`. It implements the backlog entry in
[features](features.md) and reuses the pipeline described in
[input validation](input-validation.md).

## Goals

- A handler declares a Standard Schema for the data carried in its custom ID and
  receives the validated value as `ctx.params`.
- A command builds the visible component with a typed encoder, without
  depending on a handler instance.
- Values keep their types through the schema, never through base64 or JSON.
- Literal custom IDs keep working. Unmatched IDs stay unmatched so application
  collectors and listeners can coexist.
- Components stay stateless. No per-message handler state is introduced.

## Definition

`defineParams` mirrors `defineInput`: an identity-style helper that exists for
type inference, validates its config once, and returns a frozen definition.

```ts
export const todoDoneId = defineParams({
    id: "todo.done",
    keys: ["owner", "page", "todoId"],
    schema: v.object({
        owner: v.string(),
        page: v.pipe(v.string(), v.toNumber()),
        todoId: v.string(),
    }),
});
```

- `id` is the route: the first custom-ID segment. It must be non-empty, contain
  no `:` or `%`, and be unique across handlers.
- `keys` lists the value names in wire order. Standard Schema cannot expose a
  schema's shape and Hyperion does not inspect validator internals, so the order
  is declared. Keys must be unique non-empty strings, and not
  `__proto__`, which can't round-trip. Reordering or removing keys changes
  the wire format and invalidates messages that are already sent.
- `schema` is any Standard Schema v1 value. It receives a record of strings.
- There is no `resolve` or `defer` in v1. `defer` does not apply to components,
  and an application lookup must not run before authorization.

The returned value is a function with the definition attached
(`Object.assign(encode, { id, keys, schema })`, frozen). Calling it encodes a
custom ID:

```ts
todoDoneId({ owner: user.id, page: 2, todoId: todo.id });
// "todo.done:123456:2:abc"
```

Encoder values are typed from `keys` as `string | number | boolean` and are
stringified. Schema input is wire text, so it cannot type the encoder. The
attached field names must not collide with function properties (`name`,
`length`, `prototype`). Name exports for what they return (`todoDoneId`), not
as if they ran the handler.

## Templates and building controls

Component registries keep shared handlers and their optional **templates** in
`builder`. Use the template to create each button, select menu, or modal:

```ts
const button = ctx.client.buttons.build(todoDoneId, {
    owner: user.id,
    page: 2,
    todoId: todo.id,
});
```

`build(definition, values)` finds the handler by route, checks the ordered keys,
encodes the supplied values using the definition, and sets the generated custom
ID on a fresh template copy. The template and handler retain no per-use values.
On interaction, Hyperion matches the route, decodes the ID, and validates the
values against the handler's schema before guards run. The validated result or
issues are available in `ctx.params`. Build-time encoding does not run that schema.

The same overload exists on `client.selectMenus` and `client.modals`.
`build("literal.id")` sets a fixed ID instead and carries no params. A handler
without a template can still receive controls authored separately with the
encoder, but cannot be used with `build()`.

## Wire format

```
<id>:<value>:<value>
```

- Segments are separated by `:`. `:` and `%` inside values are percent-escaped
  (`%3A`, `%25`). Nothing else is encoded.
- Values are positional, in `keys` order.
- The encoder throws when the result exceeds 100 characters, so the failure
  surfaces in the command rather than as a Discord API error. Nothing is
  truncated, clamped, or given a fallback.
- Decoding requires exactly `keys.length` value segments and valid escapes.
  Anything else is treated as unmatched and ignored.

## Handler

```ts
type TodoDoneSpec = { params: typeof todoDoneId };

export default class TodoDone extends ButtonHandler<TodoDoneSpec> {
    constructor() {
        super({ params: todoDoneId });
    }

    async run(ctx: ButtonContext<TodoDoneSpec>) {
        const [issues, value] = ctx.params;
        if (issues) {
            await ctx.interaction.reply({
                content: "This button is out of date.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        value.page satisfies number;
    }
}
```

- One generic carries the definition, as with `Subcommand<typeof input>`.
- `ctx.params` is `readonly [issues: null, value: Output] | readonly [issues:
  readonly Issue[], value: undefined]`, the same tuple as `ctx.input`. The
  handler chooses the response to a schema failure.
- `ctx.params` is separate from `ctx.input` because a modal has both: params
  from its custom ID and `input` from its fields.
- Handlers without `params` keep literal custom-ID routing and expose no
  `ctx.params`.
- A handler declares either `customId` (literal) or `params`, never both, or
  takes its literal ID from a template. A params handler's template must carry
  the route as its custom ID; `build(definition, values)` replaces it with the
  encoded ID. Commands set a params control's custom ID with the encoder.

## Pipeline

```
match → decode → schema validate → guards → handler
```

This intentionally differs from command and modal input
(`guards → extract → validate → resolve → handler`):
- Guards can read `ctx.params`, so one reusable guard (for example
  `paramOwner("owner")`) can compare the clicker with a user ID from the custom
  ID. That shows the clicker is the user the control names, not that they own
  the resource: a tampered ID can name anyone, and ownership can change after the
  control was sent. Check current ownership against application state.
- There is no `resolve` step, but validation runs the application's schema,
  awaited, before guards and before any input deferral. Keeping it pure and fast
  is the caller's job: an async schema step adds latency before the interaction
  is acknowledged.
- Guard contexts for params handlers carry `params`. Guards for other handlers
  are unchanged.

Steps:
1. **Match.** Exact custom-ID match against literal handlers first. Otherwise
   split on the first `:` and look the route up in the params index. No match
   means return without replying.
2. **Decode.** Split, unescape, and zip with `keys` into a record of strings.
   A wrong segment count or invalid escape is unmatched.
3. **Validate.** `await schema["~standard"].validate(record)`, called directly
   by `resolveParams()`. Issues produce
   `[issues, undefined]` and the pipeline continues.
4. **Guards, then handler.** Existing guard and error behavior applies.
   Exceptions use the generic error pipeline with `stage: "params"` for decode
   or validation exceptions.

Schema failure is not an automatic reply: guards still run and the handler
decides. An ownership guard should therefore reject when `ctx.params` carries
issues.

## Registration

- Registries gain a route index for `id` alongside the exact-ID `Collection`,
  exposed as `registry.resolve(customId)`.
- Load-time checks reject: duplicate routes, a route that equals a literal
  custom ID, a route containing `:`, duplicate keys, and a handler that declares
  both `customId` and `params`.
- `defineParams` checks at compile time that `keys` names exactly the schema's
  input keys, in any order. A missing or unknown key fails to compile with a
  readable message. The check is skipped when the schema's keys cannot be
  known, such as a record or an untyped schema. Order stays yours, because it
  is the wire format. There is no runtime check.
- `registry.build(definition, values)` returns a fresh copy of a params
  handler's template with the encoded custom ID. It throws when no params
  handler is loaded for the route, when the handler declares different `keys`,
  or when it has no template.
- Replacement stays atomic with the rest of the registry.

## Routing rules

- Handlers without `params` keep exact-match routing on the full custom ID. The
  "no suffixes, wildcards, or regex" statement in [buttons](buttons.md) stays true
  for them.
- A handler that declares `params` owns its whole `<route>:` namespace. The route
  lookup applies only to these handlers and only after exact match fails.
- Loading fails when a literal custom ID equals a params route, so a bare
  `todo.done` can never be ambiguous.

## Guards and invalid params

- Guards on a params handler receive `ctx.params`. Guards on other handlers keep
  their current context types.
- A schema failure does not stop guards. A guard that reads `ctx.params` must
  handle the issues case itself and reject; the framework does not reject on its
  behalf, so handlers keep control of the response.
- The built-in `paramOwner()` guard rejects whenever `ctx.params` carries issues.

## Stale controls

Messages outlive code. Changing `keys`, their order, or their meaning requires a
new `id`. An old `id` may stay registered so that old controls fail gracefully
(for example with an "out of date" reply). The wire format carries no automatic
version segment.

## Logging

Never log params, decoded values, issues, or the full custom ID. Log the route
`id` and counts only, following [logging](logging.md).

A custom ID that matches a route but fails to decode stays unmatched and logs
`<kind>.params.undecodable` at debug level with the route, the segment count,
and the expected count. This usually means a template was sent without values,
or a control is stale.

## Scope

1. Shared codec (`defineParams`, encode, decode) and the route index.
2. Buttons.
3. Select menus, all five types, and the `paramOwner()` guard.
4. Modals, `build(definition, values)` on every registry, and the compile-time
   `keys` check.

The codec, route lookup, and context typing are kind-agnostic, so each kind
reuses them without redesign.

## Select menus

Select menus reuse the codec, route lookup, pipeline, and `ctx.params` tuple.
- Params are decided when the bot sends the menu; the selection is decided at
  click time. They stay separate: `ctx.params` carries the former and
  `ctx.interaction.values` (or the resolved collections) carries the latter.
- Every select handler declares its select type
  (`super({ componentType: ComponentType.UserSelect, params })`).
  A click whose `componentType` differs is unmatched, and the type is checked
  before decoding, so the schema never runs for the wrong kind.
- Typing adds a `params` key to the type argument:
  `SelectMenuHandler<{ componentType: Type; params: typeof definition }>` and the
  matching `SelectMenuContext`. Without it there are no params.
- Routes are unique per registry, as literal custom IDs are today. All five
  select types share `client.selectMenus`, so routes are unique across them and
  across literal select IDs. A button and a select menu may share a route.

## Modals

A modal carries two sets of values: `ctx.params` from its custom ID, decided
when the bot showed it, and `ctx.input` from its text inputs, decided by the
user.

```
match → decode → params validate → guards → input (defer, extract, validate, resolve) → handler
```

- Typing adds a `params` key to the type argument:
  `ModalHandler<{ params: typeof definition; input: typeof input }>` and the
  matching `ModalContext`. Without it there are no params.
- Guards see `ctx.params` but never `ctx.input`, so `paramOwner()` works unchanged
  and rejects before any input processing.
- Input runs even when params have issues, so the handler receives both tuples.
  An input resolver receives the params-bearing context. A resolver that reads
  `ctx.params` must handle issues itself, and annotating it as
  `ctx: ModalContext<{ params: typeof params }>` only compiles on a handler with
  those params.
- Exceptions report `stage: "params"` or `stage: "input"`.
- The form stays on the handler as its template, because `input` reads the
  form's text-input custom IDs. Open it with
  `ctx.client.modals.build(definition, values)`.
- Routes are unique within `client.modals` and must not equal a literal modal
  custom ID. A modal may share a route with a button or select menu.
- A params modal without `input` is allowed.

## Guard typing

Guards that read `ctx.params` are typed through the same definition, for example
`Guard<ButtonContext<{ params: typeof todoDoneId }>>`, so a guard written for one params
handler cannot be attached to a handler with different params.

## paramOwner()

`paramOwner()` is an opt-in built-in guard, not part of execution: it runs only
when a handler lists it.

```ts
guards: [paramOwner("owner", "Only the ticket's author can close it.")];
```

- It passes when `ctx.params` has no issues and `params[key]` equals the user's
  ID. Params that fail validation are always rejected.
- The key must exist in the handler's params with a string value; otherwise the
  guard does not compile. It works for any handler kind that carries params.
- Its log name is `param-owner`. The optional description, which is the default
  rejection reply, defaults to "Only the person this was sent for can use it."
