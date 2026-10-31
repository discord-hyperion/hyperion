import assert from "node:assert/strict";
import { HyperionClient } from "@hyperion/core";
import { Embed, Modal, renderEmbed, renderModal } from "@hyperion/jsx";
import {
    type ChatInputCommandInteraction,
    Events,
    type InteractionReplyOptions,
    TextInputStyle,
} from "discord.js";

// Establish Discord response compatibility from the public declaration exports.
const response: InteractionReplyOptions = {
    embeds: [
        renderEmbed(
            <Embed>
                <Embed.Title>Typed</Embed.Title>
            </Embed>,
        ),
    ],
};
const modalResponse: Parameters<ChatInputCommandInteraction["showModal"]>[0] =
    renderModal(
        <Modal customId="typed.modal" title="Typed modal">
            <Modal.Label text="Name">
                <Modal.TextInput customId="name" style={TextInputStyle.Short} />
            </Modal.Label>
        </Modal>,
    );
void modalResponse;
void response;
const failures: unknown[] = [];
const client = await HyperionClient.create({
    name: "JSX consumer",
    root: new URL("./jsx-handlers/", import.meta.url),
    discord: { intents: [] },
    logging: {
        pretty: false,
        destination: {
            write: line => {
                const record = JSON.parse(line);
                if (record.event === "event.failed") failures.push(record.err);
            },
        },
    },
});
try {
    await client.commands.load(new URL("./jsx-handlers/", import.meta.url));
    assert.equal(client.commands.parents.size, 1);
    const modal = client.modals.get("consumer.modal");
    assert.ok(modal);
    assert.equal(modal.builder.toJSON().custom_id, modal.customId);
    assert.ok(client.commands.resolveSubcommand("jsx", "show", "manage"));
    const calls: unknown[] = [];
    client.on("consumer:jsx", value => calls.push(value));
    client.emit(Events.Invalidated);
    await client.waitForAllListenersToComplete();
    assert.deepEqual(failures, []);
    assert.deepEqual(calls, ["2", "10"]);
    await client.events.load();
    assert.equal(client.listenerCount(Events.Invalidated), 1);
} finally {
    await client.destroy();
}
console.log(
    "PASS TSX/JSX command parent/group discovery, module names, event priorities and response types",
);
console.log(
    "PASS public modal response types and JSX-authored ModalBuilder discovery through core",
);
