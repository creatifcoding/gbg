# Appendix D: STIX 2.1 Mapping Tables

```
Appendix:    D
Title:       STIX 2.1 Mapping Tables
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.8 (BaseSignal Schema), TSG.12 (STIX Data Model),
             TSG.13 (STIX Codec), TSG.14 (TAXII Transport)
```

---

## TSG.D.1 Introduction

This appendix provides exhaustive field-by-field mapping tables between
Tsingou's BaseSignal format (TSG.8) and STIX 2.1 [STIX21] object types.
These tables serve as the normative reference for codec implementors
(TSG.13) and integration engineers connecting Tsingou to external CTI
platforms.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in BCP 14
[RFC2119] [RFC8174] when, and only when, they appear in all capitals, as
shown here.

### TSG.D.1.1 Mapping Conventions

| Convention | Meaning |
|------------|---------|
| `-->` | Direct mapping (value copied or trivially transformed) |
| `==>` | Computed mapping (transformation logic required) |
| `~~>` | Lossy mapping (information loss on round-trip) |
| `(none)` | No STIX equivalent; preserved in `x_tsingou_metadata` |
| `[C]` | Conditional — included only when source field is non-empty |
| `[R]` | Required in target format |
| `[O]` | Optional in target format |

### TSG.D.1.2 Reading the Tables

Each mapping table follows this structure:

```
| BaseSignal Field | STIX Property | Direction | Transform | Notes |
```

**Direction** indicates which codec pipeline stage applies:

- **Encode** — BaseSignal to STIX (export)
- **Decode** — STIX to BaseSignal (import)
- **Both** — Bidirectional mapping

### TSG.D.1.3 Data Flow Overview

```
                    ENCODE PIPELINE
                    ══════════════
BaseSignal                                     STIX Bundle
┌─────────────────┐                           ┌─────────────────────┐
│ id               │───── UUIDv5 ────────────►│ observed-data.id     │
│ sourceId         │───── Identity lookup ───►│ .created_by_ref      │
│ timestamp        │───── ISO 8601 ──────────►│ .first_observed      │
│ version          │───── x_tsingou_metadata ►│ .x_tsingou_metadata  │
│ kind             │───── SCO dispatch ──────►│ SCO type selection   │
│ payload          │───── Kind-specific ─────►│ SCO properties       │
│ metadata         │───── Preserve ──────────►│ .x_tsingou_metadata  │
└─────────────────┘                           └─────────────────────┘

                    DECODE PIPELINE
                    ══════════════
STIX Bundle                                    BaseSignal
┌─────────────────────┐                       ┌─────────────────────┐
│ observed-data.id     │── Reverse UUID ─────►│ id                   │
│ .created_by_ref      │── Identity resolve ─►│ sourceId             │
│ .first_observed      │── Date parse ───────►│ timestamp            │
│ .x_tsingou_metadata  │── Extract ──────────►│ version              │
│ SCO type             │── Kind discriminate ►│ kind                 │
│ SCO properties       │── Kind-specific ────►│ payload              │
│ .x_tsingou_metadata  │── Restore ──────────►│ metadata             │
└─────────────────────┘                       └─────────────────────┘
```

---

## TSG.D.2 BaseSignal to STIX SDO Mapping

### TSG.D.2.1 signal-observation to observed-data

Every BaseSignal, regardless of kind, maps to a STIX `observed-data` SDO.
This is the primary export container. The `observed-data` SDO wraps one or
more SCOs that carry the signal payload content.

**Mapping Table: BaseSignal Core Fields to observed-data SDO**

| # | BaseSignal Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | `id` | `id` | Both | `"observed-data--" + UUIDv5(NS, signal.id)` | [R] | Deterministic UUID v5 from signal ID |
| 2 | (constant) | `type` | Encode | `"observed-data"` | [R] | Literal string |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | STIX version literal |
| 4 | `timestamp` | `created` | Both | `signal.timestamp.toISOString()` | [R] | ISO 8601 with Z suffix |
| 5 | `timestamp` | `modified` | Both | `signal.timestamp.toISOString()` | [R] | Same as created for initial export |
| 6 | `sourceId` | `created_by_ref` | Both | `IdentityProvider.resolve(signal.sourceId)` | [R] | Resolves to adapter identity STIX ID |
| 7 | `timestamp` | `first_observed` | Both | `signal.timestamp.toISOString()` | [R] | Signal production timestamp |
| 8 | `timestamp` | `last_observed` | Both | `signal.timestamp.toISOString()` | [R] | Same as first for single observation |
| 9 | (constant) | `number_observed` | Encode | `1` | [R] | One signal = one observation |
| 10 | `kind` + `payload` | `object_refs` | Both | `generateScos(signal).map(s => s.id)` | [R] | References to generated SCOs |
| 11 | (config) | `object_marking_refs` | Encode | `MarkingProvider.defaultMarkings()` | [O] | TLP marking references |
| 12 | (config) | `confidence` | Encode | `95` (direct observation) | [O] | Per TSG.12.7.1 confidence scale |
| 13 | `version` | `x_tsingou_metadata.signal_version` | Encode | `[tick, source_seq]` tuple | [O] | Preserved for round-trip |
| 14 | `id` | `x_tsingou_metadata.signal_id` | Encode | Raw signal ID string | [O] | Original ID for reverse lookup |
| 15 | `metadata` | `x_tsingou_metadata.adapter_metadata` | Encode | Pass-through JSON | [O] | Adapter-specific context bag |
| 16 | (derived) | `labels` | Encode | `[signal.kind]` | [O] | Signal kind as label |
| 17 | (constant) | `lang` | Encode | `"en"` | [O] | Default language |

**Reverse Mapping: observed-data SDO to BaseSignal**

| # | STIX Property | BaseSignal Field | Dir | Transform | Notes |
|---|---------------|-----------------|-----|-----------|-------|
| 1 | `id` | `id` | Decode | `UuidMapper.reverseMap(stixUuid)` or generate new | Reverse UUID lookup |
| 2 | `created_by_ref` | `sourceId` | Decode | `IdentityProvider.resolveSourceId(identityRef)` | Maps identity back to SourceId |
| 3 | `first_observed` | `timestamp` | Decode | `new Date(first_observed)` | Parse ISO 8601 to Date |
| 4 | `x_tsingou_metadata.signal_version` | `version` | Decode | `[tick, source_seq]` or `[0, 0]` | Restore if present, default otherwise |
| 5 | SCO type discriminator | `kind` | Decode | `discriminateKind(scos)` | Infer kind from primary SCO type |
| 6 | SCO properties | `payload` | Decode | Kind-specific reverse mapper | See per-kind tables below |
| 7 | `x_tsingou_metadata.adapter_metadata` | `metadata` | Decode | Pass-through or `undefined` | Restore if present |

### TSG.D.2.2 emitter-profile to infrastructure

When Tsingou exports source adapter profiles as intelligence objects, the
adapter registration data maps to the STIX `infrastructure` SDO.

**Mapping Table: Adapter Registration to infrastructure SDO**

| # | Adapter Field | STIX Property | Dir | Transform | Req | Notes |
|---|--------------|---------------|-----|-----------|-----|-------|
| 1 | `adapterId` | `id` | Encode | `"infrastructure--" + UUIDv5(NS, adapterId)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"infrastructure"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `registeredAt` | `created` | Encode | ISO 8601 | [R] | Registration timestamp |
| 5 | `registeredAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [R] | Tsingou platform |
| 7 | `adapterName` | `name` | Encode | Direct copy | [R] | Human-readable name |
| 8 | `kind` | `description` | Encode | `"Tsingou ${kind} signal adapter"` | [O] | Kind-based description |
| 9 | `kind` | `infrastructure_types` | Encode | `mapKindToInfraType(kind)` | [O] | See table below |
| 10 | `sourceId` | `aliases` | Encode | `[sourceId]` | [O] | SourceId as alias |
| 11 | `health.status` | `x_tsingou_adapter_status` | Encode | Direct copy | [O] | Custom property |
| 12 | `health.signalCount` | `x_tsingou_signal_count` | Encode | Direct copy | [O] | Custom property |

**Kind to Infrastructure Type Mapping:**

| Signal Kind | infrastructure_types | Rationale |
|-------------|---------------------|-----------|
| nats | `["command-and-control"]` | Messaging infrastructure |
| http | `["command-and-control"]` | HTTP endpoint monitoring |
| websocket | `["command-and-control"]` | Persistent connection monitoring |
| midi | `["unknown"]` | No standard CTI infrastructure type |
| osc | `["unknown"]` | No standard CTI infrastructure type |
| serial | `["unknown"]` | Hardware interface |
| rss | `["unknown"]` | News/feed infrastructure |
| file-watch | `["hosting-target-lists"]` | File system monitoring |

### TSG.D.2.3 threat-assessment to indicator

When the d2ts analysis engine produces anomaly assessments, these map to
STIX `indicator` SDOs with machine-generated STIX patterns.

**Mapping Table: D2tsAnomaly to indicator SDO**

| # | Anomaly Field | STIX Property | Dir | Transform | Req | Notes |
|---|--------------|---------------|-----|-----------|-----|-------|
| 1 | `anomalyId` | `id` | Encode | `"indicator--" + UUIDv5(NS, anomalyId)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"indicator"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `detectedAt` | `created` | Encode | ISO 8601 | [R] | Detection timestamp |
| 5 | `detectedAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [R] | Automated detection |
| 7 | `anomalyName` | `name` | Encode | Direct copy | [R] | Human-readable anomaly name |
| 8 | `description` | `description` | Encode | Direct copy | [O] | Anomaly explanation |
| 9 | `anomalyType` | `indicator_types` | Encode | `mapAnomalyTypeToIndicatorType()` | [R] | See table below |
| 10 | `parameters` | `pattern` | Encode | `generateStixPattern(anomaly)` | [R] | STIX Patterning Language |
| 11 | (constant) | `pattern_type` | Encode | `"stix"` | [R] | Pattern language identifier |
| 12 | `detectedAt` | `valid_from` | Encode | ISO 8601 | [R] | Pattern validity start |
| 13 | `expiresAt` | `valid_until` | Encode | ISO 8601 or omit | [O] | Pattern expiration |
| 14 | `confidence` | `confidence` | Encode | Integer 0-100 | [O] | Anomaly confidence score |
| 15 | `signalIds` | `x_tsingou_source_signals` | Encode | Array of signal IDs | [O] | Provenance tracking |
| 16 | `technique` | `x_tsingou_technique` | Encode | Analysis technique name | [O] | Which d2ts operator |
| 17 | `severity` | `labels` | Encode | `["severity:" + severity]` | [O] | Severity label |

**Anomaly Type to Indicator Type Mapping:**

| Anomaly Type | indicator_types | STIX Pattern Template |
|-------------|-----------------|----------------------|
| throughput-spike | `["anomalous-activity"]` | `[<sco-type>:<field> > <threshold>]` |
| frequency-anomaly | `["anomalous-activity"]` | `[<sco-type>:<field> MATCHES '<pattern>']` |
| content-anomaly | `["malicious-activity"]` | `[<sco-type>:<content-field> MATCHES '<regex>']` |
| correlation-cluster | `["benign"]` | `[<sco-type>:<field> = <value>] FOLLOWEDBY ...` |
| statistical-outlier | `["anomalous-activity"]` | `[<sco-type>:<metric-field> > <z-threshold>]` |
| geospatial-anomaly | `["anomalous-activity"]` | `[location:latitude > <lat> AND ...]` |

### TSG.D.2.4 collection-campaign to campaign

Multi-signal collection operations map to the STIX `campaign` SDO when
the operator designates a set of correlated signal observations as a
coherent intelligence collection effort.

**Mapping Table: CollectionCampaign to campaign SDO**

| # | Campaign Field | STIX Property | Dir | Transform | Req | Notes |
|---|---------------|---------------|-----|-----------|-----|-------|
| 1 | `campaignId` | `id` | Encode | `"campaign--" + UUIDv5(NS, campaignId)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"campaign"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `startedAt` | `created` | Encode | ISO 8601 | [R] | Campaign creation |
| 5 | `lastModified` | `modified` | Encode | ISO 8601 | [R] | Last update |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [R] | Campaign creator |
| 7 | `name` | `name` | Encode | Direct copy | [R] | Campaign name |
| 8 | `description` | `description` | Encode | Direct copy | [O] | Campaign description |
| 9 | `startedAt` | `first_seen` | Encode | ISO 8601 | [O] | Campaign start |
| 10 | `endedAt` | `last_seen` | Encode | ISO 8601 | [O] | Campaign end |
| 11 | `objective` | `objective` | Encode | Direct copy | [O] | Collection objective |
| 12 | `aliases` | `aliases` | Encode | Direct copy | [O] | Alternative names |
| 13 | `signalKinds` | `x_tsingou_signal_kinds` | Encode | Array of signal kinds | [O] | Targeted kinds |
| 14 | `signalCount` | `x_tsingou_signal_count` | Encode | Integer | [O] | Total signals collected |

### TSG.D.2.5 intelligence-report to report

Aggregated analysis output from the d2ts pipeline maps to the STIX
`report` SDO, bundling related observations, indicators, and
relationships into a single coherent intelligence product.

**Mapping Table: AnalysisReport to report SDO**

| # | Report Field | STIX Property | Dir | Transform | Req | Notes |
|---|-------------|---------------|-----|-----------|-----|-------|
| 1 | `reportId` | `id` | Encode | `"report--" + UUIDv5(NS, reportId)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"report"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `createdAt` | `created` | Encode | ISO 8601 | [R] | Report generation timestamp |
| 5 | `modifiedAt` | `modified` | Encode | ISO 8601 | [R] | Last modification |
| 6 | `createdBy` | `created_by_ref` | Encode | Analyst or platform identity | [R] | Report author |
| 7 | `title` | `name` | Encode | Direct copy | [R] | Report title |
| 8 | `description` | `description` | Encode | Direct copy | [O] | Report summary |
| 9 | `publishedAt` | `published` | Encode | ISO 8601 | [R] | Publication timestamp |
| 10 | `objectIds` | `object_refs` | Encode | Array of STIX IDs for referenced objects | [R] | Bundle contents |
| 11 | `reportType` | `report_types` | Encode | `mapReportType()` | [O] | See table below |
| 12 | `confidence` | `confidence` | Encode | Integer 0-100 | [O] | Overall confidence |
| 13 | `tlp` | `object_marking_refs` | Encode | TLP marking definition ID | [O] | Classification |

**Report Type Mapping:**

| Tsingou Report Type | STIX report_types | Description |
|--------------------|-------------------|-------------|
| signal-summary | `["observed-data-summary"]` | Aggregated signal observations |
| threat-analysis | `["threat-report"]` | Threat assessment output |
| anomaly-report | `["threat-report"]` | Anomaly detection results |
| correlation-report | `["threat-report"]` | Signal correlation findings |
| collection-summary | `["campaign-summary"]` | Collection campaign results |
| technical-brief | `["indicator"]` | Technical indicator analysis |

---

## TSG.D.3 STIX SRO Mapping

### TSG.D.3.1 Signal Correlation to relationship (related-to)

When d2ts correlates two signals (temporal proximity, shared attributes,
or statistical co-occurrence), the codec generates a `relationship` SRO
with `relationship_type = "related-to"`.

**Mapping Table: SignalCorrelation to relationship SRO**

| # | Correlation Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | `correlationId` | `id` | Encode | `"relationship--" + UUIDv5(NS, src + ":rel:related-to:" + tgt)` | [R] | Deterministic from source + target |
| 2 | (constant) | `type` | Encode | `"relationship"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `detectedAt` | `created` | Encode | ISO 8601 | [R] | Correlation detection time |
| 5 | `detectedAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [O] | Automated correlation |
| 7 | (constant) | `relationship_type` | Encode | `"related-to"` | [R] | Correlation relationship |
| 8 | `sourceSignalId` | `source_ref` | Encode | `"observed-data--" + UUIDv5(NS, sourceSignalId)` | [R] | Source observation |
| 9 | `targetSignalId` | `target_ref` | Encode | `"observed-data--" + UUIDv5(NS, targetSignalId)` | [R] | Target observation |
| 10 | `description` | `description` | Encode | Correlation explanation | [O] | Human-readable |
| 11 | `confidence` | `confidence` | Encode | Integer 0-100 | [O] | Correlation confidence |
| 12 | `startTime` | `start_time` | Encode | ISO 8601 | [O] | Temporal window start |
| 13 | `endTime` | `stop_time` | Encode | ISO 8601 | [O] | Temporal window end |
| 14 | `technique` | `x_tsingou_technique` | Encode | Analysis technique name | [O] | d2ts operator used |
| 15 | `score` | `x_tsingou_correlation_score` | Encode | Float 0.0-1.0 | [O] | Correlation strength |

### TSG.D.3.2 Threat Attribution to relationship (attributed-to)

When an analyst or automated process attributes signal activity to a
known threat actor, the codec generates an `attributed-to` relationship.

**Mapping Table: ThreatAttribution to relationship SRO**

| # | Attribution Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | `attributionId` | `id` | Encode | `"relationship--" + UUIDv5(NS, src + ":rel:attributed-to:" + tgt)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"relationship"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `attributedAt` | `created` | Encode | ISO 8601 | [R] | Attribution timestamp |
| 5 | `attributedAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | `attributedBy` | `created_by_ref` | Encode | Analyst or platform identity | [R] | Attributor |
| 7 | (constant) | `relationship_type` | Encode | `"attributed-to"` | [R] | Attribution relationship |
| 8 | `observationId` | `source_ref` | Encode | `"observed-data--" + UUIDv5(NS, observationId)` | [R] | Attributed observation |
| 9 | `threatActorId` | `target_ref` | Encode | `"threat-actor--" + threatActorUuid` | [R] | Known threat actor |
| 10 | `rationale` | `description` | Encode | Attribution reasoning | [O] | Why attributed |
| 11 | `confidence` | `confidence` | Encode | Integer 0-100 | [O] | Attribution confidence |

### TSG.D.3.3 Signal Sequence to relationship (derived-from)

When one signal is derived from or triggered by another (e.g., an HTTP
response triggers an RSS feed check), the codec generates a
`derived-from` relationship.

**Mapping Table: SignalDerivation to relationship SRO**

| # | Derivation Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | `derivationId` | `id` | Encode | `"relationship--" + UUIDv5(NS, src + ":rel:derived-from:" + tgt)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"relationship"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `derivedAt` | `created` | Encode | ISO 8601 | [R] | Derivation timestamp |
| 5 | `derivedAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [O] | Automated derivation |
| 7 | (constant) | `relationship_type` | Encode | `"derived-from"` | [R] | Derivation relationship |
| 8 | `derivedSignalId` | `source_ref` | Encode | `"observed-data--" + UUIDv5(NS, derivedSignalId)` | [R] | Derived observation |
| 9 | `parentSignalId` | `target_ref` | Encode | `"observed-data--" + UUIDv5(NS, parentSignalId)` | [R] | Parent observation |
| 10 | `derivationMethod` | `description` | Encode | `"Derived via ${method}"` | [O] | How derived |

### TSG.D.3.4 Indicator-Based Relationship Types

When d2ts analysis produces indicators from observations, additional
relationship types connect the intelligence graph.

**Relationship Type Registry:**

| Source Type | Relationship Type | Target Type | When Generated |
|------------|------------------|-------------|----------------|
| indicator | `based-on` | observed-data | Indicator derived from signal observations |
| indicator | `indicates` | malware | Indicator matches known malware signature |
| indicator | `indicates` | attack-pattern | Indicator matches MITRE ATT&CK technique |
| observed-data | `related-to` | observed-data | Temporal/spatial signal correlation |
| observed-data | `derived-from` | observed-data | Derived signal from parent signal |
| campaign | `uses` | infrastructure | Campaign uses adapter infrastructure |
| threat-actor | `attributed-to` | campaign | Actor linked to collection campaign |
| report | `object-refs` | (multiple) | Report references its constituent objects |

### TSG.D.3.5 Sighting Generation from Signal Observations

When a signal matches a known indicator pattern, the codec generates a
`sighting` SRO. Sightings link real-time observations to threat
intelligence.

**Mapping Table: IndicatorMatch to sighting SRO**

| # | Match Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------|---------------|-----|-----------|-----|-------|
| 1 | `matchId` | `id` | Encode | `"sighting--" + UUIDv5(NS, signalId + ":sighting:" + indicatorId)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"sighting"` | [R] | Literal |
| 3 | (constant) | `spec_version` | Encode | `"2.1"` | [R] | Version |
| 4 | `matchedAt` | `created` | Encode | ISO 8601 | [R] | Match detection time |
| 5 | `matchedAt` | `modified` | Encode | ISO 8601 | [R] | Same initially |
| 6 | Platform identity | `created_by_ref` | Encode | Platform identity STIX ID | [R] | Automated matching |
| 7 | `signal.timestamp` | `first_seen` | Encode | ISO 8601 | [O] | Signal timestamp |
| 8 | `signal.timestamp` | `last_seen` | Encode | ISO 8601 | [O] | Same for single sighting |
| 9 | (constant) | `count` | Encode | `1` | [O] | Single match event |
| 10 | `indicatorId` | `sighting_of_ref` | Encode | Indicator STIX ID | [R] | Which indicator was sighted |
| 11 | `signalId` | `observed_data_refs` | Encode | `["observed-data--" + UUIDv5(NS, signalId)]` | [O] | Triggering observation |
| 12 | Platform identity | `where_sighted_refs` | Encode | `[platformIdentityId]` | [O] | Tsingou platform |
| 13 | `matchConfidence` | `confidence` | Encode | Integer 0-100 | [O] | Match confidence |
| 14 | `patternMatch` | `x_tsingou_pattern_match` | Encode | Match details | [O] | Which pattern fields matched |

**Sighting Generation Flow:**

```
Signal arrives
  │
  ▼
Pattern Matcher (d2ts operator)
  │  Compare signal against active indicators
  │  Evaluate STIX Pattern Language expressions
  │
  ├── No match → continue normal pipeline
  │
  └── Match found
       │
       ├── Generate sighting SRO
       ├── Generate relationship (sighting-of → indicator)
       ├── Attach to outbound STIX bundle
       │
       ▼
     TAXII col-correlations collection
```

---

## TSG.D.4 STIX SCO Mapping

### TSG.D.4.1 Network Signals to Standard SCOs

#### TSG.D.4.1.1 HTTP Signal to network-traffic + url + ipv4-addr + domain-name

**Mapping Table: HttpPayload to network-traffic SCO**

| # | HttpPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"network-traffic--" + UUIDv5(NS, signalId + ":sco:network-traffic:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"network-traffic"` | [R] | Literal |
| 3 | `url` (host) | `src_ref` | Encode | `"ipv4-addr--" + UUIDv5(...)` [C] | [O] | If client IP available |
| 4 | `url` (host) | `dst_ref` | Encode | `"ipv4-addr--" + UUIDv5(...)` [C] | [O] | Server IP or domain resolution |
| 5 | `url` (port) | `dst_port` | Encode | `parseInt(parsed.port) \|\| (https ? 443 : 80)` | [O] | Derived from URL |
| 6 | `url` (protocol) | `protocols` | Encode | `["tcp", protocol]` | [O] | tcp + http/https |
| 7 | `method` | `extensions.http-request-ext.request_method` | Encode | Direct copy | [O] | HTTP method |
| 8 | `url` (path) | `extensions.http-request-ext.request_value` | Encode | `parsed.pathname + parsed.search` | [O] | Request path + query |
| 9 | `headers` | `extensions.http-request-ext.request_header` | Encode | Direct copy | [O] | Request headers dict |
| 10 | `statusCode` | `x_tsingou_status_code` | Encode | Direct copy | [O] | Not in http-request-ext |
| 11 | `sseEventType` | `x_tsingou_sse_event_type` | Encode | Direct copy | [O] | SSE-specific |
| 12 | `sseEventId` | `x_tsingou_sse_event_id` | Encode | Direct copy | [O] | SSE-specific |

**Mapping Table: HttpPayload to url SCO**

| # | HttpPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"url--" + UUIDv5(NS, signalId + ":sco:url:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"url"` | [R] | Literal |
| 3 | `url` | `value` | Both | Direct copy | [R] | Full URL string |

**Mapping Table: HttpPayload to ipv4-addr / ipv6-addr SCO**

| # | HttpPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"<ip-type>--" + UUIDv5(NS, signalId + ":sco:<ip-type>:0")` | [R] | Deterministic |
| 2 | (derived) | `type` | Encode | `"ipv4-addr"` or `"ipv6-addr"` | [R] | Depends on address format |
| 3 | `url` (hostname) | `value` | Encode | Extracted IP from URL hostname | [R] | Only if hostname is IP literal |

**Mapping Table: HttpPayload to domain-name SCO**

| # | HttpPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"domain-name--" + UUIDv5(NS, signalId + ":sco:domain-name:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"domain-name"` | [R] | Literal |
| 3 | `url` (hostname) | `value` | Both | Extracted hostname from URL | [R] | Only if hostname is not IP |

**HTTP SCO Assembly Diagram:**

```
HttpPayload { url, method, statusCode, headers, body }
  │
  ├──► url SCO ──────────── { type: "url", value: payload.url }
  │
  ├──► domain-name SCO ──── { type: "domain-name", value: parsed.hostname }
  │    [C] only if hostname is not an IP literal
  │
  ├──► ipv4-addr SCO ────── { type: "ipv4-addr", value: parsed.hostname }
  │    [C] only if hostname is an IPv4 literal
  │
  ├──► ipv6-addr SCO ────── { type: "ipv6-addr", value: parsed.hostname }
  │    [C] only if hostname is an IPv6 literal
  │
  └──► network-traffic SCO ─ { type: "network-traffic",
                                dst_port: port,
                                protocols: ["tcp", "http"],
                                extensions: { http-request-ext: ... } }
       References: dst_ref → ip SCO, resolves_to_refs → domain SCO
```

#### TSG.D.4.1.2 WebSocket Signal to network-traffic + url + ipv4-addr

**Mapping Table: WebSocketPayload to network-traffic SCO**

| # | WebSocketPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|----------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"network-traffic--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"network-traffic"` | [R] | Literal |
| 3 | `url` (host) | `dst_ref` | Encode | IP address STIX ID | [O] | Server IP reference |
| 4 | `url` (port) | `dst_port` | Encode | `parseInt(parsed.port) \|\| (wss ? 443 : 80)` | [O] | WebSocket port |
| 5 | (constant) | `protocols` | Encode | `["tcp", "websocket"]` | [O] | TCP + WebSocket |
| 6 | `protocol` | `x_tsingou_ws_subprotocol` | Encode | Direct copy | [O] | Subprotocol negotiated |
| 7 | `type` | `x_tsingou_ws_message_type` | Encode | `"text"` or `"binary"` | [O] | Message frame type |
| 8 | `byteLength` | `x_tsingou_ws_byte_length` | Encode | Direct copy | [O] | Frame byte length |
| 9 | `connectionSeq` | `x_tsingou_ws_connection_seq` | Encode | Direct copy | [O] | Connection sequence number |

**Mapping Table: WebSocketPayload to url SCO**

| # | WebSocketPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|----------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"url--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"url"` | [R] | Literal |
| 3 | `url` | `value` | Both | Direct copy (ws:// or wss://) | [R] | Full WebSocket URL |

### TSG.D.4.2 File Signals to Standard SCOs

#### TSG.D.4.2.1 File-Watch Signal to file + directory + artifact

**Mapping Table: FileWatchPayload to file SCO**

| # | FileWatchPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|----------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"file--" + UUIDv5(NS, signalId + ":sco:file:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"file"` | [R] | Literal |
| 3 | `path` (basename) | `name` | Both | `path.basename(payload.path)` | [O] | File name only |
| 4 | `size` | `size` | Both | Direct copy | [O] | File size in bytes |
| 5 | `hash` | `hashes.SHA-256` | Both | Direct copy if SHA-256 | [O] | File hash |
| 6 | `mimeType` | `mime_type` | Both | Direct copy | [O] | Content type |
| 7 | (derived) | `parent_directory_ref` | Encode | `"directory--" + UUIDv5(...)` | [O] | Reference to directory SCO |
| 8 | `event` | `x_tsingou_event_type` | Encode | `"create"`, `"modify"`, `"delete"` | [O] | File system event type |
| 9 | `lineRange` | `x_tsingou_line_range` | Encode | `{ start, end }` | [O] | Affected line range |

**Mapping Table: FileWatchPayload to directory SCO**

| # | FileWatchPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|----------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"directory--" + UUIDv5(NS, signalId + ":sco:directory:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"directory"` | [R] | Literal |
| 3 | `path` (dirname) | `path` | Both | `path.dirname(payload.path)` | [R] | Parent directory path |

**Mapping Table: FileWatchPayload to artifact SCO**

| # | FileWatchPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|----------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"artifact--" + UUIDv5(NS, signalId + ":sco:artifact:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"artifact"` | [R] | Literal |
| 3 | `mimeType` | `mime_type` | Both | Direct copy | [O] | Content type |
| 4 | `content` | `payload_bin` | Encode | `base64(JSON.stringify(content))` | [O] | Base64-encoded content |

**File-Watch SCO Assembly Diagram:**

```
FileWatchPayload { path, event, content, size, mimeType, hash }
  │
  ├──► file SCO ─────────── { type: "file", name: basename,
  │                            size, hashes, mime_type,
  │                            parent_directory_ref: directory.id }
  │
  ├──► directory SCO ──────── { type: "directory", path: dirname }
  │    [always included]
  │
  └──► artifact SCO ────────  { type: "artifact",
       [C] only if content        mime_type, payload_bin: base64(content) }
       is non-empty
```

### TSG.D.4.3 RSS Signals to Standard SCOs

**Mapping Table: RssPayload to url SCO**

| # | RssPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"url--" + UUIDv5(NS, signalId + ":sco:url:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"url"` | [R] | Literal |
| 3 | `link` or `feedUrl` | `value` | Both | `payload.link \|\| payload.feedUrl` | [R] | Item or feed URL |

**Mapping Table: RssPayload to artifact SCO**

| # | RssPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"artifact--" + UUIDv5(NS, signalId + ":sco:artifact:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"artifact"` | [R] | Literal |
| 3 | (constant) | `mime_type` | Encode | `"text/html"` or `"text/plain"` | [O] | Content type |
| 4 | `content` or `description` | `payload_bin` | Encode | `base64(content \|\| description)` | [O] | RSS item content |

**Mapping Table: RssPayload to email-addr SCO**

| # | RssPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Encode | `"email-addr--" + UUIDv5(NS, signalId + ":sco:email-addr:0")` | [R] | Deterministic |
| 2 | (constant) | `type` | Encode | `"email-addr"` | [R] | Literal |
| 3 | `author` | `value` | Both | Direct copy | [R] | Author email address |
| 4 | `author` | `display_name` | Encode | Extracted name portion | [O] | If author has name + email format |

### TSG.D.4.4 Custom SCO Mappings

#### TSG.D.4.4.1 NATS Signal to x-tsingou-nats-message

**Mapping Table: NatsPayload to x-tsingou-nats-message SCO**

| # | NatsPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Both | `"x-tsingou-nats-message--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Both | `"x-tsingou-nats-message"` | [R] | Custom SCO type |
| 3 | (constant) | `spec_version` | Both | `"2.1"` | [R] | STIX version |
| 4 | (constant) | `extensions` | Encode | `{ "extension-definition--<nats-ext-uuid>": { "extension_type": "new-sco" } }` | [R] | Extension declaration |
| 5 | `subject` | `subject` | Both | Direct copy | [R] | NATS subject string |
| 6 | `data` | `data` | Both | Direct copy (JSON-serializable) | [O] | Parsed message payload |
| 7 | `data` | `raw_data` | Encode | `base64(JSON.stringify(data))` if data is binary | [O] | Alternative to `data` |
| 8 | `headers` | `headers` | Both | Direct copy | [O] | NATS message headers |
| 9 | `sequence` | `sequence` | Both | Direct copy | [O] | JetStream sequence number |
| 10 | `stream` | `stream` | Both | Direct copy | [O] | JetStream stream name |
| 11 | `consumer` | `consumer` | Both | Direct copy | [O] | JetStream consumer name |
| 12 | `replyTo` | `reply_to` | Both | Direct copy or `null` | [O] | NATS reply subject |
| 13 | `serverTimestamp` | `server_timestamp` | Both | `.toISOString()` / `new Date()` | [O] | Server-assigned time |

#### TSG.D.4.4.2 MIDI Signal to x-tsingou-midi-event

**Mapping Table: MidiPayload to x-tsingou-midi-event SCO**

| # | MidiPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Both | `"x-tsingou-midi-event--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Both | `"x-tsingou-midi-event"` | [R] | Custom SCO type |
| 3 | (constant) | `spec_version` | Both | `"2.1"` | [R] | STIX version |
| 4 | (constant) | `extensions` | Encode | `{ "extension-definition--<midi-ext-uuid>": { "extension_type": "new-sco" } }` | [R] | Extension declaration |
| 5 | `channel` | `channel` | Both | Direct copy (0-15) | [R] | MIDI channel |
| 6 | `type` | `message_type` | Both | Direct copy | [R] | note-on, note-off, cc, etc. |
| 7 | `note` | `note` | Both | Direct copy (0-127) | [O] | Note number |
| 8 | `velocity` | `velocity` | Both | Direct copy (0-127) | [O] | Note velocity |
| 9 | `cc` | `control_number` | Both | Direct copy (0-127) | [O] | CC number |
| 10 | `value` | `control_value` | Both | Direct copy (0-127) | [O] | CC value |
| 11 | `program` | `program` | Both | Direct copy (0-127) | [O] | Program number |
| 12 | `pitchBend` | `pitch_bend` | Both | Direct copy (-8192 to 8191) | [O] | Pitch bend value |
| 13 | `raw` | `raw_bytes` | Encode | `base64(Uint8Array.from(raw))` | [O] | Raw MIDI bytes |
| 14 | `deviceName` | `device_name` | Both | Direct copy | [O] | Source device name |
| 15 | `deviceId` | `device_id` | Both | Direct copy | [O] | Source device identifier |

#### TSG.D.4.4.3 OSC Signal to x-tsingou-osc-message

**Mapping Table: OscPayload to x-tsingou-osc-message SCO**

| # | OscPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Both | `"x-tsingou-osc-message--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Both | `"x-tsingou-osc-message"` | [R] | Custom SCO type |
| 3 | (constant) | `spec_version` | Both | `"2.1"` | [R] | STIX version |
| 4 | (constant) | `extensions` | Encode | `{ "extension-definition--<osc-ext-uuid>": { "extension_type": "new-sco" } }` | [R] | Extension declaration |
| 5 | `address` | `address` | Both | Direct copy (starts with `/`) | [R] | OSC address pattern |
| 6 | `args` | `args` | Both | JSON-serializable arg array | [O] | OSC argument values |
| 7 | `args` | `arg_types` | Encode | Derive OSC type tag string from arg JS types | [O] | Type tags: i, f, s, b, T, F, N |
| 8 | `timetag` | `timetag` | Both | ISO 8601 / NTP timestamp | [O] | OSC bundle timetag |
| 9 | `isBundle` | `is_bundle` | Both | Direct copy | [O] | Bundle indicator |
| 10 | `remoteAddress` | `remote_address` | Both | Direct copy | [O] | Sender IP:port |

#### TSG.D.4.4.4 Serial Signal to x-tsingou-serial-data

**Mapping Table: SerialPayload to x-tsingou-serial-data SCO**

| # | SerialPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-------------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Both | `"x-tsingou-serial-data--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Both | `"x-tsingou-serial-data"` | [R] | Custom SCO type |
| 3 | (constant) | `spec_version` | Both | `"2.1"` | [R] | STIX version |
| 4 | (constant) | `extensions` | Encode | `{ "extension-definition--<serial-ext-uuid>": { "extension_type": "new-sco" } }` | [R] | Extension declaration |
| 5 | `port` | `port` | Both | Direct copy (e.g., `/dev/ttyUSB0`) | [R] | Serial port path |
| 6 | `baudRate` | `baud_rate` | Both | Direct copy | [R] | Connection baud rate |
| 7 | `raw` | `raw_data` | Encode | `base64(Uint8Array)` | [O] | Raw serial bytes |
| 8 | `parsed` | `parsed_data` | Both | Direct copy (JSON) | [O] | Parsed payload |
| 9 | `parserType` | `parser_type` | Both | Direct copy | [O] | Parser identifier |
| 10 | `delimiter` | `delimiter` | Both | Direct copy | [O] | Line delimiter |
| 11 | `vendorId` | `vendor_id` | Both | Direct copy | [O] | USB vendor ID |
| 12 | `productId` | `product_id` | Both | Direct copy | [O] | USB product ID |
| 13 | `manufacturer` | `manufacturer` | Both | Direct copy | [O] | Device manufacturer |

#### TSG.D.4.4.5 SDR Signal to x-tsingou-sdr-capture (Planned)

**Mapping Table: SdrPayload to x-tsingou-sdr-capture SCO**

| # | SdrPayload Field | STIX Property | Dir | Transform | Req | Notes |
|---|-----------------|---------------|-----|-----------|-----|-------|
| 1 | (derived) | `id` | Both | `"x-tsingou-sdr-capture--" + UUIDv5(NS, ...)` | [R] | Deterministic |
| 2 | (constant) | `type` | Both | `"x-tsingou-sdr-capture"` | [R] | Custom SCO type |
| 3 | (constant) | `spec_version` | Both | `"2.1"` | [R] | STIX version |
| 4 | (constant) | `extensions` | Encode | `{ "extension-definition--<sdr-ext-uuid>": { "extension_type": "new-sco" } }` | [R] | Extension declaration |
| 5 | `centerFreqHz` | `center_frequency_hz` | Both | Direct copy | [R] | Center frequency in Hz |
| 6 | `sampleRate` | `sample_rate_hz` | Both | Direct copy | [R] | Sample rate |
| 7 | `bandwidthHz` | `bandwidth_hz` | Both | Direct copy | [O] | Capture bandwidth |
| 8 | `gainDb` | `gain_db` | Both | Direct copy | [O] | Receiver gain in dB |
| 9 | `deviceId` | `antenna` | Both | Direct copy | [O] | Antenna/device identifier |
| 10 | (derived) | `modulation` | Encode | Demodulation result if available | [O] | Detected modulation type |
| 11 | (derived) | `signal_power_dbm` | Encode | Computed from IQ samples | [O] | Measured signal power |
| 12 | (derived) | `noise_floor_dbm` | Encode | Computed from IQ samples | [O] | Measured noise floor |
| 13 | `sigmfAnnotation` | `sigmf_ref` | Both | SigMF metadata reference | [O] | Link to SigMF file |

---

## TSG.D.5 Custom Extension Specifications

### TSG.D.5.1 x-tsingou-signal-metadata (extension-definition)

This extension adds Tsingou-specific metadata to standard STIX SDOs
(primarily `observed-data`). It preserves BaseSignal fields that have
no native STIX equivalent, enabling lossless round-trip conversion.

**Extension Definition:**

```json
{
  "type": "extension-definition",
  "id": "extension-definition--a1b2c3d4-0001-5000-8000-000000000001",
  "spec_version": "2.1",
  "name": "Tsingou Signal Metadata Extension",
  "description": "Adds Tsingou-specific metadata properties to observed-data SDOs for lossless round-trip conversion between BaseSignal and STIX formats.",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "created_by_ref": "identity--<tsingou-platform-uuid>",
  "schema": "https://tsingou.example.com/stix/extensions/x-tsingou-signal-metadata/v1.0/schema.json",
  "version": "1.0.0",
  "extension_types": ["property-extension"]
}
```

**Property Specification:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `signal_id` | string | YES | Original BaseSignal ID (for reverse lookup) |
| `signal_version` | array[integer, integer] | NO | d2ts version tuple [tick, source_seq] |
| `signal_kind` | string | YES | BaseSignal kind discriminator value |
| `adapter_metadata` | object | NO | Original BaseSignal.metadata bag |
| `response_time_ms` | number | NO | HTTP response time (lost in standard STIX) |
| `sse_event_type` | string | NO | SSE event type (lost in standard STIX) |
| `sse_event_id` | string | NO | SSE event ID (lost in standard STIX) |
| `connection_seq` | integer | NO | WebSocket connection sequence (lost in standard STIX) |
| `line_range` | object | NO | File-watch line range { start, end } |
| `feed_title` | string | NO | RSS feed title (lost unless wrapped in report) |

**Usage in observed-data:**

```json
{
  "type": "observed-data",
  "id": "observed-data--<uuid>",
  "spec_version": "2.1",
  "extensions": {
    "extension-definition--a1b2c3d4-0001-5000-8000-000000000001": {
      "extension_type": "property-extension"
    }
  },
  "x_tsingou_signal_metadata": {
    "signal_id": "sig_abc123def456",
    "signal_version": [42, 7],
    "signal_kind": "http",
    "adapter_metadata": {
      "http.etag": "W/\"abc123\"",
      "http.cache-control": "max-age=300"
    },
    "response_time_ms": 142
  },
  "first_observed": "2026-02-18T10:30:00.000Z",
  "last_observed": "2026-02-18T10:30:00.000Z",
  "number_observed": 1,
  "object_refs": ["network-traffic--<uuid>", "url--<uuid>"]
}
```

### TSG.D.5.2 x-tsingou-rf-parameters (custom properties)

This extension adds RF signal processing parameters to the
`x-tsingou-sdr-capture` custom SCO. These properties carry DSP analysis
results that supplement the raw capture metadata.

**Property Specification:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `fft_size` | integer | NO | FFT window size used for spectral analysis |
| `fft_window` | string | NO | Windowing function (hann, hamming, blackman, kaiser) |
| `fft_overlap` | number | NO | FFT overlap ratio (0.0 to 1.0) |
| `snr_db` | number | NO | Computed signal-to-noise ratio in dB |
| `occupied_bandwidth_hz` | number | NO | Measured occupied bandwidth |
| `peak_frequency_hz` | number | NO | Detected peak frequency |
| `duty_cycle` | number | NO | Signal duty cycle (0.0 to 1.0) |
| `pulse_width_us` | number | NO | Detected pulse width in microseconds |
| `pulse_repetition_hz` | number | NO | Pulse repetition frequency |
| `iq_format` | string | NO | IQ sample format (cu8, cs8, cf32, cs16) |
| `iq_sample_count` | integer | NO | Number of IQ sample pairs in capture |
| `agc_enabled` | boolean | NO | Whether AGC was active during capture |

**Usage in x-tsingou-sdr-capture:**

```json
{
  "type": "x-tsingou-sdr-capture",
  "id": "x-tsingou-sdr-capture--<uuid>",
  "spec_version": "2.1",
  "extensions": {
    "extension-definition--<sdr-ext-uuid>": {
      "extension_type": "new-sco"
    }
  },
  "center_frequency_hz": 433920000,
  "sample_rate_hz": 2400000,
  "bandwidth_hz": 2000000,
  "gain_db": 40.2,
  "signal_power_dbm": -52.3,
  "noise_floor_dbm": -98.1,
  "x_tsingou_rf_parameters": {
    "fft_size": 1024,
    "fft_window": "hann",
    "fft_overlap": 0.5,
    "snr_db": 45.8,
    "occupied_bandwidth_hz": 150000,
    "peak_frequency_hz": 433918500,
    "iq_format": "cf32",
    "iq_sample_count": 65536
  }
}
```

### TSG.D.5.3 x-tsingou-geolocation-fix (extension to location)

This extension adds high-precision geolocation data to the STIX
`location` SDO, enabling signal geolocation from multi-receiver
triangulation or GPS-equipped collection platforms.

**Extension Definition:**

```json
{
  "type": "extension-definition",
  "id": "extension-definition--a1b2c3d4-0003-5000-8000-000000000003",
  "spec_version": "2.1",
  "name": "Tsingou Geolocation Fix Extension",
  "description": "High-precision geolocation data for signal source localization derived from multi-receiver triangulation, TDOA, or GPS fixes.",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "created_by_ref": "identity--<tsingou-platform-uuid>",
  "schema": "https://tsingou.example.com/stix/extensions/x-tsingou-geolocation-fix/v1.0/schema.json",
  "version": "1.0.0",
  "extension_types": ["property-extension"]
}
```

**Property Specification:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `fix_type` | string | YES | Fix method: gps, tdoa, aoa, multilateration, manual |
| `latitude_deg` | number | YES | WGS-84 latitude in decimal degrees |
| `longitude_deg` | number | YES | WGS-84 longitude in decimal degrees |
| `altitude_m` | number | NO | Altitude in meters above WGS-84 ellipsoid |
| `cep_m` | number | NO | Circular Error Probable in meters (50th percentile) |
| `cep_95_m` | number | NO | 95th percentile CEP in meters |
| `bearing_deg` | number | NO | Signal bearing in degrees true north (AOA fixes) |
| `bearing_error_deg` | number | NO | Bearing error margin in degrees |
| `receiver_count` | integer | NO | Number of receivers used in fix computation |
| `receiver_ids` | array[string] | NO | Identifiers of contributing receivers |
| `hdop` | number | NO | Horizontal dilution of precision (GPS fixes) |
| `fix_timestamp` | timestamp | YES | When the fix was computed |
| `signal_ref` | identifier | NO | STIX ID of the signal observation that triggered the fix |
| `h3_index` | string | NO | H3 hexagonal index at resolution 9 |

**Usage in location SDO:**

```json
{
  "type": "location",
  "id": "location--<uuid>",
  "spec_version": "2.1",
  "latitude": 38.8977,
  "longitude": -77.0365,
  "precision": 50.0,
  "extensions": {
    "extension-definition--a1b2c3d4-0003-5000-8000-000000000003": {
      "extension_type": "property-extension"
    }
  },
  "x_tsingou_geolocation_fix": {
    "fix_type": "tdoa",
    "latitude_deg": 38.897700,
    "longitude_deg": -77.036500,
    "altitude_m": 12.5,
    "cep_m": 25.0,
    "cep_95_m": 75.0,
    "receiver_count": 3,
    "receiver_ids": ["sdr-rx-001", "sdr-rx-002", "sdr-rx-003"],
    "fix_timestamp": "2026-02-18T10:30:00.000Z",
    "h3_index": "8928308280fffff"
  }
}
```

---

## TSG.D.6 Effect Schema Codec Patterns

### TSG.D.6.1 Schema.transform for Encode/Decode

The codec uses `Schema.transform` to define bidirectional conversions
between BaseSignal types and STIX types. Each transform encodes the
field mapping logic specified in sections TSG.D.2 through TSG.D.4.

**Pattern: BaseSignal Timestamp to STIX Timestamp**

```typescript
import { Schema } from "effect"

// BaseSignal uses Date objects; STIX uses ISO 8601 strings with Z suffix
const StixTimestamp = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
)

const DateToStixTimestamp = Schema.transform(
  Schema.DateFromSelf,            // From: JavaScript Date
  StixTimestamp,                   // To: STIX timestamp string
  {
    decode: (stixTs) => new Date(stixTs),           // STIX → Date
    encode: (date) => date.toISOString(),            // Date → STIX
  }
)
```

**Pattern: SignalId to STIX observed-data ID**

```typescript
const SignalIdToStixId = Schema.transform(
  SignalId,                        // From: branded signal ID
  StixId,                          // To: "observed-data--<uuid>"
  {
    decode: (stixId) => {
      // Extract UUID from STIX ID, reverse-map to SignalId
      const uuid = stixId.split("--")[1]
      return UuidMapper.reverseLookup(uuid) as SignalId
    },
    encode: (signalId) => {
      // Generate deterministic STIX ID from SignalId
      const uuid = UuidMapper.generateV5(TSINGOU_NS, signalId)
      return `observed-data--${uuid}` as StixId
    },
  }
)
```

### TSG.D.6.2 Bidirectional Conversion Examples

#### TSG.D.6.2.1 NATS Signal Round-Trip

```typescript
// Encode: NatsPayload → x-tsingou-nats-message SCO properties
const NatsPayloadToStixSco = Schema.transform(
  NatsPayload,
  TsingouNatsMessageSco,
  {
    decode: (sco) => ({
      subject: sco.subject,
      data: sco.data ?? (sco.raw_data
        ? JSON.parse(atob(sco.raw_data))
        : undefined),
      headers: sco.headers,
      sequence: sco.sequence,
      stream: sco.stream,
      consumer: sco.consumer,
      replyTo: sco.reply_to ?? undefined,
      serverTimestamp: sco.server_timestamp
        ? new Date(sco.server_timestamp)
        : undefined,
    }),
    encode: (payload) => ({
      subject: payload.subject,
      data: payload.data,
      raw_data: undefined,
      headers: payload.headers,
      sequence: payload.sequence,
      stream: payload.stream,
      consumer: payload.consumer,
      reply_to: payload.replyTo ?? null,
      server_timestamp: payload.serverTimestamp
        ? payload.serverTimestamp.toISOString()
        : undefined,
    }),
  }
)
```

#### TSG.D.6.2.2 HTTP Signal Round-Trip

```typescript
// Encode: HttpPayload → network-traffic + url SCO assembly
const HttpPayloadToStixScos = Schema.transform(
  HttpPayload,
  Schema.Struct({
    networkTraffic: NetworkTrafficSco,
    url: UrlSco,
    domain: Schema.optional(DomainNameSco),
    ip: Schema.optional(Schema.Union(Ipv4AddrSco, Ipv6AddrSco)),
  }),
  {
    decode: (scos) => ({
      url: scos.url.value,
      method: scos.networkTraffic.extensions?.["http-request-ext"]
        ?.request_method ?? "GET",
      statusCode: undefined,           // ~~> lossy
      body: undefined,                  // ~~> lossy
      headers: scos.networkTraffic.extensions?.["http-request-ext"]
        ?.request_header,
      contentType: scos.networkTraffic.extensions?.["http-request-ext"]
        ?.request_header?.["Content-Type"],
      responseTimeMs: undefined,        // ~~> lossy
    }),
    encode: (payload) => {
      const parsed = new URL(payload.url)
      return {
        networkTraffic: {
          dst_port: parsed.port
            ? parseInt(parsed.port)
            : (parsed.protocol === "https:" ? 443 : 80),
          protocols: ["tcp", parsed.protocol.replace(":", "")],
          extensions: payload.method ? {
            "http-request-ext": {
              request_method: payload.method,
              request_value: parsed.pathname + parsed.search,
              ...(payload.headers && {
                request_header: payload.headers,
              }),
            },
          } : undefined,
        },
        url: { value: payload.url },
        domain: !isIpAddress(parsed.hostname)
          ? { value: parsed.hostname }
          : undefined,
        ip: isIpAddress(parsed.hostname)
          ? { value: parsed.hostname }
          : undefined,
      }
    },
  }
)
```

#### TSG.D.6.2.3 MIDI Signal Round-Trip

```typescript
const MidiPayloadToStixSco = Schema.transform(
  MidiPayload,
  TsingouMidiEventSco,
  {
    decode: (sco) => ({
      channel: sco.channel,
      type: sco.message_type,
      note: sco.note,
      velocity: sco.velocity,
      cc: sco.control_number,
      value: sco.control_value,
      program: sco.program,
      pitchBend: sco.pitch_bend,
      raw: sco.raw_bytes
        ? Array.from(Uint8Array.from(atob(sco.raw_bytes), c => c.charCodeAt(0)))
        : undefined,
      deviceName: sco.device_name,
      deviceId: sco.device_id,
    }),
    encode: (payload) => ({
      channel: payload.channel,
      message_type: payload.type,
      note: payload.note,
      velocity: payload.velocity,
      control_number: payload.cc,
      control_value: payload.value,
      program: payload.program,
      pitch_bend: payload.pitchBend,
      raw_bytes: payload.raw
        ? btoa(String.fromCharCode(...payload.raw))
        : undefined,
      device_name: payload.deviceName,
      device_id: payload.deviceId,
    }),
  }
)
```

### TSG.D.6.3 Validation Rules per Mapping

Each codec transform MUST enforce the following validation rules at the
transformation boundary:

**Encode Validation (BaseSignal to STIX):**

| Rule ID | Scope | Validation | On Failure |
|---------|-------|------------|------------|
| EV-01 | All signals | `signal.id` is non-empty string | `CodecError.InvalidSignal` |
| EV-02 | All signals | `signal.timestamp` is valid Date | `CodecError.InvalidSignal` |
| EV-03 | All signals | `signal.kind` matches a known kind or registry entry | `CodecError.UnsupportedSignalKind` |
| EV-04 | HTTP | `payload.url` is parseable URL | `CodecError.InvalidSignal` |
| EV-05 | MIDI | `payload.channel` is 0-15, `payload.type` is valid MidiMessageType | `CodecError.InvalidSignal` |
| EV-06 | OSC | `payload.address` starts with `/` | `CodecError.InvalidSignal` |
| EV-07 | Serial | `payload.baudRate` is positive integer | `CodecError.InvalidSignal` |
| EV-08 | File-watch | `payload.path` is non-empty string | `CodecError.InvalidSignal` |
| EV-09 | RSS | `payload.feedUrl` is non-empty string | `CodecError.InvalidSignal` |
| EV-10 | WebSocket | `payload.url` is parseable URL | `CodecError.InvalidSignal` |
| EV-11 | NATS | `payload.subject` is non-empty string | `CodecError.InvalidSignal` |
| EV-12 | All STIX | Generated STIX ID matches `<type>--<uuid>` format | `CodecError.UuidMappingFailed` |
| EV-13 | All STIX | Timestamps conform to RFC 3339 with Z suffix | `CodecError.SchemaValidationFailed` |
| EV-14 | Bundles | `object_refs` all resolve to objects in the bundle | `CodecError.InvalidStix` |

**Decode Validation (STIX to BaseSignal):**

| Rule ID | Scope | Validation | On Failure |
|---------|-------|------------|------------|
| DV-01 | Bundles | Bundle `type` is `"bundle"` | `CodecError.InvalidStix` |
| DV-02 | Bundles | Bundle contains at least one object | `CodecError.InvalidStix` |
| DV-03 | observed-data | `spec_version` is `"2.1"` | `CodecError.InvalidStix` |
| DV-04 | observed-data | `first_observed` is valid RFC 3339 timestamp | `CodecError.InvalidStix` |
| DV-05 | observed-data | `object_refs` is non-empty array | `CodecError.InvalidStix` |
| DV-06 | SCO discrimination | Primary SCO type maps to a known signal kind | `CodecError.UnsupportedStixType` |
| DV-07 | Custom SCOs | Extension-definition reference is present | `CodecError.InvalidStix` |
| DV-08 | All STIX IDs | Format matches `<type>--<uuid>` | `CodecError.InvalidStix` |
| DV-09 | Timestamps | All timestamps parse to valid Date objects | `CodecError.SchemaValidationFailed` |
| DV-10 | Round-trip | Reconstructed BaseSignal passes `Schema.decodeUnknown(BaseSignal)` | `CodecError.SchemaValidationFailed` |

### TSG.D.6.4 Information Loss Registry

The following fields experience information loss during round-trip
conversion. Implementations SHOULD preserve these in the
`x_tsingou_signal_metadata` extension to enable lossless round-trip.

**Information Loss Matrix:**

| Signal Kind | BaseSignal Field | Direction | Loss Type | Mitigation |
|------------|-----------------|-----------|-----------|------------|
| http | `responseTimeMs` | Encode | Total loss | `x_tsingou_signal_metadata.response_time_ms` |
| http | `statusCode` | Encode | Total loss | `x_tsingou_signal_metadata.status_code` |
| http | `sseEventType` | Encode | Total loss | `x_tsingou_signal_metadata.sse_event_type` |
| http | `sseEventId` | Encode | Total loss | `x_tsingou_signal_metadata.sse_event_id` |
| http | `body` | Encode | Partial (base64 artifact) | Artifact SCO with `payload_bin` |
| websocket | `connectionSeq` | Encode | Total loss | `x_tsingou_signal_metadata.connection_seq` |
| websocket | `protocol` | Encode | Partial | `x_tsingou_ws_subprotocol` custom prop |
| websocket | `data` | Encode | Partial (base64 artifact) | Artifact SCO with `payload_bin` |
| rss | `feedTitle` | Encode | Total loss | `x_tsingou_signal_metadata.feed_title` |
| rss | `categories` | Encode | Total loss | `x_tsingou_signal_metadata.categories` |
| rss | `enclosureUrl` | Encode | Total loss | `x_tsingou_signal_metadata.enclosure_url` |
| file-watch | `lineRange` | Encode | Total loss | `x_tsingou_signal_metadata.line_range` |
| all | `version` | Encode | Total loss | `x_tsingou_signal_metadata.signal_version` |
| all | `metadata` | Encode | Total loss | `x_tsingou_signal_metadata.adapter_metadata` |

---

## TSG.D.7 NATS Subject to TAXII Collection Mapping

### TSG.D.7.1 Subject Topology Overview

The Tsingou NATS subject namespace (TSG.11.3) maps to TAXII 2.1
collections (TSG.14.4) through the NATS-TAXII bridge service. Each NATS
subject prefix corresponds to exactly one TAXII collection on the
Internal API Root.

**Subject-to-Collection Data Flow:**

```
NATS Subject Namespace                    TAXII Collections
═══════════════════════                    ═════════════════

tsingou.signals.nats.>    ──── bridge ──►  col-nats-obs
tsingou.signals.http.>    ──── bridge ──►  col-http-obs
tsingou.signals.websocket.> ── bridge ──►  col-ws-obs
tsingou.signals.midi.>    ──── bridge ──►  col-midi-obs
tsingou.signals.osc.>     ──── bridge ──►  col-osc-obs
tsingou.signals.serial.>  ──── bridge ──►  col-serial-obs
tsingou.signals.rss.>     ──── bridge ──►  col-rss-obs
tsingou.signals.file-watch.> ─ bridge ──►  col-file-obs
tsingou.signals.>         ──── bridge ──►  col-all-signals (aggregate)
                                │
tsingou.analysis.indicators.> ─ bridge ──►  col-indicators
tsingou.analysis.correlations.> bridge ──►  col-correlations
tsingou.analysis.reports.>  ── bridge ──►  col-reports
                                │
tsingou.identities.>      ──── bridge ──►  col-identities
```

### TSG.D.7.2 Subject-to-Collection Mapping Table

**Internal API Root (`/api/internal/`):**

| NATS Subject Pattern | TAXII Collection ID | Collection Title | STIX Types | can_read | can_write |
|---------------------|--------------------|--------------------|-----------|----------|-----------|
| `tsingou.signals.nats.>` | `col-nats-obs` | NATS Observations | observed-data, x-tsingou-nats-message | true | true |
| `tsingou.signals.http.>` | `col-http-obs` | HTTP Observations | observed-data, network-traffic, url, domain-name, ipv4-addr, ipv6-addr | true | true |
| `tsingou.signals.websocket.>` | `col-ws-obs` | WebSocket Observations | observed-data, network-traffic, url | true | true |
| `tsingou.signals.midi.>` | `col-midi-obs` | MIDI Observations | observed-data, x-tsingou-midi-event | true | true |
| `tsingou.signals.osc.>` | `col-osc-obs` | OSC Observations | observed-data, x-tsingou-osc-message, ipv4-addr | true | true |
| `tsingou.signals.serial.>` | `col-serial-obs` | Serial Observations | observed-data, x-tsingou-serial-data, artifact, software | true | true |
| `tsingou.signals.rss.>` | `col-rss-obs` | RSS Observations | observed-data, url, artifact, email-addr | true | true |
| `tsingou.signals.file-watch.>` | `col-file-obs` | File Observations | observed-data, file, directory, artifact | true | true |
| `tsingou.signals.>` | `col-all-signals` | All Signal Observations | observed-data, (all SCO types) | true | false |
| `tsingou.analysis.indicators.>` | `col-indicators` | Threat Indicators | indicator | true | false |
| `tsingou.analysis.correlations.>` | `col-correlations` | Correlations | relationship, sighting | true | false |
| `tsingou.analysis.reports.>` | `col-reports` | Analysis Reports | report, grouping | true | false |
| `tsingou.identities.>` | `col-identities` | Platform Identities | identity | true | false |

**Partner API Root (`/api/partner/`):**

| TAXII Collection ID | Source Collection | TLP Filter | STIX Types |
|--------------------|------------------|------------|-----------|
| `col-partner-indicators` | `col-indicators` | TLP:AMBER or below | indicator |
| `col-partner-correlations` | `col-correlations` | TLP:AMBER or below | relationship, sighting |
| `col-partner-network` | `col-http-obs`, `col-ws-obs` | TLP:GREEN or below | observed-data, network-traffic, url |

**Public API Root (`/api/public/`):**

| TAXII Collection ID | Source Collection | TLP Filter | STIX Types |
|--------------------|------------------|------------|-----------|
| `col-public-indicators` | `col-indicators` | TLP:CLEAR only | indicator |
| `col-public-reports` | `col-reports` | TLP:CLEAR only | report |

### TSG.D.7.3 Bridge Processing Pipeline

```
NATS JetStream
  │
  │  Consumer: "tsingou-taxii-bridge"
  │  Filter: "tsingou.signals.>"
  │  Deliver: push-based with flow control
  │
  ▼
┌──────────────────────────────────────────────────────┐
│                NATS-TAXII Bridge Service               │
│                                                        │
│  Stage 1: Subject Demultiplex                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Parse subject: tsingou.signals.<kind>.<source>  │   │
│  │ Route to collection: col-<kind>-obs             │   │
│  │ Also route to: col-all-signals (aggregate)      │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│  Stage 2: Batch Accumulator (per collection)           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Buffer signals for target collection            │   │
│  │ Flush trigger:                                  │   │
│  │   batch_size >= 100 signals                     │   │
│  │   OR timeout >= 5000ms                          │   │
│  │   OR buffer_bytes >= 5MB                        │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│  Stage 3: STIX Codec Encode                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ StixCodec.encodeBatch(signals)                  │   │
│  │ Produces: StixBundle with:                      │   │
│  │   - identities (deduplicated)                   │   │
│  │   - extension-definitions (deduplicated)        │   │
│  │   - observed-data SDOs (one per signal)         │   │
│  │   - SCOs (kind-specific)                        │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│  Stage 4: Collection Ingest                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TaxiiServer.ingestObjects(collectionId, bundle)  │   │
│  │ Internal API — bypasses HTTP for efficiency      │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│  Stage 5: Acknowledgment                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ JetStream: msg.ack() on success                 │   │
│  │ JetStream: msg.nak() on failure (retry)         │   │
│  │ Max retries: 3 before dead-letter               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
└──────────────────────────────────────────────────────┘
```

### TSG.D.7.4 Subject Wildcard to Collection Resolution

The bridge uses NATS wildcard matching to determine collection routing:

```
Subject Received                    Collection(s) Targeted
────────────────                    ───────────────────────

tsingou.signals.nats.feed-1        → col-nats-obs
                                   → col-all-signals

tsingou.signals.http.rss-bbc       → col-http-obs
                                   → col-all-signals

tsingou.signals.serial.sdr-001     → col-serial-obs
                                   → col-all-signals

tsingou.analysis.indicators.d2ts   → col-indicators

tsingou.analysis.correlations.auto → col-correlations

tsingou.identities.platform        → col-identities
```

**Resolution Algorithm:**

```
Input: NATS subject string
Output: Array<CollectionId>

1. Parse subject into tokens: split(".")
2. Match prefix against routing table:
   a. tsingou.signals.<kind>.* → col-<kind>-obs + col-all-signals
   b. tsingou.analysis.indicators.* → col-indicators
   c. tsingou.analysis.correlations.* → col-correlations
   d. tsingou.analysis.reports.* → col-reports
   e. tsingou.identities.* → col-identities
3. If no match → route to dead-letter subject
4. Return matched collection IDs
```

### TSG.D.7.5 Collection Metadata for TAXII Clients

External TAXII clients discover available collections via the standard
TAXII `/collections/` endpoint. Each collection exposes metadata derived
from the NATS subject mapping:

```json
{
  "collections": [
    {
      "id": "col-http-obs",
      "title": "HTTP Observations",
      "description": "Signal observations from HTTP source adapters including REST API polls, SSE streams, and webhook receivers.",
      "can_read": true,
      "can_write": true,
      "media_types": [
        "application/stix+json;version=2.1"
      ],
      "x_tsingou_nats_subject": "tsingou.signals.http.>",
      "x_tsingou_signal_kind": "http"
    },
    {
      "id": "col-indicators",
      "title": "Threat Indicators",
      "description": "Machine-generated threat indicators from the d2ts analysis engine.",
      "can_read": true,
      "can_write": false,
      "media_types": [
        "application/stix+json;version=2.1"
      ],
      "x_tsingou_nats_subject": "tsingou.analysis.indicators.>",
      "x_tsingou_signal_kind": null
    }
  ]
}
```

### TSG.D.7.6 Inbound TAXII-to-NATS Mapping

When the Tsingou TAXII Client ingests external STIX bundles, the bridge
reverses the mapping — decoded BaseSignals are published to the
appropriate NATS subject.

**Inbound Mapping Table:**

| STIX Object Type | NATS Subject | Signal Kind | Notes |
|-----------------|-------------|-------------|-------|
| observed-data (with network-traffic) | `tsingou.signals.http.<source>` | http | Discriminated by SCO type |
| observed-data (with url, no network-traffic) | `tsingou.signals.rss.<source>` | rss | URL-only observations |
| observed-data (with file) | `tsingou.signals.file-watch.<source>` | file-watch | File observations |
| observed-data (with x-tsingou-nats-message) | `tsingou.signals.nats.<source>` | nats | NATS message observations |
| observed-data (with x-tsingou-midi-event) | `tsingou.signals.midi.<source>` | midi | MIDI event observations |
| observed-data (with x-tsingou-osc-message) | `tsingou.signals.osc.<source>` | osc | OSC message observations |
| observed-data (with x-tsingou-serial-data) | `tsingou.signals.serial.<source>` | serial | Serial data observations |
| observed-data (with x-tsingou-sdr-capture) | `tsingou.signals.sdr.<source>` | sdr | SDR capture observations |
| indicator | `tsingou.analysis.indicators.external` | (n/a) | External indicators |
| relationship | `tsingou.analysis.correlations.external` | (n/a) | External relationships |
| sighting | `tsingou.analysis.correlations.external` | (n/a) | External sightings |
| report | `tsingou.analysis.reports.external` | (n/a) | External reports |
| identity | `tsingou.identities.external` | (n/a) | External identities |

**Inbound Flow Diagram:**

```
External TAXII Server
  │
  │  GET /api/{root}/collections/{id}/objects/
  │  Accept: application/stix+json;version=2.1
  │
  ▼
┌──────────────────────────────────────┐
│       Tsingou TAXII Client            │
│                                        │
│  1. Fetch STIX bundle from collection  │
│  2. Validate bundle structure          │
│  3. StixCodec.decodeBundle(bundle)     │
│     → Array<BaseSignal>                │
│  4. For each signal:                   │
│     a. Determine NATS subject from     │
│        signal.kind + source identity   │
│     b. nats.publish(subject, signal)   │
│  5. Track last-fetched timestamp       │
│     (added_after parameter)            │
│                                        │
└──────────────────────────────────────┘
  │
  ▼
NATS JetStream (tsingou.signals.>)
  │
  ▼
Standard signal pipeline processing
```

---

## TSG.D.8 UUID Mapping Reference

### TSG.D.8.1 UUID Generation Formulas

All STIX IDs are generated deterministically from BaseSignal IDs using
UUID v5 [RFC4122] with a deployment-specific namespace.

| Object Category | Input String | STIX ID Format |
|----------------|-------------|----------------|
| observed-data SDO | `signalId + ":observed-data"` | `"observed-data--" + UUIDv5(NS, input)` |
| Primary SCO | `signalId + ":sco:" + scoType + ":0"` | `"<scoType>--" + UUIDv5(NS, input)` |
| Secondary SCO (nth) | `signalId + ":sco:" + scoType + ":" + n` | `"<scoType>--" + UUIDv5(NS, input)` |
| Bundle | `signalId + ":bundle"` | `"bundle--" + UUIDv5(NS, input)` |
| Indicator | `anomalyId + ":indicator"` | `"indicator--" + UUIDv5(NS, input)` |
| Sighting | `signalId + ":sighting:" + indicatorId` | `"sighting--" + UUIDv5(NS, input)` |
| Relationship | `sourceId + ":rel:" + relType + ":" + targetId` | `"relationship--" + UUIDv5(NS, input)` |
| Campaign | `campaignId + ":campaign"` | `"campaign--" + UUIDv5(NS, input)` |
| Report | `reportId + ":report"` | `"report--" + UUIDv5(NS, input)` |
| Infrastructure | `adapterId + ":infrastructure"` | `"infrastructure--" + UUIDv5(NS, input)` |

### TSG.D.8.2 UUID Namespace Configuration

```
Deployment Namespace Derivation:

Step 1: Start with DNS namespace UUID
  DNS_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

Step 2: Derive Tsingou namespace
  TSINGOU_NS = UUIDv5(DNS_NS, "tsingou.stix.local")

Step 3: (Recommended) Derive deployment-specific namespace
  DEPLOY_NS = UUIDv5(TSINGOU_NS, deployment_identifier)

Implementations SHOULD use DEPLOY_NS for production deployments
to prevent UUID prediction attacks (TSG.12.10.3).
```

### TSG.D.8.3 Example UUID Trace

```
Input:
  signalId = "sig_abc123def456"
  kind = "nats"
  namespace = TSINGOU_NS

Step 1: observed-data SDO
  input = "sig_abc123def456:observed-data"
  uuid  = UUIDv5(TSINGOU_NS, "sig_abc123def456:observed-data")
        = "7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c"
  id    = "observed-data--7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c"

Step 2: Primary SCO (x-tsingou-nats-message)
  input = "sig_abc123def456:sco:x-tsingou-nats-message:0"
  uuid  = UUIDv5(TSINGOU_NS, "sig_abc123def456:sco:x-tsingou-nats-message:0")
        = "a1b2c3d4-e5f6-5789-abcd-ef1234567890"
  id    = "x-tsingou-nats-message--a1b2c3d4-e5f6-5789-abcd-ef1234567890"

Step 3: Bundle
  input = "sig_abc123def456:bundle"
  uuid  = UUIDv5(TSINGOU_NS, "sig_abc123def456:bundle")
        = "b2c3d4e5-f6a7-5890-bcde-f12345678901"
  id    = "bundle--b2c3d4e5-f6a7-5890-bcde-f12345678901"

Resulting STIX Bundle:
{
  "type": "bundle",
  "id": "bundle--b2c3d4e5-f6a7-5890-bcde-f12345678901",
  "objects": [
    {
      "type": "observed-data",
      "id": "observed-data--7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c",
      "object_refs": [
        "x-tsingou-nats-message--a1b2c3d4-e5f6-5789-abcd-ef1234567890"
      ]
    },
    {
      "type": "x-tsingou-nats-message",
      "id": "x-tsingou-nats-message--a1b2c3d4-e5f6-5789-abcd-ef1234567890",
      "subject": "tsingou.signals.temperature.sensor-01"
    }
  ]
}
```

---

## TSG.D.9 Confidence Mapping Reference

### TSG.D.9.1 Source-to-Confidence Table

| Intelligence Source | STIX Object Type | Confidence Range | Default | Rationale |
|--------------------|-----------------|-----------------|---------|-----------|
| Direct signal capture (adapter) | observed-data | 90-100 | 95 | Platform witnessed the signal firsthand |
| d2ts statistical anomaly | indicator | 60-80 | 70 | Algorithmic detection, FP-prone |
| d2ts graph correlation | relationship | 50-70 | 60 | Inferred relationship |
| d2ts temporal correlation | relationship | 55-75 | 65 | Time-based proximity |
| External TAXII feed | (varies) | 30-60 | 45 | Inherited from upstream; trust varies |
| Human analyst assertion | note, opinion | 70-95 | 80 | Explicit analyst confidence |
| Automated pattern match | sighting | 75-90 | 80 | Pattern matched signal |
| Multi-source fusion | report | 70-90 | 80 | Corroborated by multiple sources |

### TSG.D.9.2 Confidence Adjustment Rules

| Condition | Adjustment | Example |
|-----------|-----------|---------|
| Corroborated by 2+ independent sources | +10 (capped at 100) | Two adapters see same indicator |
| Signal older than 24h | -5 | Stale observation |
| Signal older than 7d | -15 | Aged observation |
| External source with known high quality | +5 | AlienVault OTX, VirusTotal |
| External source with unknown quality | -10 | Unvetted TAXII feed |
| Analyst explicit override | Set to analyst value | Manual confidence assignment |

---

## TSG.D.10 TLP Marking Mapping Reference

### TSG.D.10.1 Marking Definition IDs

| TLP Level | STIX Marking Definition ID | Application |
|-----------|--------------------------|-------------|
| TLP:CLEAR | `marking-definition--94868c89-83c2-464b-929b-a1a8aa3c8487` | Public indicators, published reports |
| TLP:GREEN | `marking-definition--bab4a63c-aed9-4b5f-a869-75b77dcc1ef3` | Community-shared observations |
| TLP:AMBER | `marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421` | Organization + trusted partners (default) |
| TLP:AMBER+STRICT | `marking-definition--939a9414-2ddd-4d32-a0cd-b7c2c2b9e2c8` | Organization only |
| TLP:RED | `marking-definition--e828b379-4e03-4974-9ac4-e53a884c97c1` | Named recipients only |

### TSG.D.10.2 Object-to-TLP Default Assignment

| STIX Object Type | Default TLP | Override | Propagation |
|-----------------|-------------|---------|-------------|
| observed-data (automated) | TLP:AMBER | YES (adapter config) | To contained SCOs |
| observed-data (external) | Inherit from source | NO | To contained SCOs |
| indicator (d2ts) | TLP:AMBER | YES (pipeline config) | To based-on relationships |
| indicator (analyst) | Per analyst setting | YES | To based-on relationships |
| relationship | Highest TLP of participants | NO | N/A |
| sighting | Inherit from sighted indicator | NO | N/A |
| report | Per creator setting | YES | To referenced objects |
| identity (platform) | TLP:CLEAR | NO | N/A |
| identity (adapter) | TLP:AMBER | NO | N/A |
| identity (analyst) | TLP:AMBER | NO | N/A |
| infrastructure | TLP:AMBER | YES | N/A |
| campaign | TLP:AMBER | YES | To uses relationships |

### TSG.D.10.3 TLP Downgrade Rules for API Roots

| Source TLP | Internal API Root | Partner API Root | Public API Root |
|-----------|------------------|-----------------|-----------------|
| TLP:CLEAR | Included | Included | Included |
| TLP:GREEN | Included | Included | Excluded |
| TLP:AMBER | Included | Included | Excluded |
| TLP:AMBER+STRICT | Included | Excluded | Excluded |
| TLP:RED | Included | Excluded | Excluded |

**TLP filtering is applied at the TAXII Server layer (TSG.14.4.2), NOT
at the codec layer.** The codec MUST preserve all TLP markings during
encoding. The TAXII server's collection filter strips objects that exceed
the API root's maximum TLP level.

---

## TSG.D.11 Extension Definition Registry

### TSG.D.11.1 Complete Extension Definition Table

| Extension ID | Name | Extension Type | SCO/SDO | Version | Schema URL |
|-------------|------|---------------|---------|---------|------------|
| `extension-definition--<nats-ext-uuid>` | Tsingou NATS Message Observable | `new-sco` | x-tsingou-nats-message | 1.0.0 | `.../x-tsingou-nats-message/v1.0/schema.json` |
| `extension-definition--<midi-ext-uuid>` | Tsingou MIDI Event Observable | `new-sco` | x-tsingou-midi-event | 1.0.0 | `.../x-tsingou-midi-event/v1.0/schema.json` |
| `extension-definition--<osc-ext-uuid>` | Tsingou OSC Message Observable | `new-sco` | x-tsingou-osc-message | 1.0.0 | `.../x-tsingou-osc-message/v1.0/schema.json` |
| `extension-definition--<serial-ext-uuid>` | Tsingou Serial Data Observable | `new-sco` | x-tsingou-serial-data | 1.0.0 | `.../x-tsingou-serial-data/v1.0/schema.json` |
| `extension-definition--<sdr-ext-uuid>` | Tsingou SDR Capture Observable | `new-sco` | x-tsingou-sdr-capture | 1.0.0 | `.../x-tsingou-sdr-capture/v1.0/schema.json` |
| `extension-definition--<meta-ext-uuid>` | Tsingou Signal Metadata Extension | `property-extension` | observed-data | 1.0.0 | `.../x-tsingou-signal-metadata/v1.0/schema.json` |
| `extension-definition--<geo-ext-uuid>` | Tsingou Geolocation Fix Extension | `property-extension` | location | 1.0.0 | `.../x-tsingou-geolocation-fix/v1.0/schema.json` |

### TSG.D.11.2 Bundle Inclusion Rules

Implementations MUST include extension-definition objects in bundles
according to the following rules:

```
For each object O in bundle.objects:
  If O.type starts with "x-tsingou-":
    Include extension-definition for O.type (new-sco)
  If O has property "x_tsingou_signal_metadata":
    Include extension-definition for signal-metadata (property-extension)
  If O has property "x_tsingou_geolocation_fix":
    Include extension-definition for geolocation-fix (property-extension)
  If O has property "x_tsingou_rf_parameters":
    Include extension-definition for sdr-capture (already included as new-sco)

Do NOT include extension-definitions for types NOT present in bundle.
Deduplicate: each extension-definition appears at most ONCE per bundle.
```

---

## TSG.D.12 Normative Requirements Summary

### TSG.D.12.1 MUST Requirements

| ID | Requirement | Section |
|----|------------|---------|
| TSG.D-R1 | Implementations MUST map every BaseSignal to an observed-data SDO | TSG.D.2.1 |
| TSG.D-R2 | STIX IDs MUST be generated deterministically via UUID v5 | TSG.D.8.1 |
| TSG.D-R3 | Timestamps MUST conform to RFC 3339 with Z suffix | TSG.D.6.3 |
| TSG.D-R4 | Bundle MUST contain extension-definitions for all custom SCOs | TSG.D.11.2 |
| TSG.D-R5 | Encode validation rules EV-01 through EV-14 MUST be enforced | TSG.D.6.3 |
| TSG.D-R6 | Decode validation rules DV-01 through DV-10 MUST be enforced | TSG.D.6.3 |
| TSG.D-R7 | Relationship SROs MUST inherit the highest TLP of participants | TSG.D.10.2 |
| TSG.D-R8 | Each NATS subject prefix MUST map to exactly one Internal collection | TSG.D.7.2 |
| TSG.D-R9 | Sighting SROs MUST reference the matched indicator via sighting_of_ref | TSG.D.3.5 |
| TSG.D-R10 | Custom SCO property names MUST NOT conflict with standard STIX properties | TSG.D.4.4 |

### TSG.D.12.2 SHOULD Requirements

| ID | Requirement | Section |
|----|------------|---------|
| TSG.D-S1 | Implementations SHOULD preserve lossy fields in x_tsingou_signal_metadata | TSG.D.6.4 |
| TSG.D-S2 | Implementations SHOULD maintain a reverse UUID lookup table | TSG.D.8.1 |
| TSG.D-S3 | Implementations SHOULD use deployment-specific namespace UUIDs | TSG.D.8.2 |
| TSG.D-S4 | Implementations SHOULD apply confidence adjustments per TSG.D.9.2 | TSG.D.9.2 |
| TSG.D-S5 | Implementations SHOULD include signal kind as an observed-data label | TSG.D.2.1 |

### TSG.D.12.3 MAY Requirements

| ID | Requirement | Section |
|----|------------|---------|
| TSG.D-M1 | Implementations MAY include the x-tsingou-rf-parameters extension | TSG.D.5.2 |
| TSG.D-M2 | Implementations MAY include geolocation fixes for SDR signals | TSG.D.5.3 |
| TSG.D-M3 | Implementations MAY extend the confidence adjustment rules | TSG.D.9.2 |

---

## References

| Key | Citation |
|-----|----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [RFC4122] | IETF, "A Universally Unique IDentifier (UUID) URN Namespace", July 2005 |
| [STIXPATT] | OASIS, "STIX Patterning Language", Part 9 of STIX 2.1, June 2020 |
| [TLP] | CISA, "Traffic Light Protocol (TLP) Definitions and Usage", Version 2.0 |
| [EFFECT] | Effect-TS, "Effect: The Missing Standard Library for TypeScript" |

---

*End of Appendix D*
