# Package changesets

Run `pnpm changeset` for a public package change, select the affected packages and
bump types, and write a user-facing release note. Commit the generated Markdown
file with the implementation. Private applications and tooling-only changes do
not need a package release.

Public packages version independently. While core is 0.x, use a minor bump for
breaking changes and a patch for compatible fixes. Review dependent API impact
and peer ranges; generated ranges are proposals to review, not compatibility proof.

Version PRs consume these notes into per-package changelogs. Merging a version PR
does not publish. See [release operations](../docs/releases.md) for reviewed
versioning, opt-in beta releases, and the disabled-by-default publication workflow.
