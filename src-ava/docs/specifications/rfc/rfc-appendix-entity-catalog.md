# Appendix B — EntityClass Catalog

```
Section:       Appendix B — EntityClass Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
```

> This appendix provides the complete catalog of all 10 `EntityClass` variants
> defined in `ava-fusion/src/entity.rs`. Each variant represents a distinct
> category of real-world object tracked by the fusion pipeline. Entity classes
> determine identifier namespaces, observable signal kinds, fusion output
> routing, and track lifecycle configuration.

---

## Table of Contents

1. [Overview](#b1-overview)
2. [Entity Class Table](#b2-entity-class-table)
3. [Identifier Namespaces](#b3-identifier-namespaces)
4. [Entity-Signal Observable Matrix](#b4-entity-signal-observable-matrix)
5. [EntityClassDef Registration Record](#b5-entityclassdef-registration-record)
6. [Fusion Output Routing](#b6-fusion-output-routing)

---

## B.1 Overview

The `EntityClass` enum (`ava-fusion/src/entity.rs:23-44`) defines 10 entity
categories. Each variant is serialized as camelCase via
`#[serde(rename_all = "camelCase")]`. All 10 variants are enumerated in
`EntityClass::ALL` (`ava-fusion/src/entity.rs:48-59`).

Each entity class maps to:
- A **primary identifier namespace** for Tier 1 hard-key fusion
- A **primary signal kind** (canonical observation source)
- A set of **supported signal kinds** (all sources that can observe the entity)

These mappings are declared via the `EntityClassDef` struct
(`ava-fusion/src/entity.rs:160-170`).

---

## B.2 Entity Class Table

| # | Class | Display Name | Serde Key | Primary ID | Description |
|---|-------|-------------|-----------|-----------|-------------|
| 1 | `Aircraft` | Aircraft | `aircraft` | ICAO 24-bit hex | Fixed-wing or rotary-wing aircraft |
| 2 | `Vessel` | Vessel | `vessel` | MMSI | Maritime vessel |
| 3 | `GroundVehicle` | Ground Vehicle | `groundVehicle` | License plate | Land-based vehicle |
| 4 | `RfEmitter` | RF Emitter | `rfEmitter` | Freq + location | Radio-frequency emitter characterized by frequency and location |
| 5 | `NetworkHost` | Network Host | `networkHost` | IP address | Network-connected host |
| 6 | `Domain` | Domain | `domain` | FQDN | DNS domain / fully-qualified domain name |
| 7 | `Person` | Person | `person` | Name / social handle | Human individual |
| 8 | `Organization` | Organization | `organization` | Name / LEI | Corporate or institutional entity |
| 9 | `Campaign` | Campaign | `campaign` | STIX ID | Adversary campaign (STIX 2.1) |
| 10 | `Facility` | Facility | `facility` | Geo + name | Physical installation |

Source: `ava-fusion/src/entity.rs:23-44` (enum definition),
`ava-fusion/src/entity.rs:62-77` (Display impl).

---

## B.3 Identifier Namespaces

The `IdentifierNamespace` enum (`ava-fusion/src/entity.rs:91-112`) defines
primary key systems for entity identification. Tier 1 (hard-key) joins operate
within a single namespace; cross-namespace joins require Tier 2 (soft-key) or
identity resolution.

| # | Namespace | Display Name | Serde Key | Primary For |
|---|-----------|-------------|-----------|-------------|
| 1 | `IcaoHex` | ICAO Hex | `icaoHex` | Aircraft |
| 2 | `Mmsi` | MMSI | `mmsi` | Vessel |
| 3 | `LicensePlate` | License Plate | `licensePlate` | GroundVehicle |
| 4 | `MacAddress` | MAC Address | `macAddress` | RfEmitter, NetworkHost |
| 5 | `IpAddress` | IP Address | `ipAddress` | NetworkHost |
| 6 | `DomainName` | Domain Name | `domainName` | Domain |
| 7 | `Imsi` | IMSI | `imsi` | Person, Device |
| 8 | `Imei` | IMEI | `imei` | Device |
| 9 | `SocialHandle` | Social Handle | `socialHandle` | Person |
| 10 | `Custom` | Custom | `custom` | Operator-defined |

Source: `ava-fusion/src/entity.rs:91-112`, `ava-fusion/src/entity.rs:130-143`.

---

## B.4 Entity-Signal Observable Matrix

This matrix maps each entity class to the signal kinds that can observe it.
The **primary signal** (bold) is the canonical observation source. Other
entries are supported signals that contribute to multi-source fusion.

| EntityClass | Primary Signal | Observable By |
|-------------|---------------|---------------|
| `Aircraft` | **AdsB** | AdsB, Radar, RfBearing, Satellite, Osint |
| `Vessel` | **Ais** | Ais, Radar, RfBearing, Satellite, Osint |
| `GroundVehicle` | **Radar** | Radar, Satellite, Geoint, Osint |
| `RfEmitter` | **RfBearing** | RfBearing, Sdr, Sigint, Elint |
| `NetworkHost` | **Http** | Http, Dns, Cyber |
| `Domain` | **Dns** | Dns, Http, Cyber, Osint |
| `Person` | **Osint** | Osint, Social, Financial, Travel, Humint |
| `Organization` | **Financial** | Financial, Osint, Cyber, Social |
| `Campaign` | **Cyber** | Cyber, Osint, Social, Sigint |
| `Facility` | **Geoint** | Geoint, Satellite, Masint, Osint, Humint |

The observable-by relationships define which `JoinPathEntryV2` combinations
are structurally valid. The join-path compiler validates that both left and
right signal kinds appear in the target entity class's supported signals list.

Source: Entity-signal relationships derived from `EntityClassDef` test
instances at `ava-fusion/src/entity.rs:249-271` (Aircraft),
`ava-fusion/src/entity.rs:276-291` (Vessel),
`ava-fusion/src/entity.rs:294-309` (NetworkHost).

---

## B.5 EntityClassDef Registration Record

The `EntityClassDef` struct (`ava-fusion/src/entity.rs:160-170`) is the
ontology registration record for each entity class. It binds the entity class
to its identifier namespace and signal capabilities.

```
EntityClassDef {
    entity_class:      EntityClass,           // serialized as "class"
    primary_namespace: IdentifierNamespace,   // serialized as "primaryNamespace"
    primary_signal:    SignalKind,            // serialized as "primarySignal"
    supported_signals: Vec<SignalKind>,       // serialized as "supportedSignals"
}
```

Notable serde behavior: the `entity_class` field is renamed to `"class"` via
`#[serde(rename = "class")]` (`ava-fusion/src/entity.rs:163`).

---

## B.6 Fusion Output Routing

Fusion results are routed by entity class on NATS subjects following the
pattern `fusion.{tier}.{entity_class}.results`
(see [AVA.3.4](rfc-section-nats-subject-taxonomy.md#ava34-fusion-output-subjects)).

| EntityClass | Tier 1 Subject | Tier 2 Subject | Tier 3 Subject |
|-------------|---------------|---------------|---------------|
| `Aircraft` | `fusion.tier1.aircraft.results` | `fusion.tier2.aircraft.results` | `fusion.tier3.aircraft.results` |
| `Vessel` | `fusion.tier1.vessel.results` | `fusion.tier2.vessel.results` | `fusion.tier3.vessel.results` |
| `GroundVehicle` | -- | `fusion.tier2.groundvehicle.results` | `fusion.tier3.groundvehicle.results` |
| `RfEmitter` | -- | `fusion.tier2.rfemitter.results` | `fusion.tier3.rfemitter.results` |
| `NetworkHost` | `fusion.tier1.networkhost.results` | `fusion.tier2.networkhost.results` | -- |
| `Domain` | `fusion.tier1.domain.results` | `fusion.tier2.domain.results` | -- |
| `Person` | -- | `fusion.tier2.person.results` | `fusion.tier3.person.results` |
| `Organization` | -- | `fusion.tier2.organization.results` | `fusion.tier3.organization.results` |
| `Campaign` | -- | -- | `fusion.tier3.campaign.results` |
| `Facility` | -- | `fusion.tier2.facility.results` | -- |

Track lifecycle events follow: `fusion.tracks.{entity_class}.{event}` where
`{event}` is one of `created`, `updated`, `merged`, `dropped`.

Alarm notifications follow: `alarm.{severity}.{entity_class}` where
`{severity}` is `critical`, `warning`, `info`, or `absence`.

---

*Source: `ava-fusion/src/entity.rs` (310 lines). All variant names, serde keys,
display strings, and structural relationships extracted from source code.*

*End of Appendix B*
