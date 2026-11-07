---
"@hyperion/core": minor
---

Skip deploying commands that haven't changed. Before each bulk overwrite, the registry reads the registered commands and compares them, so a restart with unchanged commands sends no deployment request. The `commands.deployed` log lists the added, removed, and changed commands. If the registered commands can't be read, it deploys anyway.
