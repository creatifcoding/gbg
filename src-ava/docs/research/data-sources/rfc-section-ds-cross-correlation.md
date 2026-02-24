# AVA.DS.7: Cross-Domain Correlation Matrix

```
Section:       AVA.DS.7 — Cross-Domain Correlation Matrix
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Integration Specification (Normative)
Prerequisites: AVA.DS.1-6 (Domain Catalogs + NATS Taxonomy)
Feeds:         AVA.DS.8 (Test Harness)
```

> This section defines the **20x20 SignalKind cross-correlation matrix** for
> the ava-fusion pipeline. For each viable signal pair, it specifies the join
> type (from `ava-fusion/src/join_path.rs`), join key, fusion tier, and
> expected output type. The matrix is derived from the "Cross-Correlation
> Targets" subsections of [AVA.DS.1](rfc-section-ds-kinetic.md) through
> [AVA.DS.5](rfc-section-ds-geoint-humint-masint.md), cross-referenced with
> the `EntityClass` "Observable By" relationships from
> `ava-fusion/src/entity.rs`. The key words "MUST", "SHOULD", and "MAY" are
> interpreted as described in [RFC2119].

---

## Table of Contents

1. [Overview](#avads71-overview)
2. [Fusion Tier Definitions](#avads72-fusion-tier-definitions)
3. [Join Type Reference](#avads73-join-type-reference)
4. [Tier 1 Correlations (Hard Key)](#avads74-tier-1-correlations)
5. [Tier 2 Correlations (Soft Key)](#avads75-tier-2-correlations)
6. [Tier 3 Correlations (Derived)](#avads76-tier-3-correlations)
7. [Density Heat Map](#avads77-density-heat-map)
8. [EntityClass Overlap Matrix](#avads78-entityclass-overlap-matrix)
9. [Implementation Priority](#avads79-implementation-priority)

---

## AVA.DS.7.1 Overview

The ava-fusion pipeline supports correlation between any two of the 20
SignalKind variants. Not all 190 unique pairs (20 choose 2) are viable --
correlation requires at least one shared `EntityClass` or a plausible
spatial/temporal/spectral overlap. This document enumerates the **84 viable
pairs** discovered across the five domain catalogs.

**Correlation viability** is determined by:

1. **Shared EntityClass**: Both signal kinds can observe the same entity type
   (e.g., AdsB and Radar both observe Aircraft).
2. **Spatial overlap**: Both produce geo-referenced observations in overlapping
   regions (e.g., Satellite and Ais in maritime zones).
3. **Temporal overlap**: Both produce time-stamped observations within
   correlatable windows.
4. **Key overlap**: Both carry matching identifiers (e.g., ICAO hex, MMSI, IP
   address, domain name, frequency).

---

## AVA.DS.7.2 Fusion Tier Definitions

From `ava-fusion/src/join_path.rs`:

| Tier | Rust Variant | Confidence | Join Mechanism | Example |
|------|-------------|------------|----------------|---------|
| **Tier 1** | `Tier1Kinematic` | C ~ 0.99 | Hard key -- shared deterministic identifier | ICAO hex, MMSI, IP address, frequency |
| **Tier 2** | `Tier2Attribute` | C < 0.99 | Soft key -- proximity predicates, probabilistic | H3 cell + time bucket, bearing intersection |
| **Tier 3** | `Tier3Behavioral` | Variable | Derived -- statistical/behavioral patterns | Name matching, temporal co-occurrence |

---

## AVA.DS.7.3 Join Type Reference

From `ava-fusion/src/join_path.rs`:

| JoinType | Description | Key Expression |
|----------|-------------|----------------|
| `Identity` | Shared identifier (ICAO, MMSI, IP, domain, STIX ID) | `payload.{id_field}` |
| `Spatial` | Geographic proximity (H3 cell intersection, haversine) | `H3(lat, lon, resolution)` |
| `Temporal` | Temporal proximity (time window overlap) | `abs(t1 - t2) < window_ms` |
| `Spectral` | RF frequency proximity (band matching) | `abs(f1 - f2) < bandwidth_hz` |
| `Semantic` | Named entity / IOC overlap (Jaccard coefficient) | `jaccard(entities_A, entities_B)` |
| `Behavioral` | Velocity/maneuver pattern similarity (DTW, cosine) | Statistical distance metric |
| `Statistical` | Tier 3 statistical correlation (emergent patterns) | Model-specific |

---

## AVA.DS.7.4 Tier 1 Correlations (Hard Key)

Tier 1 joins use deterministic shared identifiers. These are the highest-confidence,
lowest-latency correlations and SHOULD be implemented first.

| Left Signal | Right Signal | Join Key | EntityClass | Output | Catalog Ref |
|------------|-------------|----------|-------------|--------|-------------|
| AdsB | AdsB (multi-source) | ICAO hex | Aircraft | FusedTrack | DS.1.2.5 |
| Ais | Ais (multi-source) | MMSI | Vessel | FusedTrack | DS.1.3.5 |
| Http | Dns | IP address + Domain name | NetworkHost, Domain | FusedTrack | DS.3.2.5 |
| Http | Cyber | IP / Domain vs STIX indicator | NetworkHost, Domain | CorrelatedPair | DS.3.2.5 |
| Dns | Cyber | Domain vs STIX indicator | Domain | CorrelatedPair | DS.3.3.5 |
| RfBearing | Sdr | Frequency + time bucket | RfEmitter | FusedTrack | DS.2.2.5 |
| RfBearing | Sigint | Licensed frequency match | RfEmitter | Enrichment | DS.2.2.5 |
| RfBearing | Comint | Frequency + time | RfEmitter | FusedTrack | DS.2.6.5 |
| Sdr | Sigint | Captured freq = licensed freq | RfEmitter | Enrichment | DS.2.3.5 |
| Sdr | AdsB | 1090 MHz capture = ADS-B decode | Aircraft | FusedTrack | DS.2.3.5 |
| Sdr | Ais | 161.975/162.025 MHz = AIS decode | Vessel | FusedTrack | DS.2.3.5 |
| Sdr | Comint | Frequency + time | RfEmitter | FusedTrack | DS.2.6.5 |
| Sigint | Elint | Licensed radar freq + station location | RfEmitter, Facility | Enrichment | DS.2.4.5 |
| Sigint | Comint | Licensed frequency match | RfEmitter | Enrichment | DS.2.6.5 |
| Sigint | AdsB | 1090 MHz allocation | Aircraft | Enrichment | DS.2.4.5 |
| Sigint | Ais | VHF marine allocation | Vessel | Enrichment | DS.2.4.5 |
| Financial | AdsB | OFAC aircraft ICAO hex | Aircraft | Flag | DS.4.4.5 |
| Financial | Ais | OFAC vessel MMSI/name | Vessel | Flag | DS.4.4.5 |
| Financial | Travel | Passport/name match | Person | Flag | DS.4.4.5 |
| Financial | Financial | LEI/CIK cross-reference | Organization | FusedTrack | DS.4.4.5 |
| Travel | AdsB | Flight callsign + departure time | Aircraft, Person | CorrelatedPair | DS.4.5.5 |
| Travel | Travel (self-join) | Passport number across PNRs | Person | SequenceMatch | DS.4.5.5 |
| Social | Cyber | Shared URLs/domains | Domain, Campaign | CorrelatedPair | DS.4.3.5 |
| Social | Dns | URLs in posts = DNS records | Domain | CorrelatedPair | DS.4.3.5 |
| Geoint | Satellite | Spatial bbox overlap + feature | Facility | FusedTrack | DS.5.2.5 |

**Total Tier 1 pairs**: 25

---

## AVA.DS.7.5 Tier 2 Correlations (Soft Key)

Tier 2 joins use probabilistic proximity predicates. These require spatial
indexing (H3), temporal windowing, and/or spectral binning.

| Left Signal | Right Signal | Join Type | Join Key | EntityClass | Blocking | Catalog Ref |
|------------|-------------|-----------|----------|-------------|----------|-------------|
| AdsB | Radar | Spatial+Temporal | H3 res 9 + 10s bucket | Aircraft | spatial, temporal | DS.1.2.5 |
| AdsB | Ais | Spatial+Temporal | H3 res 7 + 60s bucket | Aircraft, Vessel | spatial, temporal | DS.1.2.5 |
| AdsB | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Aircraft, Facility | spatial, temporal | DS.1.2.5 |
| AdsB | RfBearing | Bearing intersection | Triangulated pos vs ADS-B pos | Aircraft, RfEmitter | spatial, temporal | DS.1.2.5 |
| Ais | Radar | Spatial+Temporal | H3 res 7 + 30s bucket | Vessel | spatial, temporal | DS.1.3.5 |
| Ais | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Vessel, Facility | spatial, temporal | DS.1.3.5 |
| Ais | RfBearing | Bearing intersection | Triangulated pos vs AIS pos | Vessel, RfEmitter | spatial, temporal | DS.1.3.5 |
| Radar | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Aircraft, Facility | spatial, temporal | DS.1.4.5 |
| Radar | RfBearing | Bearing intersection | Bearing vs radar track pos | Aircraft, RfEmitter | spatial, temporal | DS.1.4.5 |
| Radar | Elint | Parameter match | PRF/PW matching radar type | RfEmitter | spectral | DS.1.4.5 |
| RfBearing | AdsB | Spatial+Temporal | H3 cell + time + transponder freq | Aircraft, RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Ais | Spatial+Temporal | H3 cell + time + VHF freq range | Vessel, RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Radar | Spatial+Temporal | H3 cell + time bucket | RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Elint | Frequency+Parameter | Freq + pulse characteristics | RfEmitter | spectral | DS.2.2.5 |
| Sdr | Elint | Frequency+Parameter | Center freq + detected pulse | RfEmitter | spectral | DS.2.3.5 |
| Sdr | Comint | Frequency+Temporal | Intercepted freq + time window | RfEmitter | spectral, temporal | DS.2.3.5 |
| Elint | RfBearing | Frequency+Location | DF bearing vs emitter location | RfEmitter | spatial, spectral | DS.2.5.5 |
| Elint | Sdr | Frequency+Parameter | IQ capture at radar freq | RfEmitter | spectral | DS.2.5.5 |
| Elint | Radar | Parameter match | PRF/PW vs known radar type | RfEmitter | spectral | DS.2.5.5 |
| Sigint | Elint | Frequency+Location | Licensed radar + station loc | RfEmitter, Facility | spatial, spectral | DS.2.4.5 |
| Http | Osint | Key | Domain/IP in news | NetworkHost, Domain | — | DS.3.2.5 |
| Dns | Osint | Key | Domain in news | Domain | — | DS.3.3.5 |
| Dns | Social | Key | Domain in social posts | Domain | — | DS.3.3.5 |
| Dns | Financial | Key | WHOIS registrant vs sanctions | Domain, Organization | — | DS.3.3.5 |
| Cyber | Osint | Key | Campaign name in news | Campaign, Organization | — | DS.3.4.5 |
| Cyber | Social | Key | IOC domains in social media | Domain, Campaign | — | DS.3.4.5 |
| Cyber | Financial | Key | Threat actor org vs sanctions | Organization | — | DS.3.4.5 |
| Osint | Social | Name+Temporal | Person/Org name + time window | Person, Organization | temporal | DS.4.2.5 |
| Osint | Financial | Name match | Organization name = SDN/LEI name | Organization | — | DS.4.2.5 |
| Osint | Humint | Name+Location | Actor names + geo coordinates | Person, Organization | spatial, temporal | DS.4.2.5 |
| Social | Social (cross-platform) | Profile matching | Bio, display name, linked URLs | Person | — | DS.4.3.5 |
| Social | Financial | Name match | Display name = SDN entity | Person, Organization | — | DS.4.3.5 |
| Financial | Cyber | Key | Corporate domains = threat indicators | Domain, Organization | — | DS.4.4.5 |
| Geoint | AdsB | Spatial | H3 cell + facility proximity | Aircraft, Facility | spatial | DS.5.2.5 |
| Geoint | Ais | Spatial | H3 cell + port geometry | Vessel, Facility | spatial | DS.5.2.5 |
| Geoint | Humint | Spatial+Temporal | H3 cell + time bucket | Facility, Organization | spatial, temporal | DS.5.2.5 |
| Geoint | Masint | Spatial | H3 cell | Facility | spatial | DS.5.2.5 |
| Geoint | Radar | Spatial+Temporal | H3 cell + time bucket | Facility | spatial, temporal | DS.5.2.5 |
| Humint | AdsB | Spatial+Temporal | H3 cell + time window | Aircraft, Person | spatial, temporal | DS.5.3.5 |
| Humint | Ais | Spatial+Temporal | H3 cell + time window | Vessel, Person | spatial, temporal | DS.5.3.5 |
| Humint | Masint | Spatial+Temporal | H3 cell + time window | Facility | spatial, temporal | DS.5.3.5 |
| Humint | Satellite | Spatial+Temporal | bbox overlap + date | Facility | spatial, temporal | DS.5.3.5 |
| Masint | Geoint | Spatial | H3 cell | Facility | spatial | DS.5.4.5 |
| Masint | AdsB | Spatial+Temporal | H3 cell + time window | Aircraft, Facility | spatial, temporal | DS.5.4.5 |
| Masint | Ais | Spatial+Temporal | H3 cell + time window | Vessel, Facility | spatial, temporal | DS.5.4.5 |
| Masint | Satellite | Spatial+Temporal | bbox + date | Facility | spatial, temporal | DS.5.4.5 |
| Masint | Masint (self) | Temporal | time bucket | Facility | temporal | DS.5.4.5 |
| Satellite | Masint | Spatial+Temporal | H3 res 5 + time window | Facility | spatial, temporal | DS.1.5.5 |
| Satellite | Geoint | Spatial | H3 res 7 + feature overlap | Facility | spatial | DS.1.5.5 |

**Total Tier 2 pairs**: 48

---

## AVA.DS.7.6 Tier 3 Correlations (Derived)

Tier 3 joins use statistical, behavioral, or semantic methods. These are the
lowest-confidence but highest-novelty correlations.

| Left Signal | Right Signal | Join Type | Method | EntityClass | Catalog Ref |
|------------|-------------|-----------|--------|-------------|-------------|
| AdsB | Osint | Semantic | Callsign string match in news | Aircraft, Campaign | DS.1.2.5 |
| AdsB | Sigint | Frequency+Spatial | 1090 MHz band + H3 cell | Aircraft, RfEmitter | DS.1.2.5 |
| Ais | Osint | Semantic | Vessel name/MMSI in news | Vessel, Campaign | DS.1.3.5 |
| Ais | Financial | Identity+Semantic | IMO lookup to beneficial ownership | Vessel, Organization | DS.1.3.5 |
| Satellite | Osint | Temporal+Semantic | News of fires/floods + FIRMS data | Facility, Campaign | DS.1.5.5 |
| Elint | Satellite | Spatial+Temporal | SAR confirms ground radar | RfEmitter, Facility | DS.2.5.5 |
| Elint | Comint | Temporal+Location | Radar + comms co-located | RfEmitter, Organization | DS.2.5.5 |
| Comint | Humint | Temporal+Location | HUMINT report + COMINT area | RfEmitter, Organization | DS.2.6.5 |
| Comint | Osint | Entity+Temporal | OSINT event + observed comms | Organization | DS.2.6.5 |
| Sigint | Osint | Entity | Licensee name = OSINT entity | Organization | DS.2.4.5 |
| Http | RfBearing | Spatial+Temporal | IP geolocation + bearing | NetworkHost, RfEmitter | DS.3.2.5 |
| Http | AdsB/Ais | Temporal | Timestamp overlap at facility | NetworkHost, Aircraft | DS.3.2.5 |
| Cyber | AdsB | Behavioral | Campaign targets aviation | Campaign, Aircraft | DS.3.4.5 |
| Cyber | Ais | Behavioral | Campaign targets maritime | Campaign, Vessel | DS.3.4.5 |
| Cyber | RfBearing | Spatial | C2 geolocation vs RF bearing | NetworkHost, RfEmitter | DS.3.4.5 |
| Osint | AdsB/Ais | Geo+Temporal | Event geo = track position | Person, Aircraft | DS.4.2.5 |
| Osint | Cyber | URL/Domain | Document URL = threat domain | Domain, Campaign | DS.4.2.5 |
| Travel | Social | Name+Temporal | Passenger name = social check-in | Person | DS.4.5.5 |
| Travel | Osint | Name+Location | Passenger name = news at dest | Person | DS.4.5.5 |
| Humint | Osint | Textual+Temporal | Actor name + time bucket | Person, Organization | DS.5.3.5 |
| Humint | Social | Textual+Spatial | Location name + H3 cell | Person, Organization | DS.5.3.5 |
| Humint | Cyber | Entity (actor) | Actor name / group ID | Organization, Campaign | DS.5.3.5 |
| Masint | Osint | Spatial+Temporal | Location + time | Facility | DS.5.4.5 |

**Total Tier 3 pairs**: 23

---

## AVA.DS.7.7 Density Heat Map

Correlation density per SignalKind (number of viable pairs per signal).
Higher density = more integration value.

```
SignalKind    | T1 | T2 | T3 | Total | Density
─────────────┼────┼────┼────┼───────┼────────
AdsB         |  4 |  6 |  3 |   13  | ████████████▏
Ais          |  3 |  6 |  2 |   11  | ██████████▌
Radar        |  1 |  6 |  0 |    7  | ██████▍
Satellite    |  1 |  5 |  2 |    8  | ███████▍
RfBearing    |  4 |  6 |  0 |   10  | █████████▎
Sdr          |  5 |  3 |  0 |    8  | ███████▍
Sigint       |  5 |  2 |  2 |    9  | ████████▎
Elint        |  1 |  5 |  2 |    8  | ███████▍
Comint       |  4 |  1 |  3 |    8  | ███████▍
Http         |  2 |  1 |  2 |    5  | ████▋
Dns          |  2 |  3 |  0 |    5  | ████▋
Cyber        |  3 |  3 |  3 |    9  | ████████▎
Osint        |  1 |  5 |  4 |   10  | █████████▎
Social       |  2 |  4 |  1 |    7  | ██████▍
Financial    |  4 |  3 |  1 |    8  | ███████▍
Travel       |  3 |  0 |  2 |    5  | ████▋
Geoint       |  1 |  5 |  0 |    6  | █████▌
Humint       |  0 |  5 |  3 |    8  | ███████▍
Masint       |  0 |  6 |  1 |    7  | ██████▍
Custom       |  0 |  0 |  0 |    0  | (operator-defined)
```

**Key observations**:
- **AdsB** has the highest density (13 pairs) -- it is the most cross-correlated signal.
- **Ais** and **RfBearing** follow closely (11, 10 pairs respectively).
- **Http**, **Dns**, and **Travel** have the fewest pairs (5 each) -- they are domain-specific.
- **Humint** and **Masint** have zero Tier 1 pairs -- they lack hard identifiers.

---

## AVA.DS.7.8 EntityClass Overlap Matrix

This matrix shows which EntityClasses are observable by which SignalKinds.
An "X" means the signal kind can produce observations mapped to that entity class.

```
                  | Aircraft | Vessel | GndVeh | RfEmit | NetHost | Domain | Person | Org   | Campaign | Facility
──────────────────┼──────────┼────────┼────────┼────────┼─────────┼────────┼────────┼───────┼──────────┼─────────
AdsB              |    X     |        |        |        |         |        |        |       |          |
Ais               |          |   X    |        |        |         |        |        |       |          |
Radar             |    X     |   X    |   X    |        |         |        |        |       |          |    X
Satellite         |          |   X    |        |        |         |        |        |       |          |    X
RfBearing         |    X     |   X    |        |   X    |         |        |        |       |          |
Sdr               |    X     |   X    |        |   X    |         |        |        |       |          |
Sigint            |    X     |   X    |        |   X    |         |        |        |  X    |          |    X
Elint             |    X     |   X    |        |   X    |         |        |        |       |          |    X
Comint            |          |        |        |   X    |         |        |        |  X    |          |
Http              |          |        |        |        |    X    |   X    |        |       |          |
Dns               |          |        |        |        |    X    |   X    |        |       |          |
Cyber             |          |        |        |        |    X    |   X    |   X    |  X    |    X     |
Osint             |          |        |        |        |         |   X    |   X    |  X    |    X     |
Social            |          |        |        |        |         |   X    |   X    |  X    |    X     |
Financial         |    X     |   X    |        |        |         |        |   X    |  X    |    X     |
Travel            |          |        |        |        |         |        |   X    |  X    |          |    X
Geoint            |          |        |        |        |         |        |        |  X    |          |    X
Humint            |          |        |        |        |         |        |   X    |  X    |          |    X
Masint            |          |        |        |        |         |        |        |       |          |    X
Custom            |    ?     |   ?    |   ?    |   ?    |    ?    |   ?    |   ?    |  ?    |    ?     |    ?
```

**Fusion rule**: Two signals CAN be correlated at Tier 1 (Identity) only if they
share at least one EntityClass column marked "X". Tier 2 (Spatial/Temporal)
correlations can bridge signals with no shared EntityClass IF they produce
geo-referenced observations. Tier 3 (Semantic/Behavioral) correlations have no
EntityClass constraint.

---

## AVA.DS.7.9 Implementation Priority

Recommended implementation order based on fusion value and complexity:

### Phase 1: Foundation (Tier 1, intra-domain)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P0 | AdsB x AdsB (multi-source dedup) | Critical | Low |
| P0 | Ais x Ais (multi-source dedup) | Critical | Low |
| P0 | Http x Dns (flow + resolution) | Critical | Low |
| P0 | Http x Cyber (IOC matching) | Critical | Medium |
| P0 | Dns x Cyber (domain IOC matching) | Critical | Medium |

### Phase 2: Cross-Domain Kinetic (Tier 2, spatial)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P1 | AdsB x Radar (transponder + primary) | High | Medium |
| P1 | AdsB x Ais (air-maritime) | High | Medium |
| P1 | Ais x Radar (maritime radar) | High | Medium |
| P1 | RfBearing x Sdr (DF + IQ) | High | Medium |
| P1 | Satellite x Ais (imagery + AIS) | High | High |

### Phase 3: Intelligence Integration (Tier 1+2, cross-domain)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P2 | Financial x AdsB (sanctioned aircraft) | High | Low |
| P2 | Financial x Ais (sanctioned vessels) | High | Low |
| P2 | Financial x Travel (watchlist screening) | High | Medium |
| P2 | Social x Cyber (threat infra mapping) | Medium | Medium |
| P2 | Sigint x Elint (license + emitter param) | Medium | High |

### Phase 4: Enrichment (Tier 3, behavioral)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P3 | Osint x AdsB/Ais (news + tracks) | Medium | High |
| P3 | Humint x Geoint (conflict + features) | Medium | Medium |
| P3 | Cyber x AdsB/Ais (campaign + kinetic) | Medium | High |
| P3 | Travel x Social (travel behavior) | Low | High |
| P3 | Masint x Humint (environmental context) | Low | Medium |

---

*End of Section AVA.DS.7*
