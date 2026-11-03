import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ActionRowBuilder,
    ContainerBuilder,
    DangerButtonBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from "@discordjs/builders";
import {
    ActionRow,
    Bold,
    Br,
    Button,
    type Child,
    Container,
    Embed,
    H1,
    H2,
    H3,
    JSXRenderError,
    MediaGallery,
    Modal,
    renderEmbed,
    renderMessage,
    renderModal,
    Section,
    Separator,
    StringSelect,
    Subtext,
    TextDisplay,
    Thumbnail,
} from "../lib/index.ts";

const image = "https://example.com/image.png";
const text = (content: Child = "Hello") => <TextDisplay>{content}</TextDisplay>;
const json = (view: Child) =>
    renderMessage(view).components.map(component => component.toJSON());
const rejects = (view: Child, path: string, message: RegExp) =>
    assert.throws(
        () => renderMessage(view),
        error =>
            error instanceof JSXRenderError &&
            error.path === path &&
            message.test(error.message),
    );

test("renders every layout component to native builders with the V2 flag", () => {
    const message = renderMessage(
        <Container accent={0xed4245} spoiler={false}>
            <Section
                accessory={
                    <Thumbnail url={image} description="Avatar" spoiler />
                }
            >
                {text("Ticket")}
            </Section>
            <Separator divider={false} spacing="large" />
            <MediaGallery>
                <MediaGallery.Item url={image} description="Screenshot" />
            </MediaGallery>
            <ActionRow>
                <Button customId="ticket.close" style="danger">
                    Close
                </Button>
            </ActionRow>
        </Container>,
    );

    const expected = new ContainerBuilder()
        .setAccentColor(0xed4245)
        .setSpoiler(false)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("Ticket"),
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(image)
                        .setDescription("Avatar")
                        .setSpoiler(true),
                ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(2),
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(image)
                    .setDescription("Screenshot"),
            ),
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new DangerButtonBuilder()
                    .setCustomId("ticket.close")
                    .setLabel("Close"),
            ),
        );

    assert.deepEqual(message.flags, ["IsComponentsV2"]);
    assert.equal(message.components.length, 1);
    assert.ok(message.components[0] instanceof ContainerBuilder);
    assert.deepEqual(message.components[0]?.toJSON(), expected.toJSON());
});

test("top-level components and fragments render in order", () => {
    const [first, second, third] = json(
        <>
            {text("One")}
            <Separator />
            <Section
                accessory={<Button url="https://example.com">Open</Button>}
            >
                {text("Two")}
                {text("Three")}
            </Section>
        </>,
    );

    assert.deepEqual(first, { type: 10, content: "One" });
    assert.deepEqual(second, { type: 14 });
    assert.equal((third as { type: number }).type, 9);
    assert.equal(
        (third as { accessory: { url: string } }).accessory.url,
        "https://example.com",
    );
});

test("ephemeral adds the Ephemeral flag alongside the V2 flag", () => {
    assert.deepEqual(renderMessage(text(), { ephemeral: true }).flags, [
        "IsComponentsV2",
        "Ephemeral",
    ]);
    assert.deepEqual(renderMessage(text(), { ephemeral: false }).flags, [
        "IsComponentsV2",
    ]);
});

test("each render returns independent builders", () => {
    const View = () => text("Fresh");
    const first = renderMessage(<View />);
    const second = renderMessage(<View />);

    assert.notEqual(first.components[0], second.components[0]);
});

test("placement rules reject misplaced components with a path", () => {
    rejects(<></>, "root", /at least one component/);
    rejects("Hello", "components[0]", /Wrap text in a TextDisplay/);
    rejects(
        <Thumbnail url={image} />,
        "components[0].Thumbnail",
        /only be a Section accessory/,
    );
    rejects(
        <Button customId="a" style="primary">
            A
        </Button>,
        "components[0].Button",
        /must be inside an ActionRow/,
    );
    rejects(
        <Container>
            <Container>{text()}</Container>
        </Container>,
        "components[0].Container.children[0].Container",
        /only appear at the top level/,
    );
    rejects(
        <Container>
            <Thumbnail url={image} />
        </Container>,
        "components[0].Container.children[0].Thumbnail",
        /only be a Section accessory/,
    );
    rejects(
        <Section accessory={<Thumbnail url={image} />}>
            <Separator />
        </Section>,
        "components[0].Section.children[0].Separator",
        /only contain TextDisplay/,
    );
    rejects(
        <MediaGallery>{text()}</MediaGallery>,
        "components[0].MediaGallery.children[0].TextDisplay",
        /only contain MediaGallery.Item/,
    );
    rejects(
        <Separator spacing={"huge" as "large"} />,
        "components[0].Separator",
        /"small" or "large"/,
    );
});

test("sections and galleries enforce their child counts", () => {
    const thumbnail = <Thumbnail url={image} />;

    rejects(
        <Section accessory={thumbnail}>{null}</Section>,
        "components[0].Section",
        /one to 3 TextDisplay/,
    );
    rejects(
        <Section accessory={thumbnail}>
            {text()}
            {text()}
            {text()}
            {text()}
        </Section>,
        "components[0].Section",
        /one to 3 TextDisplay/,
    );
    rejects(
        <Section accessory={null}>{text()}</Section>,
        "components[0].Section.accessory",
        /exactly one accessory/,
    );
    rejects(
        <Section accessory={text()}>{text()}</Section>,
        "components[0].Section.accessory.TextDisplay",
        /Thumbnail or a Button/,
    );
    rejects(
        <MediaGallery>{null}</MediaGallery>,
        "components[0].MediaGallery",
        /one to 10/,
    );
    rejects(
        <MediaGallery>
            {Array.from({ length: 11 }, () => (
                <MediaGallery.Item url={image} />
            ))}
        </MediaGallery>,
        "components[0].MediaGallery",
        /one to 10/,
    );
});

test("the 40-component limit counts nested components", () => {
    const thirtyNine = Array.from({ length: 39 }, () => text());

    assert.equal(
        renderMessage(<Container>{thirtyNine}</Container>).components.length,
        1,
    );
    rejects(
        <Container>
            {thirtyNine}
            {text()}
        </Container>,
        "components[0].Container.children[39].TextDisplay",
        /at most 40 components/,
    );
    rejects(
        <>
            {Array.from({ length: 38 }, () => text())}
            <ActionRow>
                <Button customId="a" style="primary">
                    A
                </Button>
                <Button customId="b" style="primary">
                    B
                </Button>
            </ActionRow>
        </>,
        "components[38].ActionRow",
        /at most 40 components/,
    );
});

test("custom IDs stay unique across rows and section accessories", () => {
    rejects(
        <>
            <Section
                accessory={
                    <Button customId="same" style="primary">
                        A
                    </Button>
                }
            >
                {text()}
            </Section>
            <ActionRow>
                <StringSelect customId="same">
                    <StringSelect.Option label="One" value="one" />
                </StringSelect>
            </ActionRow>
        </>,
        "components[1].ActionRow.children[0].StringSelect",
        /Duplicate component custom ID/,
    );
});

test("native validation failures keep their location and cause", () => {
    assert.throws(
        () => renderMessage(<Container accent={-1}>{text()}</Container>),
        error =>
            error instanceof JSXRenderError &&
            error.path.startsWith("components[0]") &&
            error.cause !== undefined,
    );
});

test("headings and subtext render on their own lines", () => {
    assert.deepEqual(
        json(
            <TextDisplay>
                <H1>Title</H1>
                Body with <Bold>bold</Bold>
                <H2>Next</H2>
                <H3>Small</H3>
                <Subtext>Footnote</Subtext>
            </TextDisplay>,
        )[0],
        {
            type: 10,
            content:
                "# Title\nBody with **bold**\n## Next\n### Small\n-# Footnote",
        },
    );
});

test("headings work in embed descriptions, field values, and modal text displays", () => {
    const embed = renderEmbed(
        <Embed>
            <Embed.Description>
                <H2>Summary</H2>
            </Embed.Description>
            <Embed.Field name="Notes">
                <Subtext>Updated</Subtext>
            </Embed.Field>
        </Embed>,
    ).toJSON();
    const modal = renderModal(
        <Modal customId="m" title="M">
            <Modal.TextDisplay>
                <H3>Heads up</H3>
            </Modal.TextDisplay>
        </Modal>,
    ).toJSON();

    assert.equal(embed.description, "## Summary");
    assert.equal(embed.fields?.[0]?.value, "-# Updated");
    assert.deepEqual(modal.components[0], {
        type: 10,
        content: "### Heads up",
    });
});

test("headings are rejected where they cannot render", () => {
    const blocked = (render: () => unknown, message: RegExp) =>
        assert.throws(
            render,
            error =>
                error instanceof JSXRenderError && message.test(error.message),
        );

    blocked(
        () =>
            renderEmbed(
                <Embed>
                    <Embed.Field name={<H1>Name</H1>}>Value</Embed.Field>
                </Embed>,
            ),
        /must start its own line/,
    );
    blocked(
        () =>
            renderMessage(
                <TextDisplay>
                    <Bold>
                        <H1>Inside</H1>
                    </Bold>
                </TextDisplay>,
            ),
        /must start its own line/,
    );
    blocked(
        () =>
            renderMessage(
                <TextDisplay>
                    <H1>
                        Two
                        <Br />
                        lines
                    </H1>
                </TextDisplay>,
            ),
        /must fit on one line/,
    );
});
