import type { Collection } from "discord.js";
import type { InteractionContext } from "../../contexts/index.ts";
import { defineGuard } from "../guard.ts";

export type CooldownOptions = {
    key: string;
    durationMs: number;
    /** Share this collection across invocations; values are expiry timestamps in milliseconds. */
    entries: Collection<string, number>;
};

/** Rejects while `key` is cooling down; the caller owns the shared `entries`. */
export const cooldown = ({ key, durationMs, entries }: CooldownOptions) => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new RangeError(
            "Cooldown durationMs must be a positive, finite number.",
        );
    }

    return defineGuard<InteractionContext>({
        name: "cooldown",
        description: "Please wait before using this interaction again.",
        run: () => {
            const now = Date.now();

            for (const [entry, expiresAt] of entries) {
                if (expiresAt <= now) {
                    entries.delete(entry);
                }
            }

            if (entries.has(key)) return false;

            entries.set(key, now + durationMs);

            return true;
        },
    });
};
