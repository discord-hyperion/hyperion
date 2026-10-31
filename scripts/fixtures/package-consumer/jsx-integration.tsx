import assert from "node:assert/strict";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { Embed, Modal, renderEmbed, renderModal } from "@hyperion/jsx";
import {
    BaseInteraction,
    type ChatInputCommandInteraction,
    ComponentType,
    Events,
    type InteractionReplyOptions,
    InteractionType,
    type ModalSubmitInteraction,
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
    const replies: unknown[] = [];
    const submission = {
        type: InteractionType.ModalSubmit,
        customId: "consumer.modal",
        id: "consumer-submission",
        guildId: null,
        user: { id: "consumer-user" },
        deferred: false,
        replied: false,
        ephemeral: null,
        components: {
            data: [
                {
                    id: 1,
                    type: ComponentType.Label,
                    component: {
                        id: 2,
                        type: ComponentType.TextInput,
                        customId: "name",
                        value: "Typed todo",
                    },
                },
            ],
        },
        isChatInputCommand: BaseInteraction.prototype.isChatInputCommand,
        isButton: BaseInteraction.prototype.isButton,
        isSelectMenu: BaseInteraction.prototype.isSelectMenu,
        isModalSubmit: BaseInteraction.prototype.isModalSubmit,
        async reply(value: unknown) {
            replies.push(value);
        },
    };
    // The isolated consumer supplies only the SDK interaction surface it uses.
    await new InteractionDispatcher(client).dispatch(
        submission as unknown as ModalSubmitInteraction,
    );
    assert.deepEqual(replies, ["consumer-user: Typed todo"]);

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
    "PASS public modal response types, JSX discovery, and typed submission resolution through core",
);
