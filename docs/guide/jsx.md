# JSX

Building complex Discord embeds and component layouts by chaining builder methods such as `new EmbedBuilder().setTitle().addFields()` gets hard to read as messages grow. `@hyperion-js/jsx` lets you write embeds, buttons, select menus, layout messages, and modals as JSX and renders them into standard `@discordjs/builders` instances.

```tsx
import { Bold, Embed, renderEmbed } from "@hyperion-js/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287}>
        <Embed.Title>Todo created</Embed.Title>
        <Embed.Description>
            <Bold>Ready</Bold> for review
        </Embed.Description>
    </Embed>,
);
```

`renderEmbed()` returns a standard `EmbedBuilder`, so you send it with plain discord.js such as `await interaction.reply({ embeds: [embed] })`. `@hyperion-js/jsx` does not use React and does not require `@hyperion-js/core`, so it works in any discord.js bot. If you are using `@hyperion-js/core`, see [JSX with Hyperion](jsx-with-hyperion.md) for using JSX views as handler templates.

## Setup

You need Node.js 24.17 or newer. Install `@hyperion-js/jsx` alongside the exact `@discordjs/builders` prerelease it targets:

```npm
npm install @hyperion-js/jsx@beta @discordjs/builders@2.0.0-dev.1792497873-5050a3b54
```

Configure TypeScript to use the `@hyperion-js/jsx` runtime:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion-js/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

TypeScript calls the automatic JSX transform `react-jsx`, even though React is not installed or used. Put your JSX views in `.tsx` files and run them with `tsx` or compile them with `tsc`.

## What you can build

- [Embeds and text](jsx/embeds.md). Titles, fields, mentions, and Markdown formatting components.
- [Buttons and menus](jsx/message-components.md). Action rows, buttons, and select menus.
- [Layout messages](jsx/layout-messages.md). Components V2 messages built from containers, text displays, media galleries, sections, and controls.
- [Modals](jsx/modals.md). Modal forms, including pre-filled inputs, select menus, and file uploads.

## How rendering works

A JSX view is a synchronous function that runs each time you call a render function:
- Fetch any asynchronous data before rendering and pass it into your view as props.
- Every render returns fresh builder instances, so mutating a rendered builder never affects other messages.

Arrays, fragments, and conditional expressions work like standard JSX. Use `<Br />` for line breaks and `{" "}` when you need an explicit space between adjacent elements.

If a view violates a placement rule or Discord limit, rendering throws a `JSXRenderError` with the path to the invalid element and attaches the underlying discord.js validation error as `cause`.

> [!WARNING]
> The attached `cause` may include user-provided values from your props, so avoid logging `cause` verbatim when handling sensitive input.

For every prop and validation rule, see the [JSX reference](../jsx.md).
