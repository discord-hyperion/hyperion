## Title

chore(release): version packages

## Changes

- Apply pending package changesets to independent versions and changelogs.
- Refresh the workspace lockfile and any necessary dependent ranges.

## Description

Review the generated versions, changelogs, and dependency changes before merging.
Check peer compatibility explicitly; generated range updates do not establish
support. Run CI on this branch and require its checks before merging. The default
GitHub token may require a maintainer to dispatch CI manually for this version PR.
Merging this PR does not publish packages; publication uses a separate manual workflow.
