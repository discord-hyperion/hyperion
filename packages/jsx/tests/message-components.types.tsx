import type {
    ActionRowBuilder,
    CustomIdButtonBuilder,
} from "@discordjs/builders";
import {
    ButtonStyle,
    type InteractionReplyOptions,
    type InteractionUpdateOptions,
} from "discord.js";
import {
    ActionRow,
    Button,
    renderButton,
    renderComponents,
} from "../lib/index.ts";

const interactive = (
    <Button customId="refresh" style="primary">
        Refresh
    </Button>
);
const link = <Button url="https://example.com">Open</Button>;
const emoji = (
    <Button
        customId="done"
        style={ButtonStyle.Success}
        emoji={{ name: "✅" }}
        disabled={false}
    />
);
renderButton(interactive) satisfies CustomIdButtonBuilder;
const components = renderComponents(
    <ActionRow>{[interactive, link, emoji]}</ActionRow>,
);
components satisfies ActionRowBuilder[];
({ components }) satisfies InteractionReplyOptions;
({ components }) satisfies InteractionUpdateOptions;
// @ts-expect-error Interactive buttons require a style.
<Button customId="refresh">Refresh</Button>;
// @ts-expect-error Interactive buttons require a custom ID.
<Button style="primary">Refresh</Button>;
// @ts-expect-error Link buttons cannot have a custom ID.
<Button url="https://example.com" customId="refresh">
    Open
</Button>;
// @ts-expect-error Link buttons cannot have a style.
<Button url="https://example.com" style="primary">
    Open
</Button>;
// @ts-expect-error Premium buttons are outside this API.
<Button style={ButtonStyle.Premium} customId="premium">
    Premium
</Button>;
// @ts-expect-error Emoji data is a native object.
<Button customId="refresh" style="primary" emoji="✅" />;
// @ts-expect-error Numeric IDs are not exposed.
<Button customId="refresh" style="primary" id={1}>
    Refresh
</Button>;
// @ts-expect-error Labels use children.
<Button customId="refresh" style="primary" label="Refresh" />;
// @ts-expect-error Rendering does not register click callbacks.
<Button customId="refresh" style="primary" onClick={() => {}}>
    Refresh
</Button>;
