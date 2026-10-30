# Package development and publication artifacts

The workspace resolves `@hyperion/core` to `packages/core/src/index.ts`. The dev
bot uses this public export through its workspace dependency. Run source checks
and tests without compiling first:

```sh
pnpm typecheck
pnpm test
pnpm check
```

## Build and pack

`pnpm build` cleans `packages/core/dist` and emits unbundled ESM JavaScript and
TypeScript declarations from the framework source. Relative `.ts` imports are
rewritten for the emitted files. The build excludes tests, source maps, and
declaration maps.

Packing the core package runs its `prepack` build:

```sh
pnpm --filter @hyperion/core pack --pack-destination /tmp/hyperion-artifacts
```

pnpm applies `publishConfig.exports` to the tarball manifest: published consumers
resolve `dist/index.js` and `dist/index.d.ts`, while local workspace consumers
continue to resolve source. Only the root export is public. Package contents are
limited to `dist`, README, license, and the required package manifest. Use pnpm
for packing so the publication overrides are applied.

## Verify consumers

Run `pnpm verify:package` from the root. This uncached check:
1. Removes generated `dist`, then checks source imports and types without path
   aliases or a development build.
2. Packs the core package and checks its manifest exports and artifact allowlist.
3. Installs the tarball and its dependencies offline into a temporary directory
   outside the workspace, with lifecycle scripts disabled.
4. Checks plain Node ESM imports, NodeNext declaration inference (including
   negative type assertions), tsx consumption, offline command discovery, and
   framework/Discord builder constructor identity.

The check needs the dependencies populated by the normal workspace installation;
its offline consumer install deliberately fails if the pnpm store is incomplete.
It cleans temporary consumers on completion. It does not start the bot, load
private environment files, log in, deploy commands, or publish a package.

Keep each process on one framework/SDK module graph. Mixing source classes with
compiled classes produces distinct constructors and can invalidate discovery's
subclass checks.

The initial published contract is ESM on Node 24.17.0 or newer, with a TypeScript
7.x verification baseline and exact compatible Discord prerelease peers. CommonJS
callers can use dynamic import. Minimum supported versions must be checked before
release; the local verification only establishes the versions actually used.

## Turbo tasks and CI

Turbo is pinned to 2.11.10. Root `typecheck`, `test`, and `build` scripts run Turbo
with `--cache=local:rw`; no remote cache service is configured. Cache files and
task logs live under ignored `.turbo` directories. CI runners initially use only
their local cache, without sharing task artifacts across runs.

Source checks depend on a scriptless `transit` task. Transit edges carry dependency
hashes from core to the bot while allowing their real typecheck/test tasks to run
in parallel. Source checks have no build dependency. Shared TypeScript settings
and workspace configuration are global inputs; shared interaction mocks are
explicit check inputs. Default package inputs are retained, excluding environment
files and generated output, logs, and temporary consumers.

`build` caches `dist/**`. The package's `prepack` script still performs a fresh
build directly, so `verify:package` proves the source-without-dist and packed
artifact contracts every time. Packed verification runs outside Turbo, uncached;
do not run it concurrently with a build that writes the same `dist` directory.

`pnpm verify:cache` copies the controlled source/configuration inputs into a
disposable workspace and installs offline with a frozen lockfile. It verifies:
- Cold source checks without `dist`, followed by unchanged-run cache replay.
- Framework edits invalidate both packages; bot edits invalidate only bot checks.
- Shared fixture/config edits invalidate both packages.
- Dependency-manifest edits invalidate the owning package and its consumers.
- A cached build restores JavaScript and declarations after `dist` is removed.

The mutations affect only the disposable workspace, which is removed afterward.
CI runs all package type checks and tests together, cache acceptance and packed
consumers, and one direct root Biome check. No affected-only filtering or live bot
tasks are used. For an uncached source run, use the direct commands documented in
`AGENTS.md`, or `pnpm exec turbo run typecheck test --cache=local:`.
