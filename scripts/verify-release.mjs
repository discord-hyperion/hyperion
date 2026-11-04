import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    cp,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releasePackage, validateRelease } from "./check-release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const stable = {
    version: "0.1.0",
    expectedVersion: "0.1.0",
    channel: "latest",
    ref: "refs/heads/main",
};
const beta = {
    version: "0.2.0-beta.0",
    expectedVersion: "0.2.0-beta.0",
    channel: "beta",
    ref: "refs/heads/release/beta",
    pre: { mode: "pre", tag: "beta" },
};
assert.equal(releasePackage("@hyperion/core"), "core");
assert.equal(releasePackage("@hyperion/jsx"), "jsx");
assert.throws(() => releasePackage("@hyperion/dev-bot"));
assert.throws(() => releasePackage("../../private"));
assert.throws(() => releasePackage("toString"));
validateRelease(stable);
validateRelease(beta);
for (const invalid of [
    { ...stable, expectedVersion: "0.1.1" },
    { ...stable, ref: "refs/heads/feature" },
    { ...stable, pre: beta.pre },
    { ...stable, version: beta.version, expectedVersion: beta.version },
    { ...beta, ref: stable.ref },
    { ...beta, pre: undefined },
    { ...beta, pre: { mode: "exit", tag: "beta" } },
    { ...beta, channel: "next" },
    { ...beta, version: "0.2.0-beta.01", expectedVersion: "0.2.0-beta.01" },
]) {
    assert.throws(() => validateRelease(invalid));
}
console.log(
    "PASS release guards: exact version, stable/beta branch and tag isolation",
);

const temporary = await mkdtemp(path.join(os.tmpdir(), "hyperion-version-"));
const run = (command, args) =>
    execFileSync(command, args, {
        cwd: temporary,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 120_000,
    });
const cli = (...args) =>
    run(process.execPath, [
        path.join(root, "node_modules/@changesets/cli/bin.js"),
        ...args,
    ]);
const write = (relative, data) =>
    writeFile(
        path.join(temporary, relative),
        typeof data === "string" ? data : JSON.stringify(data, null, 4),
    );
const read = async relative =>
    JSON.parse(await readFile(path.join(temporary, relative), "utf8"));
const changeset = (bump, name = "@hyperion/core") =>
    write(
        ".changeset/verification.md",
        `---\n"${name}": ${bump}\n---\n\nVerify ${bump} version planning.\n`,
    );
try {
    await mkdir(path.join(temporary, ".changeset"));
    await mkdir(path.join(temporary, "packages/core"), { recursive: true });
    await mkdir(path.join(temporary, "packages/jsx"));
    await mkdir(path.join(temporary, "packages/consumer"));
    await mkdir(path.join(temporary, "packages/peer-consumer"));
    await mkdir(path.join(temporary, "apps/dev-bot"), { recursive: true });

    await cp(
        path.join(root, ".changeset/config.json"),
        path.join(temporary, ".changeset/config.json"),
    );

    await cp(path.join(root, "biome.json"), path.join(temporary, "biome.json"));

    await symlink(
        path.join(root, "node_modules"),
        path.join(temporary, "node_modules"),
        "dir",
    );

    await write(".gitignore", "node_modules/\n");

    await write("package.json", {
        name: "release-verification",
        private: true,
        type: "module",
        packageManager: "pnpm@12.15.0",
    });

    await write(
        "pnpm-workspace.yaml",
        "packages:\n  - packages/*\n  - apps/*\n",
    );

    await write("packages/core/package.json", {
        name: "@hyperion/core",
        version: "0.1.0",
    });

    await write("packages/jsx/package.json", {
        name: "@hyperion/jsx",
        version: "0.0.0",
    });

    await write("packages/consumer/package.json", {
        name: "@hyperion/consumer",
        version: "1.0.0",
        dependencies: { "@hyperion/core": "workspace:^0.1.0" },
    });

    await write("packages/peer-consumer/package.json", {
        name: "@hyperion/peer-consumer",
        version: "1.0.0",
        peerDependencies: { "@hyperion/core": "^0.1.0" },
    });

    await write("apps/dev-bot/package.json", {
        name: "@hyperion/dev-bot",
        version: "0.0.0",
        private: true,
        dependencies: { "@hyperion/core": "workspace:*" },
    });

    run("git", ["init", "--quiet"]);
    run("git", ["add", "."]);
    run("git", [
        "-c",
        "user.name=Release verification",
        "-c",
        "user.email=release-verification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "test(release): establish disposable baseline",
    ]);

    await changeset("patch");
    // Exercise the real formatting seam before Changesets parses the note.
    run(path.join(root, "node_modules/.bin/biome"), [
        "check",
        "--write",
        ".changeset/verification.md",
    ]);
    cli("version");
    assert.equal((await read("packages/core/package.json")).version, "0.1.1");
    assert.equal(
        (await read("packages/consumer/package.json")).version,
        "1.0.0",
    );
    assert.equal(
        (await read("packages/peer-consumer/package.json")).version,
        "1.0.0",
    );
    assert.equal((await read("apps/dev-bot/package.json")).version, "0.0.0");
    assert.match(
        await readFile(
            path.join(temporary, "packages/core/CHANGELOG.md"),
            "utf8",
        ),
        /Verify patch version planning/,
    );
    console.log(
        "PASS patch release: changelog generated, compatible dependents and private bot unchanged",
    );

    await changeset("minor", "@hyperion/jsx");
    cli("version");
    assert.equal((await read("packages/jsx/package.json")).version, "0.1.0");
    assert.equal((await read("packages/core/package.json")).version, "0.1.1");
    assert.equal((await read("apps/dev-bot/package.json")).version, "0.0.0");
    run(process.execPath, [
        path.join(root, "scripts/check-release.mjs"),
        "--package",
        "@hyperion/jsx",
        "--version",
        "0.1.0",
        "--channel",
        "latest",
        "--ref",
        stable.ref,
    ]);
    assert.throws(() =>
        run(process.execPath, [
            path.join(root, "scripts/check-release.mjs"),
            "--package",
            "@hyperion/jsx",
            "--version",
            "0.1.1",
            "--channel",
            "latest",
            "--ref",
            stable.ref,
        ]),
    );
    console.log(
        "PASS independent JSX release and manifest guard leave core/private bot versions unchanged",
    );

    await changeset("minor");
    cli("version");
    assert.equal((await read("packages/core/package.json")).version, "0.2.0");
    assert.equal(
        (await read("packages/consumer/package.json")).version,
        "1.0.1",
    );
    assert.match(
        (await read("packages/consumer/package.json")).dependencies[
            "@hyperion/core"
        ],
        /0\.2\.0/,
    );
    assert.equal((await read("apps/dev-bot/package.json")).version, "0.0.0");
    console.log(
        "PASS out-of-range dependent release: version and dependency range updated for review",
    );

    cli("pre", "enter", "beta");
    await changeset("patch");
    cli("version");
    const version = (await read("packages/core/package.json")).version;
    assert.match(version, /^0\.2\.1-beta\.0$/);
    validateRelease({
        ...beta,
        version,
        expectedVersion: version,
        pre: await read(".changeset/pre.json"),
    });
    cli("pre", "exit");
    cli("version");
    assert.equal((await read("packages/core/package.json")).version, "0.2.1");

    await assert.rejects(
        readFile(path.join(temporary, ".changeset/pre.json")),
        { code: "ENOENT" },
    );

    console.log(
        "PASS beta entry, versioning, and exit without publishing or changing the repository",
    );
} finally {
    await rm(temporary, { recursive: true, force: true });
}
