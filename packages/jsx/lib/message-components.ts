import type {
    CustomIdButtonStyle,
    PrimaryButtonBuilder,
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
