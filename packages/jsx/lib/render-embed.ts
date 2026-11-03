import { EmbedBuilder } from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { type Child, expand } from "./runtime.ts";
import { renderTextContent } from "./text.ts";

const native = <Result>(path: string, operation: () => Result): Result => {
    try {
        return operation();
    } catch (cause) {
        if (cause instanceof JSXRenderError) {
            throw cause;
        }

        throw new JSXRenderError(
            path,
            "Native embed builder validation failed.",
            { cause },
        );
    }
};

export const renderEmbed = (view: Child): EmbedBuilder => {
    const roots = expand(view, "root");
    const root = roots[0];

    if (
        roots.length !== 1 ||
        !root ||
        typeof root !== "object" ||
        root.name !== "Embed"
    ) {
        throw new JSXRenderError("root", "Expected exactly one Embed.");
    }

    const builder = new EmbedBuilder();
    const seen = new Set<string>();
    let field = 0;

    if (root.props.color !== undefined) {
        native("Embed.color", () =>
            builder.setColor(root.props.color as number),
        );
    }
    if (root.props.url !== undefined) {
        native("Embed.url", () => builder.setURL(root.props.url as string));
    }
    if (root.props.timestamp !== undefined) {
        native("Embed.timestamp", () =>
            builder.setTimestamp(
                root.props.timestamp as Date | number | string,
            ),
        );
    }

    for (const section of expand(root.props.children, "Embed", root.depth)) {
        if (typeof section !== "object") {
            throw new JSXRenderError(
                "Embed",
                "Expected embed sections, not bare text.",
            );
        }

        const path =
            section.name === "Embed.Field"
                ? `Embed.Field[${field++}]`
                : section.name;
        const props = section.props;

        if (!section.name.startsWith("Embed.") || section.name === "Embed") {
            throw new JSXRenderError(path, "Expected an embed section.");
        }
        if (section.name !== "Embed.Field") {
            if (seen.has(section.name)) {
                throw new JSXRenderError(path, "Duplicate singleton section.");
            }

            seen.add(section.name);
        }

        native(path, () => {
            switch (section.name) {
                case "Embed.Title":
                    builder.setTitle(
                        renderTextContent(props.children, path, section.depth, {
                            plain: true,
                        }),
                    );
                    break;
                case "Embed.Description":
                    builder.setDescription(
                        renderTextContent(props.children, path, section.depth, {
                            blocks: true,
                        }),
                    );
                    break;
                case "Embed.Field": {
                    if (!("name" in props)) {
                        throw new JSXRenderError(
                            `${path}.name`,
                            "Field name is required.",
                        );
                    }

                    builder.addFields({
                        name: renderTextContent(
                            props.name,
                            `${path}.name`,
                            section.depth,
                        ),
                        value: renderTextContent(
                            props.children,
                            `${path}.value`,
                            section.depth,
                            { blocks: true },
                        ),
                        ...(props.inline === undefined
                            ? {}
                            : { inline: props.inline as boolean }),
                    });
                    break;
                }
                case "Embed.Author":
                    if (typeof props.name !== "string") {
                        throw new JSXRenderError(
                            `${path}.name`,
                            "Author name must be plain text.",
                        );
                    }

                    builder.setAuthor({
                        name: props.name as string,
                        ...(props.url === undefined
                            ? {}
                            : { url: props.url as string }),
                        ...(props.iconURL === undefined
                            ? {}
                            : { icon_url: props.iconURL as string }),
                    });
                    break;
                case "Embed.Footer":
                    if (typeof props.text !== "string") {
                        throw new JSXRenderError(
                            `${path}.text`,
                            "Footer text must be plain text.",
                        );
                    }

                    builder.setFooter({
                        text: props.text as string,
                        ...(props.iconURL === undefined
                            ? {}
                            : { icon_url: props.iconURL as string }),
                    });
                    break;
                case "Embed.Image":
                    builder.setImage(props.url as string);
                    break;
                case "Embed.Thumbnail":
                    builder.setThumbnail(props.url as string);
                    break;
                default:
                    throw new JSXRenderError(
                        path,
                        "Unsupported embed section.",
                    );
            }
        });
    }

    native("Embed", () => builder.toJSON());

    return builder;
};
