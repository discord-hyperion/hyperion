import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import type { CommandContext } from "./command.ts";

export const freezeCommandGuards = (
    providers: readonly GuardProvider<CommandContext>[] | undefined,
) => {
    const guards = Object.freeze([...(providers ?? [])]);

    for (const provider of guards) {
        if (typeof provider === "function") continue;

        if (!isGuard(provider)) {
            throw new TypeError(
                "Command guards must be guards from defineGuard() or guard factories.",
            );
        }
    }

    return guards;
};
