import {
    bold,
    channelMention,
    codeBlock,
    hyperlink,
    inlineCode,
    italic,
    roleMention,
    spoiler,
    strikethrough,
    underline,
    userMention,
} from "@discordjs/formatters";
import { JSXRenderError } from "./error.ts";
import { expand, type Node } from "./runtime.ts";

// Escape individual syntax characters so separately rendered children cannot
// recombine into Markdown. The SDK escaper matches complete constructs instead.
// Deliberate Markdown belongs in Raw.
const escapeLiteral = (text: string) =>
    text.replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, "\\$&");
const inlineFormatters: Readonly<Record<string, (text: string) => string>> = {
    Bold: bold,
    Italic: italic,
    Underline: underline,
    Strikethrough: strikethrough,
    Spoiler: spoiler,
};
const mentionFormatters: Readonly<Record<string, (id: string) => string>> = {
    UserMention: userMention,
    RoleMention: roleMention,
    ChannelMention: channelMention,
};

const literal = (node: Node) => {
    if (typeof node.props.children !== "string") {
        throw new JSXRenderError(
            node.path,
            `${node.name} requires literal string content.`,
        );
    }

    return node.props.children;
};

const destination = (value: unknown, path: string) => {
    if (typeof value !== "string") {
        throw new JSXRenderError(
            path,
            "Link requires an absolute HTTP(S) destination.",
        );
    }

    let url: URL;

    try {
        url = new URL(value);
    } catch (cause) {
        throw new JSXRenderError(path, "Invalid link destination.", { cause });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new JSXRenderError(
            path,
            "Link requires an absolute HTTP(S) destination.",
        );
    }

    return url.href.replace(
        /[()<>\\]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
};

export const renderTextContent = (
    content: unknown,
    path: string,
    depth = 0,
    plain = false,
    insideLink = false,
): string =>
    expand(content, path, depth)
        .map(value => {
            if (typeof value === "string" || typeof value === "number") {
                return plain ? String(value) : escapeLiteral(String(value));
            }

            const current = { ...value, path: `${path}.${value.name}` };

            if (plain) {
                throw new JSXRenderError(
                    current.path,
                    "Formatting components are not allowed in plain-text metadata.",
                );
            }

            const formatInline = inlineFormatters[current.name];

            if (formatInline) {
                return formatInline(
                    renderTextContent(
                        current.props.children,
                        current.path,
                        current.depth,
                        false,
                        insideLink,
                    ),
                );
            }
            if (current.name === "Br") return "\n";
            if (current.name === "Raw") return literal(current);
            if (current.name === "Code") {
                const text = literal(current);

                if (/[`\r\n]/.test(text)) {
                    throw new JSXRenderError(
                        current.path,
                        "Code cannot contain backticks or line breaks.",
                    );
                }

                return inlineCode(text);
            }
            if (current.name === "CodeBlock") {
                const text = literal(current);
                const language = current.props.language ?? "";

                if (text.includes("```")) {
                    throw new JSXRenderError(
                        current.path,
                        "CodeBlock cannot contain triple backticks.",
                    );
                }
                if (
                    typeof language !== "string" ||
                    !/^[\w+-]*$/.test(language)
                ) {
                    throw new JSXRenderError(
                        current.path,
                        "CodeBlock language must be a single language identifier.",
                    );
                }

                return codeBlock(language, text);
            }
            if (current.name === "Link") {
                if (insideLink) {
                    throw new JSXRenderError(
                        current.path,
                        "Links cannot contain other links.",
                    );
                }

                const href = destination(current.props.href, current.path);
                const label = renderTextContent(
                    current.props.children,
                    current.path,
                    current.depth,
                    false,
                    true,
                );

                return hyperlink(label, href);
            }
            const formatMention = mentionFormatters[current.name];

            if (formatMention) {
                if (
                    typeof current.props.id !== "string" ||
                    !/^\d+$/.test(current.props.id)
                ) {
                    throw new JSXRenderError(
                        current.path,
                        "Mention id must be a nonempty string of digits.",
                    );
                }

                return formatMention(current.props.id);
            }

            throw new JSXRenderError(
                current.path,
                "Expected text content, not an embed section.",
            );
        })
        .join("");
