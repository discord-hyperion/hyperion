import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ActionRowBuilder,
    disableValidators,
    enableValidators,
    isValidationEnabled,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "@discordjs/builders";
import {
    ActionRow,
    Bold,
    Button,
    type Child,
    JSXRenderError,
    Modal,
    renderComponents,
    renderStringSelect,
    StringSelect,
} from "../lib/index.ts";
import { jsx } from "../lib/jsx-runtime.ts";

const option = (value = "low") => (
    <StringSelect.Option label={value} value={value} />
);
const menu = (children: Child = option(), customId = "priority") => (
    <StringSelect customId={customId}>{children}</StringSelect>
);

const fails = (run: () => unknown, native = false) =>
    assert.throws(run, error => {
        assert.ok(error instanceof JSXRenderError);
        if (native) assert.ok(error.cause instanceof Error);
        return true;
    });

test("renders native single/multiple string selects with literal option metadata", () => {
    const actual = renderStringSelect(
        <StringSelect
            customId="priority"
            placeholder="Choose *priority*"
            minValues={0}
            maxValues={2}
            disabled={false}
        >
            <StringSelect.Option
                label="Low *literal*"
                value="low"
                description="No escaping _here_"
                default={false}
                emoji={{ name: "✅" }}
            />
            <StringSelect.Option
                label="High"
                value="high"
                default
                emoji={{ id: "123456789012345678", animated: true }}
            />
        </StringSelect>,
    );
    const expected = new StringSelectMenuBuilder()
        .setCustomId("priority")
        .setPlaceholder("Choose *priority*")
        .setMinValues(0)
        .setMaxValues(2)
        .setDisabled(false)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel("Low *literal*")
                .setValue("low")
                .setDescription("No escaping _here_")
                .setDefault(false)
                .setEmoji({ name: "✅" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("High")
                .setValue("high")
                .setDefault(true)
                .setEmoji({ id: "123456789012345678", animated: true }),
        );
    assert.ok(actual instanceof StringSelectMenuBuilder);
    assert.deepEqual(actual.toJSON(), expected.toJSON());
    const rows = renderComponents(<ActionRow>{menu()}</ActionRow>);
    assert.ok(rows[0] instanceof ActionRowBuilder);
    assert.ok(rows[0].components[0] instanceof StringSelectMenuBuilder);
});

test("omitted and undefined props preserve native omissions, false values and zero", () => {
    for (const flag of [undefined, false, true]) {
        const actual = renderStringSelect(
            <StringSelect
                customId="priority"
                disabled={flag}
                placeholder={undefined}
                minValues={undefined}
                maxValues={undefined}
            >
                <StringSelect.Option
                    label="Low"
                    value="low"
                    default={flag}
                    description={undefined}
                    emoji={undefined}
                />
            </StringSelect>,
        ).toJSON();
        assert.equal(actual.disabled, flag);
        assert.equal(actual.options[0]?.default, flag);
        assert.equal(Object.hasOwn(actual, "placeholder"), false);
        assert.equal(Object.hasOwn(actual, "min_values"), false);
        assert.equal(Object.hasOwn(actual, "max_values"), false);
        assert.equal(
            Object.hasOwn(actual.options[0] ?? {}, "description"),
            false,
        );
    }
    const zero = renderStringSelect(
        <StringSelect customId="priority" minValues={0} placeholder="">
            {option()}
        </StringSelect>,
    ).toJSON();
    assert.equal(zero.min_values, 0);
    assert.equal(zero.placeholder, "");
});

test("components/options evaluate once per render and retain mapped option order", () => {
    let calls = 0;
    const Options = () => {
        calls++;
        return (
            <>
                {["high", "low"].map(value => (
                    <StringSelect.Option
                        key={value}
                        label={value}
                        value={value}
                    />
                ))}
                {false}
                {null}
                {[]}
            </>
        );
    };
    const View = () => (
        <StringSelect customId="priority">
            <Options />
        </StringSelect>
    );
    const tree = <View />;
    assert.equal(calls, 0);
    const first = renderStringSelect(tree);
    const second = renderStringSelect(tree);
    assert.equal(calls, 2);
    assert.deepEqual(
        first.toJSON().options.map(value => value.value),
        ["high", "low"],
    );
    assert.notEqual(first, second);
    assert.notEqual(first.options[0], second.options[0]);
    first.options[0]?.setLabel("Changed");
    assert.equal(second.options[0]?.toJSON().label, "high");
});

test("emoji data is independent of application objects and later renders", () => {
    const emoji = { name: "✅" };
    const tree = menu(
        <StringSelect.Option label="Low" value="low" emoji={emoji} />,
    );
    const first = renderStringSelect(tree);
    emoji.name = "🔄";
    const second = renderStringSelect(tree);
    assert.deepEqual(first.options[0]?.toJSON().emoji, { name: "✅" });
    assert.deepEqual(second.options[0]?.toJSON().emoji, { name: "🔄" });
    assert.equal(Object.isFrozen(emoji), false);
});

test("duplicate option values show both paths without echoing supplied data", () => {
    fails(() =>
        renderStringSelect(
            menu([option("private-value"), option("private-value")]),
        ),
    );
    assert.throws(
        () =>
            renderStringSelect(
                menu([option("private-value"), option("private-value")]),
            ),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.match(error.message, /options\[0\]/);
            assert.match(error.message, /options\[1\]/);
            assert.ok(!error.message.includes("private-value"));
            return true;
        },
    );
    const rows = renderComponents([
        <ActionRow>{menu(option("low"), "first")}</ActionRow>,
        <ActionRow>{menu(option("low"), "second")}</ActionRow>,
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(
        renderStringSelect(menu()).toJSON(),
        renderStringSelect(menu()).toJSON(),
    );
});

for (const order of ["button-first", "select-first"] as const) {
    test(`duplicate IDs span buttons and selects: ${order}`, () => {
        const button = (
            <ActionRow>
                <Button customId="private-id" style="primary">
                    Button
                </Button>
            </ActionRow>
        );
        const select = <ActionRow>{menu(option(), "private-id")}</ActionRow>;
        assert.throws(
            () =>
                renderComponents(
                    order === "button-first"
                        ? [button, select]
                        : [select, button],
                ),
            error => {
                assert.ok(error instanceof JSXRenderError);
                assert.match(error.message, /components\[0\]/);
                assert.match(error.message, /components\[1\]/);
                assert.ok(!error.message.includes("private-id"));
                return true;
            },
        );
    });
}

test("duplicate menu IDs are rejected while separate renders may reuse them", () => {
    const row = <ActionRow>{menu()}</ActionRow>;
    fails(() => renderComponents([row, row]));
    assert.deepEqual(
        renderComponents(row)[0]?.toJSON(),
        renderComponents(row)[0]?.toJSON(),
    );
});

for (const [name, view] of [
    ["empty root", null],
    ["multiple roots", [menu(), menu()]],
    ["wrong root", option()],
    ["row root", <ActionRow>{menu()}</ActionRow>],
    ["bare text", "private text"],
    ["menu text", menu("private text")],
    ["menu number", menu(0)],
    ["nested menu", menu(menu())],
    ["nested row", menu(<ActionRow />)],
    [
        "button option",
        menu(
            <Button customId="a" style="primary">
                A
            </Button>,
        ),
    ],
    ["formatting option", menu(<Bold>Private text</Bold>)],
    ["modal control", menu(<Modal.TextInput customId="a" />)],
    [
        "option children",
        menu(
            jsx(StringSelect.Option, {
                label: "Low",
                value: "low",
                children: "private text",
            }),
        ),
    ],
    [
        "option builder",
        menu(new StringSelectMenuOptionBuilder() as unknown as Child),
    ],
    ["menu builder", new StringSelectMenuBuilder() as unknown as Child],
    ["promise", Promise.resolve(null) as unknown as Child],
] as const) {
    test(`rejects ${name} with structural context`, () => {
        assert.throws(
            () => renderStringSelect(view),
            error => {
                assert.ok(error instanceof JSXRenderError);
                assert.ok(!error.message.includes("private text"));
                return true;
            },
        );
    });
}

test("bare menus and options need explicit rows in message rendering", () => {
    fails(() => renderComponents(menu()));
    fails(() => renderComponents(option()));
    fails(() => renderComponents(<ActionRow>{option()}</ActionRow>));
    assert.deepEqual(renderComponents(null), []);
});

for (const prop of ["required", "id", "options", "onSelect"]) {
    test(`rejects unsupported menu prop ${prop}`, () => {
        fails(() =>
            renderStringSelect(
                jsx(StringSelect, {
                    customId: "priority",
                    children: option(),
                    [prop]: true,
                }),
            ),
        );
    });
}

for (const [name, view] of [
    ["empty menu", <StringSelect customId="priority" />],
    [
        "too many options",
        menu(Array.from({ length: 26 }, (_, i) => option(String(i)))),
    ],
    ["empty ID", menu(option(), "")],
    [
        "long label",
        menu(<StringSelect.Option label={"x".repeat(101)} value="low" />),
    ],
    ["empty label", menu(<StringSelect.Option label="" value="low" />)],
    ["empty value", menu(<StringSelect.Option label="Low" value="" />)],
    [
        "empty description",
        menu(<StringSelect.Option label="Low" value="low" description="" />),
    ],
    [
        "invalid emoji",
        menu(<StringSelect.Option label="Low" value="low" emoji={{}} />),
    ],
    [
        "invalid minimum",
        <StringSelect customId="priority" minValues={-1}>
            {option()}
        </StringSelect>,
    ],
    [
        "invalid maximum",
        <StringSelect customId="priority" maxValues={0}>
            {option()}
        </StringSelect>,
    ],
    [
        "minimum exceeds options",
        <StringSelect customId="priority" minValues={2}>
            {option()}
        </StringSelect>,
    ],
    [
        "minimum exceeds maximum",
        <StringSelect customId="priority" minValues={2} maxValues={1}>
            {[option("low"), option("high")]}
        </StringSelect>,
    ],
    [
        "long placeholder",
        <StringSelect customId="priority" placeholder={"x".repeat(151)}>
            {option()}
        </StringSelect>,
    ],
    [
        "null disabled",
        jsx(StringSelect, {
            customId: "priority",
            disabled: null,
            children: option(),
        }),
    ],
    [
        "null default",
        menu(
            jsx(StringSelect.Option, {
                label: "Low",
                value: "low",
                default: null,
            }),
        ),
    ],
] as const) {
    test(`delegates ${name} to native validation with original causes`, () => {
        fails(() => renderStringSelect(view), true);
    });
}

test("metadata rejects non-string values rather than coercing them", () => {
    for (const prop of ["label", "value", "description"]) {
        fails(() =>
            renderStringSelect(
                menu(
                    jsx(StringSelect.Option, {
                        label: "Low",
                        value: "low",
                        [prop]: null,
                    }),
                ),
            ),
        );
    }
    fails(() =>
        renderStringSelect(
            jsx(StringSelect, {
                customId: "priority",
                placeholder: null,
                children: option(),
            }),
        ),
    );
});

test("native validation owns row cardinality and mixing constraints", () => {
    fails(
        () =>
            renderComponents(
                <ActionRow>
                    {menu()}
                    {menu(option(), "other")}
                </ActionRow>,
            ),
        true,
    );
    fails(
        () =>
            renderComponents(
                <ActionRow>
                    {menu()}
                    <Button customId="button" style="primary">
                        A
                    </Button>
                </ActionRow>,
            ),
        true,
    );
});

test("does not introduce extra native-schema rules for fractional/default/count gaps", () => {
    const data = renderStringSelect(
        <StringSelect customId="priority" minValues={0.5} maxValues={1.5}>
            <StringSelect.Option label="Low" value="low" default />
            <StringSelect.Option label="High" value="high" default />
        </StringSelect>,
    ).toJSON();
    assert.equal(data.min_values, 0.5);
    assert.equal(data.max_values, 1.5);
    assert.equal(data.options.filter(option => option.default).length, 2);
    assert.equal(
        renderStringSelect(
            <StringSelect customId="priority" maxValues={25}>
                {option()}
            </StringSelect>,
        ).toJSON().max_values,
        25,
    );
});

test("global validation settings retain structural and uniqueness checks", () => {
    const enabled = isValidationEnabled();
    disableValidators();
    try {
        assert.equal(
            renderStringSelect(menu([], "")).toJSON().options.length,
            0,
        );
        assert.equal(
            renderComponents(
                <ActionRow>
                    {menu()}
                    <Button customId="a" style="primary">
                        A
                    </Button>
                </ActionRow>,
            ).length,
            1,
        );
        fails(() => renderStringSelect(menu([option(), option()])));
        fails(() =>
            renderStringSelect(
                menu(
                    <Button customId="a" style="primary">
                        A
                    </Button>,
                ),
            ),
        );
        fails(() =>
            renderComponents([
                <ActionRow>{menu()}</ActionRow>,
                <ActionRow>
                    <Button customId="priority" style="primary">
                        A
                    </Button>
                </ActionRow>,
            ]),
        );
        fails(() =>
            renderStringSelect(
                jsx(StringSelect, {
                    customId: "priority",
                    required: true,
                    children: option(),
                }),
            ),
        );
    } finally {
        if (enabled) enableValidators();
    }
});
