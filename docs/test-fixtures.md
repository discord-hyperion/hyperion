# Interaction test fixtures

Use the [shared factories](../tests/fixtures/interactions.ts) for ordinary
interaction doubles. They are test-only structural objects, with an explicit set
of native Discord predicates and no clients, webhooks, or REST requests.

```ts
import { createButtonInteraction } from "./fixtures/interactions.ts";

const fixture = createButtonInteraction({ customId: "profile.refresh" });
await dispatcher.dispatch(fixture.interaction);
assert.equal(fixture.editReply.mock.callCount(), 1);
```

Factories cover chat-input, user-context, message-context, button, modal, and
autocomplete interactions. `createSelectInteraction(ComponentType.UserSelect, data)`
selects the matching typed interaction for any of the five supported select kinds.
Every call creates fresh acknowledgment state and mock histories.

Supply scenario data explicitly: options and focused-option resolvers, selected
values, resolved Collections, context-menu targets, and modal component resolvers.
Missing methods are not silently stubbed. Native predicates use discriminants such
as `type`, `commandType`, and `componentType`; mismatched-routing tests can alter
the appropriate discriminant explicitly instead of rewriting predicate logic.

## Responses and state

Inspect and customize the exposed Node mock handles. The interaction's response
methods wrap those effects and update state only after successful completion:

```ts
const fixture = createButtonInteraction({ customId: "profile.refresh" });
fixture.reply.mock.mockImplementation(async () => {
    throw new Error("Interaction expired");
});

await assert.rejects(fixture.interaction.reply("Test"));
assert.equal(fixture.interaction.replied, false);
```

Successful custom implementations still update acknowledgment state. Deferred
message updates retain `ephemeral === null`; deferred replies derive visibility
from their flags. Autocomplete tracks `responded` independently. These helpers do
not reproduce SDK acknowledgment errors or validate response payloads.

Initial state can be supplied with `deferred`, `replied`, `ephemeral`, or
`responded` where appropriate. Use a fresh fixture for each independent interaction.
Unsupported interaction methods remain absent; negative-call mock handles may
still be exposed so tests can assert that they were not used.

Keep intentionally malformed doubles local when their shape is the subject of
the test. Client setup, temporary filesystem helpers, and log capture remain
separate from interaction construction. The fixture contract tests verify shared
predicate/state behavior; framework tests retain their routing and guard assertions.

## Core test helpers

Framework tests in `packages/core/tests` share helpers from `tests/support/`.
Reuse them before writing a local setup:
- `test-client.ts`: `createTestClient(t, { level? })` creates a client on the
  empty-bot root, captures structured log `records`, returns a dispatcher, and
  destroys the client when the test ends.
- `temp-root.ts`: `createTempRoot(t, prefix)` and
  `createHandlerRoot(t, prefix, folder)` create temporary bot roots that are
  removed when the test ends. `writeHandler(directory, source, name?)` writes a
  handler module under a fresh filename; use it whenever a test changes a module
  between loads, because Node caches ES modules by path.
- `acknowledgment.ts`: `phases` and `assertPrivateFailure` check the private
  failure reply for each acknowledgment state.
- `select-kinds.ts` and `component-kinds.ts`: tables describing the five select
  kinds and the button, modal, and select-menu registry kinds.

When several handler kinds share a behaviour, add the case to the table-driven
suite (`select-menu-kinds.test.ts` for dispatch, `component-registry.test.ts`
for discovery) and keep kind-specific cases in the kind's own file. Extend a
kind's table entry instead of copying a test file.
