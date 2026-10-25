import type { InteractionContext } from "../../contexts/index.ts";
import { Guard } from "../guard.ts";

export interface CooldownOptions {
    key: string;
    durationMs: number;
    /** Share this collection across invocations; values are expiry timestamps in milliseconds. */
    entries: Collection<string, number>;
}

export class Cooldown extends Guard<InteractionContext> {
    private readonly key: string;
    private readonly durationMs: number;
    private readonly entries: Collection<string, number>;

    constructor(options: CooldownOptions) {
        super({
            name: "cooldown",
            description: "Please wait before using this interaction again.",
        });

        if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) {
            throw new RangeError(
                "Cooldown durationMs must be a positive, finite number.",
            );
        }

        this.key = options.key;
        this.durationMs = options.durationMs;
        this.entries = options.entries;
    }

    run() {
        const now = Date.now();

        for (const [key, expiresAt] of this.entries) {
            if (expiresAt <= now) this.entries.delete(key);
        }

        if (this.entries.has(this.key)) return false;

        this.entries.set(this.key, now + this.durationMs);

        return true;
    }
}

import type { Collection } from "discord.js";
