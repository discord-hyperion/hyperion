# JSX

You've probably built an embed with discord.js before: `new EmbedBuilder()`,
then `.setTitle()`, `.addFields()`, and so on, one call after another. It works,
but once a message has a few parts, the shape gets hard to see. `@hyperion/jsx`
lets you write the message the way it looks, then turns it into the same
builders you'd have made by hand.

```tsx
import { Bold, Embed, renderEmbed } from "@hyperion/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready</Bold> for review
        </Embed.Description>
    </Embed>,
);
```

`renderEmbed()` hands back an ordinary `EmbedBuilder`, so sending it is plain
discord.js: `await interaction.reply({ embeds: [embed] })`. The package doesn't
need React and doesn't depend on `@hyperion/core`, so everything in this guide
works with any discord.js bot. If you do use Hyperion, see
[JSX with Hyperion](jsx-with-hyperion.md) for how the two fit together.

## Setup

You'll need Node.js 24.17 or newer and the `@discordjs/builders` version listed
in the package's peer dependencies. Then tell TypeScript to use this package's
JSX runtime:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Put your views in `.tsx` files and run them with a runner such as `tsx`, or
compile them for Node. (The option says `react-jsx`, but that's only the name of
the transform; React isn't involved.)

## What are you sending?

- [Embeds and text](jsx/embeds.md): titles, fields, and formatting.
- [Buttons and menus](jsx/message-components.md): controls, and templates for
  your handlers.
- [Layout messages](jsx/layout-messages.md): a whole message built from text,
  images, and controls.
- [Modals](jsx/modals.md): forms, including pre-filled ones.

## How rendering works

A view is just a function that returns JSX, and it runs again every time you
render. Two things follow from that:
- Views are synchronous, so fetch your data first and pass it in as props.
- Every render gives you brand-new builders, so personalising one reply can't
  leak into another.

Arrays, fragments, and conditionals work the way you'd expect. Use `<Br />` for
a line break, and `{" "}` when you need a space between two elements.

When something's wrong, you get a `JSXRenderError` that points at the exact spot
in your view. The underlying discord.js error is attached as `cause`.

> [!WARNING]
> The `cause` can contain the values you passed in, so be careful about logging
> it.

The [authoring reference](../jsx.md) has the full rules.
