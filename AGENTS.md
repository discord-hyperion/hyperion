# Hyperion contributor guidance

Hyperion is a TypeScript framework for Discord bots. This repository is a fresh
rewrite targeting discord.js v15. Follow the implementation in this repository;
the old Hyperion repository is background context, not the current API.

## Secrets: explicit user requirement

- Never read the `.env` file under any circumstance. Do not inspect other private
  `.env.*` files either. The non-secret `.env.example` template is separate.
- Do not expose secrets through shell output, environment dumps, logs, tests,
  debugger output, or Git diffs. Exclude private environment files from searches.
- Do not execute startup scripts that load `.env`. Verify changes using type
  checking and isolated tests with fake credentials and mocked Discord requests.
- Never stage or commit private environment files. `.gitignore` is not permission
  to read them. Ask the user to configure credentials themselves when necessary.

## Tooling and conventions

- Use pnpm and preserve `pnpm-lock.yaml`. The package-manager version is pinned in
  `package.json`.
- Development executes TypeScript through `tsx`; type checking is separate and
  uses `tsc --noEmit`. Do not add a required compilation step for development.
- The project uses ESM and NodeNext module resolution. Relative imports include
  `.ts` extensions. Use `import type` for type-only imports.
- Use the installed v15 types and APIs rather than assuming v14 compatibility.
  `@discordjs/builders` is a separate dependency; keep its pinned prerelease
  compatible with the pinned discord.js version.
- Use Biome for linting, formatting, and import organization. Formatting is four
  spaces, double quotes, and arrow parentheses only when needed. Do not introduce
  ESLint or Prettier alongside it. Do not format the generated lockfile manually.
- Filenames and directories use kebab-case. Classes and types use PascalCase;
  functions and variables use camelCase.
- Prefer `type` aliases over `interface` declarations. Use an interface only
  when its semantics, such as declaration merging, are required.
- Prefer arrow functions over the `function` keyword for standalone functions
  and callbacks. Keep normal class methods; use a function declaration only when
  its semantics are required.
- Prefer arrow-function signatures in type definitions as well, such as
  `run: (ctx: Context) => Promise<void>` rather than
  `run(ctx: Context): Promise<void>`. Keep normal methods in class declarations.
- When implementing or extending an abstract class, omit redundant `public` and
  `override` modifiers on constructors and methods. Public visibility is implicit;
  retain `private`, `protected`, `abstract`, or other modifiers when they express
  required semantics. Do not enable `noImplicitOverride` for these implementations.
- Let TypeScript infer return types for implemented methods. Keep explicit return
  types on abstract methods, interfaces, and other declarations that define a
  contract without an implementation.
- Avoid one-off variables that only rename an already clear expression. Prefer
  direct access such as `options.commands` unless a local variable improves
  clarity, avoids repeated work, or is needed for type safety.
- Group related statements together and separate logical groups with a blank
  line. Keep related assignments adjacent, but give validation, state mutations,
  logging, and subsequent operations their own visual groups. Follow the spacing
  in the registry loaders; avoid tightly packing unrelated steps or inserting a
  blank line between every statement.

## Repository layout

Deferred feature work is tracked in `docs/features.md`.

```text
src/
  client/       HyperionClient and client configuration
  commands/     Command abstractions
  components/   Component abstractions
  contexts/     Invocation context abstractions
  guards/       Execution checks
  events/       Event abstractions
  registries/   Filesystem discovery and handler registries
  execution/    Dispatch and execution orchestration
  logging/      Logging integration
  util/         Shared utilities
dev/bot/        Development bot, separate from framework source
  src/commands/ Example command modules
  src/buttons/  Example button modules
  src/select-menus/ Example select menu modules
  src/modals/   Example modal modules
tests/          Isolated tests
docs/           Usage and architecture documentation
```

Some folders currently contain only barrel exports. Do not assume their planned
features are implemented. Command discovery, deployment, and slash-command
dispatch exist, along with button, string select, user select, role select,
mentionable select, and channel select support, guards, Pino logging and Ora
startup indicators. Modal discovery and submission dispatch are supported,
along with command autocomplete and user/message context-menu commands.
Database support is intentionally out of scope.
- Each framework folder has an `index.ts` barrel; expose public APIs through
  `src/index.ts`.
- Keep folder aliases in `tsconfig.json` synchronized with the layout. Examples
  consume the public `@hyperion` entry point. Internal relative imports avoid
  requiring consumers to understand repository-only aliases.
- Keep a single package for now; the development bot shares root dependencies.
  Do not introduce a workspace without a concrete multi-package requirement.

## Architecture

- Keep the class-based structure. Prefer small, focused classes and avoid empty
  `Base<X>` subclasses when a generic type or shared implementation suffices.
- `HyperionClient` extends Discord's `Client`. Its constructor is private; callers
  await `HyperionClient.create(options)` before using initialized registries.
- Initialize registry properties in the constructor. Do not hide lifecycle gaps
  with `declare`, definite-assignment assertions, or `Reflect.set()`.
- Initialization failures reject the factory and destroy the local client. Login
  is a separate operation; do not silently introduce network activity elsewhere.
- Use Discord's `Collection` for keyed handler registries. Arrays, sets, and weak
  maps remain appropriate for ordered data, uniqueness, and object metadata.
- Use `Collection` rather than `Map` for other keyed stores as well, including
  cooldown state, tests, and examples.
- Command definitions default to `ChatInputCommandBuilder`. Context-menu commands
  use `Command<ApplicationCommandType.User>` or `Command<ApplicationCommandType.Message>`,
  the matching `CommandContext`, and v15 `UserContextCommandBuilder` or
  `MessageContextCommandBuilder`. Infer the runtime command type from the builder
  rather than requiring a duplicate `type` option.
  The generic must reject mismatched builders at compile time. Refine the pinned
  SDK's context-menu serialization return types through declaration merging to
  preserve that distinction without wrapping builders or adding configuration.
  Load all command types from
  `<root>/src/commands` and deploy them together. Names are unique within each type.
  Use `client.commands.resolve(name, type)` for typed lookup; omitted type selects
  chat-input commands. Keep Collection keys for slash names unchanged and generate
  context-menu keys with `CommandRegistry.key(name, type)`.
  Serialize through `toJSON()`
  and leave payload validation to the builder and Discord. Keep framework checks
  for exported classes, executable handlers, lookup names, and duplicate names.
- Preserve original failures with `cause` and retain source-file context for
  builder failures and indexed Discord validation errors.
- Use `client.logger` or the invocation's `ctx.logger` for structured logs.
  Do not log credentials, whole client options, raw interactions, or command
  arguments. Preserve configurable levels, silent mode, JSON output outside
  interactive terminals, and progress cleanup after failures.
- Command guards are ordered `Guard` instances or lazy per-invocation factories.
  Stop on rejection or error. Do not invoke factories during discovery or
  deployment, or keep invocation-specific mutable state on shared guards.
- Commands may implement `autocomplete(ctx: AutocompleteContext)` alongside
  `run()`. Route autocomplete separately without command guards or the normal
  reply/error pipeline. Use the v15 `options.getFocused()` API with no argument
  and respond with choices through `interaction.respond()`. Return empty choices
  for missing handlers, unresponded completions, or failures, without responding
  twice. Hooks must authorize private suggestions themselves; never log focused
  input or suggestions. Autocomplete cannot defer its response.
- Ship reusable guards in `src/guards/builtins`, with a barrel re-exported through
  the guards barrel and public library entry point. Consumers can use built-in
  guards without defining their own subclasses.
- `OwnerOnly` uses `client.getOwnerId()` to resolve the current application's
  personal owner or team owner from Discord. Cache successful results per login,
  share concurrent lookups, and fail closed when ownership cannot be resolved.
- Buttons use custom-ID builders from `@discordjs/builders`, are keyed by exact
  custom ID in `client.buttons`, and load from `<root>/src/buttons` without REST
  registration. Unmatched IDs are left to collectors and application listeners.
- Selects extend `SelectMenu`, defaulting to string selects. User selects use
  `SelectMenu<ComponentType.UserSelect>`, a `UserSelectMenuBuilder`, and
  `SelectMenuContext<ComponentType.UserSelect>` for resolved users and members.
  Role selects use `ComponentType.RoleSelect`, a `RoleSelectMenuBuilder`, and
  the matching context for resolved roles. Mentionable selects use
  `ComponentType.MentionableSelect`, a `MentionableSelectMenuBuilder`, and the
  matching context for resolved users, members, and roles. Channel selects use
  `ComponentType.ChannelSelect`, a `ChannelSelectMenuBuilder`, and the matching
  context for resolved channels. Load all supported selects from
  `<root>/src/select-menus` into `client.selectMenus`; match exact
  custom IDs and component types, leaving unmatched interactions alone.
  Keep builder, interaction, and guard types paired through the generic type.
- Button guards use `ButtonContext`; shared interaction guards can use
  `InteractionContext`. Filesystem handlers control their reply,
  update, or modal lifecycle. After `deferUpdate()`, send errors as ephemeral
  follow-ups rather than editing the source message.
- Modals extend `Modal`, use `ModalBuilder` from `@discordjs/builders`, and load
  from `<root>/src/modals` into `client.modals` without REST registration. Match
  exact custom IDs and leave unmatched submissions to collectors and listeners.
  `ModalContext` exposes the v15 `ModalSubmitInteraction.components` resolver.
  Read embedded selects through the modal handler, not message select dispatch.
  Use `LabelBuilder` for text-input labels in examples. Modal guards run on
  submission independently of the command or component that opened the modal.
- Keep components stateless: retain handler definitions for routing, but do not
  introduce per-message sessions, callback closures, timers, counters, or update
  queues. Persistent state and atomic updates belong in application-owned storage.
  SQLite integration is future work; do not add database dependencies yet.

## Filesystem discovery and deployment

- Resolve command modules from `<root>/src/commands`; `root` defaults to the
  working directory and may be a filesystem path or file URL. Do not add arbitrary
  per-handler folder paths. Handler types follow fixed folders
  such as `<root>/src/select-menus`.
- Keep framework source separate from the consuming bot root. The development
  bot sets its root to `dev/bot`.
- Scan recursively with `node:fs/promises`. Skip barrels, declarations, test
  modules, hidden entries, and `node_modules`.
- Command modules default-export a concrete `Command` subclass with a public,
  zero-argument constructor. Stage loaded commands before replacing the registry
  so failures preserve the previously loaded state.
- Missing handler folders are optional and skipped. Other filesystem errors must
  propagate. Empty registries must not clear deployed commands.
- Bulk registration replaces application commands in the selected scope. Guild
  IDs select guild registration; omitting them selects global registration.
  An explicitly empty guild list is rejected. Do not deploy during tests.

## Verification

Use checks appropriate to the change. For code changes:

```sh
pnpm exec tsc --noEmit
pnpm test
pnpm check
```

If the package-manager wrapper is unavailable, equivalent local checks are:

```sh
./node_modules/.bin/tsc --noEmit
node --import tsx --test tests/*.test.ts
./node_modules/.bin/biome check src dev docs tests biome.json package.json tsconfig.json
```

Tests use Node's test runner, temporary command modules, and mocked REST methods.
Cover discovery, failure handling, and deployment behavior without real tokens,
Discord login, or external requests. Do not run `pnpm start`, `pnpm dev`, or
`pnpm start:debug` as verification: those scripts load private environment files.

## Git

- Preserve unrelated user changes. Do not commit or push unless requested.
- Split work into focused commits rather than bundling all changes into one large
  commit. Group related features and files into coherent batches, staging each
  batch explicitly. Keep the implementation and tests needed for each change
  together; separate independent features, refactors, examples, or documentation
  updates when they form distinct changes. Each commit should be understandable
  and leave the project in a working state.
- When committing, follow this format:
  `<type>(<scope>): <concise imperative description>`.
- Use `feat` for functionality, `fix` for corrections, `refactor` for behavior-
  preserving restructuring, `chore` for tooling, `docs` for documentation, and
  `test` for tests. Add a body only when useful for explaining the change.
- Example: `feat(commands): load commands from conventional directories`.
- Before committing, inspect the staged filenames and run relevant checks. Keep
  private environment files and generated dependencies out of the commit.
- Use GitHub CLI (`gh`) for GitHub operations, including creating and updating PRs.
- Structure every PR description with these headings, in order:
  - `## Title`: repeat the PR title exactly.
  - `## Changes`: list the concrete changes as bullet points.
  - `## Description`: give a short overview and explain the implementation choices.
    Include relevant validation and limitations here without adding extra headings.
