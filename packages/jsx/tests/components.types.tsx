import {
    Bold,
    type Child,
    Code,
    type Component,
    Embed,
    renderEmbed,
} from "../lib/index.ts";

const Fields: Component<{ label: string }> = ({ label }) => [
    <Embed.Field key="a" name={<Bold>{label}</Bold>}>
        value
    </Embed.Field>,
    null,
];
const view = (
    <Embed color={0x57f287}>
        <Fields label="Status" />
    </Embed>
);
renderEmbed(view);

// @ts-expect-error Unknown props must be rejected by authoring types.
const unknown = <Embed colour={123} />;
// @ts-expect-error Field names are required.
const missing = <Embed.Field>value</Embed.Field>;
// @ts-expect-error Code takes literal strings rather than nested formatting.
const code = <Code children={<Bold>value</Bold>} />;
// @ts-expect-error Footer text is plain metadata.
const footer = <Embed.Footer text={<Bold>value</Bold>} />;
const AsyncView = async () => <Embed />;
// @ts-expect-error Components must be synchronous.
const asynchronous = <AsyncView />;
const ReadonlyProps: Component<{ value: string }> = props => {
    // @ts-expect-error Component props are readonly.
    props.value = "changed";

    return props.value;
};
// @ts-expect-error Promises cannot be children.
const promise: Child = Promise.resolve("value");
void [unknown, missing, code, footer, asynchronous, ReadonlyProps, promise];
