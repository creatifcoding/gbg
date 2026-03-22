# Research: Spoofing Detection & Operator Cognitive Load

```
Document:   TSGC-002 — Spoofing Detection & Operator UX Research
Status:     DRAFT
Created:    2026-02-19
Context:    Tsingou SIGINT Visualization Platform
Depends:    TSGC-001 (Fusion Ontology), RFC-002 (TSG.4, TSG.8, TSG.26, TSG.28)
Covers:     RI-7 (Spoofing and Deception Detection)
            RI-8 (Operator Cognitive Load)
```

> **Thesis**: In a multi-source fusion system, adversarial deception and operator
> cognitive overload are dual failure modes that compound each other. Spoofing
> degrades data quality, which increases the operator's burden to distinguish
> real from false. Cognitive overload causes missed spoofing indicators, which
> lets more false data through. This document addresses both failure modes and
> their interaction within the Tsingou platform.

---

## Table of Contents

- [Part I: RI-7 — Spoofing and Deception Detection](#part-i-ri-7--spoofing-and-deception-detection)
  - [1. Taxonomy of Spoofing Attacks](#1-taxonomy-of-spoofing-attacks)
  - [2. AIS Spoofing](#2-ais-spoofing)
  - [3. GPS/GNSS Spoofing and Jamming](#3-gpsgnss-spoofing-and-jamming)
  - [4. ADS-B Spoofing](#4-ads-b-spoofing)
  - [5. Beacon Cloning and RF Fingerprinting](#5-beacon-cloning-and-rf-fingerprinting)
  - [6. Signal Strength Anomaly Detection](#6-signal-strength-anomaly-detection)
  - [7. Position Jump Detection](#7-position-jump-detection)
  - [8. Identity Conflict Detection](#8-identity-conflict-detection)
  - [9. Temporal Consistency Analysis](#9-temporal-consistency-analysis)
  - [10. Spoofing Detection Algorithms](#10-spoofing-detection-algorithms)
  - [11. Decision Tree: Error vs Deception](#11-decision-tree-error-vs-deception)
  - [12. Confidence Downgrade Formulas](#12-confidence-downgrade-formulas)
  - [13. STIX Indicator Generation](#13-stix-indicator-generation)
  - [14. Adversarial ML Considerations](#14-adversarial-ml-considerations)
  - [15. Feedback into Fusion Confidence](#15-feedback-into-fusion-confidence)
- [Part II: RI-8 — Operator Cognitive Load](#part-ii-ri-8--operator-cognitive-load)
  - [16. Situation Awareness Model](#16-situation-awareness-model)
  - [17. Working Memory and Miller's Law](#17-working-memory-and-millers-law)
  - [18. Information Visualization Principles](#18-information-visualization-principles)
  - [19. Alarm Fatigue](#19-alarm-fatigue)
  - [20. Progressive Disclosure](#20-progressive-disclosure)
  - [21. Focus+Context Techniques](#21-focuscontext-techniques)
  - [22. Dashboard Design for Fusion Systems](#22-dashboard-design-for-fusion-systems)
  - [23. Color Coding for Confidence](#23-color-coding-for-confidence)
  - [24. Audio Alerts and Sonification](#24-audio-alerts-and-sonification)
  - [25. Cognitive Load Analysis](#25-cognitive-load-analysis)
  - [26. Dashboard Mockup](#26-dashboard-mockup)
  - [27. Alarm Priority Framework](#27-alarm-priority-framework)
  - [28. Tsingou 4-Layer Rendering Recommendations](#28-tsingou-4-layer-rendering-recommendations)
- [Part III: Synthesis](#part-iii-synthesis)
  - [29. The Spoofing-Cognition Feedback Loop](#29-the-spoofing-cognition-feedback-loop)
  - [30. Implementation Roadmap](#30-implementation-roadmap)
  - [31. References](#31-references)

---

# Part I: RI-7 — Spoofing and Deception Detection

## 1. Taxonomy of Spoofing Attacks

Spoofing in a multi-source fusion system falls into categories organized by
what the attacker manipulates, what domain they target, and what objective
they pursue.

### 1.1 By Manipulation Target

| Attack Class           | What Is Manipulated              | Examples                                      |
|------------------------|----------------------------------|-----------------------------------------------|
| **Identity Fraud**     | Claimed identifier               | False MMSI, spoofed ICAO hex, MAC cloning     |
| **Position Falsification** | Reported location            | GPS spoofing, false AIS coordinates            |
| **Ghost Injection**    | Entirely fabricated entity       | Phantom AIS vessels, ghost ADS-B tracks        |
| **Attribute Manipulation** | Metadata fields              | False vessel type, wrong call sign, speed 0    |
| **Signal Replay**      | Re-transmitted authentic signal  | Meaconing (GPS replay), AIS message replay     |
| **Denial/Jamming**     | Signal availability              | GPS jamming, AIS interference, RF noise floor  |

### 1.2 By Domain

| Domain    | Primary Protocols   | Spoofing Prevalence    | Detection Difficulty |
|-----------|---------------------|------------------------|----------------------|
| Maritime  | AIS, GPS, radar     | Very High (sanctions)  | Medium               |
| Aviation  | ADS-B, GPS, radar   | Growing (conflict)     | Medium-High          |
| Cyber     | IP, DNS, TLS        | Ubiquitous             | Variable             |
| RF/SIGINT | Various             | Context-dependent      | High                 |
| OSINT     | Web, social media   | Common (disinformation)| Very High            |

### 1.3 By Adversary Objective

| Objective             | Tactic                                                     |
|-----------------------|------------------------------------------------------------|
| **Sanctions evasion** | AIS identity swap, position loops to mask port calls       |
| **Illegal fishing**   | AIS dark periods, identity cloning of legitimate vessels   |
| **Military deception**| Ghost fleets, false radar returns, GPS spoofing zones      |
| **Smuggling**         | Position falsification near borders, AIS gaps at transfers |
| **Reconnaissance**    | Minimal signature, selective signal suppression             |

### 1.4 Attack Sophistication Spectrum

```
Level 0: Passive  — AIS transponder turned off (dark ship)
Level 1: Simple   — Manual MMSI/position entry via AIS configuration
Level 2: Moderate — External GPS spoofing device, coordinated timing
Level 3: Advanced — RF replay attacks, multi-signal coordination
Level 4: State    — GPS spoofing zones affecting thousands of vessels,
                    coordinated electronic warfare across domains
```

As of early 2026, Level 2-3 attacks are commoditized. The Baltic Sea region
around Kaliningrad and St. Petersburg sees persistent Level 4 GPS spoofing
zones affecting over 13,000 vessels. AIS spoofing events now exceed 6,000 km
position jumps in single reports.

---

## 2. AIS Spoofing

### 2.1 AIS Protocol Vulnerabilities

AIS (Automatic Identification System) broadcasts on VHF marine channels
(161.975 MHz and 162.025 MHz) using Self-Organized Time Division Multiple
Access (SOTDMA). The protocol has no authentication, no encryption, and no
integrity verification. Any device capable of VHF transmission can inject
arbitrary AIS messages.

Fundamental weaknesses:

- **No authentication**: Any transmitter can claim any MMSI
- **No encryption**: Message content is plaintext
- **No integrity check**: No MAC or digital signature
- **Self-organized access**: TDMA slot allocation is cooperative, not enforced
- **Trust by default**: Receivers accept all well-formed messages

### 2.2 AIS Spoofing Typologies

Research by Pole Star Global and others identifies four main AIS spoofing
typologies observed in the wild:

**Type 1: Identity Swap**

The vessel broadcasts a different MMSI than its actual registered identity.
Used for sanctions evasion — a sanctioned vessel assumes the identity of a
non-sanctioned vessel.

```
Vessel A (sanctioned, MMSI 211900001) broadcasts MMSI 211900099 (clean vessel)
Detection: Cross-reference with satellite imagery, RF fingerprint mismatch
```

**Type 2: Position Manipulation (Circle/Loop Spoofing)**

The vessel reports false coordinates while physically located elsewhere.
Historically created dense circular patterns; modern variants use larger
spoofing zones and straight-line anomalies.

```
Vessel at port in Syria reports position in open Mediterranean
Detection: Satellite imagery contradiction, RSSI inconsistency with claimed range
```

**Type 3: Ghost Ship Injection**

Entirely fabricated AIS signals create phantom vessels that do not physically
exist. Used for military deception or to overwhelm monitoring systems.

```
100 simultaneous phantom AIS signals broadcast in the Southern Ocean
Detection: No radar return, no satellite imagery match, TDMA slot anomaly
```

**Type 4: AIS Dark Period with Selective Reappearance**

Vessel goes dark (transponder off) during sensitive operations, then
reappears at a plausible future position.

```
Vessel disappears for 72 hours, reappears 200nm away at plausible transit speed
Detection: Gap duration vs distance analysis, satellite gap-fill imagery
```

### 2.3 AIS Spoofing Detection Vectors

| Detection Method                     | Signal Used            | False Positive Rate | Latency   |
|--------------------------------------|------------------------|---------------------|-----------|
| TDMA protocol compliance             | Slot timing            | Low                 | Real-time |
| Carrier Frequency Offset (CFO)       | RF characteristics     | Low                 | Real-time |
| Kalman filter velocity consistency   | Position + speed       | Medium              | Seconds   |
| Satellite imagery cross-reference    | Optical/SAR            | Very Low            | Minutes   |
| TDOA multilateration                 | Time of arrival        | Low                 | Real-time |
| Behavioral anomaly (ML)              | Track history          | Medium              | Seconds   |
| Cross-source fusion                  | AIS + radar + RF + EO  | Very Low            | Seconds   |

### 2.4 Scale of the Problem

As of 2025-2026:
- 80.1% of vessels caught spoofing AIS are sanctioned within a year
- Most sanctions designations occur 3-9 months after first spoofing incident
- 50% rise in AIS spoofing cases in the past year
- Spoofing behavior has evolved from dense circular patterns to larger
  spoofing zones and straight-line anomalies
- Maritime AI platforms now layer SAR, EO, and RF detections with AI-based
  anomaly detection for spoofing identification

---

## 3. GPS/GNSS Spoofing and Jamming

### 3.1 Signal Characteristics

GPS signals arrive at Earth's surface at approximately -130 dBm — weaker
than ambient thermal noise. This extreme weakness makes them vulnerable to
both jamming (overpowering with noise) and spoofing (overpowering with
fake signal replicas).

**Jamming characteristics:**
- Broadband noise or swept continuous wave
- Effective range depends on power: 1W jammer effective to ~30km
- Easily detected by spectral monitoring
- Causes receiver to lose fix (denial of service)

**Spoofing characteristics:**
- Requires replicating PRN codes for multiple visible satellites
- Must match Doppler shift, code phase, and navigation data
- Matched-spectrum spoofing is computationally expensive
- Causes receiver to report false position (deception)

### 3.2 Detection Methods

**Cross-Frequency Divergence**

Under nominal conditions, carrier phases from signals transmitted by the
same satellite in different frequency bands maintain a stable ratio. During
spoofing, the attacker must precisely replicate this ratio across L1, L2,
and L5 bands. Cross-band carrier-phase divergence is a reliable spoofing
indicator.

```
Detection metric:
  delta_phase = |phase_L1 / phase_L2 - expected_ratio|
  IF delta_phase > threshold THEN flag_spoofing()

Threshold: Typically 0.01 cycles for stationary, 0.05 for mobile
```

**Multi-Receiver Comparison**

Multiple receivers at known separations should report positions consistent
with their physical geometry. A spoofed signal forces all receivers to
converge on the same false position.

```
Detection metric:
  baseline_error = |measured_baseline - known_baseline|
  IF baseline_error > antenna_uncertainty THEN flag_spoofing()

Example: Two antennas 10m apart both report identical position = spoofing
```

**Clock Drift Rate Monitoring**

If the spoofing signal causes the receiver clock error to change too
rapidly, the victim receiver can detect that the rate of clock drift is
larger than reasonable for its oscillator class.

```
Detection metric:
  drift_rate = d(clock_error) / dt
  IF drift_rate > max_drift_for_oscillator_class THEN flag_spoofing()

TCXO max drift: ~1 ppb/s
OCXO max drift: ~0.01 ppb/s
```

**Inertial Navigation System (INS) Cross-Check**

INS provides position estimates independent of GNSS. Significant divergence
between GPS-reported and INS-computed position indicates GPS compromise.

```
Detection metric:
  ins_gps_divergence = haversine(ins_position, gps_position)
  IF ins_gps_divergence > expected_INS_drift(time_since_alignment) THEN flag()
```

### 3.3 Multi-Antenna Mitigation

Multi-antenna receivers can spatially resolve signals, distinguishing
between signals from different origins and using spatial filtering (null
steering) to suppress signals from spoofing directions. The u-blox ZED-X20P
demonstrated this in Jammertest 2025 at Andoya, Norway — detecting coherent
position spoofing and entering a no-fix state to preserve integrity, while
competing single-antenna receivers followed the spoofed trajectory.

### 3.4 GPS Spoofing Zones

As of 2025-2026, persistent GPS spoofing zones exist:
- **Baltic Sea**: Kaliningrad, St. Petersburg corridors
- **Black Sea**: Eastern approaches
- **Eastern Mediterranean**: Near conflict zones
- **Middle East**: Multiple active zones

These are Level 4 (state-level) attacks affecting thousands of vessels and
aircraft simultaneously. Detection relies on multi-source fusion — comparing
GPS-derived positions against radar, AIS (when trustworthy), and satellite
imagery.

---

## 4. ADS-B Spoofing

### 4.1 ADS-B Vulnerability Profile

ADS-B (Automatic Dependent Surveillance — Broadcast) operates on 1090 MHz
(Mode S Extended Squitter) with no encryption, no authentication, and no
integrity verification. Like AIS, it was designed for cooperative
environments and is trivially spoofable.

Attack vectors:
- **Ghost aircraft injection**: Broadcast fabricated ADS-B messages
- **Position falsification**: Real aircraft, false coordinates
- **Identity hijacking**: Claim another aircraft's ICAO hex code
- **Denial**: Flood 1090 MHz with noise or conflicting messages
- **GNSS spoofing relay**: Spoof the aircraft's GPS, causing it to
  broadcast genuinely incorrect ADS-B positions

Between January 2024 and July 2025, GNSS interference activity rose
steadily, making GPS spoofing and jamming a sustained operational reality
for aviation.

### 4.2 Multilateration-Based Detection

TDOA (Time Difference of Arrival) multilateration offers the strongest
detection capability. Using a network of synchronized ground receivers,
the system independently estimates the aircraft's position from the
RF signal's arrival times — independent of the position claimed in the
ADS-B message.

```
MULTILATERATION DETECTION

Given: N >= 4 synchronized receivers at known positions P_1..P_n
       Aircraft claims position P_claimed in ADS-B message
       Signal arrives at receiver i at time t_i

Step 1: Compute TDOA pairs
  delta_t_ij = t_i - t_j  for all receiver pairs (i,j)

Step 2: Solve hyperbolic intersection
  Each TDOA defines a hyperboloid of possible positions
  Intersection of N-1 hyperboloids = estimated position P_mlat

Step 3: Compare
  position_error = haversine(P_claimed, P_mlat)
  IF position_error > detection_threshold THEN flag_spoofing()

Detection threshold: 500m (accounts for GPS accuracy + multilateration error)
```

CRFS demonstrated 3D TDOA detection using distributed RF sensors, achieving
sub-kilometer accuracy for ADS-B spoofing detection.

### 4.3 Additional Detection Vectors

| Method                          | Principle                                         |
|---------------------------------|---------------------------------------------------|
| Doppler consistency             | Claimed velocity vs observed frequency shift       |
| Radar cross-reference           | Primary radar return vs ADS-B claimed position     |
| LSTM neural network             | Learned trajectory patterns detect anomalies       |
| INS comparison (on-board)       | Aircraft's own INS vs GPS-derived ADS-B position   |
| Aireon space-based ADS-B        | Global coverage enables multi-path verification    |

### 4.4 Tsingou Integration

For Tsingou, ADS-B spoofing detection maps to PAIR 4 in the fusion
ontology (ADS-B x RF Bearing). When the RF-observed bearing to a 1090 MHz
emission does not match the claimed ADS-B position, the system flags
inconsistency:

```
bearing_to_claimed = azimuth(sensor_pos, ads_b_claimed_pos)
observed_bearing   = rf_bearing_measurement

angular_discrepancy = |bearing_to_claimed - observed_bearing|
IF angular_discrepancy > beamwidth + measurement_error THEN
  flag_ads_b_spoofing(confidence = f(angular_discrepancy))
```

---

## 5. Beacon Cloning and RF Fingerprinting

### 5.1 The Cloning Problem

Beacon cloning occurs when an attacker replicates the digital identity of a
legitimate transmitter. The cloned device broadcasts identical protocol-level
identifiers (MMSI, ICAO hex, MAC address, IMSI) but transmits from a
different physical device. Protocol-level detection fails because the
messages are well-formed and correctly identified.

### 5.2 RF Fingerprinting as Countermeasure

Every radio transmitter has unique hardware imperfections arising from the
manufacturing process. These imperfections create a distinctive
"fingerprint" in the transmitted signal that is independent of the
message content. Key fingerprint features:

**Carrier Frequency Offset (CFO)**

The local oscillator in each transmitter has a unique frequency error.
This CFO is stable over short periods and distinct between devices.

```
CFO FINGERPRINTING

For transmitter T with claimed identity ID:

Step 1: Extract CFO from received signal
  cfo_measured = extract_cfo(raw_iq_samples)

Step 2: Compare against enrolled CFO for ID
  cfo_expected = fingerprint_db[ID].cfo
  cfo_deviation = |cfo_measured - cfo_expected|

Step 3: Authenticate
  IF cfo_deviation > cfo_threshold THEN
    flag_cloning(
      claimed_id = ID,
      expected_cfo = cfo_expected,
      measured_cfo = cfo_measured,
      confidence = 1.0 - (cfo_deviation / max_deviation)
    )

CFO stability: ~1 ppm over minutes, ~5 ppm over months
Detection accuracy: 92.76% classification accuracy across channel
                    variations and 5-month time spans
```

**I/Q Imbalance**

Imperfections in the in-phase/quadrature modulator create measurable
amplitude and phase imbalance unique to each transmitter.

**Power Amplifier Nonlinearity**

Each PA has a unique compression curve that creates characteristic spectral
regrowth (out-of-band emissions) serving as a device fingerprint.

**Turn-On Transient**

The brief signal characteristic during transmitter power-up is unique and
extremely difficult to replicate.

### 5.3 Fingerprint Enrollment and Verification

```
ENROLLMENT PHASE (trusted environment):
  For each known transmitter T:
    1. Collect N raw IQ captures under controlled conditions
    2. Extract feature vector: [CFO, IQ_imbalance, PA_curve, transient]
    3. Compute statistical model: mean + covariance for each feature
    4. Store: fingerprint_db[T.id] = { features, model, enrolled_date }

VERIFICATION PHASE (operational):
  For each received message M with claimed identity ID:
    1. Extract feature vector from raw IQ samples
    2. Compute Mahalanobis distance to enrolled model for ID
    3. IF distance > threshold THEN flag_clone_suspect()

  Threshold selection:
    - Tight (3 sigma): High security, more false positives
    - Loose (5 sigma): Lower security, fewer false positives
```

### 5.4 Limitations

| Limitation                        | Impact                                           |
|-----------------------------------|--------------------------------------------------|
| Channel effects on features       | Multipath, fading alter observed fingerprint      |
| Long-term drift                   | CFO drifts with temperature and aging             |
| Requires raw IQ capture           | Not available from most commercial receivers      |
| Training data requirements        | Each transmitter needs enrollment captures        |
| Adversarial awareness             | Sophisticated attacker may attempt to match CFO   |

---

## 6. Signal Strength Anomaly Detection

### 6.1 Principle

The received signal strength (RSSI/RSS) of a transmission follows a
predictable path-loss model based on distance, frequency, and propagation
environment. A signal that claims to originate from a distant location but
arrives with unexpectedly high signal strength — or vice versa — indicates
position falsification.

### 6.2 Path-Loss Model

```
FREE-SPACE PATH LOSS (Friis equation):

  RSSI_expected = P_tx + G_tx + G_rx - FSPL(d, f)

  where FSPL(d, f) = 20*log10(d) + 20*log10(f) + 20*log10(4*pi/c)

  d = haversine(sensor_pos, claimed_pos)   -- from the claimed position
  f = carrier frequency

DETECTION:

  rssi_residual = RSSI_observed - RSSI_expected(claimed_distance)

  IF |rssi_residual| > rssi_threshold THEN
    flag_rssi_anomaly(
      residual = rssi_residual,
      claimed_distance = d,
      implied_distance = inverse_path_loss(RSSI_observed),
      assessment = residual > 0 ? "closer_than_claimed" : "farther_than_claimed"
    )
```

### 6.3 Domain-Specific Parameters

| Signal Type | Frequency     | Typical P_tx | Useful Range | RSSI Threshold |
|-------------|---------------|--------------|--------------|----------------|
| AIS         | 162 MHz       | 12.5W        | 40 nm        | +/- 10 dB      |
| ADS-B       | 1090 MHz      | 75-500W      | 250 nm       | +/- 6 dB       |
| Marine Radar| 9.4 GHz       | 25 kW        | 48 nm        | +/- 8 dB       |
| WiFi        | 2.4/5 GHz     | 100 mW       | 100m         | +/- 6 dB       |
| BLE Beacon  | 2.4 GHz       | 1-10 mW      | 30m          | +/- 8 dB       |

### 6.4 Multipath and Environmental Considerations

RSSI-based detection requires accounting for:
- **Atmospheric ducting**: VHF/UHF signals can propagate anomalously far
- **Surface reflection**: Maritime environments cause multipath
- **Terrain shadowing**: Land masses attenuate signals
- **Antenna directivity**: Gain varies with direction

The detector should use a statistical model (log-normal shadowing) rather
than deterministic Friis to account for these effects:

```
RSSI_observed ~ N(RSSI_expected, sigma_shadowing^2)

sigma_shadowing values:
  Open sea:    4-6 dB
  Coastal:     6-8 dB
  Urban/port:  8-12 dB

Detection threshold = RSSI_expected + k * sigma_shadowing
  k = 2.5 for 99% confidence (one-tailed)
```

---

## 7. Position Jump Detection

### 7.1 Principle

Consecutive position reports from the same entity must be physically
consistent. If entity E reports position P1 at time T1 and position P2
at time T2, the implied velocity must be physically achievable:

```
v_implied = haversine(P1, P2) / (T2 - T1)

IF v_implied > v_max_for_entity_class THEN
  flag_position_jump()
```

### 7.2 Maximum Velocity by Entity Class

| Entity Class    | v_max (knots) | v_max (m/s) | Source                        |
|-----------------|---------------|-------------|-------------------------------|
| Cargo vessel    | 25            | 12.9        | Largest container ships       |
| Tanker          | 18            | 9.3         | VLCC max speed                |
| Fishing vessel  | 15            | 7.7         | Trawler max speed             |
| Naval vessel    | 45            | 23.1        | Fast frigate/destroyer        |
| Speedboat       | 70            | 36.0        | High-speed craft              |
| Commercial jet  | 600           | 309         | Mach 0.85 at cruise           |
| Military jet    | 1200          | 617         | Mach 1.6 at cruise            |
| Helicopter      | 200           | 103         | Fast rotorcraft               |
| Ground vehicle  | 120 km/h      | 33.3        | Highway speed                 |

### 7.3 Position Jump Algorithm

```
POSITION JUMP DETECTOR

Input: Stream of (entity_id, position, timestamp, entity_class) tuples
State: last_known[entity_id] = (position, timestamp, track_quality)

For each new report R:
  prev = last_known[R.entity_id]
  IF prev is None:
    last_known[R.entity_id] = (R.position, R.timestamp, 1.0)
    CONTINUE

  dt = R.timestamp - prev.timestamp
  IF dt <= 0:
    flag_temporal_anomaly(R)  -- duplicate or out-of-order
    CONTINUE

  distance = haversine(prev.position, R.position)
  v_implied = distance / dt
  v_max = MAX_VELOCITY[R.entity_class]

  -- Apply kinematic filter
  IF v_implied > v_max * 1.5:
    -- Definitely impossible
    flag_position_jump(
      severity = "critical",
      v_implied = v_implied,
      v_max = v_max,
      ratio = v_implied / v_max,
      prev_pos = prev.position,
      new_pos = R.position,
      dt = dt
    )
  ELIF v_implied > v_max:
    -- Suspicious but not impossible (could be GPS error)
    flag_position_jump(
      severity = "warning",
      v_implied = v_implied,
      v_max = v_max,
      ratio = v_implied / v_max
    )
  ELSE:
    -- Update track
    last_known[R.entity_id] = (R.position, R.timestamp, quality)

  -- ADDITIONAL FILTERS --

  -- Axis-aligned jump filter: discard jumps that are nearly purely
  -- north/south or east/west (common coordinate bit errors)
  bearing = initial_bearing(prev.position, R.position)
  IF |bearing % 90| < 2.0 AND distance > 10km:
    flag_coordinate_error(bearing, distance)

  -- Zero-coordinate filter: discard if any coordinate is exactly 0
  IF R.position.lat == 0.0 OR R.position.lon == 0.0:
    flag_null_island(R)
```

### 7.4 Track Segmentation

When a position jump is detected, the system must decide: is this a new
track segment (gap in legitimate data) or a spoofing event?

```
TRACK SEGMENTATION HEURISTIC

Given: jump detected between P1(T1) and P2(T2)

IF dt > GAP_THRESHOLD[entity_class]:
  -- Long gap: treat as new track segment
  -- Vessel may have legitimately transited with AIS off
  assessment = "new_segment"
  confidence_penalty = 0.3  -- reduced trust in identity continuity

ELIF dt < SHORT_THRESHOLD AND distance > IMPOSSIBLE_DISTANCE:
  -- Short interval, impossible distance: definite spoofing
  assessment = "spoofing"
  confidence_penalty = 0.9

ELSE:
  -- Ambiguous: maintain both hypotheses
  assessment = "ambiguous"
  confidence_penalty = 0.5

GAP_THRESHOLD:
  vessel:   24 hours
  aircraft: 6 hours
  vehicle:  12 hours

SHORT_THRESHOLD:
  vessel:   300 seconds (5 min)
  aircraft: 30 seconds
  vehicle:  60 seconds
```

---

## 8. Identity Conflict Detection

### 8.1 Principle

If the same identifier (MMSI, ICAO hex, MAC address) is reported from
two widely separated locations within a time window too short for physical
transit, at least one report is false.

### 8.2 Detection Algorithm

```
IDENTITY CONFLICT DETECTOR

State: active_tracks[identifier] = List of (position, timestamp, source)

For each new report R:
  tracks = active_tracks[R.identifier]

  FOR EACH existing track T in tracks:
    dt = |R.timestamp - T.last_timestamp|
    distance = haversine(R.position, T.last_position)
    v_required = distance / dt

    IF v_required > MAX_VELOCITY[entity_class] * 1.5:
      -- Same ID, two locations, impossible transit
      flag_identity_conflict(
        identifier = R.identifier,
        location_a = T.last_position,
        location_b = R.position,
        distance = distance,
        time_delta = dt,
        v_required = v_required,
        v_max = MAX_VELOCITY[entity_class],
        assessment = classify_conflict(R, T)
      )

FUNCTION classify_conflict(R, T):
  -- Check for metadata consistency
  IF R.vessel_name != T.vessel_name:
    RETURN "identity_spoofing"  -- different vessels, same MMSI
  IF R.vessel_type != T.vessel_type:
    RETURN "identity_spoofing"
  IF R.call_sign != T.call_sign:
    RETURN "identity_spoofing"

  -- Metadata matches but positions conflict
  IF distance > 1000 km:
    RETURN "probable_spoofing"  -- too far for equipment error
  ELIF distance > 100 km:
    RETURN "possible_spoofing"
  ELSE:
    RETURN "possible_equipment_error"
```

### 8.3 Real-World Precedents

The "Andrey Dolgov" case (2008-2018) is instructive: actors in the
Southern Ocean disguised illegal fishing operations by transmitting up to
100 simultaneous and identical AIS signals to overwhelm tracking systems.
Global Fishing Watch documented cases where multiple vessels simultaneously
broadcast the same MMSI, requiring track separation algorithms that group
physically plausible position sequences together.

### 8.4 Track Separation for Shared Identities

```
TRACK SEPARATION ALGORITHM

Input: All reports for a conflicted identifier, sorted by timestamp
Output: Separated track clusters

Step 1: Build temporal-spatial graph
  Nodes = individual position reports
  Edges = connect reports where transit is physically possible
  Edge weight = 1.0 / v_required  (slower transit = more likely same vessel)

Step 2: Find connected components
  Each component is a candidate track

Step 3: Validate each component
  - Consistent heading changes (no teleportation within component)
  - Consistent vessel metadata (name, type, call sign)
  - Plausible behavior pattern (not circular/looping)

Step 4: Assign temporary identifiers
  conflicted_id.track_A, conflicted_id.track_B, etc.
  Flag all tracks as LOW CONFIDENCE until resolved
```

---

## 9. Temporal Consistency Analysis

### 9.1 Inter-Arrival Time Analysis

Legitimate transmitters have characteristic message rates determined by
protocol specifications and equipment behavior. Deviations from expected
patterns indicate anomalies.

**AIS Nominal Rates (per IMO requirements):**

| Condition                | Class A Rate        | Class B Rate        |
|--------------------------|---------------------|---------------------|
| At anchor, < 3 kn       | Every 3 minutes     | Every 3 minutes     |
| 0-14 knots, not turning  | Every 10 seconds    | Every 30 seconds    |
| 0-14 knots, turning      | Every 3.3 seconds   | Every 30 seconds    |
| 14-23 knots, not turning | Every 6 seconds     | Every 30 seconds    |
| 14-23 knots, turning     | Every 2 seconds     | Every 30 seconds    |
| > 23 knots, not turning  | Every 2 seconds     | Every 30 seconds    |

**ADS-B Nominal Rate:** ~1 message/second (Extended Squitter)

### 9.2 Temporal Anomaly Detection

```
TEMPORAL CONSISTENCY ANALYZER

State: message_history[identifier] = circular_buffer(last_N_timestamps)

For each new message M:
  history = message_history[M.identifier]

  -- Compute inter-arrival times
  iat = M.timestamp - history.last_timestamp
  mean_iat = mean(history.inter_arrival_times)
  std_iat = std(history.inter_arrival_times)

  -- Check rate anomalies
  expected_iat = NOMINAL_RATE[M.protocol][M.nav_status]

  -- Too fast: potential replay or injection
  IF iat < expected_iat * 0.3:
    flag_temporal_anomaly(
      type = "burst",
      iat = iat,
      expected = expected_iat,
      assessment = "possible_message_injection"
    )

  -- Too slow: potential selective suppression
  IF iat > expected_iat * 5.0 AND M.nav_status == "underway":
    flag_temporal_anomaly(
      type = "gap",
      iat = iat,
      expected = expected_iat,
      assessment = "possible_dark_period"
    )

  -- Rate change without status change: anomalous
  IF |iat - mean_iat| > 3 * std_iat AND nav_status_unchanged:
    flag_temporal_anomaly(
      type = "rate_shift",
      iat = iat,
      mean_iat = mean_iat,
      std_iat = std_iat,
      assessment = "possible_equipment_change_or_spoofing"
    )

  -- Update history
  history.append(M.timestamp)
```

### 9.3 TDMA Slot Consistency (AIS-Specific)

AIS uses SOTDMA for slot allocation. Each transmitter negotiates specific
time slots. A spoofed signal may violate TDMA protocol:

- **Slot collision**: Two transmitters claiming the same slot
- **Slot migration**: Rapid changes in allocated slots without protocol cause
- **Non-standard slot usage**: Slots outside the vessel's negotiated range

Research by Sciancalepore et al. demonstrated that checking TDMA compliance
combined with Kalman filter velocity tracking provides robust spoofing
detection with low false positive rates.

---

## 10. Spoofing Detection Algorithms

Four detector algorithms form Tsingou's anti-spoofing subsystem.

### 10.1 Detector 1: Kinematic Consistency Detector (KCD)

```pseudocode
ALGORITHM: Kinematic Consistency Detector
PURPOSE:   Detect physically impossible movement patterns
INPUT:     Stream of (id, pos, vel, heading, timestamp, entity_class)
STATE:     Kalman filter per tracked entity

FUNCTION kcd_process(report):
  kf = kalman_filters[report.id]
  IF kf is None:
    kf = init_kalman(report)
    kalman_filters[report.id] = kf
    RETURN {anomaly: false}

  -- Predict next state from current Kalman estimate
  predicted = kf.predict(dt = report.timestamp - kf.last_update)

  -- Compute innovation (measurement - prediction)
  innovation_pos = haversine(report.pos, predicted.pos)
  innovation_vel = |report.vel - predicted.vel|
  innovation_hdg = angular_diff(report.heading, predicted.heading)

  -- Normalized innovation squared (NIS)
  NIS = innovation_pos^2 / predicted.pos_variance
      + innovation_vel^2 / predicted.vel_variance
      + innovation_hdg^2 / predicted.hdg_variance

  -- Chi-squared test (3 DOF)
  IF NIS > CHI2_THRESHOLD[3, 0.001]:   -- p < 0.001
    -- Extreme deviation from predicted state
    score = min(1.0, NIS / (10 * CHI2_THRESHOLD[3, 0.001]))

    RETURN {
      anomaly: true,
      detector: "KCD",
      score: score,
      details: {
        innovation_pos: innovation_pos,
        innovation_vel: innovation_vel,
        innovation_hdg: innovation_hdg,
        NIS: NIS,
        threshold: CHI2_THRESHOLD[3, 0.001]
      }
    }

  -- Update Kalman filter with measurement
  kf.update(report)
  RETURN {anomaly: false}
```

### 10.2 Detector 2: Cross-Source Position Verifier (CSPV)

```pseudocode
ALGORITHM: Cross-Source Position Verifier
PURPOSE:   Compare claimed position across independent sources
INPUT:     Fused observation set for entity E from N sources
STATE:     None (stateless per evaluation)

FUNCTION cspv_evaluate(entity_id, observations):
  -- Group observations by source type
  sources = group_by(observations, 'source_type')

  IF len(sources) < 2:
    RETURN {anomaly: false, reason: "insufficient_sources"}

  -- Compute centroid of all claimed positions
  positions = [obs.position for obs in observations]
  centroid = geographic_centroid(positions)

  -- Compute residuals from centroid
  residuals = [haversine(pos, centroid) for pos in positions]

  -- Identify outliers (positions far from consensus)
  median_residual = median(residuals)
  mad = median_absolute_deviation(residuals)

  anomalies = []
  FOR i, (obs, residual) IN enumerate(zip(observations, residuals)):
    IF residual > median_residual + 3 * mad:
      anomalies.append({
        source: obs.source_type,
        claimed_pos: obs.position,
        residual: residual,
        consensus_pos: centroid,
        score: min(1.0, residual / (median_residual + 6 * mad))
      })

  IF anomalies:
    RETURN {
      anomaly: true,
      detector: "CSPV",
      score: max(a.score for a in anomalies),
      consensus_position: centroid,
      outlier_sources: anomalies,
      n_sources: len(sources),
      n_outliers: len(anomalies)
    }

  RETURN {anomaly: false, consensus_position: centroid}
```

### 10.3 Detector 3: Identity Consistency Monitor (ICM)

```pseudocode
ALGORITHM: Identity Consistency Monitor
PURPOSE:   Detect identifier conflicts and metadata inconsistencies
INPUT:     Stream of reports grouped by identifier
STATE:     identity_profiles[id] = {name, type, flag, call_sign, tracks[]}

FUNCTION icm_process(report):
  profile = identity_profiles[report.id]

  IF profile is None:
    identity_profiles[report.id] = create_profile(report)
    RETURN {anomaly: false}

  anomalies = []

  -- Check 1: Simultaneous presence at multiple locations
  FOR track IN profile.tracks:
    IF is_concurrent(report, track) AND is_impossible_transit(report, track):
      anomalies.append({
        type: "simultaneous_presence",
        location_a: track.last_position,
        location_b: report.position,
        score: 0.95
      })

  -- Check 2: Metadata mutation
  IF report.vessel_name != profile.name AND profile.name is not None:
    anomalies.append({
      type: "name_change",
      previous: profile.name,
      current: report.vessel_name,
      score: 0.7
    })

  IF report.vessel_type != profile.type AND profile.type is not None:
    anomalies.append({
      type: "type_change",
      previous: profile.type,
      current: report.vessel_type,
      score: 0.6
    })

  -- Check 3: Flag state vs MMSI prefix consistency
  IF report.protocol == "AIS":
    expected_flag = mmsi_to_flag(report.id)
    IF report.flag_state != expected_flag:
      anomalies.append({
        type: "flag_mismatch",
        mmsi_flag: expected_flag,
        claimed_flag: report.flag_state,
        score: 0.5  -- common for reflagged vessels, not always spoofing
      })

  IF anomalies:
    best = max(anomalies, key=lambda a: a.score)
    RETURN {
      anomaly: true,
      detector: "ICM",
      score: best.score,
      all_anomalies: anomalies
    }

  -- Update profile
  update_profile(profile, report)
  RETURN {anomaly: false}
```

### 10.4 Detector 4: RF Signature Authenticator (RSA)

```pseudocode
ALGORITHM: RF Signature Authenticator
PURPOSE:   Verify transmitter hardware identity via RF fingerprint
INPUT:     Raw IQ samples + claimed identifier
STATE:     fingerprint_db[id] = {cfo_model, iq_model, pa_model}
REQUIRES:  SDR with raw IQ capture capability

FUNCTION rsa_authenticate(raw_iq, claimed_id):
  -- Feature extraction
  cfo = extract_carrier_frequency_offset(raw_iq)
  iq_imbalance = extract_iq_imbalance(raw_iq)
  pa_signature = extract_pa_nonlinearity(raw_iq)

  feature_vector = [cfo, iq_imbalance, pa_signature]

  -- Check against enrolled fingerprint
  enrolled = fingerprint_db[claimed_id]
  IF enrolled is None:
    -- First observation: enroll
    fingerprint_db[claimed_id] = create_model(feature_vector)
    RETURN {anomaly: false, action: "enrolled"}

  -- Compute Mahalanobis distance
  distance = mahalanobis(feature_vector, enrolled.mean, enrolled.covariance)

  -- Chi-squared test (3 DOF for 3 features)
  IF distance > CHI2_THRESHOLD[3, 0.01]:   -- p < 0.01
    score = min(1.0, distance / (3 * CHI2_THRESHOLD[3, 0.01]))

    RETURN {
      anomaly: true,
      detector: "RSA",
      score: score,
      details: {
        mahalanobis_distance: distance,
        threshold: CHI2_THRESHOLD[3, 0.01],
        cfo_deviation: |cfo - enrolled.mean.cfo|,
        iq_deviation: |iq_imbalance - enrolled.mean.iq|
      }
    }

  -- Update enrolled model (running average)
  update_model(enrolled, feature_vector)
  RETURN {anomaly: false}
```

### 10.5 Detector Orchestration

```
DETECTOR ENSEMBLE

For each incoming report R:
  results = parallel_execute(
    kcd_process(R),      -- Kinematic consistency
    icm_process(R),      -- Identity consistency
    -- CSPV runs on fused observation sets, not individual reports
    -- RSA runs only when raw IQ is available
  )

  -- Aggregate detector scores
  active_detectors = [r for r in results if r.anomaly]

  IF len(active_detectors) == 0:
    RETURN {spoofing_suspected: false}

  -- Weighted combination
  weights = { KCD: 0.30, CSPV: 0.35, ICM: 0.20, RSA: 0.15 }
  total_score = SUM(w[d.detector] * d.score for d in active_detectors)
               / SUM(w[d.detector] for d in active_detectors)

  RETURN {
    spoofing_suspected: total_score > 0.5,
    spoofing_score: total_score,
    detectors_triggered: [d.detector for d in active_detectors],
    n_detectors: len(active_detectors),
    details: active_detectors
  }
```

---

## 11. Decision Tree: Error vs Deception

Not every anomaly is adversarial. Equipment failures, configuration errors,
and environmental conditions produce similar symptoms. The system must
distinguish between benign and malicious causes.

```
DECISION TREE: ERROR vs DECEPTION

START: Anomaly detected by one or more detectors

  Q1: How many independent detectors triggered?
  ├── 1 detector → PROCEED to Q2
  └── 2+ detectors → PROCEED to Q3 (elevated suspicion)

  Q2: What type of anomaly?
  ├── Position jump only
  │   ├── Jump axis-aligned (N/S or E/W)? → LIKELY COORDINATE BIT ERROR
  │   ├── Jump to (0,0)? → LIKELY GPS FIX LOSS (Null Island)
  │   ├── Jump < 2x v_max? → LIKELY GPS MULTIPATH / ACCURACY ISSUE
  │   └── Jump > 10x v_max? → PROCEED to Q3
  │
  ├── RSSI anomaly only
  │   ├── Atmospheric ducting conditions present? → LIKELY PROPAGATION ANOMALY
  │   ├── Anomaly consistent across multiple receivers? → PROCEED to Q3
  │   └── Single receiver anomaly? → LIKELY RECEIVER CALIBRATION ISSUE
  │
  ├── Temporal anomaly only
  │   ├── Message burst (too fast)? → LIKELY EQUIPMENT MALFUNCTION or REPLAY
  │   ├── Gap followed by plausible position? → LIKELY DARK PERIOD (deliberate)
  │   └── Rate shift without behavior change? → LIKELY EQUIPMENT RECONFIGURATION
  │
  └── Identity conflict only
      ├── Same metadata, two locations? → LIKELY SPOOFING (identity reuse)
      ├── Different metadata, same ID? → LIKELY SPOOFING (identity theft)
      └── Similar metadata, close locations? → LIKELY EQUIPMENT ERROR

  Q3: Multiple detectors or severe single anomaly
  ├── Position + Identity conflict? → HIGH CONFIDENCE SPOOFING
  ├── Position + RSSI mismatch? → HIGH CONFIDENCE POSITION FALSIFICATION
  ├── Position + RF fingerprint mismatch? → DEFINITIVE SPOOFING (different hardware)
  ├── Kinematic + temporal anomaly? → PROBABLE SPOOFING (injection attack)
  └── All four detectors triggered? → NEAR-CERTAIN SPOOFING

  Q4: Contextual factors
  ├── Entity in known spoofing zone (Baltic, Black Sea)? → +0.2 suspicion
  ├── Entity on sanctions list? → +0.3 suspicion
  ├── Entity in area of active conflict? → +0.2 suspicion
  ├── Entity type mismatch with behavior? → +0.1 suspicion
  └── Entity history of prior anomalies? → +0.15 suspicion

ASSESSMENT OUTPUT:
  assessment = {
    classification: "equipment_error" | "probable_spoofing" | "confirmed_spoofing",
    confidence: 0.0..1.0,
    contributing_factors: [...],
    recommended_action: "monitor" | "flag" | "alert" | "escalate",
    stix_indicator: generate_if_confidence > 0.7
  }
```

### 11.1 Confusion Matrix Targets

| Actual \ Predicted | Equipment Error | Spoofing |
|--------------------|-----------------|----------|
| Equipment Error    | 90% (TN)        | 10% (FP) |
| Spoofing           | 5% (FN)         | 95% (TP) |

The system prioritizes low false negatives (missed spoofing) over low
false positives (false alarms), because missed spoofing has higher
operational consequences. The 10% false positive rate is acceptable given
the alarm priority framework in Section 27.

---

## 12. Confidence Downgrade Formulas

When spoofing is detected or suspected, the fusion system must downgrade
confidence in the affected signals. This section defines the mathematical
relationship between spoofing detection score and fusion confidence.

### 12.1 Single-Source Confidence Downgrade

```
CONFIDENCE DOWNGRADE MODEL

Given:
  C_original  = original confidence of fusion datum (from ontology Sec 3.2.2)
  S_spoof     = spoofing score from detector ensemble (0.0 = clean, 1.0 = certain)
  n_detectors = number of detectors that triggered
  alpha       = downgrade aggressiveness (default: 2.0)

Formula:
  penalty = S_spoof^(1/alpha) * (1 + 0.1 * (n_detectors - 1))
  penalty = clamp(penalty, 0.0, 1.0)

  C_adjusted = C_original * (1 - penalty)

Examples:
  S=0.3 (low),  n=1 → penalty=0.548, C_adj = C_orig * 0.452
  S=0.5 (med),  n=1 → penalty=0.707, C_adj = C_orig * 0.293
  S=0.5 (med),  n=2 → penalty=0.778, C_adj = C_orig * 0.222
  S=0.8 (high), n=2 → penalty=0.985, C_adj = C_orig * 0.015
  S=0.9 (vhi),  n=3 → penalty=1.000, C_adj = 0.000

Note: When C_adjusted < 0.1, the datum should be flagged as UNTRUSTED
and excluded from downstream fusion unless operator overrides.
```

### 12.2 Cascading Downgrade

When a source is flagged for spoofing, all fusion products that depend
on that source must be re-evaluated:

```
CASCADING DOWNGRADE

For each affected_datum D that includes flagged_source S:
  -- Recompute confidence without S
  C_without_S = recompute_confidence(D.contributing_sources - {S})

  -- If removing S drops below fusion threshold, DEFUSE
  IF C_without_S < FUSION_THRESHOLD:
    defuse(D)  -- break the fusion, revert to independent signals
    notify_operator("Fusion broken: source flagged for spoofing")

  -- Otherwise, adjust
  ELSE:
    D.confidence = C_without_S
    D.metadata.spoofing_flag = true
    D.metadata.excluded_sources = [S]
```

### 12.3 Trust Recovery

A source flagged for spoofing does not remain flagged forever. Trust
recovers as subsequent reports pass all detector checks:

```
TRUST RECOVERY MODEL

State: trust_level[source_id] = 1.0 (healthy) .. 0.0 (untrusted)

On spoofing detection:
  trust_level[source] = max(0.0, trust_level[source] - penalty)

On clean report (all detectors pass):
  trust_level[source] = min(1.0, trust_level[source] + RECOVERY_RATE)

RECOVERY_RATE:
  After equipment_error classification:  0.05 per clean report
  After probable_spoofing:               0.02 per clean report
  After confirmed_spoofing:              0.005 per clean report

Full recovery times (from trust=0.0 to trust=1.0):
  Equipment error:   20 clean reports (~minutes)
  Probable spoofing: 50 clean reports (~hours)
  Confirmed spoofing: 200 clean reports (~days)
```

---

## 13. STIX Indicator Generation

When the spoofing detection subsystem produces a high-confidence detection,
it generates STIX 2.1 objects for threat intelligence sharing.

### 13.1 STIX Object Mapping

| Tsingou Concept          | STIX 2.1 Object Type   | Key Properties                         |
|--------------------------|------------------------|----------------------------------------|
| Spoofing event           | `indicator`            | pattern, valid_from, valid_until       |
| Spoofing entity          | `threat-actor`         | name, threat_actor_types, aliases      |
| Spoofing method          | `attack-pattern`       | name, description, kill_chain_phases   |
| Affected vessel/aircraft | `identity`             | name, identity_class, sectors          |
| Detection evidence       | `observed-data`        | objects, first/last_observed           |
| Cross-reference          | `relationship`         | relationship_type, source/target_ref   |
| Detection rule           | `indicator`            | pattern (STIX patterning language)     |

### 13.2 STIX Indicator Templates

**AIS Identity Spoofing Indicator:**

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--<uuid>",
  "created": "<timestamp>",
  "modified": "<timestamp>",
  "name": "AIS Identity Spoofing: MMSI <mmsi>",
  "description": "Detected simultaneous AIS transmissions claiming MMSI <mmsi> from geographically incompatible locations (<distance>km apart within <dt>s window). Identity Consistency Monitor score: <score>.",
  "indicator_types": ["anomalous-activity", "malicious-activity"],
  "pattern": "[x-ais-message:mmsi = '<mmsi>' AND x-ais-message:position.latitude IN (<lat1_range>) AND x-ais-message:position.longitude IN (<lon1_range>)] FOLLOWEDBY [x-ais-message:mmsi = '<mmsi>' AND x-ais-message:position.latitude IN (<lat2_range>) AND x-ais-message:position.longitude IN (<lon2_range>)]",
  "pattern_type": "stix",
  "valid_from": "<first_detection_time>",
  "valid_until": "<last_detection_time + 24h>",
  "confidence": 85,
  "labels": ["ais-spoofing", "identity-fraud"],
  "external_references": [
    {
      "source_name": "tsingou",
      "description": "Tsingou Fusion Platform detection",
      "external_id": "<internal_detection_id>"
    }
  ]
}
```

**GPS Spoofing Zone Indicator:**

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--<uuid>",
  "created": "<timestamp>",
  "modified": "<timestamp>",
  "name": "GPS Spoofing Zone: <region_name>",
  "description": "Multiple entities report GNSS-inconsistent positions within geographic area. Cross-Source Position Verifier detected <n> affected entities over <duration>. Consistent with state-level GPS spoofing.",
  "indicator_types": ["anomalous-activity"],
  "pattern": "[x-gnss-observation:spoofing_score > 0.7 AND x-gnss-observation:position WITHIN '<geofence_wkt>']",
  "pattern_type": "stix",
  "valid_from": "<zone_first_detected>",
  "valid_until": "<zone_last_active + 7d>",
  "confidence": 75,
  "labels": ["gnss-spoofing", "electronic-warfare"]
}
```

### 13.3 STIX Relationship Generation

```
For each spoofing detection event E:

  1. Create indicator I from detection
  2. Create observed-data O from raw signals
  3. Create relationship: O --"based-on"--> I
  4. IF entity identified:
     Create identity V for affected entity
     Create relationship: I --"targets"--> V
  5. IF attribution possible:
     Create threat-actor TA
     Create relationship: I --"indicates"--> TA
  6. IF attack pattern classified:
     Create attack-pattern AP
     Create relationship: TA --"uses"--> AP

  Bundle all objects and publish via TAXII
```

---

## 14. Adversarial ML Considerations

### 14.1 The Arms Race Problem

Spoofing detection heuristics are themselves vulnerable to adversarial
adaptation. An attacker who understands the detection system can craft
spoofed signals that evade specific detectors.

### 14.2 Detector Evasion Strategies

| Detector | Evasion Strategy | Difficulty |
|----------|------------------|------------|
| KCD (Kinematic) | Gradual position drift instead of jumps | Medium |
| CSPV (Cross-Source) | Spoof multiple sources simultaneously | Very High |
| ICM (Identity) | Use unclaimed/retired identifiers | Low |
| RSA (RF Fingerprint) | Hardware-matched transmission | Very High |
| RSSI (Signal Strength) | Calibrate transmit power to match claimed distance | Medium |
| Temporal | Match expected message rate precisely | Low |

### 14.3 Defense-in-Depth

No single detector should be trusted alone. The ensemble approach provides
resilience because evading multiple independent detectors simultaneously
requires:

1. **Physically consistent position over time** (evades KCD)
2. **Matching positions across independent sensor types** (evades CSPV)
3. **Consistent identity metadata** (evades ICM)
4. **Matching RF hardware signature** (evades RSA)
5. **Correct signal strength for claimed distance** (evades RSSI)
6. **Correct message timing** (evades temporal)

Achieving all six simultaneously approaches the cost of actually being
the legitimate entity — which defeats the purpose of spoofing.

### 14.4 Adversarial ML Attack Vectors

Recent research (NIST AI 100-2e, 2025) identifies key adversarial attack
patterns against ML-based detection:

**Evasion attacks**: Attacker subtly modifies inputs to cause
misclassification. For GPS spoofing detection, demonstrated via data
location shift attacks and similarity-based noise injection against
SVM classifiers.

**Model inversion**: Attacker queries the detection system to infer
its decision boundaries, then crafts inputs that fall just inside the
"clean" region.

**Poisoning attacks**: Attacker introduces carefully crafted false training
data over time, gradually shifting the model's decision boundary.

### 14.5 Countermeasures

```
ADVERSARIAL ROBUSTNESS MEASURES

1. DETECTOR DIVERSITY
   - Use fundamentally different detection principles (physics-based,
     statistical, ML-based, cross-source)
   - Ensure detectors share no common failure modes
   - Regularly rotate ML model architectures

2. FEATURE ROBUSTNESS
   - Use features the attacker cannot control (RF fingerprint, TDOA)
   - Weight controllable features (claimed position, speed) lower
   - Include environmental context (known spoofing zones) as prior

3. ADAPTIVE THRESHOLDS
   - Tighten thresholds in known high-risk areas/times
   - Use Bayesian updating to adjust thresholds based on local threat level
   - Per-entity threat scoring based on history

4. ADVERSARIAL TRAINING
   - Train ML models with adversarial examples
   - Regular red-team exercises to test detection gaps
   - Simulate sophisticated spoofing campaigns

5. HUMAN-IN-THE-LOOP
   - Never fully automate spoofing classification
   - Route borderline cases to operator review
   - Operator override authority on all automated decisions
```

---

## 15. Feedback into Fusion Confidence

### 15.1 Integration with Fusion Ontology

The spoofing detection subsystem feeds back into the fusion ontology
(TSGC-001) at three points:

**Point 1: Source Trust Level**

Each source maintains a trust level (Section 12.3) that multiplies into
the confidence computation:

```
C_fusion = (SUM(w_i * score_i * trust_i) / SUM(w_i * trust_i))

where trust_i = trust_level[source_i]

Effect: A spoofing-flagged source's contribution is attenuated
proportional to its trust degradation.
```

**Point 2: Predicate Weight Modification**

When spoofing is detected in a specific domain, the ontology adjusts
predicate weights to reduce reliance on the compromised signal type:

```
IF ais_spoofing_detected_in_area(area):
  -- Reduce weight of AIS-dependent predicates in area
  w_spatial_ais *= 0.3
  w_temporal_ais *= 0.3
  -- Increase weight of independent sources
  w_spatial_radar *= 1.5
  w_spatial_satellite *= 1.5
```

**Point 3: Tier Promotion**

When Tier 1 (hard key) joins become unreliable due to spoofing (e.g.,
MMSI-based identity joins), they are effectively demoted to Tier 2
(soft key) semantics:

```
IF identity_conflict_detected(mmsi):
  -- Demote from Tier 1 to Tier 2
  join_path.tier = 2
  join_path.confidence = f(spatial, temporal)  -- no longer 1.0
  join_path.note = "Identity key compromised by detected spoofing"
  notify_operator("Hard key join demoted: MMSI unreliable")
```

### 15.2 Dempster-Shafer Evidence Combination

For combining evidence from multiple detectors with varying reliability,
Tsingou uses a modified Dempster-Shafer framework with reliability
discounting:

```
DEMPSTER-SHAFER WITH RELIABILITY DISCOUNT

For each detector D_i producing mass function m_i:
  -- Discount based on detector's historical accuracy
  reliability_i = detector_accuracy[D_i]
  m_i_discounted(A) = reliability_i * m_i(A)     for A != Theta
  m_i_discounted(Theta) = 1 - reliability_i * (1 - m_i(Theta))

  where Theta = frame of discernment = {spoofing, not_spoofing}

Combined mass (Dempster's rule with discounting):
  m_combined(A) = (1/K) * SUM over B∩C=A { m_1_disc(B) * m_2_disc(C) }
  K = 1 - SUM over B∩C=empty { m_1_disc(B) * m_2_disc(C) }

  IF K < 0.1:
    -- Extreme conflict between detectors
    flag_detector_disagreement()
    -- Fall back to weighted average instead of DS combination
```

---

# Part II: RI-8 — Operator Cognitive Load

## 16. Situation Awareness Model

### 16.1 Endsley's Three-Level Model

Mica Endsley's Situation Awareness (SA) model (1995) defines three levels
of cognitive processing that an operator must perform:

```
LEVEL 1: PERCEPTION
  "What elements are present in the environment?"
  - Detecting signals, reading values, noticing changes
  - In Tsingou: seeing tracks on the map, reading confidence values,
    noticing new signals appearing
  - FAILURE MODE: information not displayed, cluttered display,
    missed alert

LEVEL 2: COMPREHENSION
  "What do these elements mean together?"
  - Integrating information, understanding significance
  - In Tsingou: understanding that two tracks are correlated,
    recognizing a spoofing pattern, interpreting confidence trends
  - FAILURE MODE: information overload, poor information integration,
    lack of domain knowledge

LEVEL 3: PROJECTION
  "What will happen next?"
  - Predicting future states, anticipating developments
  - In Tsingou: predicting vessel trajectory, anticipating spoofing
    escalation, projecting track convergence/divergence
  - FAILURE MODE: cognitive overload, insufficient mental model,
    poor system feedback on trends
```

### 16.2 SA Bottlenecks in Fusion Systems

| SA Level   | Fusion-Specific Challenge                             | Tsingou Mitigation                                |
|------------|-------------------------------------------------------|---------------------------------------------------|
| Perception | Too many signals, too many join paths displayed       | Progressive disclosure, semantic zoom              |
| Perception | Confidence values not visually salient                | Color-coded confidence, size encoding              |
| Comprehension | Correlation vs merge distinction unclear          | Distinct visual encodings (edge vs merged node)    |
| Comprehension | Spoofing flags lost in information noise          | Dedicated spoofing alert channel, visual highlight |
| Projection | Cannot see confidence trends over time                | Sparkline confidence history per entity            |
| Projection | Cannot anticipate spoofing propagation               | Spoofing zone overlay, affected entity highlighting|

### 16.3 SA Design Principles for Tsingou

1. **Organize information around goals**, not data sources
   - Operator goal: "Is this entity real?" not "What does AIS say?"
   - Group all evidence for/against per entity, not per source

2. **Support Level 2 SA with automated integration**
   - The fusion engine performs Level 2 work (comprehension)
   - Display the result (confidence, assessment) not the raw inputs
   - Raw inputs available on demand (progressive disclosure)

3. **Support Level 3 SA with trend indicators**
   - Show confidence direction (improving, degrading)
   - Show spoofing likelihood trend (emerging, stable, resolving)
   - Predictive track projection (where will this entity be in 10 min?)

---

## 17. Working Memory and Miller's Law

### 17.1 Miller's Law

George Miller's seminal 1956 paper established that human working memory
can hold approximately 7 +/- 2 "chunks" of information simultaneously.
Subsequent research has refined this to 4 +/- 1 for complex items
(Cowan, 2001).

### 17.2 Implications for Fusion Monitoring

**What counts as a "chunk" in fusion monitoring:**
- One tracked entity with its confidence assessment
- One active join path being evaluated
- One spoofing alert under investigation
- One geographic area of interest
- One temporal pattern being tracked

**Working memory budget for a fusion operator:**

```
COGNITIVE BUDGET (4 +/- 1 chunks)

Minimum viable monitoring (3 chunks):
  1. Primary entity of interest
  2. Geographic context (area overview)
  3. Current alert/task

Comfortable monitoring (5 chunks):
  4. Secondary entity or comparison
  5. Temporal trend awareness

Overloaded (7+ chunks):
  6. Third entity
  7. Active spoofing investigation
  8+ ERROR: information lost, SA degrades

DESIGN IMPLICATION:
  The display should NEVER require the operator to hold more
  than 5 simultaneous "chunks" to perform their primary task.
```

### 17.3 Maximum Simultaneous Join Paths

**Critical question from RI-8**: How many join paths can an operator
meaningfully monitor and tune?

```
JOIN PATH MONITORING CAPACITY ANALYSIS

Each join path requires the operator to maintain:
  - Source A identity and characteristics (0.5 chunks)
  - Source B identity and characteristics (0.5 chunks)
  - Confidence value and trend (0.5 chunks)
  - Threshold settings awareness (0.5 chunks)
  Total per join path: ~2 chunks

Given working memory of 4-5 chunks:
  Concurrent active monitoring: 2-3 join paths maximum

BUT: with chunking strategies (familiarity, grouping):
  - Group by entity (all paths for entity E = 1 chunk)
  - Group by tier (all Tier 1 paths = 1 chunk, trusted)
  - Group by area (all paths in sector X = 1 chunk)

With effective chunking:
  - 3-5 entity groups simultaneously
  - Each group encapsulates 2-4 join paths
  - Total: 6-20 join paths IF properly chunked

WITHOUT chunking (raw path display):
  - Maximum: 2-3 join paths before SA loss

DESIGN IMPLICATION:
  Display join paths GROUPED by entity, not individually.
  Show per-entity fusion confidence, not per-path scores.
  Allow drill-down to individual paths on demand.
```

---

## 18. Information Visualization Principles

### 18.1 Shneiderman's Visual Information-Seeking Mantra

Ben Shneiderman's mantra provides the foundational interaction design
for Tsingou's fusion dashboard:

```
OVERVIEW FIRST
  → Show the entire operational picture
  → All tracked entities, all active join paths (aggregated)
  → Color-coded by confidence, clustered by entity class
  → Spoofing alerts highlighted but not dominant

ZOOM AND FILTER
  → Geographic zoom to area of interest
  → Filter by entity class, signal type, confidence range
  → Filter by spoofing status (clean / suspect / confirmed)
  → Time range selection for historical analysis

DETAILS ON DEMAND
  → Click entity → full fusion breakdown
  → Click join path → contributing signals, confidence components
  → Click spoofing alert → detector details, evidence chain
  → Click confidence score → formula breakdown, weight visualization
```

### 18.2 Applied to Tsingou's Four Layers

| Layer  | Shneiderman Step | Content                                     |
|--------|------------------|---------------------------------------------|
| z:0    | Overview         | Geographic canvas with entity tracks        |
| z:1    | Zoom & Filter    | Data overlays, confidence heat maps         |
| z:2    | Zoom & Filter    | Annotation layer, relationship edges        |
| z:3    | Details on Demand | Control panel, fusion tuning, alert queue   |

### 18.3 Tufte's Data-Ink Ratio

Every pixel should convey information. In a fusion dashboard:

- **High data-ink**: Track lines, confidence colors, alert icons
- **Low data-ink**: Decorative borders, redundant labels, grid lines
- **Remove**: Chrome that doesn't inform, redundant legends, noise

Target data-ink ratio: > 0.8

---

## 19. Alarm Fatigue

### 19.1 The Problem

Alarm fatigue occurs when operators become desensitized to alerts due to
excessive volume, causing them to miss critical events. Research from
healthcare (AHRQ, 2025) found alarm fatigue leads to a 14%+ increase in
medical errors.

### 19.2 Cross-Industry Lessons

**Healthcare:**
- 85-99% of clinical alerts are overridden (clinically inconsequential)
- Alert fatigue directly contributes to adverse patient events
- Solution: tiered alerting, context-aware suppression

**Aviation:**
- Cockpit alerts are rigorously designed for high-consequentiality
- Minor alerts minimized to preserve pilot SA
- Master caution / master warning hierarchy
- "Dark cockpit" philosophy: if everything is normal, nothing lights up

**SCADA/Industrial:**
- ISA-18.2 and IEC 62682 standards for alarm management
- Target: max 6 alarms per operator per hour during normal operations
- Max 10 alarms per 10-minute period during abnormal operations
- Alarm floods (>10/min) are treated as system design failures

**Lessons for Tsingou:**
- SCADA's alarm rate targets are directly applicable
- Aviation's "dark cockpit" philosophy maps to Tsingou's z-layer design
- Healthcare's tiered alerting informs the priority framework

### 19.3 Alarm Rate Targets for Tsingou

```
ALARM RATE TARGETS (adapted from ISA-18.2)

Normal operations:     <= 6 alerts / operator / hour
                       <= 1 alert / operator / 10 minutes

Abnormal operations:   <= 30 alerts / operator / hour
  (active spoofing)    <= 10 alerts / operator / 10 minutes

Alarm flood threshold: > 10 alerts in 10 minutes
  Response: Automatic alarm suppression, batch summary mode

Standing alarms:       <= 5 concurrent unacknowledged alerts
  Beyond 5: Automatic prioritization, lowest-priority auto-shelve
```

### 19.4 Alarm Suppression Strategies

| Strategy               | When to Apply                                      |
|------------------------|----------------------------------------------------|
| **Deduplication**      | Same entity, same detector, within 5 minutes       |
| **Shelving**           | Acknowledged but unresolved, operator sets duration |
| **State-based**        | Suppress alarms for entities in known maintenance   |
| **Flood suppression**  | > 10 alarms/10min: batch into summary              |
| **Correlation**        | Multiple alarms from same root cause: show parent   |
| **Rate limiting**      | Max 1 alert per entity per detector per 5 minutes  |

---

## 20. Progressive Disclosure

### 20.1 Principle

Present information in layers of increasing detail. The operator sees
the minimum needed at each level and can drill down for more.

### 20.2 Disclosure Levels for Fusion Data

```
LEVEL 0: ENTITY DOT
  Visual: Colored dot on map
  Information: Position, entity class, confidence (via color)
  Interaction: None required

LEVEL 1: ENTITY LABEL (hover)
  Visual: Tooltip/label appears
  Information: Name/ID, speed, heading, confidence value, spoofing flag
  Interaction: Mouse hover or tap

LEVEL 2: ENTITY CARD (click)
  Visual: Side panel or popup card
  Information:
    - All identifiers (MMSI, ICAO, etc.)
    - Fusion tier and contributing sources
    - Confidence breakdown (per predicate)
    - Spoofing assessment and detector results
    - Track history (last N positions)
    - Related entities (correlation links)
  Interaction: Click/select

LEVEL 3: FULL ANALYSIS (drill-down)
  Visual: Full-screen analysis view
  Information:
    - Raw signal timeline from all sources
    - Confidence history chart
    - Spoofing detector trace (per detector over time)
    - RF fingerprint comparison (if available)
    - STIX indicator history
    - Operator notes and assessment history
  Interaction: "Analyze" button from Level 2

LEVEL 4: RAW DATA (developer/expert)
  Visual: Data table / JSON view
  Information: Raw signal payloads, protocol-level details
  Interaction: "Raw" toggle from Level 3
```

### 20.3 Cognitive Load per Level

| Level | Chunks Required | Target Dwell Time | User Role     |
|-------|-----------------|--------------------|--------------  |
| 0     | 0 (preattentive)| Glance (<1s)       | All operators |
| 1     | 1               | Scan (1-3s)        | All operators |
| 2     | 2-3             | Read (5-15s)       | Active monitor|
| 3     | 4-5             | Analyze (1-5min)   | Analyst       |
| 4     | N/A             | Deep dive (>5min)  | Developer     |

---

## 21. Focus+Context Techniques

### 21.1 Overview+Detail

The dominant pattern for geospatial fusion displays. The main view shows
the operational area; a secondary panel shows the detail for selected
entities.

```
+---------------------------------------------------+
|                                                   |
|              MAIN MAP VIEW (Overview)             |
|              All entities, all tracks             |
|              Color = confidence                   |
|                                                   |
|                    [selected entity highlighted]  |
|                                                   |
+---------------------------------------------------+
|    DETAIL PANEL (Context)                         |
|    Selected entity fusion breakdown               |
|    Contributing sources, confidence chart          |
+---------------------------------------------------+
```

### 21.2 Semantic Zoom

Different information density at different zoom levels:

```
ZOOM LEVEL 1 (Continental):
  Show: Entity clusters, density heatmap
  Hide: Individual tracks, labels, edges

ZOOM LEVEL 2 (Regional):
  Show: Individual entity dots, major tracks
  Hide: Correlation edges, confidence values

ZOOM LEVEL 3 (Local):
  Show: Entity labels, track histories, correlation edges
  Hide: Nothing relevant at this scale

ZOOM LEVEL 4 (Tactical):
  Show: Full entity cards, signal source indicators,
        spoofing zone overlays, bearing lines
  Information density: Maximum
```

### 21.3 Fisheye Distortion

For dense entity clusters (e.g., port areas), a fisheye lens effect
magnifies the area of interest while keeping surrounding context visible.
Research shows fisheye views are preferred over zoom-only on constrained
displays, though overview+detail outperforms fisheye for complex tasks.

**Tsingou recommendation**: Use semantic zoom as primary, with optional
fisheye for port/harbor detail views where entity density is highest.

---

## 22. Dashboard Design for Fusion Systems

### 22.1 Lessons from Military C2 Systems

DCGS-A (Distributed Common Ground System - Army) provides lessons for
multi-source intelligence fusion dashboards:

- **Common tile, common display look and feel**: Consistent layout across
  all intelligence sources reduces operator learning curve
- **100+ tools, 700+ data feeds**: Operators need aggressive filtering
  and automation to manage volume
- **Common Operational Picture (COP)**: Single integrated view that
  fuses all sources into one coherent picture
- **Role-based views**: Different operator roles see different default
  configurations of the same underlying data

### 22.2 Fusion Dashboard Layout Principles

```
LAYOUT PRINCIPLES

1. SPATIAL PRIMACY
   The map is the central element. All other panels are secondary.
   Rationale: Geospatial context is the primary integration space
   for multi-source fusion.

2. ALERT GRAVITY
   Alerts flow from top to bottom by priority.
   Highest priority alerts are closest to the map (visual proximity
   to the entities they concern).

3. TEMPORAL FLOW
   Time flows left to right in timeline views.
   Historical data on the left, predictions on the right.

4. CONFIDENCE ENCODING
   Confidence is ALWAYS visually encoded, never just numeric.
   Color (primary) + size (secondary) + opacity (tertiary).

5. SPOOFING SALIENCE
   Spoofing alerts use a distinct visual vocabulary from normal alerts.
   They are NOT just "red alerts" — they have a unique shape/pattern
   to prevent confusion with other alert types.
```

### 22.3 Information Hierarchy

```
PRIMARY (always visible):
  - Entity positions on map
  - Entity confidence (color)
  - Active alert count (badge)

SECONDARY (visible on hover/small panels):
  - Entity identifiers
  - Speed/heading vectors
  - Correlation edges between entities

TERTIARY (visible on click/detail panel):
  - Fusion breakdown per entity
  - Detector results
  - Historical track

QUATERNARY (visible on explicit request):
  - Raw signal data
  - STIX indicators
  - RF fingerprint data
```

---

## 23. Color Coding for Confidence

### 23.1 Requirements

- **Perceptually uniform**: Equal confidence differences = equal visual differences
- **Colorblind safe**: Distinguishable under protanopia, deuteranopia, tritanopia
- **Semantically intuitive**: High confidence = "good" color, low = "bad"
- **Print-safe**: Distinguishable in grayscale

### 23.2 Recommended Palette: Viridis-Based Confidence Scale

The Viridis colormap (Matplotlib) satisfies all four requirements. For
Tsingou, a modified 5-step discrete scale:

```
CONFIDENCE COLOR SCALE

  1.0       0.8       0.6       0.4       0.2       0.0
   |---------|---------|---------|---------|---------|
   #440154   #31688e   #35b779   #fde725   #d62728
   (Purple)  (Teal)    (Green)   (Yellow)  (Red*)

   * Red endpoint is NOT from Viridis; it's added for
     "untrusted/spoofing" to leverage the cultural
     association of red with danger.

Colorblind adaptation:
  Replace red with orange (#D55E00 from Okabe-Ito) for deuteranopia safety.
  The scale then runs: purple -> teal -> green -> yellow -> orange

CONFIDENCE BANDS:
  0.9-1.0  = Verified   (#440154, deep purple)
  0.7-0.9  = High       (#31688e, teal)
  0.5-0.7  = Moderate   (#35b779, green)
  0.3-0.5  = Low        (#fde725, yellow)
  0.0-0.3  = Untrusted  (#D55E00, orange/red)

SPOOFING OVERRIDE:
  When spoofing is detected, the entity gets a PATTERNED fill
  (diagonal stripes) in addition to the confidence color.
  This dual encoding (color + pattern) ensures the spoofing
  flag is distinguishable even in grayscale or to colorblind users.
```

### 23.3 Encoding Redundancy

Never rely on color alone. Always pair with at least one additional channel:

| Information    | Primary Encoding | Secondary Encoding | Tertiary Encoding |
|----------------|------------------|--------------------|-------------------|
| Confidence     | Color (Viridis)  | Opacity            | Size              |
| Spoofing       | Pattern (stripes)| Icon (warning)     | Border dash       |
| Entity class   | Shape            | Icon               | Label prefix      |
| Fusion tier    | Border style     | Badge number       | Tooltip           |
| Alert priority | Icon color       | Position (top)     | Sound             |

---

## 24. Audio Alerts and Sonification

### 24.1 When to Use Sound

Sound bypasses the visual attention bottleneck. Use audio for events that:

1. **Require immediate attention** regardless of where the operator is looking
2. **Are safety-critical** and cannot afford to be missed in visual clutter
3. **Are rare** enough that sound retains its alerting power

### 24.2 Audio Alert Tiers for Tsingou

```
TIER 1: CRITICAL (audio mandatory)
  Events:
    - Confirmed spoofing affecting high-value entity
    - Fusion confidence drop below 0.2 for monitored entity
    - Multiple simultaneous identity conflicts
    - System integrity compromise
  Sound: Two-tone ascending klaxon (500Hz -> 1kHz), 0.5s
  Repetition: Every 30s until acknowledged
  Volume: 80% of system max

TIER 2: WARNING (audio recommended)
  Events:
    - Probable spoofing detected (score > 0.7)
    - New entity enters monitored area
    - Confidence downgrade crosses tier boundary
    - Detector disagreement
  Sound: Single tone pulse (800Hz), 0.3s
  Repetition: Once, with visual persistence
  Volume: 60% of system max

TIER 3: ADVISORY (audio optional, visual preferred)
  Events:
    - Low-confidence spoofing alert (score 0.3-0.7)
    - New join path activated
    - Source trust recovery complete
    - Routine confidence fluctuation
  Sound: Soft click or none
  Repetition: None
  Volume: 40% or muted

TIER 4: INFORMATIONAL (visual only)
  Events:
    - New signal ingested
    - Periodic health check
    - Configuration change
    - Background fusion activity
  Sound: None
  Interaction: Log only, visible on scroll
```

### 24.3 Sonification for Continuous Monitoring

Beyond discrete alerts, continuous sonification can encode system health:

```
AMBIENT SONIFICATION DESIGN

Concept: A subtle background "soundscape" that shifts with system state

Parameters:
  - Base pitch: proportional to total tracked entity count
    (more entities = higher ambient pitch = "busier")
  - Harmonic richness: proportional to average confidence
    (high confidence = clean tone; low = noisy/dissonant)
  - Tempo: proportional to alert rate
    (more alerts = faster pulse)

Operator benefit:
  - Peripheral awareness without visual attention
  - "Something sounds wrong" triggers visual investigation
  - Gradual degradation is perceptible even when not looking

Caution:
  - Must be OPTIONAL (some operators find it distracting)
  - Must be calibrated per operator preference
  - Must never mask discrete alert tones
```

---

## 25. Cognitive Load Analysis

### 25.1 Task Analysis for Fusion Monitoring

```
PRIMARY TASKS (continuous):
  T1. Monitor entity positions and movements
  T2. Assess fusion confidence for entities of interest
  T3. Respond to alerts (spoofing, confidence drops, new entities)

SECONDARY TASKS (periodic):
  T4. Tune fusion parameters (thresholds, weights)
  T5. Investigate spoofing alerts (drill down, classify)
  T6. Generate reports / STIX indicators
  T7. Coordinate with other operators / analysts

TERTIARY TASKS (rare):
  T8. Configure new join paths
  T9. Enroll new RF fingerprints
  T10. System administration
```

### 25.2 Cognitive Load per Task

| Task | Type                 | Working Memory Demand | SA Level  | Duration    |
|------|----------------------|-----------------------|-----------|-------------|
| T1   | Monitoring           | 1-2 chunks            | L1        | Continuous  |
| T2   | Assessment           | 2-3 chunks            | L2        | 5-15s each  |
| T3   | Response             | 3-4 chunks            | L2-L3     | 10-60s each |
| T4   | Configuration        | 3-5 chunks            | L2        | 1-5 min     |
| T5   | Investigation        | 4-5 chunks            | L2-L3     | 2-15 min    |
| T6   | Reporting            | 2-3 chunks            | L2        | 5-30 min    |
| T7   | Communication        | 2-3 chunks            | L1-L2     | Variable    |

### 25.3 Task Concurrency Limits

```
SAFE CONCURRENT TASK COMBINATIONS:

  T1 + T2          = 3-5 chunks  ✅ Normal operations
  T1 + T2 + T3     = 4-7 chunks  ⚠️ Approaching limit
  T1 + T3 + T5     = 5-7 chunks  ⚠️ High load — suppress T4
  T1 + T3 + T5 + T4 = 8+ chunks  ❌ OVERLOAD — defer T4

MITIGATION STRATEGIES:
  1. Automation handles T1 (monitoring) via anomaly detection
  2. System pre-computes T2 (confidence is always displayed)
  3. T3 response has guided workflow (reduces WM demand)
  4. T4 and T5 are mutually exclusive (never tune while investigating)
  5. T6 auto-generates from structured data (operator reviews, not creates)
```

### 25.4 Maximum Simultaneous Join Paths (Quantified)

Drawing from Miller's Law, Endsley's SA model, and task analysis:

```
OPERATOR JOIN PATH MONITORING CAPACITY

Scenario A: OVERVIEW MODE (passive monitoring)
  - Operator scans all active join paths at Level 0-1
  - Chunking: by entity group (all paths per entity = 1 chunk)
  - Capacity: 5-7 entity groups = 10-28 join paths
  - Confidence: HIGH (operator can detect gross anomalies)
  - SA Level: L1 (perception)

Scenario B: ACTIVE MONITORING (focused)
  - Operator actively evaluates specific join paths
  - Chunking: by path type (all spatial paths = 1 chunk)
  - Capacity: 3-4 active path evaluations
  - Confidence: HIGH (operator understands path quality)
  - SA Level: L2 (comprehension)

Scenario C: TUNING MODE (interactive)
  - Operator adjusts weights/thresholds for specific paths
  - No chunking possible (each path requires individual attention)
  - Capacity: 1-2 paths simultaneously
  - Confidence: HIGH (operator has detailed understanding)
  - SA Level: L2-L3 (comprehension + projection)

DESIGN RECOMMENDATION:
  - Overview mode: Show up to 20 join paths (grouped by entity)
  - Active monitoring: Highlight 3-5 paths requiring attention
  - Tuning mode: Focus on 1 path at a time with guided workflow
```

---

## 26. Dashboard Mockup

### 26.1 Primary Operational View

```
+============================================================================+
|  TSINGOU FUSION CONSOLE                          [Alerts: 3] [Config] [?]  |
+============================================================================+
|                                                                             |
|  +------------------------------------------------------------------+  [A] |
|  |                                                                  |  [L] |
|  |                     OPERATIONAL MAP                              |  [E] |
|  |                     z:0 Base Layer                                |  [R] |
|  |                                                                  |  [T] |
|  |     ● Entity A (C:0.92)     ◆ Entity D (C:0.45)                |  [S] |
|  |       ╲                      |                                   |  [ ] |
|  |        ╲ correlation edge    |  ⚠ SPOOF                         |  [Q] |
|  |         ╲                    |                                   |  [U] |
|  |     ● Entity B (C:0.88)     ◆ Entity E (C:0.31) ////           |  [E] |
|  |                                (striped = spoofing suspected)    |  [U] |
|  |                                                                  |  [E] |
|  |     ▲ Entity C (C:0.71)                                        |  [ ] |
|  |                                                                  |  [3] |
|  +------------------------------------------------------------------+  [ ] |
|  |  z:3 CONTROL BAR                                                 |      |
|  |  [Tier 1 ✓] [Tier 2 ✓] [Tier 3 ○]  Confidence >=[ 0.30 ▼]    |      |
|  |  [AIS ✓] [ADS-B ✓] [Radar ✓] [RF ✓] [OSINT ○]               |      |
|  +------------------------------------------------------------------+      |
|                                                                             |
+----[ ENTITY DETAIL ]-------------------------------------------------------+
|                                                                             |
|  Entity D — Vessel "PACIFIC VOYAGER"  MMSI: 211900042                      |
|  Status: ⚠ SPOOFING SUSPECTED (ICM score: 0.72, KCD score: 0.41)         |
|                                                                             |
|  Contributing Sources:                                                      |
|  +----------+----------+--------+-------+----------+                        |
|  | Source    | Position | Conf   | Trust | Status   |                        |
|  +----------+----------+--------+-------+----------+                        |
|  | AIS      | 33.74N   | 0.45   | 0.30  | ⚠ FLAG  |                        |
|  | Radar    | 34.01N   | 0.85   | 1.00  | ✓ Clean |                        |
|  | SAT-IMG  | 33.99N   | 0.90   | 1.00  | ✓ Clean |                        |
|  +----------+----------+--------+-------+----------+                        |
|                                                                             |
|  Confidence History:  ████████▅▅▃▃▂▁  (declining over 2 hours)           |
|  Detector Timeline:   KCD: ··●··●●·  ICM: ····●●●●  CSPV: ·····●●●      |
|                                                                             |
|  Assessment: AIS reports inconsistent with radar and satellite imagery.     |
|  AIS position 30km from consensus. Probable position spoofing.             |
|                                                                             |
|  [ Investigate ] [ Acknowledge ] [ Override ] [ Generate STIX ]            |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### 26.2 Alert Queue Panel

```
+--[ ALERT QUEUE ]-----------------------------------------------------------+
|                                                                             |
|  ▌ CRITICAL (1)                                                            |
|  │ 14:23:07  Identity Conflict: MMSI 211900042 at 2 locations             |
|  │           Locations: 33.74N 84.39W AND 34.01N 84.12W (30 km)          |
|  │           Detectors: ICM (0.95), CSPV (0.88)                          |
|  │           [ Investigate ] [ Ack ]                                      |
|  │                                                                         |
|  ▌ WARNING (2)                                                             |
|  │ 14:21:45  Confidence Drop: Entity E below 0.3 threshold               |
|  │           Previous: 0.67 → Current: 0.31 (in 12 minutes)             |
|  │           [ View ] [ Ack ]                                             |
|  │                                                                         |
|  │ 14:19:22  New Entity in Zone Alpha: Unknown vessel, AIS only          |
|  │           No cross-source verification yet. Single-source trust: 0.6   |
|  │           [ Monitor ] [ Ack ]                                          |
|  │                                                                         |
|  ▌ ADVISORY (shelved: 5)                                                   |
|  │ [Expand to view shelved advisories]                                     |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### 26.3 Fusion Tuning Panel

```
+--[ FUSION TUNING ]---(z:3 Overlay)----------------------------------------+
|                                                                             |
|  Active Scenario: Airfield/Harbor Monitoring  [Load ▼] [Save] [Reset]     |
|                                                                             |
|  ┌ CONFIDENCE THRESHOLD ──────────────────────────────────────────┐        |
|  │  Fusion minimum:  ├──────────●────────┤  0.65                 │        |
|  │  Alert threshold:  ├────●──────────────┤  0.30                │        |
|  │  Spoofing alert:   ├────────────●──────┤  0.50                │        |
|  └────────────────────────────────────────────────────────────────┘        |
|                                                                             |
|  ┌ PREDICATE WEIGHTS ────────────────────────────────────────────┐        |
|  │  Spatial:    ████████████████░░░░  0.35                       │        |
|  │  Temporal:   ████████████░░░░░░░░  0.25                       │        |
|  │  Spectral:   ████████░░░░░░░░░░░░  0.20                       │        |
|  │  Behavioral: ██████░░░░░░░░░░░░░░  0.15                       │        |
|  │  Semantic:   ██░░░░░░░░░░░░░░░░░░  0.05                       │        |
|  │                                                                │        |
|  │  [Normalize] [Maritime preset] [Airspace preset] [Cyber preset]│        |
|  └────────────────────────────────────────────────────────────────┘        |
|                                                                             |
|  ┌ ACTIVE JOIN PATHS (8 enabled / 12 configured) ────────────────┐        |
|  │  ✓ PAIR 1: ADS-B x ADS-B       Tier 1  C=1.00   12 joins/hr │        |
|  │  ✓ PAIR 2: ADS-B x FAA         Tier 1  C=1.00    8 joins/hr │        |
|  │  ✓ PAIR 3: ADS-B x AIS         Tier 2  C=0.72    4 joins/hr │        |
|  │  ✓ PAIR 4: ADS-B x RF Bearing  Tier 2  C=0.68    6 joins/hr │        |
|  │  ✓ PAIR 5: AIS x RF Bearing    Tier 2  C=0.71    5 joins/hr │        |
|  │  ✓ PAIR 6: HTTP x DNS          Tier 1  C=1.00  120 joins/hr │        |
|  │  ✓ PAIR 7: HTTP x OSINT        Tier 2  C=0.55    2 joins/hr │        |
|  │  ○ PAIR 8: * x * (Behavioral)  Tier 3  [DISABLED]            │        |
|  └────────────────────────────────────────────────────────────────┘        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 27. Alarm Priority Framework

### 27.1 Priority Levels

```
PRIORITY 1: CRITICAL (immediate action required)
  Color: Orange (#D55E00) + pulsing border
  Sound: Two-tone klaxon
  Persistence: Until acknowledged
  Auto-escalation: 2 minutes unacknowledged → supervisor notification
  Examples:
    - Confirmed spoofing on high-value entity
    - Fusion system integrity compromise
    - Identity conflict with >0.9 spoofing score
    - Simultaneous multi-entity spoofing (coordinated attack)

PRIORITY 2: WARNING (prompt attention needed)
  Color: Yellow (#F0E442) + solid border
  Sound: Single tone
  Persistence: 15 minutes or until acknowledged
  Auto-escalation: 10 minutes unacknowledged → elevate to P1
  Examples:
    - Probable spoofing (score 0.5-0.9)
    - Confidence drop crossing tier boundary
    - New unverified entity in sensitive area
    - Detector disagreement on monitored entity

PRIORITY 3: ADVISORY (awareness, no immediate action)
  Color: Blue (#56B4E9)
  Sound: Optional soft click
  Persistence: 30 minutes, then auto-archive
  Auto-escalation: None
  Examples:
    - Low-confidence spoofing indicator (score 0.3-0.5)
    - New join path activated
    - Source trust recovery notification
    - Routine confidence fluctuation

PRIORITY 4: INFORMATIONAL (log only)
  Color: Gray
  Sound: None
  Persistence: Log entry only
  Auto-escalation: None
  Examples:
    - New signal source ingested
    - Fingerprint enrollment
    - Configuration change applied
    - Periodic system health check
```

### 27.2 Escalation Rules

```
ESCALATION STATE MACHINE

  RAISED → NOTIFIED → ACKNOWLEDGED → INVESTIGATING → RESOLVED
    │          │           │              │              │
    │          │           │              │              └─ Archive
    │          │           │              └─ Re-raise if new evidence
    │          │           └─ Timer starts (varies by priority)
    │          └─ 2nd notification if unacknowledged
    └─ Initial notification

ESCALATION TIMERS:
  P1: 2 min unacknowledged → supervisor notification
      5 min unacknowledged → operations center notification
      15 min unresolved → auto-generate incident report

  P2: 10 min unacknowledged → elevate to P1
      30 min unresolved → supervisor notification

  P3: 30 min → auto-archive (no escalation)

  P4: immediate archive (no escalation)
```

### 27.3 Alert Aggregation

When multiple alerts concern the same root cause:

```
ALERT AGGREGATION RULES

Rule 1: Same entity, same detector, within 5 minutes
  → Merge into single alert with count badge
  → "Position anomaly on Entity D (x3 in 5 min)"

Rule 2: Same detector, multiple entities, same area, within 10 minutes
  → Create parent alert: "Area-wide spoofing event"
  → Child alerts linked but suppressed from main queue
  → "GPS spoofing zone detected: 4 entities affected in Sector Alpha"

Rule 3: Multiple detectors, same entity, within 2 minutes
  → Merge into compound alert with detector list
  → Elevate priority by 1 level (advisory → warning, warning → critical)
  → "Multi-detector anomaly on Entity D: KCD + ICM + CSPV"

Rule 4: Cascade detection (entity A spoofed → defusion → entity B recomputed)
  → Show root cause only in alert queue
  → Cascade effects shown in detail panel
  → "Spoofing on Entity D caused defusion of 3 join paths"
```

---

## 28. Tsingou 4-Layer Rendering Recommendations

Tsingou's z-layer stack maps directly to the attention hierarchy:

### 28.1 Layer-Attention Mapping

```
z:0  BASE CANVAS (Background Awareness)
  Attention level: Ambient / peripheral
  Content: Map tiles, terrain, political boundaries
  Spoofing: Known spoofing zones as subtle hatch overlay
  UX: Never competes for attention; always recedes

z:1  DATA LAYER (Active Monitoring)
  Attention level: Focused scanning
  Content: Entity tracks, positions, movement vectors
  Spoofing: Flagged entities get striped fill pattern
  Confidence: Encoded via color (Viridis scale) + opacity
  UX: Primary visual information layer; operator scans here
  Cognitive load: Supports L1 SA (perception)

z:2  ANNOTATION LAYER (Comprehension Support)
  Attention level: Selective attention
  Content: Correlation edges, fusion indicators, labels
  Spoofing: Detector result annotations, evidence chains
  Confidence: Edge thickness = join confidence
  UX: Appears contextually (hover, proximity zoom)
  Cognitive load: Supports L2 SA (comprehension)

z:3  CONTROL LAYER (Interaction + Detail)
  Attention level: Deliberate focus
  Content: Alert queue, fusion tuning, detail panels
  Spoofing: Full detector readout, STIX generation controls
  Confidence: Numeric values, breakdown charts, history
  UX: Operator-initiated; never auto-expands
  Cognitive load: Supports L2-L3 SA (comprehension + projection)
```

### 28.2 Per-Layer Rendering Rules

**z:0 Rules:**
- Maximum 3 visual variables: position, hue (muted), opacity
- Spoofing zones: 10% opacity diagonal hatch, updates on 5-min cycle
- No text below 14px (readability at arm's length)
- No animation (static background)

**z:1 Rules:**
- Maximum 5 visual variables: position, color, size, shape, pattern
- Entities: shape = class (circle=vessel, triangle=aircraft, square=vehicle)
- Confidence: color from Viridis scale
- Spoofing flag: diagonal stripe pattern (45 degrees, 4px pitch)
- Track history: trailing line, opacity decreasing with age
- Maximum 200 visible entities before auto-clustering activates
- Labels appear at zoom level 3+ (semantic zoom)
- Animation: smooth position interpolation (200ms transition)

**z:2 Rules:**
- Maximum 3 visual variables: line style, thickness, color
- Correlation edges: dashed line, thickness = confidence
- Merge edges: solid line, full opacity
- Spoofing edges: red dashed with warning icon at midpoint
- Labels: appear on hover only (reduce clutter)
- Maximum 50 visible edges before auto-simplification
- Animation: edge fade-in on creation (300ms)

**z:3 Rules:**
- Full UI panel with text, charts, controls
- Minimum font size: 12px (THE FLOOR)
- Alert badges: minimum 24x24px touch target
- Slider controls: minimum 200px wide for fine adjustment
- Confidence charts: sparkline height minimum 40px
- No transparency effects (panel is opaque backdrop)
- Animation: panel slide-in (200ms ease-out)

### 28.3 Rendering Priority During Overload

When entity density exceeds rendering capacity:

```
RENDERING PRIORITY ORDER

1. Entities with active P1/P2 alerts (always visible)
2. Entities with spoofing flags (always visible)
3. Entities currently selected/monitored by operator
4. Entities with confidence < alert threshold
5. High-activity entities (frequent position updates)
6. Entities in operator's current viewport center
7. Remaining entities by last-update recency

DECLUTTER THRESHOLDS:
  50 entities:  Show all, no clustering
  100 entities: Cluster at zoom level 1-2, show all at zoom 3+
  200 entities: Cluster at zoom level 1-3, show all at zoom 4+
  500 entities: Cluster at all zoom levels except tactical (zoom 4+)
  1000+ entities: Heatmap at overview, cluster at regional, show at tactical
```

---

# Part III: Synthesis

## 29. The Spoofing-Cognition Feedback Loop

The central thesis of this document is that spoofing detection and
cognitive load management are not independent problems — they form a
feedback loop:

```
NEGATIVE FEEDBACK LOOP (desired):

  Spoofing detected
    → Automated confidence downgrade
      → Fewer false fusion results reach operator
        → Reduced cognitive load
          → Better SA for remaining real signals
            → Operator catches more subtle anomalies
              → Better spoofing detection input

POSITIVE FEEDBACK LOOP (failure mode):

  Spoofing NOT detected
    → False data enters fusion pipeline
      → Bad fusion results increase clutter
        → Operator cognitive overload
          → Missed spoofing indicators
            → More false data enters pipeline
              → ESCALATING FAILURE

DESIGN GOAL:
  Maximize automated spoofing detection (detectors 1-4)
  to keep the operator in the NEGATIVE feedback loop.
  Only route ambiguous cases to human judgment.
```

### 29.1 Where Automation Meets Human Judgment

```
AUTOMATION BOUNDARY

FULLY AUTOMATED (no operator involvement):
  - Kinematic consistency checking (KCD)
  - Temporal pattern monitoring
  - RSSI anomaly flagging
  - Confidence computation and downgrade
  - Alert deduplication and aggregation
  - Trust level maintenance

ASSISTED (automated + operator confirmation):
  - Spoofing classification (error vs deception)
  - Identity conflict resolution
  - Fusion defusion decisions
  - STIX indicator generation

HUMAN ONLY (operator must decide):
  - Entity correlation interpretation ("what does co-location mean?")
  - Operational significance assessment
  - Escalation to external entities
  - Configuration changes to fusion parameters
  - Override of automated spoofing classification
```

---

## 30. Implementation Roadmap

### 30.1 Phase 1: Detection Foundation

| Item | Description | Priority |
|------|-------------|----------|
| KCD  | Kinematic Consistency Detector with Kalman filter | P0 |
| ICM  | Identity Consistency Monitor with track separation | P0 |
| Position jump | Velocity-based jump detection with entity-class thresholds | P0 |
| Temporal | Inter-arrival time monitoring per protocol | P1 |
| Confidence downgrade | Single-source and cascading downgrade formulas | P0 |
| Trust recovery | Per-source trust level with decay/recovery | P1 |

### 30.2 Phase 2: Cross-Source Verification

| Item | Description | Priority |
|------|-------------|----------|
| CSPV | Cross-Source Position Verifier with consensus computation | P0 |
| RSSI | Signal strength anomaly detection with path-loss model | P1 |
| Detector ensemble | Weighted combination of all active detectors | P0 |
| Decision tree | Error vs deception classification | P1 |
| STIX generation | Automated indicator creation for confirmed spoofing | P2 |

### 30.3 Phase 3: RF Authentication

| Item | Description | Priority |
|------|-------------|----------|
| RSA  | RF Signature Authenticator (requires SDR infrastructure) | P2 |
| Fingerprint DB | CFO/IQ/PA enrollment and matching database | P2 |
| TDOA multilateration | AIS/ADS-B position verification via receiver network | P2 |

### 30.4 Phase 4: Operator UX

| Item | Description | Priority |
|------|-------------|----------|
| Confidence color scale | Viridis-based with spoofing pattern overlay | P0 |
| Progressive disclosure | 5-level entity detail hierarchy | P0 |
| Semantic zoom | Density-appropriate information at each zoom level | P1 |
| Alert queue | Priority-based with aggregation and escalation | P0 |
| Audio alerts | Tiered sound design with ambient sonification option | P2 |
| Fusion tuning panel | Threshold sliders, weight adjustment, path toggles | P1 |
| Dashboard layout | Shneiderman-aligned with 4-layer rendering | P0 |

---

## 31. References

### Spoofing and Detection

- Sciancalepore, S., et al. "Detection of AIS Messages Falsifications and
  Spoofing by Checking Messages Compliance with TDMA Protocol." Digital
  Signal Processing, 2023.
- Balduzzi, M., et al. "AIS Data Vulnerability Indicated by a Spoofing
  Case-Study." Applied Sciences, 11(11), 2021.
- Kujur, B., et al. "Detecting GNSS Spoofing of ADS-B Equipped Aircraft
  Using INS." PLANS, 2020.
- CRFS. "ADS-B Spoofing Detection with 3D TDOA." Technical Blog, 2024.
- CRFS. "AIS Spoofing Detection with TDOA." Technical Blog, 2024.
- Aireon. "Countering GNSS Spoofing with Global ADS-B Network." 2025.
- u-blox. "Jamming and Spoofing Detection Performance at Jammertest 2025."
  Technical Blog, Andoya, Norway, 2025.
- Pole Star Global. "AIS Spoofing Research: 4 Main Typologies." 2024.
- Kpler. "AIS Spoofing: The Fast Track to Sanctions." November 2025.
- Global Fishing Watch. "Spoofing: One Identity Shared by Multiple Vessels."
  2023.
- Windward AI. "GPS Jamming is Now a Mainstream Maritime Threat." 2025.
- PMC. "Security of ADS-B and Remote ID Systems: Cyberattacks, Detection
  Techniques, and Countermeasures." 2025.
- Kreizis, et al. "Real-World Spoofing Detection and Characterization Using
  Low-Cost Receivers." Stanford GPS Lab, ION ITM, 2025.
- NIST. "Adversarial Machine Learning: A Taxonomy and Terminology."
  NIST AI 100-2e, 2025.
- MDPI. "Adversarial Evasion Attacks on SVM-Based GPS Spoofing Detection
  Systems." Sensors, 25(19), 2025.
- SeaSpoofFinder. "Potential GNSS Spoofing Event Detection Using AIS."
  arXiv:2602.16257, 2026.

### RF Fingerprinting

- MDPI. "Performance Evaluation of Carrier-Frequency Offset as a Radiometric
  Fingerprint in Time-Varying Channels." Sensors, 24(17), 2024.
- IEEE. "Carrier Frequency Offset in Internet-of-Things Radio Frequency
  Fingerprint Identification: An Experimental Review." 2023.
- arXiv. "Towards Robust RF Fingerprint Identification Using Spectral
  Regrowth and Carrier Frequency Offset." arXiv:2412.07269, 2024.

### Sensor Fusion and Trust

- arXiv. "Security-Aware Sensor Fusion with MATE: the Multi-Agent Trust
  Estimator." arXiv:2503.04954, 2025.
- arXiv. "Trust-Based Assured Sensor Fusion in Distributed Aerial Autonomy."
  arXiv:2507.17875, 2025.
- Shafer, G. "A Mathematical Theory of Evidence." Princeton, 1976.
- PMC. "Research on Improved Evidence Theory Based on Multi-Sensor
  Information Fusion." Scientific Reports, 2021.
- PMC. "Multisensor Data Fusion in IoT Environments in Dempster-Shafer
  Theory Setting." Sensors, 23(11), 2023.

### STIX and Threat Intelligence

- OASIS. "Introduction to STIX." CTI Documentation.
- OASIS. "STIX Version 2.1." 2021.
- Microsoft. "New STIX Objects in Microsoft Sentinel." April 2025.

### Cognitive Load and Situation Awareness

- Endsley, M.R. "Toward a Theory of Situation Awareness in Dynamic
  Systems." Human Factors, 37(1), 32-64, 1995.
- Endsley, M.R. "Situation Awareness Misconceptions and Misunderstandings."
  Journal of Cognitive Engineering and Decision Making, 9(1), 2015.
- Miller, G.A. "The Magical Number Seven, Plus or Minus Two." Psychological
  Review, 63(2), 81-97, 1956.
- Cowan, N. "The Magical Number 4 in Short-Term Memory." Behavioral and
  Brain Sciences, 24(1), 87-114, 2001.

### Information Visualization

- Shneiderman, B. "The Eyes Have It: A Task by Data Type Taxonomy for
  Information Visualizations." IEEE VL, 1996.
- Cockburn, A., et al. "A Review of Overview+Detail, Zooming, and
  Focus+Context Interfaces." ACM Computing Surveys, 2007.
- Recorded Future. "How to Use the Information-Seeking Mantra in Cyber
  Intelligence Dashboards." Blog.
- Furnas, G. "A Fisheye Follow-Up: Further Reflections on Focus+Context."
  CHI, 2006.
- Tufte, E. "The Visual Display of Quantitative Information." 1983.

### Alarm Management

- AHRQ PSNet. "Alert Fatigue." Patient Safety Primer, 2024.
- ISA. "ISA-18.2: Management of Alarm Systems for the Process Industries."
- IEC. "IEC 62682: Management of Alarm Systems for the Process Industries."
- Patientsafetyj. "Informing Healthcare Alarm Design and Use: A Human
  Factors Cross-Industry Perspective." 2023.

### Color and Accessibility

- Okabe, M. & Ito, K. "Color Universal Design (CUD) — How to Make Figures
  and Presentations Accessible to Colorblind Persons." 2008.
- van der Walt, S. & Smith, N. "Matplotlib Colormaps: Viridis." 2015.
- arXiv. "Accessible Color Sequences for Data Visualization."
  arXiv:2107.02270, 2021.
- Datylon. "The Best Charts for Color Blind Viewers." Blog.
- Tableau. "5 Tips on Designing Colorblind-Friendly Visualizations." Blog.

### Military C2 and Fusion Systems

- Collins Aerospace. "Distributed Common Ground System (DCGS)."
- DTIC. "Army DCGS-A Increment 1 Release 2." AD1007951.
- National Academies. "C4ISR for Future Naval Strike Groups." Chapter 4.
- AFCEA. "Lessons Learned Drive DCGS-A Forward." Signal Media.
- Systel USA. "Turning Sensor Chaos into Decision Dominance." Blog, 2025.

---

*End of TSGC-002*
