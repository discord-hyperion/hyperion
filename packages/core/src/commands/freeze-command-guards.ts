import { Guard, type GuardProvider } from "../guards/index.ts";
import type { CommandContext } from "./command.ts";

export const freezeCommandGuards = (
    providers: readonly GuardProvider<CommandContext>[] | undefined,
) => {
    const guards = Object.freeze([...(providers ?? [])]);

    for (const provider of guards) {
        if (typeof provider === "function") continue;
        if (
            !(provider instanceof Guard) ||
            typeof provider.run !== "function"
        ) {
            throw new TypeError(
                "Command guards must be Guard instances or guard factories.",
            );
        }
    }

    return guards;
};
