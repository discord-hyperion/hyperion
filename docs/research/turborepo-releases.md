# pnpm workspaces and independent release workflows

Research date: 2026-10-30. Planning only; Changesets remains a candidate.
Local baseline: `471f114bca7ec6ff1943be68f7ae3bcfe474d474`.

## Scope and local evidence

**Confirmed constraints (task brief):** initially one framework package and a
private development bot; independent package versions; future `@hyperion`
utilities/plugins only when concrete; JSX unconfirmed. Preserve pnpm, ESM,
NodeNext, Biome, Node tests and tsx development without mandatory compilation.
No publication, startup, login or deployment is authorized by this note.

**Facts:** [architecture](../architecture.md) currently specifies one package,
`src` framework and `dev/bot` consumer. [package.json](../../package.json) pins
pnpm 12.15.0, declares ESM, runs development through tsx, has no publish build,
and pins matching discord.js/builders development snapshots.
[tsconfig.json](../../tsconfig.json) uses NodeNext, noEmit, `.ts` imports and
repository aliases; [the public barrel](../../src/index.ts) exports framework
subsystems. [CI](../../.github/workflows/ci.yml) runs frozen installation,
type checking, Node tests and Biome with read-only repository permissions.
These observations describe this checkout, not uncommitted parent planning.

**Inference:** source alias success is not evidence that an installed tarball
works. A package split needs explicit consumer entry points and an artifact
contract; the current noEmit setup does not itself generate distributable JS or
declarations. This follows from the local configuration above and Turbo's
[external package guide](https://turborepo.dev/docs/guides/publishing-libraries).
A release-only build can coexist with source-first tsx development. Turbo's
example dual CJS/ESM build is optional, not a requirement to abandon ESM.

## Workspace relationships versus version policy

**Facts:** pnpm uses `pnpm-workspace.yaml` to select projects. `workspace:` forces
local resolution instead of registry fallback. During packing/publishing,
`workspace:*`, `workspace:^`, and `workspace:~` become respectively an exact,
caret, and tilde range based on the target package version. Explicit ranges such
as `workspace:^1.2.0` preserve their range meaning. Consumers need no workspace
protocol support. See [pnpm workspaces](https://pnpm.io/workspaces).

**Recommendation:** make the root and dev app `private: true`; let the dev app
consume the framework through a workspace dependency. Public packages must not
require the private app. Distinguish app dependency convenience from public
compatibility promises. A future plugin can declare a framework peer plus a
local development dependency when the host must provide the framework;
a utility used internally can be an ordinary dependency. Peers describe host
compatibility; optional peers use `peerDependenciesMeta`, whereas
`optionalDependencies` describe optional installation. These are different
contracts: [npm manifest reference](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/).
Do not infer compatible Discord or framework peer ranges merely from successful
workspace linking; test supported consumers and the pinned prerelease pair.

**Fact:** Turbo coordinates tasks and caches declared build outputs; it does
not choose semantic compatibility. Its publication guide uses a separate
release tool. [Turbo publication guide](https://turborepo.dev/docs/guides/publishing-libraries).
**Recommendation:** use Turbo for checks/build ordering; use the chosen release
tool for version calculation, dependency edits and changelogs. Never cache a
registry publication as an ordinary deterministic task.

## Changesets candidate: release mechanics

**Facts:** leave `fixed` and `linked` empty for independent versions. `private:
true` prevents publication; `privatePackages` separately controls private
version/tag handling (both default false in current v3 docs). `ignore` is a
temporary deferral with mixed-changeset/dependency restrictions, not permanent
privacy. `updateInternalDependencies: patch|minor` controls in-range dependency
range refreshes in packages already releasing; it does not mean every dependency
patch forces a dependent release. Out-of-range dependencies still require
updates. Defaults and exact semantics must be checked against the selected
major. [Changesets configuration](https://changesets.dev/guide/config).

**Facts from current source:** with ordinary out-of-range propagation, a changed
internal dependency outside its dependent's range adds a patch release for
`dependencies`, `optionalDependencies` and `peerDependencies`. A dev-only edge
can update without a release bump. Thus optional installation does not exempt
an incompatible dependent. An experimental `always` mode can force in-range
dependent patch releases; it is not the default.
[Release-plan implementation](https://github.com/changesets/changesets/blob/main/packages/assemble-release-plan/src/determine-dependents.ts).

**Facts from current source:** range edits cover all four dependency fields.
Bare `workspace:*`, `workspace:^` and `workspace:~` remain shorthand in source;
pnpm resolves them in the packed manifest. Explicit workspace semver ranges
can be rewritten. `file:` and `link:` are skipped. Peer update behavior also
has a separate configuration input; do not assume runtime dependency rules
fully describe peer compatibility.
[Manifest-edit implementation](https://github.com/changesets/changesets/blob/main/packages/apply-release-plan/src/version-package.ts).

**Illustration/inference:** if utility A goes from 1.0.0 to 1.0.1 and B supports
`^1.0.0`, B need not automatically release under out-of-range propagation. If A
becomes 2.0.0, B's range needs review and the plan can add B's patch release.
That mechanical patch is not proof that B's public API remains compatible;
maintainers must explicitly request a larger B bump when appropriate.

**Facts:** contributors record package bumps and summaries; `changeset version`
edits versions, dependency ranges and changelogs separately from `publish`.
Publishing checks registry versions and can publish a newly added non-private
package even without an explicit changeset. Current v3 adds `publish-plan` and
`pack`. [Changesets CLI](https://changesets.dev/guide/cli).
The pnpm guide calls for lockfile refresh after versioning and before committing.
It also documents pnpm's native release tooling as another candidate, so
Changesets is not inherent to choosing pnpm.
[pnpm Changesets guide](https://pnpm.io/using-changesets).

**Facts:** `pre enter beta`, subsequent versioning and eventual `pre exit` manage
prerelease state; the configured tag drives prerelease versions and publication
dist-tags. Prerelease mode applies across the repository, not a selectable
subset, and dependency propagation can grow because prereleases do not satisfy
ordinary stable ranges. Stable maintenance and prerelease branch strategy need
an explicit decision. [Changesets prereleases](https://changesets.dev/guide/prereleases).

## Artifact verification before any publication

**Facts:** `pnpm pack` creates tarballs and rewrites workspace dependencies.
Its `files` allowlist controls included content; packing runs lifecycle hooks
including `prepack`, `prepare`, and `postpack`, so it is not necessarily inert.
[pnpm pack](https://pnpm.io/cli/pack),
[pnpm workspace packing](https://pnpm.io/workspaces#publishing-workspace-packages).

**Recommended future readiness checks (not executed here):** inspect lifecycle
scripts first; pack only explicitly selected publishable packages into temporary
output. Inspect filenames and packed manifests without opening private files.
Require intended JS/types/exports, README/license, normal registry dependency
ranges and no dev bot, tests, credentials, repository aliases or missing output.
Install tarballs into an isolated ESM/NodeNext consumer, verify imports and type
resolution, and use mocked framework behavior without Discord login. Preserve
the existing type/test/Biome checks. Public packages must resolve without the
private app or repository source aliases. These checks operationalize the local
artifact gap and the official packing behavior above; no publication is needed.

## npm scope, OIDC and Actions options

**Facts:** scoped packages default to restricted access; public scoped packages
need explicit public access. Publishing under an organization scope requires
appropriate organization membership/permission. The `@hyperion` spelling in
local aliases proves neither npm scope ownership nor package-name availability.
[npm public scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

**Facts:** npm trusted publishing requires npm CLI >=11.5.1 and Node >=22.14.0,
a supported hosted runner (GitHub-hosted for Actions), package-level trust bound
to owner/repository/workflow filename and optionally an environment, plus
`id-token: write`. Configure trust for every package. Direct publishing must be
allowed if using `npm publish`; staged publication has distinct permissions.
New trust configurations expire unless first used successfully within two days.
Package-settings setup presupposes package existence: first-package bootstrap
must be resolved before promising OIDC-only initial publication. Scope ownership
and bootstrap access were not inspected. See
[npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).

**Facts:** the Action main branch identifies itself as v2 development for
Changesets v3; v1 maintenance targets Changesets v2. It offers combined and
separate version/pack/publish actions; separate actions are recommended for OIDC
permission separation. Version PR creation requires repository write/PR rights
and repository permission to create PRs.
[Changesets Action](https://github.com/changesets/action).

**Options, not decisions:** (1) version PR automation only, with publishing
absent; (2) version PR plus a separately authorized publication job; (3) manual
version review with a manually dispatched release job. Keep normal PR CI
read-only and credential-free. For future releases, use frozen install, existing
checks, explicit package packing, serialized release jobs and a separate OIDC
publication boundary. Verify the chosen stable CLI/Action pair instead of copying
v1 input names into v2. Retain pinned pnpm and action SHAs as in current CI.
The pnpm guide's token example is an option, not evidence tokens are required
when OIDC is configured. These recommendations combine the cited Action, npm
and local CI constraints; no workflow was changed or activated.

## Unresolved human choices and handoff

- Select Changesets versus alternatives, then pin compatible CLI/Action versions.
- Confirm npm scope ownership, package names, first release version and access.
- Choose public peer/dependency compatibility ranges and required supported
  consumer tests; decide how pre-1.0 breaking changes are communicated.
- Choose in-range range-refresh policy and whether dependent updates beyond
  incompatibility are desirable; avoid experimental settings by accident.
- Choose changelog presentation, release approvals/cadence, prerelease tags and
  stable maintenance policy.
- Choose release artifact format, supported Node versions, initial-publication
  bootstrap and OIDC/environment permissions. JSX remains unconfirmed.

This note establishes future readiness criteria, not permission to publish.
Only this findings file was authored; no package, lockfile, CI, parent tracker,
credential or runtime changes are part of the research.
