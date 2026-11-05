# JSX authoring

`@hyperion/jsx` is a JSX runtime that renders native Discord builders for
embeds, modals, message controls, and layout messages. It depends on neither
`@hyperion/core` nor React. Implementation lives in `packages/jsx/lib`; workspace
imports resolve source, and published imports resolve JavaScript and declarations
in `dist`. See [runtime research](research/jsx-runtimes.md) for why it is a
Hyperion-owned runtime.

## Renderers

Every renderer evaluates its view at call time and returns fresh native builders,
validated with `toJSON()`.

| Renderer                                                                  | Returns                     | Reference                                       |
| ------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| `renderEmbed(view)`                                                       | `EmbedBuilder`              | [Embeds](#embeds)                               |
| `renderComponents(view)`                                                  | `ActionRowBuilder[]`        | [Message components](jsx-message-components.md) |
| `renderButton(view)`                                                      | a custom-ID button builder  | [Message components](jsx-message-components.md) |
| `renderStringSelect(view)`                                                | `StringSelectMenuBuilder`   | [Select menus](jsx-select-menus.md)             |
| `renderUserSelect(view)` and the role, mentionable, and channel renderers | the matching select builder | [Select menus](jsx-select-menus.md)             |
| `renderModal(view)`                                                       | `ModalBuilder`              | [Modals](jsx-modals.md)                         |
| `renderMessage(view)`                                                     | `{ components, flags }`     | [Layout messages](jsx-layout.md)                |

There is no standalone text renderer and no classic `createElement` API. Native
builders stay fully supported; returned builders can be changed through native
APIs, and changes made after rendering should be validated again before sending.

## Setup

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.jsx"]
}
```

`react-jsx` names the automatic transform; it adds no React dependency. Authoring
imports use the package root; the compiler imports the `jsx-runtime` and
`jsx-dev-runtime` subpaths, both public.

Include dynamically discovered handlers in the runner's compiler configuration,
not only the entry point. From the workspace root, use its JSX-aware configuration
or pass the application's config with `tsx --tsconfig`. Source execution needs no
build; compile to JavaScript for plain Node.

The package targets Node 24.17.0+ and TypeScript 7.x. It declares the exact
matching `@discordjs/builders` prerelease as a peer dependency and depends on the
matching `@discordjs/formatters` prerelease. Other SDK versions are unverified.

## Handler discovery

Core discovers `.tsx` and `.jsx` handlers alongside `.ts` and `.js` once the
compiler configuration above is in place; there is no framework flag. Test,
declaration, and barrel exclusions apply unchanged, as do command parent/group
indexes and numeric event priorities. See [architecture](architecture.md).

## Runtime behaviour

- Components are synchronous functions of props. Reusable components are
  re-evaluated on every render; results are never cached.
- Children flatten through arrays and fragments. `null`, `undefined`, and booleans
  are omitted; zero is kept. JSX whitespace rules apply; use `Br` or explicit
  string spaces for intentional breaks.
- Props are shallow, read-only snapshots. Objects and arrays inside them remain
  application-owned and are not frozen.
- Unknown props throw. `key` is accepted as ignored metadata: it is not passed to
  components and does not affect output.
- Promises, prebuilt builders, and arbitrary objects as children throw; fetch
  asynchronous data before rendering. A component passed as a child instead of
  rendered (`{Card}` for `<Card />`) throws its own message.
- Nesting is limited to 128 levels, counting arrays and component calls as well as
  elements, so recursive structures throw instead of exhausting the stack.
- Elements are recognized by module-private identity. Elements from one installed
  copy of `@hyperion/jsx` are rejected by another copy (for example when two
  versions are installed), so keep a single version in an application.

## Embeds

```tsx
import { Bold, Br, Embed, Link, renderEmbed, UserMention } from "@hyperion/jsx";

const embed = renderEmbed(
    <Embed color={0x57f287} timestamp={new Date()}>
        <Embed.Title>{todo.name}</Embed.Title>
        <Embed.Description>
            <Bold>Assigned to</Bold> <UserMention id={todo.assigneeId} />
            <Br />
            {todo.description}
            <Br />
            <Link href={todo.url}>View todo</Link>
        </Embed.Description>
        <Embed.Field name={<Bold>Deadline</Bold>} inline>
            {todo.deadline ?? "None"}
        </Embed.Field>
        <Embed.Footer text="Hyperion Todos" />
    </Embed>,
);
```

- `Embed` takes `color`, `url`, and `timestamp`, with `Embed.Author` (`name`,
  `url?`, `iconURL?`), `Embed.Title`, `Embed.Description`, `Embed.Field` (`name`,
  `inline?`, value children), `Embed.Thumbnail` (`url`), `Embed.Image` (`url`),
  and `Embed.Footer` (`text`, `iconURL?`) children.
- The root may be fragments or reusable components but must resolve to exactly one
  `Embed`. Empty roots, several embeds, and text outside the embed throw.
- Fields may repeat and may be composed or mapped; order is preserved. Every other
  section is a singleton, and a duplicate throws instead of replacing the first.
- Descriptions and field values take rich text (see below). Field names take rich
  text through the `name` prop, with the same escaping. Titles take plain children
  (strings, numbers, fragments, or components returning plain text); author names
  and footer text are plain string props. Plain contexts keep text literal without
  Markdown escaping and reject formatting components.
- A builder validates one embed. Discord's 6,000-character limit spans every embed
  in a message, which a single-embed renderer cannot check.

## Text composition

`Bold`, `Italic`, `Underline`, `Strikethrough`, `Spoiler`, `Br`, `Code`,
`CodeBlock`, `Link`, `Raw`, `UserMention`, `RoleMention`, and `ChannelMention` work
in embed descriptions and field values, modal text displays, and layout
`TextDisplay`s. `H1`–`H3` and `Subtext` add line-level formatting; see
[layout messages](jsx-layout.md#headings-and-subtext).
- Literal text is Markdown-escaped: backslashes and the punctuation used for
  formatting, links, headings, and lists. Escaping applies to literal text only,
  never a second time to generated formatting. Unicode and compiler whitespace are
  kept.
- The renderer escapes each literal before composing, because the SDK's
  `escapeMarkdown()` recognizes only complete constructs: two separate `"|"`
  children would otherwise join into `"||"`, and isolated brackets would break a
  link label.
- `Code` rejects backticks and line breaks; `CodeBlock` rejects triple backticks.
  Code is kept, not escaped. `CodeBlock.language` is one identifier of letters,
  digits, underscores, plus signs, or hyphens. `Raw`, `Code`, and `CodeBlock` take
  string content.
- `Link` takes absolute HTTP(S) URLs only. Characters that break masked-link syntax
  are encoded, labels are escaped separately and may be formatted, and nested links
  throw. Image and icon URLs follow native rules instead, including attachment URLs.
- Mention IDs are non-empty digit strings. That checks syntax, not that the user,
  role, or channel exists. Mentions don't override `allowedMentions`; set it on the
  response.
- `Raw` bypasses escaping deliberately.

Formatting delegates to `@discordjs/formatters` after these checks (italic uses
the SDK's `_text_` form). The SDK helpers don't enforce the code-delimiter,
HTTP(S), link-nesting, or mention-ID rules, so those checks stay in Hyperion.

## Errors and validation

Failures throw `JSXRenderError` with a structural `path` and the original `cause`.
When an application component throws, the message names the component (its
function name) at the parent's path. Generated messages never include supplied
text; native causes and errors thrown by application components can. The package
never logs.

Renderers call native `toJSON()` without an override, so they respect the global
validator setting. JSX structural checks (nesting, unknown props, singletons,
duplicate IDs) stay active when native validators are disabled. Native setters can
fail before serialization; for example, timestamp setters.

The pinned v15 install exports `EmbedBuilder` from `@discordjs/builders`, not
`discord.js`.

## Performance

`packages/jsx/benchmarks` compares rendering with equivalent native builders,
recording runtime versions and separating tree creation, rendering, and
validation. It measures overhead; it makes no speed claims.

Sources: installed `@discordjs/builders` and `@discordjs/formatters`;
[Discord Markdown guide](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline),
[message formatting](https://docs.discord.com/developers/reference#message-formatting),
and the [embed reference](https://docs.discord.com/developers/resources/message#embed-object).
