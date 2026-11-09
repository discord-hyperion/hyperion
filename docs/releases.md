# Release operations

Public packages use independent Changesets versions and publish under the
`@hyperion-js` npm scope. The workspace root is private. Until discord.js v15 is
stable, `main` stays in [beta prerelease mode](#beta-prerelease), and every
release is a `1.0.0-beta.N` version on the `beta` channel. Breaking changes
between betas are expected; bump types are review decisions.

## Changes and reviewed version PRs

Run `pnpm changeset` with a public package change and commit its release note.
Keep code blocks in a release note free of blank lines: Changesets drops them in
the changelog, so `pnpm check` rejects them.
Choose every affected public package, its bump type, and a user-facing summary.
Tooling-only changes do not need a package release.

On main, the version workflow maintains a PR titled
`chore(release): version packages`. It runs the version-only Action entry point,
with no publish command or npm identity permission. `pnpm version-packages`
consumes notes, updates package versions/changelogs, formats the generated files
with Biome, and refreshes the pnpm lockfile. It changes files locally; it does not
commit or publish by itself. Changesets formatting is disabled because the pinned
CLI's config validator does not accept Biome; the wrapper runs Biome explicitly.

Review versions, changelogs, dependency updates, and peer compatibility. Compatible
unchanged dependents stay unreleased; out-of-range dependencies can require a
release. The pinned configuration also avoids unnecessary peer-dependent bumps
when ranges still accept an update. Its experimental peer option is covered by
`pnpm verify:release`; recheck it when upgrading Changesets. Do not merge generated
peer-range widening without evidence of support.

The workflow has two requirements that nothing else reports:
- **Repository setting:** Settings → Actions → General → Workflow permissions →
  "Allow GitHub Actions to create and approve pull requests" must be on, or the
  run fails with "GitHub Actions is not permitted to create or approve pull
  requests".
- **Full history:** its checkout uses `fetch-depth: 0`. `changeset version` reads
  the commit that added each changeset; in a shallow clone it fetches more history,
  which fails ("could not read Username") because the checkout keeps no
  credentials.

The version PR is opened with the default GitHub token, so GitHub holds its CI
run for approval (`action_required`) instead of starting it, and the PR shows no
checks. Approve it with **Approve and run workflows** on the PR (or
`gh api -X POST repos/<owner>/<repo>/actions/runs/<run-id>/approve`); its checks
then appear on the PR as usual. Alternatively, dispatch CI on
the branch (`gh workflow run ci.yml --ref changeset-release/main`). Use that too
when an approved run stays queued and GitHub refuses to cancel or rerun it. A dispatched
run checks the exact head commit but is not listed on the PR, so verify it in the
Actions tab. Merging the version PR does not publish anything.

## Maintainer setup before enabling publication

These are separate maintainer operations; this migration does not perform them.
1. Confirm access to the `@hyperion-js` npm org. npm configures trusted
   publishing only on a package that exists, so publish each package's first
   version by hand: build the verified tarballs with
   `pnpm verify:package --pack-destination <directory>`, then run
   `npm publish <tarball> --access public --tag beta` for each one.
2. Verify the advertised minimum Node/TypeScript versions, Discord peer pins,
   package contents, and consumer contract before the first release. Local
   migration checks establish only their actual installed versions.
3. Create the GitHub environment `npm`, restrict its deployment branches to
   `main`, and configure required reviewers for publication approval.
4. Configure npm trusted publishing for this repository's `publish.yml` workflow
   and the exact `npm` environment. Use GitHub-hosted runners. Regular publication
   uses OIDC rather than a stored npm token.
5. After setup is complete, set the **repository** Actions variable
   `NPM_PUBLISH_ENABLED` to `true`. Leave it unset until then. No enabling setting,
   environment, trust relationship, credential, or initial publication is created
   by these repository files.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the
registry setup. The workflow pins npm 11.21.0 as its publication client; pnpm
remains the workspace package manager.

## Manual publication

After a reviewed version PR is merged, dispatch **Publish package** on main with
the selected package (`@hyperion-js/core`, `@hyperion-js/jsx`, or
`@hyperion-js/sqlite`), its exact reviewed version, and the channel: `beta` while
prerelease mode is active, `latest` after it exits. The release guard requires
main, a version matching the manifest and the channel, and no pending unversioned
notes. The job also requires the enable variable and `npm` environment approval.

The job runs type checks, tests, release-tool checks, Biome, and uncached packed
consumer verification. The latter retains the exact tarball it verified via
`pnpm verify:package --pack-destination <directory>`. The final step publishes
that file with public access and provenance; it does not repack the source tree.
No normal PR or version workflow can invoke that step.

The workflow verifies every public package and retains each tarball, then publishes only
the selected package's exact verified artifact. Package selection is allowlisted;
the version guard reads the selected manifest. Configure trusted publishing and
bootstrap each npm package independently before enabling publication. It does not create
GitHub releases or Git tags automatically. A failed or repeated publish of an
already-published version needs maintainer inspection; do not change a version
just to retry an unchecked artifact.

## Beta prerelease

`main` is in Changesets prerelease mode with the `beta` tag (`.changeset/pre.json`),
so the version PR produces `-beta.N` versions. Publish them with the `beta`
channel; the guard requires main, a `-beta.N` version, and active beta
prerelease state, and rejects a beta on `latest` or a stable version on `beta`.

Graduate when discord.js v15 has a stable release: run `pnpm changeset pre exit`
in a PR, let the version PR produce the stable versions, and publish them on
`latest`. See [Changesets prereleases](https://changesets.dev/guide/prereleases).

## Verification and pinned tools

`pnpm verify:release` checks guards and exercises patch/dependent/changelog and
beta transitions in a disposable repository, without contacting npm or publishing.
CI runs it alongside the [package and cache checks](package-development.md).

The selected pair is CLI **3.0.3** and Action **2.1.2**, pinned by version and
immutable commit respectively. Sources checked during implementation:
[CLI registry metadata](https://registry.npmjs.org/@changesets%2fcli/3.0.3),
[version Action](https://github.com/changesets/action/tree/v2.1.2/version), and
[Changesets configuration](https://changesets.dev/guide/config).
