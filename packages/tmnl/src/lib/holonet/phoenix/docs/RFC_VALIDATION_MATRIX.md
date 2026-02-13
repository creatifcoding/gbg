# RFC-HPX Validation Matrix (Draft)

Source: portfolio validation against `RFC_CONFORMANCE_CHECKLIST.md` after deep-pass RFC updates.

## Summary

| RFC | Risk | Status |
|---|---|---|
| RFC-HPX-003 | Low-Medium | Conformance appendices + evidence anchors + planned tests added |
| RFC-HPX-004 | Low-Medium | AVA invariants, migration, evidence anchors, and planned tests added |
| RFC-HPX-005 | Low-Medium | Codegen operational contract + evidence/test planning added |
| RFC-HPX-006 | Low-Medium | Dual-plane correctness/observability + evidence/test planning added |
| RFC-HPX-007 | Low-Medium | Offline replay/retention model + evidence/test planning added |
| RFC-HPX-008 | Low-Medium | Adapter conformance profile + evidence/test planning added |
| RFC-HPX-009 | Low-Medium | Edge fallback invariants + evidence/test planning added |
| RFC-HPX-010 | Medium | Selection gating expanded; weighted numeric evidence still provisional |

## Resolved Gap Classes

- **C**: React atom projection contracts now specified in RFC-003..009.
- **D**: Ingress primitives + explicit overflow policy sections now present in RFC-003..009.
- **E**: Replay-ack state machine sections now present in RFC-003..009.
- **G**: Span/counter/log observability maps now present in RFC-003..009.
- **H**: Migration + rollback sections now present in RFC-003..009.

## Remaining Gap Classes

- **J (evidence quality)**: citation anchors are now centralized, but per-RFC inline citation density can still be increased during ratification.
- **RFC-010 scoring**: weighted scorecards remain provisional until evidence register is numerically populated.

## Required Next Edits (Ratification Pass)

### Across RFC-003..009

1. Convert planned conformance tests into implemented test files and link results.
2. Quantify overflow thresholds and fail-session trigger bounds.
3. Inline-link key anchor citations from `RFC_EVIDENCE_ANCHORS.md` where needed.

### For RFC-010

1. Populate per-variant weighted score table with cited evidence.
2. Finalize phase kill criteria thresholds (numeric).
3. Record final recommendation decision log with assumptions and unresolved risks.
