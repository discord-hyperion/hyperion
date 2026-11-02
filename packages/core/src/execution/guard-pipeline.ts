import type { Logger } from "pino";
import type { CommandContext } from "../commands/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";
import { resolve } from "../util/index.ts";

export type GuardResult<Context = CommandContext> =
    | { passed: true }
    | { passed: false; guard: Guard<Context> };

export class GuardPipeline {
    async run<Context extends { readonly logger: Logger }>(
        providers: readonly GuardProvider<Context>[],
        ctx: Context,
    ) {
        for (const provider of providers) {
            const guard = await resolve(provider, ctx);

            if (!(guard instanceof Guard) || typeof guard.run !== "function") {
                throw new TypeError(
                    "A guard provider must resolve to a Guard with a run() method.",
                );
            }

            const started = performance.now();

            ctx.logger.debug(
                { event: "guard.started", guard: guard.name },
                "Checking guard",
            );

            const passed = await guard.run(ctx);

            if (typeof passed !== "boolean") {
                throw new TypeError(
                    `Guard "${guard.name}" must return a boolean from run().`,
                );
            }

            ctx.logger[passed ? "debug" : "info"](
                {
                    event: passed ? "guard.passed" : "guard.rejected",
                    guard: guard.name,
                    durationMs: Math.round(performance.now() - started),
                },
                passed ? "Guard passed" : "Guard rejected command",
            );

            if (!passed)
                return {
                    passed: false as const,
                    guard,
                };
        }

        return { passed: true as const };
    }
}
