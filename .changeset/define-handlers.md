---
"@hyperion/core": minor
---

Define handlers with functions instead of classes. `defineCommand()`, `defineSubcommand()`, `defineParentCommand()`, `defineSubcommandGroup()`, `defineButton()`, `defineSelectMenu()`, `defineModal()`, and `defineEvent()` replace extending `Command`, `Subcommand`, `ParentCommand`, `SubcommandGroup`, `ButtonHandler`, `SelectMenuHandler`, `ModalHandler`, and `EventHandler`, which are now exported as types only. Params, input (inline or from `defineInput()`), select-menu kinds, command types, and event arguments are inferred, so handlers take no type argument and `run` needs no annotation. `defineEvent()` requires an `event` that matches its folder. Breaking: every handler module must default-export what its define function returns.
