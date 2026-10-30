import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(path.join(os.tmpdir(), "hyperion-cache-"));
const sourceTasks = ["typecheck", "test"];
const checks = [
    "@hyperion/core#typecheck",
    "@hyperion/core#test",
    "@hyperion/dev-bot#typecheck",
    "@hyperion/dev-bot#test",
];
const coreChecks = checks.slice(0, 2);
const botChecks = checks.slice(2);
const run = (command, args) =>
    execFileSync(command, args, {
        cwd: directory,
        encoding: "utf8",
        timeout: 120_000,
    });
const turbo = (tasks, extra = []) =>
    run("pnpm", [
        "exec",
        "turbo",
        "run",
        ...tasks,
        "--cache=local:rw",
        ...extra,
    ]);
const dry = () => JSON.parse(turbo(sourceTasks, ["--dry=json"])).tasks;
const task = (tasks, id) => {
    const found = tasks.find(item => item.taskId === id);
    assert.ok(found, id);
    return found;
};
const cached = (tasks, ids, status) => {
    for (const id of ids)
        assert.equal(task(tasks, id).cache.status, status, id);
};
const execute = tasks => turbo(tasks, ["--output-logs=errors-only"]);
const mutate = async (label, relative, transform, affected, baseline) => {
    const filename = path.join(directory, relative);
    const original = await readFile(filename, "utf8");
    try {
        await writeFile(filename, transform(original));
        const changed = dry();
        for (const id of checks) {
            assert.equal(
                task(changed, id).hash !== task(baseline, id).hash,
                affected.includes(id),
                `${label}: ${id}`,
            );
        }
        cached(changed, affected, "MISS");
        cached(
            changed,
            checks.filter(id => !affected.includes(id)),
            "HIT",
        );
        execute(sourceTasks);
        cached(dry(), checks, "HIT");
        console.log(
            `PASS ${label}: expected invalidation, successful rerun, then cache hits`,
        );
    } finally {
        await writeFile(filename, original);
    }
};

try {
    const paths = [
        ".gitignore",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "tsconfig.base.json",
        "turbo.json",
        "tests/fixtures",
        "packages/core/package.json",
        "packages/core/tsconfig.json",
        "packages/core/tsconfig.build.json",
        "packages/core/src",
        "packages/core/tests",
        "apps/dev-bot/package.json",
        "apps/dev-bot/tsconfig.json",
        "apps/dev-bot/index.ts",
        "apps/dev-bot/src",
        "apps/dev-bot/tests",
    ];
    for (const relative of paths) {
        await cp(path.join(root, relative), path.join(directory, relative), {
            recursive: true,
            filter: source => !path.basename(source).startsWith(".env"),
        });
    }
    // Git ignore semantics match a checkout, without copying the user's repository or private files.
    run("git", ["init", "--quiet"]);
    run("pnpm", [
        "install",
        "--offline",
        "--frozen-lockfile",
        "--ignore-scripts",
    ]);
    const baseline = dry();
    cached(baseline, checks, "MISS");
    for (const item of baseline) {
        if (item.command === "<NONEXISTENT>") continue;
        assert.ok(
            !item.dependencies.some(id => id.endsWith("#build")),
            item.taskId,
        );
        assert.ok(
            !item.dependencies.some(id => checks.includes(id)),
            item.taskId,
        );
        assert.ok(
            item.dependencies.some(id => id.endsWith("#transit")),
            item.taskId,
        );
    }
    execute(sourceTasks);
    await assert.rejects(access(path.join(directory, "packages/core/dist")), {
        code: "ENOENT",
    });
    cached(dry(), checks, "HIT");
    const replay = execute(sourceTasks);
    assert.match(replay, /4 cached, 4 total/);
    console.log(
        "PASS cold source checks without dist, parallel graph, unchanged-run cache replay",
    );

    await mutate(
        "framework edit",
        "packages/core/src/index.ts",
        text => `${text}\n// Cache verification.\n`,
        checks,
        baseline,
    );
    await mutate(
        "bot edit",
        "apps/dev-bot/index.ts",
        text => `${text}\n// Cache verification.\n`,
        botChecks,
        baseline,
    );
    await mutate(
        "shared fixture edit",
        "tests/fixtures/interactions.ts",
        text => `${text}\n// Cache verification.\n`,
        checks,
        baseline,
    );
    await mutate(
        "shared TypeScript config edit",
        "tsconfig.base.json",
        text => `${text}\n`,
        checks,
        baseline,
    );
    await mutate(
        "framework dependency edit",
        "packages/core/package.json",
        text => {
            const manifest = JSON.parse(text);
            manifest.devDependencies.valibot = "1.5.0";
            return JSON.stringify(manifest);
        },
        checks,
        baseline,
    );
    await mutate(
        "bot dependency edit",
        "apps/dev-bot/package.json",
        text => {
            const manifest = JSON.parse(text);
            manifest.dependencies.valibot = "1.5.0";
            return JSON.stringify(manifest);
        },
        botChecks,
        baseline,
    );
    cached(dry(), coreChecks, "HIT");

    execute(["build"]);
    const output = path.join(directory, "packages/core/dist/index.js");
    const emitted = await readFile(output, "utf8");
    await rm(path.join(directory, "packages/core/dist"), { recursive: true });
    const restored = execute(["build"]);
    assert.match(restored, /1 cached, 1 total/);
    assert.equal(await readFile(output, "utf8"), emitted);
    await access(path.join(directory, "packages/core/dist/index.d.ts"));
    console.log(
        "PASS cached build restores JavaScript and declarations after dist deletion",
    );
} finally {
    await rm(directory, { recursive: true, force: true });
}
