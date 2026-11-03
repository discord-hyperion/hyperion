# JSX

Builders get wordy fast. `@hyperion/jsx` lets you write embeds, buttons, menus,
and modal forms as JSX instead, and turns them into the same discord.js builders
you'd have written by hand. It doesn't use React, and it works without
`@hyperion/core` too.

## Setup

Tell TypeScript to use Hyperion's JSX runtime:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

(The option is called `react-jsx`, but React isn't involved.) Name files `.tsx`
and Hyperion discovers them like any other handler. `tsx` runs them without a build.

## Embeds

```tsx
import { Bold, Embed, renderEmbed } from "@hyperion/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready</Bold> for review
        </Embed.Description>
        <Embed.Field name="Owner" inline>
            {user.username}
        </Embed.Field>
    </Embed>,
);

await ctx.interaction.reply({ embeds: [embed] });
```

Text is escaped for you, so a username with `*` in it won't turn bold. When you
_do_ want formatting, use the components: `Bold`, `Italic`, `Underline`,
`Strikethrough`, `Spoiler`, `Code`, `CodeBlock`, `Link`, `UserMention`,
`RoleMention`, `ChannelMention`, and `Br`. In descriptions and field values you
can also use `H1`, `H2`, `H3`, and `Subtext`; each gets its own line. `Raw` inserts Markdown exactly as
written, for when you really mean it.

Mentions only render the text. Whether they ping anyone is up to
`allowedMentions` on your reply.

## Buttons and rows

```tsx
import { ActionRow, Button, renderComponents } from "@hyperion/jsx";

const components = renderComponents(
    <ActionRow>
        <Button
            customId="profile.refresh"
            style="primary"
            emoji={{ name: "🔄" }}
        >
            Refresh
        </Button>
        <Button url="https://example.com/profile">Open profile</Button>
    </ActionRow>,
);

await ctx.interaction.reply({ content: "Your profile", components });
```

Interactive buttons need a `customId` and a `style` (`primary`, `secondary`,
`success`, or `danger`). Link buttons take a `url` instead. For a handler's
template, `renderButton(<Button … />)` returns a single button builder.

## Select menus

```tsx
const Priority = () => (
    <StringSelect customId="todo.priority" placeholder="Choose priority">
        <StringSelect.Option label="Low" value="low" />
        <StringSelect.Option
            label="High"
            value="high"
            description="Needs attention"
        />
    </StringSelect>
);

renderComponents(
    <ActionRow>
        <Priority />
    </ActionRow>,
); // for a reply
renderStringSelect(<Priority />); // as a handler's template
```

Only string menus have JSX components so far. A menu needs a row of its own.

## Layout messages

Discord's newer "Components V2" lets a whole message be built from layout
pieces: boxes with a coloured edge, text next to a thumbnail, image galleries,
dividers. In Hyperion these are **layout messages**, and `renderMessage()`
builds them:

```tsx
import {
    ActionRow,
    Button,
    Container,
    H2,
    renderMessage,
    Section,
    Separator,
    Subtext,
    TextDisplay,
    Thumbnail,
} from "@hyperion/jsx";

await ctx.interaction.reply(
    renderMessage(
        <Container accent={0x5865f2}>
            <Section accessory={<Thumbnail url={avatarUrl} />}>
                <TextDisplay>
                    <H2>Ticket {ticketId}</H2>
                    {subject}
                    <Subtext>Opened by {username}</Subtext>
                </TextDisplay>
            </Section>
            <Separator />
            <ActionRow>
                <Button customId={closeTicket(ticket)} style="danger">
                    Close
                </Button>
            </ActionRow>
        </Container>,
        { ephemeral: true },
    ),
);
```

`renderMessage()` returns the components plus the flag Discord needs, so just
spread it into `reply()`, `update()`, or `editReply()`. Pass `{ ephemeral: true }`
for a private reply.

The pieces:
- **`Container`**: a box around other pieces, with an optional `accent` colour.
- **`Section`**: one to three `TextDisplay`s with an `accessory` beside them, either a
  `Thumbnail` or a `Button`.
- **`TextDisplay`**: formatted text. `H1`–`H3` and `Subtext` give you headings and
  small grey text.
- **`MediaGallery`**: up to ten `MediaGallery.Item` images.
- **`Separator`**: space between pieces, with a divider line unless you turn it off.
- Your usual `ActionRow`s with buttons and menus fit inside too.

A few things to know:
- A layout message can't have `content` or embeds, and it stays a layout message
  forever. When you update it, use `renderMessage()` again, not `{ content }`.
- Up to 40 pieces per message, counting everything nested.
- Put things in the wrong place (a `Thumbnail` outside a section, say) and you'll
  get an error pointing right at it.
- Attachments only show up if a piece points at them with `attachment://name`.

## Modal forms

```tsx
import { Modal, renderModal } from "@hyperion/jsx";

const TodoForm = ({ name = "" }) => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" value={name} maxLength={100} />
        </Modal.Label>
        <Modal.Label text="Description">
            <Modal.TextInput
                customId="description"
                style="paragraph"
                required={false}
            />
        </Modal.Label>
    </Modal>
);

await ctx.interaction.showModal(renderModal(<TodoForm name={suggestion} />));
```

Inputs are short and required unless you say otherwise. Because every render is
a fresh form, pre-filling values per user is safe. Keep the modal's `customId`
the same as its handler's.

## Using JSX with handlers

Anywhere a handler takes a template, pass the rendered builder:

```tsx
export default class extends ButtonHandler {
    constructor() {
        super({
            customId: "profile.refresh",
            builder: renderButton(
                <Button customId="profile.refresh" style="primary">
                    Refresh
                </Button>,
            ),
        });
    }
    // …
}
```

Core's `ButtonHandler`, `SelectMenuHandler`, and `ModalHandler` don't clash with
JSX's `Button` and `Modal`, so import both freely.

## Good to know

- Components are plain synchronous functions, re-run on every render. Fetch data
  before rendering; promises aren't allowed.
- Mistakes throw a `JSXRenderError` that points at where in the tree the problem is.
- Each render checks one embed or one set of rows. Discord's limits across a
  whole message (like 6,000 characters across all embeds) are still yours to watch.
- Custom IDs must be unique within one `renderComponents()` or `renderMessage()` call.
