import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ChannelType } from "discord.js";
import {
    ActionRow,
    ChannelSelect,
    type Child,
    JSXRenderError,
    MentionableSelect,
    RoleSelect,
    renderChannelSelect,
    renderComponents,
    renderMentionableSelect,
    renderRoleSelect,
    renderUserSelect,
    StringSelect,
    UserSelect,
} from "../lib/index.ts";

const fails = (run: () => unknown, path: RegExp, native = false) =>
    assert.throws(run, error => {
        assert.ok(error instanceof JSXRenderError);
        assert.match(error.message, path);

        if (native) {
            assert.ok(error.cause instanceof Error);
        }

        return true;
    });

test("renders each entity select as its own native builder with defaults", () => {
    const user = renderUserSelect(
        <UserSelect
            customId="user"
            placeholder="Pick"
            minValues={1}
            maxValues={2}
            disabled={false}
            defaultUsers={["1", "2"]}
        />,
    );
    assert.ok(user instanceof UserSelectMenuBuilder);
    assert.deepEqual(user.toJSON(), {
        type: 5,
        custom_id: "user",
        placeholder: "Pick",
        min_values: 1,
        max_values: 2,
        disabled: false,
        default_values: [
            { id: "1", type: "user" },
            { id: "2", type: "user" },
        ],
    });

    const role = renderRoleSelect(
        <RoleSelect customId="role" defaultRoles={["3"]} />,
    );
    assert.ok(role instanceof RoleSelectMenuBuilder);
    assert.deepEqual(role.toJSON().default_values, [{ id: "3", type: "role" }]);

    const mentionable = renderMentionableSelect(
        <MentionableSelect
            customId="mentionable"
            maxValues={2}
            defaultUsers={["1"]}
            defaultRoles={["3"]}
        />,
    );
    assert.ok(mentionable instanceof MentionableSelectMenuBuilder);
    assert.deepEqual(mentionable.toJSON().default_values, [
        { id: "1", type: "user" },
        { id: "3", type: "role" },
    ]);

    const channels = [ChannelType.GuildText];
    const channel = renderChannelSelect(
        <ChannelSelect
            customId="channel"
            channelTypes={channels}
            defaultChannels={["4"]}
        />,
    );
    channels.push(ChannelType.GuildVoice);
    assert.ok(channel instanceof ChannelSelectMenuBuilder);
    assert.deepEqual(channel.toJSON().channel_types, [ChannelType.GuildText]);
    assert.deepEqual(channel.toJSON().default_values, [
        { id: "4", type: "channel" },
    ]);
});

test("matches the select rendered inside a row", () => {
    const view = <UserSelect customId="user" defaultUsers={["1"]} />;
    const [row] = renderComponents(<ActionRow>{view}</ActionRow>);
    assert.deepEqual(
        renderUserSelect(view).toJSON(),
        row?.toJSON().components[0],
    );
    assert.notEqual(renderUserSelect(view), renderUserSelect(view));
});

test("passes required through, since Discord ignores it in messages", () => {
    const menu = renderRoleSelect(<RoleSelect customId="role" required />);
    assert.equal(menu.toJSON().required, true);
});

const renderers = [
    ["UserSelect", renderUserSelect, <UserSelect customId="id" />],
    ["RoleSelect", renderRoleSelect, <RoleSelect customId="id" />],
    [
        "MentionableSelect",
        renderMentionableSelect,
        <MentionableSelect customId="id" />,
    ],
    ["ChannelSelect", renderChannelSelect, <ChannelSelect customId="id" />],
] as const;

for (const [name, render, view] of renderers) {
    for (const [label, root] of [
        ["empty root", null],
        ["multiple roots", [view, view]],
        ["row root", <ActionRow>{view}</ActionRow>],
        ["bare text", "private text"],
        [
            "string select",
            <StringSelect customId="id">
                <StringSelect.Option label="Low" value="low" />
            </StringSelect>,
        ],
    ] as [string, Child][]) {
        test(`${name}: rejects ${label}`, () => {
            assert.throws(
                () => render(root),
                error => {
                    assert.ok(error instanceof JSXRenderError);
                    assert.equal(error.path, "root");
                    assert.match(
                        error.message,
                        new RegExp(`Expected exactly one ${name}\\.`),
                    );
                    assert.ok(!error.message.includes("private"));

                    return true;
                },
            );
        });
    }
}

test("rejects another entity select at the root", () => {
    fails(
        () => renderUserSelect(<RoleSelect customId="role" />),
        /Expected exactly one UserSelect\./,
    );
    fails(
        () => renderChannelSelect(<UserSelect customId="user" />),
        /Expected exactly one ChannelSelect\./,
    );
});

test("reports invalid defaults at the prop path", () => {
    fails(
        () =>
            renderUserSelect(
                <UserSelect
                    customId="user"
                    defaultUsers={[1] as unknown as string[]}
                />,
            ),
        /UserSelect\.defaultUsers/,
    );
});

test("native validation failures name the select", () => {
    fails(
        () => renderUserSelect(<UserSelect customId="user" maxValues={30} />),
        /UserSelect/,
        true,
    );
});
