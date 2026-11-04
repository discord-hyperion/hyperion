import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import {
    isDocsPath,
    needsCodeChecks,
    needsSiteBuild,
    touchesCode,
    touchesSite,
} from "./ci-changes.mjs";

describe("path classification", () => {
    test("documentation paths skip the code checks", () => {
        for (const file of [
            "docs/guide/buttons.md",
            "docs/research/documentation-site-generators.md",
            "docs/adr/0003-guards-are-definitions-not-classes.md",
            "AGENTS.md",
            "CODING_STANDARDS.md",
            "packages/jsx/README.md",
            "packages/core/README.md",
        ]) {
            assert.ok(isDocsPath(file), file);
        }
    });

    test("everything else runs the code checks", () => {
        for (const file of [
            "packages/core/src/index.ts",
            "packages/jsx/package.json",
            "packages/jsx/lib/render-message.ts",
            "apps/dev-bot/src/commands/ping.ts",
            "apps/docs-site-fumadocs/package.json",
            "scripts/check-docs.mjs",
            ".github/workflows/ci.yml",
            ".changeset/define-guard.md",
            "pnpm-lock.yaml",
            "package.json",
            "README.md",
            "docsy/notes.md",
            "docs.md",
        ]) {
            assert.equal(isDocsPath(file), false, file);
        }
    });

    test("one code file among documentation runs the code checks", () => {
        assert.equal(
            touchesCode(["docs/guide/buttons.md", "packages/core/src/a.ts"]),
            true,
        );
        assert.equal(touchesCode(["docs/a.md", "AGENTS.md"]), false);
    });

    test("an empty change list runs the code checks", () => {
        assert.equal(touchesCode([]), true);
    });
});

describe("site classification", () => {
    test("the guide, the site app, and build inputs build the site", () => {
        for (const file of [
            "docs/guide/buttons.md",
            "docs/guide/jsx/embeds.md",
            "apps/docs-site-fumadocs/lib/source.js",
            "pnpm-lock.yaml",
            "package.json",
            ".github/workflows/pages.yml",
        ]) {
            assert.ok(touchesSite([file]), file);
        }
    });

    test("other changes leave the site alone", () => {
        for (const file of [
            "docs/buttons.md",
            "docs/research/documentation-site-generators.md",
            "AGENTS.md",
            "packages/core/src/index.ts",
            "apps/dev-bot/src/commands/ping.ts",
        ]) {
            assert.equal(touchesSite([file]), false, file);
        }
    });

    test("an empty change list builds the site", () => {
        assert.equal(touchesSite([]), true);
    });
});

describe("comparing commits", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "hyperion-ci-changes-"));
    const git = (...args) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const commit = (message, files) => {
        for (const [name, content] of Object.entries(files)) {
            mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
            writeFileSync(path.join(root, name), content);
        }

        git("add", "-A");
        git(
            "-c",
            "user.name=test",
            "-c",
            "user.email=test@example.com",
            "commit",
            "-q",
            "-m",
            message,
        );

        return git("rev-parse", "HEAD");
    };

    git("init", "-q");

    const start = commit("start", { "docs/a.md": "a", "src/a.ts": "a" });
    const docsOnly = commit("docs", { "docs/a.md": "b", "AGENTS.md": "x" });
    const mixed = commit("mixed", { "docs/a.md": "c", "src/a.ts": "b" });
    const guide = commit("guide", { "docs/guide/a.md": "a" });

    after(() => rmSync(root, { recursive: true, force: true }));

    test("a documentation-only range skips the code checks", () => {
        assert.equal(needsCodeChecks(start, docsOnly, root), false);
    });

    test("a range with code runs the code checks", () => {
        assert.equal(needsCodeChecks(start, mixed, root), true);
        assert.equal(needsCodeChecks(docsOnly, mixed, root), true);
    });

    test("only guide changes build the site", () => {
        assert.equal(needsSiteBuild(start, docsOnly, root), false);
        assert.equal(needsSiteBuild(mixed, guide, root), true);
        assert.equal(needsCodeChecks(mixed, guide, root), false);
    });

    test("an unknown base builds the site", () => {
        assert.equal(needsSiteBuild("", guide, root), true);
        assert.equal(needsSiteBuild("f".repeat(40), guide, root), true);
    });

    test("an unknown, missing, or all-zero base runs the code checks", () => {
        assert.equal(needsCodeChecks("", mixed, root), true);
        assert.equal(needsCodeChecks(undefined, mixed, root), true);
        assert.equal(needsCodeChecks("0".repeat(40), mixed, root), true);
        assert.equal(needsCodeChecks("f".repeat(40), mixed, root), true);
    });
});
