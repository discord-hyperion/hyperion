# Continuous integration

[GitHub Actions](../.github/workflows/ci.yml) runs on pull requests, pushes to
`main`, and manual dispatch. Every job uses Node.js 24 and the pnpm version pinned
in `package.json`, caches the pnpm store, and installs with
`pnpm install --frozen-lockfile`. It has four jobs:

| Job             | Runs                                    | What it does                                                                                                      |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Changes`       | Always                                  | Compares the commits and decides whether the code checks are needed                                               |
| `Lint and docs` | Always                                  | `pnpm check`: Biome, plus the documentation check (`scripts/check-docs.mjs`: links, anchors, and example imports) |
| `Code`          | Unless the change is documentation-only | Type checking and isolated tests, the CI helper tests, and the release, cache, and packed-consumer verification   |
| `Checks`        | Always, last                            | The single result for the workflow                                                                                |

The `Code` job runs the same commands as local verification:

```sh
pnpm exec tsc --noEmit
pnpm test
pnpm check
```

## Documentation-only changes

`scripts/ci-changes.mjs` skips `Code` only when every changed file is under
`docs/`, is `AGENTS.md` or `CODING_STANDARDS.md`, or is a package `README.md`
(`packages/*/README.md`). Anything else runs the full checks, including changesets,
workflow files, scripts, lockfile, and anything under `apps/`. An unknown
comparison (a manual run, a first push, an unreachable base commit, or no changed
files) also runs everything, so a mistake can only run too much, never too little.
The script has its own tests (`scripts/ci-changes.test.mjs`), which the `Code` job
runs, so changing it always runs them.

`Checks` waits for the other jobs. A skipped job counts as passing; a failed or
cancelled one fails the result. It keeps the name `CI / Checks` whichever jobs a
change needed.

It does not start a bot, load private environment files, log in to Discord, or
deploy commands. No application secrets are needed. Actions are pinned to commit
SHAs with release comments; update both when upgrading an action.

Review the `CI / Checks` result before merging. GitHub currently rejects branch
protection and rulesets for this private repository's plan, so failed checks do
not automatically block merging. If the repository becomes eligible, require the
`Checks` status check on `main` after the workflow has run successfully; it is the
only job that needs requiring.

## Local checks

`pnpm install` configures Git to use the tracked `.githooks/` directory through
the root `prepare` script. For an existing installation, run `pnpm run prepare`
once to enable the hook. The pre-commit hook checks staged files with Biome,
checks documentation, and typechecks the workspace. Tests remain a CI gate.
Documentation and type checks inspect the working tree, so they do not validate
an isolated snapshot of a partially staged commit.

`pnpm check:fix` fixes files changed on the branch relative to local `main`,
including staged, unstaged, and untracked files. It skips deleted files and
private environment files. Use `pnpm check:fix:all` for an intentional repository-wide
formatting pass.

The documentation check verifies relative links, Markdown heading anchors, and
named imports from the public Hyperion exports in supported fenced examples.
It is a static check of the documented imports, not full snippet typechecking.
