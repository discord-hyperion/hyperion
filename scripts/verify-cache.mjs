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
    "@hyperion/jsx#typecheck",
    "@hyperion/jsx#test",
];
const coreChecks = checks.slice(0, 2);
const botChecks = checks.slice(2, 4);
const jsxChecks = checks.slice(4);
const coreAndBotChecks = [...coreChecks, ...botChecks];
const jsxAndBotChecks = [...jsxChecks, ...botChecks];
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
    for (const id of ids) {
        assert.equal(task(tasks, id).cache.status, status, id);
    }
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
        // Hashes are the cache contract. Re-running the affected tasks here would
        // only repeat CI's typecheck and test step, about nine times over.
        console.log(`PASS ${label}: exactly the expected tasks invalidate`);
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
        "packages/jsx/package.json",
        "packages/jsx/tsconfig.json",
        "packages/jsx/tsconfig.build.json",
        "packages/jsx/lib",
        "packages/jsx/tests",
        "packages/jsx/benchmarks",
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
    assert.match(replay, /6 cached, 6 total/);
    console.log(
        "PASS cold source checks without dist, parallel graph, unchanged-run cache replay",
    );

    await mutate(
        "framework edit",
        "packages/core/src/index.ts",
        text => `${text}\n// Cache verification.\n`,
        coreAndBotChecks,
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
        coreAndBotChecks,
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

    await mutate(
        "JSX edit",
        "packages/jsx/lib/index.ts",
        text => `${text}\n// Cache verification.\n`,
        jsxAndBotChecks,
        baseline,
    );

    await mutate(
        "JSX manifest edit",
        "packages/jsx/package.json",
        text => {
            const manifest = JSON.parse(text);
            manifest.description = "Cache verification";

            return JSON.stringify(manifest);
        },
        jsxAndBotChecks,
        baseline,
    );

    cached(dry(), coreChecks, "HIT");

    execute(["build"]);
    const emitted = [];

    for (const name of ["core", "jsx"]) {
        const directoryName = path.join(directory, "packages", name, "dist");
        emitted.push(
            await readFile(path.join(directoryName, "index.js"), "utf8"),
        );
        await rm(directoryName, { recursive: true });
    }

    const restored = execute(["build"]);
    assert.match(restored, /2 cached, 2 total/);

    for (const [index, name] of ["core", "jsx"].entries()) {
        const directoryName = path.join(directory, "packages", name, "dist");
        assert.equal(
            await readFile(path.join(directoryName, "index.js"), "utf8"),
            emitted[index],
        );
        await access(path.join(directoryName, "index.d.ts"));
    }

    await access(path.join(directory, "packages/jsx/dist/jsx-runtime.d.ts"));
    await access(path.join(directory, "packages/jsx/dist/jsx-dev-runtime.js"));
    console.log(
        "PASS cached builds restore both packages and JSX runtime subpaths",
    );
} finally {
    await rm(directory, { recursive: true, force: true });
}
