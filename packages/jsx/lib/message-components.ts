import type {
    CustomIdButtonStyle,
    PrimaryButtonBuilder,
    StringSelectMenuOptionBuilder,
} from "@discordjs/builders";
import { type Child, primitive } from "./runtime.ts";

type ButtonProps = {
    children?: Child;
    emoji?: Parameters<PrimaryButtonBuilder["setEmoji"]>[0];
    disabled?: boolean | undefined;
} & (
    | {
          customId: string;
          style:
              | "primary"
              | "secondary"
              | "success"
              | "danger"
              | CustomIdButtonStyle;
          url?: never;
      }
    | { url: string; customId?: never; style?: never }
);

export const ActionRow = primitive<{ children?: Child }>("ActionRow", [
    "children",
]);
export const Button = primitive<ButtonProps>("Button", [
    "children",
    "customId",
    "style",
    "url",
    "emoji",
    "disabled",
]);

export const StringSelect = Object.assign(
    primitive<{
        children?: Child;
        customId: string;
        placeholder?: string | undefined;
        minValues?: number | undefined;
        maxValues?: number | undefined;
        disabled?: boolean | undefined;
    }>("StringSelect", [
        "children",
        "customId",
        "placeholder",
        "minValues",
        "maxValues",
        "disabled",
    ]),
    {
        Option: primitive<{
            label: string;
            value: string;
            description?: string | undefined;
            emoji?:
                | Parameters<StringSelectMenuOptionBuilder["setEmoji"]>[0]
                | undefined;
            default?: boolean | undefined;
            children?: never;
        }>("StringSelect.Option", [
            "label",
            "value",
            "description",
            "emoji",
            "default",
        ]),
    },
);
