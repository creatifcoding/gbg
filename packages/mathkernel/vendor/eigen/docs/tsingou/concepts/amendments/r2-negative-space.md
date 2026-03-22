# TSGC-001 Amendment: R2 (Absence Detection) + R3 (Risk Accumulation)

```
Amendment:  TSGC-001-A2 — Negative-Space Detection & Risk Accumulation
Status:     DRAFT
Created:    2026-02-19
Author:     adversarial-researcher
Amends:     TSGC-001 Section 9 (Confidence Semantics), Section 3 (Fusion Tiers)
Introduces: Section 9.1 (Absence Output Type), Section 9.2 (Risk Accumulation)
Evidence:   TSGC-GT-001 Section 3.4 (R2, R3 recommendations)
            TSGC-002 (RI-7 spoofing detection — dark vessel canonical example)
Depends:    R1+R7 (r1-temporal-joins.md — COASTING state triggers absence via tsingou.track.lifecycle.*)
            R4 (r4-confidence-tier3.md — spoofing discount affects absence confidence)
            R5 (r5-data-model-blocking.md — ESR is reference data via tsingou.ref.esr.*)
```

> **Motivation**: TSGC-001 defines four output types: Merge, Correlate, Enrich,
> Flag. All four respond to the *presence* of signals. But the *absence* of an
> expected signal is itself evidence — often the most operationally significant
> kind. A vessel that stops transmitting AIS is more interesting than one that
> continues. Similarly, no single weak indicator may cross a fusion threshold,
> but many weak indicators converging on the same entity should compound into
> actionable risk. This amendment adds two capabilities: **Absence** detection
> (what is missing?) and **Risk Accumulation** (what is quietly building?).

---

## R2: Negative-Space Detection — The Absence Output Type

### R2.1 Theoretical Foundation

Wolfgang Koch's seminal work on "negative sensor evidence" (Information Fusion,
2007) established that a failed attempt to detect a target in the field of view
of a sensor is itself useful sensor output. Within a Bayesian framework, the
absence of an expected measurement updates the posterior probability of target
state — no ad hoc schemes required.

The key insight: **if a sensor SHOULD have observed an entity and DID NOT, that
non-observation carries information proportional to the sensor's detection
probability in that region.**

```
P(entity_present | no_detection) =
  P(no_detection | entity_present) * P(entity_present)
  / P(no_detection)

where P(no_detection | entity_present) = 1 - P_d(sensor, region)

If P_d is high (good sensor, clear conditions), non-detection
strongly reduces P(entity_present).

If P_d is low (poor sensor, adverse conditions), non-detection
tells us little.
```

This maps directly to Tsingou's fusion architecture: the absence of an
expected signal is a fusion event with computable confidence.

### R2.2 The Expected Signal Registry

Before detecting absence, the system must know what to expect. The Expected
Signal Registry (ESR) is a declarative configuration that defines, per entity
class, what signals SHOULD be observed given known conditions.

#### R2.2.1 Registry Schema

```typescript
const ExpectedSignalEntry = Schema.Struct({
  id:                Schema.String,
  entityClass:       Schema.String,           // "Vessel", "Aircraft", etc.
  signalKind:        Schema.String,           // "AIS", "ADS-B", "radar", etc.
  expectedRate:      Schema.Struct({
    nominal:         Schema.Number,           // messages per second (nominal)
    min:             Schema.Number,           // minimum before gap declared
    conditions:      Schema.optional(Schema.Array(RateCondition)),
  }),
  detectionProbability: Schema.Struct({
    clear:           Schema.Number,           // P_d in good conditions (0-1)
    degraded:        Schema.Number,           // P_d in adverse conditions
    factors:         Schema.Array(Schema.String), // ["weather", "range", "terrain"]
  }),
  absenceThreshold:  Schema.Struct({
    warning:         Schema.Number,           // seconds before warning
    critical:        Schema.Number,           // seconds before critical
    classification:  Schema.Number,           // seconds before "dark" classification
  }),
  exceptions:        Schema.Array(Schema.Struct({
    condition:       Schema.String,           // "in_port", "maintenance", "known_gap"
    action:          Schema.Literal("suppress", "extend_threshold", "annotate"),
    factor:          Schema.optional(Schema.Number),
  })),
})
```

#### R2.2.2 Default Registry Entries

| Entity Class | Signal Kind | Nominal Rate    | Warning  | Critical | Dark       |
|-------------|-------------|-----------------|----------|----------|------------|
| Vessel      | AIS Class A | 2-10s underway  | 5 min    | 30 min   | 2 hours    |
| Vessel      | AIS Class B | 30s underway    | 10 min   | 60 min   | 4 hours    |
| Vessel      | AIS (anchor)| 3 min           | 15 min   | 2 hours  | 12 hours   |
| Aircraft    | ADS-B       | 1/sec           | 30 sec   | 5 min    | 30 min     |
| Aircraft    | Radar return| 4-12/min (scan) | 2 min    | 10 min   | 30 min     |
| Network Host| HTTP beacon | configurable    | 2x period| 5x period| 10x period |
| Network Host| DNS query   | varies          | varies   | varies   | varies     |
| RF Emitter  | SDR detect  | continuous      | 30 sec   | 5 min    | 30 min     |
| Ground Veh  | ANPR        | at checkpoints  | N/A      | N/A      | route-based|

#### R2.2.3 Condition-Dependent Rate Adjustment

The expected rate is not static. It varies with entity state, environment,
and sensor coverage:

```
RATE ADJUSTMENT ALGORITHM

For entity E with signal kind S:
  base_rate = ESR[E.class, S].expectedRate.nominal

  -- Adjust for entity state
  IF E.nav_status == "at_anchor":
    adjusted_rate = AIS_ANCHOR_RATE   // 3 min for AIS Class A
  ELIF E.nav_status == "underway_using_engine":
    adjusted_rate = rate_for_speed(E.speed)

  -- Adjust for sensor coverage
  IF E.position IN coverage_gap(S):
    adjusted_rate = 0   // cannot expect what we cannot receive
    suppress_absence()

  -- Adjust for environmental conditions
  IF weather.at(E.position).degraded:
    adjusted_rate *= ESR[E.class, S].detectionProbability.degraded
                   / ESR[E.class, S].detectionProbability.clear

  -- Adjust for known exceptions
  FOR exception IN ESR[E.class, S].exceptions:
    IF evaluate_condition(exception.condition, E):
      apply_exception(exception)

  RETURN adjusted_rate
```

### R2.3 Absence Event Generation

When an expected signal fails to arrive within its threshold window, the
system generates an Absence event — a first-class fusion output alongside
Merge, Correlate, Enrich, and Flag.

#### R2.3.1 Absence Event Schema

```typescript
const AbsenceEvent = Schema.TaggedStruct("AbsenceEvent", {
  id:               Schema.String,
  entityId:         Schema.String,
  entityClass:      Schema.String,
  missingSignalKind: Schema.String,
  lastObservation:  Schema.Struct({
    timestamp:      Schema.DateTimeUtc,
    position:       Schema.optional(GeoPoint),
    source:         Schema.String,
  }),
  absenceDuration:  Schema.Number,           // seconds since last observation
  expectedRate:     Schema.Number,           // what we expected (adjusted)
  missedCount:      Schema.Number,           // how many expected messages missed
  severity:         Schema.Literal("warning", "critical", "dark"),
  confidence:       Schema.Number,           // confidence that absence is real
  assessment:       Schema.Literal(
    "coverage_gap",        // sensor cannot see this area
    "equipment_failure",   // transponder malfunction
    "deliberate_dark",     // intentional signal suppression
    "ambiguous"            // insufficient evidence to classify
  ),
  contributingEvidence: Schema.Array(Schema.Struct({
    evidenceType:   Schema.String,
    description:    Schema.String,
    weight:         Schema.Number,
  })),
  lastKnownState:   Schema.Struct({
    position:       Schema.optional(GeoPoint),
    velocity:       Schema.optional(Schema.Number),
    heading:        Schema.optional(Schema.Number),
    projectedPosition: Schema.optional(GeoPoint),   // where entity would be now
    projectionUncertainty: Schema.optional(Schema.Number), // meters, growing with time
  }),
})
```

#### R2.3.2 Absence Detection Algorithm

```pseudocode
ALGORITHM: Absence Detector
INPUT:     Stream of observations + Expected Signal Registry
STATE:     last_seen[entity_id][signal_kind] = {timestamp, position, source}
           absence_state[entity_id][signal_kind] = {severity, event_id, ...}

TICK INTERVAL: 10 seconds (configurable)

ON EACH TICK:
  current_time = now()

  FOR EACH tracked entity E:
    FOR EACH expected signal S in ESR[E.class]:
      last = last_seen[E.id][S]
      IF last is None:
        CONTINUE  // never observed this signal for this entity

      elapsed = current_time - last.timestamp
      expected_rate = compute_adjusted_rate(E, S)

      IF expected_rate == 0:
        CONTINUE  // not expected in current conditions

      expected_interval = 1.0 / expected_rate
      missed_count = floor(elapsed / expected_interval) - 1

      -- Compute thresholds (may be condition-adjusted)
      thresholds = compute_thresholds(E, S)

      -- Determine severity
      IF elapsed < thresholds.warning:
        -- Normal: clear any existing absence state
        IF absence_state[E.id][S] exists:
          close_absence_event(E.id, S, reason="signal_resumed")
        CONTINUE

      severity = classify_severity(elapsed, thresholds)

      -- Compute confidence that absence is REAL (not a coverage gap)
      absence_confidence = compute_absence_confidence(E, S, elapsed)

      -- Classify the absence
      assessment = classify_absence(E, S, elapsed, absence_confidence)

      -- Generate or update absence event
      IF absence_state[E.id][S] not exists:
        event = create_absence_event(E, S, severity, absence_confidence, assessment)
        absence_state[E.id][S] = event
        emit_alert(event)
      ELSE:
        update_absence_event(absence_state[E.id][S], severity, elapsed)
        IF severity_escalated:
          emit_alert_escalation(event)

ON OBSERVATION RECEIVED (entity_id, signal_kind, observation):
  last_seen[entity_id][signal_kind] = observation

  IF absence_state[entity_id][signal_kind] exists:
    close_absence_event(entity_id, signal_kind, reason="signal_resumed")
    -- Log the gap for pattern analysis
    log_gap(entity_id, signal_kind, gap_duration, assessment)
```

### R2.4 Absence Confidence Model

The confidence that an absence is "real" (the entity is genuinely not
transmitting) depends on whether the sensor COULD have detected it:

```
ABSENCE CONFIDENCE COMPUTATION

Given:
  P_d     = detection probability of sensor for this entity at this range/conditions
  elapsed = time since last observation
  rate    = expected message rate

-- Probability of missing N consecutive messages by chance alone
P_miss_by_chance = (1 - P_d)^N
  where N = floor(elapsed * rate)

-- Confidence that absence is real (not sensor miss)
C_absence = 1.0 - P_miss_by_chance

Examples (P_d = 0.95, rate = 1/10s):
  elapsed = 60s  → N = 6   → C = 1 - 0.05^6  = 0.99999998   (certain)
  elapsed = 30s  → N = 3   → C = 1 - 0.05^3  = 0.999875     (very high)
  elapsed = 10s  → N = 1   → C = 1 - 0.05^1  = 0.95          (high)

Examples (P_d = 0.60, rate = 1/30s — degraded conditions):
  elapsed = 300s → N = 10  → C = 1 - 0.40^10 = 0.99989       (high)
  elapsed = 90s  → N = 3   → C = 1 - 0.40^3  = 0.936         (good)
  elapsed = 30s  → N = 1   → C = 1 - 0.40^1  = 0.60          (marginal)

DESIGN NOTE:
  When C_absence < 0.5, the absence MAY be a coverage gap, not
  intentional darkness. The system should annotate, not alert.
```

### R2.5 Absence Classification

The decision tree for classifying WHY a signal is absent:

```
ABSENCE CLASSIFICATION TREE

Q1: Is the entity's last known position within sensor coverage?
├── NO  → assessment = "coverage_gap"
│        confidence penalty: -0.5 (absence is less meaningful)
│        action: annotate, do not alert
│
└── YES → PROCEED to Q2

Q2: Are OTHER signals from this entity still being received?
├── YES → Only one signal kind is missing
│   ├── Q3: Is the missing signal from the entity's own transmitter?
│   │   ├── YES (e.g., AIS missing but radar present)
│   │   │   → assessment = "equipment_failure" or "deliberate_dark"
│   │   │   → PROCEED to Q4 for disambiguation
│   │   └── NO (e.g., radar missing but AIS present)
│   │       → assessment = "sensor_issue" (our sensor, not their transmitter)
│   │       → action: check sensor health
│   │
│   └── Q4: Behavioral indicators of intentional darkness?
│       ├── Entity was approaching sensitive area → "deliberate_dark" (+0.3)
│       ├── Entity changed course before going dark → "deliberate_dark" (+0.2)
│       ├── Entity speed was decelerating → "equipment_failure" or "anchoring"
│       ├── Entity has history of dark periods → "deliberate_dark" (+0.2)
│       └── No behavioral indicators → "ambiguous"
│
└── NO  → ALL signals missing simultaneously
    ├── Sudden (all signals lost within 60s)
    │   ├── Weather event in area → "environmental" (not entity's fault)
    │   ├── Known jamming zone → "electronic_warfare"
    │   └── No external cause → "deliberate_dark" (high confidence)
    │
    └── Gradual (signals lost over minutes/hours)
        ├── Entity moving away from coverage → "coverage_gap"
        ├── Signals degrading in quality first → "equipment_failure"
        └── Abrupt quality then gap → "deliberate_dark"

OUTPUT:
  assessment: one of ["coverage_gap", "equipment_failure", "deliberate_dark",
                       "environmental", "electronic_warfare", "ambiguous"]
  confidence: 0.0-1.0
  evidence:   list of contributing factors and their weights
```

### R2.6 Projected Position Under Absence

When an entity goes dark, its position becomes uncertain. The system
maintains a projected position with growing uncertainty:

```
POSITION PROJECTION DURING ABSENCE

Given:
  P_last = last known position
  V_last = last known velocity vector (speed + heading)
  T_last = timestamp of last observation
  T_now  = current time
  dt     = T_now - T_last

DEAD RECKONING (constant velocity model):
  P_projected = P_last + V_last * dt

UNCERTAINTY GROWTH:
  -- Position uncertainty grows linearly with time (constant velocity model)
  -- Plus additional uncertainty for possible course changes
  sigma_pos(dt) = sigma_initial
                + sigma_velocity * dt
                + sigma_maneuver * dt^2

  where:
    sigma_initial  = GPS accuracy at last fix (~10m)
    sigma_velocity = velocity measurement error (~0.5 m/s)
    sigma_maneuver = maneuver potential (~0.01 m/s^2 for vessels)

  -- This creates a growing "uncertainty disk" around projected position
  -- Radius at 95% confidence:
  R_95(dt) = 2 * sigma_pos(dt)

Examples for a vessel at 10 knots:
  dt = 5 min:   R_95 = ~150m    (useful for search)
  dt = 30 min:  R_95 = ~2 km    (still constraining)
  dt = 2 hours: R_95 = ~15 km   (broad area)
  dt = 12 hours:R_95 = ~200 km  (barely useful)
  dt = 24 hours:R_95 = ~800 km  (essentially lost)

VISUALIZATION:
  Display P_projected as a circle with radius R_95
  Circle color: follows absence severity (warning → critical → dark)
  Circle style: dashed border, semi-transparent fill
  Label: "Projected (last seen X ago)"
```

### R2.7 Absence as Fusion Input

Absence events feed back into the fusion ontology at three points:

**Point 1: New Output Type in Section 9**

The confidence semantics table (TSGC-001 Section 9) gains a fifth row:

| Output Type | Meaning | Confidence Semantics |
|-------------|---------|----------------------|
| **Absence** | Expected signal not received | C = f(P_d, elapsed, rate) — grows with time |

**Point 2: Absence-Triggered Correlation**

An absence can be correlated with other signals:

```
ABSENCE CORRELATION RULES

Rule 1: Dark vessel + satellite imagery detection at projected position
  → Entity found despite AIS absence
  → Confirmation of "deliberate_dark" assessment
  → Generate: Correlate(absence_event, satellite_detection)

Rule 2: Dark vessel + RF emission detected at projected position
  → Entity is transmitting something (just not AIS)
  → Strengthen "deliberate_dark" assessment
  → Generate: Correlate(absence_event, rf_detection)

Rule 3: Dark vessel + other vessel at last known position
  → Possible ship-to-ship transfer
  → Generate: Flag(absence_event, co_location_event, "STS_transfer_suspect")

Rule 4: Dark aircraft + radar track at projected position
  → ADS-B out but aircraft still flying
  → Could be equipment failure or transponder-off
  → Generate: Correlate(absence_event, radar_track)
```

**Point 3: Absence in the Join Path Registry**

New join path entries for absence-based fusion:

```
PAIR 9: Absence x Satellite Imagery (cross-modality verification)
  Left:      absence_event.projectedPosition
  Right:     satellite_detection.position
  Join type: spatial + temporal
  Predicates:
    - haversine(projected, detected) < R_95(absence.elapsed)
    - satellite_pass_time within absence_duration
  Purpose:   Confirm or deny entity presence despite signal absence
  Confidence: f(R_95_overlap, satellite_resolution)
  Tier: 2

PAIR 10: Absence x RF Detection (dark-but-emitting)
  Left:      absence_event.projectedPosition
  Right:     rf_detection.bearing_cone
  Join type: spatial + spectral
  Predicates:
    - point_in_cone(projected, rf_bearing) = true
    - rf_frequency NOT in [AIS_band, ADS-B_band] (different signal)
  Purpose:   Detect entities that suppressed one signal but not others
  Confidence: f(bearing_accuracy, frequency_match)
  Tier: 2
```

### R2.8 d2ts Implementation Pattern

Absence detection in d2ts is implemented as a **temporal anti-join** with
a heartbeat operator:

```
d2ts ABSENCE DETECTION

-- Input: observation stream, grouped by entity+signal
const observations = observationStream.groupBy(
  obs => `${obs.entityId}:${obs.signalKind}`
)

-- Heartbeat: emit tick every 10s for each tracked entity
const heartbeat = tickStream.flatMap(tick =>
  trackedEntities.map(e => ({ entityId: e.id, tick: tick.time }))
)

-- Anti-join: find entities where heartbeat fires but no recent observation
const absences = heartbeat
  .join(
    observations,
    (hb, obs) => hb.entityId === obs.entityId,
    windowSize = MAX_ABSENCE_THRESHOLD
  )
  .filter(([hb, obs]) => obs === null || isStale(obs, hb.tick))
  .map(([hb, _]) => generateAbsenceEvent(hb.entityId, hb.tick))

-- Absence events feed into the fusion pipeline as first-class outputs
const fusedAbsences = absences
  .join(satelliteDetections, absenceSatellitePredicates)
  .join(rfDetections, absenceRfPredicates)
```

### R2.9 Operator Interface for Absence

The z:3 control layer gains new controls for absence monitoring:

```
ABSENCE CONTROLS (z:3)

┌ ABSENCE MONITORING ─────────────────────────────────────────┐
│                                                             │
│  Tracked Entities: 142    Dark: 3    Warning: 7             │
│                                                             │
│  ┌ DARK ENTITIES ──────────────────────────────────────┐   │
│  │  ⬤ PACIFIC VOYAGER  MMSI 211900042  Dark 4h12m     │   │
│  │    Last: 33.74N 84.39W  Projected: 34.01N 83.91W   │   │
│  │    Assessment: deliberate_dark (C: 0.87)             │   │
│  │    R95: 18km  [Show projection] [Investigate]        │   │
│  │                                                      │   │
│  │  ⬤ STAR FORTUNE     MMSI 538003421  Dark 11h        │   │
│  │    Last: 1.27N 103.85E  Assessment: coverage_gap     │   │
│  │    [Suppress] [Monitor]                               │   │
│  │                                                      │   │
│  │  ⬤ N72834           ICAO A4F2B7    Dark 45m         │   │
│  │    Last: 33.63N 84.42W  Assessment: ambiguous        │   │
│  │    Radar track present → probable equipment_failure   │   │
│  │    [Cross-reference] [Investigate]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Thresholds: Warning [5m ▼] Critical [30m ▼] Dark [2h ▼]  │
│  Coverage gaps: [Show ✓]  Auto-suppress in-port: [On ✓]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## R3: Risk Accumulation — Entity-Centric Compound Scoring

### R3.1 The Weak Signal Problem

TSGC-001's confidence model operates on individual join paths: each
pair-wise fusion produces a confidence score, and if it exceeds the
fusion threshold (default 0.65), the join fires. But what about entities
where no single indicator crosses the threshold, yet multiple weak
indicators converge?

```
Example: Entity E has the following indicators, NONE above 0.65:

  AIS position drift:       anomaly score 0.3
  Speed inconsistency:      anomaly score 0.4
  Unusual route deviation:  anomaly score 0.35
  Proximity to sanctioned vessel: score 0.25
  Previous dark period (48h ago): score 0.2
  Flag state mismatch with MMSI: score 0.15

No single indicator is actionable.
All six together paint a picture of a vessel worth investigating.
```

Risk accumulation solves this by maintaining a per-entity risk score that
compounds weak signals over time, applying temporal decay to prevent
stale indicators from persisting indefinitely.

### R3.2 Risk Score Architecture

#### R3.2.1 Risk Categories

Risk indicators are organized into categories that align with operational
concerns:

| Category         | Code  | Description                                     | Weight |
|------------------|-------|-------------------------------------------------|--------|
| Identity         | ID    | MMSI/ICAO anomalies, flag mismatches, name changes | 0.20  |
| Kinematic        | KIN   | Speed/heading anomalies, impossible maneuvers    | 0.20   |
| Behavioral       | BEH   | Route deviation, unusual patterns, loitering     | 0.20   |
| Association      | ASSOC | Proximity to flagged entities, STS meeting       | 0.15   |
| Signal Integrity | SIG   | Spoofing indicators, dark periods, RSSI anomaly  | 0.15   |
| Intelligence     | INTEL | Watchlist match, sanctions proximity, OSINT hits | 0.10   |

#### R3.2.2 Risk Score Schema

```typescript
const RiskIndicator = Schema.TaggedStruct("RiskIndicator", {
  id:           Schema.String,
  entityId:     Schema.String,
  category:     Schema.Literal("ID", "KIN", "BEH", "ASSOC", "SIG", "INTEL"),
  source:       Schema.String,           // which detector/join produced this
  score:        Schema.Number,           // 0.0-1.0
  timestamp:    Schema.DateTimeUtc,
  ttl:          Schema.Number,           // seconds before full decay
  description:  Schema.String,
  evidence:     Schema.optional(Schema.Any),
})

const EntityRiskProfile = Schema.TaggedStruct("EntityRiskProfile", {
  entityId:     Schema.String,
  entityClass:  Schema.String,
  compositeRisk: Schema.Number,          // 0.0-1.0 (the compound score)
  categoryScores: Schema.Record({
    key: Schema.Literal("ID", "KIN", "BEH", "ASSOC", "SIG", "INTEL"),
    value: Schema.Number,
  }),
  activeIndicators: Schema.Array(RiskIndicator),
  riskTrend:    Schema.Literal("rising", "stable", "falling"),
  lastUpdate:   Schema.DateTimeUtc,
  peakRisk:     Schema.Number,           // historical maximum
  peakTimestamp: Schema.DateTimeUtc,
})
```

### R3.3 Temporal Decay Model

Risk indicators do not persist forever. Each indicator decays
exponentially with a configurable time constant (TTL):

```
TEMPORAL DECAY FUNCTION

Given:
  s_0   = initial indicator score (at time of detection)
  t_0   = timestamp of detection
  t     = current time
  tau   = decay time constant (TTL / ln(2) for half-life semantics)

Decayed score:
  s(t) = s_0 * exp(-(t - t_0) / tau)

Half-life: t_half = tau * ln(2)

After 1 half-life:  s = 0.50 * s_0
After 2 half-lives: s = 0.25 * s_0
After 3 half-lives: s = 0.125 * s_0  (effectively expired)
After 5 half-lives: s = 0.03 * s_0   (negligible)

DEFAULT TTL BY CATEGORY:
  ID:     24 hours  (identity anomalies persist)
  KIN:    2 hours   (kinematic anomalies are transient)
  BEH:    8 hours   (behavioral patterns persist moderately)
  ASSOC:  4 hours   (association evidence has moderate relevance)
  SIG:    12 hours  (signal integrity concerns persist)
  INTEL:  72 hours  (intelligence indicators are long-lived)

DESIGN NOTE:
  Decay is continuous, not step-function. An indicator at half-strength
  still contributes to the composite score. It takes ~5 half-lives
  for an indicator to drop below 0.03 (effectively zero).
```

### R3.4 Composite Risk Computation

The per-entity composite risk score combines all active (non-expired)
indicators using a weighted aggregation with diminishing returns:

```
COMPOSITE RISK COMPUTATION

For entity E with active indicators I_1..I_n:

Step 1: Decay all indicators to current time
  FOR EACH indicator I_k:
    I_k.current_score = I_k.score * exp(-(now - I_k.timestamp) / tau[I_k.category])

Step 2: Aggregate per category using "noisy-OR" combination
  -- Noisy-OR ensures that multiple weak signals compound,
  -- but with diminishing returns (not simple addition)

  FOR EACH category C:
    indicators_in_C = [I for I in indicators if I.category == C]
    IF len(indicators_in_C) == 0:
      category_score[C] = 0.0
    ELSE:
      -- Noisy-OR: P(risk) = 1 - PRODUCT(1 - s_i)
      category_score[C] = 1.0 - PRODUCT(1.0 - I.current_score
                                          for I in indicators_in_C)

Step 3: Compute weighted composite
  composite = SUM(w[C] * category_score[C] for C in categories)
            / SUM(w[C] for C in categories)

Step 4: Apply acceleration for multi-category convergence
  -- Bonus when multiple DIFFERENT categories contribute
  active_categories = count(C for C in categories if category_score[C] > 0.1)

  IF active_categories >= 3:
    convergence_bonus = 0.1 * (active_categories - 2)
    composite = min(1.0, composite + convergence_bonus)

  -- Rationale: an entity with weak signals in 4+ categories is
  -- more suspicious than one with a strong signal in just 1 category

Step 5: Determine trend
  prev_composite = last_composite[E.id]
  IF composite > prev_composite + 0.05:
    trend = "rising"
  ELIF composite < prev_composite - 0.05:
    trend = "falling"
  ELSE:
    trend = "stable"

RETURN EntityRiskProfile {
  compositeRisk: composite,
  categoryScores: category_score,
  riskTrend: trend,
  ...
}
```

### R3.5 Noisy-OR Justification

Why noisy-OR instead of simple addition or averaging?

```
COMPARISON OF AGGREGATION METHODS

Scenario: 5 indicators, each scoring 0.2

Simple average:  0.2                (no compounding — useless)
Simple sum:      1.0                (oversaturates — no ceiling)
Max:             0.2                (ignores accumulation — useless)
Noisy-OR:        1-(0.8^5) = 0.672  (compounds with diminishing returns)

Scenario: 3 indicators scoring 0.1, 0.3, 0.5

Simple average:  0.3
Simple sum:      0.9
Max:             0.5
Noisy-OR:        1-(0.9*0.7*0.5) = 0.685

Properties of noisy-OR:
  ✓ Each additional indicator always increases the score
  ✓ Diminishing returns (avoids oversaturation)
  ✓ Bounded [0, 1] (natural probability interpretation)
  ✓ Order-independent (commutative)
  ✓ Empty set → 0.0 (no indicators = no risk)
  ✓ Any indicator at 1.0 → composite = 1.0 (certainty propagates)
```

### R3.6 Risk Thresholds and Actions

| Composite Risk | Classification | Alert Priority | Operator Action                  |
|----------------|----------------|----------------|----------------------------------|
| 0.0 - 0.2      | Low            | None           | Normal monitoring                |
| 0.2 - 0.4      | Elevated       | P4 (info)      | Log, include in periodic report  |
| 0.4 - 0.6      | Moderate       | P3 (advisory)  | Flag in display, available on query |
| 0.6 - 0.8      | High           | P2 (warning)   | Active alert, prompt investigation |
| 0.8 - 1.0      | Critical       | P1 (critical)  | Immediate attention, auto-escalate |

### R3.7 Risk Accumulation Algorithm

```pseudocode
ALGORITHM: Risk Accumulator
INPUT:     Stream of RiskIndicators from all detectors and fusion outputs
STATE:     risk_profiles[entity_id] = EntityRiskProfile

ON NEW INDICATOR(indicator):
  profile = risk_profiles[indicator.entityId]
  IF profile is None:
    profile = create_empty_profile(indicator.entityId, indicator.entityClass)
    risk_profiles[indicator.entityId] = profile

  -- Add indicator to active set
  profile.activeIndicators.append(indicator)

  -- Prune expired indicators (> 5 half-lives old)
  profile.activeIndicators = [
    i for i in profile.activeIndicators
    if i.current_score(now) > 0.03
  ]

  -- Recompute composite
  prev_composite = profile.compositeRisk
  profile = recompute_composite(profile)

  -- Check for threshold crossings
  FOR EACH threshold T in RISK_THRESHOLDS:
    IF prev_composite < T AND profile.compositeRisk >= T:
      emit_risk_escalation(profile, T)
    IF prev_composite >= T AND profile.compositeRisk < T:
      emit_risk_deescalation(profile, T)

  -- Track peak
  IF profile.compositeRisk > profile.peakRisk:
    profile.peakRisk = profile.compositeRisk
    profile.peakTimestamp = now()

  -- Store
  risk_profiles[indicator.entityId] = profile

ON PERIODIC TICK (every 60s):
  -- Recompute all profiles (decay updates scores even without new indicators)
  FOR EACH profile IN risk_profiles.values():
    prev = profile.compositeRisk
    profile = recompute_composite(profile)

    -- Check for deescalation due to decay
    IF significant_change(prev, profile.compositeRisk):
      check_threshold_crossings(profile, prev)
```

### R3.8 Indicator Sources

Risk indicators flow from multiple subsystems. Each subsystem produces
typed indicators that feed into the accumulator:

```
INDICATOR SOURCES

FROM Spoofing Detection (TSGC-002):
  KCD anomaly        → category: KIN, score: kcd_score
  CSPV anomaly       → category: SIG, score: cspv_score
  ICM anomaly        → category: ID,  score: icm_score
  RSA anomaly        → category: SIG, score: rsa_score

FROM Absence Detection (R2):
  Warning absence     → category: SIG, score: 0.3
  Critical absence    → category: SIG, score: 0.6
  Dark classification → category: SIG, score: 0.8
  Deliberate dark     → category: BEH, score: 0.7

FROM Fusion Pipeline:
  Low-confidence join → category: varies, score: 1.0 - join_confidence
  Defusion event      → category: SIG, score: 0.5
  Identity mismatch   → category: ID, score: 0.4-0.9

FROM External Intelligence:
  Sanctions list match→ category: INTEL, score: 0.9
  Watchlist proximity → category: INTEL, score: 0.5
  OSINT mention       → category: INTEL, score: 0.3-0.7
  STIX indicator match→ category: INTEL, score: 0.6-0.9

FROM Behavioral Analysis:
  Route deviation     → category: BEH, score: f(deviation_distance)
  Unusual loitering   → category: BEH, score: f(duration, location)
  Speed anomaly       → category: KIN, score: f(deviation)
  STS transfer pattern→ category: ASSOC, score: 0.6
```

### R3.9 Risk Profile Visualization

The risk profile feeds into the Tsingou rendering layers:

**z:1 (Data Layer):**
- Entity border thickness proportional to composite risk
- Border color from risk palette (green → yellow → orange → red)
- Pulsing animation when risk trend is "rising"

**z:2 (Annotation Layer):**
- Risk category breakdown as radial chart on hover
- Risk sparkline showing 24-hour composite history
- Active indicator count badge

**z:3 (Control Layer):**

```
RISK PROFILE PANEL

┌ ENTITY RISK PROFILE ───────────────────────────────────────┐
│                                                             │
│  PACIFIC VOYAGER  MMSI 211900042                           │
│  Composite Risk: ████████████████░░░░ 0.73 (HIGH) ↑       │
│  Peak: 0.81 (2h ago)   Trend: RISING                      │
│                                                             │
│  Category Breakdown:                                        │
│  ID:    ████████░░░░ 0.40  Flag mismatch, name change     │
│  KIN:   ████░░░░░░░░ 0.20  Minor speed inconsistency      │
│  BEH:   ████████████ 0.60  Route deviation + loitering    │
│  ASSOC: ██████░░░░░░ 0.30  Proximity to flagged vessel    │
│  SIG:   ████████████ 0.85  AIS dark period (4h12m)        │
│  INTEL: ██████████░░ 0.50  OSINT: sanctions evasion blog  │
│                                                             │
│  Convergence: 6/6 categories active → +0.4 bonus          │
│                                                             │
│  Active Indicators: 12 (decaying: 5, fresh: 7)            │
│                                                             │
│  Risk History (24h):                                        │
│  ▁▁▁▂▂▃▃▅▅▇▇████████████▇▇███████████████████████       │
│  └─ 24h ago                                    now ─┘      │
│                                                             │
│  [Investigate] [Acknowledge] [Suppress] [Export STIX]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### R3.10 Interaction Between R2 and R3

Absence events (R2) are a primary feeder into risk accumulation (R3):

```
R2 → R3 FLOW

1. Absence detected (warning level)
   → RiskIndicator { category: SIG, score: 0.3, ttl: 12h }
   → Entity composite risk increases marginally

2. Absence escalates to critical
   → RiskIndicator { category: SIG, score: 0.6, ttl: 12h }
   → Plus: previous warning indicator still active (decayed)
   → Noisy-OR in SIG category: 1 - (0.7 * 0.5) = 0.65

3. Absence classified as "deliberate_dark"
   → RiskIndicator { category: BEH, score: 0.7, ttl: 8h }
   → Now TWO categories contributing (SIG + BEH)
   → Composite risk rising

4. Satellite detects entity at projected position despite AIS dark
   → RiskIndicator { category: ASSOC, score: 0.5, ttl: 4h }
   → THREE categories → convergence bonus kicks in

5. OSINT identifies entity on sanctions watchlist
   → RiskIndicator { category: INTEL, score: 0.9, ttl: 72h }
   → FOUR categories → convergence bonus +0.2
   → Composite risk likely > 0.8 → P1 CRITICAL alert
```

### R3.11 Risk Accumulation in d2ts

```
d2ts RISK ACCUMULATION

-- All indicator sources converge into a single stream
const indicatorStream = merge(
  spoofingDetectors.map(toRiskIndicator),
  absenceDetector.map(toRiskIndicator),
  fusionPipeline.map(toRiskIndicator),
  externalIntel.map(toRiskIndicator),
  behavioralAnalysis.map(toRiskIndicator),
)

-- Group by entity, accumulate with decay
const riskProfiles = indicatorStream
  .groupBy(i => i.entityId)
  .reduce(
    (profile, indicator) => updateProfile(profile, indicator, now()),
    emptyProfile
  )

-- Emit threshold crossings as alerts
const riskAlerts = riskProfiles
  .diff()  // d2ts differential: only when profile changes
  .filter(([prev, curr]) => crossesThreshold(prev, curr))
  .map(([prev, curr]) => generateRiskAlert(prev, curr))
```

---

## Amendment Summary: Changes to TSGC-001

### Section 9 (Confidence Semantics) — Add Row

| Output Type | Meaning | Confidence Semantics |
|-------------|---------|----------------------|
| **Absence** | Expected signal not received | C = 1 - (1-P_d)^N; grows with elapsed time |

### Section 6.2 (Schema Representation) — Add to FusionOntology

```typescript
// Add to FusionOntology schema
expectedSignals:  Schema.Array(ExpectedSignalEntry),
riskCategories:   Schema.Array(RiskCategoryDef),
absenceThresholds: Schema.Struct({
  warningDefault:    Schema.Number,
  criticalDefault:   Schema.Number,
  darkDefault:       Schema.Number,
}),
riskThresholds:   Schema.Struct({
  elevated:          Schema.Number,  // default 0.2
  moderate:          Schema.Number,  // default 0.4
  high:              Schema.Number,  // default 0.6
  critical:          Schema.Number,  // default 0.8
}),
```

### Section 6.1 (Join Path Registry) — Add Pairs 9 and 10

As defined in R2.7 above (Absence x Satellite Imagery, Absence x RF Detection).

### Section 7 (d2ts Compilation) — Add Absence Branch

```
                    +---------------------+
                    |   Signal Ingest     |
                    +----------+----------+
                               |
              +-------+--------+--------+-------+
              v       v        v        v       v
         TIER 1   TIER 2   TIER 3   ABSENCE  RISK
         Hard     Soft     Derived  Detector  Accum
              |       |        |       |       |
              +-------+--------+-------+-------+
                               v
                      FUSED + ASSESSED DATUM
```

### Section 8 (Operator Interface) — Add Controls

- **Absence monitoring panel** — tracked entity count, dark list, thresholds
- **Risk profile panel** — per-entity compound score, category breakdown, history
- **Risk trend overlay** — z:1 border encoding for entity risk level

### Section 10 (Research Initiatives) — Mark R2 and R3 as Addressed

```
RI-7: Spoofing and Deception Detection → Addressed in TSGC-002
RI-8: Operator Cognitive Load           → Addressed in TSGC-002

NEW (from this amendment):
R2:  Negative-Space Detection           → Addressed in TSGC-001-A2
R3:  Risk Accumulation                  → Addressed in TSGC-001-A2
```

---

## Cross-References: Integration with Other Amendments

### Dependency 1: R1+R7 Track Lifecycle (tracking-researcher)

The track lifecycle state machine (r1-temporal-joins.md, Section B)
defines a `COASTING` state that is the direct precursor to absence
detection. The integration point:

```
TRACK LIFECYCLE → ABSENCE DETECTION BRIDGE

R7 TrackLifecycleState = 'tentative' | 'confirmed' | 'coasting' | 'dropped' | 'merged'

NATS subscription for lifecycle events (confirmed by tracking-researcher):
  tsingou.track.lifecycle.<class>.<id>
  R2 subscribes to these for CONFIRMED → COASTING transitions.
  R3 subscribes to these for risk-contributing lifecycle events.

When a track transitions CONFIRMED → COASTING:
  1. R7's coastEntryMisses threshold fires (entity-class-dependent):
       - AIS vessel:    10 missed scans (~30 sec) → "AIS gap detected"
       - ADS-B aircraft: 3 missed scans (~3 sec) → "transponder silence"
     (Full defaults in R7 Section B.7 config table)
  2. R2's Absence Detector receives the lifecycle event on NATS
  3. R2 begins the absence timer using R7's last confirmed observation
  4. R2's severity levels map to R7's coast progression:

  R7 Coast Phase              → R2 Absence Severity
  ──────────────────────────────────────────────────
  coast_entry (just started)  → "warning"
  mid-coast (uncertainty growing) → "critical"
  max_coast_exceeded          → "dark" (R7 drops track, R2 maintains absence event)

When a track transitions COASTING → CONFIRMED (recovery):
  1. R7's detection_recovered fires (lifecycle event on NATS)
  2. R2 closes the absence event with reason="signal_resumed"
  3. R2 logs the gap for pattern analysis
  4. R3 receives a risk indicator based on gap duration

When a track transitions COASTING → DROPPED:
  1. R7 drops the track (no more Kalman prediction)
  2. R2 continues the absence event — the entity is still "missing"
  3. R2's projected position (dead reckoning) takes over from R7's
     Kalman prediction, with R2's own uncertainty growth model
  4. R3 receives a high-score SIG indicator

R3 RISK INTEGRATION (confirmed by tracking-researcher):
  Lifecycle transitions are risk-contributing events:
  - CONFIRMED → COASTING = positive risk signal ("entity going dark")
  - Extended time in COASTING = escalating risk (duration-weighted)
  - COASTING → DROPPED = potential risk event ("entity lost")
  R3's risk accumulator subscribes to tsingou.track.lifecycle.<class>.*
  and weights these transitions per the risk category table (R3.3.2).

DESIGN NOTE:
  R2 and R7 share the "coasting" concept but serve different purposes:
  - R7 COASTING = "track still active but degrading" (sensor-centric)
  - R2 ABSENCE  = "entity expected but not observed" (entity-centric)

  R7's coast parameters (coastEntryMisses, maxCoastScans) are
  per-sensor-per-entity-class. R2's absence thresholds (warning,
  critical, dark) are per-signal-kind-per-entity-class. These are
  related but not identical — R7 counts missed scans, R2 counts
  elapsed time. The bridge converts between them.

  R2's position projection (R2.6) SHOULD use R7's Kalman predicted
  state while the track is coasting, then fall back to R2's own
  dead reckoning model after R7 drops the track.

DEPENDENCY CHAIN NOTE (for synthesizer — Task #31):
  R9 (event ordering / sequence detection) ALSO consumes COASTING state.
  grounded-theory-analyst's R9 uses "track enters COASTING" as a sequence
  step in AIS dark period detection. Two signal paths exist:

    R7 → R9  (shortcut: lifecycle_transition event directly)
    R7 → R2 → R9  (full chain: lifecycle → absence → sequence step)

  R9 supports both `lifecycle_transition` and `absence_event` as signal
  kinds for sequence steps. The synthesizer must preserve both paths —
  the shortcut enables low-latency sequence matching, while the full
  chain provides richer context (absence confidence, projected position).
  (Confirmed by tracking-researcher, 2026-02-19)
```

### Dependency 2: R4 Confidence Model (grounded-theory-analyst)

R4 (amendment r4-confidence-tier3.md) changes hard key confidence from
1.0 to 0.99 with spoofing degradation, adds a correlation discount, and
introduces Bayesian incremental refinement. These changes affect both
R2's absence confidence and R3's risk accumulation.

Confirmed by grounded-theory-analyst: R4 has added an "Absence" row to the
confidence semantics table with schema `C = f(elapsed_time, expected_rate)`,
marked as "Ordinal, domain-specific" for calibration. This forward-references
R2's absence confidence formula.

```
R4 → R2/R3 CONFIDENCE INTERACTIONS

1. SPOOFING DISCOUNT ON ABSENCE CONFIDENCE

   R4.1 introduces spoofing degradation: C_hard = 0.99 → 0.50 based on
   spoofing indicators. Hard key confidence is now 0.99, NOT 1.0 — R2's
   absence calculations must never assume identity certainty.

   R2 must account for this:
     C_absence_adjusted = C_absence * trust_level[entity.ais_identity]

   Where trust_level comes from R4's spoofing degradation pathway:
     No flags:           trust = 0.99  (not 1.0 — R4.1 change)
     Format anomaly:     trust = 0.90
     Behavioral anomaly: trust = 0.75
     Known spoofing:     trust = 0.50

   Example: If C_absence = 0.95 but entity has behavioral anomaly flag,
     C_absence_adjusted = 0.95 * 0.75 = 0.71

   This prevents a spoofed entity from generating high-confidence
   absence events (the absence might be part of the spoofing pattern).

   R3 implication: Risk accumulation must also reference this pathway.
   When summing risk indicators from hard-key-identified entities,
   the indicator weight should be scaled by the trust_level.

2. EVIDENCE CORRELATION DISCOUNT

   R4.2 defines a correlation matrix between predicates (e.g.,
   spatial-temporal r=0.6) with a discount factor. Absence detection
   produces evidence correlated with temporal proximity scores:
   - A long gap implies temporal distance from last observation
   - Temporal proximity score in soft joins reflects the same information

   When R2 absence events feed into R3 risk accumulation alongside
   Tier 2 temporal scores, the R4.2 correlation matrix should include:
     correlation["absence_duration"]["temporal_proximity"] = 0.7

   This prevents double-counting the "haven't seen this entity recently"
   evidence in both the absence detector and the temporal join predicate.

   R3 must reuse R4.2's discount mechanism (not reinvent) when
   accumulating risk from correlated predictors.

3. BAYESIAN INCREMENTAL REFINEMENT

   R4 specifies confidence updates on new signal arrival via likelihood
   ratios, with temporal decay when signals go silent. R2's absence
   events feed directly into this decay mechanism:

   - When an entity goes silent, R4's temporal decay begins reducing
     the entity's overall confidence score
   - R2's AbsenceEvent provides the structured signal for this decay
     (elapsed_time, expected_rate, severity level)
   - On signal recovery (absence event closed), R4's likelihood ratio
     update restores confidence based on the new observation

   Flow: R2 silence detected → AbsenceEvent emitted →
         R4 decay mechanism activates → confidence degrades over time →
         R2 signal resumed → R4 likelihood ratio update → confidence restored

4. LOG-ODDS COMPATIBILITY

   R4.3 offers log-odds as an alternative confidence combination mode.
   R2's absence confidence formula (C = 1 - (1-P_d)^N) produces
   well-calibrated probabilities that work correctly in both weighted
   average and log-odds modes. No adaptation needed.

   R3's noisy-OR risk accumulation is already in probability space
   and produces bounded [0,1] scores compatible with both modes.

5. CONFIDENCE SEMANTICS TABLE — ABSENCE ROW

   R4 has added an "Absence" output type row (confirmed by analyst):
     Output Type: Absence
     Schema:      C = f(elapsed_time, expected_rate)
     Scale:       Ordinal, domain-specific
     Calibration: Required (per-entity-class expected rates vary)

   This means R2's absence confidence is a first-class citizen in
   R4's confidence framework, not an afterthought bolted on.
```

### Dependency 3: R5 Reference Data Model (geospatial-researcher)

R5 (amendment r5-data-model-blocking.md) distinguishes event data (signals)
from reference data (registries). The Expected Signal Registry (ESR) is
a reference data structure:

```
R5 → R2 DATA MODEL INTERACTIONS

1. ESR AS REFERENCE DATA

   R5 defines reference data as "stable, slowly-changing, lookup-keyed."
   The Expected Signal Registry (R2.2) fits this definition exactly:
   - Keyed by (entity_class, signal_kind)
   - Changes slowly (update rates defined by protocol standards)
   - Used for lookup (absence detector queries it per entity)

   In d2ts terms (R5's terminology):
     ESR = materialized arrangement (KTable analogy)
     observations = differential stream (KStream analogy)

   R5's concrete reference source model (confirmed by geospatial-researcher):
     - NATS subject: tsingou.ref.esr.*  (follows tsingou.ref.<source>.* pattern)
     - updateRate: "static" (ESR entries change only on config revision)
     - ttlSeconds: null (no expiry — ESR is authoritative until replaced)
     - Arrangement lookup: O(1) per event via d2ts arrangement

   The absence detector performs an EVENT x TABLE anti-join:
     "For each tick (event), look up expected signals (arrangement),
      check if recent observations exist (event stream)."

   This uses R5's "event x table" join semantics (Section 3.4.2),
   where only the event side (tick) triggers evaluation.
   The arrangement provides the "expected" side; the absence of
   recent events in the event stream IS the signal.

2. R6 BLOCKING FOR ABSENCE ANTI-JOINS

   R6 defines blocking strategies for scale. The absence detector's
   anti-join benefits from blocking:
   - Block by entity_class: only check expected signals for the
     entity's class (vessel doesn't need ADS-B check)
   - Block by coverage area: only check entities within sensor
     coverage (uses R6's H3 spatial blocking)

   Without blocking: O(entities * signal_kinds) per tick
   With blocking:    O(entities_in_coverage * expected_signals_per_class)

3. SENSOR COVERAGE AS REFERENCE DATA

   R2.2.3 uses "coverage_gap(S)" to suppress absence alerts when
   the sensor cannot see an area. This coverage map is reference data:
   - NATS subject: tsingou.ref.coverage.* (R5 pattern)
   - updateRate: "hourly" (sensor repositioning, propagation changes)
   - ttlSeconds: 7200 (2h — stale coverage = unsafe to suppress)
   - Keyed by (signal_kind, H3_cell)
   - Used for lookup by the absence detector

   R5's reference data model should include sensor coverage polygons
   alongside entity registries (FAA, ITU, ASN databases).
```

### Cross-Amendment Schema Alignment

```typescript
// R2 schemas reference types from other amendments:

// From R7 (track lifecycle):
const TrackLifecycleState = Schema.Literal(
  'tentative', 'confirmed', 'coasting', 'dropped', 'merged'
)

// R2 AbsenceEvent gains a track state reference:
const AbsenceEvent = Schema.TaggedStruct("AbsenceEvent", {
  // ... existing fields ...
  trackState: Schema.optional(TrackLifecycleState),  // R7 integration
  coastDuration: Schema.optional(Schema.Number),      // seconds in COASTING before absence
  spoofingDiscount: Schema.optional(Schema.Number),   // R4.1 trust level applied
})

// From R4 (confidence model):
// AbsenceEvent.confidence is multiplied by spoofing trust_level
// This happens in compute_absence_confidence(), not in the schema

// From R5 (reference data model):
// ESR entries are tagged as reference data for d2ts arrangement semantics
// R5 concrete fields confirmed by geospatial-researcher:
const ExpectedSignalEntry = Schema.TaggedStruct("ExpectedSignalEntry", {
  // ... existing fields ...
  _dataType: Schema.Literal("reference"),      // R5 classification
  natsSubject: Schema.String,                  // "tsingou.ref.esr.*" (R5 pattern)
  updateRate: Schema.Literal("static", "daily", "hourly", "minutes"), // R5 field
  ttlSeconds: Schema.optional(Schema.Number),  // R5 cache expiry (null = no expiry)
})
```

---

## References

- Koch, W. "On exploiting 'negative' sensor evidence for target tracking
  and sensor data fusion." Information Fusion, 8(1), 28-39, 2007.
- Koch, W. "On 'negative' information in tracking and sensor data fusion."
  Proc. 7th Intl. Conf. Information Fusion (FUSION 2004), Stockholm, 2004.
- MDPI. "Dark Ship Detection via Optical and SAR Collaboration." Remote
  Sensing, 17(13), 2201, 2025.
- Windward AI. "Mind the AIS Gap." Blog, 2024.
- Windward AI. "Shining a Light on Ships That Go Dark." Blog, 2024.
- Unseenlabs. "Satellite RF Maritime Surveillance." 2025.
- Gatehouse Maritime. "Dark Ship Detection." Product documentation, 2025.
- Starboard Maritime Intelligence. "Satellite Dark Vessel Detection." 2025.
- Deepwatch. "Dynamic Risk Scoring: Real-Time Threat Context." 2025.
- Splunk. "What Is Risk Scoring? How To Score Risk." 2024.
- Recorded Future. "Fusion Use Case: Operationalizing Threat Indicators." 2024.
- Forward Decay. "A Practical Time Decay Model for Streaming Systems."
  DIMACS, Rutgers University.

---

*End of TSGC-001-A2*
