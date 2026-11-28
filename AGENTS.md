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

## Source of truth

The implementation and tests are the source of truth for how Hyperion behaves.
Infer subsystem behavior directly from the code rather than from prose docs.

When you state how the code behaves today, in a design discussion or anywhere
else, cite the `file:line` that shows it.

Supporting docs that remain in `docs/`:
- Canonical domain terminology: [Glossary](docs/GLOSSARY.md).
- Open backlog: [Feature list](docs/features.md).
- Historical design decisions: `docs/adr/`.
- Operational contracts: [CI](docs/ci.md), [Releases](docs/releases.md), and
  [Package development](docs/package-development.md).

## Documentation

`docs/guide/` is the human-facing guide published to the docs site. When
user-facing behavior changes, update the matching guide page following
[the writing style](docs/writing-style.md). The guide may omit details but must
never contradict the implementation.

A change that ships or drops backlog work updates
[the feature list](docs/features.md) in the same pull request: delete the done
bullets, and move a finished item to Implemented as one line linking its guide
page. The list holds only open work.

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

When public types or package exports change, also run `pnpm verify:package`: its
packed-consumer fixtures in `scripts/fixtures/` assert published declarations,
including expected type errors.

If the package-manager wrapper is unavailable, use:

```sh
./node_modules/.bin/tsc --noEmit
node --import tsx --test packages/core/tests/*.test.ts packages/jsx/tests/*.test.tsx apps/dev-bot/tests/*.test.ts
./node_modules/.bin/biome check .
node scripts/check-docs.mjs
node scripts/check-examples.mjs
```

Tests use Node's test runner, temporary handler modules, and mocked REST methods.
Cover discovery, failures, and deployment behavior without Discord login, real
tokens, external requests, or command deployment. For documentation-only changes,
run `pnpm check` (formatting, links, and type-checked examples) and confirm the text
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
