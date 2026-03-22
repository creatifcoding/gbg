# ADR-002: Local Archive Uses BackingPersistence + BrowserKeyValueStore

Status: Accepted (v1)  
Date: 2026-02-17

---

## Decision

Browser local archival is implemented via `@effect/experimental/Persistence` using:

- `Persistence.layerKeyValueStore`
- `BrowserKeyValueStore.layerLocalStorage`

with explicit manifest/chunk keying and schema decode/encode guards.

---

## Why

1. aligns with Effect DI and Layer composition model
2. allows consistent API (`get`, `set`, `setMany`, `remove`, `clear`)
3. keeps browser storage binding abstracted and testable

---

## Consequences

### Positive

- DI-friendly backend composition
- easy swap path for future IndexedDB backend
- schema guardrails at store boundaries

### Negative

- localStorage quota and serialization limits
- no native transaction semantics

---

## Implementation Implications

1. add `LogArchiveStoreService` over `BackingPersistenceStore`
2. adopt key namespace:
   - `task:{taskId}:manifest`
   - `task:{taskId}:chunk:{index}`
3. enforce quota recovery:
   - evict oldest chunk
   - retry once
4. enter archive degraded mode if unrecoverable

---

## Rejected Alternatives

1. ad-hoc direct `window.localStorage` calls
   - rejected: weak typing, weak testability, no DI symmetry

2. IndexedDB first in v1
   - rejected: raises implementation complexity for first delivery window

3. storing raw unvalidated JSON blobs
   - rejected: insufficient runtime safety and migration posture

---

## Validation

Must satisfy acceptance matrix rows:

- D-01, D-02, D-03, D-07
- E-01, E-02
- G-01..G-05

---

## References

- `../persisted-log-archive-hydration-spec.md`
- `../persisted-log-archive-hydration-implementation-details.md`
- effect docs references captured in implementation-details Section 2

---

End ADR-002.
