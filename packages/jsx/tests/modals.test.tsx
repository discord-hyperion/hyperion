import assert from "node:assert/strict";
import { test } from "node:test";
import {
    disableValidators,
    enableValidators,
    isValidationEnabled,
    LabelBuilder,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import {
    Bold,
    Br,
    type Child,
    Embed,
    JSXRenderError,
    Modal,
    renderEmbed,
    renderModal,
} from "../lib/index.ts";
import { jsx } from "../lib/jsx-runtime.ts";

const input = (customId = "name") => (
    <Modal.Label text="Name">
        <Modal.TextInput customId={customId} />
    </Modal.Label>
);
const form = (children: Child) => (
    <Modal customId="todo.create" title="Create todo">
        {children}
    </Modal>
);

const withValidation = (enabled: boolean, operation: () => void) => {
    const previous = isValidationEnabled();

    try {
        if (enabled) {
            enableValidators();
        } else {
            disableValidators();
        }

        operation();
    } finally {
        if (previous) {
            enableValidators();
        } else {
            disableValidators();
        }
    }
};

test("matches native modal output for formatted displays and all input options", () => {
    const actual = renderModal(
        form(
            <>
                <Modal.TextDisplay>
                    <Bold>Create a todo</Bold>
                    <Br />
                    {"*literal*"}
                </Modal.TextDisplay>
                <Modal.Label text="*Name*" description="Plain description">
                    <Modal.TextInput
                        customId="name"
                        placeholder="*placeholder*"
                        value="*value*"
                        minLength={0}
                        maxLength={100}
                    />
                </Modal.Label>
                <Modal.Label text="Description">
                    <Modal.TextInput
                        customId="description"
                        style="paragraph"
                        required={false}
                    />
                </Modal.Label>
            </>,
        ),
    );
    const expected = new ModalBuilder()
        .setCustomId("todo.create")
        .setTitle("Create todo")
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                "**Create a todo**\n\\*literal\\*",
            ),
        )
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("*Name*")
                .setDescription("Plain description")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("name")
                        .setStyle(1)
                        .setRequired(true)
                        .setPlaceholder("*placeholder*")
                        .setValue("*value*")
                        .setMinLength(0)
                        .setMaxLength(100),
                ),
            new LabelBuilder()
                .setLabel("Description")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("description")
                        .setStyle(2)
                        .setRequired(false),
                ),
        );

    assert.ok(actual instanceof ModalBuilder);
    assert.deepEqual(actual.toJSON(), expected.toJSON());
});

for (const [style, expected] of [
    ["short", 1],
    ["paragraph", 2],
    [1, 1],
    [2, 2],
] as const) {
    test(`normalizes input style ${JSON.stringify(style)}`, () => {
        const modal = renderModal(
            form(
                <Modal.Label text="Name">
                    <Modal.TextInput customId="name" style={style} />
                </Modal.Label>,
            ),
        );
        const label = modal.components[0];

        assert.ok(label instanceof LabelBuilder);
        const data = label.toJSON();
        assert.equal(data.component.type, 4);
        assert.ok("style" in data.component);
        assert.equal(data.component.style, expected);
    });
}

test("expands reusable/conditional children without losing order and allows information-only forms", () => {
    const Field = ({ id }: { id: string }) => input(id);
    const modal = renderModal(
        form([
            false,
            null,
            <Field key="first" id="first" />,
            [
                <Modal.TextDisplay>Between</Modal.TextDisplay>,
                <Field key="second" id="second" />,
            ],
        ]),
    );

    assert.deepEqual(
        modal.components.map(component => component.toJSON().type),
        [18, 10, 18],
    );
    assert.equal(
        renderModal(form(<Modal.TextDisplay>Notice</Modal.TextDisplay>))
            .components.length,
        1,
    );
});

test("reevaluates components and creates independent nested builders for personalized initial values", () => {
    let calls = 0;
    const data = { name: "Default" };
    const Form = ({ state }: { state: typeof data }) => {
        calls++;

        return form(
            <Modal.Label text="Name">
                <Modal.TextInput customId="name" value={state.name} />
            </Modal.Label>,
        );
    };
    const view = <Form state={data} />;
    assert.equal(calls, 0);

    const first = renderModal(view);
    const original = first.toJSON();
    data.name = "Personalized";
    const second = renderModal(view);
    assert.deepEqual(first.toJSON(), original);

    const firstLabel = first.components[0];
    const secondLabel = second.components[0];
    assert.ok(firstLabel instanceof LabelBuilder);
    assert.ok(secondLabel instanceof LabelBuilder);
    assert.notEqual(firstLabel, secondLabel);
    firstLabel.setLabel("Mutated");
    firstLabel.setTextInputComponent(
        new TextInputBuilder().setCustomId("other").setStyle(1),
    );

    const secondData = secondLabel.toJSON();
    assert.ok("value" in secondData.component);
    assert.equal(secondData.label, "Name");
    assert.equal(secondData.component.value, "Personalized");
    assert.equal(original.custom_id, second.toJSON().custom_id);
    assert.equal(calls, 2);
    assert.ok(!Object.isFrozen(data));
});

for (const [name, view] of [
    ["no root", null],
    ["multiple roots", [form(input()), form(input())]],
    [
        "embed root",
        <Embed>
            <Embed.Title>x</Embed.Title>
        </Embed>,
    ],
    ["bare root text", form("private")],
    ["unlabelled input", form(<Modal.TextInput customId="name" />)],
    ["text outside display", form(<Bold>private</Bold>)],
    ["embed section", form(<Embed.Title>private</Embed.Title>)],
    ["empty label", form(<Modal.Label text="Name" />)],
    [
        "multiple controls",
        form(
            <Modal.Label text="Name">
                <Modal.TextInput customId="one" />
                <Modal.TextInput customId="two" />
            </Modal.Label>,
        ),
    ],
    [
        "nested label",
        form(
            <Modal.Label text="Name">
                <Modal.Label text="Nested">
                    <Modal.TextInput customId="name" />
                </Modal.Label>
            </Modal.Label>,
        ),
    ],
    [
        "display inside label",
        form(
            <Modal.Label text="Name">
                <Modal.TextDisplay>private</Modal.TextDisplay>
            </Modal.Label>,
        ),
    ],
    [
        "modal inside display",
        form(<Modal.TextDisplay>{form(input())}</Modal.TextDisplay>),
    ],
] satisfies [string, Child][]) {
    test(`rejects ${name}`, () =>
        assert.throws(() => renderModal(view), JSXRenderError));
}

test("rejects duplicate IDs with both paths, even with native validators disabled", () => {
    withValidation(false, () => {
        assert.throws(
            () => renderModal(form([input("private-id"), input("private-id")])),
            error => {
                assert.ok(error instanceof JSXRenderError);
                assert.match(error.message, /children\[0\].Label.TextInput/);
                assert.match(error.message, /children\[1\].Label.TextInput/);
                assert.ok(!error.message.includes("private-id"));

                return true;
            },
        );
        assert.doesNotThrow(() => renderModal(form(input("same"))));
        assert.doesNotThrow(() => renderModal(form(input("same"))));
    });
});

test("requires explicit string IDs/metadata and rejects numeric IDs and unknown props", () => {
    withValidation(false, () => {
        const invalid = [
            jsx(Modal, { title: "Title", children: input() }),
            jsx(Modal, {
                customId: "id",
                title: jsx(Bold, { children: "private" }),
                children: input(),
            }),
            form(
                jsx(Modal.Label, {
                    text: jsx(Bold, { children: "private" }),
                    children: jsx(Modal.TextInput, { customId: "id" }),
                }),
            ),
            form(
                jsx(Modal.Label, {
                    text: "Name",
                    description: 1,
                    children: jsx(Modal.TextInput, { customId: "id" }),
                }),
            ),
            form(
                jsx(Modal.Label, {
                    text: "Name",
                    children: jsx(Modal.TextInput, {}),
                }),
            ),
            form(
                jsx(Modal.Label, {
                    text: "Name",
                    children: jsx(Modal.TextInput, {
                        customId: "id",
                        value: jsx(Bold, { children: "private" }),
                    }),
                }),
            ),
            form(
                jsx(Modal.Label, {
                    text: "Name",
                    children: jsx(Modal.TextInput, {
                        customId: "id",
                        placeholder: 1,
                    }),
                }),
            ),
            form(
                jsx(Modal.Label, {
                    text: "Name",
                    children: jsx(Modal.TextInput, { customId: "id", id: 1 }),
                }),
            ),
            jsx(Modal, { customId: "id", title: "Title", unexpected: true }),
        ];

        for (const view of invalid) {
            assert.throws(() => renderModal(view), JSXRenderError);
        }
    });
});

test("delegates native limits and empty-form checks while respecting disabled validators", () => {
    withValidation(true, () => {
        for (const view of [
            form(null),
            <Modal customId="id" title={"private".repeat(20)}>
                {input()}
            </Modal>,
            form(<Modal.TextDisplay>{"x".repeat(4_001)}</Modal.TextDisplay>),
            form(Array.from({ length: 6 }, (_, index) => input(String(index)))),
            form(
                <Modal.Label text="Name">
                    <Modal.TextInput customId="name" maxLength={4_001} />
                </Modal.Label>,
            ),
        ]) {
            assert.throws(
                () => renderModal(view),
                error => {
                    assert.ok(error instanceof JSXRenderError);
                    assert.ok(error.cause instanceof Error);
                    assert.ok(!error.message.includes("private"));

                    return true;
                },
            );
        }
    });
    withValidation(false, () => {
        assert.equal(renderModal(form(null)).components.length, 0);
        assert.equal(
            renderModal(
                form(
                    <Modal.TextDisplay>{"x".repeat(4_001)}</Modal.TextDisplay>,
                ),
            ).components.length,
            1,
        );
        assert.throws(
            () => renderModal(form(<Modal.TextInput customId="name" />)),
            JSXRenderError,
        );
    });
});

test("shares rejected asynchronous/object child and error-cause behavior with embed rendering", () => {
    const original = new Error("private failure");
    const Broken = () => {
        throw original;
    };

    assert.throws(
        () => renderModal(<Broken />),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.equal(error.cause, original);
            assert.ok(!error.message.includes("private"));

            return true;
        },
    );

    for (const value of [
        Promise.resolve("x"),
        Promise.reject(new Error("private failure")),
        {},
        new ModalBuilder(),
    ]) {
        assert.throws(
            () =>
                renderModal(
                    jsx(Modal, {
                        customId: "id",
                        title: "Title",
                        children: value,
                    }),
                ),
            JSXRenderError,
        );
    }

    assert.throws(
        () =>
            renderEmbed(
                <Embed>
                    <Embed.Description>{form(input())}</Embed.Description>
                </Embed>,
            ),
        JSXRenderError,
    );
});

test("only omitted style and required props receive defaults; explicit nulls reach native validation", () => {
    withValidation(true, () => {
        for (const props of [{ style: null }, { required: null }]) {
            const view = form(
                jsx(Modal.Label, {
                    text: "Name",
                    children: jsx(Modal.TextInput, {
                        customId: "name",
                        ...props,
                    }),
                }),
            );

            assert.throws(
                () => renderModal(view),
                error => {
                    assert.ok(error instanceof JSXRenderError);
                    assert.ok(error.cause instanceof Error);

                    return true;
                },
            );
        }
    });
});
