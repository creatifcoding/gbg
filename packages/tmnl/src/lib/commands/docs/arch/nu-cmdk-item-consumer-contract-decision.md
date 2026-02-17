# NuCmdk Item Consumer Contract Decision

**Status:** Locked  
**Date:** 2026-02-15

---

## Decision

`ResultsBand.Item` is a **provider-consumed API** with **hybrid rendering control**:

- providers emit typed semantic + presentation-hint payloads,
- shell keeps hard control over layout, typography, spacing, and interaction constraints,
- providers may override typed item slots (icon/content/meta/actions) without bypassing shell guardrails.

This decision keeps extensibility high while preserving visual/system coherence.

---

## Consumer definition

Primary consumer is **provider authors** (lane/provider adapters) integrating NuCmdk rows into shell rendering.

Secondary consumer is shell integrators composing defaults and global policies.

---

## Control boundary

### Provider controls

- semantic row intent
- action intents
- display tokens / badges / icon tokens
- layout hints (priority, density hints, section preference)
- telemetry metadata
- namespaced extension payloads

### Shell controls (non-overridable)

- item outer layout and spacing
- typography scale and 12px floor
- selection/highlight behavior
- focus and keyboard affordances
- constrained slot envelope and fallback behavior

---

## Typed payload contract (required)

Payload model for item rendering includes:

1. semantic core (`id`, `label`, `description`, `kind`, `status`)
2. action intents (`execute`, `preview`, secondary intents)
3. display tokens (`iconToken`, `badges`, emphasis)
4. layout hints (`sectionPriority`, density hint, compact intent)
5. telemetry metadata (`impression`, `select`, provider/lane trace ids)
6. extension bag (`extensions`) under namespaced keys only

Contract style: **Schema + extension bag (namespaced)**.

---

## Slot policy

`ResultsBand.Item` supports typed slot overrides:

- `icon`
- `content`
- `meta`
- `actions`

Each slot receives typed item render model input. Slot output is clipped into shell-owned layout boundaries.

Full custom renderer bypass is disallowed for baseline provider path.

---

## Rationale

- avoids lock-in to one visual template while preserving coherence,
- enables lane/provider-specific expression without cross-provider UI drift,
- keeps backend/provider payload contracts stable as transport lanes scale,
- supports future partial renderer evolution with schema/version controls.

---

## Linked artifacts

- `arch/nu-cmdk-decision-lock.md` (D19)
- `research/nu-cmdk-questionnaire-results.md` (Session E)
- `research/nu-cmdk-design-log.md` (Iteration 32)
