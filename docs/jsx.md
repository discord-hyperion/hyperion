# JSX authoring design

`@hyperion/jsx` is an independent JSX runtime for native Discord embeds. It has
no dependency on `@hyperion/core` or React. Implementation lives in
`packages/jsx/lib`; local workspace imports resolve source, and published imports
resolve JavaScript and declarations in `dist`.

## Current decisions

- Publish JSX authoring as a separate workspace package, `@hyperion/jsx`. This
  supersedes the earlier proposal to keep it inside `@hyperion/core`.
- Use namespaced structural components such as `Embed.Title` and `Embed.Field`.
- Limit this PR to embed authoring and the runtime/text composition needed for
  embeds. Defer standalone text rendering and modal rendering.
- Later modal authoring will initially cover text inputs and informational text;
  embedded selects and other controls remain deferred.

- Export `renderEmbed()` from `@hyperion/jsx`; each call returns a fresh native
  `EmbedBuilder`, validated with `toJSON()` and available for customization.
- Support root `color`, `url`, and `timestamp` props plus `Embed.Author`,
  `Embed.Title`, `Embed.Description`, `Embed.Field`, `Embed.Thumbnail`,
  `Embed.Image`, and `Embed.Footer` children.
- Permit repeated fields. Reject duplicate singleton sections with an error
  identifying the section instead of replacing earlier content.

- Support `Bold`, `Italic`, `Underline`, `Strikethrough`, `Spoiler`, `Br`, `Code`,
  `CodeBlock`, `Link`, `Raw`, `UserMention`, `RoleMention`, and `ChannelMention`
  inside embeds. Keep standalone `renderText()` deferred.
- Allow fragments and reusable components at the render root, provided they
  resolve to exactly one embed. Reject empty roots, multiple embeds, and text
  outside the embed. Allow composed/mapped fields inside an embed.

- Keep `@hyperion/jsx` usable independently of `@hyperion/core`; use compatible
  native builders without a runtime framework dependency.
- Include TSX handler discovery in this PR, opted into through JSX compiler
  configuration and `.tsx` files. Do not require a framework flag or development
  build. Verify command paths and event priorities as well as file discovery.

- Accept text composition in field names through the `name` prop, including
  formatting components; use the same escaping rules as field values.
- Keep titles, author names, and footer text plain. Preserve literal text without
  Markdown escaping and reject formatting components in these contexts.
- Reevaluate reusable components on every render; do not cache their results.
  Return independent builders. Expose read-only component props without
  deep-freezing application-owned objects passed through those props.

- Reject backticks and line breaks inside `Code`; reject triple backticks inside
  `CodeBlock`. Preserve code text rather than Markdown-escaping or rewriting it.
- Restrict `Link` destinations to absolute HTTP(S) URLs. Encode destination
  characters that interfere with masked-link syntax; escape labels separately.
  Keep native image/icon URL rules separate, including attachment URLs.
- Throw `JSXRenderError` with a structural path and original `cause`. Generated
  messages do not echo supplied text; native causes remain inspectable. Do not
  log automatically.

- Use the automatic JSX transform with `jsx: react-jsx` and
  `jsxImportSource: @hyperion/jsx`. Export production and development runtime
  subpaths; omit a classic `createElement` API from this PR.
- Discover both `.tsx` and `.jsx` handlers. Preserve test/declaration/barrel
  exclusions and command parent/group and event numeric-priority semantics.
- Integrate independent JSX versions/changesets, source/published exports,
  standalone packed consumers, and cache/release tooling in this PR. Actual
  publication remains a separate action.

- Reject unknown props at runtime. Accept JSX `key` as ignored metadata; it does
  not affect output or introduce reconciliation.
- Match core's initial Node 24.17.0+, TypeScript 7.x verification baseline and exact
  compatible builder prerelease. Declare the builder as a peer dependency.
  Additional SDK/version support requires separate verification.
- Include a reproducible comparison against equivalent native builders, recording
  runtime versions and separating tree creation, rendering, and validation where
  practical. Measure overhead without promising a speed advantage.

## Retained behavior

- Use a small Hyperion-owned runtime without React. Keep native builder authoring
  supported.
- Support synchronous reusable function components, props, children, fragments,
  conditionals, and array mapping. Fetch asynchronous data before composition.
- Evaluate components at explicit render time. This PR returns fresh native embed
  builders; standalone string and modal output remain future work.
- Flatten nested children; omit nullish values and booleans; preserve zero. Use
  normal JSX whitespace handling and explicit line breaks.
- Escape literal Markdown by default; expose explicit formatting, raw text, and
  mention components. Mention authoring does not override `allowedMentions`.
- Validate structural nesting at runtime and use native builder `toJSON()`
  validation while respecting the SDK validator setting. Report invalid output.
- Preserve shared modal definitions and existing handler routing. Inserting
  prebuilt builders, React lifecycle behavior, automatic rerendering, complete
  message layouts, buttons, and standalone select-menu authoring remain deferred.
- Verify automatic-runtime source and published consumption, opt-in TSX handlers,
  and performance before making compatibility or speed claims.

See [runtime research](research/jsx-runtimes.md), [architecture](architecture.md),
and [modals](modals.md) for the existing constraints and evidence.

## Public API example

```tsx
import { Bold, Br, Embed, Link, renderEmbed, UserMention } from "@hyperion/jsx";

const view = (
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
    </Embed>
);

const embed = renderEmbed(view);
```

Set `jsx` to `react-jsx` and `jsxImportSource` to `@hyperion/jsx` in the consumer's
TypeScript configuration. The option name does not introduce a React dependency.
Authoring imports use the package root. Compiler imports use the `jsx-runtime`
and `jsx-dev-runtime` subpaths.

## Verification and completion criteria

- Verify deferred evaluation, readonly props, nested arrays/fragments, conditional
  children, zero preservation, repeated component evaluation, and independent
  returned builders. Reject promises and unsupported objects/builders.
- Cover single-root enforcement, wrong nesting, duplicate singleton sections,
  unknown props, mapped field order, and ignored keys.
- Cover literal escaping, plain metadata, rich field names/values, raw text,
  mention formatting, explicit breaks, code delimiters, and encoded HTTP(S) links.
- Check native builder identity, response-type compatibility, native validation
  failures and causes, and respect for disabled SDK validators. A successful
  single-embed render does not validate an entire multi-embed reply.
- Verify production/development automatic runtimes and NodeNext types, including
  negative cases, without React or a required source-development build.
- Prove standalone source and packed consumption without core, with published
  JavaScript/declarations and no repository path aliases.
- Exercise TSX/JSX discovery exclusions, command parent/group indexes, module-name
  extraction, and numeric event priorities.
- Extend cache acceptance and independent release verification for the new
  package without publication. Keep bot tests isolated from private credentials,
  Discord login, and command deployment.
- Run required type, test, formatting, package, cache, and release checks, and
  record the equivalent-output native-builder benchmark.

These checks run without bot startup, private credentials, login, deployment, or
publication. The new package starts at 0.0.0; its minor changeset proposes its
first 0.1.0 release through the normal reviewed version workflow.

## Verified integration facts

Read-only investigation on 2026-10-31 established:
- The pinned v15 installation exports `EmbedBuilder` from `@discordjs/builders`,
  not from `discord.js`. Native `toJSON()` respects the global validation setting
  when called without an override. Timestamp setters can fail before serialization.
- A builder validates one embed's length. Discord's aggregate 6,000-character
  limit spans every embed in a message; a singular renderer lacks that message
  context and cannot establish full reply validity.
- Official Discord Markdown documentation does not provide a definitive
  per-embed-property formatting matrix or exhaustive code/link escaping grammar.
  Text-context and delimiter policies require explicit design and verification.
- TSX handler support touches shared discovery, command parent/group index
  classification and extension stripping, event numeric-priority parsing, and
  TypeScript inclusion/configuration. Changing discovery alone is insufficient.
- Consumer, cache, and release tooling currently assumes core/two packages in
  several places. Adding an independently publishable JSX package requires
  explicit source/packed runtime and declaration checks, cache coverage, and independent
  release-tooling coverage.

Sources: installed `@discordjs/builders` implementation/types;
[Discord Markdown guide](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline),
[message formatting](https://docs.discord.com/developers/reference#message-formatting),
[embed reference](https://docs.discord.com/developers/resources/message#embed-object);
`packages/core/src/util/discover-modules.ts`,
`packages/core/src/registries/parse-command-path.ts`,
`packages/core/src/events/load-event-handlers.ts`,
`scripts/verify-package.mjs`, `scripts/verify-cache.mjs`,
`scripts/check-release.mjs`, and `.github/workflows/publish.yml`.

## Configuration and diagnostics

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@hyperion/jsx"
    },
    "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.jsx"]
}
```

Include dynamically discovered handlers in the runner's compiler configuration,
not only the application entry point. When running from the workspace root, use
its JSX-aware configuration or select the application's config explicitly with
`tsx --tsconfig`. Source execution needs no preliminary build. Compile automatic
JSX to JavaScript for plain Node execution. Production and development automatic
runtime imports are both public subpaths.

`Embed.Author` accepts `name`, optional `url`, and optional `iconURL` props.
`Embed.Footer` accepts `text` and optional `iconURL`. `Embed.Image` and
`Embed.Thumbnail` accept `url`. Fields accept `name`, optional `inline`, and value
children. Plain titles accept literal child strings/numbers, fragments, and
components returning plain text. Author names and footer text are string props.

`Raw`, `Code`, and `CodeBlock` require string content. `CodeBlock.language`, when
provided, is a single identifier containing letters, digits, underscores, plus
signs, or hyphens. Code is preserved rather than escaped. Links may contain
formatted labels, but nested links are rejected; `Raw` deliberately bypasses
ordinary Markdown handling. Mention IDs must be nonempty digit strings. These
checks establish syntax, not the existence of Discord users, roles, or channels.

Literal Markdown escaping covers backslashes and punctuation used for formatting,
links, headings, and lists. It is applied only to literal text, not a second time
to generated formatting. It is not an authorization or mention-delivery policy:
set `allowedMentions` on the response as needed. Unicode and compiler-produced
whitespace remain unchanged; use `Br` or explicit string spaces when intentional.

Props are shallow snapshots and read-only; objects/arrays nested inside them
remain application-owned. Fetch async data before authoring/rendering. Promises,
prebuilt builders, and arbitrary object children are rejected. A nesting limit
rejects recursive component/child structures rather than exhausting the stack.
Keys are ignored metadata and are not passed to components.

`JSXRenderError.path` identifies structural context. Generated messages exclude
supplied text; native errors and errors thrown by application components remain
available through `cause` and can include supplied values. The package does not
log automatically. Native setters can fail before final serialization. Changes
made to returned builders should be validated again when sending the reply.

## Native formatter reuse

The package directly depends on the matching pinned `@discordjs/formatters`
prerelease. Formatting components delegate bold, italic, underline,
strikethrough, spoiler, inline code, fenced code, links, and mentions to its
helpers after JSX-specific validation. Italic uses the SDK's `_text_` syntax.

Literal escaping remains JSX-specific. The SDK's `escapeMarkdown()` recognizes
complete constructs: escaping two separate `"|"` children independently can
still concatenate to `"||"`. It also does not escape isolated brackets for use
inside a generated link label. The renderer escapes literal syntax characters
before composition so fragments cannot accidentally assemble Markdown.

SDK helpers format strings without enforcing this package's code-delimiter,
HTTP(S), link-nesting, or mention-ID constraints. These checks and structural
error paths remain in Hyperion. `Raw` remains the explicit escape hatch.
