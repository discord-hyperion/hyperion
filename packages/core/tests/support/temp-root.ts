import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

/** Creates a temporary bot root that is removed when the test finishes. */
export const createTempRoot = async (
    t: Pick<TestContext, "after">,
    prefix: string,
) => {
    const root = await mkdtemp(path.join(os.tmpdir(), prefix));
    t.after(() => rm(root, { recursive: true, force: true }));

    return root;
};

/** Creates a temporary bot root containing an empty `src/<folder>` directory. */
export const createHandlerRoot = async (
    t: Pick<TestContext, "after">,
    prefix: string,
    folder: string,
) => {
    const root = await createTempRoot(t, prefix);
    const directory = path.join(root, "src", folder);
    await mkdir(directory, { recursive: true });

    return { root, directory };
};

let written = 0;

/**
 * Write a handler module under a fresh filename and return its path. Node caches
 * ES modules by URL, so rewriting an existing path would reload the old module.
 */
export const writeHandler = async (
    directory: string,
    source: string,
    name = "handler",
) => {
    written++;

    const file = path.join(directory, `${name}-${written}.mjs`);
    await writeFile(file, source);

    return file;
};
