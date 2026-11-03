import { type Child, primitive } from "./runtime.ts";

type Children = { children?: Child };
type Empty = { children?: never };
type Literal = { children: string };

export const Bold = primitive<Children>("Bold", ["children"]);
export const Italic = primitive<Children>("Italic", ["children"]);
export const Underline = primitive<Children>("Underline", ["children"]);
export const Strikethrough = primitive<Children>("Strikethrough", ["children"]);
export const Spoiler = primitive<Children>("Spoiler", ["children"]);
export const Br = primitive<Empty>("Br", []);
export const Raw = primitive<Literal>("Raw", ["children"]);
export const Code = primitive<Literal>("Code", ["children"]);
export const CodeBlock = primitive<Literal & { language?: string }>(
    "CodeBlock",
    ["children", "language"],
);
export const Link = primitive<Children & { href: string }>("Link", [
    "children",
    "href",
]);
export const UserMention = primitive<Empty & { id: string }>("UserMention", [
    "id",
]);
export const RoleMention = primitive<Empty & { id: string }>("RoleMention", [
    "id",
]);
export const ChannelMention = primitive<Empty & { id: string }>(
    "ChannelMention",
    ["id"],
);

export const Embed = Object.assign(
    primitive<
        Children & {
            color?: number;
            url?: string;
            timestamp?: Date | number | string;
        }
    >("Embed", ["children", "color", "url", "timestamp"]),
    {
        Title: primitive<Children>("Embed.Title", ["children"]),
        Description: primitive<Children>("Embed.Description", ["children"]),
        Field: primitive<Children & { name: Child; inline?: boolean }>(
            "Embed.Field",
            ["children", "name", "inline"],
        ),
        Footer: primitive<{ text: string; iconURL?: string }>("Embed.Footer", [
            "text",
            "iconURL",
        ]),
        Author: primitive<{ name: string; url?: string; iconURL?: string }>(
            "Embed.Author",
            ["name", "url", "iconURL"],
        ),
        Image: primitive<{ url: string }>("Embed.Image", ["url"]),
        Thumbnail: primitive<{ url: string }>("Embed.Thumbnail", ["url"]),
    },
);

export const H1 = primitive<Children>("H1", ["children"]);
export const H2 = primitive<Children>("H2", ["children"]);
export const H3 = primitive<Children>("H3", ["children"]);
export const Subtext = primitive<Children>("Subtext", ["children"]);
