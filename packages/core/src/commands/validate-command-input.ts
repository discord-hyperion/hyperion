import { validateInput } from "../util/validate-input.ts";
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

    return validateInput(input);
};
