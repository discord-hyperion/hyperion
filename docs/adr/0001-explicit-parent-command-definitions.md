# Explicit parent definitions and native subcommand builders

Parent configuration lives in `[parent]/index.ts` as a non-executable `ParentCommand`,
while executable leaves use `Subcommand` with Discord's native subcommand builder.
This replaces generated metadata and implicit conversion of ordinary commands,
keeping shared policies explicit and allowing SDK validation of the complete command.
Parent builders remain native and reject manually added children at runtime because
the SDK's fluent types do not distinguish populated builders from pristine ones.

A restricted metadata callback was considered for compile-time enforcement, but
retaining the native builder API was preferred. An `Omit` type cannot enforce this
restriction: structural typing still accepts populated builders, and fluent setters
return the full builder type. Runtime checks therefore reject manual children before
Hyperion composes the discovered leaves.

Terminology is maintained in [GLOSSARY.md](../GLOSSARY.md); configuration and loading
rules are documented in [command-paths.md](../command-paths.md).
