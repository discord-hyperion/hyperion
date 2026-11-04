# Documentation site generators for Hyperion

Researched **2026-11-04** against repository files and current primary sources.
This is a research recommendation, not an implemented migration. No candidate was
installed, built, or started; dependency resolution and repository compatibility
remain to test. Rankings below are judgments about Hyperion's needs, not measured
performance or popularity.

## Recommendation

1. **Astro Starlight** is the preferred starting point for a polished guide with
   local search and limited custom application code. Accept a content-loading
   adapter and title metadata rather than moving the authoritative Markdown.
2. **VitePress** is the closest challenger, and may be preferable if keeping the
   current directory structure and Markdown editing experience is the overriding
   constraint. Accept Vue as the docs customization stack and maintain explicit
   navigation.
3. **Docusaurus** becomes preferable if independently versioned documentation
   becomes an immediate requirement. Its version snapshots and multiple docs
   instances address that requirement directly, at the cost of more configuration
   and either external search or a community local-search dependency.

Rspress is a credible alternative when React customization, built-in version
routing, and an official TypeDoc integration matter together. Fumadocs is best
reserved for a documentation product requiring custom React layouts or integration
with an existing web application. Neither adds enough value to displace the first
two for today's guide. Supporting sources and qualifications follow.

## Repository constraints

The [architecture](../architecture.md) separates `@hyperion/core` and
`@hyperion/jsx`; the root and package manifests use ESM, TypeScript NodeNext,
pnpm, Turbo, and source exports for development. The root compiler dependency is
TypeScript `^7.0.2`. Core and JSX currently have different pre-1.0 versions.
A documentation build can be isolated without adding compilation to bot
development. React in a documentation tool is an additional maintenance stack,
not a conflict with Hyperion's runtime or its own JSX authoring package.

The [writing policy](../writing-style.md) deliberately separates complete
contributor references from the [human guide](../guide/README.md). Publish the
latter first; keep architecture, ADRs, and research in source unless individually
selected for publication. A site sidebar is not an access boundary: content must
be excluded from route generation, not merely omitted from navigation.

The existing [documentation checker](../../scripts/check-docs.mjs) recursively
checks Markdown under `docs`, verifies relative file links and GitHub-style heading
anchors, and inspects imports in ordinary JavaScript/TypeScript fences. It does
not compile examples or validate generated site routes. Preserve that check and
add site-output validation later. The guide already contains fenced TSX and a
relative link from logging to `../logging.md`; these are concrete migration cases.
The unrelated JSX README rewrite must remain untouched.

## Comparison

“Built-in” includes a project's shipped default theme; “integration” means an
additional package or explicit application wiring. Operational costs are inferred
from those requirements, not benchmarked.

| Candidate  | Markdown and code                                    | Search without a service                          | Navigation and customization                           | Versioning and API path                                               | Fit / operating cost                                        |
| ---------- | ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Starlight  | `.md`; Expressive Code fences; tabs use components   | Default Pagefind                                  | Explicit or generated sidebar; CSS and Astro overrides | Plan archive policy separately; community `starlight-typedoc`         | Best guide default; Astro/content adapter to maintain       |
| VitePress  | Markdown routes; highlighted fences and code groups  | Built-in MiniSearch option                        | Explicit grouped/path-specific sidebars; Vue theme     | Plan archive policy separately; third-party TypeDoc Markdown theme    | Strong preservation fit; Vue/Vite tooling                   |
| Docusaurus | `.md` can use CommonMark mode; React/MDX optional    | Community plugins; official Algolia integration   | Docs sidebars and React theme customization            | Built-in snapshots and multi-instance docs; third-party TypeDoc theme | Strong versioning case; more plugin/configuration ownership |
| Rspress    | Markdown/MDX; code fences and React tabs             | Built-in search; optional official Algolia plugin | Conventional navigation and React theme overrides      | Built-in version directories; official TypeDoc plugin                 | Competitive integrated feature set; Rsbuild stack           |
| Fumadocs   | Markdown/MDX content source; code and tab components | Static browser index requires configuration       | Page tree and application layouts; React               | Design archives explicitly; assess separate API pipeline              | Most application flexibility; most assembly for this scope  |

Sources: Starlight [authoring](https://starlight.astro.build/guides/authoring-content/),
[configuration](https://starlight.astro.build/reference/configuration/),
[search](https://starlight.astro.build/guides/site-search/), and
[tabs](https://starlight.astro.build/components/tabs/);
VitePress [Markdown](https://vitepress.dev/guide/markdown),
[search](https://vitepress.dev/reference/default-theme-search), and
[sidebar](https://vitepress.dev/reference/default-theme-sidebar);
Docusaurus [Markdown modes](https://docusaurus.io/docs/markdown-features),
[search ownership](https://docusaurus.io/docs/search), and
[versioning](https://docusaurus.io/docs/versioning);
Rspress [introduction](https://rspress.rs/guide/start/introduction),
[versions](https://rspress.rs/guide/basic/multi-version), and
[official plugins](https://www.rspress.rs/plugin/official-plugins/overview);
Fumadocs [overview](https://www.fumadocs.dev/docs),
[Markdown](https://www.fumadocs.dev/docs/markdown), and
[static build](https://www.fumadocs.dev/docs/deploying/static).

## Authoring and migration tradeoffs

### Starlight

Starlight supports ordinary Markdown and frontmatter, with syntax highlighting,
line/text emphasis, and code frames through Expressive Code. Its content model
expects metadata such as a title; the default content location is not Hyperion's
existing guide directory. Prototype an external collection loader or deterministic
staging adapter that supplies titles and maps README to the landing route.
Do not maintain hand-edited copies. [Authoring documentation](https://starlight.astro.build/guides/authoring-content/)
and [page model](https://starlight.astro.build/guides/pages/).

Explicit sidebar groups can retain Basics, Interactions, Making it safe, and
Everything else; autogenerated entries can cover a later API section. Start with
CSS customization; component overrides introduce additional coupling to theme
updates. Tabs are available as Starlight components, so adopting them usually
means MDX or another supported component authoring format on selected pages.
Keep simple examples in `.md` rather than converting the entire guide for tabs.
[Configuration](https://starlight.astro.build/reference/configuration/),
[customization](https://starlight.astro.build/guides/customization/), and
[tabs](https://starlight.astro.build/components/tabs/).

Pagefind provides default static full-text search, and individual pages or regions
can be excluded. The official DocSearch plugin is an optional external alternative.
This gives the proposed guide no search-service operating requirement.
[Search documentation](https://starlight.astro.build/guides/site-search/).

### VitePress

File-based Markdown routing, configurable source roots, and route rewrites make
VitePress attractive for preserving the guide. Explicitly map `README.md` rather
than assuming its filename becomes the index. Shiki highlighting, line emphasis,
and code groups cover most code presentation without MDX. Markdown can also use
Vue features: audit prose containing template-like syntax rather than assuming
all Markdown is interpreted identically to GitHub.
[Routing](https://vitepress.dev/guide/routing) and
[Markdown extensions](https://vitepress.dev/guide/markdown).

Its local MiniSearch option avoids a hosted search service. Grouped and
path-specific sidebars support separate guide/API navigation. The tradeoff is
owning navigation configuration and any Vue theme extensions, plus a deliberate
archive strategy rather than choosing it for built-in release snapshots.
[Search](https://vitepress.dev/reference/default-theme-search) and
[sidebar](https://vitepress.dev/reference/default-theme-sidebar).
The current documentation exposes a prerelease branch alongside stable docs;
select a release channel explicitly and recheck features against that release,
especially deployment behavior. [Deployment guide](https://vitepress.dev/guide/deploy).

### Docusaurus

Configure `.md` as CommonMark where appropriate: Docusaurus can distinguish
CommonMark from MDX instead of forcing existing prose through JSX syntax rules.
Keep tabs or interactive enhancements on explicitly chosen MDX pages. Static code
blocks and tabbed content are documented features; a Hyperion TSX fence should
remain a code example, not become a React component.
[Markdown formats](https://docusaurus.io/docs/markdown-features),
[code blocks](https://docusaurus.io/docs/markdown-features/code-blocks), and
[tabs](https://docusaurus.io/docs/markdown-features/tabs).

The decisive capability is separate docs-plugin instances combined with
version snapshots. Separate core and JSX instances can have distinct sidebars and
version histories. That is useful once readers actually need concurrent release
lines, but creates duplicated snapshots and cross-version linking obligations.
Official search support targets Algolia; local alternatives are explicitly
community-maintained. [Multiple instances](https://docusaurus.io/docs/docs-multi-instance),
[versioning](https://docusaurus.io/docs/versioning), and
[search](https://docusaurus.io/docs/search).

### Rspress and Fumadocs

Rspress uses React and Rsbuild, with conventional navigation, theme overrides,
and Markdown/MDX support. Its version directories and version-scoped search are
particularly relevant to archives. Its TypeDoc plugin is official, whereas
playground and preview plugins are separate opt-ins: omit them for Hyperion code.
Tabs can wrap code blocks using React components. This is a coherent alternative,
but adds a different build stack without removing TypeDoc's compiler constraint.
[Introduction](https://rspress.rs/guide/start/introduction),
[versioning](https://rspress.rs/guide/basic/multi-version),
[tabs](https://rspress.rs/ui/components/tabs), and
[TypeDoc plugin](https://www.rspress.dev/plugin/official-plugins/typedoc).

Fumadocs supports Markdown and MDX through content sources, separates core logic
from UI, and composes into React frameworks. It should not be reduced to
“Next.js required”: its static-build documentation covers several framework
choices. However, the usual server-first setup needs explicit static export and
browser-search-index configuration. Page-tree/layout assembly is useful for a
custom portal, but is extra work for this guide. Its code UI supports presentation
components; any auto type table facility should be evaluated separately from
complete package API generation. [Overview](https://www.fumadocs.dev/docs),
[static export](https://www.fumadocs.dev/docs/deploying/static), and
[code UI](https://www.fumadocs.dev/docs/ui/components/codeblock).

## Links, hosting, and release policy

Keep source links valid on GitHub. A build-only link transform should map guide
Markdown targets to published routes and contributor targets to repository blob
URLs, preserving anchors. Pin archived source links to a release tag or commit;
use the chosen branch for development docs. Do not simply strip `.md` from
`../logging.md`: that target is outside the public guide. Alternatively publish a
small, explicit reference allowlist. This is a proposed migration policy, not a
feature automatically supplied by any candidate.

Static self-hosting is viable: Starlight generates HTML, VitePress documents static
deployment, Docusaurus emits a static build, Rspress is an SSG, and Fumadocs has an
explicit static-export path. GitHub Pages is a possible target, not a selected
host. Test both root and repository subpath URLs, assets, search indexes, refreshes,
and 404 behavior before choosing deployment settings.
[Starlight pages](https://starlight.astro.build/guides/pages/),
[VitePress deployment](https://vitepress.dev/guide/deploy),
[Docusaurus deployment](https://docusaurus.io/docs/deployment),
[Rspress introduction](https://rspress.rs/guide/start/introduction), and
[Fumadocs static build](https://www.fumadocs.dev/docs/deploying/static).

Initially label a single guide with the supported core/JSX version pair and the
Discord prerelease baseline. Avoid one site snapshot per independent patch.
Later archive meaningful supported combinations; do not create a Cartesian product
of package releases. Give generated API pages separate package/version paths.
Docusaurus snapshots and Rspress version directories assist routing, but neither
chooses this compatibility policy. Starlight/VitePress archives could use separate
build prefixes or a tested community integration; Fumadocs could implement them
in application routing. Those are design options, not verified native snapshot
features. [Docusaurus policy caveats](https://docusaurus.io/docs/versioning) and
[Rspress version routing](https://rspress.rs/guide/basic/multi-version).

## TypeDoc is complementary, with a TS7 blocker

TypeDoc generates symbol reference documentation, not the explanation and workflow
content in the guide. Its default HTML output could live under a separate API
prefix, minimizing theme integration. Markdown output requires
`typedoc-plugin-markdown`; that project supplies companion VitePress and
Docusaurus integrations. Starlight has the third-party `starlight-typedoc` plugin;
Rspress supplies an official plugin. None establishes compiler compatibility.
[TypeDoc overview](https://typedoc.org/documents/Overview.html),
[Markdown plugin](https://typedoc-plugin-markdown.org/docs),
[Starlight plugin repository](https://github.com/HiDeoo/starlight-typedoc), and
[Rspress integration](https://www.rspress.dev/plugin/official-plugins/typedoc).

**TS7 support is not verified and must not be assumed.** The inspected upstream
TypeDoc manifest allows TypeScript 5.x through 6.0.x, excluding Hyperion's 7.x.
The upstream TS7 tracking issue remains open and describes a compiler API rewrite
and missing internal APIs. The overview's compatibility table is older than the
manifest; neither provides evidence of TS7 support.
[Current manifest](https://github.com/TypeStrong/typedoc/blob/master/package.json),
[TS7 tracking issue](https://github.com/TypeStrong/typedoc/issues/3098), and
[overview](https://typedoc.org/documents/Overview.html).

Do not downgrade Hyperion to make API docs work. A separately pinned compatible
compiler in an isolated API-docs workspace is only an experiment: verify it can
parse the actual source/declarations and dependency types with NodeNext and `.ts`
imports. Test core's public barrel and all JSX public entry points, including the
two compiler runtime exports. Defer API generation if that experiment fails; the
handwritten guide can ship independently. Other candidate build/type-check tools
also need TS7 checks; highlighting a TSX fence does not test compiler support.

## Implementation outline and prototype acceptance

Create a private docs workspace with its own config and build output, preserving
the root package-manager pin and source-first bot workflow. Prototype Starlight
first, with VitePress as the comparison if its content adapter proves intrusive.
Keep guide Markdown authoritative, metadata minimal, and generated staging files
ignored. Add a dedicated Turbo docs build with explicit content/config inputs;
never import or initialize the dev bot during documentation builds.

Acceptance checks for a later authorized prototype:
- Build from a frozen pnpm install on the repository's supported Node version;
  record peer conflicts and TS7 behavior without silently changing the compiler.
- Render getting started, logging, and JSX; preserve fenced TSX as escaped text,
  copyable imports, generics, angle brackets, and braces. No execution, login,
  playground, or compiler-backed Twoslash processing by default.
- Preserve source links and heading anchors; validate emitted routes and external
  reference mappings. Confirm README landing routing and original-file edit links.
- Confirm only allowlisted content is published and indexed; exercise local search
  for API identifiers, keyboard navigation, mobile sidebar, contrast, and code tabs.
- Inspect static output at root and repository subpath deployments; ensure search
  needs no server endpoint or credentials. Measure build size/time only then.
- If testing TypeDoc, inventory resolved compiler/plugin versions and generated
  public exports; verify package boundaries, generic types, source links, and
  cross-package references. Fail visibly on unsupported compiler warnings.

This research adds only this note. Validation consists of targeted Biome checking,
the existing documentation link/import checker, and whitespace checks. Installation,
rendered appearance, dependency compatibility, static search behavior, and API
extraction remain prototype questions; no performance claims are established.
