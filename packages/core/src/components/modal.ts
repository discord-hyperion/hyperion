import type { ModalBuilder } from "@discordjs/builders";
import type { ModalSubmitInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export interface ModalContext
    extends InteractionContext<ModalSubmitInteraction> {}

export interface ModalOptions {
    builder: ModalBuilder;
    guards?: readonly GuardProvider<ModalContext>[];
}

export abstract class Modal {
    readonly builder: ModalBuilder;
    readonly customId: string;
    readonly guards: readonly GuardProvider<ModalContext>[];

    protected constructor(options: ModalOptions) {
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
                    "Modal guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: ModalContext): Promise<void>;
}
