import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const validateRelease = ({
    version,
    expectedVersion,
    channel,
    ref,
    pre,
}) => {
    assert.equal(
        version,
        expectedVersion,
        "The requested version must match the reviewed package version.",
    );
    const number = "(?:0|[1-9][0-9]*)";
    const base = `${number}\\.${number}\\.${number}`;
    if (channel === "latest") {
        assert.equal(
            ref,
            "refs/heads/main",
            "latest is published only from main.",
        );
        assert.match(
            version,
            new RegExp(`^${base}$`),
            "latest requires a non-prerelease version.",
        );
        assert.equal(
            pre,
            undefined,
            "Resolve Changesets prerelease state before publishing latest.",
        );
    } else {
        assert.equal(
            channel,
            "beta",
            "Only latest and beta channels are supported.",
        );
        assert.equal(
            ref,
            "refs/heads/release/beta",
            "beta is published only from release/beta.",
        );
        assert.match(
            version,
            new RegExp(`^${base}-beta\\.${number}$`),
            "beta requires a beta prerelease version.",
        );
        assert.equal(
            pre?.mode,
            "pre",
            "beta requires active Changesets prerelease state.",
        );
        assert.equal(
            pre?.tag,
            "beta",
            "Changesets prerelease tag must be beta.",
        );
    }
};

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const { values } = parseArgs({
        options: {
            version: { type: "string" },
            channel: { type: "string" },
            ref: { type: "string" },
        },
    });
    const manifest = JSON.parse(
        await readFile("packages/core/package.json", "utf8"),
    );
    let pre;
    try {
        pre = JSON.parse(await readFile(".changeset/pre.json", "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    validateRelease({
        version: manifest.version,
        expectedVersion: values.version,
        channel: values.channel,
        ref: values.ref,
        pre,
    });
    const pending = (await readdir(".changeset")).filter(
        name => name.endsWith(".md") && name !== "README.md",
    );
    assert.equal(
        pending.length,
        0,
        "Version all pending changesets and review their changes before publication.",
    );
    console.log(
        `Release candidate verified: ${manifest.name}@${manifest.version} (${values.channel})`,
    );
}
