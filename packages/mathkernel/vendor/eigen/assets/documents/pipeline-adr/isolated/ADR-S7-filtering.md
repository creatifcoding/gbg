---
id: "S7"
title: "Filtering Stage — Dead-Band Compression & Backpressure"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S7"]
---

# ADR-S7: Filtering Stage — Dead-Band Compression & Backpressure

## Context

### Problem
High-frequency sensor data (100Hz+) overwhelms downstream consumers when transmitted without intelligent reduction. Bandwidth constraints, battery limitations on edge devices, and UI render budgets demand signal compression that preserves fidelity while reducing transmission frequency by 10-100x.

### Constraints
- **Zero-allocation hot path**: O(1) time/space per sample
- **Configurable thresholds**: Per-sensor, per-field deadband settings
- **Signal preservation**: Amplitude accuracy > timing accuracy
- **Backpressure propagation**: Bounded queue capacity with drop/slide strategies

### Assumptions
- Sensors exhibit temporal redundancy (consecutive samples often within noise floor)
- Downstream consumers tolerate time-quantization (event-driven vs fixed-rate)
- Dead-band thresholds can be tuned per deployment (no universal defaults)

---

## Decision

### Summary
Implement **OPC UA dead-band filtering** as the primary compression strategy, with adaptive delta extensions and temporal decimation for fixed-rate consumers. Backpressure propagates via bounded Effect.Queue with configurable overflow strategies.

### Technologies

| Technology | Purpose | Reference |
|------------|---------|-----------|
| **OPC UA Part 8, Section 5.6.4** | Dead-band algorithm (absolute & percentage) | Industry standard |
| **Effect.Queue** | Bounded backpressure with sliding/dropping | `@effect/io/Queue` |
| **effect-atom Registry** | Per-sensor threshold configuration | `Registry.make()` |
| **Math.abs()** | Zero-allocation delta check | Primitive operation |

### Patterns

#### 1. Dead-Band Filtering (OPC UA Standard)

**Algorithm**:
```typescript
// Per-sensor primitive state (Map<sensorId:field, lastTransmitted>)
const baselines = new Map<string, number>()

function shouldEmit(sensorId: string, field: string, value: number): boolean {
  const key = `${sensorId}:${field}`
  const last = baselines.get(key) ?? value

  if (Math.abs(value - last) > threshold[field]) {
    baselines.set(key, value)
    return true
  }
  return false
}
```

**Characteristics**: O(1) time, O(sensors × fields) space, zero allocation per sample.

**Current Implementation**: `FermionTestbed.tsx` lines 135-158 (`shouldTransmit`, `checkDeadbandDeltas`).

#### 2. Adaptive Delta (Send-on-Delta with Variance Tracking)

**Enhancement**: Track exponential moving variance to adjust thresholds dynamically:

```typescript
let ema = 0
let emVar = 0
const alpha = 0.1

const adaptiveDelta = baseThreshold * Math.sqrt(emVar)
```

**Use Case**: Variable-rate signals (accelerometer during activity vs rest).

#### 3. Temporal Decimation with Extrema Preservation

**Algorithm**: Fixed-rate downstream (e.g., 1Hz dashboards) with min/max preservation:

```typescript
// Per window: track min, max, last
EVERY window_interval:
  IF max - min > significanceThreshold THEN
    emit(min, max, last)
  ELSE
    emit(last)
```

**Use Case**: Dashboard gauges, long-term trend displays.

#### 4. Backpressure Propagation

**Strategy**: `Effect.Queue.bounded` with capacity limits:

```typescript
const filterQueue = Effect.Queue.bounded<SensorReading>(1000)

// Overflow strategies
Effect.Queue.Strategy.Sliding  // Drop oldest
Effect.Queue.Strategy.Dropping // Drop newest
```

**Propagation**: When queue fills, filter becomes more aggressive (increase dead-band threshold 2x).

### Interfaces

| Interface | From | To | Protocol | Schema |
|-----------|------|-----|----------|--------|
| `FilteredStream` | S6 (Client Transport) | S7 (Filtering) | Effect.Stream | `SensorReading` |
| `ReducedStream` | S7 (Filtering) | S8 (State) | Effect.Stream | `FilteredReading` |
| `BackpressureSignal` | S8 (State) | S7 (Filtering) | Atom notification | `QueueUtilization` |

---

## Rationale

### Alternatives Considered

| Alternative | Rejection Reason |
|-------------|------------------|
| **Fixed-rate sampling** | Loses transient events; wastes bandwidth on static signals |
| **SenML `bv` (base value)** | Static offset, not delta compression (see RFC 8428) |
| **Swinging Door Trending** | Higher complexity (O(1) but 5-6 primitives); better for historians |
| **Lossy compression (quantization)** | Introduces systematic error; dead-band preserves exact values |

### Tradeoffs

| Gain | Cost |
|------|------|
| 10-100x bandwidth reduction | Time-quantization (events delayed up to 1x threshold crossing) |
| Zero-allocation hot path | Per-sensor state overhead (Map storage) |
| Preserves amplitude accuracy | Loses exact timestamp of intermediate samples |
| Backpressure-aware | Threshold tuning required per deployment |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Missed critical events** | Medium | High | Hybrid strategy: dead-band + alarm thresholds bypass filter |
| **Threshold misconfiguration** | High | Medium | Auto-calibration mode: track 99th percentile variance |
| **Queue overflow** | Low | Medium | Backpressure increases dead-band 2x; alert on sustained overflow |
| **Stale baselines** | Low | Low | Periodic baseline reset (e.g., every 1000 samples or 1 hour) |

---

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `src/lib/filtering/DeadbandFilter.ts` | Create | Core dead-band algorithm, FilterStrategy interface |
| `src/lib/filtering/schemas.ts` | Create | Schema.Struct for per-sensor threshold config |
| `src/lib/filtering/BackpressureManager.ts` | Create | Queue monitoring, adaptive threshold adjustment |
| `src/lib/filtering/__tests__/DeadbandFilter.test.ts` | Create | @effect/vitest tests for O(1) guarantee |

### Dependencies

None (uses only `@effect/io` Queue, Map primitives).

### Test Strategy

1. **Unit Tests** (`@effect/vitest`):
   - Dead-band algorithm correctness (threshold ±ε)
   - Zero-allocation verification (heap snapshots)
   - Backpressure propagation (queue overflow → threshold increase)

2. **Integration Tests** (`FermionTestbed.tsx`):
   - 100Hz sensor stream → 1-10Hz filtered output
   - Verify transient events (spike detection)

3. **Performance Tests**:
   - 1M samples through filter < 100ms
   - Memory stable (no leaks over 10M samples)

### Reference

See `assets/documents/SENSOR_DELTA_COMPRESSION_STRATEGIES.md` for detailed algorithm survey and strategy selection matrix.

Current implementation pattern in `src/components/testbed/FermionTestbed.tsx` lines 135-158 (`shouldTransmit`, `deadbandBaselines`).

---

## Metadata

**Related ADRs**:
- ADR-S6 (Client Transport): Provides raw stream input
- ADR-S8 (State): Consumes filtered stream into atoms
- ADR-S5 (Storage): May implement dead-band at persistence layer

**Reviewers**: Prime, Val

**Comments**: None
