import assert from "node:assert/strict";
import {
    ChatInputCommandBuilder,
    ModalBuilder,
    PrimaryButtonBuilder,
} from "@discordjs/builders";
import {
    Button,
    Command,
    CommandRegistry,
    HyperionClient,
    Modal,
} from "@hyperion/core";
import { Client } from "discord.js";

class ExampleButton extends Button {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder()
                .setCustomId("button")
                .setLabel("Button"),
        });
    }
    async run() {}
}
class ExampleModal extends Modal {
    constructor() {
        super({
            builder: new ModalBuilder().setCustomId("modal").setTitle("Modal"),
        });
    }
    async run() {}
}
assert.ok(new ExampleButton().builder instanceof PrimaryButtonBuilder);
assert.ok(new ExampleModal().builder instanceof ModalBuilder);
assert.ok(HyperionClient.prototype instanceof Client);
const registry = new CommandRegistry();
await registry.load(new URL("./handlers/", import.meta.url));
const command = registry.resolve("ping");
assert.ok(command instanceof Command);
assert.ok(command.builder instanceof ChatInputCommandBuilder);
console.log(
    "public imports, discovered Command, command/button/modal builders, Discord Client identity: PASS",
);
