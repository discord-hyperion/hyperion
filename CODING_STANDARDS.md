# Coding standards

Reviewers enforce these. Biome (`biome.json`) already enforces the mechanical
rules (import extensions, `import type`, `type` over `interface`, arrow function
expressions, no `public`, formatting), so they are not repeated here.

## Structure

- Handlers (commands, components, events) are classes, because discovery loads
  default-exported subclasses. Prefer shared implementations or generic types over
  empty `Base<X>` subclasses.
- Guards are execution checks, not handlers: define them with `defineGuard()` and
  closures ([ADR 0003](docs/adr/0003-guards-are-definitions-not-classes.md)).
- Use Discord's `Collection` for keyed stores, including tests and examples;
  arrays, sets, and weak maps suit their own purposes.
- Use the installed discord.js v15 types and APIs, ESM, and NodeNext resolution.

## Naming

- kebab-case files and directories, PascalCase classes and types, camelCase
  functions and variables (including guard values like `ownerOnly`).
- Command folder delimiters follow [command paths](docs/command-paths.md); event
  folders use Discord's event-name casing ([event handlers](docs/event-handlers.md)).

## Functions and types

- Prefer arrow functions for standalone functions, callbacks, and type signatures
  (`run: (ctx: Context) => Promise<void>`). Keep normal class methods. Use function
  declarations only when their semantics are required.
- Omit redundant `override` on implemented methods; keep modifiers that express
  required semantics. `noImplicitOverride` stays off.
- Infer implemented method return types. Keep explicit return types on abstract
  methods, overload signatures, and other contracts without implementations.
- Keep locals when they improve clarity, avoid repeated work, or provide type
  safety; inline one-off aliases of clear expressions such as `options.commands`.

## Layout

Group related statements and separate phases (validation, mutations, logging,
later operations) with a blank line, following the registry loaders.

Group simple assignments, and separate awaited results from them:

```ts
const x = 0;
const y = getY();
const z = y.z; // derived from y, so grouped with it

const result = await fetchResult();
const value = result.value;

this.total = x;
```

Give multi-line awaited calls (four or more lines) a blank line above and below.

Put a blank line before a function's `return` when the body has other statements:

```ts
const total = () => {
    let sum = 0;

    sum += values.length;

    return sum;
};
```

Separate consecutive blocks (`for`, `if`, `try`) with a blank line, except when one
block directly follows its opening keyword's body or chains with `else`/`catch`:

```ts
for (const entry of entries) {
    // …
}

if (queue.running) {
    // …
}
```

Give every braced `if` block a blank line above and below, except at the start or
end of the enclosing body and around its own `else` chain:

```ts
const entry = entries.get(name);

if (!entry.ready) {
    await entry.prepare();
}

entry.run();
```

Inline single statements only for `if` with `return`, `break`, `continue`, or a
plain assignment. Use braces for loops and for `throw`:

```ts
if (!x) return;
if (!y) continue;

for (const entry of entries) {
    entry.run();
}

if (invalid) {
    throw new TypeError("…");
}
```

Group consecutive inline guards together without blank lines between them.

## Documentation

- Behaviour changes update the reference doc (`docs/*.md`) and the matching guide
  page (`docs/guide/`), following [the writing style](docs/writing-style.md). The
  guide never contradicts the reference.
- Examples import from `@hyperion/core` and `@hyperion/jsx`.
