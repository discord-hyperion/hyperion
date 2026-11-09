import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX({ configPath: "source.config.mjs" });
// Keep in step with scripts/stage.mjs. Empty means a root deployment.
const basePath = (process.env.SITE_BASE ?? "/hyperion").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const config = {
    output: "export",
    distDir: process.env.DIST ?? "out",
    trailingSlash: true,
    reactStrictMode: true,
    images: { unoptimized: true },
    ...(basePath ? { basePath } : {}),
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default withMDX(config);
