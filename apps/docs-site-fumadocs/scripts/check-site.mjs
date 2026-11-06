// Check the built site against the prototype acceptance list. Run after a build:
//   DIST=out SITE_BASE=/discord-hyperion node scripts/check-site.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repo, repoIsPublic, staged } from "../lib/shared.js";
import { serve } from "./serve.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(site, "../..");
const guide = path.join(repoRoot, "docs/guide");
const dist = path.join(site, process.env.DIST ?? "out");
const base = (process.env.SITE_BASE ?? "/discord-hyperion").replace(/\/$/, "");

const results = [];
const check = (name, ok, detail = "") => {
    results.push(ok);
    console.log(
        `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
    );
};

const walk = (directory, extension) =>
    readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) return walk(full, extension);

        return entry.name.endsWith(extension) ? [full] : [];
    });

const decode = text =>
    text
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16)),
        )
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&");

// 1. Only the guide is published, and every guide page has a route.
const expected = walk(guide, ".md").map(file => {
    const relative = path.relative(guide, file).split(path.sep).join("/");

    return staged(relative).replace(/(^|\/)index\.md$|\.md$/, "");
});
const isPage = file => !/^(_next|api|_not-found|404)(\/|\.|$)/.test(file);
const built = walk(dist, ".html")
    .map(file => path.relative(dist, file).split(path.sep).join("/"))
    .filter(isPage)
    .map(file => file.replace(/(^|\/)index\.html$/, ""));
const missing = expected.filter(route => !built.includes(route));
const extra = built.filter(route => !expected.includes(route));

check(
    `all ${expected.length} guide pages built`,
    missing.length === 0,
    missing.join(", "),
);
check(
    "nothing outside the guide is published",
    extra.length === 0,
    extra.join(", "),
);
check("404 page exists", existsSync(path.join(dist, "404.html")));
check(
    "landing page is the guide README",
    /<h1[^>]*>\s*Hyperion guide\s*<\/h1>/.test(
        readFileSync(path.join(dist, "index.html"), "utf8"),
    ),
);

// 2. Internal links and anchors resolve under the chosen base; external ones are sane.
const pages = walk(dist, ".html").filter(file =>
    isPage(path.relative(dist, file).split(path.sep).join("/")),
);
const ids = new Map();
const idsOf = file => {
    if (!ids.has(file)) {
        ids.set(
            file,
            new Set(
                [...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map(
                    match => match[1],
                ),
            ),
        );
    }

    return ids.get(file);
};
const problems = [];
let internal = 0;
let github = 0;

for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const where = path.relative(dist, page);

    for (const [, raw] of html.matchAll(/\shref="([^"]*)"/g)) {
        const href = decode(raw);

        if (href === repo || href.startsWith(`${repo}/`)) {
            github++;
            const file = href
                .slice(repo.length + 1)
                .replace(/^(blob|edit)\/main\//, "")
                .split("#")[0];

            if (file && !existsSync(path.join(repoRoot, file))) {
                problems.push(`${where}: GitHub link to missing file ${file}`);
            }

            continue;
        }

        if (
            /^[a-z][a-z+.-]*:/i.test(href) ||
            href === "" ||
            href.startsWith("data:")
        )
            continue;

        if (href.startsWith("#")) {
            if (!idsOf(page).has(href.slice(1))) {
                problems.push(`${where}: missing anchor ${href}`);
            }

            continue;
        }

        if (base && !href.startsWith(`${base}/`) && href !== base) {
            problems.push(`${where}: link outside base ${base}: ${href}`);

            continue;
        }

        internal++;
        const [route, hash] = href.slice(base.length).split("#");
        const file = route.endsWith("/")
            ? path.join(dist, route, "index.html")
            : path.join(dist, route);

        if (!existsSync(file)) {
            problems.push(`${where}: broken link ${href}`);
        } else if (hash && file.endsWith(".html") && !idsOf(file).has(hash)) {
            problems.push(`${where}: missing anchor ${href}`);
        }
    }
}

check(
    `internal links and anchors resolve under "${base || "/"}"`,
    problems.length === 0,
    problems.length
        ? `${problems.length} problems`
        : `${internal} internal, ${github} GitHub links checked`,
);

for (const problem of [
    ...new Set(problems.map(item => item.replace(/^[^:]+: /, ""))),
].slice(0, 12)) {
    console.log(`      ${problem}`);
}

// Empty source lines render as an empty line element, so compare without trailing whitespace.
const normalize = lines =>
    lines
        .map(line => line.trimEnd())
        .join("\n")
        .trim();

// 3. Fenced code survives: every ts/tsx/json fence in the guide appears as rendered code text.
const rendered = new Set();

for (const page of pages) {
    for (const [block] of readFileSync(page, "utf8").matchAll(
        /<pre[\s\S]*?<\/pre>/g,
    )) {
        const lines = block.split('<span class="line">').slice(1);

        rendered.add(
            normalize(lines.map(line => decode(line.replace(/<[^>]+>/g, "")))),
        );
    }
}

let fences = 0;
const lost = [];

for (const file of walk(guide, ".md")) {
    for (const match of readFileSync(file, "utf8").matchAll(
        /^( *)```(tsx|ts|json)\n([\s\S]*?)\n *```/gm,
    )) {
        // A fence inside a list item carries the item's indentation, which Markdown removes.
        const indent = match[1];
        const lines = match[3]
            .split("\n")
            .map(line =>
                line.startsWith(indent) ? line.slice(indent.length) : line,
            );

        fences++;

        if (!rendered.has(normalize(lines))) {
            lost.push(`${path.relative(guide, file)}: ${lines[0]}`);
        }
    }
}

check(
    "every ts/tsx/json code fence renders as identical text",
    lost.length === 0 && fences > 0,
    lost.length
        ? `${lost.length} of ${fences} differ: ${lost.join(" | ")}`
        : `${fences} fences`,
);

// 4. Edit links point at the original Markdown, not the staged copy. While the
//    repository is private, no page links into it at all.
const editLink = (route, original) =>
    readFileSync(path.join(dist, route, "index.html"), "utf8").includes(
        `${repo}/edit/main/docs/guide/${original}`,
    );

if (repoIsPublic) {
    check(
        "edit links point at the original Markdown",
        editLink("jsx/embeds", "jsx/embeds.md") &&
            editLink("jsx", "jsx.md") &&
            editLink("jsx/with-hyperion", "jsx-with-hyperion.md") &&
            editLink("", "README.md"),
    );
} else {
    check(
        "no page links into the private repository",
        github === 0,
        `${github} GitHub links`,
    );
}

// 5. Local search: the exported index covers the guide and can be queried like the browser does,
//    from the base path the site is deployed under, with no server endpoint.
check("search index exported", existsSync(path.join(dist, "api/search")));

const chunks = walk(path.join(dist, "_next"), ".js")
    .map(file => readFileSync(file, "utf8"))
    .join("\n");

check(
    `client fetches the index from "${base}/api/search"`,
    chunks.includes(`${base}/api/search"`) ||
        (!base && chunks.includes('"/api/search"')),
);

const server = await serve(0);

try {
    const origin = `http://127.0.0.1:${server.address().port}`;

    const { staticClient } = await import(
        fileURLToPath(
            new URL(
                "../node_modules/fumadocs-core/dist/search/client/orama-static.js",
                import.meta.url,
            ),
        )
    );

    const client = staticClient({ from: `${origin}${base}/api/search` });

    for (const [term, page] of [
        ["defineGuard", "/guards"],
        ["ButtonHandler", "/buttons"],
        ["renderMessage", "/jsx/layout-messages"],
        ["fileTypes", "/jsx/modals"],
        ["paramOwner", "/custom-ids"],
    ]) {
        const found = await client.search(term);
        const urls = [
            ...new Set(found.map(result => result.url.split("#")[0])),
        ];

        check(
            `search "${term}" finds ${page}`,
            urls.includes(page),
            urls.slice(0, 3).join(", ") || "no results",
        );
    }
} catch (error) {
    check("search can be queried in Node", false, String(error).slice(0, 300));
} finally {
    server.close();
}

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
