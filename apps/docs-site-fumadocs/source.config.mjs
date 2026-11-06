import { remarkMdxFiles } from "fumadocs-core/mdx-plugins";
import { defineConfig } from "fumadocs-mdx/config";
import { remarkGithubAlerts } from "./lib/remark-github-alerts.js";

// The guide's ```npm blocks are only `npm install` lines.
const install = replacement => command =>
    command.replace(/^npm install\b/gm, replacement);

export default defineConfig({
    mdxOptions: {
        // GitHub alerts (`> [!WARNING]`) become callouts, and ```files blocks
        // become file trees; both still read as Markdown on GitHub.
        remarkPlugins: [remarkGithubAlerts, remarkMdxFiles],
        // ```npm blocks become tabs with the same install for each package
        // manager, and the reader's pick is remembered across pages.
        remarkNpmOptions: {
            persist: { id: "package-manager" },
            packageManagers: [
                { name: "npm", command: command => command },
                { name: "pnpm", command: install("pnpm add") },
                { name: "bun", command: install("bun add") },
            ],
        },
        // Index code blocks too, so identifiers that only appear in examples
        // (ButtonHandler, ctx.interaction) are searchable.
        remarkStructureOptions: {
            types: [
                "heading",
                "paragraph",
                "blockquote",
                "table",
                "code",
                "mdxJsxFlowElement",
            ],
        },
    },
});
