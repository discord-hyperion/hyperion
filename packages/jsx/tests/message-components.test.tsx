import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ActionRowBuilder,
    CustomIdButtonBuilder,
    DangerButtonBuilder,
    disableValidators,
    enableValidators,
    isValidationEnabled,
    LinkButtonBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    SuccessButtonBuilder,
} from "@discordjs/builders";
import {
    ActionRow,
    Bold,
    Button,
    type Child,
    JSXRenderError,
    Modal,
    renderButton,
    renderComponents,
} from "../lib/index.ts";
import { jsx } from "../lib/jsx-runtime.ts";

for (const [style, Builder, numeric] of [
    ["primary", PrimaryButtonBuilder, 1],
    ["secondary", SecondaryButtonBuilder, 2],
    ["success", SuccessButtonBuilder, 3],
    ["danger", DangerButtonBuilder, 4],
] as const) {
    test(`renders native ${style} buttons from string and enum styles`, () => {
        for (const value of [style, numeric]) {
            const result = renderButton(
                <Button customId="refresh" style={value}>
                    Refresh *literal*
                </Button>,
            );
            assert.ok(result instanceof Builder);
            assert.ok(result instanceof CustomIdButtonBuilder);
            assert.deepEqual(
                result.toJSON(),
                new Builder()
                    .setCustomId("refresh")
                    .setLabel("Refresh *literal*")
                    .toJSON(),
            );
        }
    });
}

test("rows combine interactive/link buttons with literal URLs and native emoji objects", () => {
    const rows = renderComponents(
        <ActionRow>
            <Button customId="done" style="success" emoji={{ name: "✅" }} />
            <Button
                url="discord://example"
                disabled={false}
                emoji={{ id: "123456789012345678", animated: true }}
            >
                Open
            </Button>
        </ActionRow>,
    );
    assert.ok(rows[0] instanceof ActionRowBuilder);
    assert.deepEqual(
        rows[0].toJSON(),
        new ActionRowBuilder()
            .addComponents(
                new SuccessButtonBuilder()
                    .setCustomId("done")
                    .setEmoji({ name: "✅" }),
                new LinkButtonBuilder()
                    .setURL("discord://example")
                    .setDisabled(false)
                    .setEmoji({ id: "123456789012345678", animated: true })
                    .setLabel("Open"),
            )
            .toJSON(),
    );
});

test("reusable components, fragments, arrays, labels and keys evaluate once per render", () => {
    let evaluations = 0;
    const Label = () => {
        evaluations++;
        return (
            <>
                Todo {0}
                {false}
                {null}
            </>
        );
    };
    const Rows = () => (
        <>
            {["a", "b"].map(id => (
                <ActionRow key={id}>
                    <Button customId={id} style="primary">
                        <Label />
                    </Button>
                </ActionRow>
            ))}
        </>
    );
    const tree = <Rows />;
    assert.equal(evaluations, 0);
    const first = renderComponents(tree);
    const second = renderComponents(tree);
    assert.equal(evaluations, 4);
    const firstData = first[0]?.toJSON().components[0];
    assert.ok(firstData && "label" in firstData);
    assert.equal(firstData.label, "Todo 0");
    assert.notEqual(first[0], second[0]);
    assert.notEqual(first[0]?.components[0], second[0]?.components[0]);
    const button = first[0]?.components[0];
    assert.ok(button instanceof CustomIdButtonBuilder);
    button.setLabel("Changed");
    const secondData = second[0]?.toJSON().components[0];
    assert.ok(secondData && "label" in secondData);
    assert.equal(secondData.label, "Todo 0");
});

test("empty roots support clearing controls, but empty rows fail native validation", () => {
    assert.deepEqual(
        renderComponents(
            <>
                {null}
                {false}
                {[]}
            </>,
        ),
        [],
    );
    assert.throws(() => renderComponents(<ActionRow />), JSXRenderError);
    assert.throws(() => renderButton(null), JSXRenderError);
    assert.throws(
        () =>
            renderButton([
                <Button customId="a" style="primary">
                    A
                </Button>,
                <Button customId="b" style="primary">
                    B
                </Button>,
            ]),
        JSXRenderError,
    );
});

test("only undefined disabled values omit the setter; explicit false and true survive", () => {
    for (const disabled of [undefined, false, true]) {
        const result = renderButton(
            <Button customId="a" style="primary" disabled={disabled}>
                A
            </Button>,
        ).toJSON();
        assert.equal(result.disabled, disabled);
    }
    assert.throws(
        () =>
            renderButton(
                jsx(Button, {
                    customId: "a",
                    style: "primary",
                    disabled: null,
                    children: "A",
                }),
            ),
        JSXRenderError,
    );
});

test("duplicate IDs identify both paths without echoing the ID, and separate renders can reuse IDs", () => {
    const tree = (
        <ActionRow>
            <Button customId="private-route" style="primary">
                A
            </Button>
        </ActionRow>
    );
    assert.throws(
        () => renderComponents([tree, tree]),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.match(error.message, /components\[0\].children\[0\]/);
            assert.match(error.message, /components\[1\].children\[0\]/);
            assert.ok(!error.message.includes("private-route"));
            return true;
        },
    );
    assert.deepEqual(
        renderComponents(tree)[0]?.toJSON(),
        renderComponents(tree)[0]?.toJSON(),
    );
});

for (const [name, view] of [
    [
        "bare button",
        <Button customId="a" style="primary">
            A
        </Button>,
    ],
    ["bare text", "private text"],
    [
        "nested row",
        <ActionRow>
            <ActionRow />
        </ActionRow>,
    ],
    ["row text", <ActionRow>private text</ActionRow>],
    [
        "modal control",
        <ActionRow>
            <Modal.TextInput customId="a" />
        </ActionRow>,
    ],
    [
        "formatted label",
        <ActionRow>
            <Button customId="a" style="primary">
                <Bold>Private</Bold>
            </Button>
        </ActionRow>,
    ],
    ["builder", new ActionRowBuilder()],
    ["promise", Promise.resolve(null)],
] as const) {
    test(`rejects ${name} without leaking supplied text`, () => {
        assert.throws(
            () => renderComponents(view as Child),
            error => {
                assert.ok(error instanceof JSXRenderError);
                assert.ok(!error.message.includes("private text"));
                return true;
            },
        );
    });
}

for (const props of [
    { url: "https://example.com", customId: "a" },
    { url: "https://example.com", style: "primary" },
    { customId: "a" },
    { style: "primary" },
    { customId: "a", style: 6 },
    { customId: "a", style: "primary", id: 1 },
    { customId: "a", style: "primary", onClick: () => {} },
    { customId: "a", style: "primary", label: "A" },
]) {
    test(`rejects invalid button props ${Object.keys(props).join(",")}`, () => {
        assert.throws(
            () =>
                renderComponents(
                    <ActionRow>
                        {jsx(Button, { ...props, children: "A" })}
                    </ActionRow>,
                ),
            JSXRenderError,
        );
    });
}

test("standalone rendering rejects link buttons", () => {
    assert.throws(
        () => renderButton(<Button url="https://example.com">Open</Button>),
        /only interactive/,
    );
});

test("native constraints retain causes and structural paths", () => {
    for (const view of [
        <Button customId="" style="primary">
            A
        </Button>,
        <Button customId="a" style="primary">
            {"x".repeat(81)}
        </Button>,
        <Button customId="a" style="primary" />,
        <Button url="ftp://example.com">Open</Button>,
        <Button customId="a" style="primary" emoji={{}} />,
    ]) {
        assert.throws(
            () => renderComponents(<ActionRow>{view}</ActionRow>),
            error => {
                assert.ok(error instanceof JSXRenderError);
                assert.ok(error.cause instanceof Error);
                assert.match(error.path, /components\[0\]/);
                return true;
            },
        );
    }
    assert.throws(
        () =>
            renderComponents(
                <ActionRow>
                    {Array.from({ length: 6 }, (_, i) => (
                        <Button customId={String(i)} style="primary">
                            A
                        </Button>
                    ))}
                </ActionRow>,
            ),
        JSXRenderError,
    );
});

test("native validators can be disabled while JSX structure and duplicate rules remain active", () => {
    const enabled = isValidationEnabled();
    disableValidators();
    try {
        assert.equal(renderComponents(<ActionRow />).length, 1);
        assert.equal(
            renderButton(<Button customId="" style="primary" />).toJSON()
                .custom_id,
            "",
        );
        assert.throws(
            () =>
                renderComponents(
                    <Button customId="a" style="primary">
                        A
                    </Button>,
                ),
            JSXRenderError,
        );
        const row = (
            <ActionRow>
                <Button customId="same" style="primary">
                    A
                </Button>
            </ActionRow>
        );
        assert.throws(() => renderComponents([row, row]), /Duplicate/);
        assert.throws(
            () => renderButton(jsx(Button, { customId: "a", children: "A" })),
            JSXRenderError,
        );
    } finally {
        if (enabled) enableValidators();
    }
});

test("renderComponents leaves aggregate message limits to its caller", () => {
    const rows = renderComponents(
        Array.from({ length: 6 }, (_, i) => (
            <ActionRow>
                <Button customId={String(i)} style="primary">
                    A
                </Button>
            </ActionRow>
        )),
    );
    assert.equal(rows.length, 6);
});

test("rendered emoji data is independent of application objects and later renders", () => {
    const emoji = { name: "✅" };
    const tree = <Button customId="done" style="success" emoji={emoji} />;
    const first = renderButton(tree);
    emoji.name = "🔄";
    const second = renderButton(tree);
    assert.deepEqual(first.toJSON().emoji, { name: "✅" });
    assert.deepEqual(second.toJSON().emoji, { name: "🔄" });
    assert.equal(Object.isFrozen(emoji), false);
});
