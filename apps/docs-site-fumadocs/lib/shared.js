export const repo = "https://github.com/favylicious/discord-hyperion";

/** Where a page's original Markdown lives, so edit links skip the staged copy. */
export const editUrl = path => {
    const original = path === "index.md" ? "README.md" : path;

    return `${repo}/edit/main/docs/guide/${original.replace(/^jsx\/index\.md$/, "jsx.md")}`;
};
