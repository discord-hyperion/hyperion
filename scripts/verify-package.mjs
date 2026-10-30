import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    cp,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const core = path.join(root, "packages/core");
const fixture = path.join(root, "scripts/fixtures/package-consumer");
const manifest = JSON.parse(
    await readFile(path.join(core, "package.json"), "utf8"),
);
const workspace = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
);
const run = (command, args, cwd) =>
    execFileSync(command, args, { cwd, stdio: "inherit", timeout: 120_000 });
const configure = async directory => {
    await cp(fixture, directory, { recursive: true });
    await writeFile(
        path.join(directory, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                types: ["node"],
                allowImportingTsExtensions: true,
                exactOptionalPropertyTypes: true,
                noUncheckedIndexedAccess: true,
                verbatimModuleSyntax: true,
            },
            include: ["consumer.ts"],
        }),
    );
};

const temporary = await mkdtemp(path.join(os.tmpdir(), "hyperion-package-"));
const source = await mkdtemp(path.join(core, ".consumer-"));
try {
    // Only generated build output is removed; local development must work without it.
    await rm(path.join(core, "dist"), { recursive: true, force: true });
    await configure(source);
    run(
        "pnpm",
        ["exec", "tsc", "--noEmit", "-p", path.join(source, "tsconfig.json")],
        core,
    );
    run(
        process.execPath,
        ["--import", "tsx", path.join(source, "smoke.mjs")],
        core,
    );
    console.log("PASS source consumption without dist or path aliases");

    run("pnpm", ["pack", "--pack-destination", temporary], core);
    const archives = (await readdir(temporary)).filter(name =>
        name.endsWith(".tgz"),
    );
    assert.equal(archives.length, 1);
    const archive = path.join(temporary, archives[0]);
    const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
        .trim()
        .split("\n");
    for (const entry of entries) {
        assert.ok(!entry.split("/").includes(".."), entry);
        assert.match(
            entry,
            /^package\/(?:package\.json|README\.md|LICENSE|dist\/(?:.*\.(?:js|d\.ts))?)$/,
            entry,
        );
    }
    const packedManifest = JSON.parse(
        execFileSync("tar", ["-xOzf", archive, "package/package.json"], {
            encoding: "utf8",
        }),
    );
    assert.deepEqual(packedManifest.exports, manifest.publishConfig.exports);
    for (const required of [
        "dist/index.js",
        "dist/index.d.ts",
        "README.md",
        "LICENSE",
    ]) {
        assert.ok(entries.includes(`package/${required}`), required);
    }

    const consumer = path.join(temporary, "consumer");
    await configure(consumer);
    await writeFile(
        path.join(consumer, "package.json"),
        JSON.stringify({
            name: "hyperion-packed-consumer",
            private: true,
            type: "module",
            packageManager: workspace.packageManager,
            dependencies: {
                "@hyperion/core": `file:${archive}`,
                ...manifest.peerDependencies,
                valibot: manifest.devDependencies.valibot,
                typescript: workspace.devDependencies.typescript,
                "@types/node": workspace.devDependencies["@types/node"],
                tsx: workspace.devDependencies.tsx,
            },
        }),
    );
    // A real install outside the workspace: no linked source or dependency fallbacks.
    run("pnpm", ["install", "--offline", "--ignore-scripts"], consumer);
    run(process.execPath, [path.join(consumer, "smoke.mjs")], consumer);
    run("pnpm", ["exec", "tsc", "--noEmit"], consumer);
    run("pnpm", ["exec", "tsx", "consumer.ts"], consumer);
    console.log(
        "PASS artifact allowlist, published exports, plain ESM, NodeNext types, tsx, discovery and constructor identity",
    );
} finally {
    await rm(source, { recursive: true, force: true });
    await rm(temporary, { recursive: true, force: true });
}
