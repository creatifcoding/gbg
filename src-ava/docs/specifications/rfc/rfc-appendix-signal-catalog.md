# Appendix A — SignalKind Catalog

```
Section:       Appendix A — SignalKind Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
```

> This appendix provides the complete catalog of all 20 `SignalKind` variants
> defined in `ava-fusion/src/signal.rs`. Each variant represents a distinct data
> collection modality in the fusion ontology. Signal kinds determine valid join
> paths, NATS subject routing, and JetStream stream membership.

---

## Table of Contents

1. [Overview](#a1-overview)
2. [Kinetic Domain](#a2-kinetic-domain)
3. [RF/Signals Domain](#a3-rfsignals-domain)
4. [Cyber/Network Domain](#a4-cybernetwork-domain)
5. [OSINT/Social/Financial Domain](#a5-osintsocialfinancial-domain)
6. [GEOINT/HUMINT/MASINT Domain](#a6-geointhumintmasint-domain)
7. [Custom Domain](#a7-custom-domain)
8. [Data Type Classification](#a8-data-type-classification)

---

## A.1 Overview

The `SignalKind` enum (`ava-fusion/src/signal.rs:20-61`) defines 20 signal
source categories. Each variant is serialized as camelCase via
`#[serde(rename_all = "camelCase")]` and participates in the NATS subject
hierarchy as `sensor.{kind_lowercase}.{source}.{format}`
(see [AVA.3](rfc-section-nats-subject-taxonomy.md)).

All 20 variants are enumerated in `SignalKind::ALL`
(`ava-fusion/src/signal.rs:65-86`).

---

## A.2 Kinetic Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 1 | `AdsB` | ADS-B | `adsB` | Automatic Dependent Surveillance -- Broadcast; aircraft transponder positions | Seconds (1-2s) | `sensor.adsb.>` |
| 2 | `Ais` | AIS | `ais` | Automatic Identification System; maritime vessel transponder | Seconds (2-30s) | `sensor.ais.>` |
| 3 | `Radar` | Radar | `radar` | Primary/secondary radar returns | Seconds (4-12s rotation) | `sensor.radar.>` |
| 4 | `Satellite` | Satellite | `satellite` | Satellite imagery or overhead sensor data | Minutes to Hours | `sensor.satellite.>` |

**JetStream Stream**: `SENSOR_KINETIC` (retention: Limits, max age: 24h).
See [AVA.3.7](rfc-section-nats-subject-taxonomy.md#ava37-jetstream-stream-mapping).

---

## A.3 RF/Signals Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 5 | `RfBearing` | RF Bearing | `rfBearing` | RF direction-finding bearing measurement | Seconds | `sensor.rfbearing.>` |
| 6 | `Sdr` | SDR | `sdr` | Software-defined radio raw signal capture (IQ samples) | Seconds (continuous) | `sensor.sdr.>` |
| 7 | `Sigint` | SIGINT | `sigint` | Signals intelligence (general) | Minutes to Hours | `sensor.sigint.>` |
| 8 | `Elint` | ELINT | `elint` | Electronic intelligence; radar/nav signal characterization | Minutes | `sensor.elint.>` |
| 9 | `Comint` | COMINT | `comint` | Communications intelligence; intercepted comms metadata | Minutes | `sensor.comint.>` |

**JetStream Stream**: `SENSOR_RF` (retention: Limits, max age: 24h).
RF signal subjects carrying IQ sample references use the NATS Object Store
for actual sample data, with subject messages containing only metadata and
an object store reference key.

---

## A.4 Cyber/Network Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 10 | `Http` | HTTP | `http` | HTTP/HTTPS request/response metadata and payloads | Seconds (continuous) | `sensor.http.>` |
| 11 | `Dns` | DNS | `dns` | DNS query/response records | Seconds (continuous) | `sensor.dns.>` |
| 12 | `Cyber` | Cyber | `cyber` | Cyber threat indicators (STIX CTI, IOCs, malware analysis) | Minutes to Daily | `sensor.cyber.>` |

**JetStream Stream**: `SENSOR_CYBER` (retention: Limits, max age: 72h).
STIX 2.1 bundles use format token `stix`; non-STIX threat feeds use `json`.

---

## A.5 OSINT/Social/Financial Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 13 | `Osint` | OSINT | `osint` | Open-source intelligence (RSS, news, public records) | Minutes to Hourly | `sensor.osint.>` |
| 14 | `Social` | Social | `social` | Social media-derived signals (handles, posts, network graphs) | Seconds to Minutes | `sensor.social.>` |
| 15 | `Financial` | Financial | `financial` | Financial transaction and sanctions data | Daily to Hourly | `sensor.financial.>` |
| 16 | `Travel` | Travel | `travel` | Travel records (passenger manifests, border crossings) | Daily | `sensor.travel.>` |

**JetStream Stream**: `SENSOR_OSINT` (retention: Limits, max age: 72h).

---

## A.6 GEOINT/HUMINT/MASINT Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 17 | `Geoint` | GEOINT | `geoint` | Geospatial intelligence (imagery analysis products) | Hourly to Daily | `sensor.geoint.>` |
| 18 | `Humint` | HUMINT | `humint` | Human intelligence reports | Daily (aperiodic) | `sensor.humint.>` |
| 19 | `Masint` | MASINT | `masint` | Measurement and signature intelligence | Minutes to Hourly | `sensor.masint.>` |

**JetStream Stream**: `SENSOR_GEO` (retention: Limits, max age: 168h).

---

## A.7 Custom Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 20 | `Custom` | Custom | `custom` | Operator-defined custom signal kind | Varies | `sensor.custom.>` |

Custom signals follow the same 4-token `sensor.{kind}.{source}.{format}` pattern.
The `source` token identifies the operator or system that produces the data.

---

## A.8 Data Type Classification

Each signal source is classified as either `Event` (volatile, append-only,
timestamped) or `Reference` (stable, slowly-changing, lookup-keyed) per the
`DataType` enum (`ava-fusion/src/signal.rs:128-133`). This distinction
determines the differential-dataflow join strategy: event sources produce
differential streams while reference sources are materialized as arrangements
providing O(1) lookups per incoming event.

| DataType | Serde Key | Behavior | Example Kinds |
|----------|-----------|----------|---------------|
| `Event` | `event` | Volatile event stream (differential stream) | AdsB, Ais, Http, Dns, Social |
| `Reference` | `reference` | Stable reference/registry data (materialized arrangement) | Cyber (STIX feeds), Financial (OFAC), Geoint (static layers) |

The `UpdateRate` enum (`ava-fusion/src/signal.rs:152-163`) specifies reference
data refresh cadence:

| UpdateRate | Serde Key | Description |
|-----------|-----------|-------------|
| `Static` | `static` | Never changes after initial load |
| `Daily` | `daily` | Refreshed approximately once per day |
| `Hourly` | `hourly` | Refreshed approximately once per hour |
| `Minutes` | `minutes` | Refreshed every few minutes |
| `Seconds` | `seconds` | Refreshed every few seconds (high-rate reference stream) |

---

*Source: `ava-fusion/src/signal.rs` (337 lines). All variant names, serde keys,
and display strings extracted from source code.*

*End of Appendix A*
