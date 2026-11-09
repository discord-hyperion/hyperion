# @hyperion/core

## 0.8.0

### Minor Changes

- 142c47c: Add built-in `guildOnly`, `requirePermissions()`, and `requireBotPermissions()` guards. The permission guards check the member's or the bot's permissions in the interaction's channel, reject outside a server, and list the permissions they asked for in their reply.

## 0.7.0

### Minor Changes

- 6a91b6f: Skip deploying commands that haven't changed. Before each bulk overwrite, the registry reads the registered commands and compares them, so a restart with unchanged commands sends no deployment request. The `commands.deployed` log lists the added, removed, and changed commands. If the registered commands can't be read, it deploys anyway.

## 0.6.0

### Minor Changes

- 96781c2: Remove the `GuardPipeline` and `GuardResult` exports. They were internal plumbing for the dispatcher, which now runs guards with a plain function. Guards themselves are unchanged.

## 0.5.0

### Minor Changes

- 76de38d: Define handlers with functions instead of classes. `defineCommand()`, `defineSubcommand()`, `defineParentCommand()`, `defineSubcommandGroup()`, `defineButton()`, `defineSelectMenu()`, `defineModal()`, and `defineEvent()` replace extending `Command`, `Subcommand`, `ParentCommand`, `SubcommandGroup`, `ButtonHandler`, `SelectMenuHandler`, `ModalHandler`, and `EventHandler`, which are now exported as types only. Params, input (inline or from `defineInput()`), select-menu kinds, command types, and event arguments are inferred, so handlers take no type argument and `run` needs no annotation. `defineEvent()` requires an `event` that matches its folder. Breaking: every handler module must default-export what its define function returns.

## 0.4.0

### Minor Changes

- 4b9024c: Button, select-menu, and modal handlers with a template now take its custom ID as
  theirs, so the ID is written once.

  **Breaking:** passing `customId` beside `builder` is a type error and throws.
  Delete `customId` and keep the template's ID. A template must carry a custom ID,
  and a params handler's template must carry the params route
  (`.setCustomId(definition.id)`).

### Patch Changes

- 940f06d: `destroy()` now removes the interaction dispatcher's listener, and
  `InteractionDispatcher` gains `detach()`; `attach()` no longer adds a second
  listener when called twice.
- d3ccda9: `HyperionClient.create()` now loads event handlers before deploying commands, so
  an invalid event handler fails initialization without any deployment request.
- 5dc8e81: `defineParams()` rejects a `__proto__` key, which decoding silently dropped.
- 03b8f39: Component load and initialization logs now count params handlers.

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
