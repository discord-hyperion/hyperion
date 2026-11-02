import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { ModalRegistry } from "../src/registries/index.ts";
import { modalKind } from "./support/component-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

// Shared registry behaviour lives in component-registry.test.ts.
const { source } = modalKind;

const fixture = (t: TestContext) =>
    createHandlerRoot(t, "hyperion-modals-", "modals");

for (const failure of [
    "invalid builder",
    "changed custom ID",
    "import failure",
]) {
    test(`modal reload with ${failure} retains previous handlers and source context`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(path.join(directory, "valid.mjs"), source("valid"));
        const registry = new ModalRegistry();
        await registry.load(root);
        const original = registry.get("valid");
        const broken =
            failure === "import failure"
                ? 'throw new Error("Import failed");'
                : failure === "changed custom ID"
                  ? source("changed").replace(
                        "async run() {}",
                        'changed = this.builder.setCustomId("different"); async run() {}',
                    )
                  : source("x".repeat(101));
        await writeFile(path.join(directory, "broken.mjs"), broken);

        await assert.rejects(registry.load(root), error => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Failed to load modal.*broken.mjs/);
            assert.ok(error.cause instanceof Error);
            return true;
        });
        assert.equal(registry.get("valid"), original);
        assert.equal(registry.size, 1);
    });
}
