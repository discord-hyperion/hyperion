# Embeds and text

An embed is a structured card Discord displays below a message with a title, description, fields, and footer. With `@hyperion-js/jsx`, write each part as a child of `<Embed>` and call `renderEmbed()`:

```tsx
import { Bold, Br, Embed, Link, renderEmbed } from "@hyperion-js/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready</Bold> for review
            <Br />
            <Link href="https://example.com/todos">Open your todos</Link>
        </Embed.Description>
        <Embed.Field name="Owner" inline>
            Alex
        </Embed.Field>
        <Embed.Field name="Deadline" inline>
            Friday
        </Embed.Field>
        <Embed.Footer text="Team todos" />
    </Embed>,
);
```

Send the result with `await interaction.reply({ embeds: [embed] })`. Because `renderEmbed()` returns a standard `EmbedBuilder`, you can call any `EmbedBuilder` method on it before sending.

## Formatting text

`@hyperion-js/jsx` escapes plain text automatically so special characters like `*` or `_` in usernames do not break Discord Markdown. Use formatting components when you want styled output:

| Kind     | Components                                                                |
| -------- | ------------------------------------------------------------------------- |
| Inline   | `Bold`, `Italic`, `Underline`, `Strikethrough`, `Spoiler`, `Code`, `Link` |
| Blocks   | `CodeBlock`                                                               |
| Headings | `H1`, `H2`, `H3`, and `Subtext` for small muted text                      |

Heading components each occupy their own line. They work in embed descriptions, field values, [layout messages](layout-messages.md), and [modals](modals.md). Keep each heading on a single line and do not nest headings inside inline components.

If you already have formatted Markdown, such as a bulleted list, wrap it in `<Raw>` to bypass escaping:

```tsx
import { Embed, Raw, renderEmbed } from "@hyperion-js/jsx";

const embed = renderEmbed(
    <Embed>
        <Embed.Description>
            <Raw>{"- Review the change\n- Run the checks"}</Raw>
        </Embed.Description>
    </Embed>,
);
```

Embed titles, author names, and footers accept plain text only, so placing formatting components inside them throws a `JSXRenderError`. Field names allow inline formatting components, but not headings.

## Reusing a view

Extract repeated embed layouts into functions that accept props:

```tsx
import { Embed, renderEmbed } from "@hyperion-js/jsx";

type Todo = { title: string; owner: string };

const TodoCard = ({ title, owner }: Todo) => (
    <Embed color={0x57f287}>
        <Embed.Title>{title}</Embed.Title>
        <Embed.Field name="Owner">{owner}</Embed.Field>
    </Embed>
);

const embed = renderEmbed(<TodoCard title="Review the change" owner="Alex" />);
```

Use `.map()` to render lists of fields and `&&` to include optional elements. Each call to `renderEmbed()` builds a new `EmbedBuilder`, so mutating one instance never affects another.

## Mentions and limits

`UserMention`, `RoleMention`, and `ChannelMention` format Discord mention strings from an ID. They do not control notifications; set `allowedMentions` on your reply to control who gets pinged.

Discord enforces a 6,000-character combined limit across all embeds in a single message. `renderEmbed()` validates one embed at a time, so verify the combined character count yourself when sending multiple embeds together.

Next, see [Buttons and menus](message-components.md). For every embed prop and limit, see the [JSX reference](../../jsx.md).
