import assert from "node:assert/strict";
import { StringSelectMenuBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import {
    ActionRow,
    Button,
    Embed,
    Modal,
    renderComponents,
    renderEmbed,
    renderModal,
    StringSelect,
} from "@hyperion/jsx";
import {
    BaseInteraction,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    ComponentType,
    Events,
    type InteractionReplyOptions,
    InteractionType,
    type InteractionUpdateOptions,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
    TextInputStyle,
} from "discord.js";

// Establish Discord response compatibility from the public declaration exports.
const controls = renderComponents(
    <ActionRow>
        <Button customId="consumer.refresh" style="primary">
            Refresh
        </Button>
        <Button url="https://example.com">Open</Button>
    </ActionRow>,
);
const response: InteractionReplyOptions = {
    components: controls,
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
({ components: controls }) satisfies InteractionUpdateOptions;
const selectComponents = renderComponents(
    <ActionRow>
        <StringSelect customId="consumer.priority">
            <StringSelect.Option label="Low" value="low" />
        </StringSelect>
    </ActionRow>,
);
({ components: selectComponents }) satisfies InteractionReplyOptions;
({ components: selectComponents }) satisfies InteractionUpdateOptions;

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
    const buttonHandler = client.buttons.get("consumer.refresh");
    assert.ok(buttonHandler);
    assert.equal(buttonHandler.builder.toJSON().custom_id, "consumer.refresh");
    const updates: unknown[] = [];
    const click = {
        type: InteractionType.MessageComponent,
        componentType: ComponentType.Button,
        id: "consumer-click",
        guildId: null,
        user: { id: "consumer-user" },
        customId: "consumer.refresh",
        deferred: false,
        replied: false,
        isChatInputCommand: BaseInteraction.prototype.isChatInputCommand,
        isButton: BaseInteraction.prototype.isButton,
        async update(value: unknown) {
            updates.push(value);
        },
    };
    await new InteractionDispatcher(client).dispatch(
        click as unknown as ButtonInteraction,
    );
    assert.deepEqual(updates, [{ content: "Refreshed" }]);
    const selectHandler = client.selectMenus.get("consumer.priority");
    assert.ok(selectHandler?.builder instanceof StringSelectMenuBuilder);
    assert.equal(selectHandler.componentType, ComponentType.StringSelect);
    const selections: unknown[] = [];
    const selection = {
        type: InteractionType.MessageComponent,
        componentType: ComponentType.StringSelect,
        id: "consumer-select",
        guildId: null,
        user: { id: "consumer-user" },
        customId: "consumer.priority",
        deferred: false,
        replied: false,
        values: ["high"],
        isChatInputCommand: BaseInteraction.prototype.isChatInputCommand,
        isButton: BaseInteraction.prototype.isButton,
        isSelectMenu: BaseInteraction.prototype.isSelectMenu,
        async update(value: unknown) {
            selections.push(value);
        },
    };
    await new InteractionDispatcher(client).dispatch(
        selection as unknown as StringSelectMenuInteraction,
    );
    assert.deepEqual(selections, [{ content: "Priority: high" }]);

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
console.log(
    "PASS JSX button handler identity, exact-ID dispatch and reply/update types",
);
console.log(
    "PASS JSX string-select handler identity, dispatch and response types",
);
