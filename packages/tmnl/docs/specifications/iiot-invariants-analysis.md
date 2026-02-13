# IIoT Invariants -- TLC Model Checking Analysis

> Consolidated from `thoughts/shared/plans/iiot-invariants-analysis.md`
> Original date: 2026-02-06

## Overview

This document describes the TLA+ formal specification that models the IIoT entity actor system. It uses TLC model checking to discover invariant violations caused by non-commutative operation ordering across independent actor mailboxes.

The model covers:
- Independent entity mailboxes (no cross-entity ordering)
- ISA-95 equipment hierarchy (parent-child)
- ISA-18.2 alarm lifecycle
- Equipment state transitions (OEE)
- Work order lifecycle (FDA 21 CFR Part 11)

## Running the Model

### Prerequisites

```bash
# Download TLA+ tools
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar
```

### Execute

```bash
# From docs/specifications/
java -jar tla2tools.jar -config iiot-invariants.cfg iiot-invariants.tla

# With depth limit (faster)
java -jar tla2tools.jar -config iiot-invariants.cfg -depth 12 iiot-invariants.tla

# Parallel workers
java -jar tla2tools.jar -config iiot-invariants.cfg -workers 4 iiot-invariants.tla
```

## Model Configuration

The minimal model uses 6 entities forming an ISA-95 hierarchy subtree:

```
PLT (plant)
  |-- LIN (line, child of PLT)
  |     |-- MCH (machine, child of LIN)
  |
EQP (equipment for MCH)
ALM (alarm for EQP)
WO  (work order for EQP)
```

## Invariants

| Invariant | Expected Result | Mechanism |
|-----------|----------------|-----------|
| GraphIntegrity | HOLDS | Handler enforces graph transitions |
| HierarchyCoherence | **VIOLATED** | Independent mailboxes, no hierarchy coordination |
| AlarmEquipmentCoherence | **VIOLATED** | Alarm and equipment are separate entities |
| WorkOrderSafety | **VIOLATED** | Work order and equipment are separate entities |
| CascadeCompleteness | **VIOLATED** | No cascade mechanism |

## Expected Violations

### HierarchyCoherence

Parent decommissioned while child is still active. PLT and LIN have independent mailboxes -- nothing prevents PLT from transitioning to "decommissioned" while LIN is mid-lifecycle.

**Real-world scenario**: Operator decommissions plant PLT-EAST. Line LIN-7 on that plant is still commissioning. LIN-7's handler doesn't know its parent just died.

### AlarmEquipmentCoherence

Alarm cleared while equipment is still in unplanned downtime. The alarm and equipment entities process messages independently.

### WorkOrderSafety

Work order completed while equipment is still in unplanned downtime, or work order started on equipment already running.

## Implications

These violations are **expected and documented** -- they are a consequence of the actor model's independent mailbox design. The mitigations are:

1. **Saga patterns** for cross-entity coordination (future work)
2. **Validation queries** at the application layer before critical transitions
3. **Eventual consistency** accepted for non-critical hierarchy updates
4. **Compensating actions** when violations are detected asynchronously

## Files

| File | Description |
|------|-------------|
| `iiot-invariants.tla` | TLA+ specification |
| `iiot-invariants.cfg` | TLC model configuration |
| This document | Analysis of expected violations |
