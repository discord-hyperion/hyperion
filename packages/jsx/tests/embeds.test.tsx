import assert from "node:assert/strict";
import { test } from "node:test";
import {
    disableValidators,
    EmbedBuilder,
    enableValidators,
    isValidationEnabled,
} from "@discordjs/builders";
import {
    Bold,
    Br,
    ChannelMention,
    type Child,
    Code,
    CodeBlock,
    Embed,
    Italic,
    JSXRenderError,
    Link,
    Raw,
    RoleMention,
    renderEmbed,
    Spoiler,
    Strikethrough,
    Underline,
    UserMention,
} from "../lib/index.ts";
import { jsxDEV } from "../lib/jsx-dev-runtime.ts";
import { Fragment, jsx, jsxs } from "../lib/jsx-runtime.ts";

const description = (value: Child) =>
    renderEmbed(
        <Embed>
            <Embed.Description>{value}</Embed.Description>
        </Embed>,
    ).toJSON().description;

test("renders every embed section into an identical native builder", () => {
    const view = (
        <Embed color={0x57f287} url="https://example.com" timestamp={0}>
            <Embed.Title>{"*literal*"}</Embed.Title>
            <Embed.Description>
                <Bold>Hello</Bold>
                <Br />
                world
            </Embed.Description>
            <Embed.Field name={<Italic>Status</Italic>} inline>
                Ready
            </Embed.Field>
            <Embed.Author
                name="*author*"
                url="https://example.com"
                iconURL="attachment://author.png"
            />
            <Embed.Footer text="*footer*" iconURL="attachment://footer.png" />
            <Embed.Image url="attachment://image.png" />
            <Embed.Thumbnail url="https://example.com/thumb.png" />
        </Embed>
    );
    const expected = new EmbedBuilder()
        .setColor(0x57f287)
        .setURL("https://example.com")
        .setTimestamp(0)
        .setTitle("*literal*")
        .setDescription("**Hello**\nworld")
        .addFields({ name: "_Status_", value: "Ready", inline: true })
        .setAuthor({
            name: "*author*",
            url: "https://example.com",
            icon_url: "attachment://author.png",
        })
        .setFooter({ text: "*footer*", icon_url: "attachment://footer.png" })
        .setImage("attachment://image.png")
        .setThumbnail("https://example.com/thumb.png");
    const result = renderEmbed(view);

    assert.ok(result instanceof EmbedBuilder);
    assert.deepEqual(result.toJSON(), expected.toJSON());
});

test("defers components and reevaluates them with independent builders and readonly props", () => {
    let calls = 0;
    const data = { title: "First" };
    const View = (props: { data: typeof data }) => {
        calls++;
        assert.ok(Object.isFrozen(props));
        assert.ok(!Object.isFrozen(props.data));

        return (
            // biome-ignore lint/complexity/noUselessFragments: Verify fragment expansion through reusable components.
            <>
                <Embed>
                    <Embed.Title>{props.data.title}</Embed.Title>
                </Embed>
            </>
        );
    };
    const view = <View data={data} />;

    assert.equal(calls, 0);

    const first = renderEmbed(view);
    data.title = "Second";
    const second = renderEmbed(view);
    first.setTitle("Modified");

    assert.equal(calls, 2);
    assert.equal(second.toJSON().title, "Second");
});

test("flattens fragments/arrays, omits boolean/nullish children and preserves zero and keys", () => {
    const Field = ({ index }: { index: number }) => (
        <Embed.Field name={`Field ${index}`}>{index}</Embed.Field>
    );
    const result = renderEmbed(
        // biome-ignore lint/complexity/noUselessFragments: Verify fragments at the render root.
        <>
            <Embed>
                {null}
                {false}
                {undefined}
                {true}
                {[[0, 1].map(index => <Field key={index} index={index} />)]}
            </Embed>
        </>,
    );

    assert.deepEqual(
        result.toJSON().fields?.map(field => field.value),
        ["0", "1"],
    );
    assert.equal(
        description(
            <>
                {false}
                {null}
                {undefined}
                {true}
                {[["hello", 0]]}
            </>,
        ),
        "hello0",
    );
});

test("escapes literal Markdown once, composes formatting, preserves raw text and formats mentions", () => {
    assert.equal(
        description(
            <Bold>
                {"*x*"}
                <Italic>y</Italic>
            </Bold>,
        ),
        "**\\*x\\*_y_**",
    );
    assert.equal(
        description(
            <>
                <Underline>a</Underline>
                <Strikethrough>b</Strikethrough>
                <Spoiler>c</Spoiler>
            </>,
        ),
        "__a__~~b~~||c||",
    );
    assert.equal(description(<Raw>{"**unescaped**"}</Raw>), "**unescaped**");
    assert.equal(
        description(
            <>
                <UserMention id="123" />
                <RoleMention id="456" />
                <ChannelMention id="789" />
            </>,
        ),
        "<@123><@&456><#789>",
    );
    assert.equal(
        description("\\_*[]()<>|~`#-"),
        "\\\\\\_\\*\\[\\]\\(\\)\\<\\>\\|\\~\\`\\#\\-",
    );
});

test("keeps code literal and encodes link destinations independently from labels", () => {
    assert.equal(description(<Code>{"*x*"}</Code>), "`*x*`");
    assert.equal(
        description(
            <CodeBlock language="ts">{"const x = `value`;\n"}</CodeBlock>,
        ),
        "```ts\nconst x = `value`;\n\n```",
    );
    assert.equal(
        description(
            <Link href="https://example.com/plan(v2)?q=hello world">
                {"[open]"}
            </Link>,
        ),
        "[\\[open\\]](https://example.com/plan%28v2%29?q=hello%20world)",
    );
});

for (const [name, view] of [
    ["no root", null],
    [
        "multiple roots",
        <>
            <Embed />
            <Embed />
        </>,
    ],
    ["root text", "text"],
    ["bare content", <Embed>text</Embed>],
    [
        "wrong section",
        <Embed>
            <Bold>text</Bold>
        </Embed>,
    ],
    [
        "nested embed",
        <Embed>
            <Embed />
        </Embed>,
    ],
    [
        "section inside text",
        <Embed>
            <Embed.Description>
                <Embed.Title>x</Embed.Title>
            </Embed.Description>
        </Embed>,
    ],
    [
        "formatted title",
        <Embed>
            <Embed.Title>
                <Bold>x</Bold>
            </Embed.Title>
        </Embed>,
    ],
    [
        "inline code delimiter",
        <Embed>
            <Embed.Description>
                <Code>{"`"}</Code>
            </Embed.Description>
        </Embed>,
    ],
    [
        "inline code line break",
        <Embed>
            <Embed.Description>
                <Code>{"x\ny"}</Code>
            </Embed.Description>
        </Embed>,
    ],
    [
        "code fence",
        <Embed>
            <Embed.Description>
                <CodeBlock>{"```"}</CodeBlock>
            </Embed.Description>
        </Embed>,
    ],
    [
        "code language injection",
        <Embed>
            <Embed.Description>
                <CodeBlock language={"ts\n"}>x</CodeBlock>
            </Embed.Description>
        </Embed>,
    ],
    [
        "invalid link",
        <Embed>
            <Embed.Description>
                <Link href="relative">x</Link>
            </Embed.Description>
        </Embed>,
    ],
    [
        "link protocol",
        <Embed>
            <Embed.Description>
                <Link href="ftp://example.com/file">x</Link>
            </Embed.Description>
        </Embed>,
    ],
    [
        "nested link",
        <Embed>
            <Embed.Description>
                <Link href="https://example.com">
                    <Link href="https://example.com">x</Link>
                </Link>
            </Embed.Description>
        </Embed>,
    ],
    [
        "mention injection",
        <Embed>
            <Embed.Description>
                <UserMention id="123>secret" />
            </Embed.Description>
        </Embed>,
    ],
] satisfies [string, Child][]) {
    test(`rejects ${name}`, () => {
        assert.throws(() => renderEmbed(view), JSXRenderError);
    });
}

test("rejects unknown props and intrinsic elements even when supplied dynamically", () => {
    assert.throws(
        () => renderEmbed(jsx(Embed, { colour: 1 })),
        /Unknown prop "colour"/,
    );
    // @ts-expect-error Intrinsic HTML is not a supported authoring vocabulary.
    const html = <div />;

    assert.throws(() => renderEmbed(html), JSXRenderError);
});

test("rejects each duplicate singleton and permits multiple fields", () => {
    const sections = [
        <Embed.Title>x</Embed.Title>,
        <Embed.Description>x</Embed.Description>,
        <Embed.Author name="x" />,
        <Embed.Footer text="x" />,
        <Embed.Image url="https://example.com/x.png" />,
        <Embed.Thumbnail url="https://example.com/x.png" />,
    ];

    for (const section of sections) {
        assert.throws(
            () =>
                renderEmbed(
                    <Embed>
                        {section}
                        {section}
                    </Embed>,
                ),
            /Duplicate singleton/,
        );
    }
});

test("wraps native failures with causes and contextual paths without echoing private text", () => {
    const secret = "private".repeat(1_000);

    assert.throws(
        () =>
            renderEmbed(
                <Embed>
                    <Embed.Description>{secret}</Embed.Description>
                </Embed>,
            ),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.equal(error.path, "Embed");
            assert.ok(error.cause instanceof Error);
            assert.ok(!error.message.includes("private"));

            return true;
        },
    );
    assert.throws(
        () =>
            renderEmbed(
                <Embed timestamp="invalid">
                    <Embed.Title>x</Embed.Title>
                </Embed>,
            ),
        /Embed.timestamp/,
    );
    assert.throws(
        () =>
            renderEmbed(
                <Embed>
                    <Embed.Field name="x">
                        <Code>{"`private`"}</Code>
                    </Embed.Field>
                </Embed>,
            ),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.match(error.path, /Embed.Field\[0\].value.Code/);
            assert.ok(!error.message.includes("private"));

            return true;
        },
    );
});

test("respects the SDK validator setting but retains structural checks", () => {
    const enabled = isValidationEnabled();

    try {
        disableValidators();
        assert.equal(
            renderEmbed(
                <Embed>
                    <Embed.Description>{"x".repeat(5_000)}</Embed.Description>
                </Embed>,
            ).toJSON().description?.length,
            5_000,
        );
        assert.throws(
            () =>
                renderEmbed(
                    <Embed>
                        <Embed.Title>x</Embed.Title>
                        <Embed.Title>y</Embed.Title>
                    </Embed>,
                ),
            JSXRenderError,
        );
    } finally {
        if (enabled) {
            enableValidators();
        } else {
            disableValidators();
        }
    }
});

test("contains thrown components, rejects asynchronous/unsupported children and bounds recursion", () => {
    const original = new Error("private component failure");
    const Broken = () => {
        throw original;
    };
    const Recursive = (): Child => <Recursive />;

    assert.throws(
        () => renderEmbed(<Broken />),
        error => {
            assert.ok(error instanceof JSXRenderError);
            assert.equal(error.cause, original);
            assert.ok(!error.message.includes("private"));

            return true;
        },
    );
    assert.throws(() => renderEmbed(<Recursive />), /Nesting limit/);

    for (const value of [
        Promise.resolve("x"),
        Promise.reject(new Error("async failure")),
        {},
        new EmbedBuilder(),
    ]) {
        assert.throws(
            () => renderEmbed(jsx(Embed, { children: value })),
            /synchronous JSX/,
        );
    }
});

test("production and development automatic factories share the same description protocol", () => {
    const title = jsxDEV(
        Embed.Title,
        { children: "development" },
        undefined,
        false,
        {},
        undefined,
    );
    const root = jsxs(Embed, { children: [title] });

    assert.equal(renderEmbed(root).toJSON().title, "development");
});

test("plain metadata and fragment prop checks survive disabled native validation", () => {
    const enabled = isValidationEnabled();

    try {
        disableValidators();
        assert.throws(
            () =>
                renderEmbed(
                    jsx(Embed, {
                        children: jsx(Embed.Author, {
                            name: jsx(Bold, { children: "private" }),
                        }),
                    }),
                ),
            /Author name must be plain text/,
        );
        assert.throws(
            () =>
                renderEmbed(
                    jsx(Embed, {
                        children: jsx(Embed.Footer, {
                            text: jsx(Bold, { children: "private" }),
                        }),
                    }),
                ),
            /Footer text must be plain text/,
        );
    } finally {
        if (enabled) {
            enableValidators();
        } else {
            disableValidators();
        }
    }
});

test("rejects unsupported fragment props", () => {
    assert.throws(
        () =>
            renderEmbed(
                jsx(Fragment, { unexpected: true, children: jsx(Embed, {}) }),
            ),
        /Fragments accept only/,
    );
});

test("keeps Markdown delimiters literal across separately rendered children", () => {
    assert.equal(
        description(
            <>
                {"|"}
                {"|"}private{"|"}
                {"|"}
            </>,
        ),
        "\\|\\|private\\|\\|",
    );
    assert.equal(
        description(
            <>
                {"["}open{"](https://example.com)"}
            </>,
        ),
        "\\[open\\]\\(https://example\\.com\\)",
    );
    assert.equal(
        description(
            <Link href="https://example.com">
                {"["}open{"]"}
            </Link>,
        ),
        "[\\[open\\]](https://example.com/)",
    );
});
