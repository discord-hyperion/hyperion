import type { CommandInputDefinition } from "./command-input.ts";

/** Validate configuration without evaluating schemas or application callbacks. */
export const validateCommandInput = (
    input: CommandInputDefinition | undefined,
    chatInput = true,
) => {
    if (input === undefined) return undefined;
    if (!chatInput) {
        throw new TypeError("Input schemas require a chat-input command.");
    }
    if (!input || typeof input !== "object") {
        throw new TypeError("Command input requires a schema configuration.");
    }

    const standard = input.schema?.["~standard"];
    if (standard?.version !== 1 || typeof standard.validate !== "function") {
        throw new TypeError("Command input must implement Standard Schema v1.");
    }
    if (input.defer !== undefined && typeof input.defer !== "boolean") {
        throw new TypeError("Input deferral must be a boolean.");
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
        defer: input.defer ?? false,
    });
};
