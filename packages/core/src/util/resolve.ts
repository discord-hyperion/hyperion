/** Resolves a value or invokes its factory, aka functions */
export const resolve = async <Value, Context>(
    provider: Value | ((ctx: Context) => Value | Promise<Value>),
    ctx: Context,
): Promise<Value> =>
    typeof provider === "function"
        ? await (provider as (ctx: Context) => Value | Promise<Value>)(ctx)
        : provider;
