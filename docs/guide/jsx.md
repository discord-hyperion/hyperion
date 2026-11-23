# JSX

`@hyperion-js/jsx` lets you author Discord embeds, message controls, layout messages, and modals as JSX and render them into standard `@discordjs/builders` instances. It works standalone in any discord.js v15 bot without React or `@hyperion-js/core`.

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

`renderEmbed()` returns a standard `EmbedBuilder`, so you send it with plain discord.js such as `await interaction.reply({ embeds: [embed] })`. Read the pages under [What you can build](#what-you-can-build) for standalone rendering, or jump to [JSX with Hyperion](jsx/with-hyperion.md) when using `@hyperion-js/core` handlers.

## Setup

You need Node.js 24.17 or newer. Install `@hyperion-js/jsx` alongside the pinned `@discordjs/builders` prerelease it targets (see the [FAQ](faq.md) for why prereleases are pinned):

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

TypeScript names the automatic JSX transform `react-jsx`, even though React is neither installed nor used. Put JSX views in `.tsx` files and run them with `tsx` or compile them with `tsc`. If you launch `tsx` from outside the directory containing `tsconfig.json` (for example in a monorepo), pass `--tsconfig` so dynamically discovered `.tsx` handlers compile with the JSX runtime.

## What you can build

- [JSX with Hyperion](jsx/with-hyperion.md). Use JSX views as `@hyperion-js/core` handler templates or inline responses.
- [Embeds and text](jsx/embeds.md). Titles, fields, mentions, and Markdown formatting components.
- [Buttons and menus](jsx/message-components.md). Action rows, buttons, and select menus.
- [Layout messages](jsx/layout-messages.md). Messages built from containers, text displays, media galleries, sections, and interactive controls.
- [Modals](jsx/modals.md). Modal forms, including pre-filled inputs, select menus, and file uploads.

## How rendering works

A JSX view evaluates synchronously each time you call a render function, returning fresh builder instances so mutating a rendered builder never affects other messages. Arrays, fragments, and conditional expressions work like standard JSX; use `<Br />` for line breaks and `{" "}` when you need an explicit space between adjacent elements.

Keep four runtime differences from React in mind:
- There are no hooks, component state, intrinsic HTML tags (`<div>`), or event-handler props (`onClick`); unknown props throw `JSXRenderError`.
- `null`, `undefined`, and booleans are omitted, while `0` renders as `"0"` (avoid `{count && ...}` when `count` can be zero).
- Promises and prebuilt `@discordjs/builders` instances cannot be passed as children; fetch async data before rendering and pass it as props.
- Keep a single installed copy of `@hyperion-js/jsx`, because JSX elements use module-private identity checks.

Structural violations throw `JSXRenderError` with a `path` to the invalid element; errors thrown by native builders or your own function components attach the original error as `cause`.

> [!WARNING]
> The attached `cause` may include user-provided values from your props, so avoid logging `cause` verbatim when handling sensitive input.

For every prop and validation rule, see the [JSX reference](../jsx.md).
