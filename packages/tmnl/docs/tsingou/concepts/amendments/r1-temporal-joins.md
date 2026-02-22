# TSGC-001 Amendment: R1 + R7

```
Amendment:  R1 (Temporal Join Semantics) + R7 (Track Lifecycle Management)
Target:     TSGC-001 — Fusion Ontology Design, v2
Author:     tracking-researcher
Status:     DRAFT
Created:    2026-02-19
Evidence:   grounded-theory-data-fusion.md (Sections 2.4, 3.4, 3.5 R1/R7)
            research-tracking-identity.md (Part I: Sections 2, 8, 9, 10, 11)
Priority:   R1 = HIGH, R7 = LOW
```

> **R1 Gap (HIGH)**: The fusion ontology specifies temporal proximity as a
> predicate (Section 3.2.1) and windowed joins in the d2ts compilation
> (Section 7), but does not specify the *semantics* of temporal joins when
> signal sources have radically different update rates, how watermarks govern
> late-arrival tolerance, or what happens when event-time and processing-time
> diverge.
>
> **R7 Gap (LOW)**: Section 5.2 references multi-target tracking algorithms
> (GNN, JPDA, MHT) and TSGC-RI-1/2 provides deep research, but the fusion
> ontology lacks a normative specification for track lifecycle states and
> transitions — when tracks are born, confirmed, degraded, and dropped.

---

## Amendment A: Temporal Join Semantics (R1)

*Proposed insertion: new Section 3.4 in TSGC-001, between Section 3.3 (Tier 3:
Derived Keys) and Section 4 (Identity Resolution).*

---

### A.1 The Rate Mismatch Problem

Signal sources in the Tsingou domain update at vastly different rates:

| Signal Kind | Typical Update Rate | Rate Category |
|-------------|-------------------|---------------|
| ADS-B | 1 Hz (1 msg/sec) | High-rate stream |
| AIS Class A | 0.3 Hz (1 msg/3sec moving, 1/3min stationary) | Variable-rate stream |
| AIS Class B | 0.03 Hz (1 msg/30sec) | Low-rate stream |
| Radar track | 0.1-1 Hz (scan-dependent) | Medium-rate stream |
| RF bearing sweep | 0.1-10 Hz (sweep rate) | Variable-rate stream |
| DNS query log | Bursty (0-1000/sec) | Bursty stream |
| HTTP connection log | Bursty (0-10000/sec) | Bursty stream |
| OSINT/RSS | 0.001 Hz (minutes to hours) | Trickle / event table |
| STIX CTI feed | ~0 Hz (daily batch, webhook push) | Event table |
| FAA/ITU registry | ~0 Hz (updated weekly/monthly) | Reference table |

When joining ADS-B (1 Hz) with AIS (0.03 Hz), the rate difference is **33x**.
When joining ADS-B (1 Hz) with OSINT (0.001 Hz), the rate difference is
**1000x**. The join semantics must be different for these two cases.

### A.2 Join Classification by Rate Ratio

The fusion ontology defines **three temporal join modes**, selected automatically
based on the rate ratio between the two sources in a join path:

```
Rate ratio R = max(rate_left, rate_right) / min(rate_left, rate_right)

If R < 10:      WINDOWED JOIN       (both sides are streams)
If R >= 10:     EVENT-TABLE JOIN    (fast side is stream, slow side is table)
If R = infinity: REFERENCE JOIN     (one side is static reference data)
```

#### A.2.1 Windowed Join (R < 10)

Both sides produce signals at comparable rates. The join operates over a
**time window** — signals from the left and right sides are matched if their
event-time timestamps fall within the window.

```
Semantics:
  For each signal s_left at event-time t_L:
    Match with all signals s_right where:
      |t_L - t_R| <= window_size / 2

  Window size = max(left_window, right_window)
    where each side's window is derived from its update interval * multiplier

d2ts compilation:
  Left collection, keyed by (spatial_key, time_bucket)
  .join(
    Right collection, keyed by (spatial_key, time_bucket),
    join_predicate
  )

  Where time_bucket = floor(event_time / bucket_size)
  And adjacent buckets are also checked (to handle boundary crossings)
```

**Window sizing by signal pair**:

| Left | Right | Rate Ratio | Window Size | Rationale |
|------|-------|------------|-------------|-----------|
| ADS-B | Radar | ~3x | 5 sec | Both update frequently |
| ADS-B | AIS (moving) | ~3x | 10 sec | AIS slightly slower |
| AIS | RF bearing | ~3x | 15 sec | Both medium-rate |
| DNS | HTTP | ~1x | 30 sec | DNS prefetch/caching creates lag; R6 blocking uses 300s |
| RF bearing | RF bearing | 1x | 5 sec | Cross-sensor correlation |

**d2ts pattern**:

```typescript
// Windowed join: ADS-B x Radar
// Both are streams, comparable rates

const WINDOW_SIZE_MS = 5_000  // 5 seconds

const windowedJoin = adsbStream
  .map(signal => {
    const bucket = Math.floor(signal.eventTime / WINDOW_SIZE_MS)
    const spatialKey = geoToH3(signal.geo, H3_RESOLUTION)
    return [`${spatialKey}:${bucket}`, signal] as const
  })
  .join(
    radarStream.flatMap(signal => {
      // Emit into current bucket AND adjacent (handles boundaries)
      const bucket = Math.floor(signal.eventTime / WINDOW_SIZE_MS)
      const spatialKey = geoToH3(signal.geo, H3_RESOLUTION)
      return [
        [`${spatialKey}:${bucket}`, signal],
        [`${spatialKey}:${bucket - 1}`, signal],
        [`${spatialKey}:${bucket + 1}`, signal],
      ]
    }),
    (adsb, radar) => {
      // Fine-grained temporal check within window
      if (Math.abs(adsb.eventTime - radar.eventTime) > WINDOW_SIZE_MS) return null
      return buildFusionCandidate(adsb, radar)
    }
  )
  .filter(x => x !== null)
```

**Retraction semantics**: When a signal is retracted from either side of a
windowed join, all join outputs that included that signal are retracted. This
is standard d2ts behavior — the join operator maintains state from both sides
and recomputes affected outputs.

#### A.2.2 Event-Table Join (R >= 10)

One side is a fast-updating stream; the other is a slow-updating "table" that
represents the latest known state. The fast side probes against the slow side's
**current snapshot**, not against individual slow-side events.

```
Semantics:
  For each signal s_fast at event-time t_F:
    Match with the LATEST signal s_slow where:
      s_slow.event_time <= t_F
      (i.e., the slow side's state AS OF the fast signal's timestamp)

  This is a TEMPORAL JOIN against a versioned table.
  The slow side is treated as a slowly-changing dimension.
```

**Why this is different from windowed join**:

Consider ADS-B (1 Hz) joining OSINT (1 per hour). A windowed join with a
1-hour window would buffer 3600 ADS-B signals per window bucket. An
event-table join instead maintains only the LATEST OSINT state and probes
it for each ADS-B signal. Memory: O(|OSINT entities|) vs O(|ADS-B signals| *
window_size).

| Fast Side | Slow Side | Rate Ratio | Join Mode |
|-----------|-----------|------------|-----------|
| ADS-B | OSINT | ~1000x | Event-table |
| ADS-B | STIX CTI | ~inf | Event-table |
| HTTP | STIX CTI | ~inf | Event-table |
| AIS | FAA registry | ~inf | Event-table (ref) |
| DNS | WHOIS | ~1000x | Event-table |
| Radar | AIS (stationary) | ~100x | Event-table |

**d2ts pattern**:

```typescript
// Event-table join: ADS-B x OSINT
// ADS-B is stream, OSINT is slowly-changing table

// OSINT maintained as a keyed collection:
//   key = entity identifier (e.g., ICAO hex, IP, name)
//   value = latest OSINT report for that entity
// d2ts reduce builds the "table" by accumulating the latest value per key

const osintTable = osintStream
  .map(signal => [extractEntityKey(signal), signal] as const)
  .reduce((signals) => {
    // Keep only the most recent signal per entity
    const latest = signals.reduce((best, s) =>
      s.eventTime > best.eventTime ? s : best
    )
    return [[extractEntityKey(latest), latest]]
  })

// Stream side probes the table
const enrichedAdsb = adsbStream
  .map(signal => [signal.icao, signal] as const)
  .join(
    osintTable,
    (adsb, osint) => ({
      adsb,
      osint,
      joinType: 'event_table' as const,
      confidence: osint.sourceReliability,
      temporalGap: adsb.eventTime - osint.eventTime,
    })
  )
```

**Temporal gap scoring**: The event-table join introduces a new confidence
modifier — the **temporal gap** between the fast signal and the slow side's
last update. Older slow-side data is less reliable:

```
temporal_penalty = min(1.0, gap_seconds / max_gap_seconds)
adjusted_confidence = base_confidence * (1.0 - temporal_penalty * decay_weight)

Where:
  gap_seconds = fast.eventTime - slow.eventTime
  max_gap_seconds = configurable per signal pair
  decay_weight = 0.0 to 1.0 (how much staleness matters)

Example:
  OSINT report from 1 hour ago:  penalty = min(1, 3600/86400) * 0.3 = 0.012
  OSINT report from 1 week ago:  penalty = min(1, 604800/86400) * 0.3 = 0.30
  OSINT report from 1 month ago: penalty = min(1, 2592000/86400) * 0.3 = 0.30 (capped)
```

**Retraction semantics**: When the slow side updates (new OSINT report), the
d2ts reduce operator retracts the old latest value and inserts the new one.
This cascades to all downstream joins: every fast-side signal that was joined
against the old slow-side value gets its output retracted and re-emitted with
the new slow-side value. The cascade scope is bounded by the number of fast-side
signals currently in the join's state.

#### A.2.3 Reference Join (R = infinity)

A special case of event-table join where the "slow side" is a static reference
dataset (FAA registry, ITU registry, IP-to-ASN mapping). The reference data
changes rarely (weekly/monthly updates) and is loaded as a d2ts collection.

```
Semantics:
  For each signal s at event-time t:
    Match with reference entry where:
      s.key == reference.key

  No temporal proximity required.
  Confidence contribution: 1.0 (authoritative source)
```

**d2ts pattern**: Identical to event-table join, but the reference collection
is initialized at startup and updated via versioned diffs when the reference
dataset is refreshed.

### A.3 Watermarks and Late Arrival

#### A.3.1 Event-Time vs Processing-Time

Tsingou uses **event-time** semantics throughout the fusion pipeline. Each
signal carries an event-time timestamp set by the source sensor. This ensures
that fusion results are deterministic and reproducible, regardless of network
delays or processing order.

```
Definitions:
  event_time      = when the physical observation occurred (sensor clock)
  ingestion_time  = when the signal entered the Tsingou NATS bus
  processing_time = when d2ts processes the signal

  INVARIANT: event_time <= ingestion_time <= processing_time
  EXCEPTION: Clock skew can violate event_time <= ingestion_time
             (handled by bounds checking)
```

#### A.3.2 Watermarks

A **watermark** W(t) is a monotonically advancing assertion: "all signals with
event-time <= W(t) have been received." Signals arriving after the watermark
has passed their event-time are **late**.

In d2ts terms, the watermark maps to the **frontier** — the minimum version
(timestamp) that may still receive new data. Once the frontier advances past
version v, no new data at version v can arrive.

```
Watermark computation per signal source:
  W(source, t) = max_event_time_seen(source) - allowed_lateness(source)

  allowed_lateness varies by signal kind:
    ADS-B:       5 sec    (reliable delivery, low latency)
    AIS:         30 sec   (satellite AIS has propagation delay)
    Radar:       2 sec    (local network, tight timing)
    RF bearing:  10 sec   (processing pipeline latency)
    OSINT/RSS:   300 sec  (publication and scraping delays)
    HTTP/DNS:    10 sec   (log shipping delay)
    STIX CTI:    3600 sec (batch delivery, webhook latency)

Global watermark for a join:
  W(join) = min(W(left_source), W(right_source))

  The join cannot advance past the slowest source.
  This means slow sources (OSINT, STIX) can hold back fast sources.
  Mitigation: event-table join mode avoids this by treating slow sources
  as tables (no watermark dependency).
```

#### A.3.3 Late Arrival Handling

Three strategies for signals that arrive after the watermark has passed:

**Strategy 1: Drop (default for windowed joins)**

```
If signal.event_time < watermark:
  Increment late_arrival_counter(source, signal_kind)
  Emit LateDrop event to operator dashboard
  Discard signal

Rationale: Windowed joins have already committed output for that time range.
  Accepting late data would require retracting and re-emitting potentially
  large numbers of join outputs.
```

**Strategy 2: Reprocess (for event-table joins)**

```
If signal.event_time < watermark AND signal is slow-side update:
  Accept the update into the table
  Retract all join outputs based on the PREVIOUS table state
  Re-emit join outputs with UPDATED table state

Rationale: Event-table joins maintain the latest state, not windowed state.
  A late slow-side update simply changes the current table snapshot.
  The fast-side signals are re-joined against the new snapshot.
  Cost is bounded by |fast-side signals in state| * |affected keys|.
```

**Strategy 3: Side-Channel (for auditing)**

```
If signal.event_time < watermark:
  Route to late_arrival_sidestream
  Available for offline/batch reprocessing
  Does NOT affect real-time fusion output

Rationale: Some late arrivals carry intelligence value even if they can't
  be integrated into the real-time pipeline. The operator reviews them
  in a separate view.
```

#### A.3.4 Late Arrival Policy in Join Path Registry

The JoinPathEntry schema (Section 6.2 of TSGC-001) is extended with temporal
configuration:

```typescript
const TemporalJoinConfig = Schema.Struct({
  mode: Schema.Literal('windowed', 'event_table', 'reference'),
  windowSizeMs: Schema.optionalWith(Schema.Int, { default: () => 5000 }),
  rateRatioThreshold: Schema.optionalWith(Schema.Number, { default: () => 10.0 }),
  lateArrivalPolicy: Schema.Literal('drop', 'reprocess', 'side_channel'),
  allowedLatenessMs: Schema.Struct({
    left: Schema.Int,
    right: Schema.Int,
  }),
  temporalGapDecay: Schema.optionalWith(Schema.Struct({
    maxGapSeconds: Schema.Int,
    decayWeight: Schema.Number,
  }), { default: () => ({ maxGapSeconds: 86400, decayWeight: 0.3 }) }),
})

// Extended JoinPathEntry (amends Section 6.2)
const JoinPathEntryV2 = Schema.Struct({
  // ... all existing fields from Section 6.2 ...
  temporal: TemporalJoinConfig,
})
```

### A.4 Watermark Interaction with Fusion Tiers

| Tier | Watermark Role | Late Arrival Strategy |
|------|---------------|----------------------|
| **Tier 1** (Hard Key) | Minimal — identity joins are atemporal. Late signal still matches by key. | Reprocess (always accept) |
| **Tier 2** (Soft Key) | Critical — temporal proximity is a predicate. Late signals may fall outside the window. | Drop or side-channel (configurable) |
| **Tier 3** (Derived) | Batch-oriented — watermarks define analysis epochs. | Reprocess (batch re-analysis) |

### A.5 Clock Skew and Timestamp Trust

Sensors have independent clocks. Clock skew can cause:

1. **Future timestamps** — event_time > processing_time. Indicates clock ahead.
   **Policy**: Clamp to max(event_time, processing_time + max_future_tolerance).
   Default max_future_tolerance = 5 seconds. Signals > 5 seconds in the future
   are flagged as clock_skew anomalies.

2. **Ancient timestamps** — event_time << processing_time. Indicates either
   massive delay or clock reset.
   **Policy**: If event_time is older than max_historical_age (default: 1 hour
   for streaming sources, 30 days for batch sources), flag as
   timestamp_anomaly and route to side-channel.

3. **Monotonicity violations** — event_time(n+1) < event_time(n) from the same
   source. Indicates clock rollback or out-of-order delivery.
   **Policy**: Accept if within allowed_lateness window. Otherwise treat as
   late arrival per the join's configured policy.

```typescript
const TimestampValidation = Schema.TaggedStruct('TimestampValidation', {
  signalId: Schema.String,
  eventTime: Schema.Number,
  processingTime: Schema.Number,
  sourceId: Schema.String,
  validation: Schema.Literal(
    'valid',
    'clamped_future',
    'flagged_ancient',
    'flagged_monotonicity_violation'
  ),
  originalEventTime: Schema.optionalWith(Schema.Number, { default: () => undefined }),
  clampedTo: Schema.optionalWith(Schema.Number, { default: () => undefined }),
})
```

### A.6 Example: Complete Temporal Configuration for Airfield Scenario

Extending the join paths from TSGC-001 Section 6.1 with temporal semantics:

```
PAIR 1: ADS-B x ADS-B (dedup)
  temporal:
    mode: windowed
    windowSizeMs: 2000      (2 sec — tight, both from ADS-B)
    lateArrivalPolicy: reprocess  (identity join, always accept)
    allowedLateness: { left: 5000, right: 5000 }

PAIR 2: ADS-B x FAA Registry (enrichment)
  temporal:
    mode: reference
    lateArrivalPolicy: reprocess  (registry updates always accepted)
    temporalGapDecay: null  (reference data has no staleness)

PAIR 3: ADS-B x AIS (spatial co-location)
  temporal:
    mode: windowed
    windowSizeMs: 10000     (10 sec — AIS updates slower)
    lateArrivalPolicy: drop  (windowed join, late data discarded)
    allowedLateness: { left: 5000, right: 30000 }

PAIR 4: ADS-B x RF Bearing (spatial+spectral)
  temporal:
    mode: windowed
    windowSizeMs: 5000      (5 sec — RF sweep is fast)
    lateArrivalPolicy: drop
    allowedLateness: { left: 5000, right: 10000 }

PAIR 7: HTTP x OSINT/RSS (semantic)
  temporal:
    mode: event_table       (OSINT rate << HTTP rate)
    lateArrivalPolicy: reprocess  (table side always accepts updates)
    allowedLateness: { left: 10000, right: 300000 }
    temporalGapDecay:
      maxGapSeconds: 86400  (1 day)
      decayWeight: 0.3      (30% confidence reduction at max gap)
```

---

## Amendment B: Track Lifecycle Management (R7)

*Proposed insertion: new Section 5.4 in TSGC-001, after Section 5.3 (Identifiers
SHOULD Match But Don't).*

---

### B.1 Track Lifecycle States

Every tracked entity in the fusion engine has a lifecycle state. This state
governs how the entity participates in joins, how its confidence is computed,
and when it is displayed to the operator.

```
                   +-----------+
                   |           |
   measurement --> | TENTATIVE |
   (unassigned)    |           |
                   +-----+-----+
                         |
                    confirmation
                    criteria met
                         |
                   +-----v-----+          +----------+
                   |           | missed   |          |
                   | CONFIRMED +--------->+ COASTING |
                   |           |  N scans |          |
                   +-----+-----+          +-----+----+
                         |                      |
                    continuous                recovery
                    updates                  (measurement
                         |                    re-acquired)
                         |                      |
                   +-----v-----+          +-----v----+
                   |           |          |          |
                   | CONFIRMED +<---------+ COASTING |
                   |           |          |          |
                   +-----+-----+          +-----+----+
                         |                      |
                    track merges           max coast
                    or operator            exceeded
                    action                      |
                         |               +------v-----+
                   +-----v-----+         |            |
                   |           |         |  DROPPED   |
                   | MERGED    |         |            |
                   |           |         +------------+
                   +-----------+
```

### B.2 State Definitions

| State | Description | Visible to Operator | Participates in Joins | Confidence Modifier |
|-------|-------------|--------------------|-----------------------|--------------------|
| **TENTATIVE** | Recently initiated track. Insufficient evidence to confirm as real target. May be clutter. | Dimmed / dashed outline | Yes (reduced weight) | x 0.5 |
| **CONFIRMED** | Sufficient evidence accumulated. High confidence this is a real entity. | Full visibility | Yes (full weight) | x 1.0 |
| **COASTING** | No measurements for N scans. Track is predicted but not updated. Uncertainty grows. | Warning indicator (amber) | Yes (decaying weight) | x (1.0 - coast_penalty) |
| **DROPPED** | Track lost. Maximum coast time exceeded or score fell below threshold. | Removed (or ghost trail) | No | 0.0 |
| **MERGED** | Track absorbed into another track via track-to-track fusion. | Redirect to merge target | No (redirect to target) | Inherited from target |

### B.3 Transition Rules

#### B.3.1 TENTATIVE -> CONFIRMED

Two confirmation methods (configurable per entity class):

**M-of-N Logic (History-Based)**

```
Confirm if: at least M detections in the last N scans

Parameters by entity class:
  Aircraft (ADS-B):    M=2, N=3   (fast confirmation — ADS-B is reliable)
  Aircraft (radar):    M=3, N=5   (moderate — radar has clutter)
  Vessel (AIS):        M=2, N=3   (AIS is cooperative, mostly reliable)
  Vessel (radar):      M=3, N=5   (maritime radar has sea clutter)
  RF Emitter:          M=3, N=5   (bearing noise, need repeated detection)
  Network Host:        M=2, N=2   (deterministic — if IP seen twice, it exists)
  OSINT Entity:        M=2, N=3   (multiple source corroboration)
```

**Score-Based Logic (SPRT)**

```
Hit:  score += ln(P_D * likelihood / clutter_density)
Miss: score += ln(1 - P_D)

Confirm when: score > confirm_threshold
Delete when:  score - max_score < delete_threshold

Parameters by entity class:
  Aircraft:    confirm=20, delete=-10, P_D=0.95
  Vessel:      confirm=15, delete=-8,  P_D=0.90
  RF Emitter:  confirm=25, delete=-12, P_D=0.80
  Network Host: confirm=10, delete=-5, P_D=0.99
```

**Selection guideline**: Use M-of-N for simple scenarios where sensor
characteristics are unknown. Use score-based when sensor detection probability
and clutter density are characterized.

#### B.3.2 CONFIRMED -> COASTING

Triggered when the track receives no measurement for consecutive scans:

```
Transition to COASTING when:
  consecutive_misses > coast_entry_threshold

coast_entry_threshold by entity class:
  Aircraft (ADS-B):    3 scans    (ADS-B is reliable; 3 misses is concerning)
  Aircraft (radar):    5 scans    (radar misses are more common)
  Vessel (AIS):        10 scans   (AIS update rate is variable)
  RF Emitter:          5 scans    (intermittent emission is normal)
  Network Host:        30 sec     (time-based, not scan-based)
```

While coasting, the track's kinematic state is **predicted only** (Kalman
predict step without update). The covariance grows monotonically, reflecting
increasing uncertainty about the entity's position.

```
Coasting covariance growth:
  P(k+1|k) = F * P(k|k) * F^T + Q

  Where Q is the process noise covariance.
  After N coast steps, position uncertainty grows as:
    sigma_pos ~ sigma_0 + sigma_v * N * dt + 0.5 * sigma_a * (N * dt)^2
```

#### B.3.3 COASTING -> CONFIRMED (Recovery)

If a measurement is successfully associated with a coasting track:

```
Transition back to CONFIRMED when:
  A measurement passes gating AND association for the coasting track

Actions on recovery:
  1. Reset consecutive_miss counter to 0
  2. Apply Kalman update with the new measurement
  3. Covariance "snaps back" to measurement-updated level
  4. Re-evaluate confirmation score/history

No re-tentative phase: once CONFIRMED, recovery goes directly back to
CONFIRMED. The track has historical evidence supporting its existence.
```

#### B.3.4 COASTING -> DROPPED

```
Transition to DROPPED when:
  M-of-N: consecutive_misses > max_coast_scans
  Score:  score - max_score < delete_threshold

max_coast_scans by entity class:
  Aircraft (ADS-B):    10 scans    (~10 sec — likely left coverage)
  Aircraft (radar):    20 scans    (~60 sec at 3 sec rotation)
  Vessel (AIS):        60 scans    (~3 min — AIS gap is common)
  RF Emitter:          30 scans    (~30 sec of silence)
  Network Host:        300 sec     (5 min timeout)
  OSINT Entity:        86400 sec   (24 hours — OSINT entities persist)
```

**DROPPED is terminal.** A dropped track is removed from the active track
table. Its history is archived for audit/replay. If the same entity reappears,
it is initiated as a NEW tentative track. Track identity does not persist
across drop/re-initiation boundaries.

Exception: The operator may manually link a new track to a dropped track via
the alias/merge facility, effectively asserting "this is the same entity that
left and came back."

#### B.3.5 * -> MERGED

Track merging occurs when track-to-track fusion (Section 9 of TSGC-RI-1/2)
determines that two tracks from different sensors represent the same entity:

```
Transition to MERGED when:
  Tier 1: Hard key match between two tracks (e.g., both have same ICAO)
  Tier 2: Soft key fusion confidence exceeds merge_threshold (default 0.90)
  Operator: Manual merge command

Actions on merge:
  1. Select SURVIVING track (higher score, or sensor priority, or operator choice)
  2. Redirect merged track's ID to surviving track's ID
  3. Transfer merged track's measurement history to surviving track
  4. Recompute surviving track's state using combined measurements
  5. Emit MergeEvent for provenance chain
  6. Retract all join outputs that referenced the merged track ID
  7. Re-emit join outputs with surviving track ID
```

### B.4 Lifecycle Interaction with Fusion Tiers

| Lifecycle State | Tier 1 (Hard Key) | Tier 2 (Soft Key) | Tier 3 (Derived) |
|----------------|-------------------|-------------------|-------------------|
| **TENTATIVE** | Joins normally (key match is deterministic) | Confidence reduced by 0.5x | Excluded (insufficient evidence) |
| **CONFIRMED** | Joins normally | Full confidence | Included in statistical analysis |
| **COASTING** | Joins normally (key still valid) | Confidence decays with coast duration | Excluded (no fresh data) |
| **DROPPED** | No joins | No joins | Excluded |
| **MERGED** | Redirected to surviving track | Redirected to surviving track | Redirected |

### B.5 d2ts Implementation

Track lifecycle is managed as a d2ts `reduce` with state accumulation:

```typescript
import { Schema } from 'effect'

// --- Track Lifecycle State Machine ---

const TrackLifecycleState = Schema.Literal(
  'tentative', 'confirmed', 'coasting', 'dropped', 'merged'
)

const LifecycleTransition = Schema.TaggedStruct('LifecycleTransition', {
  trackId: Schema.String,
  fromState: TrackLifecycleState,
  toState: TrackLifecycleState,
  reason: Schema.Literal(
    'initiated',
    'm_of_n_confirmed',
    'score_confirmed',
    'detection_missed',
    'detection_recovered',
    'max_coast_exceeded',
    'score_below_threshold',
    'merged_into',
    'operator_action'
  ),
  timestamp: Schema.Number,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

const TrackLifecycleConfig = Schema.TaggedStruct('TrackLifecycleConfig', {
  entityClass: Schema.String,
  confirmationMethod: Schema.Literal('m_of_n', 'score_based'),

  // M-of-N parameters
  m: Schema.optionalWith(Schema.Int, { default: () => 3 }),
  n: Schema.optionalWith(Schema.Int, { default: () => 5 }),

  // Score-based parameters
  confirmThreshold: Schema.optionalWith(Schema.Number, { default: () => 20 }),
  deleteThreshold: Schema.optionalWith(Schema.Number, { default: () => -10 }),
  detectionProbability: Schema.optionalWith(Schema.Number, { default: () => 0.9 }),
  clutterDensity: Schema.optionalWith(Schema.Number, { default: () => 1e-6 }),

  // Coast parameters
  coastEntryMisses: Schema.Int,
  maxCoastScans: Schema.Int,

  // Confidence modifiers
  tentativeConfidenceMultiplier: Schema.optionalWith(Schema.Number, { default: () => 0.5 }),
  coastConfidenceDecayPerScan: Schema.optionalWith(Schema.Number, { default: () => 0.05 }),
})

// d2ts lifecycle reducer
function trackLifecycleReducer(
  config: typeof TrackLifecycleConfig.Type
) {
  return (updates: Array<{ trackId: string; detected: boolean; score: number }>) => {
    const results: Array<[string, LifecycleUpdate]> = []

    for (const update of updates) {
      const current = getTrackState(update.trackId)

      switch (current.state) {
        case 'tentative': {
          if (config.confirmationMethod === 'm_of_n') {
            const history = [...current.hitHistory, update.detected].slice(-config.n!)
            const hits = history.filter(Boolean).length
            if (hits >= config.m!) {
              results.push([update.trackId, {
                state: 'confirmed',
                transition: 'm_of_n_confirmed',
              }])
            } else if (history.length >= config.n! && hits < 1) {
              results.push([update.trackId, {
                state: 'dropped',
                transition: 'score_below_threshold',
              }])
            }
          } else {
            // Score-based
            if (update.score > config.confirmThreshold!) {
              results.push([update.trackId, {
                state: 'confirmed',
                transition: 'score_confirmed',
              }])
            } else if (update.score - current.maxScore < config.deleteThreshold!) {
              results.push([update.trackId, {
                state: 'dropped',
                transition: 'score_below_threshold',
              }])
            }
          }
          break
        }

        case 'confirmed': {
          if (!update.detected) {
            const misses = current.consecutiveMisses + 1
            if (misses > config.coastEntryMisses) {
              results.push([update.trackId, {
                state: 'coasting',
                transition: 'detection_missed',
                consecutiveMisses: misses,
              }])
            }
          }
          break
        }

        case 'coasting': {
          if (update.detected) {
            results.push([update.trackId, {
              state: 'confirmed',
              transition: 'detection_recovered',
              consecutiveMisses: 0,
            }])
          } else {
            const misses = current.consecutiveMisses + 1
            if (misses > config.maxCoastScans) {
              results.push([update.trackId, {
                state: 'dropped',
                transition: 'max_coast_exceeded',
              }])
            }
          }
          break
        }

        case 'dropped':
        case 'merged':
          // Terminal states — no transitions
          break
      }
    }

    return results
  }
}
```

### B.6 Lifecycle Events as NATS Signals

Track lifecycle transitions are themselves signals, published to the NATS bus
for consumption by the operator interface and audit trail:

```
Subject pattern: tsingou.track.lifecycle.<entity_class>.<track_id>

Payload: LifecycleTransition schema

Examples:
  tsingou.track.lifecycle.aircraft.trk-001  { toState: "confirmed", reason: "m_of_n_confirmed" }
  tsingou.track.lifecycle.vessel.trk-042    { toState: "coasting", reason: "detection_missed" }
  tsingou.track.lifecycle.rf_emitter.trk-99 { toState: "dropped", reason: "max_coast_exceeded" }
```

These events feed the operator dashboard's track status display and enable
retrospective analysis of track quality.

### B.7 Default Lifecycle Configurations

| Entity Class | Method | M | N | Coast Entry | Max Coast | Confirm Score | Delete Score |
|-------------|--------|---|---|-------------|-----------|---------------|-------------|
| Aircraft (ADS-B) | m_of_n | 2 | 3 | 3 | 10 | - | - |
| Aircraft (radar) | score | - | - | 5 | 20 | 20 | -10 |
| Vessel (AIS) | m_of_n | 2 | 3 | 10 | 60 | - | - |
| Vessel (radar) | score | - | - | 5 | 30 | 15 | -8 |
| RF Emitter | score | - | - | 5 | 30 | 25 | -12 |
| Network Host | m_of_n | 2 | 2 | 30s | 300s | - | - |
| OSINT Entity | m_of_n | 2 | 3 | - | 86400s | - | - |

---

## Schema Additions Summary

The following schemas are proposed for inclusion in the fusion ontology:

```typescript
// R1: Temporal join configuration (extends JoinPathEntry)
const TemporalJoinConfig = Schema.Struct({
  mode: Schema.Literal('windowed', 'event_table', 'reference'),
  windowSizeMs: Schema.optionalWith(Schema.Int, { default: () => 5000 }),
  rateRatioThreshold: Schema.optionalWith(Schema.Number, { default: () => 10.0 }),
  lateArrivalPolicy: Schema.Literal('drop', 'reprocess', 'side_channel'),
  allowedLatenessMs: Schema.Struct({
    left: Schema.Int,
    right: Schema.Int,
  }),
  temporalGapDecay: Schema.optionalWith(Schema.Struct({
    maxGapSeconds: Schema.Int,
    decayWeight: Schema.Number,
  }), { default: () => ({ maxGapSeconds: 86400, decayWeight: 0.3 }) }),
})

const TimestampValidation = Schema.TaggedStruct('TimestampValidation', {
  signalId: Schema.String,
  eventTime: Schema.Number,
  processingTime: Schema.Number,
  sourceId: Schema.String,
  validation: Schema.Literal(
    'valid', 'clamped_future', 'flagged_ancient', 'flagged_monotonicity_violation'
  ),
  originalEventTime: Schema.optionalWith(Schema.Number, { default: () => undefined }),
  clampedTo: Schema.optionalWith(Schema.Number, { default: () => undefined }),
})

// R7: Track lifecycle (new section)
const TrackLifecycleState = Schema.Literal(
  'tentative', 'confirmed', 'coasting', 'dropped', 'merged'
)

const LifecycleTransition = Schema.TaggedStruct('LifecycleTransition', {
  trackId: Schema.String,
  fromState: TrackLifecycleState,
  toState: TrackLifecycleState,
  reason: Schema.Literal(
    'initiated', 'm_of_n_confirmed', 'score_confirmed',
    'detection_missed', 'detection_recovered',
    'max_coast_exceeded', 'score_below_threshold',
    'merged_into', 'operator_action'
  ),
  timestamp: Schema.Number,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

const TrackLifecycleConfig = Schema.TaggedStruct('TrackLifecycleConfig', {
  entityClass: Schema.String,
  confirmationMethod: Schema.Literal('m_of_n', 'score_based'),
  m: Schema.optionalWith(Schema.Int, { default: () => 3 }),
  n: Schema.optionalWith(Schema.Int, { default: () => 5 }),
  confirmThreshold: Schema.optionalWith(Schema.Number, { default: () => 20 }),
  deleteThreshold: Schema.optionalWith(Schema.Number, { default: () => -10 }),
  detectionProbability: Schema.optionalWith(Schema.Number, { default: () => 0.9 }),
  clutterDensity: Schema.optionalWith(Schema.Number, { default: () => 1e-6 }),
  coastEntryMisses: Schema.Int,
  maxCoastScans: Schema.Int,
  tentativeConfidenceMultiplier: Schema.optionalWith(Schema.Number, { default: () => 0.5 }),
  coastConfidenceDecayPerScan: Schema.optionalWith(Schema.Number, { default: () => 0.05 }),
})
```

---

## Integration Points with Other Amendments

| Amendment | Integration Point |
|-----------|------------------|
| **R2** (Negative-Space Detection) | Coasting tracks generate negative-space signals ("expected AIS here, none seen") |
| **R3** (Risk Accumulation) | Track lifecycle transitions contribute to cumulative risk scoring |
| **R4** (Confidence Model) | Lifecycle state modifies confidence: tentative=0.5x, coasting=decay |
| **R5** (Reference vs Event Data) | Reference join mode (A.2.3) is the temporal specification for R5 |
| **R6** (Blocking Strategy) | Blocking applies BEFORE temporal join — blocking is atemporal, temporal is post-blocking |
| **R8** (Tier 3 Decomposition) | Tier 3 statistical analysis uses CONFIRMED tracks only (lifecycle filter) |
| **R9** (Event Ordering) | Watermark/frontier system (A.3.2) is the foundation for R9's ordering guarantees |

---

## References

- [WATERMARKS] Akidau, T. et al. "The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost in Massive-Scale, Unbounded, Out-of-Order Data Processing." VLDB 2015.
- [TEMPORAL-JOIN] Apache Flink. "Temporal Tables and Joins in Streaming SQL." 2019.
- [RISINGWAVE] RisingWave Labs. "RFC-0049: Temporal Join." 2023.
- [FRONTIER] McSherry, F. "Progress Tracking in Timely Dataflow." 2019.
- [D2TS] @electric-sql/d2ts. "Differential Dataflow in TypeScript." 2024.
- [TSGC-001] Tsingou TSGC-001: Fusion Ontology Design.
- [TSGC-RI-1/2] Tsingou TSGC-RI-1/2: Multi-Target Tracking & Fuzzy Identity Resolution.
- [KALMAN] Kalman, R.E. "A New Approach to Linear Filtering and Prediction Problems." 1960.
- [MHT] Reid, D. "An Algorithm for Tracking Multiple Targets." IEEE TAC, 1979.
- [SPRT] Wald, A. "Sequential Tests of Statistical Hypotheses." Annals of Mathematical Statistics, 1945.

---

*End of TSGC-001-AMD-R1R7*
