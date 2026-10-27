import { readdir } from "node:fs/promises";
import path from "node:path";

/** A missing root is optional; filesystem failures below it still propagate. */
export const discoverModules = async (
    directory: string,
    onMissing?: () => void,
    options: { includeIndexes?: boolean } = {},
): Promise<string[]> => {
    const discover = async (
        current: string,
        optional = false,
    ): Promise<string[]> => {
        const entries = await readdir(current, { withFileTypes: true }).catch(
            (error: unknown) => {
                if (
                    optional &&
                    error instanceof Error &&
                    "code" in error &&
                    error.code === "ENOENT"
                ) {
                    onMissing?.();
                    return [];
                }
                throw error;
            },
        );

        entries.sort((a, b) => a.name.localeCompare(b.name));

        const files: string[] = [];

        for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules")
                continue;

            const entryPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                files.push(...(await discover(entryPath)));
            } else if (
                entry.isFile() &&
                /\.(?:[cm]?ts|[cm]?js)$/.test(entry.name) &&
                !/\.d\.[cm]?ts$/.test(entry.name) &&
                (!/^index\./.test(entry.name) || options.includeIndexes) &&
                !/\.(?:test|spec)\.[cm]?[jt]s$/.test(entry.name)
            ) {
                files.push(entryPath);
            }
        }

        return files;
    };

    return discover(directory, true);
};
