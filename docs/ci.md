# Continuous integration

[GitHub Actions](../.github/workflows/ci.yml) runs one Linux job on pull requests,
pushes to `main`, and manual dispatch. The job uses Node.js 24 and the pnpm version
pinned in `package.json`, caches the pnpm store, and installs dependencies with
`pnpm install --frozen-lockfile`.

The `Checks` job runs type checking, isolated tests, Biome, and the documentation
check (`scripts/check-docs.mjs`: links, anchors, and example imports) using the same
commands as local verification:

```sh
pnpm exec tsc --noEmit
pnpm test
pnpm check
```

It does not start a bot, load private environment files, log in to
Discord, or deploy commands. No application secrets are needed. Actions are pinned
to commit SHAs with release comments; update both when upgrading an action.

Review the `CI / Checks` result before merging. GitHub currently rejects branch
protection and rulesets for this private repository's plan, so failed checks do
not automatically block merging. If the repository becomes eligible, require the
`Checks` status check on `main` after the workflow has run successfully.

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
