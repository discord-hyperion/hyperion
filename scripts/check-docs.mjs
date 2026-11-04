// Check documentation: relative links (and their heading anchors) resolve, and
// code examples import real packages and names that `@hyperion/*` exports.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const relative = file => path.relative(root, file);

const markdown = (directory, recursive = true) =>
    readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(
        entry => {
            const full = path.join(root, directory, entry.name);
            if (entry.isDirectory()) {
                return recursive
                    ? markdown(path.join(directory, entry.name))
                    : [];
            }

            return entry.name.endsWith(".md") ? [full] : [];
        },
    );

const files = [
    ...markdown("docs"),
    ...["AGENTS.md", "CODING_STANDARDS.md"].map(file => path.join(root, file)),
    ...["core", "jsx"].map(name =>
        path.join(root, "packages", name, "README.md"),
    ),
].filter(file => existsSync(file));

/** GitHub-style heading anchors. */
const anchors = new Map();
const anchorsOf = file => {
    if (!anchors.has(file)) {
        const seen = new Map();
        const slugs = new Set();

        for (const [, heading] of readFileSync(file, "utf8")
            .replace(/```[\s\S]*?```/g, "")
            .matchAll(/^#{1,6}\s+(.+)$/gm)) {
            const base = heading
                .trim()
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s_-]/gu, "")
                .replace(/\s/g, "-");
            const count = seen.get(base) ?? 0;

            seen.set(base, count + 1);
            slugs.add(count === 0 ? base : `${base}-${count}`);
        }

        anchors.set(file, slugs);
    }

    return anchors.get(file);
};

/** Names a package entry exports, following `export *` and `export { … } from`. */
const exportsOf = (entry, visited = new Set()) => {
    if (visited.has(entry)) return new Set();
    visited.add(entry);

    const source = readFileSync(entry, "utf8");
    const names = new Set();
    const resolve = specifier => path.resolve(path.dirname(entry), specifier);

    for (const [, specifier] of source.matchAll(
        /export\s+\*\s+from\s+"(\.[^"]+)"/g,
    )) {
        for (const name of exportsOf(resolve(specifier), visited)) {
            names.add(name);
        }
    }
    for (const [, list] of source.matchAll(
        /export\s+(?:type\s+)?\{([^}]*)\}/g,
    )) {
        for (const item of list.split(",")) {
            const name = item
                .replace(/^\s*type\s+/, "")
                .split(/\s+as\s+/)
                .at(-1)
                ?.trim();
            if (name) names.add(name);
        }
    }
    for (const [, name] of source.matchAll(
        /export\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|class|type|interface|function|enum)\s+(\w+)/g,
    )) {
        names.add(name);
    }

    return names;
};

const packages = {
    "@hyperion/core": exportsOf(path.join(root, "packages/core/src/index.ts")),
    "@hyperion/jsx": exportsOf(path.join(root, "packages/jsx/lib/index.ts")),
};

/** Bare specifiers must name an installed package (or a Node built-in). */
const installed = specifier => {
    if (specifier.startsWith("node:")) return true;

    const name = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0];

    return [".", "apps/dev-bot", "packages/core", "packages/jsx"].some(base =>
        existsSync(path.join(root, base, "node_modules", name, "package.json")),
    );
};

const problems = [];
const report = (file, message) =>
    problems.push(`${relative(file)}: ${message}`);

for (const file of files) {
    const text = readFileSync(file, "utf8");
    const prose = text.replace(/```[\s\S]*?```/g, "");

    for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z][a-z+.-]*:/i.test(target)) continue;

        const [link, anchor] = target.split("#");
        const destination = link
            ? path.resolve(path.dirname(file), decodeURIComponent(link))
            : file;

        if (!existsSync(destination)) {
            report(file, `broken link ${target}`);
        } else if (
            anchor &&
            destination.endsWith(".md") &&
            !anchorsOf(destination).has(anchor)
        ) {
            report(file, `missing anchor ${target}`);
        }
    }

    for (const [, code] of text.matchAll(
        /```(?:ts|tsx|js|jsx|mjs)\n([\s\S]*?)```/g,
    )) {
        for (const [, list, specifier] of code.matchAll(
            /import\s+(?:type\s+)?(?:\{([^}]*)\}|[\w*\s]+)\s+from\s+"([^"]+)"/g,
        )) {
            if (specifier.startsWith(".")) continue;

            if (!installed(specifier)) {
                report(file, `example imports unknown package "${specifier}"`);
                continue;
            }

            const exported = packages[specifier];
            if (!exported || !list) continue;

            for (const item of list.split(",")) {
                const name = item
                    .replace(/^\s*type\s+/, "")
                    .split(/\s+as\s+/)[0]
                    ?.trim();
                if (name && !exported.has(name)) {
                    report(
                        file,
                        `example imports "${name}", which ${specifier} does not export`,
                    );
                }
            }
        }
    }
}

// The backlog lists only open work: planned items stay unticked, and shipped
// items move to Implemented as one line that links their reference doc.
const backlog = path.join(root, "docs/features.md");
if (existsSync(backlog)) {
    let section = "";

    for (const line of readFileSync(backlog, "utf8").split("\n")) {
        const heading = line.match(/^## (.+)$/);
        if (heading) {
            section = heading[1].trim();
            continue;
        }
        if (!line.startsWith("- ")) continue;

        if (section === "Planned" && !line.startsWith("- [ ] ")) {
            report(backlog, `planned item is not an open "- [ ]": ${line}`);
        }
        if (section === "Implemented" && /^- \[/.test(line)) {
            report(backlog, `implemented item has a checkbox: ${line}`);
        }
    }

    // Implemented items may wrap, so check each whole item for a doc link.
    const implemented =
        readFileSync(backlog, "utf8").split(/^## Implemented$/m)[1] ?? "";
    for (const item of implemented.split(/^- /m).slice(1)) {
        if (!/\]\([^)\s]+\.md(#[^)]*)?\)/.test(item)) {
            report(
                backlog,
                `implemented item links no reference doc: ${item.split("\n")[0]}`,
            );
        }
    }
}

if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} documentation problem(s).`);
    process.exit(1);
}

console.log(`Checked ${files.length} documentation files.`);
