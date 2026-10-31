# Modal input validation design

Modal handlers support optional Standard Schema validation and whole-input
resolution through the existing input pipeline.

## Handler and form ownership

- Retain the native `builder` on each modal handler. It supplies the shared
  default form and the custom ID used by the existing modal registry.
- Commands and components open the registered builder or render a fresh form
  with the same modal custom ID. Opening and submission are separate interactions.
- Keep form authoring separate from submission processing. Native builders and
  JSX remain alternative ways to author the form.

## Input contract

Use the existing [typed command input](input-validation.md) contract for modal
submissions with `defineInput({ schema, defer, resolve })`, a grouped `input`
configuration, `Modal<typeof input>`, and `ModalContext<typeof input>`. Preserve
the readonly `[issues, value]` handler contract and existing handlers without
input configuration.

Extract text-input values only. Other modal controls remain available
through native interaction getters; this feature does not add JSX controls.

Schemas remain explicit and independent of native builders or JSX forms. Form
constraints describe visible controls; schemas validate application input. Do
not generate schemas or inspect validator-specific internals.

Preserve empty strings without trimming or converting them to `undefined`.
Schemas own normalization, defaults, and application constraints.

Use guards → optional private deferral → extraction → schema validation → optional
whole-input resolution → handler. `defer: true` privately defers the submission
while preserving an existing acknowledgment. Omission or `false` leaves
acknowledgment to the application. Guards and resolvers receive the original
modal context without `ctx.input`.

Expected schema issues skip resolution and reach the handler as
`[issues, undefined]`. Success supplies `[null, value]`, using schema output when
there is no resolver and the complete resolver result otherwise. Schema/resolver
exceptions skip the handler and use the existing `input` error stage. Validation
responses remain handler-owned.

Extract text inputs from the actual submission, keyed by their exact custom IDs.
The registered default builder is not a field whitelist: personalized forms may
submit a different field structure. Missing controls produce absent keys; empty
submitted strings remain empty strings. Dotted IDs are literal keys rather than
nested object paths. The schema determines which fields are accepted or required.

Reject duplicate submitted text-input custom IDs as input-processing errors for
handlers with input validation configured. Do not silently accept the SDK's
last-value overwrite behavior. Preserve schema-free handler behavior.

Do not compare schema keys with the registered builder during discovery.
Validate builder/configuration structure without executing schemas or resolvers;
actual submission values are validated at invocation time.

Retain one `defineInput` helper without a `.modal()` method or curried call.
Modal resolvers that use invocation context annotate their second parameter as
`ctx: ModalContext`. Infer the first parameter from schema output and handler
input from resolver output. Existing command helper calls remain compatible;
definitions without resolvers need no context annotation.

```ts
const input = defineInput({
    schema,
    defer: true,
    resolve: async (values, ctx: ModalContext) => ({
        todo: await fakeApi.createTodo({
            ...values,
            ownerId: ctx.interaction.user.id,
        }),
    }),
});
```

For mixed-control forms, extract text inputs only. Ignore selects, uploads, and
other controls when constructing schema input, while preserving access through
native interaction getters. Do not reject a form merely for containing controls
outside the initial extraction scope.

An included text-input control must contain a string value. Missing or non-string
values on an included control are input-processing errors and skip schema
validation, resolution, and the handler. Do not coerce malformed values or treat
them as absent controls. An entirely absent control remains an absent key for
the schema to handle. Generated errors must not include submitted values.

## Complete handler example

```tsx
import {
    defineInput,
    Modal as ModalHandler,
    type ModalContext,
} from "@hyperion/core";
import { renderModal } from "@hyperion/jsx";
import * as v from "valibot";
import { TodoForm } from "../views/todo-form.tsx";

const input = defineInput({
    schema: v.object({
        name: v.pipe(v.string(), v.trim(), v.minLength(1)),
        description: v.optional(v.string(), ""),
    }),
    defer: true,
});

export default class extends ModalHandler<typeof input> {
    constructor() {
        super({ builder: renderModal(<TodoForm />), input });
    }

    async run(ctx: ModalContext<typeof input>) {
        const [issues, value] = ctx.input;
        if (issues) {
            await ctx.interaction.editReply({
                content: issues.map(issue => issue.message).join("\n"),
                allowedMentions: { parse: [] },
            });

            return;
        }

        await ctx.interaction.editReply({
            content: `Received a name of ${value.name.length} characters.`,
        });
    }
}
```

Open this form with `showModal()` from a command or component, without first
acknowledging that originating interaction. `input.defer` applies to the later
submission, not to opening the form. `TodoForm` is shown in the
[JSX modal guide](jsx-modals.md); native `ModalBuilder` forms work identically.

## Verification scope

Cover native and JSX-authored modal submissions, personalized form structures,
empty and absent fields, literal dotted IDs, inherited-property-like IDs,
mixed-control forms, duplicate text-input IDs, and malformed text values.

Verify schema output and async resolver inference, explicit modal resolver
contexts, handler tuple narrowing, schema-free compatibility, and existing
command-input types. Exercise schema issues, exceptions, guard rejection,
deferral, existing acknowledgments, fresh invocation contexts, and shared
configuration without executing schemas or resolvers during discovery.

Keep framework-generated failures free of submitted values and retain existing
logging policy. Application exceptions retain the existing error pipeline;
applications must not embed private form contents in thrown errors.

Run the required type, test, and formatting checks and public package-consumer
verification. Update current guides and the core package changeset. Use isolated
interactions without bot startup, private credentials, login, deployment, or
publication.

See [modals](modals.md) for current behavior and [JSX modal authoring](jsx-modals.md)
for the implemented form-authoring API.
