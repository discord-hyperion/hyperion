import { remarkMdxFiles } from "fumadocs-core/mdx-plugins";
import { defineConfig } from "fumadocs-mdx/config";
import { remarkGithubAlerts } from "./lib/remark-github-alerts.js";

export default defineConfig({
    mdxOptions: {
        // GitHub alerts (`> [!WARNING]`) become callouts, and ```files blocks
        // become file trees; both still read as Markdown on GitHub.
        remarkPlugins: [remarkGithubAlerts, remarkMdxFiles],
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
