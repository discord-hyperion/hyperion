// Decide which CI jobs a change needs:
//   code  the code checks (typecheck, tests, and the package, cache, and release
//         verification), skipped for documentation-only changes
//   site  the documentation site build, run when the guide, the site app, or
//         anything that could change its build is touched
//   cache the Turborepo cache verification, run when the files that decide task
//         hashes change (Turbo, package, and TypeScript config, the lockfile)
//   node scripts/ci-changes.mjs <base> <head>   prints `code=`, `site=`, `cache=`
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

// Paths that can change the published site: the guide it renders, the app that
// builds it, and the files that decide which dependencies and workflows build it.
const sitePaths = [
    /^docs\/guide\//,
    /^apps\/docs-site-fumadocs\//,
    /^pnpm-lock\.yaml$/,
    /^pnpm-workspace\.yaml$/,
    /^package\.json$/,
    /^\.github\/workflows\//,
];

// Paths that decide Turborepo task hashes, plus the verification script itself.
// Ordinary source edits change hashes in ways verify-cache already pins down.
const cachePaths = [
    /^turbo\.json$/,
    /(^|\/)package\.json$/,
    /(^|\/)tsconfig[^/]*\.json$/,
    /^pnpm-lock\.yaml$/,
    /^pnpm-workspace\.yaml$/,
    /^\.gitignore$/,
    /^scripts\/verify-cache\.mjs$/,
    /^\.github\/workflows\//,
];

const matchesAny = (files, patterns) =>
    files.some(file => patterns.some(pattern => pattern.test(file)));

export const isDocsPath = file => docsPaths.some(pattern => pattern.test(file));

/** True when any changed file needs the code checks, or when nothing is known. */
export const touchesCode = files =>
    files.length === 0 || files.some(file => !isDocsPath(file));

/** True when any changed file can change the site, or when nothing is known. */
export const touchesSite = files =>
    files.length === 0 || matchesAny(files, sitePaths);

/** True when any changed file can change task hashes, or when nothing is known. */
export const touchesCache = files =>
    files.length === 0 || matchesAny(files, cachePaths);

/** The files changed between two commits, or null when the comparison is unknown. */
const changedFiles = (base, head, cwd) => {
    if (!base || /^0+$/.test(base)) return null;

    try {
        return execFileSync("git", ["diff", "--name-only", base, head], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })
            .split("\n")
            .filter(Boolean);
    } catch {
        return null;
    }
};

/** Compare two commits. An unknown or unreachable base means "run everything". */
export const needsCodeChecks = (base, head, cwd = process.cwd()) => {
    const files = changedFiles(base, head, cwd);

    return files === null || touchesCode(files);
};

/** Like `needsCodeChecks`, for the Turborepo cache verification. */
export const needsCacheCheck = (base, head, cwd = process.cwd()) => {
    const files = changedFiles(base, head, cwd);

    return files === null || touchesCache(files);
};

/** Like `needsCodeChecks`, for the documentation site build. */
export const needsSiteBuild = (base, head, cwd = process.cwd()) => {
    const files = changedFiles(base, head, cwd);

    return files === null || touchesSite(files);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [base = "", head = "HEAD"] = process.argv.slice(2);

    console.log(`code=${needsCodeChecks(base, head)}`);
    console.log(`site=${needsSiteBuild(base, head)}`);
    console.log(`cache=${needsCacheCheck(base, head)}`);
}
