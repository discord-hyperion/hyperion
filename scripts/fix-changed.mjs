// Format and fix only files touched on this branch, staged or not, plus new
// files. Repo-wide writes reformat unrelated work; use `pnpm check:fix:all`
// when that is genuinely intended.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" })
        .split("\0")
        .filter(Boolean);

const base = "main";
const files = new Set([
    ...git("diff", "-z", "--name-only", "--diff-filter=d", `${base}...HEAD`),
    ...git("diff", "-z", "--name-only", "--diff-filter=d", "HEAD"),
    ...git("ls-files", "-z", "--others", "--exclude-standard"),
]);
const targets = [...files]
    .filter(file =>
        file
            .split("/")
            .every(
                part =>
                    part === ".env.example" ||
                    (part !== ".env" && !part.startsWith(".env.")),
            ),
    )
    .map(file => path.resolve(root, file))
    .filter(file => existsSync(file));

if (targets.length === 0) {
    console.log(`No files changed relative to ${base}.`);
    process.exit(0);
}

const biome = fileURLToPath(
    new URL("../node_modules/.bin/biome", import.meta.url),
);

execFileSync(
    biome,
    [
        "check",
        "--write",
        "--no-errors-on-unmatched",
        "--files-ignore-unknown=true",
        ...targets,
    ],
    { cwd: root, stdio: "inherit" },
);
