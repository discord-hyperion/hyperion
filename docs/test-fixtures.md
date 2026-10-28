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
