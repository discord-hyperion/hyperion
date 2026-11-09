# @hyperion-js/jsx

Write Discord embeds, buttons, menus, layout messages, and modal forms as JSX,
and get back the ordinary discord.js builders. It works on its own or with
`@hyperion-js/core`, and React isn't involved.

```tsx fragment
import { Bold, Embed, renderEmbed } from "@hyperion-js/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready</Bold> for review
        </Embed.Description>
        <Embed.Field name="Owner" inline>
            Alex
        </Embed.Field>
    </Embed>,
);

await interaction.reply({ embeds: [embed] });
```

Rendering gives you the same `EmbedBuilder` you'd have made by hand, so sending
it is plain discord.js.

## Setup

You'll need Node.js 24.17 or newer and the `@discordjs/builders` version listed
in this package's peer dependencies. Then point TypeScript at the JSX runtime:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion-js/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Write views in `.tsx` files and run them with a runner such as `tsx`, or compile
them for Node. (`react-jsx` is only the name of the transform; there's no React
dependency.)

## Layout messages

For a whole message built from text, images, and controls (Discord's Components
V2), use `renderMessage()`:

```tsx fragment
import {
    Container,
    H2,
    renderMessage,
    Subtext,
    TextDisplay,
} from "@hyperion-js/jsx";

await interaction.reply(
    renderMessage(
        <Container accent={0x5865f2}>
            <TextDisplay>
                <H2>Your todos</H2>
                You're all caught up.
                <Subtext>Check back later for new tasks.</Subtext>
            </TextDisplay>
        </Container>,
        { ephemeral: true },
    ),
);
```

## Learn more

The guide walks through each part with examples:
- [Getting started with JSX](https://hyperion-docs-6h7.pages.dev/jsx/)
- [Embeds and text](https://hyperion-docs-6h7.pages.dev/jsx/embeds/)
- [Buttons and menus](https://hyperion-docs-6h7.pages.dev/jsx/message-components/)
- [Layout messages](https://hyperion-docs-6h7.pages.dev/jsx/layout-messages/)
- [Modals](https://hyperion-docs-6h7.pages.dev/jsx/modals/)

Using `@hyperion-js/core`? See
[JSX with Hyperion](https://hyperion-docs-6h7.pages.dev/jsx/with-hyperion/)
for templates, params, and `.tsx` handlers.
