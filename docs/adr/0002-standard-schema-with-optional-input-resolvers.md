# Standard Schema with optional command input resolvers

Accepted for command input validation.

Use Standard Schema as the validation contract and retain an optional whole-input
resolver for obtaining application values after schema validation. The schema
validates raw command options; the resolver receives the complete schema output
and returns the handler input directly. A resolver may return several fields,
nullable values, or application defaults without a second validation pass.

Schema-owned async transformations were considered as the only lookup mechanism.
Although [Standard Schema](https://standardschema.dev/schema) accepts synchronous
or asynchronous validation results, compatible libraries expose different
transformation capabilities: [Zod](https://zod.dev/api#transforms) and
[Valibot](https://valibot.dev/api/transformAsync/) support async transformations,
while [ArkType](https://arktype.io/docs/faq) does not provide an awaited async
morph pipeline. [Yup](https://github.com/jquense/yup#schematestname-string-message-string--function--any-test-function-schema)
supports async tests, and [Joi external rules](https://joi.dev/api/18.x.x#anyexternalmethod-description)
can replace values after ordinary validation. A common integration contract
does not guarantee identical authoring capabilities.

An optional resolver preserves library choice and provides invocation context for
lookups and operations using several validated fields. Applications whose schemas already perform the lookup can omit them.
This adds a second place to obtain values, so examples should demonstrate either
resolver-owned or schema-owned lookup without duplicating work. See
[typed command input](../input-validation.md) for the pipeline and
[the glossary](../GLOSSARY.md#command-input) for terminology.

Per-option replacement and explicit source/destination key mappings were
considered and rejected. They made ID-to-entity renaming awkward and could not
naturally express creating one todo from name, description, and deadline. A
single resolver returning the complete handler input covers those cases. A `defineInput` helper infers schema output and resolver return types into one
input definition. Classes and handler contexts use that definition as their
single generic, replacing separate schema/result generics. Schema-free and
context-menu command generics retain their existing behavior.
