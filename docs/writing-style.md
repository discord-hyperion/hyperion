# Writing style for the human guide

`docs/guide/` is direct technical documentation for developers building bots.
Readers use [the docs site](https://hyperion.favteo.com), so write for how a
page renders there while keeping it readable on GitHub.

When user-facing behavior changes, update the matching guide page. The guide may
leave details out; it must never contradict the implementation.

## Voice

- Address the reader as "you" and use direct imperatives ("Add a guard", "Set
  `root` explicitly"). Do not use "we" or "Let's…".
- Keep prose direct and plainspoken. Avoid banter, chatty filler ("that's it",
  "Sounds good? Great!"), and parenthetical asides.
- Contractions are optional where natural, never forced.
- Prefer active voice. "Hyperion loads your buttons" beats "Buttons are loaded".
- Say what things _do_, not lists of what they _don't_. "Handlers don't store
  state between clicks" beats "does not retain state, callbacks, sessions, or
  timers".

### Anti-slop guardrails

| Avoid                                                                                         | Prefer                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Meta-narration ("In this section…", "This guide walks you through…", "Let's take a look at…") | State what the feature or step does directly ("Create a bot that responds to `/ping`.") |
| Filler transitions ("It's worth noting…", "Simply put…", "Under the hood…")                   | Drop the throat-clearing and state the fact                                             |
| Rhetorical questions as headings or transitions ("Need to share state?")                      | Noun or task headings and direct conditions ("To share state across handlers, pass…")   |
| Contrast-formula padding ("Not just X — it's Y", "Whether you're A or B…")                    | One plain statement of scope or behavior                                                |
| Hedging ("You might want to consider…")                                                       | Direct guidance ("Use `defer: true` when…")                                             |

## Hyperion, not discord.js

The guide assumes readers already know discord.js: replying, deferring, builders,
reading interaction values, and Discord's own rules and limits. Teach only what
Hyperion adds or changes.
- Don't restate discord.js or Discord behavior, such as the three-second
  deadline, how to read a picked user, or which builder makes a message command.
  When the reader needs it, link the
  [discord.js guide](https://discordjs.guide/) or
  [docs](https://discord.js.org/docs) in one sentence.
- Keep a Discord fact only when Hyperion acts on it, such as the 100-character
  custom ID limit it checks for you.

## Page shape

1. **Open directly.** One or two sentences stating what the feature does and when
   to use it. Skip conversational hooks.
2. **Show code early.** Put a complete, compiling primary example before the
   details.
3. **Explain what matters right after.** Short paragraphs pointing at the
   important choices and behavior.
4. **Caveats last**, as short bullets or a single callout.

Each section follows the same rhythm: a one-line definition, the API to use, an
example, then notes.

## Page types

Pick the type from the question the reader arrives with. Most pages are feature
pages; the others are for questions a feature page answers badly.

| Type            | Reader's question                                        | Example                                                  |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Overview        | "What's here, and where do I start?"                     | [README.md](guide/README.md)                             |
| Feature page    | "How does this part of Hyperion work?"                   | [buttons.md](guide/buttons.md)                           |
| How-to          | "How do I get this one thing done?"                      | [persistent-cooldowns.md](guide/persistent-cooldowns.md) |
| Troubleshooting | "Why am I seeing this error?"                            | [troubleshooting.md](guide/troubleshooting.md)           |
| FAQ             | "Does Hyperion support X, or why does it work this way?" | [faq.md](guide/faq.md)                                   |

**Overview.** One short paragraph on what Hyperion is, then the page list in
groups, each link with a few words on what it covers. No code.

**Feature page.** The page shape above. One feature per page: if the title needs
"and", split it unless the two halves share one lifecycle. Headings follow the
reader's path through the feature ("Sending the button", "Updating the button
after a click"), not the API's structure.

**How-to.** One task with a clear end, such as "Keeping cooldowns across restarts".
- Title it with the task, imperative or "-ing" ("Confirming destructive actions").
- Intro: one or two sentences stating what the task builds.
- Numbered steps, about ten at most; split a longer task into phases with
  headings. Each step is one action, with its code.
- Finish with how to verify it worked. Before a step that's hard to undo, like
  deploying commands or migrating a database, say what to check first and what
  to do if it's wrong.
- Link the feature page for the why; don't repeat it here.

**Troubleshooting.** One error per subsection, grouped under `##` categories.
- Title the subsection with the exact message the reader sees, so searching for
  it lands here.
- State the cause in one or two sentences, then the fix as code or steps.
- Only errors Hyperion or Discord actually produce. Copy the message from the
  code, and link the owning guide page.

**FAQ.** Adoption and architecture questions ("why / does it support / how does
it fit"). Question-phrased `##` headings are the deliberate format on this page.
Keep each answer to one short direct paragraph with links to owning pages.

### Before you finish a page

- Every behavior the page states matches the implementation. Never describe
  behavior you haven't checked; find the real value in the code or leave it out.
- Primary examples compile (`pnpm check`); focused follow-up excerpts are tagged
  `fragment` on purpose.
- The page has one home in the [duplication table](#avoid-duplication); other
  pages link to it instead of repeating it.
- A new or renamed page is synced in [README.md](guide/README.md) and the site
  scripts (`apps/docs-site-fumadocs/scripts/stage.mjs`, `lib/shared.js`,
  `scripts/check-site.mjs`).

## Sentences and paragraphs

- Two to four sentences per paragraph.
- One idea per sentence. If a sentence has three commas and a semicolon, split it.
- Go easy on inline code. A sentence with more than two code spans reads like a
  spec: move the code into a block, and say what it does in words. Write
  "the handler's template" rather than `` `builder` ``, unless the reader has to
  type the name.
- Show type arguments and variations as a short code block with a comment per
  line, not as code in a sentence.
- List options, properties, or "this becomes that" mappings in a table, not a
  paragraph.
- Explain jargon the first time, or avoid it. Prefer "checks run before your
  handler" to "pre-handler execution checks".
- Bullets are for parallel items (options, caveats). Don't turn reasoning into
  bullet lists.

## Headings

- Noun phrases or short task phrases: "Buttons with data", "Sending a menu",
  "Guards". Not full sentences, and not questions outside [FAQ](guide/faq.md).
- Sentence case.

## Terminology

Use canonical [glossary](GLOSSARY.md) terms strictly for Hyperion-specific
concepts. Use plain English for spec-level contract terms (`authoring component`,
`event occurrence`, `guard provider`, `invocation`, `validated * input`) while
honoring every `_Avoid_` ban in the glossary. Explain terms in passing rather
than linking the glossary at the top of every page.
- "Discord" (capitalized) is the platform; "discord.js" (lowercase) is the
  library.
- Plain verbs: send, reply, defer, show, click, pick, load.
- Name what the reader types: `defineButton()`, `defineGuard()`, not "the
  component-handler abstraction".

| Concept                                  | Guide term                                                    | Bridge (if any)                                                                                              | Avoid                                    |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `/` command                              | slash command                                                 | One `(also called chat-input commands)` bridge on [commands.md](guide/commands.md)                           | message-content command                  |
| Folder grouping commands                 | command category                                              | —                                                                                                            | category folder, subcommand group        |
| Parent / group `index.ts`                | parent definition, group definition                           | —                                                                                                            | subcommand handler                       |
| Pre-handler check                        | guard                                                         | —                                                                                                            | precondition, autocomplete filter        |
| Handler vs. Discord widget               | button/select-menu/modal handler vs. button/select menu/modal | —                                                                                                            | conflating handler and control           |
| Shared `builder` on a handler            | template                                                      | —                                                                                                            | view, form factory                       |
| Controls inside a modal                  | modal control                                                 | Reserve `field` for embed fields and schema keys                                                             | form field, modal field                  |
| First segment of parameterized custom ID | route                                                         | Reserve `prefix` for numeric event prefixes and legacy prefix commands                                       | handler ID, route prefix, prefix         |
| Encoded custom-ID values                 | custom-ID params (`params`)                                   | —                                                                                                            | payload, state                           |
| Components V2 message / block            | layout message, layout component                              | One `(known in Discord's API as Components V2)` bridge on [layout-messages.md](guide/jsx/layout-messages.md) | Components V2 message, display component |
| Only-visible-to-sender reply             | ephemeral (`ephemeral reply`, `ephemeral follow-up`)          | —                                                                                                            | private reply                            |

## What to leave out

These belong in code, ADRs, or git history, not the guide:
- Implementation details (staging, atomic replacement, declaration merging).
- Verification criteria, test plans, "in this PR", "existing", "now", "remains
  unchanged". The guide describes how things work, not how they changed.
- Defensive disclaimers ("this is not a claim of…").
- Exhaustive lists of log events or validation rules.

## Examples

- Import from `@hyperion-js/core`, `@hyperion-js/jsx`, and `@hyperion-js/sqlite`,
  never old package names.
- Use complete, compiling `ts`/`tsx` blocks for the first/primary example of a
  handler or setup pattern on a page and for full how-to steps. `pnpm check`
  compiles every untagged `ts`/`tsx` block as its own module, so include its
  imports.
- Tag focused follow-up snippets, call-site excerpts, and option/type variations
  ` ```ts fragment ` (or ` ```tsx fragment `) when repeating imports and wrapper
  boilerplate would obscure the point.
- Keep comments short and useful: `// Runs once per click`.
- Write install commands as a ` ```npm ` block with an `npm install` line. The
  site renders it as npm, pnpm, and bun tabs.

## Callouts, file trees, and diagrams

The guide is plain Markdown, and these forms render cleanly on both the docs site
and GitHub:
- **Callouts:** Use four GitHub alert types and drop `[!IMPORTANT]`:
  - `[!CAUTION]` for guaranteed breakage, startup failure, or destructive
    overwrites (such as deploying replacing all commands in a scope, or calling
    `addSubcommands()` on a parent builder).
  - `[!WARNING]` (renders as "Watch out") for non-obvious runtime behavior or
    gotchas (such as command guards not protecting component clicks, or handlers
    not storing state between clicks).
  - `[!TIP]` for shortcuts or cross-links to stronger patterns.
  - `[!NOTE]` sparingly for supplementary context.
  - Use at most one callout per section, and never stack two callouts
    back-to-back.

  ```md
  > [!CAUTION]
  > Deploying overwrites every command in the target scope.
  ```

- **File trees:** Use a ` ```files ` block drawn with `├──`, `│`, and `└──`, with
  a trailing `/` on folders. Put only file and folder names in `files` blocks;
  anything else on a line becomes part of the name.
- **Diagrams:** Use plain-Markdown ` ```text ` blocks for flows, annotated trees,
  and round-trips, and GFM tables for lookup matrices (never Mermaid). Keep
  `text` diagram lines under ~68 characters and blocks under ~15 lines so they
  do not wrap or scroll horizontally. Give each mental model one home in the
  [duplication table](#avoid-duplication), and follow each diagram with two or
  three direct sentences covering non-obvious rules the diagram cannot express
  alone.

## Avoid duplication

Each topic has one home in the guide. Other pages link to it in one sentence.
A package README introduces the package, shows one or two examples, and links to
the guide; it doesn't repeat the guide.

| Topic                                                             | Home                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| Startup flow, interaction pipeline, responding, and error replies | [how-hyperion-works.md](guide/how-hyperion-works.md)     |
| Command folder routing and subcommand guard inheritance           | [commands.md](guide/commands.md)                         |
| Shared handler templates vs. `build()` copies                     | [buttons.md](guide/buttons.md)                           |
| Guards and their state                                            | [guards.md](guide/guards.md)                             |
| Data in custom IDs and stateless `params` round-trip              | [custom-ids.md](guide/custom-ids.md)                     |
| Typed input                                                       | [input.md](guide/input.md)                               |
| JSX setup and rendering                                           | [jsx.md](guide/jsx.md)                                   |
| JSX with Hyperion handlers                                        | [with-hyperion.md](guide/jsx/with-hyperion.md)           |
| Embed text and reusable JSX views                                 | [embeds.md](guide/jsx/embeds.md)                         |
| JSX buttons and menus                                             | [message-components.md](guide/jsx/message-components.md) |
| Layout messages                                                   | [layout-messages.md](guide/jsx/layout-messages.md)       |
| JSX form authoring                                                | [modals.md](guide/jsx/modals.md)                         |
| Logging                                                           | [logging.md](guide/logging.md)                           |
| Storing data, tables, and key-value                               | [sqlite.md](guide/sqlite.md)                             |
| Startup errors and their fixes                                    | [troubleshooting.md](guide/troubleshooting.md)           |

## Example rewrite

> **Before:** Use a component handler to process button clicks. Hyperion stores
> handler definitions for routing, but does not retain per-message state,
> callbacks, sessions, timers, or update queues.
>
> **After:** A button handler runs when someone clicks a button your bot sent.
> Handlers do not store state between clicks, so put per-message data (such as a
> ticket ID) in the custom ID or your own storage.
