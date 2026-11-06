# A template supplies its handler's custom ID

A button, select-menu, or modal handler with a template takes the template's
custom ID as its own, and passing `customId` beside `builder` is rejected by the
types and at construction. A params handler's template must carry the params
route. Templates already had to carry the ID, because discord.js validation and
the JSX components require one, so handlers wrote every ID twice; a mismatch was
caught only at load.

Making JSX's `customId` optional for templates was rejected: one element type
would need it optional in standalone renderers but required in rows and modals,
and templates without IDs would fail native validation. Allowing both with a
must-match rule was rejected as keeping the duplication it exists to catch.
