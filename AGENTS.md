# Hyperion contributor guidance

Hyperion is a TypeScript framework for Discord bots, rewritten for discord.js v15.
Follow this repository's implementation; the old Hyperion repository is background
context, not the current API.

## Secrets: explicit user requirement

- Never read `.env` or private `.env.*` files. `.env.example` is a separate,
  non-secret template. Exclude private environment files from searches.
- Never expose secrets through shell output, environment dumps, logs, tests,
  debugger output, or Git diffs. Never stage or commit private environment files;
  `.gitignore` is not permission to read them.
- Never run startup scripts that load private environment files, including
  `pnpm start`, `pnpm dev`, and `pnpm start:debug`. Use isolated tests with fake
  credentials and mocked Discord requests. Ask the user to configure credentials.

## Before changing a subsystem

Read the relevant reference before implementation or review:
- Client lifecycle, registry discovery, or package boundaries:
  [Architecture](docs/architecture.md).
- JSX runtime, embed authoring, or TSX/JSX handlers: [JSX authoring](docs/jsx.md).
- Event discovery, ordering, reloads, or shutdown draining: [Event handlers](docs/event-handlers.md).
- Command loading, deployment, or execution:
  [Command registration](docs/command-registration.md).
- Command folders, parent definitions, subcommands, or future groups:
  [Command paths](docs/command-paths.md) and
  [parent-command decision](docs/adr/0001-explicit-parent-command-definitions.md).
- Context-menu builders, generics, or typed lookup:
  [Context-menu commands](docs/context-menu-commands.md).
- Guard execution or ownership checks: [Guards](docs/guards.md).
- Autocomplete routing, authorization, or response handling:
  [Autocomplete](docs/autocomplete.md).
- Component discovery, routing, state, or acknowledgment: the relevant
  [button](docs/buttons.md), [select-menu](docs/select-menus.md), or
  [modal](docs/modals.md) guide.
- Writing or changing tests, fixtures, or shared test helpers:
  [Test fixtures](docs/test-fixtures.md).
- Logging, sensitive data handling, or startup indicators:
  [Logging](docs/logging.md).
- Domain terminology: [Glossary](docs/GLOSSARY.md). Feature scope and deferred
  work: [Feature backlog](docs/features.md). Database support remains out of scope.

## Tooling and conventions

- Use pnpm, preserve `pnpm-lock.yaml`, and keep the package-manager version pinned
  in `package.json`. Development runs TypeScript through `tsx`; type checking is
  separate. Do not add a required development compilation step.
- Use the installed v15 types and APIs. Keep the separately pinned
  `@discordjs/builders` prerelease compatible with discord.js.
- Use ESM, NodeNext resolution, `.ts` relative imports, and `import type` for
  type-only imports.
- Use Biome for formatting, linting, and import organization; follow `biome.json`.
  Do not add ESLint or Prettier or manually format generated lockfiles.
- Use kebab-case files/directories, PascalCase classes/types, and camelCase
  functions/variables. Command folder delimiters follow the command-path guide. Event folders use
  Discord event-name casing as described in the event-handler guide.
- Prefer `type` over `interface` unless interface semantics such as declaration
  merging are required.
- Prefer arrow functions for standalone functions, callbacks, and type signatures
  such as `run: (ctx: Context) => Promise<void>`. Keep normal class methods.
  Use function declarations only when their semantics are required.
- Omit redundant `public` and `override` on constructors and implemented methods.
  Retain modifiers expressing required semantics; keep `noImplicitOverride` off.
- Infer implemented method return types. Keep explicit return types on abstract
  methods and other declarations defining contracts without implementations.
- Avoid one-off aliases for clear expressions such as `options.commands`; keep
  locals when they improve clarity, avoid repeated work, or provide type safety.
- Group related statements, separating validation, mutations, logging, and later
  operations with blank lines. Follow the registry loaders' spacing.
- Keep the class-based structure; prefer shared implementations or generic types over empty
  `Base<X>` subclasses. Use Discord's `Collection` for keyed stores, including
  tests and examples; arrays, sets, and weak maps suit their respective purposes.

## Verification

For code changes, run:

```sh
pnpm typecheck
pnpm test
pnpm check
```

If the package-manager wrapper is unavailable, use:

```sh
./node_modules/.bin/tsc --noEmit
node --import tsx --test packages/core/tests/*.test.ts packages/jsx/tests/*.test.tsx apps/dev-bot/tests/*.test.ts
./node_modules/.bin/biome check .
```

Tests use Node's test runner, temporary handler modules, and mocked REST methods.
Cover discovery, failures, and deployment behavior without Discord login, real
tokens, external requests, or command deployment. For documentation-only changes,
check formatting, links, and consistency with the implementation.

## Git

- Preserve unrelated user changes. Commit and push only when requested.
- Split independent changes into focused commits; keep implementation and its
  tests together. Each commit should leave the project working.
- Use `<type>(<scope>): <concise imperative description>`, with `feat`, `fix`,
  `refactor`, `chore`, `docs`, or `test` as appropriate. Add a body when useful.
- Before committing, inspect staged filenames and run relevant checks. Exclude
  private environment files and generated dependencies.
- Use GitHub CLI (`gh`) for GitHub operations. PR descriptions use these headings
  in order: `## Title` (repeat the title exactly), `## Changes` (concrete bullets),
  `## Description` (overview, choices, validation, and limitations).
