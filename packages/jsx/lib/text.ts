import {
    bold,
    channelMention,
    codeBlock,
    heading,
    hyperlink,
    inlineCode,
    italic,
    roleMention,
    spoiler,
    strikethrough,
    subtext,
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
const blockFormatters: Readonly<Record<string, (text: string) => string>> = {
    H1: text => heading(text, 1),
    H2: text => heading(text, 2),
    H3: text => heading(text, 3),
    Subtext: subtext,
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

export type TextOptions = {
    /** Plain metadata: no escaping and no formatting components. */
    plain?: boolean;
    /** Headings and subtext are allowed (text displays, descriptions, field values). */
    blocks?: boolean;
    insideLink?: boolean;
    /** Inside inline formatting, where line-level blocks cannot render. */
    nested?: boolean;
};

type Part = { text: string; block: boolean };

/** Join parts so each heading or subtext occupies its own line. */
const joinParts = (parts: readonly Part[]) => {
    let output = "";
    let afterBlock = false;

    for (const { text, block } of parts) {
        if ((block || afterBlock) && output !== "" && !output.endsWith("\n")) {
            output += "\n";
        }

        output += text;
        afterBlock = block;
    }

    return output;
};

export const renderTextContent = (
    content: unknown,
    path: string,
    depth = 0,
    options: TextOptions = {},
): string => {
    const {
        plain = false,
        blocks = false,
        insideLink = false,
        nested = false,
    } = options;
    const inner = { blocks, insideLink, nested: true };

    return joinParts(
        expand(content, path, depth).map((value): Part => {
            if (typeof value === "string" || typeof value === "number") {
                return {
                    text: plain ? String(value) : escapeLiteral(String(value)),
                    block: false,
                };
            }

            const current = { ...value, path: `${path}.${value.name}` };

            if (plain) {
                throw new JSXRenderError(
                    current.path,
                    "Formatting components are not allowed in plain-text metadata.",
                );
            }

            const formatBlock = blockFormatters[current.name];

            if (formatBlock) {
                if (!blocks || nested) {
                    throw new JSXRenderError(
                        current.path,
                        `${current.name} must start its own line in a text display, embed description, or field value.`,
                    );
                }

                const text = renderTextContent(
                    current.props.children,
                    current.path,
                    current.depth,
                    inner,
                );

                if (text.includes("\n")) {
                    throw new JSXRenderError(
                        current.path,
                        `${current.name} must fit on one line.`,
                    );
                }

                return { text: formatBlock(text), block: true };
            }

            return { text: renderInline(current, inner), block: false };
        }),
    );
};

const renderInline = (
    current: Node,
    inner: Required<Omit<TextOptions, "plain">>,
): string => {
    const { insideLink } = inner;
    const formatInline = inlineFormatters[current.name];

    if (formatInline) {
        return formatInline(
            renderTextContent(
                current.props.children,
                current.path,
                current.depth,
                inner,
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
        if (typeof language !== "string" || !/^[\w+-]*$/.test(language)) {
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
            { ...inner, insideLink: true },
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
};
