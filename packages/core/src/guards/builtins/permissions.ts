import { type PermissionResolvable, PermissionsBitField } from "discord.js";
import type { InteractionContext } from "../../contexts/index.ts";
import { defineGuard } from "../guard.ts";

/** Rejects interactions from outside a server, such as DMs. */
export const guildOnly = defineGuard<InteractionContext>({
    name: "guild-only",
    description: "Use this in a server.",
    run: ctx => ctx.interaction.inGuild(),
});

// "ManageMessages" → "Manage Messages", joined as "A, B and C".
const describe = (permissions: Readonly<PermissionsBitField>) => {
    const names = permissions
        .toArray()
        .map(name => name.replace(/(?<=[a-z])(?=[A-Z])/g, " "));
    const last = names.pop();
    const list = names.length ? `${names.join(", ")} and ${last}` : last;

    return `the ${list} permission${names.length ? "s" : ""}`;
};

const required = (guard: string, permissions: PermissionResolvable[]) => {
    const bitfield = new PermissionsBitField(permissions).freeze();

    if (bitfield.bitfield === 0n) {
        throw new RangeError(`${guard}() needs at least one permission.`);
    }

    return bitfield;
};

/**
 * Rejects users who lack every given permission in the channel. Outside a
 * server there are no permissions, so it rejects there too.
 */
export const requirePermissions = (...permissions: PermissionResolvable[]) => {
    const needed = required("requirePermissions", permissions);

    return defineGuard<InteractionContext>({
        name: "require-permissions",
        description: `You need ${describe(needed)} to use this.`,
        run: ctx => ctx.interaction.memberPermissions?.has(needed) ?? false,
    });
};

/** Rejects when the bot lacks any of the given permissions in the channel. */
export const requireBotPermissions = (
    ...permissions: PermissionResolvable[]
) => {
    const needed = required("requireBotPermissions", permissions);

    return defineGuard<InteractionContext>({
        name: "require-bot-permissions",
        description: `I need ${describe(needed)} here.`,
        run: ctx => ctx.interaction.appPermissions?.has(needed) ?? false,
    });
};
