import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export interface ButtonContext extends InteractionContext<ButtonInteraction> {}

export interface ButtonOptions {
    builder: CustomIdButtonBuilder;
    guards?: readonly GuardProvider<ButtonContext>[];
}

export abstract class Button {
    public readonly builder: CustomIdButtonBuilder;
    public readonly customId: string;
    public readonly guards: readonly GuardProvider<ButtonContext>[];

    protected constructor(options: ButtonOptions) {
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
                    "Button guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    public abstract run(ctx: ButtonContext): Promise<void>;
}
