# Analogs

Explicit links between biological structures/functions and engineered systems.

An analog is a relationship with provenance, not identity. A terrarium latch,
rail carriage, robotic joint, or sensing system may cite a biological mechanism
without claiming that the engineered implementation reproduces the organism.

Schema: `analog.schema.json`. Committed catalog: `catalog.json` (empty until a
Function exists). Direction is biology-to-engineering; `equivalent` is always
false. Governed projection (`src/projection.ts`) plans SpecimenDB Attach tags
from PR 33 as read-only (`executable: false`, `storeWrite: false`) and does
not call a store.

