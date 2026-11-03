# Continuous integration

[GitHub Actions](../.github/workflows/ci.yml) runs one Linux job on pull requests,
pushes to `main`, and manual dispatch. The job uses Node.js 24 and the pnpm version
pinned in `package.json`, caches the pnpm store, and installs dependencies with
`pnpm install --frozen-lockfile`.

The `Checks` job runs type checking, isolated tests, and Biome using the same
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
