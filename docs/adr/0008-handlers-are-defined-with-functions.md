# Handlers are defined with functions

Commands, subcommands, parents, groups, buttons, select menus, modals, and event
handlers are written with `defineCommand()`, `defineSubcommand()`,
`defineParentCommand()`, `defineSubcommandGroup()`, `defineButton()`,
`defineSelectMenu()`, `defineModal()`, and `defineEvent()`. Each takes one
options object with `run` (and `autocomplete`) as functions, checks it, and
returns a frozen instance of an internal class; the class names stay exported as
types only. The loader recognises a handler by `instanceof` against that class,
so a plain object or a subclass fails with `Expected a default export from
define…().` This reverses the line in ADR 0003 that kept handlers as classes.

Classes couldn't infer `run`'s parameter from what they passed to `super()`, so
every handler with params or input named a Spec type, passed it as a type
argument, and annotated `run` again. A generic function infers params, input
(inline or from `defineInput()`), the select-menu kind, the command type (from
the builder), and the event arguments (from a required `event` option), so
handlers take no type argument. This supersedes ADR 0004 for handlers; context
types such as `ButtonContext<{ params }>` keep the object type argument for
helpers written outside a handler. A handler refers to itself through its own
constant instead of `this`, and `define` names the authoring step only: the
glossary still calls the ones that run handlers and the others definitions.

Annotated object literals (`const button: Button<Spec> = { … }`) were rejected
because an annotation infers nothing, so the Spec type would stay. Keeping
classes beside the functions for a release was rejected as two styles of the
same thing, as for guards; nothing was published yet, so every handler moved at
once as a pre-1.0 breaking change. `defineEvent` requires `event` even though
the folder already names it, because nothing else types `ctx.args`, and the
loader now catches a handler in the wrong folder.
