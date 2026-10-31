import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    cp,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    realpath,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const options = process.argv.slice(2);
assert.ok(
    options.length === 0 ||
        (options.length === 2 && options[0] === "--pack-destination"),
    "Usage: verify-package.mjs [--pack-destination directory]",
);
const destination = options.length ? path.resolve(options[1]) : undefined;
const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
);
// Match Node's canonical module paths when the platform aliases its temp directory.
const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "hyperion-package-")),
);
const packages = await Promise.all(
    ["jsx", "core"].map(async name => ({
        name,
        directory: path.join(root, "packages", name),
        manifest: JSON.parse(
            await readFile(
                path.join(root, "packages", name, "package.json"),
                "utf8",
            ),
        ),
    })),
);
const sources = [];
const run = (command, args, cwd) =>
    execFileSync(command, args, { cwd, stdio: "inherit", timeout: 120_000 });
const configure = async (directory, name) => {
    await cp(
        path.join(
            root,
            "scripts/fixtures",
            name === "jsx" ? "jsx-consumer" : "package-consumer",
        ),
        directory,
        { recursive: true },
    );
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
                allowJs: true,
                jsx: "react-jsx",
                jsxImportSource: "@hyperion/jsx",
            },
            include: [
                "consumer.ts",
                "consumer.tsx",
                "jsx-integration.tsx",
                "jsx-handlers/**/*.tsx",
                "jsx-handlers/**/*.jsx",
            ],
        }),
    );
};
const types = (directory, cwd = directory) =>
    run(
        "pnpm",
        [
            "exec",
            "tsc",
            "--noEmit",
            "-p",
            path.join(directory, "tsconfig.json"),
        ],
        cwd,
    );
const tsx = (directory, filename, cwd = directory) =>
    run(
        "pnpm",
        [
            "exec",
            "tsx",
            "--tsconfig",
            path.join(directory, "tsconfig.json"),
            path.join(directory, filename),
        ],
        cwd,
    );

try {
    for (const item of packages) {
        await rm(path.join(item.directory, "dist"), {
            recursive: true,
            force: true,
        });
    }

    for (const item of packages) {
        // Core's integration consumer uses the bot's explicit dependencies; standalone JSX uses only itself.
        const home =
            item.name === "core"
                ? path.join(root, "apps/dev-bot")
                : item.directory;
        const source = await mkdtemp(path.join(home, ".consumer-"));
        sources.push(source);
        await configure(source, item.name);
        types(source, home);
        run(
            process.execPath,
            ["--import", "tsx", path.join(source, "smoke.mjs")],
            home,
        );
        tsx(
            source,
            item.name === "jsx" ? "consumer.tsx" : "jsx-integration.tsx",
            home,
        );
        console.log(
            `PASS ${item.manifest.name} source consumption without dist or path aliases`,
        );
    }

    for (const item of packages) {
        const packed = path.join(temporary, item.name);
        await mkdir(packed);
        run("pnpm", ["pack", "--pack-destination", packed], item.directory);
        const archives = (await readdir(packed)).filter(name =>
            name.endsWith(".tgz"),
        );
        assert.equal(archives.length, 1);
        item.archive = path.join(packed, archives[0]);
        const entries = execFileSync("tar", ["-tzf", item.archive], {
            encoding: "utf8",
        })
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
            execFileSync(
                "tar",
                ["-xOzf", item.archive, "package/package.json"],
                { encoding: "utf8" },
            ),
        );
        assert.deepEqual(
            packedManifest.exports,
            item.manifest.publishConfig.exports,
        );

        for (const target of Object.values(packedManifest.exports)) {
            for (const required of [target.types, target.import]) {
                assert.ok(
                    entries.includes(
                        `package/${required.replace(/^\.\//, "")}`,
                    ),
                    required,
                );
            }
        }

        assert.ok(entries.includes("package/README.md"));
        assert.ok(entries.includes("package/LICENSE"));
    }

    for (const item of packages) {
        const consumer = path.join(temporary, `${item.name}-consumer`);
        await configure(consumer, item.name);
        const selected = item.name === "jsx" ? [item] : packages;
        const dependencies = Object.assign(
            {},
            ...selected.map(pkg => ({
                ...pkg.manifest.peerDependencies,
                [pkg.manifest.name]: `file:${pkg.archive}`,
            })),
        );
        await writeFile(
            path.join(consumer, "package.json"),
            JSON.stringify({
                name: `hyperion-${item.name}-consumer`,
                private: true,
                type: "module",
                packageManager: workspace.packageManager,
                dependencies: {
                    ...dependencies,
                    ...(item.name === "core"
                        ? {
                              valibot: packages.find(pkg => pkg.name === "core")
                                  .manifest.devDependencies.valibot,
                          }
                        : {}),
                    typescript: workspace.devDependencies.typescript,
                    "@types/node": workspace.devDependencies["@types/node"],
                    tsx: workspace.devDependencies.tsx,
                },
            }),
        );
        const pnpm = args =>
            execFileSync("pnpm", args, {
                cwd: consumer,
                stdio: "inherit",
                timeout: 120_000,
                env: {
                    ...process.env,
                    XDG_CACHE_HOME: path.join(temporary, "cache"),
                },
            });
        // Seed this independent project's metadata/lockfile, then prove offline reconstruction.
        pnpm(["install", "--ignore-scripts"]);
        await rm(path.join(consumer, "node_modules"), {
            recursive: true,
            force: true,
        });
        pnpm(["install", "--offline", "--frozen-lockfile", "--ignore-scripts"]);
        run(process.execPath, [path.join(consumer, "smoke.mjs")], consumer);
        types(consumer);
        tsx(consumer, item.name === "jsx" ? "consumer.tsx" : "consumer.ts");
        if (item.name === "core") {
            tsx(consumer, "jsx-integration.tsx");
        }
        if (destination) {
            await mkdir(destination, { recursive: true });
            await cp(
                item.archive,
                path.join(destination, path.basename(item.archive)),
            );
        }

        console.log(
            `PASS ${item.manifest.name} artifacts, published exports, ESM, NodeNext, tsx and native identity`,
        );
    }
} finally {
    for (const source of sources) {
        await rm(source, { recursive: true, force: true });
    }

    await rm(temporary, { recursive: true, force: true });
}
