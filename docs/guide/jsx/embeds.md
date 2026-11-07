# Embeds and text

An embed is the card Discord shows under a message: a title, some text, and a few
fields. In JSX you write those parts as children of `<Embed>`:

```tsx
import { Bold, Br, Embed, Link, renderEmbed } from "@hyperion/jsx";

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

Send it with `await interaction.reply({ embeds: [embed] })`. What you get back is
a normal `EmbedBuilder`, so you can still call its methods before sending.

## Formatting text

Plain text is escaped for you, so a username with a `*` in it won't turn the
rest of the line bold. When you do want formatting, reach for a component:

| Kind     | Components                                                                |
| -------- | ------------------------------------------------------------------------- |
| Inline   | `Bold`, `Italic`, `Underline`, `Strikethrough`, `Spoiler`, `Code`, `Link` |
| Blocks   | `CodeBlock`                                                               |
| Headings | `H1`, `H2`, `H3`, and `Subtext` for small grey text                       |

Headings each take their own line. They work in descriptions and field values,
and also in [layout messages](layout-messages.md) and [modals](modals.md). Keep
each on a single line, and don't put one inside an inline component.

Got Markdown you wrote yourself, like a list? `Raw` passes it through untouched:

```tsx
import { Embed, Raw, renderEmbed } from "@hyperion/jsx";

const embed = renderEmbed(
    <Embed>
        <Embed.Description>
            <Raw>{"- Review the change\n- Run the checks"}</Raw>
        </Embed.Description>
    </Embed>,
);
```

Titles, author names, and footers are plain text only, so a formatting component
there throws an error. Field names can use inline formatting, but not headings.

## Reusing a view

If you build the same kind of embed in several places, turn it into a function.
Props carry the parts that change:

```tsx
import { Embed, renderEmbed } from "@hyperion/jsx";

type Todo = { title: string; owner: string };

const TodoCard = ({ title, owner }: Todo) => (
    <Embed color={0x57f287}>
        <Embed.Title>{title}</Embed.Title>
        <Embed.Field name="Owner">{owner}</Embed.Field>
    </Embed>
);

const embed = renderEmbed(<TodoCard title="Review the change" owner="Alex" />);
```

Use `.map()` to make a field for each item in a list, and `&&` to leave an
optional part out. Every render creates a new embed, so changing one builder
afterwards never touches another.

## Mentions and limits

`UserMention`, `RoleMention`, and `ChannelMention` write the mention text for an
ID. They don't decide who gets pinged; your reply does.

One thing `renderEmbed()` can't see: Discord counts the 6,000-character limit
across every embed in a message. Each call only checks its own embed, so keep an
eye on the total yourself.

Next up: [buttons and menus](message-components.md). The
[embed reference](../../jsx.md) lists every prop.
