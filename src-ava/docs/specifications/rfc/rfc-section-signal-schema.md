# AVA.2 Signal Schema

```
Section:       AVA.2 — Signal Schema
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.1 (Pipeline Architecture)
Feeds:         AVA.3 (NATS Subject Taxonomy), AVA.4 (Source Adapters)
```

> This section specifies the signal classification schema for the ava-fusion
> pipeline. It defines the 20 `SignalKind` variants, 10 `EntityClass` variants,
> the `DataType` event/reference duality, `ReferenceSource` registration, and
> the `EntityClassDef` mapping that connects entity classes to their observable
> signal kinds. These types form the semantic foundation for NATS subject
> routing, join path validation, and source adapter contracts. The key words
> "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
> "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are
> to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava21-conventions-and-terminology)
2.  [SignalKind Enumeration](#ava22-signalkind-enumeration)
3.  [EntityClass Enumeration](#ava23-entityclass-enumeration)
4.  [IdentifierNamespace Enumeration](#ava24-identifiernamespace-enumeration)
5.  [DataType Duality](#ava25-datatype-duality)
6.  [UpdateRate Cadence](#ava26-updaterate-cadence)
7.  [ReferenceSource Registration](#ava27-referencesource-registration)
8.  [EntityClassDef Mapping](#ava28-entityclassdef-mapping)
9.  [Signal-Entity Observable Matrix](#ava29-signal-entity-observable-matrix)
10. [Normative Requirements Summary](#ava210-normative-requirements-summary)
11. [References](#ava211-references)

---

## AVA.2.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.2.1.1 Terminology

| Term | Definition |
|------|-----------|
| **SignalKind** | One of 20 sensor type discriminators. Determines NATS subject routing and valid join paths. Source: `ava-fusion/src/signal.rs`. |
| **EntityClass** | One of 10 entity types tracked by the fusion system. Source: `ava-fusion/src/entity.rs`. |
| **DataType** | Binary classification of a signal source as `Event` (volatile stream) or `Reference` (stable lookup). |
| **Observable By** | The set of SignalKinds that can produce observations for a given EntityClass (TSGC-001 §2). |
| **d2ts** | Differential dataflow join strategy: event streams join with event streams, or events probe reference arrangements. |

---

## AVA.2.2 SignalKind Enumeration

### AVA.2.2.1 Definition

`SignalKind` (`ava-fusion/src/signal.rs:20-61`) is a 20-variant enum
classifying signal sources by collection method. Each variant corresponds to a
distinct data collection modality. Signal kinds determine valid join paths in
the fusion ontology.

```rust
#[serde(rename_all = "camelCase")]
pub enum SignalKind {
    AdsB,       // Automatic Dependent Surveillance – Broadcast
    Ais,        // Automatic Identification System
    Radar,      // Primary/secondary radar returns
    RfBearing,  // RF direction-finding bearing measurement
    Sdr,        // Software-defined radio raw signal capture
    Http,       // HTTP/HTTPS request/response metadata
    Dns,        // DNS query/response records
    Satellite,  // Satellite imagery or overhead sensor data
    Geoint,     // Geospatial intelligence (imagery analysis)
    Humint,     // Human intelligence reports
    Sigint,     // Signals intelligence (general)
    Elint,      // Electronic intelligence (radar/nav characterization)
    Comint,     // Communications intelligence (intercepted comms)
    Osint,      // Open-source intelligence (RSS, news, social)
    Masint,     // Measurement and signature intelligence
    Cyber,      // Cyber threat indicators (STIX, IOCs)
    Social,     // Social media signals (handles, posts, graphs)
    Financial,  // Financial transaction and sanctions data
    Travel,     // Travel records (manifests, border crossings)
    Custom,     // Operator-defined custom signal kind
}
```

### AVA.2.2.2 Serialization

SignalKind MUST serialize as `camelCase` JSON strings
(`signal.rs:19`):

| Variant | JSON Serialization | Display String |
|---------|--------------------|----------------|
| `AdsB` | `"adsB"` | `"ADS-B"` |
| `Ais` | `"ais"` | `"AIS"` |
| `Radar` | `"radar"` | `"Radar"` |
| `RfBearing` | `"rfBearing"` | `"RF Bearing"` |
| `Sdr` | `"sdr"` | `"SDR"` |
| `Http` | `"http"` | `"HTTP"` |
| `Dns` | `"dns"` | `"DNS"` |
| `Satellite` | `"satellite"` | `"Satellite"` |
| `Geoint` | `"geoint"` | `"GEOINT"` |
| `Humint` | `"humint"` | `"HUMINT"` |
| `Sigint` | `"sigint"` | `"SIGINT"` |
| `Elint` | `"elint"` | `"ELINT"` |
| `Comint` | `"comint"` | `"COMINT"` |
| `Osint` | `"osint"` | `"OSINT"` |
| `Masint` | `"masint"` | `"MASINT"` |
| `Cyber` | `"cyber"` | `"Cyber"` |
| `Social` | `"social"` | `"Social"` |
| `Financial` | `"financial"` | `"Financial"` |
| `Travel` | `"travel"` | `"Travel"` |
| `Custom` | `"custom"` | `"Custom"` |

**Normative**: Producers MUST use the camelCase serialization for all
JSON-encoded payloads. NATS subject tokens MUST use the lowercase form
(see [AVA.3](rfc-section-nats-subject-taxonomy.md)).

### AVA.2.2.3 Domain Groupings

The 20 signal kinds partition into 5 operational domains:

| Domain | Signal Kinds | Count |
|--------|-------------|-------|
| **Kinetic** | AdsB, Ais, Radar, Satellite | 4 |
| **RF/Signals** | RfBearing, Sdr, Sigint, Elint, Comint | 5 |
| **Cyber/Network** | Http, Dns, Cyber | 3 |
| **OSINT/Social/Financial** | Osint, Social, Financial, Travel | 4 |
| **GEOINT/HUMINT/MASINT** | Geoint, Humint, Masint | 3 |
| **Custom** | Custom | 1 |

### AVA.2.2.4 Completeness Invariant

The `SignalKind::ALL` constant (`signal.rs:65-87`) MUST contain exactly 20
variants in declaration order. This invariant is enforced by the test
`signal_kind_count()` (`signal.rs:230`).

---

## AVA.2.3 EntityClass Enumeration

### AVA.2.3.1 Definition

`EntityClass` (`ava-fusion/src/entity.rs:23-44`) is a 10-variant enum
defining the kinds of entities tracked by the fusion system. Each class has
a primary identifier namespace and a set of signal kinds that can observe it.

```rust
#[serde(rename_all = "camelCase")]
pub enum EntityClass {
    Aircraft,       // Primary ID: ICAO hex
    Vessel,         // Primary ID: MMSI
    GroundVehicle,  // Primary ID: license plate
    RfEmitter,      // Freq + location characterization
    NetworkHost,    // Primary ID: IP address
    Domain,         // Primary ID: FQDN
    Person,         // Primary ID: name or social handle
    Organization,   // Primary ID: name or LEI
    Campaign,       // Primary ID: STIX ID (adversary campaign)
    Facility,       // Primary ID: geo + name
}
```

### AVA.2.3.2 Serialization

EntityClass MUST serialize as `camelCase` JSON strings:

| Variant | JSON | Display |
|---------|------|---------|
| `Aircraft` | `"aircraft"` | `"Aircraft"` |
| `Vessel` | `"vessel"` | `"Vessel"` |
| `GroundVehicle` | `"groundVehicle"` | `"Ground Vehicle"` |
| `RfEmitter` | `"rfEmitter"` | `"RF Emitter"` |
| `NetworkHost` | `"networkHost"` | `"Network Host"` |
| `Domain` | `"domain"` | `"Domain"` |
| `Person` | `"person"` | `"Person"` |
| `Organization` | `"organization"` | `"Organization"` |
| `Campaign` | `"campaign"` | `"Campaign"` |
| `Facility` | `"facility"` | `"Facility"` |

### AVA.2.3.3 Completeness Invariant

`EntityClass::ALL` (`entity.rs:48-60`) MUST contain exactly 10 variants.
Enforced by the test `entity_class_count()` (`entity.rs:195`).

---

## AVA.2.4 IdentifierNamespace Enumeration

### AVA.2.4.1 Definition

`IdentifierNamespace` (`ava-fusion/src/entity.rs:88-112`) defines the
primary identifier systems used to key entities within a class. Tier 1
(hard key) joins operate within a single namespace; cross-namespace joins
require Tier 2 (soft key) or identity resolution.

| Variant | JSON | Use Case |
|---------|------|----------|
| `IcaoHex` | `"icaoHex"` | Aircraft — 24-bit hex address |
| `Mmsi` | `"mmsi"` | Vessel — Maritime Mobile Service Identity |
| `LicensePlate` | `"licensePlate"` | Ground Vehicle registration |
| `MacAddress` | `"macAddress"` | Network Host / RF Emitter |
| `IpAddress` | `"ipAddress"` | Network Host IPv4/IPv6 |
| `DomainName` | `"domainName"` | FQDN |
| `Imsi` | `"imsi"` | Person / Device — Mobile subscriber |
| `Imei` | `"imei"` | Device — Mobile equipment |
| `SocialHandle` | `"socialHandle"` | Person — Social media username |
| `Custom` | `"custom"` | Operator-defined namespace |

### AVA.2.4.2 Completeness Invariant

`IdentifierNamespace::ALL` MUST contain exactly 10 variants
(`entity.rs:116-128`). Enforced by `identifier_namespace_count()`
(`entity.rs:230`).

---

## AVA.2.5 DataType Duality

### AVA.2.5.1 Definition

`DataType` (`ava-fusion/src/signal.rs:126-133`) classifies signal sources
as event-stream or reference-table data (R5). This distinction determines
the d2ts join strategy:

| Variant | JSON | Semantics |
|---------|------|-----------|
| `Event` | `"event"` | Volatile, append-only, timestamped. Joins via differential stream windowing. |
| `Reference` | `"reference"` | Stable, slowly-changing, lookup-keyed. Materialised as d2ts arrangement for O(1) probes. |

### AVA.2.5.2 Examples

| Data Source | DataType | Rationale |
|-------------|----------|-----------|
| ADS-B state vectors | Event | Continuous stream, 1-2Hz per aircraft |
| AIS position reports | Event | Continuous stream, variable rate |
| FAA aircraft registry | Reference | Updated daily, lookup by ICAO hex |
| ITU frequency allocations | Reference | Updated infrequently, lookup by freq band |
| STIX CTI feeds | Reference | Updated hourly, lookup by indicator |
| HTTP request logs | Event | Continuous stream, high volume |

**Normative**: Each `JoinPathSide` (`ava-fusion/src/join_path.rs`) MUST
declare its `DataType`. The d2ts join compiler MUST use this to select
the appropriate operator (windowed join for Event×Event, probe join for
Event×Reference).

---

## AVA.2.6 UpdateRate Cadence

### AVA.2.6.1 Definition

`UpdateRate` (`ava-fusion/src/signal.rs:150-163`) specifies the refresh
cadence for reference data sources:

| Variant | JSON | Typical Sources |
|---------|------|----------------|
| `Static` | `"static"` | One-time load (ISO country codes, static maps) |
| `Daily` | `"daily"` | FAA registry, OFAC SDN list |
| `Hourly` | `"hourly"` | CISA KEV catalog, threat feeds |
| `Minutes` | `"minutes"` | AlienVault OTX pulses, social feeds |
| `Seconds` | `"seconds"` | High-rate reference streams (rare) |

### AVA.2.6.2 TTL Derivation

Reference data sources carry a `ttl_seconds` field in their
`ReferenceSource` registration. The `UpdateRate` provides a semantic
hint; the actual expiry is governed by `ttl_seconds`.

---

## AVA.2.7 ReferenceSource Registration

### AVA.2.7.1 Definition

`ReferenceSource` (`ava-fusion/src/signal.rs:190-205`) is the registration
record for a reference data source in the fusion ontology:

```rust
#[serde(rename_all = "camelCase")]
pub struct ReferenceSource {
    pub id: String,            // e.g. "faa-registry"
    pub signal_kind: String,   // e.g. "faa-db"
    pub entity_class: String,  // e.g. "Aircraft"
    pub key_field: String,     // e.g. "icao_hex"
    pub update_rate: UpdateRate,
    pub nats_subject: String,  // e.g. "tsingou.ref.faa.*"
    pub ttl_seconds: f64,
}
```

### AVA.2.7.2 Serialization

All fields serialize as `camelCase` (`signalKind`, `entityClass`, `keyField`,
`updateRate`, `natsSubject`, `ttlSeconds`). Verified by tests in
`signal.rs:320-336`.

### AVA.2.7.3 Ontology Registration

Reference sources are declared in `FusionOntologyV2.reference_sources`
(`ontology.rs:143-144`). The vector is `skip_serializing_if = "Vec::is_empty"`,
so ontologies with no reference data sources omit the field entirely.

**Normative**: Each `ReferenceSource.nats_subject` MUST follow the NATS
subject pattern conventions defined in [AVA.3](rfc-section-nats-subject-taxonomy.md).
The `key_field` MUST identify a JSON path in the payload that serves as
the lookup key for d2ts arrangement materialisation.

---

## AVA.2.8 EntityClassDef Mapping

### AVA.2.8.1 Definition

`EntityClassDef` (`ava-fusion/src/entity.rs:158-170`) maps an entity class
to its primary identifier namespace, primary signal kind, and the full set
of signal kinds that can observe it:

```rust
#[serde(rename_all = "camelCase")]
pub struct EntityClassDef {
    #[serde(rename = "class")]
    pub entity_class: EntityClass,
    pub primary_namespace: IdentifierNamespace,
    pub primary_signal: SignalKind,
    pub supported_signals: Vec<SignalKind>,
}
```

### AVA.2.8.2 Field Semantics

| Field | Purpose | Example (Aircraft) |
|-------|---------|-------------------|
| `entity_class` | The class being declared | `Aircraft` |
| `primary_namespace` | ID system for Tier 1 hard-key joins | `IcaoHex` |
| `primary_signal` | Canonical/primary signal source | `AdsB` |
| `supported_signals` | All signal kinds that can observe this class | `[AdsB, RfBearing, Radar, Osint]` |

**Normative**: The `entity_class` field MUST serialize as `"class"` (not
`"entityClass"`) per the `#[serde(rename = "class")]` annotation
(`entity.rs:163`). This rename is verified by the test
`entity_class_def_serde_roundtrip()` (`entity.rs:262`).

### AVA.2.8.3 Join Path Validation

The join-path compiler uses `EntityClassDef.supported_signals` to validate
which signal pairs are structurally valid for fusion. A join path
`(SignalKind::A, SignalKind::B)` is valid for `EntityClass::X` if and only
if both A and B appear in the `supported_signals` vector for X.

---

## AVA.2.9 Signal-Entity Observable Matrix

### AVA.2.9.1 Canonical Mappings

The following matrix shows which signal kinds can observe which entity
classes. These mappings are declared via `EntityClassDef` entries in the
`FusionOntologyV2.entity_classes` vector.

| EntityClass | Primary Signal | Primary Namespace | Supported Signals |
|-------------|---------------|-------------------|-------------------|
| Aircraft | AdsB | IcaoHex | AdsB, Radar, RfBearing, Satellite, Osint |
| Vessel | Ais | Mmsi | Ais, Radar, RfBearing, Satellite, Osint |
| GroundVehicle | Radar | LicensePlate | Radar, Satellite, Geoint, Osint |
| RfEmitter | RfBearing | MacAddress | RfBearing, Sdr, Sigint, Elint |
| NetworkHost | Http | IpAddress | Http, Dns, Cyber |
| Domain | Dns | DomainName | Dns, Http, Cyber, Osint |
| Person | Osint | SocialHandle | Osint, Social, Financial, Travel, Humint |
| Organization | Financial | Custom | Financial, Osint, Cyber, Social |
| Campaign | Cyber | Custom | Cyber, Osint, Social, Http, Dns |
| Facility | Geoint | Custom | Geoint, Satellite, Masint, Osint, Humint |

### AVA.2.9.2 Cross-Domain Fusion Paths

The observable matrix enables cross-domain fusion. For example:

- **Aircraft + RF**: AdsB × RfBearing enables geolocation fusion with
  direction-finding bearings.
- **Vessel + Satellite**: Ais × Satellite enables dark-vessel detection
  (AIS gap correlated with satellite imagery).
- **NetworkHost + Cyber**: Http × Cyber enables IOC correlation with
  observed network behavior.
- **Person + Financial**: Social × Financial enables sanctions screening
  against social media presence.

---

## AVA.2.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.2-R1 | SignalKind MUST contain exactly 20 variants | MUST |
| AVA.2-R2 | EntityClass MUST contain exactly 10 variants | MUST |
| AVA.2-R3 | SignalKind MUST serialize as camelCase JSON strings | MUST |
| AVA.2-R4 | EntityClass MUST serialize as camelCase JSON strings | MUST |
| AVA.2-R5 | EntityClassDef.entity_class MUST serialize as `"class"` (not `"entityClass"`) | MUST |
| AVA.2-R6 | Each JoinPathSide MUST declare its DataType (Event or Reference) | MUST |
| AVA.2-R7 | ReferenceSource.nats_subject MUST follow AVA.3 subject pattern conventions | MUST |
| AVA.2-R8 | The d2ts join compiler MUST use DataType to select the join operator | MUST |
| AVA.2-R9 | IdentifierNamespace MUST contain exactly 10 variants | MUST |
| AVA.2-R10 | Custom signal kinds MUST be routed through the `Custom` variant, not added as new enum variants | SHOULD |

---

## AVA.2.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [TSGC-001] Tsingou Sensor Graph Conventions, version 1.0, Section 2.
- [TSGC-001-v2] Tsingou Sensor Graph Conventions, version 2.0, Section 5.4 (ReferenceSource).
- [ava-fusion signal.rs] `ava-fusion/src/signal.rs` — SignalKind (20), DataType, UpdateRate, ReferenceSource
- [ava-fusion entity.rs] `ava-fusion/src/entity.rs` — EntityClass (10), IdentifierNamespace (10), EntityClassDef
- [ava-fusion ontology.rs] `ava-fusion/src/ontology.rs` — FusionOntologyV2.reference_sources
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md) — Crate boundary and ID model
- [AVA.3] [NATS Subject Taxonomy](rfc-section-nats-subject-taxonomy.md) — Subject routing for signal kinds

---

*End of section AVA.2*
