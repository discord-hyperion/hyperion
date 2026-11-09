# Documentation site prototype (Fumadocs)

A throwaway Fumadocs build of `docs/guide`. See
[documentation site generators](../../docs/research/documentation-site-generators.md).
It is private, not wired into CI or Turbo, and not a decision to publish.

```sh
pnpm --filter @hyperion-js/docs-site-fumadocs site:build   # stage the guide, then export to out/
pnpm --filter @hyperion-js/docs-site-fumadocs site:check   # check links, code, search, and routes
pnpm --filter @hyperion-js/docs-site-fumadocs site:serve   # serve out/ like a plain static host
```

The build uses the base path `/hyperion`. Set `SITE_BASE=` (empty) for a
root deployment, and `DIST=out-root` to keep two builds side by side.
`docs/guide` stays the source of truth: `scripts/stage.mjs` copies it into a
gitignored `content/` folder at build time. Two remark plugins in
`source.config.mjs` turn GitHub alerts into callouts (`lib/remark-github-alerts.js`)
and ` ```files ` blocks into file trees. The package is JavaScript only so the
root `tsc` has nothing to type.
