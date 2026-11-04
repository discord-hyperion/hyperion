import type {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from "@discordjs/builders";
import type {
    InteractionReplyOptions,
    InteractionUpdateOptions,
} from "discord.js";
import {
    ActionRow,
    renderComponents,
    renderStringSelect,
    StringSelect,
} from "../lib/index.ts";

const view = (
    <StringSelect
        customId="priority"
        placeholder="Choose"
        minValues={0}
        maxValues={2}
        disabled={false}
    >
        <StringSelect.Option
            label="Low"
            value="low"
            default={false}
            emoji={{ name: "✅" }}
        />
        <StringSelect.Option label="High" value="high" description="Urgent" />
    </StringSelect>
);
renderStringSelect(view) satisfies StringSelectMenuBuilder;
const components = renderComponents(<ActionRow>{view}</ActionRow>);
components satisfies ActionRowBuilder[];
({ components }) satisfies InteractionReplyOptions;
({ components }) satisfies InteractionUpdateOptions;

type MenuProps = Parameters<typeof StringSelect>[0];
type OptionProps = Parameters<typeof StringSelect.Option>[0];
const missingId = { children: [] };
// @ts-expect-error Menus need custom IDs.
missingId satisfies MenuProps;
// The same StringSelect serves modals, where `required` applies.
({ customId: "priority", required: true }) satisfies MenuProps;
const numericId = { customId: "priority", id: 1 };
// @ts-expect-error Numeric IDs are not exposed.
({ customId: "priority", id: 1 }) satisfies MenuProps;
const missingLabel = { value: "low" };
// @ts-expect-error Options require labels.
missingLabel satisfies OptionProps;
const missingValue = { label: "Low" };
// @ts-expect-error Options require values.
missingValue satisfies OptionProps;
const badLabel = {
    label: <StringSelect.Option label="Nested" value="nested" />,
    value: "low",
};
// @ts-expect-error Labels are plain strings.
badLabel satisfies OptionProps;
const badDefault = { label: "Low", value: "low", default: "yes" };
// @ts-expect-error Default is boolean.
badDefault satisfies OptionProps;
const badEmoji = { label: "Low", value: "low", emoji: "✅" };
// @ts-expect-error Emoji data is a native object.
badEmoji satisfies OptionProps;
const optionChildren = { label: "Low", value: "low", children: "text" };
// @ts-expect-error Options do not accept children.
optionChildren satisfies OptionProps;
// @ts-expect-error Options are JSX children, not a parallel data prop.
({ customId: "priority", options: [] }) satisfies MenuProps;
void [numericId];
