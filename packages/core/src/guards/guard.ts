import type { CommandContext } from "../commands/index.ts";

declare const guardBrand: unique symbol;

/** What `defineGuard()` accepts. `run` and `onFail` receive only the context. */
export type GuardDefinition<Context = CommandContext> = {
    /** Shown in rejection logs. */
    readonly name: string;
    /** The default rejection reply. */
    readonly description: string;
    run(ctx: Context): boolean | Promise<boolean>;
    /** Owns the rejection response when present. */
    onFail?(ctx: Context): void | Promise<void>;
};

/** An execution check created by `defineGuard()`. */
export type Guard<Context = CommandContext> = Readonly<
    GuardDefinition<Context>
> & { readonly [guardBrand]: true };

/** Called once per invocation, only when execution reaches this guard. */
export type GuardFactory<Context = CommandContext> = (
    ctx: Context,
) => Guard<Context> | Promise<Guard<Context>>;

export type GuardProvider<Context = CommandContext> =
    | Guard<Context>
    | GuardFactory<Context>;

// Private so guards stay distinguishable from factories without a public class.
class DefinedGuard {
    readonly name: string;
    readonly description: string;
    readonly run: GuardDefinition<never>["run"];
    readonly onFail: GuardDefinition<never>["onFail"];

    constructor(definition: GuardDefinition<never>) {
        this.name = definition.name;
        this.description = definition.description;
        this.run = definition.run;
        this.onFail = definition.onFail;
    }
}

/** True for guards created by `defineGuard()`; false for factories and other values. */
export const isGuard = (value: unknown): value is Guard<never> =>
    value instanceof DefinedGuard;

/**
 * Define an execution check. Supply the context type as a generic or by
 * annotating `run`'s parameter; it defaults to the command context. Guards
 * that take arguments or hold state are closures that return a definition.
 */
export const defineGuard = <Context = CommandContext>(
    definition: GuardDefinition<Context>,
): Guard<Context> => {
    if (typeof definition?.name !== "string" || definition.name === "") {
        throw new TypeError("Guards require a non-empty name.");
    }
    if (typeof definition.description !== "string") {
        throw new TypeError(
            `Guard "${definition.name}" requires a description.`,
        );
    }
    if (typeof definition.run !== "function") {
        throw new TypeError(
            `Guard "${definition.name}" requires a run() function.`,
        );
    }
    if (
        definition.onFail !== undefined &&
        typeof definition.onFail !== "function"
    ) {
        throw new TypeError(
            `Guard "${definition.name}" onFail must be a function.`,
        );
    }

    // The brand exists only in types; the private class carries it at runtime.
    return Object.freeze(
        new DefinedGuard(definition as GuardDefinition<never>),
    ) as unknown as Guard<Context>;
};
