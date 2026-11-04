# Component handlers take one object type argument

Button, select-menu, and modal handlers and their contexts take a single object
type argument whose optional keys match the constructor options:
`SelectMenuHandler<{ componentType; params; input }>`, `ModalHandler<{ params;
input }>`, and `ButtonHandler<{ params }>`. Applications name the object once
with a type alias and pass it to both the handler and its context. Each
handler's constraint rejects unknown keys, because TypeScript does not check
excess properties in type arguments, and rejects an input whose resolver
expects a different context.

Positional type parameters were replaced when select menus gained `input`. A
third positional parameter made a user select with input read
`SelectMenuHandler<ComponentType.UserSelect, undefined, typeof input>`, with a
placeholder for unused params, and modals already ordered theirs differently
(`ModalHandler<Input, Params>`). Accepting both a component type and an object
as the first parameter, as `Command<Definition>` does for command types and
input, was rejected as two spellings of the same thing. A `HandlerOptions<T>`
helper was rejected because a plain alias does the same and the name collides
with the constructor-options types. Commands keep their single-parameter forms.
The change broke every typed component handler, which was accepted as a pre-1.0
breaking change.
