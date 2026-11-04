// Stage the human guide (docs/guide) for Fumadocs. The Markdown under docs/guide
// stays authoritative: this copies it to content/docs (gitignored) and
//   - adds the `title` frontmatter Fumadocs requires, taken from the first H1,
//   - maps README.md to index.md and jsx.md to jsx/index.md (a folder index),
//   - rewrites links to files outside the guide into GitHub URLs (or plain text
//     while the repository is private), and re-points in-guide .md links at the
//     staged files so Fumadocs can resolve them,
//   - writes meta.json files that give the sidebar its groups and order.
// Only docs/guide is published; nothing else under docs/ is staged.
import {
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repo, repoIsPublic } from "../lib/shared.js";

const site = fileURLToPath(new URL("..", import.meta.url));
const source = path.resolve(site, "../../docs/guide");
const target = path.join(site, "content/docs");

const files = directory =>
    readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) return files(full);

        return entry.name.endsWith(".md") ? [full] : [];
    });

const staged = relative => {
    if (relative === "README.md") return "index.md";
    if (relative === "jsx.md") return "jsx/index.md";

    return relative;
};

/** The staged link target, or null to drop the link and keep its text. */
const rewrite = (url, relative) => {
    if (/^([a-z][a-z+.-]*:|#|\/)/i.test(url)) return url;

    const [file, hash = ""] = url.split("#");
    const suffix = hash ? `#${hash}` : "";
    const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), file),
    );

    if (resolved.startsWith("..")) {
        return repoIsPublic
            ? `${repo}/blob/main/${path.posix.join("docs/guide", resolved)}${suffix}`
            : null;
    }

    if (!resolved.endsWith(".md")) return url;

    const relativeLink = path.posix.relative(
        path.posix.dirname(staged(relative)),
        staged(resolved),
    );

    return `${relativeLink.startsWith(".") ? relativeLink : `./${relativeLink}`}${suffix}`;
};

const outsideFences = (text, change) =>
    text
        .split(/(```[\s\S]*?```)/g)
        .map((part, index) => (index % 2 === 1 ? part : change(part)))
        .join("");

rmSync(target, { recursive: true, force: true });

for (const file of files(source)) {
    const relative = path.relative(source, file).split(path.sep).join("/");
    const text = readFileSync(file, "utf8");
    const heading = text.match(/^# (.+)$/m);

    if (!heading) {
        throw new Error(`${relative} has no H1 to use as its title.`);
    }

    const title = heading[1].replaceAll("`", "");
    const body = outsideFences(text.replace(/^# .+\n+/m, ""), part =>
        part.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_, label, url) => {
            const target = rewrite(url, relative);

            return target === null ? label : `[${label}](${target})`;
        }),
    );
    const output = path.join(target, staged(relative));

    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(
        output,
        `---\ntitle: ${JSON.stringify(title)}\n---\n\n${body}`,
    );
}

// The sidebar: separators make the same groups as the guide index.
const meta = (directory, value) =>
    writeFileSync(
        path.join(target, directory, "meta.json"),
        `${JSON.stringify(value, null, 4)}\n`,
    );

meta("", {
    title: "Hyperion",
    pages: [
        "index",
        "---Basics---",
        "getting-started",
        "commands",
        "responding",
        "---Interactions---",
        "buttons",
        "select-menus",
        "modals",
        "custom-ids",
        "autocomplete",
        "---Making it safe---",
        "guards",
        "input",
        "---Everything else---",
        "events",
        "logging",
        "---JSX---",
        "jsx",
        "jsx-with-hyperion",
    ],
});
meta("jsx", {
    title: "JSX",
    pages: [
        "index",
        "embeds",
        "message-components",
        "layout-messages",
        "modals",
    ],
});

console.log(`Staged ${files(source).length} guide pages.`);
