# Package exports and publication artifacts

Research date: 2026-10-30. Planning only; no implementation or packaging prototype
was performed. Baseline: `471f114bca7ec6ff1943be68f7ae3bcfe474d474`.

## Scope and evidence

**Confirmed constraints (task brief):** initially one framework package and one
private development bot; independently versioned future utilities/plugins only
when concrete; JSX package unconfirmed. Preserve ESM, NodeNext, `.ts` relative
imports, Biome, Node tests, and tsx development without mandatory compilation.
Names, supported consumer versions, and publication policy remain human choices.

**Local facts:** [package.json](../../package.json) declares ESM, pnpm 12.15.0,
TypeScript `^7.0.2`, tsx `^4.23.15`, matching pinned Discord/builders prereleases,
and no exports/build publication contract. [tsconfig.json](../../tsconfig.json)
uses NodeNext, `noEmit`, `allowImportingTsExtensions`, and repository paths aliases.
The [public barrel](../../src/index.ts) uses `.ts` relative re-exports.
[Architecture](../architecture.md) still documents the current single-package
layout; this research does not supersede it.

**Inspection limitation:** this assigned checkout has no node_modules. Read-only
inspection of the existing installation at
`/Users/favteo/Coding/discord-hyperion/node_modules` found TypeScript 7.0.2 and tsx
4.23.15, matching the [lockfile](../../pnpm-lock.yaml). Its `tsc --help --all`
confirms `rewriteRelativeImportExtensions`, `customConditions`, `declaration`, and
`declarationMap`. No dependencies were installed, no parent files changed, and no
private environment files read. The requested checkout-local research skill was
absent; the installed research skill supplied the primary-source/note workflow.

## Viable alternatives

These are **inferences/recommendations**, rather than selected policy. Turborepo
supports source-consumed, compiled, and publishable packages; its source strategy
requires consumers capable of transforming TypeScript, and a package without a
build has no package build output to cache. It does not require bundling.
[Source: Turborepo internal packages](https://turborepo.dev/docs/core-concepts/internal-packages).

| Strategy                                                  | Development                            | Published consumption               | Main tradeoff                       |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------- | ----------------------------------- |
| Source everywhere                                         | tsx reads `.ts`; no build              | Consumers must support package TS   | Narrow runtime/tooling contract     |
| Explicit source condition, default artifacts              | tsx plus custom condition reads source | ESM JS plus declarations by default | Two resolution modes to verify      |
| Source workspace manifest, rewritten publication manifest | Local exports always source            | Packed manifest points to artifacts | Pack transformation must be tested  |
| Artifacts everywhere                                      | Bot consumes emitted JS                | Same artifacts locally and remotely | Requires build/watch before bot use |

**Recommendation:** prototype the second and third options. The fourth conflicts
with the confirmed build-free development requirement as the sole development
path. Source-only publication is possible with an explicitly narrow consumer
contract, but plain Node's native stripping refuses TypeScript under
`node_modules` and does not implement tsconfig paths. It is therefore unsuitable
as an assumed general Node package default.
[Source: Node TypeScript](https://nodejs.org/api/typescript.html#type-stripping-in-dependencies).

## Explicit development conditions

**Fact:** Node resolves ordered conditional exports, accepts custom conditions via
`--conditions`, and uses `default` as fallback. `NODE_ENV=development` alone does
not activate a custom condition. Exports also define the allowed public subpaths.
[Source: Node packages](https://nodejs.org/api/packages.html#conditional-exports).

**Illustrative proposal, not final manifest:** use a namespaced condition to avoid
accidentally changing other dependencies' generic development branches:

```json
{
    "type": "module",
    "exports": {
        ".": {
            "hyperion-source": {
                "types": "./src/index.ts",
                "default": "./src/index.ts"
            },
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    }
}
```

**Fact:** TypeScript `customConditions: ["hyperion-source"]` adds that condition
to NodeNext resolution. It does not set the runtime's conditions.
[Source: TypeScript customConditions](https://www.typescriptlang.org/tsconfig/customConditions.html).
**Inference:** the branch must precede artifact types so development type checking
can work with no dist. Keep `types` first inside each corresponding branch; use
matching condition sets in editor, tests, and runtime. Prototype a secret-free
fixture with `node --conditions=hyperion-source --import tsx fixture.ts` and a
separate artifact consumer without that condition.
[Source: Node condition ordering](https://nodejs.org/api/packages.html#community-conditions-definitions).

**Fact:** tsx runs TypeScript without type checking; retain `tsc --noEmit`
separately. Its default tsconfig lookup depends on the working directory, so
workspace scripts should resolve a deliberate package config. Node flags are
supported by tsx.
[Sources: tsx TypeScript](https://tsx.hirok.io/typescript),
[tsx Node enhancement](https://tsx.hirok.io/node-enhancement).
**Recommendation:** keep NodeNext rather than adopting the tsx guide's generic
module settings, given this project's Node package contract.

**Alternative fact:** pnpm supports `publishConfig.exports` and other publication
field overrides. **Inference:** source-only workspace exports can thus become
artifact exports when packed, avoiding runtime condition flags locally but making
pack transformation an essential release check. Decide whether published source
conditions should remain usable: either include their targets or remove those
branches in the packed manifest; never ship dangling exports.
[Source: pnpm package manifest](https://pnpm.io/package_json#publishconfig).

## ESM emission and declarations

**Fact:** `rewriteRelativeImportExtensions` rewrites relative TS extensions in JS
output. It does not solve bare aliases/package names, and computed imports need
separate scrutiny. TypeScript's release notes describe source execution followed
by JS emission as a supported scenario.
[Sources: option reference](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html),
[TypeScript 5.7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths).

**Proposal:** a separate package emission config could retain NodeNext/ES2022 and
strict checks, set `noEmit: false`, `declaration: true`,
`rewriteRelativeImportExtensions: true`, `rootDir: "src"`, `outDir: "dist"`, and
include framework source only. Keep development config no-emit. Do not use
`emitDeclarationOnly` for the sole publication build because runtime JS is needed.
Declaration generation produces the package's type surface.
[Source: TypeScript declaration](https://www.typescriptlang.org/tsconfig/declaration.html).

**Needs prototype:** run the installed TS 7 compiler on the actual framework in an
isolated fixture; inspect emitted JS and declaration specifiers and type-check a
consumer of the tarball. Do not assume declaration extension rewriting is
identical to JS rewriting, or that every declaration needs `.js` specifiers to be
valid. Check module augmentation in
[command.ts](../../src/commands/command.ts), generics, and exported inferred types.
`declarationMap`/source maps require a deliberate decision about shipping their
referenced sources. No evidence requires bundling, CJS output, or declaration
bundling; an unbundled ESM tree is the simplest candidate to test.

## Workspaces and aliases

**Fact:** pnpm `workspace:` dependencies require local packages and are converted
to normal version references during packing. Independent versions are compatible
with workspaces; `workspace:*`, `workspace:^`, and `workspace:~` yield different
published ranges.
[Source: pnpm workspaces](https://pnpm.io/workspaces#publishing-workspace-packages).

**Fact:** TypeScript paths do not rewrite emitted imports, and should not substitute
for workspace package lookup when validating a package boundary.
[Source: TypeScript modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths).
**Recommendation:** the private bot should depend on the actual chosen framework
package name using `workspace:` and import its public exports. Current `@hyperion`
is a repository alias, not a selected scoped npm package name. Do not mechanically
interpret `@hyperion/*` as future package names or expose all internal files with
wildcard exports. Preserve internal relative imports. Any retained private
subpath aliases should use Node-compatible `#` imports or be proven unnecessary.

**Inference:** Turbo can orchestrate independent typecheck/test/Biome tasks without
adding a build prerequisite to development. Artifact verification can separately
depend on package build tasks and cache `dist/**`. Source-consumer tasks need
upstream source changes in their cache dependency model; graph ordering alone
must not be mistaken for validated cache invalidation.
[Source: Turbo task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks).

## Runtime identity and discovery

**Local facts:** [button registry](../../src/registries/button-registry.ts),
[modal registry](../../src/registries/modal-registry.ts), and
[handler validation](../../src/util/assert-registry-class.ts) use `instanceof`.
Two framework copies can break subclass validation, just as two builder copies
can break builder checks. Installed builders has separate import `index.mjs` and
require `index.js` targets; installed discord.js uses `src/index.js` for both
conditions, requires builders internally, and pins the same builders prerelease.
Both installed package manifests require Node `>=24.17.0`.
Evidence: the read-only installed `package.json` files and discord.js
`src/index.js` (installation path recorded above).

**Recommendation:** do not bundle Discord/builders into framework outputs. Evaluate
peers plus matching development dependencies for shared SDKs and, later, framework
peers for plugins. Exact matching versions alone do not establish shared runtime
constructors across ESM/CJS entrypoints. Probe the constructors actually used by
framework and bot, ESM versus CJS builders, and Discord-created components. Do not
assume all Discord re-exports exist or are equivalent to direct builder imports;
inspect the installed APIs. Peer range and upgrade policy remain unresolved.

**Local fact/inference:** [discovery](../../src/util/discover-modules.ts) accepts JS
and TS files, while [loading](../../src/registries/load-modules.ts) dynamically
imports file URLs beneath `<root>/src/<handler-folder>`. Framework compilation
alone does not compile consumer handlers. Compiled-bot support needs a fixture
preserving that root/layout, with no mixed source/output tree causing duplicate
discovery. Extension rewriting cannot transform these computed file URLs.

## Required small prototypes and unresolved decisions

**Proposed acceptance checks; not run in this planning task:**
1. Clean workspace: no dist, no root paths aliases bypassing exports. Resolve bot
   types and run Node tests through tsx using the selected source strategy.
2. Emit the framework with TS 7. Inspect JS/declarations and type-check a NodeNext
   consumer against only generated declarations, with no source condition.
3. Pack with pnpm into a temporary destination using an explicit files allowlist.
   Inspect archive filenames and manifest without printing file contents. Confirm
   all exports exist, workspace ranges transform, and bot/private files are absent.
   [Source: pnpm pack](https://pnpm.io/cli/pack).
4. Install that tarball in an isolated consumer outside the workspace. Test plain
   ESM JS import and TS NodeNext checking, then tsx TS handlers consuming artifact
   exports. No tsconfig paths or workspace symlinks may rescue missing artifacts.
5. Exercise exported handler subclasses and all relevant builder families through
   mocked discovery/validation. Assert actual constructor identity and add a
   negative duplicate-copy fixture. No login, deployment, tokens, or REST calls.
6. If compiled bots are supported, test the emitted handler tree/root separately.
   Check Turbo cache invalidation after upstream source edits.

**Human decisions still open:** package names/public subpaths; source condition
versus packed manifest override; whether published sources are supported; minimum
Node/TypeScript/tsx consumers (SDK engine floor is evidence, not a full support
matrix); compiled-bot support; declaration/source-map distribution; SDK peer
ranges; workspace publication ranges and release orchestration. Browser, alternate
runtimes, bundlers, CJS, and JSX should receive no implied support commitment.
