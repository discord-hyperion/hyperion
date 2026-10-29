# Turborepo verification research

Planning only, researched 2026-10-30 against local commit
`471f114bca7ec6ff1943be68f7ae3bcfe474d474` and current official documentation.
No implementation, publication, login, deployment, or private environment reads.
The requested checkout-local research skill was absent; the installed
`/Users/favteo/.agents/skills/research/SKILL.md` supplied the research workflow.

## Constraints and current facts

**User-confirmed constraints:** initially one framework package and a private dev
bot; future scoped utilities/plugins only when concrete; independent versions;
pnpm/Turbo planning direction; JSX package unconfirmed. These are planning inputs,
not decisions inferred from tooling. Existing architecture still says one package;
that documentation will need reconciliation in a later implementation task.
[Architecture](../architecture.md), [contributor guidance](../../AGENTS.md).

**Fact:** the root package runs `node --import tsx --test tests/*.test.ts`, while
`tsc --noEmit` includes framework, dev bot, runtime tests, and `.types.ts` contracts.
The latter are not selected by the runtime test glob. ESM, NodeNext, `.ts` imports,
and no-emit checking are already configured. CI installs the frozen pnpm lockfile
on Node 24 and runs typecheck, tests, then Biome; no Turbo setup exists in this
workflow. Preserve these separate checks and the pinned pnpm version.
[Package](../../package.json), [TypeScript](../../tsconfig.json),
[CI](../../.github/workflows/ci.yml),
[type contract example](../../tests/command-input.types.ts).

**Fact:** framework tests import source-relative internals, not just the public
barrel. Root TypeScript paths map `@hyperion` to `src/index.ts` and expose several
internal aliases. Dev handlers consume `@hyperion`, so the current root config
joins both sides of the boundary. Typechecking or testing a future package in
isolation must not silently retain a root alias that bypasses its package exports.
[TypeScript](../../tsconfig.json),
[registry tests](../../tests/command-registry.test.ts),
[dev ping](../../dev/bot/src/commands/(general)/ping.ts),
[public barrel](../../src/index.ts).

**Fact:** tests mix framework unit/integration cases with dev-bot consumption.
Examples include direct todo handler imports; full dev-root discovery for select
menus, context menus, autocomplete, modals and subcommands; and temporary wrappers
re-exporting dev ping/profile handlers. These are offline integration cases, not
live bot tests. Splitting by filename alone would misclassify mixed files.
[Todo](../../tests/todo-input.test.ts),
[select menus](../../tests/select-menus.test.ts),
[context menus](../../tests/context-menu-commands.test.ts),
[autocomplete](../../tests/autocomplete.test.ts),
[modals](../../tests/modals.test.ts),
[subcommands](../../tests/subcommands.test.ts),
[dispatcher](../../tests/interaction-dispatcher.test.ts),
[buttons](../../tests/buttons.test.ts).

**Fact:** registry tests create temporary roots, generate `.mjs`/`.ts` handlers,
embed absolute framework file URLs and `import.meta.resolve` builder URLs, and
clean up through `t.after`. REST prototype methods are mocked before initialization
with fake tokens. Initialization with command options can invoke registration;
the mock is essential even without login. The actual dev entry deploys commands
then logs in and must not be imported by verification.
[Registry tests](../../tests/command-registry.test.ts),
[dispatcher tests](../../tests/interaction-dispatcher.test.ts),
[registration implementation](../../src/registries/command-registry.ts),
[dev entry](../../dev/bot/index.ts),
[registration guide](../command-registration.md).

**Inference:** class/module identity is a migration constraint. Registry validation
uses `defaultExport.prototype instanceof baseClass`; command routing also uses
`instanceof`. Loading fixtures against source while the registry loads a separate
compiled copy can reject valid-looking subclasses. Resolving generated fixture
imports to the same framework module graph avoids that failure. Similarly, mocking
one installed REST constructor will not intercept a distinct dependency copy.
Keep each test process consistently source-based or consistently package-based.
[Class assertion](../../src/util/assert-registry-class.ts),
[module loader](../../src/registries/load-modules.ts),
[command registry](../../src/registries/command-registry.ts),
[fixture generation](../../tests/command-registry.test.ts).

## Test ownership alternatives

**Recommendation A, incremental:** retain a root offline integration suite during
the split, with explicit inputs covering framework, bot, fixtures and shared config.
Move pure framework cases and their type contracts to the framework package first.
Root integration must be its own task, not a root script recursively invoking
itself through Turbo. This reduces immediate test rewrites but has broad cache
invalidation. Root tasks are explicitly supported for migration.
[Turbo task guide](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#registering-root-tasks),
[mixed-file evidence](../../tests/buttons.test.ts).

**Recommendation B, preferred destination:** framework owns source-relative
behavior, discovery, atomic failure and mocked deployment tests; private bot owns
tests of its real handlers and its framework dependency. Split mixed files by case,
keeping framework invariants tested with minimal generated handlers rather than
bot business logic. Keep shared fixtures local until reuse justifies a testing
package; do not invent another published package. This follows the existing
framework/dev responsibility boundary and observed coupling.
[Architecture](../architecture.md),
[registry tests](../../tests/command-registry.test.ts),
[bot-specific tests](../../tests/todo-input.test.ts).

**Alternative C:** a private integration workspace can own cross-package suites
and declare dependencies on both packages. It makes task ownership explicit but
adds a workspace solely for testing; choose only if root or bot ownership becomes
awkward. This is a proposed organizational option, not an existing requirement.
[Current scope](../architecture.md).

## Verified Turbo semantics and proposed graph

**Facts:** task `dependsOn` establishes ordering: `^build` targets dependency
packages, `build` the same package, and `package#task` a specific task. Turbo's
documented transit-node pattern propagates dependency changes without running a
script at that node. Therefore a workspace dependency alone is not a sufficient
claim that all dependent tests rerun; tasks need the relevant hash relationships.
[Task dependencies and transit nodes](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks).

**Recommendation:** for source-based verification, declare bot → framework in
workspace manifests and use this conceptual task fragment (names are illustrative):

```json
{
    "tasks": {
        "transit": { "dependsOn": ["^transit"] },
        "typecheck": { "dependsOn": ["transit"], "outputs": [] },
        "test": { "dependsOn": ["transit"], "outputs": [] }
    }
}
```

Do not create a `transit` package script. A simpler alternative is `^test` and
`^typecheck`, accepting serialized upstream checks. Neither option requires a
build before `tsx` development. If the bot instead resolves compiled package
exports, its verification needs an explicit framework build edge and artifact
outputs; do not apply the source-only graph to that mode.
[Transit pattern](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#dependent-tasks-that-can-be-run-in-parallel),
[current no-emit development](../../package.json).

**Facts:** default inputs cover package source-controlled files; custom `inputs`
replace defaults, while `$TURBO_DEFAULT$` preserves them. `$TURBO_ROOT$` includes
shared files outside a package. `globalDependencies` changes affect every task.
Empty outputs cache logs, not emitted files; declare actual artifact directories
for builds/reports. `cache: false` forces execution when selected.
[Configuration reference](https://turborepo.dev/docs/reference/configuration).

**Facts:** cache reuse depends on global and task hashes. Root dependency/lockfile
changes can affect the global hash; package-relevant lockfile changes affect that
package. Current docs also include the source closure of root workspace dependencies
globally. Avoid making the root depend on framework merely for convenience if
isolated invalidation matters. Turbo records/replays task logs and offers dry runs
and summaries to diagnose inputs and outputs.
[Cache semantics](https://turborepo.dev/docs/crafting-your-repository/caching).

**Recommendation:** include shared tsconfig inputs for typechecks, shared Biome
config for checks, and any root-held fixtures for their consumers. Prefer targeted
root inputs over making every shared file global. Never glob private environment
files into verification inputs. Keep temporary handler directories ephemeral;
their source templates are inputs, their random paths are not reusable outputs.
Do not cache reports containing absolute temporary/worktree paths without proving
they remain valid when restored. These recommendations follow the input rules
and the existing temporary-fixture design.
[Input reference](https://turborepo.dev/docs/reference/configuration#inputs),
[fixture source](../../tests/command-registry.test.ts).

## Packaging, Biome, and CI recommendations

**Recommendation:** add a separate packed-consumer check before release: build
the intended distributable if required, `pnpm pack` to a temporary destination,
install the tarball into an isolated consumer, resolve public exports/types without
root aliases, then run offline discovery and a minimal subclass/registry check.
Generate handlers inside that consumer or resolve absolute URLs from its installed
package. Check included files for missing declarations/runtime files and accidental
dev/tests content. A tarball check verifies a boundary source tests bypass; it does
not publish. pnpm documents packing and `files` selection.
[pnpm pack](https://pnpm.io/cli/pack),
[current source-only imports](../../tests/command-registry.test.ts).

**Recommendation:** keep packing verification distinct from fast source tests.
If cached, give it explicit build/pack dependencies, complete inputs and declared
artifacts; initially running it uncached avoids stale temporary-install state.
No claim here chooses JavaScript versus TypeScript distribution or public package
names. Preserve no mandatory compilation for development regardless of release
artifact choice.
[Existing development commands](../../package.json),
[Turbo task dependencies](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks).

**Recommendation:** initially retain one read-only root Biome check for the whole
repository, run directly in CI (or as a carefully scoped root task). Alternative:
per-package checks plus a root-files/docs/config check; their file coverage must
be exhaustive and non-overlapping. Each package check must hash shared Biome config.
Keep write-mode formatting/fixes as explicit uncached developer operations, not
cacheable verification. No ESLint/Prettier migration is needed.
[Biome config](../../biome.json), [scripts](../../package.json),
[root task support](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#registering-root-tasks).

**Recommendation:** keep frozen pnpm installation, Node tests with `--import tsx`,
no-emit contracts and Biome in CI. First run all verification tasks; introduce
affected filtering only after graph validation. `--affected` selects packages
using Git comparison and requires sufficient base/head history; selection does not
repair missing cache edges. Use `--dry=json` and summaries during implementation
to inspect framework → bot propagation. Remote caching is optional: local-only
`--cache=local:rw` is supported; a managed or self-hosted service is a later choice.
[Run options](https://turborepo.dev/docs/reference/run),
[CI history requirements](https://turborepo.dev/docs/crafting-your-repository/constructing-ci),
[current workflow](../../.github/workflows/ci.yml).

**Recommendation:** validate cache behavior with controlled changes to framework
source, bot source, fixture templates, shared tsconfig, Biome config and lockfile;
confirm intended misses and unrelated hits. Confirm a second unchanged run hits,
and build artifacts restore after deletion. No Turbo graph was executed here;
these are acceptance checks for later implementation, not observed outcomes.
[Turbo cache diagnostics](https://turborepo.dev/docs/crafting-your-repository/caching).

**Fact/recommendation:** remote caches transfer artifacts including logs. Adopt
one only after choosing access/write policy and ensuring offline tasks print no
secrets. Keep live startup, login, command deployment and publishing outside the
verification graph entirely; if separately registered as tasks, disable caching,
and mark long-running processes persistent. Disabling cache does not authorize
running them. Keep verification limited to fake credentials/mocked REST.
[Remote cache](https://turborepo.dev/docs/core-concepts/remote-caching),
[task cache/persistence](https://turborepo.dev/docs/reference/configuration),
[repository requirements](../../AGENTS.md).

## Unresolved choices

- Human/product decision: final package names and runtime distribution contract;
  whether JSX ever becomes a package remains unconfirmed.
- Ownership choice: root integration transition, bot-owned cases, or private
  integration workspace; split mixed tests before deciding fixture extraction.
- Engineering choice: source-resolving dev entry versus compiled-export consumer
  mode, and how to guarantee one framework/Discord module graph in each suite.
- Engineering choice: transit edges versus serialized upstream checks; exact
  task inputs/outputs must be tested against the selected pinned Turbo version.
- Team policy: all-task versus affected CI, packed-check frequency, remote-cache
  provider/access/trust policy. No policy is selected by this research.

These choices are proposals or open questions, grounded in the implementation and
official sources above; they do not alter the confirmed independent-version,
private-bot, pnpm, ESM/NodeNext, Biome, Node-test and tsx constraints.
