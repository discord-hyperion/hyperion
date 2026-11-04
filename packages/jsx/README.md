# @hyperion/jsx

Write Discord embeds, buttons, menus, layout messages, and modal forms as JSX,
and get back the ordinary discord.js builders. It works on its own or with
`@hyperion/core`, and React isn't involved.

```tsx
import { Bold, Embed, renderEmbed } from "@hyperion/jsx";

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
        "jsxImportSource": "@hyperion/jsx"
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

```tsx
import {
    Container,
    H2,
    renderMessage,
    Subtext,
    TextDisplay,
} from "@hyperion/jsx";

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
- [Getting started with JSX](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx.md)
- [Embeds and text](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx/embeds.md)
- [Buttons and menus](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx/message-components.md)
- [Layout messages](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx/layout-messages.md)
- [Modals](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx/modals.md)

Using `@hyperion/core`? See
[JSX with Hyperion](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/jsx-with-hyperion.md)
for templates, params, and `.tsx` handlers.

For exact props and rules, see the
[authoring reference](https://github.com/favylicious/discord-hyperion/blob/main/docs/jsx.md).
