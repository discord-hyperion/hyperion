// Decide whether a change needs the code checks (typecheck, tests, and the
// package, cache, and release verification) or only the documentation checks.
//   node scripts/ci-changes.mjs <base> <head>   prints `code=true` or `code=false`
// When in doubt it answers true, so real checks are never skipped by mistake.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Only these paths are covered entirely by `pnpm check` (Biome and the docs check).
// Everything else, including changesets and workflow files, runs the code checks.
const docsPaths = [
    /^docs\//,
    /^AGENTS\.md$/,
    /^CODING_STANDARDS\.md$/,
    /^packages\/[^/]+\/README\.md$/,
];

export const isDocsPath = file => docsPaths.some(pattern => pattern.test(file));

/** True when any changed file needs the code checks, or when nothing is known. */
export const touchesCode = files =>
    files.length === 0 || files.some(file => !isDocsPath(file));

/** Compare two commits. An unknown or unreachable base means "run everything". */
export const needsCodeChecks = (base, head, cwd = process.cwd()) => {
    if (!base || /^0+$/.test(base)) return true;

    try {
        const files = execFileSync("git", ["diff", "--name-only", base, head], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })
            .split("\n")
            .filter(Boolean);

        return touchesCode(files);
    } catch {
        return true;
    }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [base = "", head = "HEAD"] = process.argv.slice(2);

    console.log(`code=${needsCodeChecks(base, head)}`);
}
