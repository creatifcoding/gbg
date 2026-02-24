# RFC Section Format — Data Source Specifications

> **Convention**: Each data-source domain file doubles as an RFC section
> for assembly into `AVA-RFC-001: Sensor Data Integration Specification`.
>
> **Assembly**: `bun run scripts/assemble-rfc.ts` (to be created, modeled
> on `packages/tmnl/scripts/assemble-rfc.ts` from tsingou RFC-002).

---

## File Naming Convention

```
rfc-section-ds-{domain}.md
```

| File | Section ID | Title |
|------|-----------|-------|
| `rfc-section-ds-kinetic.md` | AVA.DS.1 | Kinetic Domain Data Sources |
| `rfc-section-ds-rf-signals.md` | AVA.DS.2 | RF/Signals Domain Data Sources |
| `rfc-section-ds-cyber-network.md` | AVA.DS.3 | Cyber/Network Domain Data Sources |
| `rfc-section-ds-osint-social-financial.md` | AVA.DS.4 | OSINT/Social/Financial Domain Data Sources |
| `rfc-section-ds-geoint-humint-masint.md` | AVA.DS.5 | GEOINT/HUMINT/MASINT Domain Data Sources |
| `rfc-section-ds-nats-taxonomy.md` | AVA.DS.6 | NATS Subject Taxonomy (Normative) |
| `rfc-section-ds-cross-correlation.md` | AVA.DS.7 | Cross-Domain Correlation Matrix |
| `rfc-section-ds-test-harness.md` | AVA.DS.8 | E2E Test Harness Specification |

---

## Required Section Structure

Each `rfc-section-ds-*.md` MUST follow this structure:

```markdown
# AVA.DS.N: Section Title

## AVA.DS.N.1 Overview

Brief description of the domain and its signal kinds.

## AVA.DS.N.2 Signal Kind: {Name}

### AVA.DS.N.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| ... | ... | ... | ... | ... | ... | ... | ... |

### AVA.DS.N.2.2 NATS Subject Taxonomy

Subject hierarchy for this signal kind. Uses dots as separators.
Follows the pattern:

```
sensor.{domain}.{source}.{format}
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.adsb.opensky.raw` | JSON | Raw OpenSky state vector |
| `sensor.adsb.opensky.parsed` | Protobuf | Parsed BaseSignal |

### AVA.DS.N.2.3 Payload Schema

JSON Schema or serde struct for the canonical payload format.

### AVA.DS.N.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|--------------------|---------|
| `icao24` | Aircraft | IcaoHex | `a12345` |

### AVA.DS.N.2.5 Cross-Correlation Targets

Which other SignalKinds this data can be joined with, and the join type.

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Radar | Spatial+Temporal | H3 cell + time bucket | Tier 2 |

### AVA.DS.N.2.6 Synthetic Data Generation

If no free API exists, describe:
- Schema for synthetic records
- Realistic value ranges
- Generation strategy (random, replay, parametric)

## AVA.DS.N.3 Signal Kind: {Next Name}

[Repeat structure]

---

*End of Section AVA.DS.N*
```

---

## NATS Subject Taxonomy (Normative — AVA.DS.6)

The assembled taxonomy follows a strict hierarchy:

```
Level 1: sensor                     # All ingest data
Level 2: sensor.{signal_kind}       # Signal kind (lowercase snake_case of SignalKind enum)
Level 3: sensor.{kind}.{source}     # Data source name
Level 4: sensor.{kind}.{source}.{stage}  # Processing stage

Stages:
  .raw      — Unprocessed bytes/JSON from source
  .parsed   — Deserialized into BaseSignal schema
  .enriched — With geospatial/temporal enrichments applied

Output subjects:
  fusion.results.{tier}    — Fusion results by tier
  fusion.alarms.{severity} — Alarm notifications
  fusion.tracks.{class}    — Track state changes by entity class
  fusion.absence.{kind}    — Absence detection events
```

### SignalKind → NATS Subject Mapping

| SignalKind | NATS Level 2 | Example Full Subject |
|------------|-------------|---------------------|
| `AdsB` | `sensor.adsb` | `sensor.adsb.opensky.raw` |
| `Ais` | `sensor.ais` | `sensor.ais.noaa.raw` |
| `Radar` | `sensor.radar` | `sensor.radar.swim.tracks` |
| `RfBearing` | `sensor.rf_bearing` | `sensor.rf_bearing.synthetic.raw` |
| `Sdr` | `sensor.sdr` | `sensor.sdr.sigmf.iq` |
| `Http` | `sensor.http` | `sensor.http.zeek.raw` |
| `Dns` | `sensor.dns` | `sensor.dns.passive.raw` |
| `Satellite` | `sensor.satellite` | `sensor.satellite.sentinel.imagery` |
| `Geoint` | `sensor.geoint` | `sensor.geoint.osm.features` |
| `Humint` | `sensor.humint` | `sensor.humint.acled.events` |
| `Sigint` | `sensor.sigint` | `sensor.sigint.intercept.raw` |
| `Elint` | `sensor.elint` | `sensor.elint.emitter.raw` |
| `Comint` | `sensor.comint` | `sensor.comint.intercept.raw` |
| `Osint` | `sensor.osint` | `sensor.osint.gdelt.events` |
| `Masint` | `sensor.masint` | `sensor.masint.usgs.seismic` |
| `Cyber` | `sensor.cyber` | `sensor.cyber.stix.indicators` |
| `Social` | `sensor.social` | `sensor.social.mastodon.public` |
| `Financial` | `sensor.financial` | `sensor.financial.ofac.sdn` |
| `Travel` | `sensor.travel` | `sensor.travel.synthetic.pnr` |
| `Custom` | `sensor.custom.{name}` | `sensor.custom.operator.raw` |

### JetStream Configuration

| Stream | Subjects | Retention | Max Age | Storage |
|--------|----------|-----------|---------|---------|
| `SENSOR_INGEST` | `sensor.>` | Limits | 24h | File |
| `FUSION_RESULTS` | `fusion.>` | Limits | 7d | File |
| `SENSOR_ADSB` | `sensor.adsb.>` | WorkQueue | 1h | Memory |
| `SENSOR_AIS` | `sensor.ais.>` | WorkQueue | 1h | Memory |
| `SENSOR_CYBER` | `sensor.cyber.>` | Limits | 24h | File |

### KV Buckets

| Bucket | Key Pattern | Purpose |
|--------|-------------|---------|
| `entity-latest` | `{class}.{id}` | Latest fused state per entity |
| `track-state` | `{track_id}` | Current track lifecycle state |
| `alarm-active` | `{alarm_id}` | Active alarm records |
| `source-health` | `{signal_kind}.{source}` | Data source liveness |

---

## Assembly Manifest

```typescript
const SECTIONS: SectionEntry[] = [
  // --- PART I: DATA SOURCE CATALOG ---
  { id: "AVA.DS.1", title: "Kinetic Domain Data Sources",
    file: "rfc-section-ds-kinetic.md",
    part: "PART I: DATA SOURCE CATALOG" },
  { id: "AVA.DS.2", title: "RF/Signals Domain Data Sources",
    file: "rfc-section-ds-rf-signals.md" },
  { id: "AVA.DS.3", title: "Cyber/Network Domain Data Sources",
    file: "rfc-section-ds-cyber-network.md" },
  { id: "AVA.DS.4", title: "OSINT/Social/Financial Domain Data Sources",
    file: "rfc-section-ds-osint-social-financial.md" },
  { id: "AVA.DS.5", title: "GEOINT/HUMINT/MASINT Domain Data Sources",
    file: "rfc-section-ds-geoint-humint-masint.md" },

  // --- PART II: INTEGRATION SPECIFICATION (Normative) ---
  { id: "AVA.DS.6", title: "NATS Subject Taxonomy",
    file: "rfc-section-ds-nats-taxonomy.md",
    part: "PART II: INTEGRATION SPECIFICATION (Normative)" },
  { id: "AVA.DS.7", title: "Cross-Domain Correlation Matrix",
    file: "rfc-section-ds-cross-correlation.md" },
  { id: "AVA.DS.8", title: "E2E Test Harness Specification",
    file: "rfc-section-ds-test-harness.md" },
];
```
