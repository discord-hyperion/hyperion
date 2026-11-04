import type {
    CommandInputDefinition,
    InputDefer,
} from "../commands/command-input.ts";

/**
 * Validate and snapshot configuration without evaluating application code.
 * `update` allows `defer: "update"`, which needs a message to update.
 */
export const validateInput = <Context, Defer extends InputDefer>(
    input: CommandInputDefinition<Context, Defer> | undefined,
    { update = false } = {},
): CommandInputDefinition<Context, Defer> | undefined => {
    if (input === undefined) return undefined;

    if (!input || typeof input !== "object") {
        throw new TypeError("Input requires a schema configuration.");
    }

    const standard = input.schema?.["~standard"];

    if (standard?.version !== 1 || typeof standard.validate !== "function") {
        throw new TypeError("Input must implement Standard Schema v1.");
    }

    if (input.defer === "update" && !update) {
        throw new TypeError(
            'Command input cannot defer with "update"; there is no message to update.',
        );
    }

    if (
        input.defer !== undefined &&
        typeof input.defer !== "boolean" &&
        input.defer !== "update"
    ) {
        throw new TypeError(
            update
                ? 'Input deferral must be a boolean or "update".'
                : "Input deferral must be a boolean.",
        );
    }

    if (input.resolve !== undefined && typeof input.resolve !== "function") {
        throw new TypeError("Input resolve must be a function.");
    }

    if ("resolvers" in input) {
        throw new TypeError(
            "Use input.resolve instead of per-option resolvers.",
        );
    }

    return Object.freeze({
        schema: input.schema,
        ...(input.resolve === undefined ? {} : { resolve: input.resolve }),
        // An omitted deferral is `false`, which every deferral mode includes.
        defer: input.defer ?? (false as Defer),
    });
};
