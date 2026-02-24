# AVA.DS.8: E2E Test Harness Specification

```
Section:       AVA.DS.8 — E2E Test Harness Specification
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Integration Specification (Normative)
Prerequisites: AVA.DS.6 (NATS Taxonomy), AVA.DS.7 (Cross-Correlation Matrix)
```

> This section specifies the end-to-end test harness for the ava-fusion pipeline.
> It defines synthetic data generators for all 20 SignalKinds, a JetStream-based
> replay harness with virtual time, validation criteria for latency/completeness/
> correctness, and a suite of test scenarios covering single-domain, cross-domain,
> burst-load, and late-arrival conditions. The key words "MUST", "SHOULD", and
> "MAY" are interpreted as described in [RFC2119].

---

## Table of Contents

1. [Overview](#avads81-overview)
2. [Synthetic Data Generator Specification](#avads82-synthetic-data-generator-specification)
3. [Replay Harness](#avads83-replay-harness)
4. [Validation Criteria](#avads84-validation-criteria)
5. [Test Scenarios](#avads85-test-scenarios)
6. [Coverage Matrix](#avads86-coverage-matrix)
7. [Spike Script Specification](#avads87-spike-script-specification)

---

## AVA.DS.8.1 Overview

The test harness serves three purposes:

1. **Infrastructure validation**: Verify that NATS JetStream streams, KV buckets,
   and Object Store buckets are correctly provisioned and accessible.
2. **Pipeline smoke testing**: Publish synthetic messages through all 20 SignalKind
   subjects and verify end-to-end flow from ingest to fusion output.
3. **Regression testing**: Replay recorded scenarios to validate fusion correctness
   after code changes.

### Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│  Synthetic Generator    │     │  NATS Server          │
│                         │     │                       │
│  Per-SignalKind factory  │────▶│  JetStream Streams    │
│  Configurable rate       │     │  KV Buckets           │
│  Anomaly injection       │     │  Object Store         │
│  Virtual time clock      │     │                       │
└─────────────────────────┘     └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │  Fusion Pipeline      │
                                │  (System Under Test)  │
                                └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │  Validation Harness   │
                                │                       │
                                │  Subscribe fusion.>   │
                                │  Check latency        │
                                │  Check completeness   │
                                │  Check correctness    │
                                │  Report pass/fail     │
                                └──────────────────────┘
```

---

## AVA.DS.8.2 Synthetic Data Generator Specification

Each SignalKind has a dedicated generator. All generators share a common
interface:

```typescript
interface SyntheticGenerator {
  signalKind: string;
  subject: string;              // NATS subject to publish to
  ratePerSecond: number;        // Messages per second
  durationSeconds: number;      // Total generation time
  anomalyRate: number;          // Fraction of anomalous messages (0.0-1.0)
  seed: number;                 // PRNG seed for reproducibility
  generate(): AsyncIterable<{ subject: string; payload: Uint8Array }>;
}
```

### AVA.DS.8.2.1 Kinetic Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `AdsB` | `sensor.adsb.synthetic.json` | BaseSignal (ADS-B) | 10-100/s | Parametric trajectory (great-circle route, climb/cruise/descent phases) | Spoofed positions, transponder gaps, ghost tracks | DS.1.2.6 |
| `Ais` | `sensor.ais.synthetic.json` | BaseSignal (AIS) | 5-50/s | Shipping lane simulation (port-to-port routes, vessel-type-dependent speed) | AIS dark periods, spoofed positions, MMSI changes | DS.1.3.6 |
| `Radar` | `sensor.radar.synthetic.json` | BaseSignal (Radar) | 5-20/s | Parametric track (radar site coverage area, scan-rate-dependent updates) | Clutter tracks, split tracks, ghost returns | DS.1.4.6 |
| `Satellite` | `sensor.satellite.synthetic.json` | BaseSignal (Satellite) | 0.1-1/s | Observation events (simulated overpass schedule, random AOI targets) | Cloud obscuration, temporal gaps, off-nadir angles | DS.1.5.6 |

**Key parameters (all kinetic generators)**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `entityCount` | int | 50 | Number of simultaneous tracked entities |
| `areaOfInterest` | GeoJSON | US CONUS | Geographic bounding polygon |
| `noiseLevel` | enum | `medium` | Position noise: low (10m), medium (50m), high (200m) |
| `anomalyRate` | float | 0.05 | Fraction of messages with injected anomalies |

### AVA.DS.8.2.2 RF/Signals Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `RfBearing` | `sensor.rfbearing.synthetic.json` | RfBearingMeasurement | 1-10/s | Correlated emitter observations from 3-8 sensor network | Multipath, interference, false bearings | DS.2.2.6 |
| `Sdr` | `sensor.sdr.synthetic.sigmf` | SdrCapture (SigMF meta) | 0.01-0.1/s | AWGN base + 1-5 injected signals (tone, AM, FM, digital) | IQ imbalance, phase noise, frequency drift | DS.2.3.6 |
| `Sigint` | `sensor.sigint.synthetic.json` | SigintFrequencyRecord | Bulk (1000+) | FCC ULS-style records, band-weighted frequencies | Expired licenses, duplicate callsigns | DS.2.4.6 |
| `Elint` | `sensor.elint.synthetic.json` | ElintEmitterRecord | 0.5-5/s | Emitter library (100-500 entries) + time-series observations | Agile emitters (freq hop, PRI stagger) | DS.2.5.6 |
| `Comint` | `sensor.comint.synthetic.json` | ComintInterceptMetadata | 0.5-5/s | Network-based temporal correlation (call-response patterns) | Encrypted bursts, jamming, frequency changes | DS.2.6.6 |

### AVA.DS.8.2.3 Cyber/Network Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Http` | `sensor.http.synthetic.json` | Zeek http.log JSON | 50-500/s | Markov chain session model (80% benign, 20% suspicious) | DDoS, port scans, brute force, known malware UA | DS.3.2.6 |
| `Dns` | `sensor.dns.synthetic.json` | Zeek dns.log JSON | 50-500/s | Replay pattern (70% Tranco, 15% DGA, 10% known-bad, 5% typosquat) | Fast-flux (low TTL), NXDOMAIN floods | DS.3.3.6 |
| `Cyber` | `sensor.cyber.synthetic.stix` | STIX 2.1 Bundle | 0.1-1/s | Scenario-based (campaign + 10-30 indicators + relationships) | Expired indicators, conflicting IOCs | DS.3.4.6 |

### AVA.DS.8.2.4 OSINT/Social/Financial/Travel Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Osint` | `sensor.osint.gdelt.events` | OsintSignal | 1-10/s | Template-based (theme taxonomy, census names, country-weighted geo) | — | DS.4.2.6 |
| `Social` | `sensor.social.mastodon.json` | SocialSignal | 5-50/s | Mock ActivityPub posts (Mastodon-style, Poisson engagement) | — | DS.4.3.6 |
| `Financial` | `sensor.financial.ofac.json` | FinancialSignal | Bulk (1000+) | OFAC SDN-style records (random names, programs, identifiers) | — | DS.4.4.6 |
| `Travel` | `sensor.travel.synthetic.json` | TravelSignal | 0.5-5/s | Parametric PNR (OpenFlights routes, census names, configurable anomaly rate) | Last-minute booking, one-way, cash payment, SDN match | DS.4.5.6 |

### AVA.DS.8.2.5 GEOINT/HUMINT/MASINT Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Geoint` | `sensor.geoint.firms.json` | FirmsHotspot | 0.1-1/s | Parametric clusters around facility coordinates | — | DS.5.2.6 |
| `Humint` | `sensor.humint.acled.json` | AcledEvent | 0.5-5/s | Parametric (conflict zone clusters, Poisson process) | — | DS.5.3.6 |
| `Masint` | `sensor.masint.usgs.seismic` | UsgsEarthquakeEvent | 0.1-1/s | Gutenberg-Richter distribution along fault lines | — | DS.5.4.6 |

---

## AVA.DS.8.3 Replay Harness

The replay harness publishes pre-recorded or generated message sequences to
JetStream with controlled timing.

### AVA.DS.8.3.1 Replay Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Real-time** | Publish at original inter-message intervals | Production-like load testing |
| **Compressed** | Publish N times faster than real-time | Rapid regression testing |
| **Burst** | Publish all messages as fast as possible | Throughput/backpressure testing |
| **Virtual time** | Publish with synthetic timestamps, no wall-clock delay | Deterministic unit testing |

### AVA.DS.8.3.2 Replay Configuration

```typescript
interface ReplayConfig {
  mode: 'realtime' | 'compressed' | 'burst' | 'virtual';
  compressionFactor?: number;    // For 'compressed' mode (default: 10x)
  sourceFile?: string;           // Path to recorded message sequence
  generators?: GeneratorConfig[]; // In-memory synthetic generators
  maxMessages?: number;          // Cap total messages (default: unlimited)
  virtualTimeStart?: string;     // ISO 8601 start time for virtual mode
  virtualTimeStep?: number;      // Milliseconds per message in virtual mode
}
```

### AVA.DS.8.3.3 Message Recording Format

Recorded sequences use NDJSON (newline-delimited JSON):

```json
{"t":1708432456789,"s":"sensor.adsb.opensky.json","h":{"Nats-Msg-Id":"adsb-001"},"p":"base64..."}
{"t":1708432457123,"s":"sensor.ais.noaa.csv","h":{},"p":"base64..."}
```

| Field | Description |
|-------|-------------|
| `t` | Timestamp (Unix epoch milliseconds) |
| `s` | NATS subject |
| `h` | NATS headers (object) |
| `p` | Base64-encoded payload |

---

## AVA.DS.8.4 Validation Criteria

### AVA.DS.8.4.1 Latency

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Ingest latency** | < 100ms (p99) | Time from NATS publish to SensorIngestor ack |
| **Fusion latency** | < 500ms (p99) | Time from ingest to fusion result publication |
| **Alarm latency** | < 1000ms (p99) | Time from triggering event to alarm publication |
| **End-to-end** | < 2000ms (p99) | Time from source publish to fusion output available |

### AVA.DS.8.4.2 Completeness

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Message delivery** | 100% (zero loss) | Published count = stream message count |
| **Entity coverage** | >= 95% | Entities in synthetic data that appear in fusion output |
| **SignalKind coverage** | 20/20 | All signal kinds have at least one message processed |
| **Stream coverage** | 7/7 | All JetStream streams receive expected messages |

### AVA.DS.8.4.3 Correctness

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Tier 1 precision** | >= 0.99 | True positive rate for hard-key correlations |
| **Tier 1 recall** | >= 0.99 | All hard-key matches found |
| **Tier 2 precision** | >= 0.90 | True positive rate for spatial-temporal correlations |
| **Tier 2 recall** | >= 0.85 | Most spatial-temporal matches found |
| **Entity resolution accuracy** | >= 0.95 | Correct entity assignment for known test entities |
| **Anomaly detection rate** | >= 0.80 | Injected anomalies flagged by pipeline |
| **False positive rate** | <= 0.05 | Non-anomalous messages incorrectly flagged |

---

## AVA.DS.8.5 Test Scenarios

### AVA.DS.8.5.1 Single-Domain Scenarios

| ID | Scenario | SignalKind | Messages | Duration | Validates |
|----|----------|-----------|----------|----------|-----------|
| SD-1 | ADS-B multi-source dedup | AdsB (x3 sources) | 1000 | 60s | Tier 1 identity join, dedup |
| SD-2 | AIS shipping lane track | Ais | 500 | 120s | Track lifecycle (create/update/drop) |
| SD-3 | Radar coverage correlation | Radar | 300 | 60s | Spatial indexing, scan-rate processing |
| SD-4 | HTTP+DNS flow correlation | Http, Dns | 2000 | 30s | Tier 1 key join, temporal sequencing |
| SD-5 | STIX IOC matching | Cyber, Http, Dns | 500 | 30s | Pattern parsing, IOC match, flag generation |
| SD-6 | RF bearing triangulation | RfBearing (3 sensors) | 300 | 60s | Multilateration, emitter geolocation |
| SD-7 | OFAC sanctions screening | Financial, Ais | 200 | 30s | Tier 1 MMSI/name match, flag generation |
| SD-8 | ACLED conflict event ingest | Humint | 100 | 30s | Event dedup (Nats-Msg-Id), entity extraction |
| SD-9 | Seismic event processing | Masint | 50 | 30s | GeoJSON parsing, H3 spatial index |
| SD-10 | Social media normalization | Social (Mastodon) | 500 | 30s | Handle extraction, URL parsing |

### AVA.DS.8.5.2 Cross-Domain Scenarios

| ID | Scenario | SignalKinds | Messages | Duration | Validates |
|----|----------|------------|----------|----------|-----------|
| CD-1 | Air track fusion | AdsB, Radar, RfBearing | 2000 | 120s | Tier 1 (ICAO) + Tier 2 (spatial) fusion |
| CD-2 | Maritime surveillance | Ais, Radar, Satellite | 1500 | 120s | Multi-sensor vessel tracking |
| CD-3 | Cyber-kinetic correlation | Cyber, Http, AdsB | 1000 | 60s | Campaign IOC → network flow → aircraft track |
| CD-4 | Sanctioned entity tracking | Financial, AdsB, Ais | 500 | 60s | OFAC aircraft/vessel live tracking |
| CD-5 | OSINT enrichment chain | Osint, Financial, Ais | 300 | 60s | News → sanctions match → vessel track |
| CD-6 | RF spectrum fusion | Sdr, RfBearing, Sigint, Elint | 500 | 60s | Frequency correlation, emitter resolution |
| CD-7 | Environmental context | Masint, Geoint, Humint | 200 | 60s | Spatial correlation, contextual enrichment |
| CD-8 | Travel watchlist | Travel, Financial, AdsB | 300 | 60s | PNR screening → OFAC match → flight tracking |

### AVA.DS.8.5.3 Stress Scenarios

| ID | Scenario | Description | Messages | Duration | Validates |
|----|----------|-------------|----------|----------|-----------|
| ST-1 | Burst load | All 20 SignalKinds at max rate simultaneously | 50000 | 30s | Backpressure, no message loss |
| ST-2 | Sustained load | 10 SignalKinds at production rate for extended period | 100000 | 600s | Memory stability, no degradation |
| ST-3 | Late arrival | Messages published 30-120s after their timestamps | 1000 | 120s | Late arrival policy, window extension |
| ST-4 | Out-of-order | Messages published in random timestamp order | 1000 | 60s | Reordering, correct temporal joins |
| ST-5 | Duplicate messages | Same Nats-Msg-Id published 3x per message | 1000 | 30s | Deduplication, exactly-once processing |
| ST-6 | Schema evolution | Mix of v1 and v2 payload schemas | 500 | 30s | Forward compatibility, graceful degradation |

---

## AVA.DS.8.6 Coverage Matrix

This matrix shows which test scenarios exercise which fusion tiers and infrastructure:

| Scenario | Tier 1 | Tier 2 | Tier 3 | JetStream | KV | ObjectStore | Alarms |
|----------|--------|--------|--------|-----------|------|-------------|--------|
| SD-1 | X | | | SENSOR_KINETIC | | | |
| SD-2 | | | | SENSOR_KINETIC | ava-state | | |
| SD-3 | | X | | SENSOR_KINETIC | | | |
| SD-4 | X | | | SENSOR_CYBER | | | |
| SD-5 | X | | | SENSOR_CYBER | | | X |
| SD-6 | X | X | | SENSOR_RF | | | |
| SD-7 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| SD-8 | | | | SENSOR_GEO | | | |
| SD-9 | | X | | SENSOR_GEO | | | |
| SD-10 | | | | SENSOR_OSINT | | | |
| CD-1 | X | X | | SENSOR_KINETIC, SENSOR_RF | | | |
| CD-2 | | X | | SENSOR_KINETIC | | ava-blobs | |
| CD-3 | X | | X | SENSOR_CYBER, SENSOR_KINETIC | | | X |
| CD-4 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| CD-5 | | X | X | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | |
| CD-6 | X | X | | SENSOR_RF | ava-ref-sigint, ava-ref-elint | ava-iq-samples | |
| CD-7 | | X | | SENSOR_GEO | | ava-geoint-raster | |
| CD-8 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| ST-1 | X | X | | ALL | ALL | ALL | X |
| ST-2 | X | X | | SENSOR_KINETIC, SENSOR_CYBER | ava-state | | |
| ST-3 | | X | | SENSOR_KINETIC | | | |
| ST-4 | X | X | | SENSOR_KINETIC | | | |
| ST-5 | X | | | SENSOR_GEO | | | |
| ST-6 | X | | | SENSOR_KINETIC | | | |

**Coverage summary**:
- Tier 1: 15/24 scenarios (63%)
- Tier 2: 13/24 scenarios (54%)
- Tier 3: 2/24 scenarios (8%)
- JetStream: All 7 streams covered
- KV: 4 buckets covered
- Object Store: 3 buckets covered
- Alarms: 6/24 scenarios (25%)

---

## AVA.DS.8.7 Spike Script Specification

The E2E spike script (`scripts/spike-nats-e2e.ts`) provides a minimal but
comprehensive infrastructure validation. It is the first executable test
artifact and validates that the NATS infrastructure provisioned by
[AVA.DS.6](rfc-section-ds-nats-taxonomy.md) is operational.

### AVA.DS.8.7.1 Test Sequence

1. **Connect** to NATS at `localhost:4222` with token auth
2. **Verify streams** -- all 7 JetStream streams exist with correct subject filters
3. **Verify KV buckets** -- all 4 KV buckets (`ava-config`, `ava-state`, `ava-metrics`, `ava-schemas`) exist
4. **Verify Object Store** -- `ava-blobs` bucket exists
5. **Publish test messages** -- 1 synthetic JSON message per SignalKind (20 total)
6. **Verify stream counts** -- each stream has the expected message count
7. **KV round-trip** -- put `entity.test001` -> get -> verify -> delete -> verify tombstone
8. **Object Store round-trip** -- put 1MB blob -> get -> verify SHA-256 -> delete
9. **Wildcard subscription** -- subscribe `sensor.adsb.>` -> publish -> receive -> verify
10. **Print summary** -- pass/fail per step with timing

### AVA.DS.8.7.2 Expected Stream Message Counts

| Stream | Expected Count | SignalKinds |
|--------|---------------|-------------|
| `SENSOR_KINETIC` | 4 | AdsB, Ais, Radar, Satellite |
| `SENSOR_RF` | 5 | RfBearing, Sdr, Sigint, Elint, Comint |
| `SENSOR_CYBER` | 3 | Http, Dns, Cyber |
| `SENSOR_OSINT` | 4 | Osint, Social, Financial, Travel |
| `SENSOR_GEO` | 3 | Geoint, Humint, Masint |
| `FUSION_RESULTS` | 0 | (no fusion in spike) |
| `ALARMS` | 0 | (no alarms in spike) |

**Note**: The Custom SignalKind message (`sensor.custom.operator.json`) is NOT
captured by any default stream. The spike script verifies this by publishing
the message and confirming no stream count increments -- validating AVA.3-R5
(no overlapping subjects, custom requires explicit stream).

---

*End of Section AVA.DS.8*
