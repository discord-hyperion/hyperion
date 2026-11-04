import { defineConfig } from "fumadocs-mdx/config";

export default defineConfig({
    mdxOptions: {
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
