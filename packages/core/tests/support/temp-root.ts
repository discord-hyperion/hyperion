import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
