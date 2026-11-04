import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
    classifyCommandPath,
    parseCommandPath,
} from "../src/registries/parse-command-path.ts";
import {
    discoverModules,
    isModuleFilename,
} from "../src/util/discover-modules.ts";
import { createTempRoot } from "./support/temp-root.ts";

for (const extension of ["tsx", "jsx"]) {
    test(`discovers ${extension} while excluding declarations, tests, specs and barrels`, async t => {
        const root = await createTempRoot(t, "hyperion-jsx-discovery-");

        for (const name of [
            `handler.${extension}`,
            `handler.test.${extension}`,
            `handler.spec.${extension}`,
            `index.${extension}`,
            "types.d.tsx",
        ]) {
            await writeFile(path.join(root, name), "export {};");
        }

        await mkdir(path.join(root, "nested"));

        await writeFile(
            path.join(root, "nested", `leaf.${extension}`),
            "export {};",
        );

        assert.deepEqual(
            (await discoverModules(root)).map(file =>
                path.relative(root, file),
            ),
            [`handler.${extension}`, `nested/leaf.${extension}`],
        );
        assert.ok(isModuleFilename(`handler.${extension}`));
        assert.equal(
            classifyCommandPath(`category/index.${extension}`),
            undefined,
        );
        assert.equal(
            classifyCommandPath(`[todo]/index.${extension}`)?.kind,
            "parent",
        );
        assert.equal(
            classifyCommandPath(`[todo]/{manage}/index.${extension}`)?.kind,
            "group",
        );
        assert.equal(
            classifyCommandPath(`[todo]/{manage}/get.${extension}`)?.kind,
            "subcommand",
        );
        assert.equal(
            parseCommandPath(`[todo]/{manage}/get.${extension}`).moduleName,
            "get",
        );
    });
}
