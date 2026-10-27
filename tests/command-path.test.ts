import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCommandPath } from "../src/registries/parse-command-path.ts";
import { discoverModules } from "../src/util/index.ts";

test("regular command files have no parent or group", () => {
    assert.deepEqual(parseCommandPath("ping.ts"), {
        categories: [],
        moduleName: "ping",
    });
});

test("legacy plain folders remain organizational", () => {
    assert.deepEqual(parseCommandPath("nested/ping.ts"), {
        categories: ["nested"],
        moduleName: "ping",
    });
});

test("parenthesized folders are organizational at any depth", () => {
    assert.deepEqual(
        parseCommandPath(
            "(support)/(public)/[ticket]/(actions)/{settings}/(read)/view.ts",
        ),
        {
            categories: ["support", "public", "actions", "read"],
            parent: "ticket",
            group: "settings",
            moduleName: "view",
        },
    );
    assert.deepEqual(parseCommandPath("(general)/ping.ts"), {
        categories: ["general"],
        moduleName: "ping",
    });
});

test("square brackets supply the subcommand parent", () => {
    assert.deepEqual(parseCommandPath("[ticket]/create.ts"), {
        categories: [],
        parent: "ticket",
        moduleName: "create",
    });
});

test("braces supply a group within the parent", () => {
    assert.deepEqual(parseCommandPath("[ticket]/{settings}/view.ts"), {
        categories: [],
        parent: "ticket",
        group: "settings",
        moduleName: "view",
    });
});

test("module extensions and Windows separators do not affect parsed names", () => {
    for (const extension of ["ts", "mts", "cts", "js", "mjs", "cjs"]) {
        assert.deepEqual(
            parseCommandPath(
                `(support)\\[ticket]\\{settings}\\view.${extension}`,
            ),
            {
                categories: ["support"],
                parent: "ticket",
                group: "settings",
                moduleName: "view",
            },
        );
    }
});

test("invalid folder hierarchies and delimiters are rejected", () => {
    for (const filename of [
        "{settings}/view.ts",
        "(support)/{settings}/view.ts",
        "[ticket]/[other]/view.ts",
        "[ticket]/{settings}/{nested}/view.ts",
        "[]/view.ts",
        "()/view.ts",
        "[ticket]/{}/view.ts",
        "( )/view.ts",
        "[ticket)/view.ts",
        "(support]/view.ts",
        "[ticket]/{settings]/view.ts",
        "((support))/view.ts",
    ]) {
        assert.throws(() => parseCommandPath(filename), TypeError, filename);
    }
});

test("paths must name an executable module inside the command directory", () => {
    for (const filename of [
        "",
        "/ping.ts",
        "C:\\commands\\ping.ts",
        "../ping.ts",
        "(support)/../ping.ts",
        "./ping.ts",
        "(support)//ping.ts",
        "(support)/",
        "ping.txt",
        "ping.d.ts",
        "ping.test.ts",
        "ping.spec.mjs",
        "index.ts",
        "[ticket].ts",
        "{settings}.ts",
    ]) {
        assert.throws(() => parseCommandPath(filename), TypeError, filename);
    }
});

test("filesystem discovery preserves convention folders without importing modules", async t => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-command-paths-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    const paths = [
        "(support)/[ticket]/create.ts",
        "(support)/[ticket]/{settings}/view.ts",
        "(general)/ping.ts",
    ];

    for (const filename of paths) {
        await mkdir(path.dirname(path.join(root, filename)), {
            recursive: true,
        });
        await writeFile(
            path.join(root, filename),
            'throw new Error("Must not import");',
        );
    }

    const modules = await discoverModules(root);
    const parsed = modules.map(filename =>
        parseCommandPath(path.relative(root, filename)),
    );

    assert.equal(parsed.length, 3);
    assert.deepEqual(
        parsed.find(module => module.moduleName === "view"),
        {
            categories: ["support"],
            parent: "ticket",
            group: "settings",
            moduleName: "view",
        },
    );
});
