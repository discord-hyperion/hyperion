# Guards are definitions, not classes

Handlers stay classes because filesystem discovery loads default-exported
subclasses, but guards are execution checks constructed inside handler options and
never discovered. Guards are therefore created only with `defineGuard({ name,
description, run, onFail? })`; there is no public `Guard` class to extend, and
`Guard<Context>` is a type. Arguments and state live in closures (a function that
returns a definition), shared state is passed in, and per-invocation state comes
from a guard factory. A private class behind `defineGuard()` keeps guards
distinguishable from factories at runtime, so structural lookalikes are rejected.

Keeping `extends Guard` alongside `defineGuard()` was rejected: two authoring
styles for the same concept, and the class form added constructor boilerplate
without enabling anything a closure cannot express. A special parameterized form,
`defineGuard((arg) => ({ … }))`, was rejected because a bare function in a
`guards` array is indistinguishable from a guard factory at runtime. The built-in
guards changed with this decision (`ownerOnly`, `cooldown()`, `paramOwner()`),
which was accepted as a pre-1.0 breaking change.
