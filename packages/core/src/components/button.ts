import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export type ButtonContext = InteractionContext<ButtonInteraction>;

export type ButtonOptions = {
    builder: CustomIdButtonBuilder;
    guards?: readonly GuardProvider<ButtonContext>[];
};

export abstract class Button {
    readonly builder: CustomIdButtonBuilder;
    readonly customId: string;
    readonly guards: readonly GuardProvider<ButtonContext>[];

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

    abstract run(ctx: ButtonContext): Promise<void>;
}
