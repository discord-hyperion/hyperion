import type { CommandContext } from "../commands/index.ts";

export interface GuardOptions {
    name?: string;
    description: string;
}

export abstract class Guard<Context = CommandContext> {
    public readonly name: string;
    public readonly description: string;

    protected constructor(options: GuardOptions) {
        this.name = options.name ?? this.constructor.name;
        this.description = options.description;
    }

    public abstract run(ctx: Context): boolean | Promise<boolean>;

    public onFail?(ctx: Context): void | Promise<void>;
}

/** Called once per invocation, only when execution reaches this guard. */
export type GuardFactory<Context = CommandContext> = (
    ctx: Context,
) => Guard<Context> | Promise<Guard<Context>>;

export type GuardProvider<Context = CommandContext> =
    | Guard<Context>
    | GuardFactory<Context>;
