# Sensor Delta Compression Strategies

## Executive Summary

Delta compression for sensor telemetry is a solved problem with established standards. This document surveys production-grade strategies for reducing transmission overhead while preserving signal fidelity. The key insight: **SenML's `bv` (base value) is NOT delta encoding** — it's a static offset for payload compression. True delta strategies operate at the sampling/transmission layer.

---

## The SenML Misconception

### RFC 8428 Base Value (`bv`)

```json
[
  {"bn": "urn:dev:ow:10e2073a01080063:", "bt": 1320078429, "bu": "A", "bv": 120},
  {"n": "voltage", "v": 0.5},
  {"n": "current", "v": -0.3}
]
```

**What `bv` actually does**: Adds a constant offset to all `v` fields in the pack.
- `voltage` = 120 + 0.5 = 120.5
- `current` = 120 + (-0.3) = 119.7

**What `bv` is NOT**: Delta encoding, change detection, or compression.

The RFC explicitly states: *"Base values are added to the regular value"* — a linear transformation, not temporal differencing.

---

## Production Delta Strategies

### 1. Dead-Band Filtering (OPC UA Standard)

**Origin**: OPC UA Part 8 (Data Access), Section 5.6.4

**Algorithm**:
```
IF |current_value - last_transmitted| > deadband_threshold THEN
    transmit(current_value)
    last_transmitted = current_value
END IF
```

**Characteristics**:
| Property | Value |
|----------|-------|
| Time Complexity | O(1) per sample |
| Space Complexity | O(1) per sensor |
| Allocation | Zero (primitive state only) |
| Signal Preservation | Amplitude-accurate, time-quantized |

**Implementation Pattern**:
```typescript
// Zero-allocation dead-band filter
let lastTransmitted = 0
const deadband = 0.5

function shouldTransmit(value: number): boolean {
  if (Math.abs(value - lastTransmitted) > deadband) {
    lastTransmitted = value
    return true
  }
  return false
}
```

**Use When**: High-frequency sensors, bandwidth-constrained links, amplitude matters more than timing.

---

### 2. Swinging Door Trending (SDT)

**Origin**: Bristol Babcock (1990s), adopted by OSIsoft PI, industrial historians.

**Algorithm**:
```
maintain: pivot_point, upper_slope, lower_slope

FOR each new_point:
    slope_to_new = (new_point.value - pivot.value) / (new_point.time - pivot.time)

    IF slope_to_new < lower_slope OR slope_to_new > upper_slope THEN
        archive(previous_point)  // The "door" swung shut
        pivot = previous_point
        reset slopes from pivot to new_point ± compression_deviation
    ELSE
        update upper_slope = min(upper_slope, slope_to_new + deviation/dt)
        update lower_slope = max(lower_slope, slope_to_new - deviation/dt)
    END IF

    previous_point = new_point
```

**Visual Representation**:
```
Value
  │      ╱ upper bound
  │    ╱
  │  ●───────────●  archived points
  │    ╲
  │      ╲ lower bound
  └──────────────────── Time
```

**Characteristics**:
| Property | Value |
|----------|-------|
| Time Complexity | O(1) per sample |
| Space Complexity | O(1) per sensor (5-6 primitives) |
| Compression Ratio | 10:1 to 100:1 typical |
| Signal Preservation | Linear trends preserved exactly |

**Use When**: Process data with linear ramps, historian integration, trend analysis.

---

### 3. Send-on-Delta (SoD) with Hysteresis

**Origin**: Wireless sensor networks literature (Miskowicz 2006).

**Algorithm**:
```
threshold_upper = last_transmitted + delta
threshold_lower = last_transmitted - delta

IF value > threshold_upper OR value < threshold_lower THEN
    transmit(value)
    last_transmitted = value
    // Optional: adaptive delta based on variance
END IF
```

**Enhancement — Adaptive Delta**:
```typescript
// Exponential moving variance for adaptive thresholds
let ema = 0
let emVar = 0
const alpha = 0.1

function updateVariance(value: number): number {
  const delta = value - ema
  ema += alpha * delta
  emVar = (1 - alpha) * (emVar + alpha * delta * delta)
  return Math.sqrt(emVar)
}

const adaptiveDelta = baseThreshold * updateVariance(currentValue)
```

**Characteristics**:
| Property | Value |
|----------|-------|
| Time Complexity | O(1) |
| Space Complexity | O(1) static, O(1) adaptive |
| Adaptivity | Can track signal variance |
| Signal Preservation | Event-driven, captures transients |

**Use When**: Event detection, alarm systems, variable-rate signals.

---

### 4. Temporal Decimation with Peak Preservation

**Algorithm**:
```
window_buffer[window_size]
min_in_window, max_in_window, last_in_window

EVERY window_interval:
    IF max_in_window - min_in_window > significance_threshold THEN
        transmit(min_in_window, max_in_window, last_in_window)
    ELSE
        transmit(last_in_window)  // or skip entirely
    END IF
    reset window
```

**Characteristics**:
| Property | Value |
|----------|-------|
| Time Complexity | O(1) amortized |
| Space Complexity | O(window_size) |
| Compression | Fixed ratio (1:window_size) |
| Signal Preservation | Preserves min/max extrema |

**Use When**: Fixed-rate downstream, visualization, dashboard updates.

---

## Strategy Selection Matrix

| Strategy | Bandwidth | Latency | Fidelity | Complexity | Best For |
|----------|-----------|---------|----------|------------|----------|
| **Dead-Band** | Excellent | Variable | Amplitude | Trivial | High-freq sensors |
| **SDT** | Excellent | Variable | Trends | Moderate | Process historians |
| **Send-on-Delta** | Good | Low | Events | Low | Alarms, transients |
| **Temporal Decim.** | Fixed | Fixed | Extrema | Low | Dashboards |

---

## TMNL Implementation Recommendation

### Phase 1: Dead-Band (Immediate)

Zero-allocation, O(1), trivial to implement:

```typescript
// Per-sensor primitive state (no object allocation)
const sensorBaselines = new Map<string, number>()
const deadbandThreshold = 0.5

function shouldEmit(sensorId: string, value: number): boolean {
  const baseline = sensorBaselines.get(sensorId) ?? value
  if (Math.abs(value - baseline) > deadbandThreshold) {
    sensorBaselines.set(sensorId, value)
    return true
  }
  return false
}
```

**Integration Point**: `handleFetch` and emitter loop.

### Phase 2: Configurable Strategy (Future)

```typescript
const DeltaStrategy = Schema.Literal('none', 'deadband', 'sdt', 'adaptive')

const SensorDeltaConfig = Schema.Struct({
  strategy: DeltaStrategy,
  deadband: Schema.optional(Schema.Number),
  sdtDeviation: Schema.optional(Schema.Number),
  adaptiveAlpha: Schema.optional(Schema.Number),
})
```

### Phase 3: SenML Pack Optimization (Future)

Once delta filtering is in place, SenML's actual features become useful:
- `bt` (base time): Relative timestamps within pack
- `bn` (base name): Shared sensor prefix
- `bu` (base unit): Shared unit string

These reduce **payload size**, while delta strategies reduce **transmission frequency**.

---

## References

1. **RFC 8428** — Sensor Measurement Lists (SenML)
   https://datatracker.ietf.org/doc/html/rfc8428

2. **OPC UA Part 8** — Data Access, Section 5.6.4 (Deadband)
   https://reference.opcfoundation.org/

3. **Swinging Door Trending** — Bristol Babcock / OSIsoft PI
   Industrial data compression standard

4. **Miskowicz, M. (2006)** — "Send-On-Delta Concept: An Event-Based Data Reporting Strategy"
   Sensors 2006, 6(1), 49-63

5. **EnOS Documentation** — Stream Data Processing Policies
   https://support.envisioniot.com/

---

*Document prepared during TMNL Fermion Testbed delta compression research (EDIN Experiment phase)*
