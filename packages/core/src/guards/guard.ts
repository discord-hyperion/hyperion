import type { CommandContext } from "../commands/index.ts";

export type GuardOptions = {
    name?: string;
    description: string;
};

export abstract class Guard<Context = CommandContext> {
    readonly name: string;
    readonly description: string;

    protected constructor(options: GuardOptions) {
        this.name = options.name ?? this.constructor.name;
        this.description = options.description;
    }

    abstract run(ctx: Context): boolean | Promise<boolean>;

    onFail?(ctx: Context): void | Promise<void>;
}

/** Called once per invocation, only when execution reaches this guard. */
export type GuardFactory<Context = CommandContext> = (
    ctx: Context,
) => Guard<Context> | Promise<Guard<Context>>;

export type GuardProvider<Context = CommandContext> =
    | Guard<Context>
    | GuardFactory<Context>;
