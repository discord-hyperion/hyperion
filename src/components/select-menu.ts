import type { StringSelectMenuBuilder } from "@discordjs/builders";
import type { StringSelectMenuInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export interface SelectMenuContext
    extends InteractionContext<StringSelectMenuInteraction> {}

export interface SelectMenuOptions {
    builder: StringSelectMenuBuilder;
    guards?: readonly GuardProvider<SelectMenuContext>[];
}

export abstract class SelectMenu {
    public readonly builder: StringSelectMenuBuilder;
    public readonly customId: string;
    public readonly guards: readonly GuardProvider<SelectMenuContext>[];

    protected constructor(options: SelectMenuOptions) {
        this.builder = options.builder;
        this.customId = this.builder.toJSON(false).custom_id;
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Select menu guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    public abstract run(ctx: SelectMenuContext): Promise<void>;
}
