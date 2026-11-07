---
"@hyperion/core": minor
---

Remove the `GuardPipeline` and `GuardResult` exports. They were internal plumbing for the dispatcher, which now runs guards with a plain function. Guards themselves are unchanged.
