// The guide, deployed as an assets-only Cloudflare Worker by `cf deploy out`.
// Plain object rather than `defineConfig` from `cf/config`, so the site needs no
// `cf` dependency; CI runs a pinned `cf` through `pnpm dlx`.
export default {
    worker: {
        name: "hyperion-docs",
        compatibilityDate: "2026-11-15",
        assets: {
            // Next exports `page/index.html` and a root `404.html`.
            htmlHandling: "auto-trailing-slash",
            notFoundHandling: "404-page",
        },
        domains: ["hyperion.favteo.com"],
        workersDev: false,
    },
};
