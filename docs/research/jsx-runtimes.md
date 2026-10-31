# JSX runtime research

Researched on 2026-10-29. This is input to a proposed feature, not an implemented
API or a dependency selection. No candidate was installed or benchmarked during
this research. The subsequent [JSX guide](../jsx.md) supersedes package placement
and feature scope; current implementation uses the separate `@hyperion/jsx`
package. See the [embed benchmark](jsx-embed-benchmark.md) for later measurements.

## Question and requirements

Which lightweight JSX approach suits optional Hyperion authoring of Discord
Markdown, embeds, and modals?

The design discussion has agreed on synchronous function components with props,
children, fragments, conditionals, and array mapping. Explicit render functions
would produce strings, fresh `EmbedBuilder` instances, or fresh `ModalBuilder`
instances. Names such as `renderText`, `renderEmbed`, and `renderModal` remain
illustrative. React state, effects, reconciliation, automatic rerendering,
complete message layouts, buttons, and standalone select-menu authoring are
outside the initial scope.

Subsequent discussion settled deferred component evaluation at explicit render
time, recursive child flattening, omission of booleans and nullish children,
preservation of numeric zero, and explicit line breaks. Callers can modify the
returned native builder. Inserting existing native builders into JSX remains
deferred. The agreed proposal uses a small Hyperion-owned runtime within the
existing package, with dedicated runtime subpath exports. A separate package and
standalone discord.js adoption are outside the current scope. Compatibility and
performance still need verification before implementation commitments.

Text is literal by default, with Discord Markdown escaping, explicit formatting
components, a raw-text escape hatch, and dedicated mention components. Mention
formatting must not override the caller's `allowedMentions`. Formatting applies
only to Discord properties that support it. Structural nesting needs runtime
checks, with TypeScript assistance where practical. Invalid output should report
an error rather than silently truncate, discard, or split content.

Existing native builder APIs remain supported. The proposal must preserve the
[one-package architecture](../architecture.md#package-boundaries), native
`toJSON()` validation and the SDK validator setting, and the existing
[modal registration and shared-definition model](../modals.md). The
[feature backlog](../features.md) already proposes declarative embed creation;
JSX can be an authoring option for that feature.

## Separate the three layers

1. **Transform:** convert `.tsx` syntax to JavaScript calls. TypeScript's automatic
   transform imports `jsx`/`jsxs` from the configured `jsxImportSource` plus
   `/jsx-runtime`; the development variant uses `/jsx-dev-runtime`.
   The option named `react-jsx` does not require choosing React as the runtime.
   See [TypeScript's import-source reference](https://www.typescriptlang.org/tsconfig/jsxImportSource.html)
   and [JSX emit modes](https://www.typescriptlang.org/tsconfig/jsx.html).
2. **Runtime:** the imported factories and fragment marker construct or evaluate
   components. An automatic runtime needs the compiler-facing exports and types,
   including `jsx`, `jsxs`, `Fragment`, and development `jsxDEV` support. The
   [esbuild import-source documentation](https://esbuild.github.io/api/#jsx-import-source)
   describes those entry points. This is a protocol to implement, not a reason
   to depend on a UI framework.
3. **Renderer:** interpret the constructed values as Discord Markdown or native
   builders, enforce composition rules, and preserve useful errors. None of the
   HTML renderers below already supplies this Discord-specific behavior.

## Candidates

The fit assessments below are engineering inferences from the linked primary
sources. They are not performance measurements.

| Approach                                 | What the primary source establishes                                                                                                                                                                                                                                                                                                                                                                                                 | Fit for Hyperion                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hyperion-owned minimal automatic runtime | TypeScript and esbuild permit selecting a custom import source and standard runtime entry points. See the transform references above.                                                                                                                                                                                                                                                                                               | Best initial candidate: a small immutable description tree and Discord renderers can implement exactly the agreed synchronous contract. Hyperion would own runtime correctness, types, escaping, and maintenance. No measured speed or size advantage has been established.                                    |
| `jsx-pragmatic`                          | Its [official README](https://github.com/krakenjs/jsx-pragmatic#readme) describes target-independent JSX structures, function components, fragments, nested children, and custom renderer functions. The examples use the classic `node` pragma and `.render(renderer)`.                                                                                                                                                            | Closest conceptual third-party alternative. Discord renderers would still be necessary. Verify automatic-runtime support, current package exports, TypeScript declarations, NodeNext behavior, dependencies, and maintenance before considering adoption. Those were not established by the README inspection. |
| Hono JSX (`hono/jsx`)                    | The [JSX guide](https://hono.dev/docs/guides/jsx) provides function components, fragments, and automatic-runtime configuration for HTML output. Its [runtime source](https://github.com/honojs/hono/blob/main/src/jsx/jsx-runtime.ts) exports the factory aliases and HTML-oriented helpers.                                                                                                                                        | Useful implementation reference. Its HTML output and escaping are different from Discord Markdown and builder construction. An adapter would need to avoid HTML serialization and supply the domain renderer. Hono's web routing capabilities are unnecessary here.                                            |
| KitaJS Html (`@kitajs/html`)             | Its [package README](https://github.com/kitajs/html/tree/master/packages/html#readme) describes JSX-to-HTML strings, synchronous and asynchronous components, and explicit `safe`/HTML-escaping mechanisms for child text.                                                                                                                                                                                                          | Direct string construction is relevant to Markdown, but the output vocabulary and escaping contract differ. Eagerly flattening everything into strings also loses structural information needed for embed/modal nesting checks. Its HTML design does not satisfy the agreed default Markdown escaping.         |
| Preact                                   | The [v11 TypeScript guide](https://preactjs.com/guide/v11/typescript/) supports automatic JSX. The [factory source](https://github.com/preactjs/preact/blob/main/jsx-runtime/src/index.js) creates VNodes with bookkeeping fields such as DOM, parent, and component references. The [server-rendering guide](https://preactjs.com/guide/v11/server-side-rendering/) renders those trees to HTML using a separate renderer package. | Viable as a tree format, but still requires a Discord renderer and brings UI-oriented semantics/types that the proposal does not use. Evaluate only if concrete ecosystem reuse justifies that dependency; React-compatible syntax alone is insufficient.                                                      |
| Solid Universal                          | The [official Universal renderer documentation](https://github.com/solidjs/solid/blob/main/packages/solid/universal/README.md) supports custom rendering targets through `createRenderer`, with custom `babel-preset-solid` compilation. The [TypeScript guide](https://docs.solidjs.com/configuration/typescript) uses `jsx: preserve` because Solid's transform differs from TypeScript's.                                        | Non-DOM rendering is possible, but this introduces a specialized transform and reactive renderer machinery. It does not match the requested ordinary automatic-runtime setup through the existing development runner.                                                                                          |
| Hyperapp                                 | The [official repository](https://github.com/hyperapp/hyperapp#readme) describes a virtual DOM, diffing, state, effects, and browser mounting.                                                                                                                                                                                                                                                                                      | Its small-browser-framework positioning does not establish a benefit for synchronous Discord descriptions. Would require an authoring adapter and renderer while much of its purpose remains unused.                                                                                                           |
| React baseline                           | [`renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup) produces non-interactive HTML strings.                                                                                                                                                                                                                                                                                                  | A familiar reference, but that renderer does not produce Discord Markdown or builders. A custom React renderer would add machinery without serving the agreed state-free model. This is a fit assessment, not a measured comparison of React's speed.                                                          |

## Version and size evidence

The inspected default-branch manifests reported these versions. These are
source snapshots available during research, not verified npm dist-tags or pinned
dependency recommendations; default branches and documentation can change.

| Candidate   | Observed manifest version | Primary source                                                                            |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Hono        | `4.13.14`                 | [Manifest](https://github.com/honojs/hono/blob/main/package.json)                         |
| Preact      | `11.0.2`                  | [Manifest](https://github.com/preactjs/preact/blob/main/package.json)                     |
| Solid       | `1.9.17`                  | [Manifest](https://github.com/solidjs/solid/blob/main/packages/solid/package.json)        |
| KitaJS Html | `4.2.13`                  | [Package manifest](https://github.com/kitajs/html/blob/master/packages/html/package.json) |

No comparable installed-size, reachable-module-size, startup-time, or throughput
measurements were collected. Advertised browser gzip sizes are not a fair measure
of the dependency/import cost of a Node Discord bot. In particular, distinguish
the whole package from the actual runtime subpath and its transitive imports.

KitaJS publishes [HTML-building benchmark material](https://github.com/kitajs/html/tree/master/benchmarks),
and its README describes microbenchmarks against other HTML builders. This is
evidence of upstream performance work, not evidence that it renders Hyperion
Markdown or native builders faster. No upstream numbers are reproduced here.

## CommandKit case study

CommandKit implements its own small JSX factory rather than wrapping React,
Preact, Hono, or another JSX runtime. This was traced at commit
`e65f24305f2e05780dda4c5b86de2df2752fc09a` on 2026-10-29; its package manifest
reports version `1.2.1`. These findings concern that source revision, not every
published CommandKit version.
- The [package export map](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/package.json)
  points `commandkit/jsx-runtime` to `jsx-runtime.cjs` for both imports and
  requires. The [entry point](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/jsx-runtime.cjs)
  reexports `jsx`, `jsxs`, and `Fragment` from its own compiled
  `components/common/element.js`.
- In [the implementation](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/src/components/common/element.ts),
  `jsx` and `jsxs` alias `createElement`, which immediately invokes the supplied
  component function with merged props and children. This is eager evaluation,
  not a deferred tree or third-party rendering delegation. The file's value
  import is CommandKit's own configuration helper; Discord builder imports are
  type-only. `Fragment` flattens an array one level. This factory itself does not
  implement Markdown escaping or omit boolean/nullish children.
- [Modal](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/src/components/interactive/modal/Modal.ts)
  constructs a `ModalKit`, populates its builder properties and children, and can
  attach submission callbacks. [ModalKit](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/src/components/interactive/modal/ModalKit.ts)
  extends Discord's `ModalBuilder` and adds collector behavior. Thus the
  component layer supplies native-builder construction separately from the JSX
  factory. Those collectors are outside Hyperion's agreed JSX scope.
- [TextDisplay](https://github.com/neplexlabs/commandkit/blob/e65f24305f2e05780dda4c5b86de2df2752fc09a/packages/commandkit/src/components/display/text-display.ts)
  constructs a Discord `TextDisplayBuilder`. It joins child arrays with spaces
  or stringifies a scalar under a truthiness check; it does not implement the
  proposed default Markdown escaping. This component was inspected as an example,
  not as an exhaustive audit of CommandKit's text-formatting API.

The traced factory is owned by CommandKit, even though it uses external Discord
builders and build tooling elsewhere. No claim is made that the whole package
has zero dependencies or that its factory is faster than alternatives. The
inspected export map has no `jsx-dev-runtime` entry, so do not infer complete
development-transform support from its production-runtime entry alone.

**Implication for Hyperion:** a Discord framework can implement JSX with a small
owned factory and builder-producing components. CommandKit is a concrete
reference, not a drop-in solution: Hyperion's accepted deferred evaluation,
explicit render functions, escaping, child normalization, and handler boundaries
would require different behavior. The agreed proposal adopts an owned runtime
with Hyperion's deferred rendering contract.

## Research assessment

The agreed proposal selects a Hyperion-owned automatic runtime, with CommandKit
as a concrete example of an owned Discord JSX factory. Retain `jsx-pragmatic`
as a researched alternative, and use Hono, KitaJS, and Preact as references for
runtime entry points, child normalization, and tradeoffs. The rationale is scope
fit: Hyperion needs a synchronous Discord description language, custom escaping,
and native builder output. This does not establish a speed advantage.

Prefer retaining a structural description until an explicit renderer processes
it. That gives each render a chance to construct fresh builders, reject a field
outside an embed or an input outside its permitted modal parent, and escape text
according to its target context. The agreed render-time evaluation must be
preserved when assessing a runtime, including CommandKit's eager reference.

Do not promise full parent/child discrimination through JSX types. TypeScript's
[JSX result-type documentation](https://www.typescriptlang.org/docs/handbook/jsx.html#the-jsx-result-type)
states that a JSX expression's `JSX.Element` does not preserve retrievable type
information about its element, attributes, or children. Typed props and children
can help, but arbitrary JSX root categories and nesting require runtime checks.
The renderer's result type can still be precise: string, `EmbedBuilder`, or
`ModalBuilder`.

## Repository integration to verify later

The current [TypeScript configuration](../../tsconfig.json) has no JSX options
and includes `.ts` source patterns only. The
[module filename filter](../../packages/core/src/util/discover-modules.ts) accepts `.ts`/`.js`
and their `.m`/`.c` variants, but not `.tsx` or `.jsx`. Supporting JSX handlers is
therefore broader than adding a runtime factory.

The proposal should account for runtime and declaration exports at the automatic
runtime subpaths within the existing package, `.tsx` inclusion and discovery,
consistent test/declaration/barrel exclusions, and package-consumer resolution
without relying on repository aliases. `.jsx` discovery and compiled-output
policy should be explicit rather than silently inferred from `.tsx` support.

Keep development execution through `tsx` and type checking separate, as required
by [contributor guidance](../../AGENTS.md). Validate the selected automatic-runtime
configuration with the installed runner and NodeNext settings in an isolated
fixture. The [runner's official repository](https://github.com/privatenumber/tsx#readme)
and [esbuild configuration reference](https://esbuild.github.io/api/#jsx-import-source)
are starting points, not a substitute for that compatibility check. No startup
script, Discord login, or network deployment is needed for such a fixture.

## Questions for a later prototype

- Verify recursive flattening, omitted boolean/nullish children, preserved zero,
  and explicit breaks. Reject promises explicitly under the synchronous contract.
- Verify render-time component evaluation and repeated-render semantics; decide
  mutation rules for props and whether `key` is ignored metadata or unsupported. Do not add
  reconciliation merely because automatic-runtime factories receive a key.
- Specify whitespace, line breaks, code fences, link labels/destinations, and
  escaping in each Markdown context. Default escaping must avoid double escaping
  already rendered child nodes. Plain-text modal properties remain plain text.
- Verify native-builder validation and original-error context against the pinned
  Discord v15 prereleases. Respect disabled SDK validators; do not recreate
  Discord's entire schema. Determine which message-level checks belong at the
  render boundary and which require the caller's complete reply payload.
- Confirm the component vocabulary, diagnostic paths, and handling of unsupported
  structural children. Verify callers can modify the returned builder; inserting
  existing builders into JSX remains deferred. Avoid printing private modal text
  in error messages.
- Measure equal outputs before selecting for speed: Markdown with escaping,
  mapped embed fields, a modal with native labels/inputs, reusable components,
  repeated renders, and invalid nesting. Compare native hand-written builders as
  the baseline, including native `toJSON()` validation for every candidate.
- Record exact dependency revisions, Node/runtime versions, cold import time,
  warm execution distributions, allocation/memory behavior, and reachable import
  footprint. Separate JSX transform time, tree creation, rendering, and native
  validation. Run without Discord requests or private credentials.

No prototype, runtime, package export, or discovery change is made by this note.
