import { type Child, primitive } from "./runtime.ts";

type Children = { children?: Child };
type Media = { url: string; description?: string; spoiler?: boolean };

/** A boxed group of layout components, optionally with an accent colour. */
export const Container = primitive<
    Children & { accent?: number; spoiler?: boolean }
>("Container", ["children", "accent", "spoiler"]);

/** One to three text displays beside a thumbnail or button accessory. */
export const Section = primitive<Children & { accessory: Child }>("Section", [
    "children",
    "accessory",
]);

/** A block of formatted text. */
export const TextDisplay = primitive<Children>("TextDisplay", ["children"]);

/** A small image, used only as a section accessory. */
export const Thumbnail = primitive<Media>("Thumbnail", [
    "url",
    "description",
    "spoiler",
]);

/** A grid of one to ten images or videos. */
export const MediaGallery = Object.assign(
    primitive<Children>("MediaGallery", ["children"]),
    {
        Item: primitive<Media>("MediaGallery.Item", [
            "url",
            "description",
            "spoiler",
        ]),
    },
);

/** Vertical space between components, with an optional divider line. */
export const Separator = primitive<{
    divider?: boolean;
    spacing?: "small" | "large";
}>("Separator", ["divider", "spacing"]);
