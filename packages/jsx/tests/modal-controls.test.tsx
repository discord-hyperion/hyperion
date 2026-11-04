import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import {
    ActionRow,
    Button,
    ChannelSelect,
    Container,
    JSXRenderError,
    MentionableSelect,
    Modal,
    RoleSelect,
    renderComponents,
    renderMessage,
    renderModal,
    StringSelect,
    UserSelect,
} from "../lib/index.ts";
import { jsx } from "../lib/jsx-runtime.ts";

const fails = (run: () => unknown, path: RegExp, message?: RegExp) =>
    assert.throws(run, error => {
        assert.ok(error instanceof JSXRenderError);
        assert.match(error.path, path);

        if (message) {
            assert.match(error.message, message);
        }

        return true;
    });

const form = (...controls: unknown[]) => (
    <Modal customId="ticket.create" title="New ticket">
        {controls.map((control, index) => (
            <Modal.Label key={index} text={`Field ${index}`}>
                {control as never}
            </Modal.Label>
        ))}
    </Modal>
);

test("entity selects render native builders with their defaults in a row", () => {
    const rows = renderComponents([
        <ActionRow>
            <UserSelect
                customId="assignee"
                placeholder="Pick someone"
                defaultUsers={["1"]}
                maxValues={2}
            />
        </ActionRow>,
        <ActionRow>
            <RoleSelect customId="roles" defaultRoles={["2"]} />
        </ActionRow>,
        <ActionRow>
            <MentionableSelect
                customId="notify"
                defaultUsers={["3"]}
                defaultRoles={["4"]}
            />
        </ActionRow>,
        <ActionRow>
            <ChannelSelect
                customId="channel"
                defaultChannels={["5"]}
                channelTypes={[0]}
                disabled
            />
        </ActionRow>,
    ]);
    const builders = rows.map(row => row.components[0]);
    const json = rows.map(row => row.toJSON().components[0]);

    assert.ok(builders[0] instanceof UserSelectMenuBuilder);
    assert.ok(builders[1] instanceof RoleSelectMenuBuilder);
    assert.ok(builders[2] instanceof MentionableSelectMenuBuilder);
    assert.ok(builders[3] instanceof ChannelSelectMenuBuilder);
    assert.deepEqual(json, [
        {
            type: 5,
            custom_id: "assignee",
            placeholder: "Pick someone",
            max_values: 2,
            default_values: [{ id: "1", type: "user" }],
        },
        {
            type: 6,
            custom_id: "roles",
            default_values: [{ id: "2", type: "role" }],
        },
        {
            type: 7,
            custom_id: "notify",
            default_values: [
                { id: "3", type: "user" },
                { id: "4", type: "role" },
            ],
        },
        {
            type: 8,
            custom_id: "channel",
            default_values: [{ id: "5", type: "channel" }],
            channel_types: [0],
            disabled: true,
        },
    ]);
});

test("message renders reject duplicate IDs, uploads, and malformed defaults", () => {
    fails(
        () =>
            renderComponents([
                <ActionRow>
                    <UserSelect customId="pick" />
                </ActionRow>,
                <ActionRow>
                    <Button customId="pick" style="primary">
                        Go
                    </Button>
                </ActionRow>,
            ]),
        /components\[1\]/,
        /Duplicate component custom ID/,
    );
    fails(
        () =>
            renderComponents(
                <ActionRow>
                    <Modal.FileUpload customId="files" />
                </ActionRow>,
            ),
        /components\[0\]\.children\[0\]/,
        /only appear in a modal Label/,
    );
    fails(
        () =>
            renderMessage(
                <Container>
                    <Modal.FileUpload customId="files" />
                </Container>,
            ),
        /Container/,
        /only appear in a modal Label/,
    );
    fails(
        () =>
            renderMessage(
                <Container>
                    <RoleSelect customId="roles" />
                </Container>,
            ),
        /Container/,
        /RoleSelect must be inside an ActionRow/,
    );
    fails(
        () =>
            renderComponents(
                <ActionRow>
                    {jsx(UserSelect, { customId: "pick", defaultUsers: [1] })}
                </ActionRow>,
            ),
        /UserSelect\.defaultUsers$/,
        /array of ID strings/,
    );
});

test("required passes through in messages, where Discord ignores it", () => {
    const [json] = renderComponents(
        <ActionRow>
            <UserSelect customId="pick" required={false} />
        </ActionRow>,
    ).map(row => row.toJSON().components[0] as { required?: boolean });

    assert.equal(json?.required, false);
});

test("modal labels hold every modal control", () => {
    const controlsOf = (view: ReturnType<typeof form>) =>
        renderModal(view)
            .toJSON()
            .components.map(
                // Every rendered child here is a label.
                label =>
                    (label as unknown as { component: Record<string, unknown> })
                        .component,
            );
    // A modal holds at most five components, so the controls use two forms.
    const first = controlsOf(
        form(
            <Modal.TextInput customId="title" />,
            <StringSelect customId="priority" required={false}>
                <StringSelect.Option label="Low" value="low" />
            </StringSelect>,
            <UserSelect customId="assignee" defaultUsers={["1"]} />,
            <RoleSelect customId="roles" />,
            <MentionableSelect customId="notify" />,
        ),
    );
    const second = controlsOf(
        form(
            <ChannelSelect customId="channel" channelTypes={[0]} />,
            <Modal.FileUpload
                customId="files"
                minValues={0}
                maxValues={3}
                required={false}
                fileTypes={["image", ".pdf"]}
            />,
        ),
    );

    assert.deepEqual(
        [...first, ...second].map(control => control.type),
        [4, 3, 5, 6, 7, 8, 19],
    );
    assert.equal(first[1]?.required, false);
    assert.deepEqual(second[1], {
        type: 19,
        custom_id: "files",
        min_values: 0,
        max_values: 3,
        required: false,
        file_types: ["image", ".pdf"],
    });
});

test("modal renders reject disabled selects, duplicate IDs, and extra controls", () => {
    fails(
        () => renderModal(form(<UserSelect customId="pick" disabled />)),
        /Modal\.children\[0\]\.Label\.UserSelect\.disabled$/,
        /Modals can't contain disabled components/,
    );
    fails(
        () =>
            renderModal(
                form(
                    <Modal.TextInput customId="same" />,
                    <Modal.FileUpload customId="same" />,
                ),
            ),
        /Modal\.children\[1\]\.Label\.FileUpload$/,
        /Duplicate control custom ID; first declared at Modal\.children\[0\]\.Label\.TextInput/,
    );
    fails(
        () =>
            renderModal(
                <Modal customId="ticket.create" title="New ticket">
                    <Modal.Label text="Two">
                        <RoleSelect customId="a" />
                        <RoleSelect customId="b" />
                    </Modal.Label>
                </Modal>,
            ),
        /Modal\.children\[0\]\.Label$/,
        /exactly one modal control/,
    );
    fails(
        () =>
            renderModal(
                form(
                    <Button customId="go" style="primary">
                        Go
                    </Button>,
                ),
            ),
        /Modal\.children\[0\]\.Label$/,
        /exactly one modal control/,
    );
});
