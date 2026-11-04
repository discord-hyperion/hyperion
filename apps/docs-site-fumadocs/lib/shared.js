export const repo = "https://github.com/favylicious/discord-hyperion";

// The site is public but the repository is private, so nothing links into it:
// no GitHub header link, no edit links, and guide links to reference docs become
// plain text. Set to true when the repository is public.
export const repoIsPublic = false;

/** Where a page's original Markdown lives, so edit links skip the staged copy. */
export const editUrl = path => {
    const original = path === "index.md" ? "README.md" : path;

    return `${repo}/edit/main/docs/guide/${original.replace(/^jsx\/index\.md$/, "jsx.md")}`;
};
