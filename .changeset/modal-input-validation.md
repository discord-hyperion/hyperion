---
"@hyperion/core": minor
---

Add optional Standard Schema validation and whole-input resolution for modal
submissions. Reuse defineInput with explicit ModalContext resolver annotations,
private deferral, inferred handler results, and handler-owned validation responses.
Preserve existing command input and schema-free modal behavior.
