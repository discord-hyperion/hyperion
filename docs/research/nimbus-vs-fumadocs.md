# Nimbus as a replacement for Fumadocs

Researched **2026-11-06** against repository files, the Nimbus source at commit
[`980cee6`](https://github.com/cloudflare/nimbus/tree/980cee6da75f81982552b68a3607c0a19ee11987),
its documentation site, and the npm registry. Nothing was installed in this
repository and no Nimbus site was built. One claim, that the search engine indexes
code blocks, was tested on its own (see [Search](#search)). This note follows
[the earlier comparison](documentation-site-generators.md), which chose Fumadocs.

## Recommendation

**Don't replace Fumadocs now. Look again once Nimbus reaches 1.0.** The current
site works: it is deployed and its 14 output checks pass
([CI](../ci.md)). Nimbus would not fix anything that is currently broken. Its real
gains are code-aware search with no configuration, admonitions, a content
linter, and Markdown output for agents. Against them:
- It is about four months old and pre-1.0, and its README says "the public API
  can change between minor releases".
- Nearly all of its commits come from one person.
- Moving would mean rewriting the site app, the link rewriting, and the search
  part of `check-site.mjs`.
- It ships TypeScript source files that the root `tsc` would type-check.

Nimbus does not change the earlier conclusion. It is a new contender, not a better
fit than the generator already deployed.

Check again if any of these happens: Nimbus ships 1.0, its contributors broaden,
agent-facing output (`llms.txt`, per-page Markdown) becomes a goal for Hyperion,
or Fumadocs becomes a maintenance burden.

## What Nimbus is

Several unrelated projects are called Nimbus: a 2013 cloud-deployment package
([`nimbus` on npm](https://www.npmjs.com/package/nimbus)), Tiendanube's design
system ([`@nimbus-ds/*`](https://www.npmjs.com/package/@nimbus-ds/styles)), an
icon set, and Status's VuePress site for its Nim libraries
([status-im/nimbus-libs-site](https://github.com/status-im/nimbus-libs-site)).
The only one that is a documentation framework is **Cloudflare's Nimbus**:
- Site: [nimbus-docs.com](https://nimbus-docs.com).
- Repository: [cloudflare/nimbus](https://github.com/cloudflare/nimbus), described as
  "Docs for humans and agents, built on Astro".
- Packages: [`@cloudflare/nimbus-docs`](https://www.npmjs.com/package/@cloudflare/nimbus-docs)
  (the Astro integration and `nimbus-docs` CLI) and
  [`@cloudflare/create-nimbus-docs`](https://www.npmjs.com/package/@cloudflare/create-nimbus-docs)
  (the scaffolder). The earlier unscoped `nimbus-docs` package is deprecated with
  "Moved to @cloudflare/nimbus-docs" (`npm view nimbus-docs deprecated`).

Its model differs from Fumadocs': the scaffolder copies layouts, components,
routes, and styles into your repository as source you own, and the package
supplies only the integration and helpers. There is "no upstream theme to
override" ([project structure](https://nimbus-docs.com/project-structure);
[README](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/README.md)).

## Maturity

| Measure           | Nimbus                                                                                                                                                                                                                                           | Fumadocs, for scale                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| First release     | `nimbus-docs@0.0.1`, 2026-05-30; scoped `@cloudflare/nimbus-docs` since 2026-07-16                                                                                                                                                               | `fumadocs-core` created 2024-01-26     |
| Latest release    | `@cloudflare/nimbus-docs@0.19.4`, 2026-11-06                                                                                                                                                                                                     | `fumadocs-core@16.18.1`                |
| Cadence           | 34 unscoped and 29 scoped versions in about five months, roughly weekly in the scoped line ([releases](https://github.com/cloudflare/nimbus/releases))                                                                                           | —                                      |
| Stability promise | Pre-1.0, minor releases may break the API ([README "Status"](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/README.md#status))                                                                               | Past 1.0 (16.x)                        |
| Backing           | Cloudflare organization repository; npm publishers are Cloudflare CI accounts; `author` is Mohamed Hassan ([package.json](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-docs/package.json)) | Not checked here                       |
| Contributors      | MohamedH1998 1,247 commits; next human contributors 33 and 18 (GitHub contributors API)                                                                                                                                                          | Not measured here                      |
| License           | MIT                                                                                                                                                                                                                                              | MIT                                    |
| Popularity        | 1,749 stars, 61 forks; 171,411 downloads in the month to 2026-11-05 ([npm downloads API](https://api.npmjs.org/downloads/point/last-month/@cloudflare/nimbus-docs))                                                                              | 10,019,957 downloads in the same month |
| Issue health      | 0 open and 39 closed issues; 9 open pull requests, mostly dependency bumps ([issues](https://github.com/cloudflare/nimbus/issues))                                                                                                               | Not measured here                      |

The repository became public on 2026-07-09. Its activity is high and issues get
closed, but the project is young and depends on one main author. That is the
deciding maturity risk, more than any missing feature.

## Fit for Hyperion

### Plain Markdown input and staging

Content can be `.md` or `.mdx`
([Markdown and MDX](https://nimbus-docs.com/writing/markdown-and-mdx)). Only
`title` is required in frontmatter
([frontmatter](https://nimbus-docs.com/reference/frontmatter)), the same as what
`stage.mjs` adds today. `docsCollection()` reads from `./src/content/<base>`
([`content.ts`](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-docs/src/content.ts#L342-L345)).
A folder outside `src/`, such as `docs/guide`, needs an Astro `glob` loader
wrapped in `withNimbusMarkdown()`
([collections](https://nimbus-docs.com/writing/collections)).

Staging carries over with changes:
- **Links.** Nimbus leaves relative links unchanged and expects root paths such
  as `/guides/install` ([links under a base](https://nimbus-docs.com/writing/markdown-and-mdx#links-under-a-deployment-base)).
  So `./buttons.md` would ship as written and break. Fumadocs resolves those
  links itself through `createRelativeLink`
  ([earlier prototype](documentation-site-generators.md#prototype-results-fumadocs)).
  `stage.mjs` would have to rewrite every in-guide link to a route, not only
  folder indexes.
- **Index pages.** A folder's `index` page is its group landing
  ([sidebar](https://nimbus-docs.com/navigation/sidebar#choose-how-group-landing-pages-appear)).
  The current `README.md` → `index.md` and `jsx.md` → `jsx/index.md` mapping
  stays.
- **Callouts and components.** Admonitions (`:::tip`) work only in `.mdx`, and
  "`.md` files … are unchanged"
  ([admonitions](https://nimbus-docs.com/writing/markdown-and-mdx#admonitions)).
  The guide has no callouts today (no `[!NOTE]`-style blocks under `docs/guide`),
  so this costs nothing now.
- Nimbus parses Markdown with Sätteri, not unified. Remark and rehype plugins
  "silently do nothing" unless `markdown.processor` is swapped
  ([extending Markdown](https://nimbus-docs.com/writing/markdown-and-mdx#extending-markdown)).

### Static export for Cloudflare Pages

"Sites are static by default … host the output anywhere". Only on-request
rendering and the remote MCP server need an adapter
([README "Deploy"](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/README.md#deploy);
[rendering](https://nimbus-docs.com/reference/rendering)). The scaffolder targets
Cloudflare **Workers** Static Assets with a `wrangler.jsonc`, not Pages
([deploy to Cloudflare](https://nimbus-docs.com/deploy/cloudflare)). Uploading
`dist/` with `wrangler pages deploy` should work because the output is plain
files. **Unverified**: no build was deployed. "Last updated" dates read git
history, so CI needs `fetch-depth: 0` (same page). Base paths use Astro's `base`
([under a path](https://nimbus-docs.com/deploy/base-path)). Trailing-slash
mismatches can 404 on some hosts
([troubleshooting](https://nimbus-docs.com/publish/troubleshooting)). That
matches the Fumadocs finding, and Cloudflare's behaviour is untested.

### Sidebar ordering, groups, and folder index pages

By default the sidebar follows the file tree, sorted alphabetically, with
`sidebar.order` in frontmatter. `sidebar.items` in `astro.config.ts` gives a
hand-ordered tree with labelled groups, and array order is kept. Folder `index`
pages land their group, shown either as a header link or as an "Overview" leaf
([sidebar](https://nimbus-docs.com/navigation/sidebar)). The current groups
(Basics, Interactions, …) map to `{ label, items }` groups, which replace the
generated `meta.json` files.

### Search

Search is on by default and uses [Pagefind](https://pagefind.app/), which indexes
the built `dist/` after `astro build` and needs no backend
([search](https://nimbus-docs.com/navigation/search)). Nimbus marks only code
block _titles_ `data-pagefind-ignore`
([`code-transformers.ts`](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-docs/src/_internal/code-transformers.ts#L369)).
The code itself is indexed.

**Tested here:** Pagefind 1.5.2 (the starter's pinned range,
[starter package.json](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-starter-source/package.json))
indexed a page whose only mention of `ButtonHandler` was inside a Shiki-style
`<pre><code>`. Its word index held `buttonhandl` (stemmed), `button`, and
`handler`. Fumadocs needed `remarkStructureOptions.types` to do the same
([`source.config.mjs`](../../apps/docs-site-fumadocs/source.config.mjs)). Search
under a base path, and the dialog in a browser, are **unverified**.

### Code presentation

- **Highlighting.** Shiki runs at build time with dual light/dark themes, plus
  titles, line highlights, and diff/focus notations
  ([code blocks](https://nimbus-docs.com/writing/code-blocks)). TSX quality was not
  compared in a build.
- **Components.** The starter has `tabs`, `code-group` (multi-language tabs),
  `aside` (callouts), `file-tree`, `steps`, and `package-managers`
  ([starter components](https://github.com/cloudflare/nimbus/tree/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-starter-source/src/components/ui)).
  Some install on demand with `nimbus-docs add`
  ([README features](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/README.md#features)).
  All of them need MDX.
- **Twoslash.** No integration was found in the docs. **Unverified.**

### Dark mode, mobile, i18n

- **Dark mode.** A `ThemeToggle` component saves the choice to localStorage
  ([theme toggle](https://nimbus-docs.com/components/theme-toggle)).
- **Mobile.** The sidebar becomes a drawer on small screens
  ([sidebar](https://nimbus-docs.com/navigation/sidebar#restyle-sidebar-rows)).
- **i18n.** The configuration has only a document `locale` string
  ([configuration](https://nimbus-docs.com/reference/configuration)). No
  translation or locale-routing feature was found. Treat i18n as **not
  supported** (unverified absence).

### Stack and toolchain

- **Runtime.** Astro 7 (peer `>=7.2.6 <8`), Vite 8, and Tailwind 4. React 19 is an
  optional peer.
- **Node.** Requires `>=22.12.0`, which Node 24.17 satisfies. Astro 7.4 needs
  `>=22.23.4` (`npm view @cloudflare/nimbus-docs`, `npm view astro@7 engines`).
- **pnpm.** pnpm is supported: the scaffolder writes a `pnpm-workspace.yaml` for
  build-script settings
  ([project structure](https://nimbus-docs.com/project-structure)). Running it
  under this repository's pnpm 12 is **untested**.
- **TypeScript 7 conflicts:**
  - The package depends on `typescript@^5.8.3` and imports it at runtime
    ([`authored-links.ts`](https://github.com/cloudflare/nimbus/blob/980cee6da75f81982552b68a3607c0a19ee11987/packages/nimbus-docs/src/_internal/authored-links.ts#L3)).
    pnpm would install a second compiler beside the root's `^7.0.2`. That
    compiler is isolated from Hyperion, but it is another one in the lockfile.
  - The starter is TypeScript (`astro.config.ts`, `src/components.ts`,
    `content.config.ts`) and type-checks with `astro check` on TS 5. The root
    [`tsconfig.json`](../../tsconfig.json) includes `apps/**/*.ts(x)`, so the
    root `tsc` (TS 7, `@hyperion/jsx` as JSX source) would pick those files up.
    The Fumadocs prototype avoided this by using only JavaScript. A Nimbus site
    would need an exclusion in the root tsconfig, or a JavaScript conversion of
    the starter, which would fight the copy-in upgrade flow.

### Extensibility and API reference

- **Components.** Custom components are registered in `src/components.ts` and
  can be used in MDX without imports. Unknown tags fail the build
  ([Markdown and MDX](https://nimbus-docs.com/writing/markdown-and-mdx)). Every
  layout and component is owned source
  ([customization](https://nimbus-docs.com/styling/how-customization-works)).
- **Plugins.** Markdown plugins go in `markdown.mdastPlugins` and `hastPlugins`.
- **Tooling.** `nimbus-docs lint` and `nimbus-docs check` validate content and
  structure ([CLI](https://nimbus-docs.com/cli)).
- **API reference.** It is generated from **OpenAPI 3.x** only
  ([API reference](https://nimbus-docs.com/api-reference)). That does not help
  a TypeScript library. No TypeDoc integration was found, so the TypeDoc/TS 7
  blocker in the [earlier note](documentation-site-generators.md#typedoc-is-complementary-with-a-ts7-blocker)
  stands either way.
- **Agent output.** Nimbus publishes per-page
  Markdown, `llms.txt`, and `llms-full.txt`
  ([docs for agents](https://nimbus-docs.com/ai/docs-for-agents)).

## Migration cost

Concretely, against the current setup:
- **`apps/docs-site-fumadocs/`** would be replaced by a scaffolded Astro project
  (for example `apps/docs-site-nimbus/`). That means `app/`, `components/mdx.jsx`,
  `lib/source.js`, `source.config.mjs`, `next.config.mjs`, and
  `postcss.config.mjs` go away. In their place come `astro.config.ts`,
  `src/content.config.ts`, `src/components.ts`, copied layouts and components,
  `nimbus.json`, and a `wrangler.jsonc`, as listed under
  [project structure](https://nimbus-docs.com/project-structure). The site's
  file count would likely grow, because the theme lives in the repository.
- **`scripts/stage.mjs`** keeps front matter, index mapping, and outside-guide
  rewriting. It gains a pass that turns in-guide `.md` links into root routes
  (honouring `base` via Nimbus's rule), and it drops the `meta.json` writer in
  favour of `sidebar.items`. Alternatively, it is replaced by a `glob` loader
  pointed at `docs/guide` plus a Sätteri link plugin. That route is untested.
- **`scripts/check-site.mjs`** has a search block that is Fumadocs-specific: it
  looks for `api/search`, scans `_next` chunks, and imports
  `fumadocs-core/dist/search/client/orama-static.js`
  ([lines 245–294](../../apps/docs-site-fumadocs/scripts/check-site.mjs)). That
  block would be rewritten against `dist/pagefind/`, and its page filter
  (`_next|api|…`, line 51) changes. The link, anchor, allowlist, and
  code-fidelity checks mostly carry over once paths change from `out/` to
  `dist/`.
- **`.github/workflows/pages.yml`:**
  - The filter (`--filter @hyperion/docs-site-fumadocs`), the working directory,
    and `pages deploy out` become the new package and `dist`.
  - `NEXT_TELEMETRY_DISABLED` goes away. Astro's equivalent telemetry setting
    should be checked (unverified).
  - The checkout needs `fetch-depth: 0` for "Last updated" dates.
  - `SITE_BASE` becomes Astro `base`.
  - The publish step and token handling stay the same.
- **Elsewhere:**
  - `.gitignore` entries for `.next/`, `.source/`, `out/`, and `content/` change
    to Astro's `dist/`, `.astro/`, and `.nimbus/`.
  - The `apps/docs-site-fumadocs/` paths in
    [`scripts/ci-changes.mjs`](../../scripts/ci-changes.mjs), its test, `ci.yml`,
    and [CI](../ci.md) change too.
  - The root [`tsconfig.json`](../../tsconfig.json) needs an exclusion for the
    site.
  - `pnpm-lock.yaml` gains Astro, Vite, Pagefind, and a TypeScript 5 copy.

## Not verified

No Nimbus build was run in this repository. Not established:
- installing under pnpm 12 and Node 24.17;
- rendering the guide's TSX;
- search under a base path;
- deploying with `wrangler pages deploy`, and Cloudflare Pages' trailing-slash
  handling;
- build size and time;
- whether i18n or Twoslash exist beyond what the documentation shows.

Most Nimbus documentation pages carry `aiGenerated: true` frontmatter in the
[site source](https://github.com/cloudflare/nimbus/tree/980cee6da75f81982552b68a3607c0a19ee11987/apps/www/src/content/docs).
Where it mattered, claims above were checked against package source as well.
