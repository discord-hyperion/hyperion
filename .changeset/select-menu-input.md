---
"@hyperion/core": minor
---

Add `input` to select-menu handlers: the selected values (or entity IDs) are
validated and resolved with `defineInput()` before the handler runs, and reach it
as `ctx.input`. Add `defer: "update"` to `defineInput()` for select menus and
modals, which calls `deferUpdate()` instead of deferring a private reply.

**Breaking:** button, select-menu, and modal handlers and contexts now take one
object type argument instead of positional ones. Unknown keys are type errors.

```ts
// Before
type Menu = SelectMenuHandler<ComponentType.UserSelect, typeof params>;

// After
type MenuSpec = {
    componentType: ComponentType.UserSelect;
    params: typeof params;
};
type Menu = SelectMenuHandler<MenuSpec>;
```

Modals move from `ModalHandler<typeof input, typeof params>` to
`ModalHandler<{ params: typeof params; input: typeof input }>`, and buttons from
`ButtonHandler<typeof params>` to `ButtonHandler<{ params: typeof params }>`.

The same applies to `SelectMenuContext`, `ModalContext`, `ButtonContext`, and the
`*HandlerOptions` types. Handlers without a type argument are unchanged.
