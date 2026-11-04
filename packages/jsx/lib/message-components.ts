import type {
    ChannelSelectMenuBuilder,
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

/**
 * Props every select menu shares. `disabled` is for messages and `required` for
 * modals; rendering rejects each in the other place.
 */
type SelectProps = {
    customId: string;
    placeholder?: string | undefined;
    minValues?: number | undefined;
    maxValues?: number | undefined;
    disabled?: boolean | undefined;
    required?: boolean | undefined;
};

const selectProps = [
    "customId",
    "placeholder",
    "minValues",
    "maxValues",
    "disabled",
    "required",
] as const;

export const StringSelect = Object.assign(
    primitive<SelectProps & { children?: Child }>("StringSelect", [
        "children",
        ...selectProps,
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

/** Picks users; default selections are user IDs. */
export const UserSelect = primitive<
    SelectProps & { defaultUsers?: readonly string[] | undefined }
>("UserSelect", [...selectProps, "defaultUsers"]);

/** Picks roles; default selections are role IDs. */
export const RoleSelect = primitive<
    SelectProps & { defaultRoles?: readonly string[] | undefined }
>("RoleSelect", [...selectProps, "defaultRoles"]);

/** Picks users or roles; defaults are given separately as user and role IDs. */
export const MentionableSelect = primitive<
    SelectProps & {
        defaultUsers?: readonly string[] | undefined;
        defaultRoles?: readonly string[] | undefined;
    }
>("MentionableSelect", [...selectProps, "defaultUsers", "defaultRoles"]);

/** Picks channels, optionally limited to some channel types. */
export const ChannelSelect = primitive<
    SelectProps & {
        defaultChannels?: readonly string[] | undefined;
        channelTypes?:
            | readonly Exclude<
                  Parameters<ChannelSelectMenuBuilder["addChannelTypes"]>[0],
                  readonly unknown[]
              >[]
            | undefined;
    }
>("ChannelSelect", [...selectProps, "defaultChannels", "channelTypes"]);
