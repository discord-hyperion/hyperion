import type { CommandContext } from "../commands/index.ts";
import { Guard } from "./guard.ts";

export class OwnerOnly extends Guard {
    public constructor() {
        super({
            name: "owner-only",
            description: "This command can only be used by the bot's owners.",
        });
    }

    public override run(ctx: CommandContext): boolean {
        return ctx.client.ownerIds.includes(ctx.interaction.user.id);
    }
}
