import { readdir } from "node:fs/promises";
import path from "node:path";

export const isModuleFilename = (filename: string, includeIndexes = false) =>
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(filename) &&
    !/\.d\.(?:[cm]?ts|tsx)$/.test(filename) &&
    (includeIndexes || !/^index\./.test(filename)) &&
    !/\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(filename);

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
                isModuleFilename(entry.name, options.includeIndexes)
            ) {
                files.push(entryPath);
            }
        }

        return files;
    };

    return discover(directory, true);
};
