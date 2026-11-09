export const repo = "https://github.com/discord-hyperion/hyperion";

// The site is public but the repository is private, so nothing links into it:
// no GitHub header link, no edit links, and guide links to reference docs become
// plain text. Set to true when the repository is public.
export const repoIsPublic = false;

// Guide files staged somewhere other than their own path. Everything else keeps
// its path under docs/guide.
const moved = {
    "README.md": "index.md",
    "jsx.md": "jsx/index.md",
    "jsx-with-hyperion.md": "jsx/with-hyperion.md",
};

/** Where a guide file is staged, relative to the content folder. */
export const staged = original => moved[original] ?? original;

/** Where a page's original Markdown lives, so edit links skip the staged copy. */
export const editUrl = path => {
    const original =
        Object.keys(moved).find(file => moved[file] === path) ?? path;

    return `${repo}/edit/main/docs/guide/${original}`;
};
