import assert from "node:assert/strict";
import {
    ChatInputCommandBuilder,
    ModalBuilder,
    PrimaryButtonBuilder,
} from "@discordjs/builders";
import {
    ButtonHandler,
    Command,
    CommandRegistry,
    HyperionClient,
    ModalHandler,
} from "@hyperion/core";
import { Client, Events } from "discord.js";

class ExampleButton extends ButtonHandler {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder()
                .setCustomId("button")
                .setLabel("Button"),
        });
    }
    async run() {}
}
class ExampleModal extends ModalHandler {
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

const client = await HyperionClient.create({
    name: "Consumer",
    root: new URL("./handlers/", import.meta.url),
    discord: { intents: [] },
    logging: false,
});

try {
    const calls = [];
    client.on("consumer:event", (label, count) => calls.push([label, count]));
    client.emit(Events.Invalidated);
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, [
        ["first", 0],
        ["second", 0],
    ]);
    assert.equal(client.events.size, 2);
    await client.events.load();
    assert.equal(client.listenerCount(Events.Invalidated), 1);
} finally {
    await client.destroy();
}
assert.equal(client.listenerCount(Events.Invalidated), 0);
console.log(
    "public event exports, discovery, ordered execution, reload and cleanup: PASS",
);
