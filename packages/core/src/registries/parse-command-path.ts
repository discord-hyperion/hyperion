import path from "node:path";
import { isModuleFilename } from "../util/discover-modules.ts";

export type CommandPath = {
    categories: readonly string[];
    moduleName: string;
    parent?: string;
    group?: string;
    parentDefinition?: true;
    groupDefinition?: true;
};

/** Classifies command modules before import; ordinary barrels have no definition. */
export const classifyCommandPath = (relativePath: string) => {
    const segments = relativePath.split(/[/\\]/);

    if (
        path.posix.isAbsolute(relativePath) ||
        path.win32.parse(relativePath).root ||
        segments.some(
            segment => !segment || segment === "." || segment === "..",
        )
    ) {
        throw new TypeError(
            "Command paths must be relative and contain no traversal or empty segments.",
        );
    }

    const filename = segments.pop();
    const groupDefinition =
        !!filename &&
        /^index\.(?:[cm]?[jt]s|[jt]sx)$/.test(filename) &&
        /^\{[^()[\]{}]+\}$/.test(segments.at(-1) ?? "");
    const parentDefinition =
        !!filename &&
        /^index\.(?:[cm]?[jt]s|[jt]sx)$/.test(filename) &&
        /^\[[^()[\]{}]+\]$/.test(segments.at(-1) ?? "");

    if (
        filename &&
        /^index\./.test(filename) &&
        !parentDefinition &&
        !groupDefinition
    )
        return undefined;

    if (
        !filename ||
        !isModuleFilename(filename, true) ||
        /[()[\]{}]/.test(filename)
    ) {
        throw new TypeError("Expected a command module filename.");
    }

    const categories: string[] = [];
    let parent: string | undefined;
    let group: string | undefined;

    for (const segment of segments) {
        const match =
            /^(?:\(([^()[\]{}]+)\)|\[([^()[\]{}]+)\]|\{([^()[\]{}]+)\})$/.exec(
                segment,
            );
        const name = match?.[1] ?? match?.[2] ?? match?.[3];

        if (!match && !/[()[\]{}]/.test(segment)) {
            categories.push(segment);
            continue;
        }

        if (!name?.trim()) {
            throw new TypeError(
                `Invalid command folder "${segment}"; use (category), [parent], or {group}.`,
            );
        }

        if (match?.[1]) {
            categories.push(name);
        } else if (match?.[2]) {
            if (parent) {
                throw new TypeError("Command parents cannot be nested.");
            }

            parent = name;
        } else {
            if (!parent) {
                throw new TypeError(
                    "Subcommand groups require a [parent] folder.",
                );
            }

            if (group) {
                throw new TypeError("Subcommand groups cannot be nested.");
            }

            group = name;
        }
    }

    const commandPath: CommandPath = {
        categories,
        moduleName: filename.replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, ""),
        ...(parent ? { parent } : {}),
        ...(group ? { group } : {}),
        ...(parentDefinition ? { parentDefinition: true as const } : {}),
        ...(groupDefinition ? { groupDefinition: true as const } : {}),
    };

    return {
        kind: groupDefinition
            ? ("group" as const)
            : parentDefinition
              ? ("parent" as const)
              : parent
                ? ("subcommand" as const)
                : ("command" as const),
        path: commandPath,
    };
};

/** Parses a module path relative to src/commands; rejects ignored barrels. */
export const parseCommandPath = (relativePath: string): CommandPath => {
    const classification = classifyCommandPath(relativePath);

    if (!classification) {
        throw new TypeError("Expected a command module filename.");
    }

    return classification.path;
};
