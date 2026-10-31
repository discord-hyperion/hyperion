# Release operations

Public packages use independent Changesets versions. The initial package is
`@hyperion/core` at 0.1.0; `@hyperion/jsx` starts at 0.0.0 with a minor changeset
proposing its first 0.1.0 release. The root and `@hyperion/dev-bot` are private. While core
is 0.x, project policy uses minor bumps for breaking changes and patch bumps for
compatible fixes; these are review decisions.

## Changes and reviewed version PRs

Run `pnpm changeset` with a public package change and commit its release note.
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

GitHub must allow Actions to create pull requests. PR events created with the
default GitHub token may not start other workflows. A maintainer can dispatch CI
on the generated PR branch from the Actions UI (or use `gh workflow run ci.yml
--ref <version-pr-branch>`), verify checks on its exact head, and then merge.
Merging the version PR does not publish anything.

## Maintainer setup before enabling publication

These are separate maintainer operations; this migration does not perform them.
1. Confirm ownership/access to the `@hyperion` npm namespace and public-package
   publication rights. Establish the initial package through the registry's
   required bootstrap process before configuring its trusted publisher.
2. Verify the advertised minimum Node/TypeScript versions, Discord peer pins,
   package contents, and consumer contract before the first release. Local
   migration checks establish only their actual installed versions.
3. Create the GitHub environment `npm`, restrict allowed branches to `main` and
   `release/beta`, and configure required reviewers for publication approval.
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

After a reviewed version PR is merged, dispatch **Publish package** at the reviewed
branch/commit with the selected package (`@hyperion/core` or `@hyperion/jsx`), its
exact reviewed version, and the `latest` channel. The release guard
requires main, a non-prerelease version matching the manifest, no prerelease state,
and no pending unversioned notes. The job also requires the enable variable and
`npm` environment approval.

The job runs type checks, tests, release-tool checks, Biome, and uncached packed
consumer verification. The latter retains the exact tarball it verified via
`pnpm verify:package --pack-destination <directory>`. The final step publishes
that file with public access and provenance; it does not repack the source tree.
No normal PR or version workflow can invoke that step.

The workflow verifies both packages and retains both tarballs, then publishes only
the selected package's exact verified artifact. Package selection is allowlisted;
the version guard reads the selected manifest. Configure trusted publishing and
bootstrap each npm package independently before enabling publication. It does not create
GitHub releases or Git tags automatically. A failed or repeated publish of an
already-published version needs maintainer inspection; do not change a version
just to retry an unchecked artifact.

## Opt-in beta branch

Create `release/beta` only when a beta cycle is needed. On that branch, update
Changesets `baseBranch` to `release/beta`, run `pnpm changeset pre enter beta`, add
notes, and run `pnpm version-packages`. Review these generated changes through a
PR to that branch and dispatch CI there. The automatic version workflow currently
handles main only.

Dispatch publication from `release/beta` with the exact reviewed `-beta.N` version
and `beta` channel. The guard requires active beta prerelease state. It rejects a
beta on latest, a stable version on beta, and mismatched branches. Main retains
its ordinary non-prerelease flow throughout the beta cycle.

To graduate a beta, run `pnpm changeset pre exit` and `pnpm version-packages`,
review the resulting normal version, restore `baseBranch` to main, and merge
through the ordinary reviewed path. Never merge active prerelease state into
main. See [Changesets prereleases](https://changesets.dev/guide/prereleases).

## Verification and pinned tools

`pnpm verify:release` checks guards and exercises patch/dependent/changelog and
beta transitions in a disposable repository, without contacting npm or publishing.
CI runs it alongside the [package and cache checks](package-development.md).

The selected pair is CLI **3.0.3** and Action **2.1.2**, pinned by version and
immutable commit respectively. Sources checked during implementation:
[CLI registry metadata](https://registry.npmjs.org/@changesets%2fcli/3.0.3),
[version Action](https://github.com/changesets/action/tree/v2.1.2/version), and
[Changesets configuration](https://changesets.dev/guide/config).
