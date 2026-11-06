# Continuous integration

[GitHub Actions](../.github/workflows/ci.yml) runs on pull requests, pushes to
`main`, and manual dispatch. Every job uses Node.js 24 and the pnpm version pinned
in `package.json`, caches the pnpm store, and installs with
`pnpm install --frozen-lockfile`. It has five jobs:

| Job             | Runs                                    | What it does                                                                                                                                                                                                       |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Changes`       | Always                                  | Compares the commits and decides whether the code checks are needed                                                                                                                                                |
| `Lint and docs` | Always                                  | `pnpm check`: Biome, the documentation check (`scripts/check-docs.mjs`: links, anchors, example imports), the example type check (`scripts/check-examples.mjs`), and the layout check (`scripts/check-layout.mjs`) |
| `Code`          | Unless the change is documentation-only | Type checking and isolated tests, the CI helper tests, and the release, cache, and packed-consumer verification                                                                                                    |
| `Docs site`     | When the guide or site build changes    | Builds the Fumadocs site (`apps/docs-site-fumadocs`) and runs its 14 output checks                                                                                                                                 |
| `Checks`        | Always, last                            | The single result for the workflow                                                                                                                                                                                 |

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

## Cache verification

The `Code` job runs `pnpm verify:cache` only when a change touches something that
decides Turborepo task hashes: `turbo.json`, any `package.json` or `tsconfig*.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.gitignore`, the script itself, or a
workflow. `scripts/ci-changes.mjs` reports this as `cache=`, and an unknown
comparison runs it.

The script copies the workspace to a temporary directory, runs every typecheck
and test once cold, and checks the cached replay and restored builds. For each of
eight representative edits, it then asserts from a dry run that exactly the
expected tasks change hash and the rest stay cache hits. It does not re-run the
tasks after each edit; the typecheck and test step already proves they pass.

## Documentation site

`Docs site` runs when a change touches `docs/guide/`, `apps/docs-site-fumadocs/`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, the root `package.json`, or anything under
`.github/workflows/`. It runs `site:build` and `site:check` at the site root, the
same way the published site is built. `scripts/ci-changes.mjs` decides this alongside the `Code`
rule, so a guide-only change runs `Lint and docs` and `Docs site` but not `Code`.
It builds only; it never publishes.

Publishing is a separate workflow, [`pages.yml`](../.github/workflows/pages.yml). On
pushes to `main` that touch the same inputs, apart from other workflows, it
builds, runs the same checks, and uploads `out/` to the Cloudflare Pages project `hyperion-docs`
(`hyperion-docs-6h7.pages.dev`) with Wrangler. It needs the `CLOUDFLARE_API_TOKEN`
repository secret, a token with only the account permission Cloudflare Pages: Edit.
Only the publish step receives it, since install and build run third-party code.
The account ID is not secret and is written in the workflow. Pull requests are
never published.

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

To read a failed job's log, save it and search the file:
`gh run view --job <job-id> --log > job.log`. `gh run view --log-failed` and the
raw logs API are slow here or refuse output with terminal escape codes.

## Local checks

`pnpm install` configures Git to use the tracked `.githooks/` directory through
the root `prepare` script. For an existing installation, run `pnpm run prepare`
once to enable the hook. The pre-commit hook checks staged files with Biome,
checks documentation, examples, and layout, and typechecks the workspace. Tests remain a CI gate.
Documentation and type checks inspect the working tree, so they do not validate
an isolated snapshot of a partially staged commit.

`pnpm check:fix` applies layout fixes and then Biome to files changed on the branch relative to local `main`,
including staged, unstaged, and untracked files. It skips deleted files and
private environment files. Use `pnpm check:fix:all` for an intentional repository-wide
formatting pass.

The documentation check verifies relative links, Markdown heading anchors, and
named imports from the public Hyperion exports in supported fenced examples.
It is a static check of the documented imports, not full snippet typechecking.
