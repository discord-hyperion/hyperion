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
