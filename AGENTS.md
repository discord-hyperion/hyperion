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

## Documentation

`docs/*.md` are reference docs for contributors and agents: precise and complete.
`docs/guide/` is the human-facing guide. When behavior changes, update the
reference doc, then the matching guide page following
[the writing style](docs/writing-style.md). The guide may omit details but must
never contradict the reference docs.

A change that ships or drops backlog work updates
[the feature list](docs/features.md) in the same pull request: delete the done
bullets, and move a finished item to Implemented as one line linking its reference
doc. The list holds only open work.

## Tooling and conventions

- Use pnpm, preserve `pnpm-lock.yaml`, and keep the package-manager version pinned
  in `package.json`. Development runs TypeScript through `tsx`; type checking is
  separate. Do not add a required development compilation step.
- Use the installed discord.js v15 types and APIs, not v14 habits. Keep the
  separately pinned `@discordjs/builders` prerelease compatible with discord.js.
- Biome formats and lints (`biome.json`); suppress a rule only with a stated
  reason, such as declaration merging. Format your changes with `pnpm check:fix`,
  which touches only files changed on the branch.
- Code style and structure rules live in [coding standards](CODING_STANDARDS.md).

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
node scripts/check-docs.mjs
```

Tests use Node's test runner, temporary handler modules, and mocked REST methods.
Cover discovery, failures, and deployment behavior without Discord login, real
tokens, external requests, or command deployment. For documentation-only changes,
run `pnpm check` (formatting, links, and example imports) and confirm the text
matches the implementation.

## Git

- Preserve unrelated user changes. Commit and push only when requested.
- Split independent changes into focused commits; keep implementation and its
  tests together. Each commit should leave the project working.
- Use `<type>(<scope>): <concise imperative description>`, with `feat`, `fix`,
  `refactor`, `chore`, `docs`, or `test` as appropriate. Add a body when useful.
- Before committing, inspect staged filenames and run relevant checks. Exclude
  private environment files and generated dependencies.
- Use GitHub CLI (`gh`) for GitHub operations. Write PR bodies with the `pr` skill.
