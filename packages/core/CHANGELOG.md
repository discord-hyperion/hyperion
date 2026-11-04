# @hyperion/core

## 0.3.0

### Minor Changes

- e9be41f: Add `input` to select-menu handlers: the selected values (or entity IDs) are
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

## 0.2.0

### Minor Changes

- 134c96e: Add `defineParams` and button params: a handler can declare a Standard Schema for values carried in its custom ID and read them as `ctx.params`, validated before guards. Commands build the control with the callable definition.
- a8be240: Rename the component handler classes to `ButtonHandler`, `SelectMenuHandler`, and `ModalHandler` (with `ButtonHandlerOptions`, `SelectMenuHandlerOptions`, `ModalHandlerOptions`, and `AnySelectMenuHandler`); the old names are removed. Literal handlers now declare `customId` explicitly, and every select-menu handler declares `componentType`. `builder` is an optional template on every kind: it may omit its custom ID, must match `customId` or the params route when it sets one, and select templates must match `componentType`. Add `build(customId)` to `client.buttons`, `client.selectMenus`, and `client.modals`, which returns a fresh copy of a literal handler's template with its custom ID set.
- 6cb8abd: Define guards with `defineGuard({ name, description, run, onFail? })` instead of extending a class. `Guard<Context>` is now a type, and only values returned by `defineGuard()` are accepted as guards; the context type comes from a generic, an annotated `run` parameter, or defaults to `CommandContext`. Built-in guards change to `ownerOnly` (was `new OwnerOnly()`), `cooldown({...})` (was `new Cooldown({...})`), and `paramOwner(key, description?)` (was `new ParamOwner(...)`). `GuardOptions` is replaced by `GuardDefinition`.
- b3f17ec: Support .tsx and .jsx filesystem handlers, including command parent/group indexes,
  module-name extraction, and numeric event priorities.
- 4d55ccd: Modal input now extracts every modal control, not just text inputs. Selects and
  checkbox groups give `string[]` (entity selects give IDs), file uploads give
  `Attachment[]`, radio groups give `string | null`, and checkboxes give `boolean`.
  Duplicate custom IDs across any control types are rejected.

  Breaking: a form with selects, uploads, radio groups, or checkboxes now produces
  extra keys, so a schema that rejects unknown keys (a strict object) fails until it
  accepts them.
- 41c729b: Add custom-ID params for modals: `ModalHandler<Input, Params>` and `ModalContext<Input, Params>` carry `ctx.params` from the custom ID alongside `ctx.input` from the form. Params are validated before guards, input runs after them, and input resolvers see params. Every registry gains `build(definition, values)`, which copies a params handler's template with the encoded custom ID. `defineParams` now checks at compile time that `keys` names exactly the schema's input keys, and a custom ID that matches a route but cannot be decoded logs `<kind>.params.undecodable` at debug level.
- f4127d5: Add optional Standard Schema validation and whole-input resolution for modal
  submissions. Reuse defineInput with explicit ModalContext resolver annotations,
  private deferral, inferred handler results, and handler-owned validation responses.
  Preserve existing command input and schema-free modal behavior.
- b69005f: Add filesystem event handlers with typed SDK argument contexts, numeric filename
  ordering, per-event FIFO queues, one-shot handlers, transactional manual reloads,
  and bounded shutdown draining. Expose managed event loading and configurable
  queue limits through the client.
- f3eb9de: Add custom-ID params for select menus of every type: a handler declares `componentType` and `params`, reads `ctx.params`, and is routed by its params route. Add the opt-in `ParamOwner` guard, which rejects unless the user matches a string param and the params are valid.

### Patch Changes

- 55072e9: When the generic error response cannot edit a deferred reply, such as one already edited into a layout message, send an ephemeral follow-up instead and log `<kind>.error-response.fallback` at debug level.

## 0.1.0

Initial workspace package for the Hyperion framework: class-based Discord
commands, components, guards, typed input, and filesystem discovery. This version
is prepared in the repository; npm publication is a separate maintainer operation.
