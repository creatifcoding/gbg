---
title: "IIoT Invariants -- TLA+ Formal Verification"
date: 2026-02-06
status: Active
source: thoughts/shared/plans/iiot-invariants-analysis.md + iiot-invariants.tla + iiot-invariants.cfg
---

# IIoT Invariants -- TLA+ Formal Verification

## Overview

This specification describes the TLA+ formal model checking of the IIoT entity actor system. It uses TLC model checking to discover invariant violations caused by non-commutative operation ordering across independent actor mailboxes.

**Model covers:**
- Independent entity mailboxes (no cross-entity ordering)
- ISA-95 equipment hierarchy (parent-child)
- ISA-18.2 alarm lifecycle
- Equipment state transitions (OEE)
- Work order lifecycle (FDA 21 CFR Part 11)

## Running the Model

```bash
# Prerequisites
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar

# Execute (from thoughts/shared/plans/)
java -jar tla2tools.jar -config iiot-invariants.cfg iiot-invariants.tla

# With depth limit (faster)
java -jar tla2tools.jar -config iiot-invariants.cfg -depth 12 iiot-invariants.tla

# Parallel exploration
java -jar tla2tools.jar -config iiot-invariants.cfg -workers 4 iiot-invariants.tla
```

## Model Configuration

6 entities forming an ISA-95 hierarchy subtree:

```
PLT (plant)         -- 5 states, 5 transitions
  +-- LIN (line)    -- 5 states, 5 transitions
       +-- MCH (machine) -- 5 states, 5 transitions

EQP (equipment for MCH)  -- 6 states, 26 transitions
ALM (alarm for EQP)       -- 6 states, 17 transitions
WO  (work order for EQP)  -- 11 states, 17 transitions
```

## Invariant Results

| # | Invariant | Result | Safety Impact | Regulatory Impact |
|---|-----------|--------|:---:|:---:|
| 1 | GraphIntegrity | **HOLDS** | -- | -- |
| 2 | HierarchyCoherence | **VIOLATED** | HIGH | MEDIUM |
| 3 | AlarmEquipmentCoherence | **VIOLATED** | **CRITICAL** | **HIGH** (ISA-18.2) |
| 4 | WorkOrderSafety | **VIOLATED** | **CRITICAL** | **CRITICAL** (FDA Part 11) |
| 5 | NonCommutativity | Expected | varies | varies |
| 6 | CascadeCompleteness | **VIOLATED** | MEDIUM | LOW |

## Violation Details

### Invariant 2: HierarchyCoherence -- VIOLATED

Parent decommissioned while child is still active. PLT and LIN have independent mailboxes -- nothing prevents PLT from transitioning to "decommissioned" while LIN is mid-lifecycle.

**Real-world scenario:** Operator decommissions plant PLT-EAST. Line LIN-7 is still commissioning (technician halfway through setup). LIN-7 continues to "operational" on a decommissioned plant.

### Invariant 3: AlarmEquipmentCoherence -- VIOLATED

Alarm cleared while equipment is still in unplanned downtime. No causal link between alarm clearing (operator action on ALM entity) and equipment recovery (separate action on EQP entity).

**Real-world scenario:** Operator clears high-temperature alarm on press MCH-3. Press is still physically overheating (EQP = unplanned_downtime). Dashboard shows "all clear" while machine is down. **Safety hazard** in foundry/food processing.

**ISA-18.2 note:** The standard anticipates this -- "return to normal" should be a process condition, not an operator action.

### Invariant 4: WorkOrderSafety -- VIOLATED

Work order approved and started while equipment is running production. WO approval doesn't check current equipment state.

**Real-world scenario:** Maintenance WO-2847 approved for press MCH-3 (scheduled for idle shift). Production scheduler pushes MCH-3 back to "running." Technician begins maintenance on running machine. **FDA 21 CFR Part 11 violation** -- no lockout/tagout enforcement.

### Invariant 6: CascadeCompleteness -- VIOLATED

Parent decommissioned with no cascade to children. Children remain as ghost entities in whatever state they were in.

## Non-Commutativity Analysis

### Plant/Line/Machine (linear graph) -- SAFE

The plant-type state graph is essentially a linear chain with one shortcut (`operational -> decommissioned`). All pairs produce the same outcome regardless of order. **Commutative-safe.**

### Alarm (ISA-18.2) -- DANGEROUS

Almost every pair of actions from the same state produces different outcomes depending on order:

| From | A | B | A;B | B;A | Commutative |
|------|---|---|-----|-----|:-----------:|
| unacknowledged | acknowledged | shelved | shelved | acknowledged | **NO** |
| unacknowledged | acknowledged | suppressed | suppressed | acknowledged | **NO** |
| acknowledged | cleared | shelved | cleared | shelved | **NO** |

**Implication:** If two operators simultaneously shelve and acknowledge the same alarm, the final state depends on which message arrives first.

### Equipment (OEE) -- DANGEROUS

| From | A | B | A;B | B;A | Commutative |
|------|---|---|-----|-----|:-----------:|
| running | idle | blocked | blocked | idle | **NO** |
| running | planned_downtime | unplanned_downtime | unplanned_downtime | planned_downtime | **NO** |

**Scenario:** Operator sets "planned_downtime." Sensor detects failure, triggers "unplanned_downtime." If planned wins, failure signal is swallowed.

### Work Order (FDA Part 11) -- CRITICAL

| From | A | B | A;B | B;A | Commutative |
|------|---|---|-----|-----|:-----------:|
| submitted | approved | rejected | approved | rejected | **NO** |
| started | suspended | completed | suspended | completed | **NO** |

**Implication:** Approve/reject outcome is a coin flip based on mailbox ordering. Not compliant.

## Architectural Responses

### Tier 1: Accept + Compensate (P=0.60)

For most cross-entity violations:
1. **Periodic reconciliation** -- background scan for hierarchy violations
2. **Soft invariant checks** -- handler reads parent state before transition
3. **Audit log divergence detection** -- monitor flags divergences

Covers: HierarchyCoherence, CascadeCompleteness, AlarmEquipmentCoherence

### Tier 2: Synchronous Guard (P=0.25)

For safety-critical invariants:
- Decommission handler queries all children; rejects if any active
- Work order start handler checks equipment state; rejects if running

### Tier 3: Optimistic Concurrency (NEW)

For intra-entity non-commutativity:
```typescript
// Client sends: { action: "approve", expectedState: "submitted", version: 7 }
// Handler checks: state === "submitted" && version === 7
// If stale: reject with StaleStateError { currentState, currentVersion }
```

## Recommended Priority

1. **IMMEDIATE** -- Optimistic concurrency on work orders (FDA compliance)
2. **IMMEDIATE** -- Equipment-state check before work order start (lockout/tagout)
3. **NEXT** -- Parent-state check on hierarchy transitions (decommission guard)
4. **NEXT** -- Alarm-equipment coherence via reconciliation
5. **LATER** -- Cascade decommission mechanism
6. **LATER** -- Full optimistic concurrency on alarms and equipment

## Files

| File | Location | Purpose |
|------|----------|---------|
| `iiot-invariants.tla` | `thoughts/shared/plans/` | TLA+ specification |
| `iiot-invariants.cfg` | `thoughts/shared/plans/` | TLC model configuration |
| This document | `docs/specifications/` | Analysis and architectural responses |

## Related Documents

- [Entity System Specification](entity-system.md)
- [ADR-004: Entity System Architecture](../decisions/adr-004-entity-system-architecture.md)
- [ISA-95 Equipment Hierarchy](../references/isa95-hierarchy.md)
- Source: `thoughts/shared/plans/iiot-invariants-analysis.md`
