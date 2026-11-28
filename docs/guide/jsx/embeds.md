# Embeds and text

Describe a Discord embed as children of `<Embed>` and render it into a standard `EmbedBuilder` with `renderEmbed()`:

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

Send the result with `await interaction.reply({ embeds: [embed] })`. Because `renderEmbed()` returns an `EmbedBuilder`, you can chain any discord.js `EmbedBuilder` method on it afterward.

`<Embed>` accepts optional `color`, `url`, and `timestamp` props, and supports seven child sections. Every section except `Embed.Field` is a singleton—repeating one throws `JSXRenderError`:

| Element             | Props / children                                          | Text escaping                        |
| ------------------- | --------------------------------------------------------- | ------------------------------------ |
| `Embed.Title`       | Plain-text children                                       | Unescaped (no formatting components) |
| `Embed.Description` | Rich-text children                                        | Auto-escaped                         |
| `Embed.Field`       | `name` (rich text), optional `inline`, rich-text children | Auto-escaped                         |
| `Embed.Author`      | `name`, optional `iconUrl`, `url` (no children)           | Unescaped string prop                |
| `Embed.Footer`      | `text`, optional `iconUrl` (no children)                  | Unescaped string prop                |
| `Embed.Image`       | `url` (no children)                                       | —                                    |
| `Embed.Thumbnail`   | `url` (no children)                                       | —                                    |

## Formatting text

Rich-text slots (`Embed.Description`, `Embed.Field` `name` and value, `TextDisplay`, and `Modal.TextDisplay`) escape literal text automatically so characters like `*` or `_` in user input cannot break Discord Markdown. Use formatting components for styled output:

| Kind     | Components                                                                |
| -------- | ------------------------------------------------------------------------- |
| Inline   | `Bold`, `Italic`, `Underline`, `Strikethrough`, `Spoiler`, `Code`, `Link` |
| Blocks   | `CodeBlock`                                                               |
| Headings | `H1`, `H2`, `H3`, and `Subtext` for small muted text                      |

Heading components each occupy their own line and work in embed descriptions, field values, [layout messages](layout-messages.md), and [modals](modals.md). Keep headings on a single line and do not nest them inside inline components.

`Code` rejects backticks and line breaks, and `CodeBlock` accepts an optional `language` prop and rejects triple backticks (neither escapes its content). `Link` requires an absolute `http://` or `https://` URL and cannot nest another `Link`; violating any of these rules throws `JSXRenderError`.

Wrap pre-formatted Markdown, such as a bulleted list, in `<Raw>` to bypass automatic escaping:

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

Plain-text slots (`Embed.Title` children, `Embed.Author` `name`, and `Embed.Footer` `text`) keep literal text unescaped and reject formatting components. `Embed.Field` `name` accepts inline formatting components, but not headings.

## Reusing a view

Extract repeated embed layouts into function components that accept props:

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

`UserMention`, `RoleMention`, and `ChannelMention` format Discord mention strings from an `id` prop, validating only that `id` is a non-empty string of digits (not that the entity exists). Mentions do not control notifications; set `allowedMentions` on your reply to control who gets pinged.

Discord enforces a 6,000-character combined limit across all embeds in a single message. `renderEmbed()` validates one embed at a time, so verify the combined length yourself when sending multiple embeds together.

Next, see [Buttons and menus](message-components.md).
