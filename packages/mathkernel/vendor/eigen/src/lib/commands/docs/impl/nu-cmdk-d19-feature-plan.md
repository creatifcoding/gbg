# NuCmdk D19 Feature Plan — Provider-first ResultsBand Item Contract

**Feature ID:** `#F270`  
**Date:** 2026-02-15  
**Status:** Planned

---

## Objective

Implement D19 so provider authors can drive `ResultsBand.Item` rendering through typed object payloads and constrained slot overrides, while shell keeps layout/typography/interaction guardrails.

---

## Root Feature

- `#F270` NuCmdk D19: Provider-first ResultsBand Item Contract

Top-level tasks:

- `#1039` Bootstrap D19 implementation branch and execution order
- `#1040` Integrate contract + slot API into `NuCmdkShellOverlay`
- `#1041` Final completion gate

---

## Sub-feature breakdown

### `#F271` Contract layer: Schema-first item payload

- `#1024` Define Effect Schema contracts for item payload families
- `#1025` Implement decoders + violation telemetry hooks
- `#1026` Map existing `NuCmdkShellRow` to typed item contract

### `#F272` ResultsBand.Item recursive decomposition

- `#1027` Introduce item render context model
- `#1028` Implement slot-level compounds for internals
- `#1029` Enforce layout/typography guardrails
- `#1030` Preserve default rendering compatibility

### `#F273` Provider-facing API surface

- `#1031` Add provider render payload API entrypoint
- `#1032` Add provider slot override API
- `#1033` Wire section/item resolver strategy hooks

### `#F274` Validation and documentation

- `#1034` Schema validation tests
- `#1035` Slot override + fallback tests
- `#1036` Guardrail tests
- `#1037` API docs + usage recipes
- `#1038` D19 evidence + traceability updates

---

## Execution order (critical path)

1. `#1024` → `#1025` → `#1026`
2. `#1027` → `#1028` → `#1029` + `#1030`
3. `#1031` → `#1032` + `#1033`
4. `#1040` (integration cutover)
5. `#1034` `#1035` `#1036` `#1037`
6. `#1038` traceability evidence
7. `#1041` final gate

---

## Contract scope for provider consumers

Required payload families:

- Semantic core
- Action intents
- Display tokens
- Layout hints
- Telemetry metadata
- Namespaced extension bag

Allowed customization:

- Typed slot overrides: `icon`, `content`, `meta`, `actions`

Non-overridable shell guardrails:

- outer layout geometry
- typography and 12px floor
- focus/selection behavior
- keyboard interaction envelope

---

## Evidence requirements

- T1: schema contract tests and decode path tests
- T2: component integration tests for slot rendering + fallback path
- T3: overlay integration run showing provider payload path in `NuCmdkShellOverlay`
- T4: final gate run with traceability links attached to D19

---

## Traceability

- Decision lock: `arch/nu-cmdk-decision-lock.md` (D19)
- Decision artifact: `arch/nu-cmdk-item-consumer-contract-decision.md`
- Trace index: `arch/ascii/traceability-index.md`
- Design log: `research/nu-cmdk-design-log.md` (Iteration 32)
