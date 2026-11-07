# Writing style for the human guide

Hyperion keeps two kinds of documentation:
- **Reference docs** (`docs/*.md`): precise contracts for contributors and coding
  agents. Dense is fine; completeness matters more than flow.
- **The guide** (`docs/guide/`): written for people building bots. It should read
  like a knowledgeable friend explaining things, not like a specification.
  Readers use [the docs site](https://hyperion-docs-6h7.pages.dev), so write for
  how a page renders there. It only needs to stay readable on GitHub.

This page covers the guide. When a feature changes, update the reference doc
first, then the matching guide page. The guide may leave details out; it must
never contradict the reference docs.

The voice is modelled on the [discord.js guide](https://discordjs.guide/).

## Voice

- Talk to the reader as "you". Use "we" sparingly, for walking through something
  together ("Let's add a guard").
- Use contractions: "you'll", "don't", "it's".
- A slight informal touch is welcome: a short aside in parentheses, a "that's
  it", a "Sounds good? Great!". One per section at most; never jokes in warnings.
- Prefer active voice. "Hyperion loads your buttons" beats "Buttons are loaded".
- Say what things _do_, not what they _don't_. Lists of negatives ("does not
  retain state, callbacks, sessions, or timers") become one positive sentence
  ("Handlers don't remember anything between clicks").

## Hyperion, not discord.js

The guide assumes readers already know discord.js: replying, deferring, builders,
reading interaction values, and Discord's own rules and limits. Teach only what
Hyperion adds or changes.
- Don't restate discord.js or Discord behaviour, such as the three-second
  deadline, how to read a picked user, or which builder makes a message command.
  When the reader needs it, link the
  [discord.js guide](https://discordjs.guide/) or
  [docs](https://discord.js.org/docs) in one sentence.
- Keep a Discord fact only when Hyperion acts on it, such as the 100-character
  custom ID limit it checks for you.

## Page shape

1. **Open with motivation.** One or two sentences: what problem this solves, often
   by comparison with something the reader already knows ("You've probably sent
   buttons with discord.js before…").
2. **Show code early.** A complete, copyable example comes before the details.
3. **Explain after the code.** Short paragraphs that point at what the example did.
4. **Caveats last**, as short bullets or a single "Watch out" alert.

Each section follows the same rhythm: a one-line definition, the API to use, an
example, then notes.

## Page types

Pick the type from the question the reader arrives with. Most pages are feature
pages; the others are for questions a feature page answers badly.

| Type            | Reader's question                      | Example                                                  |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| Overview        | "What's here, and where do I start?"   | [README.md](guide/README.md)                             |
| Feature page    | "How does this part of Hyperion work?" | [buttons.md](guide/buttons.md)                           |
| How-to          | "How do I get this one thing done?"    | [persistent-cooldowns.md](guide/persistent-cooldowns.md) |
| Troubleshooting | "Why am I seeing this error?"          | [troubleshooting.md](guide/troubleshooting.md)           |

**Overview.** One short paragraph on what Hyperion is, then the page list in
groups, each link with a few words on what it covers. No code.

**Feature page.** The page shape above. One feature per page: if the title needs
"and", it's two pages. Headings follow the reader's path through the feature
("Sending the button", "Changing the button after a click"), not the API's
structure.

**How-to.** One task with a clear end, such as "Keeping cooldowns across restarts".
- Title it with the task, imperative or "-ing" ("Moving a command into a
  group").
- Intro: at most two sentences saying what you'll have at the end.
- Numbered steps, about ten at most; split a longer task into phases with
  headings. Each step is one action, with its code.
- Finish with how to check it worked. Before a step that's hard to undo, like
  deploying commands or migrating a database, say what to check first and what
  to do if it's wrong.
- Link the feature page for the why; don't explain it here.

**Troubleshooting.** One error per section.
- Title the section with the exact message the reader sees, so searching for it
  lands here.
- Then the cause in one or two sentences, and the fix as code or steps.
- Only errors Hyperion or Discord actually produce. Copy the message from the
  code, and link the reference doc that owns it.

### Before you finish a page

- Every behaviour the page states matches the code and the reference doc. Never
  describe behaviour you haven't checked; find the real value or leave it out.
- Code blocks compile (`pnpm check`), or are tagged `fragment` on purpose.
- The page has one home in the [duplication table](#avoid-duplication); other
  pages link to it instead of repeating it.
- A new page is listed in [README.md](guide/README.md) and in the site sidebar
  (`apps/docs-site-fumadocs/scripts/stage.mjs`). Adding it there is part of
  shipping it.

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
  "Guards". Not questions, not full sentences.
- Sentence case.

## Words

- "Discord" (capitalised) is the platform; "discord.js" (lowercase) is the library.
- Plain verbs: send, reply, defer, show, click, pick, load.
- Use the [glossary](GLOSSARY.md) terms (handler, guard, custom ID, params,
  template), but explain them in passing instead of linking the glossary at the
  top of every page.
- Name the thing the reader types: `defineButton()`, `defineGuard()`, not "the
  component-handler abstraction".

## What to leave out

These belong in reference docs, ADRs, or git history, not the guide:
- Implementation details (staging, atomic replacement, declaration merging).
- Verification criteria, test plans, "in this PR", "existing", "now", "remains
  unchanged". The guide describes how things work, not how they changed.
- Defensive disclaimers ("this is not a claim of…").
- Exhaustive lists of log events or validation rules. Link the reference doc.

## Examples

- Import from `@hyperion/core` and `@hyperion/jsx`, never old package names.
- Use self-contained examples that readers can adapt to their own bots.
  `pnpm check` compiles every `ts`/`tsx` block as its own module, so include its
  imports. Tag a deliberately partial block, such as one that uses `ctx` or a
  name from an earlier block, ` ```ts fragment ` to skip it.
- Keep comments short and useful: `// Runs once per click`.
- Write install commands as a ` ```npm ` block with an `npm install` line. The
  site shows it as npm, pnpm, and bun tabs.

## Callouts and file trees

The guide is plain Markdown, and these forms render as components on the site:
- **Callouts:** a GitHub alert blockquote. Use `[!WARNING]` for something that
  can lose data or surprise the reader (it shows as "Watch out"), `[!TIP]` for a
  shortcut, and `[!NOTE]` sparingly for an aside. One per section at most.

  ```md
  > [!WARNING]
  > Deploying replaces _all_ commands in that scope.
  ```

- **File trees:** a ` ```files ` block drawn with `├──`, `│`, and `└──`, with a
  trailing `/` on folders. Put only names in it; anything else on a line becomes
  part of the name, so a tree that maps files to something (like command names)
  stays a ` ```text ` block.

## Avoid duplication

Each topic has one home in the guide. Other pages link to it in one sentence.
A package README introduces the package, shows one or two examples, and links to
the guide; it doesn't repeat the guide.

| Topic                                  | Home                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| Replying, deferring, and error replies | [responding.md](guide/responding.md)                     |
| Guards and their state                 | [guards.md](guide/guards.md)                             |
| Data in custom IDs                     | [custom-ids.md](guide/custom-ids.md)                     |
| Typed input                            | [input.md](guide/input.md)                               |
| JSX setup and rendering                | [jsx.md](guide/jsx.md)                                   |
| Embed text and reusable JSX views      | [embeds.md](guide/jsx/embeds.md)                         |
| JSX buttons and menus                  | [message-components.md](guide/jsx/message-components.md) |
| Layout messages                        | [layout-messages.md](guide/jsx/layout-messages.md)       |
| JSX with Hyperion handlers             | [jsx-with-hyperion.md](guide/jsx-with-hyperion.md)       |
| JSX form authoring                     | [modals.md](guide/jsx/modals.md)                         |
| Logging                                | [logging.md](guide/logging.md)                           |
| Storing data, tables, and key-value    | [storing-data.md](guide/storing-data.md)                 |
| Startup errors and their fixes         | [troubleshooting.md](guide/troubleshooting.md)           |

## Example rewrite

> **Before:** Use a component handler to process button clicks. Hyperion stores
> handler definitions for routing, but does not retain per-message state,
> callbacks, sessions, timers, or update queues.
>
> **After:** A button handler runs when someone clicks a button your bot sent.
> Handlers don't remember anything between clicks, so if a button needs data
> (like which ticket it closes), put it in the custom ID or your own storage.
