import {
    type ActionRowBuilder,
    ContainerBuilder,
    CustomIdButtonBuilder,
    DangerButtonBuilder,
    LinkButtonBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SuccessButtonBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import {
    buildButton,
    buildRow,
    type DeclaredIds,
    declareId,
} from "./render-components.ts";
import { type Child, expand, type Node, type Value } from "./runtime.ts";
import { renderTextContent } from "./text.ts";
import { validateComponent } from "./validate-component.ts";

const maxComponents = 40;
const maxSectionTexts = 3;
const maxGalleryItems = 10;

export type LayoutComponent =
    | ContainerBuilder
    | SectionBuilder
    | TextDisplayBuilder
    | MediaGalleryBuilder
    | SeparatorBuilder
    | ActionRowBuilder;

/** A layout message, usable with reply(), update(), and editReply(). */
export type LayoutMessage = {
    components: LayoutComponent[];
    flags: readonly ["IsComponentsV2"];
};

/** A private layout message, usable only when sending (reply or follow-up). */
export type EphemeralLayoutMessage = {
    components: LayoutComponent[];
    flags: readonly ["IsComponentsV2", "Ephemeral"];
};

type RenderMessage = {
    (view: Child, options?: { ephemeral?: false }): LayoutMessage;
    (view: Child, options: { ephemeral: true }): EphemeralLayoutMessage;
};

type State = { ids: DeclaredIds; count: number };

const count = (state: State, path: string, amount = 1) => {
    state.count += amount;

    if (state.count > maxComponents) {
        throw new JSXRenderError(
            path,
            `Layout messages allow at most ${maxComponents} components, including nested ones.`,
        );
    }
};

const element = (value: Value, path: string): Node => {
    if (typeof value !== "object") {
        throw new JSXRenderError(
            path,
            "Wrap text in a TextDisplay; bare text is not a component.",
        );
    }

    return { ...value, path: `${path}.${value.name}` };
};

const misplaced = (node: Node, allowed: string) => {
    switch (node.name) {
        case "Thumbnail":
            return "A Thumbnail can only be a Section accessory.";
        case "Button":
        case "StringSelect":
        case "UserSelect":
        case "RoleSelect":
        case "MentionableSelect":
        case "ChannelSelect":
            return `A ${node.name} must be inside an ActionRow.`;
        case "Modal.FileUpload":
            return "A Modal.FileUpload can only appear in a modal Label.";
        case "Container":
            return "A Container can only appear at the top level, not inside another Container.";
        default:
            return `Expected ${allowed}.`;
    }
};

const media = <Builder extends ThumbnailBuilder | MediaGalleryItemBuilder>(
    node: Node,
    builder: Builder,
): Builder => {
    const { url, description, spoiler } = node.props;

    if (typeof url !== "string") {
        throw new JSXRenderError(node.path, "Media requires a string url.");
    }

    builder.setURL(url);

    if (description !== undefined) {
        builder.setDescription(description as string);
    }

    if (spoiler !== undefined) {
        builder.setSpoiler(spoiler as boolean);
    }

    return builder;
};

const textDisplay = (node: Node, state: State) => {
    count(state, node.path);

    return new TextDisplayBuilder().setContent(
        renderTextContent(node.props.children, node.path, node.depth, {
            blocks: true,
        }),
    );
};

const accessoryButton = (section: SectionBuilder, button: unknown) => {
    if (button instanceof PrimaryButtonBuilder) {
        section.setPrimaryButtonAccessory(button);
    } else if (button instanceof SecondaryButtonBuilder) {
        section.setSecondaryButtonAccessory(button);
    } else if (button instanceof SuccessButtonBuilder) {
        section.setSuccessButtonAccessory(button);
    } else if (button instanceof DangerButtonBuilder) {
        section.setDangerButtonAccessory(button);
    } else if (button instanceof LinkButtonBuilder) {
        section.setLinkButtonAccessory(button);
    }
};

const section = (node: Node, state: State) => {
    count(state, node.path);

    const builder = new SectionBuilder();
    const texts = expand(node.props.children, node.path, node.depth);

    if (texts.length < 1 || texts.length > maxSectionTexts) {
        throw new JSXRenderError(
            node.path,
            `A Section needs one to ${maxSectionTexts} TextDisplay children.`,
        );
    }

    for (const [index, value] of texts.entries()) {
        const child = element(value, `${node.path}.children[${index}]`);

        if (child.name !== "TextDisplay") {
            throw new JSXRenderError(
                child.path,
                "A Section can only contain TextDisplay children; put other content in the accessory.",
            );
        }

        builder.addTextDisplayComponents(textDisplay(child, state));
    }

    const accessories = expand(
        node.props.accessory,
        `${node.path}.accessory`,
        node.depth,
    );
    const [value] = accessories;

    if (accessories.length !== 1 || value === undefined) {
        throw new JSXRenderError(
            `${node.path}.accessory`,
            "A Section needs exactly one accessory: a Thumbnail or a Button.",
        );
    }

    const accessory = element(value, `${node.path}.accessory`);
    count(state, accessory.path);

    if (accessory.name === "Thumbnail") {
        builder.setThumbnailAccessory(media(accessory, new ThumbnailBuilder()));
    } else if (accessory.name === "Button") {
        const button = buildButton(accessory);

        if (button instanceof CustomIdButtonBuilder) {
            declareId(
                state.ids,
                accessory.props.customId as string,
                accessory.path,
            );
        }

        accessoryButton(builder, button);
    } else {
        throw new JSXRenderError(
            accessory.path,
            "A Section accessory must be a Thumbnail or a Button.",
        );
    }

    return builder;
};

const gallery = (node: Node, state: State) => {
    count(state, node.path);

    const builder = new MediaGalleryBuilder();
    const items = expand(node.props.children, node.path, node.depth);

    if (items.length < 1 || items.length > maxGalleryItems) {
        throw new JSXRenderError(
            node.path,
            `A MediaGallery needs one to ${maxGalleryItems} MediaGallery.Item children.`,
        );
    }

    for (const [index, value] of items.entries()) {
        const item = element(value, `${node.path}.children[${index}]`);

        if (item.name !== "MediaGallery.Item") {
            throw new JSXRenderError(
                item.path,
                "A MediaGallery can only contain MediaGallery.Item children.",
            );
        }

        builder.addItems(media(item, new MediaGalleryItemBuilder()));
    }

    return builder;
};

const separator = (node: Node, state: State) => {
    count(state, node.path);

    const builder = new SeparatorBuilder();
    const { divider, spacing } = node.props;

    if (divider !== undefined) {
        builder.setDivider(divider as boolean);
    }

    if (spacing !== undefined) {
        if (spacing !== "small" && spacing !== "large") {
            throw new JSXRenderError(
                node.path,
                'Separator spacing must be "small" or "large".',
            );
        }

        builder.setSpacing(spacing === "small" ? 1 : 2);
    }

    return builder;
};

const row = (node: Node, state: State) => {
    const built = buildRow(node, node.path, state.ids);

    count(state, node.path, 1 + built.components.length);

    return built;
};

/** Keep structural errors as-is; wrap native builder failures with their location. */
const native = <Result>(node: Node, build: () => Result) => {
    try {
        return build();
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            node.path,
            "Native layout component construction failed.",
            { cause },
        );
    }
};

/** Components allowed inside a Container: everything at the top level except another Container. */
const content = (node: Node, state: State) => {
    switch (node.name) {
        case "TextDisplay":
            return textDisplay(node, state);
        case "Section":
            return section(node, state);
        case "MediaGallery":
            return gallery(node, state);
        case "Separator":
            return separator(node, state);
        case "ActionRow":
            return row(node, state);
        default:
            return undefined;
    }
};

const container = (node: Node, state: State) => {
    count(state, node.path);

    const builder = new ContainerBuilder();
    const { accent, spoiler } = node.props;

    if (accent !== undefined) {
        builder.setAccentColor(accent as number);
    }

    if (spoiler !== undefined) {
        builder.setSpoiler(spoiler as boolean);
    }

    for (const [index, value] of expand(
        node.props.children,
        node.path,
        node.depth,
    ).entries()) {
        const child = element(value, `${node.path}.children[${index}]`);
        const built = content(child, state);

        if (!built) {
            throw new JSXRenderError(
                child.path,
                misplaced(
                    child,
                    "a TextDisplay, Section, MediaGallery, Separator, or ActionRow",
                ),
            );
        }

        if (built instanceof TextDisplayBuilder) {
            builder.addTextDisplayComponents(built);
        } else if (built instanceof SectionBuilder) {
            builder.addSectionComponents(built);
        } else if (built instanceof MediaGalleryBuilder) {
            builder.addMediaGalleryComponents(built);
        } else if (built instanceof SeparatorBuilder) {
            builder.addSeparatorComponents(built);
        } else {
            builder.addActionRowComponents(built);
        }
    }

    return builder;
};

/**
 * Render a layout message (Discord's Components V2). The result carries the
 * flag that enables layout components; spread it into reply(), update(), or
 * editReply(). Pass `{ ephemeral: true }` for a private reply.
 */
export const renderMessage: RenderMessage = ((
    view: Child,
    options: { ephemeral?: boolean } = {},
) => {
    const state: State = { ids: [], count: 0 };
    const components: LayoutComponent[] = [];
    const roots = expand(view, "root");

    if (roots.length === 0) {
        throw new JSXRenderError(
            "root",
            "A layout message needs at least one component.",
        );
    }

    for (const [index, value] of roots.entries()) {
        const node = element(value, `components[${index}]`);
        const built = native(node, () =>
            node.name === "Container"
                ? container(node, state)
                : content(node, state),
        );

        if (!built) {
            throw new JSXRenderError(
                node.path,
                misplaced(
                    node,
                    "a Container, TextDisplay, Section, MediaGallery, Separator, or ActionRow",
                ),
            );
        }

        validateComponent(built, node.path);
        components.push(built);
    }

    return {
        components,
        flags: options.ephemeral
            ? (["IsComponentsV2", "Ephemeral"] as const)
            : (["IsComponentsV2"] as const),
    };
}) as RenderMessage;
