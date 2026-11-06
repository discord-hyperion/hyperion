// Type-check documentation examples: every `ts`/`tsx` block in the docs and
// package READMEs compiles as its own module against the workspace packages.
// Tag a deliberately partial block ```ts fragment``` to skip it.
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const relative = file => path.relative(root, file);

const markdown = directory =>
    readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(
        entry => {
            const full = path.join(directory, entry.name);

            if (entry.isDirectory()) return markdown(full);

            return entry.name.endsWith(".md") ? [path.join(root, full)] : [];
        },
    );

// ADRs and research notes record history, not runnable examples.
const files = [
    ...markdown("docs").filter(
        file => !/[/\\]docs[/\\](adr|research)[/\\]/.test(file),
    ),
    ...["core", "jsx", "sqlite"].map(name =>
        path.join(root, "packages", name, "README.md"),
    ),
].filter(file => existsSync(file));

// The dev bot depends on every package an example may import.
const directory = mkdtempSync(path.join(root, "apps/dev-bot/.examples-"));
const sources = new Map();

try {
    for (const file of files) {
        const text = readFileSync(file, "utf8");

        // A block may be indented inside a list item; its lines share the indent.
        for (const match of text.matchAll(
            /^([ \t]*)```(tsx|ts)([^\n]*)\n([\s\S]*?)^\1```/gm,
        )) {
            const [, indent, language, info, body] = match;
            const code = body.replace(new RegExp(`^${indent}`, "gm"), "");

            if (/\bfragment\b/.test(info)) continue;

            const name = `example-${sources.size}.${language}`;
            const line = text.slice(0, match.index).split("\n").length + 1;

            writeFileSync(path.join(directory, name), `${code}\nexport {};\n`);
            sources.set(name, { file, line });
        }
    }

    writeFileSync(
        path.join(directory, "tsconfig.json"),
        JSON.stringify({
            extends: "../tsconfig.json",
            include: ["*.ts", "*.tsx"],
        }),
    );

    let output = "";

    try {
        execFileSync(
            path.join(root, "node_modules/.bin/tsc"),
            ["--noEmit", "--pretty", "false", "-p", directory],
            { encoding: "utf8" },
        );
    } catch (error) {
        output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }

    const problems = [];

    for (const raw of output.split("\n")) {
        const found = raw.match(/(example-\d+\.tsx?)\((\d+),\d+\): (.*)$/);

        if (!found) {
            if (raw.trim()) {
                problems.push(raw.trim());
            }

            continue;
        }

        const [, name, offset, message] = found;
        const source = sources.get(name);
        problems.push(
            `${relative(source.file)}:${source.line + Number(offset) - 1}: ${message}`,
        );
    }

    if (problems.length > 0) {
        console.error(problems.join("\n"));
        console.error(
            `\n${problems.length} example problem(s). Fix the example, or tag a deliberately partial block \`\`\`ts fragment.`,
        );
        process.exitCode = 1;
    } else {
        console.log(`Type-checked ${sources.size} documentation examples.`);
    }
} finally {
    rmSync(directory, { recursive: true, force: true });
}
