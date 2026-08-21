# `@tmnl/mantis-lab`

Typed admission boundary between the mantis biomemetics workspace and
`@tmnl/specimendb`.

The workspace is not a Specimen. This package never creates or guesses a
`SpecimenId`, locality, GPS position, or taxon. A caller must supply an existing
SpecimenDB id.

## Evidence admission

Projection is deny-by-default. A component draft is emitted only when all of
these conditions hold:

1. the containing artifact has status `accepted` or `verified`;
2. the package-owned runtime gate has accepted the complete record against the
   digest-pinned `contracts/evidence.schema.json`;
3. the workspace basis and record `sourceClass` agree and are `observed` or
   `measured`;
4. `result.disposition` is `supports`;
5. `review.status` is `accepted` and includes `reviewer` plus `reviewedAt`; and
6. the requested `claimRef` occurs in the validated record's `claimRefs` and
   resolves to exactly one reviewed `admissions[]` payload in that same record.

The workspace epistemic vocabulary is `observed`, `measured`, `calculated`,
`simulated`, `ref`, `target`, `typ`, and `unverified`. Artifact review states are
separate from that vocabulary.

Call `loadEvidenceRuntimeValidator()` to load the actual workspace schema. The
loader verifies its pinned SHA-256 and returns an object registered in a private
runtime `WeakSet`; a structurally similar caller object is rejected. The gate
then validates the record shape and the schema's source-class invariants,
including `measured -> measurements`, before projection. TypeScript types alone
are never admission. Any contract edit intentionally breaks the digest pin
until the schema and validator are reviewed together.

The JSON Schema validator in `scripts/validate-contracts.py` remains the
authoritative full-schema CI gate. The TypeScript gate deliberately implements
the admission-critical v1 structure without a third-party runtime dependency;
any mismatch is a stop condition, never permission to project.

Every projection is a planning envelope with two separate fields: tentative
component intent and provenance. The tentative component contains no invented
`provenance` property; its evidence record reference, evidence id, claim
references, input/artifact/source references, source class, timestamp, and
review identity remain adjacent in the envelope. A future governed adapter must
define how SpecimenDB accepts those links before any write is implemented.
The caller supplies only an evidence id, basis, stable record reference, and
claim reference; component kind, text, and analog target are read from the
reviewed claim-bound admission and cannot be replaced by caller prose.

## SpecimenDB write boundary

The current SpecimenDB draft exposes `Intake`, `Get`, and `List`, but no public
component-attachment operation. Accordingly, this package can verify an
explicitly supplied specimen, project admitted evidence, and produce a
deterministic attachment plan. That plan is marked
`specimendb-attach-unavailable` and is always `executable: false` today.

There is no `attach` member on the injected port and no exported attachment
function. Supplying an object with an extra arbitrary write method cannot change
the plan or trigger that method. This structural absence prevents a caller from
wrapping a direct PGlite write and presenting it as a governed bridge operation.
The write surface may be added only after SpecimenDB publishes a governed
component-attachment contract.
