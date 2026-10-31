# JSX modal authoring design

`@hyperion/jsx` supports modal authoring through `Modal` and `renderModal()`.
Implementation lives in `packages/jsx/lib`, shares the existing JSX runtime and
text composition, and adds no core or discord.js runtime dependency.

## Existing foundation

The independent `@hyperion/jsx` package provides synchronous JSX descriptions,
explicit rendering, reusable components, strict props/nesting checks, and native
embed builder output. See [JSX authoring](jsx.md).

Core [modal handlers](modals.md) accept native `ModalBuilder` definitions and route
submissions by exact custom ID. Registered handlers/builders are shared across
invocations and must not be mutated with per-user state. JSX authoring must
preserve this contract.

Standalone JSX text formatting was dropped. Rendering informational text inside a
modal is distinct from adding a public standalone text-render API.

## Scope

- Add modal authoring to `@hyperion/jsx`, using its existing runtime.
- Initially cover text inputs and informational text. Embedded selects and other
  controls remain deferred.
- Use the accepted `Modal`, `Modal.Label`, `Modal.TextInput`, and
  `Modal.TextDisplay` vocabulary.

## Authoring contract

- Adopt `Modal`, `Modal.Label`, `Modal.TextInput`, and `Modal.TextDisplay` authoring
  components with explicit `renderModal()` returning a fresh native
  `ModalBuilder`. Preserve reusable synchronous components, fragments, strict
  structural checks, and native validation. Support core handlers and plain
  discord.js consumers.
- Limit this feature to form authoring. Keep submission parsing, schema
  validation/resolution, handler contexts, and routing unchanged. Modal input
  schemas are supported separately by core; see [modal input validation](modal-input-validation.md).

- Require explicit `customId` props on the modal and every text input. Do not
  derive IDs from labels, ordering, or component positions.
- Reject duplicate input custom IDs within one rendered modal, identifying both
  structural locations. Separate modal renders may reuse the same IDs.
- Support existing escaped text composition and formatting components inside
  `Modal.TextDisplay`. Keep titles, labels, label descriptions, placeholders, and
  initial input values as plain strings. Do not add standalone text rendering.

- Permit only labels and text displays directly under a modal. Each label must
  resolve to exactly one text input. Expand fragments/reusable components before
  checking structure; reject bare root text, unlabelled inputs, nested labels,
  multiple inputs per label, and action-row wrappers in JSX.
- Default input style to short. Accept `"short"`, `"paragraph"`, and corresponding
  native enum values without requiring an enum import for ordinary authoring.
- Inputs are required by default, matching Discord's effective default. Explicit
  `required={false}` makes an input optional.

- Expose native-named `placeholder`, `value`, `minLength`, and `maxLength` input
  props plus label `description`. Delegate native value/length constraints to
  builders rather than duplicating the API schema.
- Omit separate numeric component `id` props from this release. Keep explicit
  custom IDs; native builders remain available for advanced customization.
- Permit text-display-only modals when native validation accepts them. Do not add
  a minimum interactive-input count. Empty forms still fail native validation.
  Builder acceptance is not a claim of verified Discord server acceptance.

- Support personalized initial values by rendering a fresh form when opening it,
  using the registered handler's exact custom ID. Keep the registered builder as
  a shared default definition. Do not mutate it or add a builder-factory API.
  Application state and authorization remain application-owned.

## Retained runtime and validation policies

Use the existing synchronous render-time evaluation, fragments/arrays/conditionals,
readonly shallow prop snapshots, ignored key metadata, fresh native builders,
unknown-prop checks, and contextual `JSXRenderError` behavior. `renderModal()`
resolves exactly one modal root, like the existing singular embed renderer.

Call native `toJSON()` without an override, respecting the global validator
setting. JSX structural checks, including duplicate input IDs, remain active when
native schema validators are disabled. Preserve native failures as causes;
generated errors identify structural locations without echoing form values.
Do not log automatically or silently truncate/discard content.

## Authoring example

```tsx
import { Bold, Modal, renderModal } from "@hyperion/jsx";

const TodoForm = ({ initialName = "" }: { initialName?: string }) => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.TextDisplay>
            <Bold>Enter your todo details.</Bold>
        </Modal.TextDisplay>
        <Modal.Label text="Name" description="A short, descriptive name">
            <Modal.TextInput
                customId="name"
                value={initialName}
                maxLength={100}
            />
        </Modal.Label>
        <Modal.Label text="Description">
            <Modal.TextInput
                customId="description"
                style="paragraph"
                placeholder="What needs doing?"
                required={false}
                maxLength={1_000}
            />
        </Modal.Label>
    </Modal>
);

const builder = renderModal(<TodoForm />);
```

Use this builder in the existing core `Modal` handler's `super({ builder })`.
Alias that handler class when needed to distinguish it from the JSX component:
`import { Modal as ModalHandler } from "@hyperion/core"`.

A command/button can open a personalized instance without changing the shared
registered builder:

```tsx
await ctx.interaction.showModal(
    renderModal(<TodoForm initialName={suggestedName} />),
);
```

The submission still routes to the handler registered as `todo.create`. Read fields directly through `ctx.interaction.components.getTextInputValue("name")`
or configure core input validation to receive typed values through `ctx.input`.
Do not acknowledge the originating interaction before opening its modal; opening
and submission remain separate interactions under the existing modal guide.

## Verification and completion criteria

- Match native builder output for labels, short/paragraph inputs, optional props,
  formatted text displays, required defaults, and explicit optional inputs.
- Verify both style strings and native enum values without adding a discord.js
  runtime dependency to the independent JSX package.
- Cover root cardinality, direct-child restrictions, exactly one input per label,
  fragments, reusable components, conditional omissions, and stable child order.
- Reject duplicate input IDs with both paths, wrong nesting, unsupported controls,
  numeric IDs, unknown props, and non-string metadata. Keep structural checks
  active when native schema validation is disabled.
- Cover native length/count failures and validator-setting behavior without
  duplicating Discord's schema. Verify informational-only builder output and
  native rejection of empty forms with validation enabled.
- Verify synchronous deferred evaluation, repeated rendering, independently fresh
  nested builders, unchanged views/shared definitions after builder mutation,
  rejected promises/prebuilt builders, and contextual errors without form values.
- Add type/negative-type cases and standalone source/packed public consumers.
  Verify `ModalBuilder` identity and Discord `showModal()` type compatibility.
- Exercise JSX-authored default and personalized builders through existing modal
  discovery and exact-ID submission routing using isolated interactions. Prove
  per-user rendering does not mutate the registered builder or change core APIs.
- Document the authoring/handler distinction, required/style defaults, input props,
  initial-value pattern, unsupported controls, and local-validation boundaries.
- Run required type, test, and formatting checks plus package/cache/release
  verification. Include an appropriate JSX package changeset. Do not start the
  bot, read private credentials, log in, deploy commands, or publish.

The dev bot demonstrates this flow in `src/views/todo-form.tsx`,
`src/modals/create-todo.tsx`, and the `/jsx-modal` command. The optional command
`name` value prefills a fresh form. The demo reports submitted character counts;
it does not store a todo or submitted values.

## Verified native-builder facts

Read-only investigation on 2026-10-31 checked the pinned
`@discordjs/builders@2.0.0-dev.1792497873-5050a3b54` implementation and declarations:
- Modal validation requires a title of 1–45 characters, custom ID of 1–100, and
  1–5 top-level components. It accepts labels/text displays and legacy action
  rows; the JSX vocabulary need not expose every native form.
- Labels require a label and exactly one supported child. Native labels support
  text inputs plus additional controls outside the previously scoped JSX feature.
  They do not accept text displays or nested labels.
- Text inputs require a custom ID and style. No style default is supplied by the
  builder. Omitted `required` stays omitted in JSON; Discord documents its
  effective default as true. Initial value and placeholder are plain API strings.
- Text displays require content and are documented as Markdown-formatted text
  usable in modals. JSX text composition therefore has a supported destination.
- Native modal validation does not reject duplicate input custom IDs. Their
  rejection is a JSX structural rule rather than delegated validation.
- Numeric component IDs differ from custom IDs. The builder supports optional
  numeric IDs, but Discord can generate them; this release omits JSX numeric IDs.
- An informational-only modal passes this installed builder's validation. This
  does not prove Discord server acceptance; JSX permits the native shape.
- Native `toJSON()` respects the global validator setting when called without an
  override. JSX rendering should preserve that existing validation convention.
- Text-input style types can be derived from
  `Parameters<TextInputBuilder["setStyle"]>[0]`, avoiding a new discord.js runtime
  dependency. The accepted public style API adds string conveniences and a
  short-style default.
- Core snapshots handler custom IDs from shared builders and requires actual
  `ModalBuilder` identity, matching IDs, successful serialization, and unique
  registry IDs. Per-invocation JSX builders must preserve exact routing IDs when
  targeting registered handlers.

Sources: installed builders implementation/declarations;
[Discord text inputs](https://docs.discord.com/developers/components/reference#text-input),
[text displays](https://docs.discord.com/developers/components/reference#text-display),
[component IDs](https://docs.discord.com/developers/components/reference#anatomy-of-a-component),
`packages/core/src/components/modal.ts`, modal loading/execution, and existing
modal tests. Standalone JSX source/packed fixtures already provide the public
consumer verification boundary.

## Defaults and limits

| Component           | Props                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `Modal`             | Required `customId`, required `title`, structural children                                          |
| `Modal.Label`       | Required plain `text`, optional plain `description`, exactly one input child                        |
| `Modal.TextInput`   | Required `customId`; optional `style`, `required`, `placeholder`, `value`, `minLength`, `maxLength` |
| `Modal.TextDisplay` | Existing JSX text composition as children                                                           |

Omitted style or `style="short"` maps to native Short (1); `style="paragraph"`
maps to Paragraph (2). Native style enum values are accepted as well. Inputs
explicitly default to required. Empty-string initial values and zero minimum
lengths are preserved, and `required={false}` is never replaced by the default.
No label text, custom ID, placeholder, or initial value is inferred from children.

Native validation owns title/custom-ID/content length and component-count limits.
This renderer does not impose new `minLength <= maxLength` or integer constraints
where the installed native validators do not. Disabled native validators disable
those schema checks, including empty-form validation; they do not disable JSX
structure, explicit plain-string metadata, unknown-prop, or duplicate-ID checks.

Rendering is synchronous and local. Native acceptance of an informational-only
shape is not a promise that every Discord client/server accepts that interaction.
`renderModal()` never opens a form, submits values, or changes acknowledgment
state. Continue following the [core modal guide](modals.md) when sending forms and
responding to submissions.
