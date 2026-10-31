import type { EmbedBuilder } from "@discordjs/builders";
import { Bold, type Component, Embed, renderEmbed } from "@hyperion/jsx";

const View: Component<{ name: string }> = ({ name }) => (
    <Embed>
        <Embed.Title>{name}</Embed.Title>
        <Embed.Field name={<Bold>Status</Bold>}>Ready</Embed.Field>
    </Embed>
);
const embed: EmbedBuilder = renderEmbed(<View name="Standalone TSX" />);
if (embed.toJSON().title !== "Standalone TSX")
    throw new Error("Unexpected JSX output.");

const negativeTypes = () => {
    // @ts-expect-error The exported JSX types reject invalid props.
    const invalid = <Embed colour={1} />;
    const Async = async () => <Embed />;
    // @ts-expect-error Asynchronous components are unsupported.
    const asynchronous = <Async />;
    // @ts-expect-error Intrinsic HTML is unsupported.
    const intrinsic = <div />;
    void [invalid, asynchronous, intrinsic];
};
void negativeTypes;
