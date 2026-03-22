# TSG.15 CTI Platform Interoperability

```
Section:     TSG.15
Title:       CTI Platform Interoperability
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.12 (STIX Data Model), TSG.13 (STIX Codec), TSG.14 (TAXII Transport)
```

---

## TSG.15.1 Introduction

This section specifies how the Tsingou platform integrates with external Cyber Threat Intelligence (CTI) platforms for bidirectional intelligence exchange. While TSG.12-14 define the STIX data model, codec, and transport respectively, this section defines the **platform-specific adaptation layer** — the connectors, data transformations, and operational patterns required to interoperate with the CTI ecosystem.

### TSG.15.1.1 Normative References

| Key | Reference |
|-----|-----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [MISP] | CIRCL, "MISP — Malware Information Sharing Platform" |
| [OPENCTI] | Filigran, "OpenCTI — Open Cyber Threat Intelligence Platform" |
| [THEHIVE] | StrangeBee, "TheHive 5 — Security Incident Response Platform" |

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174].

### TSG.15.1.2 Connector Architecture

All platform connectors follow a common service model:

```
┌─────────────────────────────────────────────────────┐
│                  CtiBridge (Abstract)                 │
│                                                     │
│  ingest(source) → Stream<StixBundle>                │
│  publish(target, bundle) → Effect<Status>           │
│  subscribe(target, filter) → Stream<StixObject>     │
│  health(target) → Effect<HealthStatus>              │
└──────────────┬──────────────────────────────────────┘
               │ implements
    ┌──────────┼──────────┬──────────────┐
    │          │          │              │
┌───▼───┐ ┌───▼───┐ ┌────▼────┐ ┌──────▼──────┐
│OpenCTI│ │ MISP  │ │TheHive  │ │  Generic    │
│ Conn  │ │ Conn  │ │  Conn   │ │ TAXII Conn  │
└───────┘ └───────┘ └─────────┘ └─────────────┘
```

Each connector is an Effect.Service composable into the platform's Layer stack.

---

## TSG.15.2 OpenCTI Integration

### TSG.15.2.1 Integration Overview

OpenCTI [OPENCTI] is the PRIMARY integration target due to its native STIX 2.1 data model. Tsingou-generated STIX objects flow into OpenCTI with zero format translation.

| Property | Value |
|----------|-------|
| Protocol (inbound) | TAXII 2.1 (OpenCTI's built-in TAXII client) |
| Protocol (outbound) | GraphQL API + TAXII 2.1 |
| Data format | STIX 2.1 (native both sides) |
| Integration effort | LOW (3-5 days) |
| Bidirectional | YES |
| Priority | P0 |

### TSG.15.2.2 Inbound: OpenCTI → Tsingou

OpenCTI exports intelligence to Tsingou via two mechanisms:

**Mechanism A: TAXII Pull (Recommended)**

```
Tsingou TaxiiClient            OpenCTI TAXII Server
──────────────────             ─────────────────────

1. GET /taxii2/
   ◄── Discovery (API Roots)

2. GET /api/opencti/collections/
   ◄── Collection list

3. GET /api/opencti/collections/{id}/objects/
   ?added_after=<watermark>
   &match[type]=indicator,malware,threat-actor
   ◄── STIX bundle (indicators, malware profiles, actors)

4. StixCodec.decodeBundle → BaseSignal[]
   Publish to NATS: tsingou.ingestion.opencti.>

5. Update watermark in NATS KV
```

**Mechanism B: Stream Connector (Real-time)**

OpenCTI provides a Server-Sent Events (SSE) stream for real-time entity changes:

```
Tsingou OpenCTI Connector      OpenCTI SSE Endpoint
─────────────────────────      ─────────────────────

1. GET /stream?type=live
   Authorization: Bearer <token>
   Accept: text/event-stream

   ◄── data: {"data":{"type":"indicator","id":"indicator--...","x_opencti_patch":{...}}}
   ◄── data: {"data":{"type":"relationship","id":"relationship--...","x_opencti_patch":{...}}}

2. Parse SSE events → STIX objects
3. Filter by relevance (indicators, malware, threat-actors)
4. StixCodec.decodeBundle → BaseSignal[]
5. Publish to NATS: tsingou.ingestion.opencti.live.>
```

### TSG.15.2.3 Outbound: Tsingou → OpenCTI

OpenCTI consumes Tsingou intelligence via its built-in TAXII connector:

```
OpenCTI TAXII Connector        Tsingou TAXII Server
───────────────────────        ─────────────────────

1. OpenCTI admin configures TAXII connector:
   - Server URL: https://tsingou.example.com/taxii2/
   - API Root: /api/partner/
   - Collection: col-partner-indicators
   - Auth: Bearer token
   - Poll interval: 60s

2. OpenCTI polls Tsingou TAXII:
   GET /api/partner/collections/col-partner-indicators/objects/
   ?added_after=<last_sync>

   ◄── STIX bundle (observed-data, indicators, relationships)

3. OpenCTI ingests directly (STIX-native, no translation)
```

### TSG.15.2.4 OpenCTI Connector Service

```typescript
interface OpenCtiConnector {
  // TAXII-based pull (recommended)
  readonly pullViaAxi: (
    config: OpenCtiTaxiiConfig
  ) => Stream<StixBundle>

  // SSE-based real-time stream
  readonly streamViaSSE: (
    config: OpenCtiStreamConfig
  ) => Stream<StixObject>

  // GraphQL query (for specific entity lookups)
  readonly queryEntity: (
    config: OpenCtiGraphqlConfig,
    query: string,
    variables: Record<string, unknown>
  ) => Effect<unknown, OpenCtiError>

  // Health check
  readonly health: Effect<HealthStatus, OpenCtiError>
}
```

### TSG.15.2.5 OpenCTI Custom Extension Handling

OpenCTI uses custom STIX extensions (x-opencti-*) for internal entities. The Tsingou connector MUST:

1. Accept x-opencti-* types during STIX import without error
2. Preserve x-opencti-* extensions in pass-through scenarios
3. Map relevant x-opencti extensions to BaseSignal metadata:
   - `x_opencti_score` → signal metadata confidence
   - `x_opencti_detection` → signal metadata detection flag
   - `x_opencti_workflow_id` → ignored (OpenCTI internal)

---

## TSG.15.3 MISP Integration

### TSG.15.3.1 Integration Overview

MISP [MISP] is the most widely deployed open-source CTI platform with 6,000+ instances globally. Integration requires format translation between MISP's Event/Attribute model and STIX 2.1.

| Property | Value |
|----------|-------|
| Protocol (inbound) | MISP REST API + STIX export |
| Protocol (outbound) | MISP REST API + TAXII feed |
| Data format | MISP JSON (native), STIX 2.1 (export) |
| Integration effort | MEDIUM (5-8 days) |
| Bidirectional | YES |
| Priority | P1 |

### TSG.15.3.2 Inbound: MISP → Tsingou

**Path A: STIX Export (Preferred)**

```
Tsingou MISP Connector         MISP Server
──────────────────────         ────────────

1. POST /events/restSearch
   Content-Type: application/json
   Authorization: <api-key>
   Body: {
     "returnFormat": "stix2",
     "timestamp": "<last_sync_epoch>",
     "enforceWarninglist": true
   }

   ◄── STIX 2.1 bundle (MISP-generated)

2. StixCodec.decodeBundle → BaseSignal[]
   Note: MISP STIX export maps Events→Reports, Attributes→Indicators/SCOs

3. Publish to NATS: tsingou.ingestion.misp.<org>.>
4. Update sync watermark
```

**Path B: Native MISP JSON (For richer data)**

```
Tsingou MISP Connector         MISP Server
──────────────────────         ────────────

1. GET /events/restSearch
   Body: {
     "returnFormat": "json",
     "timestamp": "<last_sync_epoch>",
     "includeAttachments": false,
     "includeGalaxy": true,
     "includeSightings": true
   }

   ◄── MISP JSON events

2. MispToStixTransformer:
   - Event → report SDO
   - Attribute (to_ids=true) → indicator SDO (with STIX pattern)
   - Attribute (to_ids=false) → observed-data + SCO
   - Galaxy cluster → threat-actor / malware / attack-pattern SDO
   - Sighting → sighting SRO
   - Tag → object_marking_refs or labels

3. StixCodec.decodeBundle → BaseSignal[]
4. Publish to NATS: tsingou.ingestion.misp.<org>.>
```

### TSG.15.3.3 MISP-to-STIX Attribute Mapping

Implementations MUST map MISP attribute types to STIX objects:

| MISP Category | MISP Type | STIX Type | STIX Object |
|--------------|-----------|-----------|-------------|
| Network activity | ip-src | ipv4-addr | SCO |
| Network activity | ip-dst | ipv4-addr | SCO |
| Network activity | domain | domain-name | SCO |
| Network activity | url | url | SCO |
| Network activity | hostname | domain-name | SCO |
| Payload delivery | md5 | file (hashes) | SCO |
| Payload delivery | sha256 | file (hashes) | SCO |
| Payload delivery | filename | file (name) | SCO |
| Payload delivery | email-src | email-addr | SCO |
| Payload delivery | email-dst | email-addr | SCO |
| Artifacts | malware-sample | artifact + malware | SCO + SDO |
| External analysis | vulnerability | vulnerability | SDO |
| Attribution | threat-actor | threat-actor | SDO |
| Antivirus detection | detection-name | indicator | SDO (with pattern) |

### TSG.15.3.4 Outbound: Tsingou → MISP

Tsingou publishes to MISP via two mechanisms:

**Mechanism A: TAXII Feed**

Configure MISP to consume a Tsingou TAXII collection as a STIX feed:

1. MISP Admin → Sync Actions → Feeds → Add
2. Feed type: STIX (TAXII)
3. URL: `https://tsingou.example.com/api/partner/collections/col-partner-indicators/`
4. Auth: API key or OAuth token
5. Distribution: Your organization only
6. Pull frequency: 15 minutes

**Mechanism B: Direct REST API**

```
Tsingou MISP Connector         MISP Server
──────────────────────         ────────────

1. Tsingou d2ts produces indicator
2. StixCodec.encodeSignal → STIX indicator

3. Transform STIX → MISP Event:
   - indicator.name → Event.info
   - indicator.pattern → Attribute.value (parsed)
   - indicator.indicator_types → Event.tag (MISP taxonomy)
   - observed-data → Event.Object (MISP object)

4. POST /events/add
   Body: { "Event": { ... } }

5. POST /attributes/add/{event_id}
   Body: { "Attribute": { ... } }
```

### TSG.15.3.5 MISP Connector Service

```typescript
interface MispConnector {
  // Pull events since watermark
  readonly pullEvents: (
    config: MispConfig,
    since: Date
  ) => Stream<StixBundle>

  // Pull via native MISP JSON (richer data)
  readonly pullEventsNative: (
    config: MispConfig,
    since: Date
  ) => Stream<MispEvent>

  // Push indicator to MISP
  readonly pushIndicator: (
    config: MispConfig,
    indicator: StixIndicator
  ) => Effect<MispEvent, MispError>

  // Push observed-data as MISP attributes
  readonly pushObservation: (
    config: MispConfig,
    observedData: StixObservedData,
    scos: ReadonlyArray<StixSco>
  ) => Effect<MispAttribute[], MispError>

  // Sighting propagation
  readonly pushSighting: (
    config: MispConfig,
    sighting: StixSighting
  ) => Effect<MispSighting, MispError>

  // Health check
  readonly health: (config: MispConfig) => Effect<HealthStatus, MispError>
}
```

---

## TSG.15.4 TheHive Integration

### TSG.15.4.1 Integration Overview

TheHive [THEHIVE] is a Security Incident Response Platform (SIRP). Integration focuses on alert creation and case management, not bulk intelligence exchange.

| Property | Value |
|----------|-------|
| Protocol | REST API (v1) |
| Data format | TheHive JSON (Cases, Alerts, Observables) |
| Integration effort | MEDIUM (3-5 days) |
| Bidirectional | YES (alerts in, case findings out) |
| Priority | P1 |

### TSG.15.4.2 Inbound: Tsingou Alerts → TheHive

When d2ts detects a critical anomaly, Tsingou pushes an alert to TheHive:

```
Tsingou d2ts Engine            TheHive 5
───────────────────            ──────────

1. d2ts detects anomaly → StixCodec produces indicator + observed-data

2. StixToTheHiveTransformer:
   - indicator.name → Alert.title
   - indicator.description → Alert.description
   - indicator.indicator_types[0] → Alert.type
   - indicator.confidence → Alert.severity (mapped 0-100 → 1-4)
   - observed-data.object_refs → Alert.observables[]
   - SCO values → Observable.data (typed by SCO type)

3. POST /api/v1/alert
   Body: {
     "type": "tsingou-anomaly",
     "source": "Tsingou SIGINT Platform",
     "sourceRef": "<indicator-stix-id>",
     "title": "Anomalous NATS traffic pattern detected",
     "description": "d2ts statistical analysis detected...",
     "severity": 3,
     "tlp": 2,
     "pap": 2,
     "tags": ["tsingou", "d2ts", "nats-anomaly"],
     "observables": [
       { "dataType": "ip", "data": "198.51.100.1", "message": "Source IP" },
       { "dataType": "other", "data": "tsingou.signals.nats.temp", "message": "NATS subject" }
     ]
   }

4. TheHive returns Alert ID → stored in NATS KV for tracking
```

### TSG.15.4.3 Severity Mapping

| STIX Confidence Range | TheHive Severity | Label |
|----------------------|-----------------|-------|
| 0-25 | 1 | Low |
| 26-50 | 2 | Medium |
| 51-75 | 3 | High |
| 76-100 | 4 | Critical |

### TSG.15.4.4 Observable Type Mapping

| STIX SCO Type | TheHive Observable Type | Notes |
|--------------|----------------------|-------|
| ipv4-addr | ip | Direct mapping |
| ipv6-addr | ip | Direct mapping |
| domain-name | domain | Direct mapping |
| url | url | Direct mapping |
| file (name) | filename | Name property |
| file (hashes.SHA-256) | hash | SHA-256 hash |
| file (hashes.MD5) | hash | MD5 hash |
| email-addr | mail | Direct mapping |
| x-tsingou-nats-message | other | Subject as value |
| x-tsingou-midi-event | other | Channel + type as value |
| x-tsingou-osc-message | other | Address as value |
| x-tsingou-serial-data | other | Port + baud as value |
| network-traffic | other | Src:port → Dst:port as value |

### TSG.15.4.5 Outbound: TheHive Findings → Tsingou

When analysts close TheHive cases with findings, results flow back to Tsingou:

```
TheHive 5 Webhook              Tsingou TheHive Connector
─────────────────              ─────────────────────────

1. TheHive fires webhook on case close:
   POST /webhooks/thehive
   Body: {
     "operation": "Update",
     "objectType": "case",
     "object": {
       "status": "Resolved",
       "resolutionStatus": "TruePositive",
       "summary": "Confirmed malicious NATS traffic from ...",
       "tags": ["confirmed", "apt-28"],
       "observables": [...]
     }
   }

2. Tsingou TheHive Connector:
   - Case.resolutionStatus → sighting.confidence (TruePositive=95, FalsePositive=5)
   - Case.observables → sighting.observed_data_refs
   - Case.tags → relationship targets (e.g., "apt-28" → threat-actor lookup)

3. Generate STIX sighting + relationship SROs
4. Publish to NATS: tsingou.analysis.correlations.thehive.>
5. Optionally update original Tsingou indicator confidence
```

### TSG.15.4.6 TheHive Connector Service

```typescript
interface TheHiveConnector {
  // Push alert to TheHive
  readonly createAlert: (
    config: TheHiveConfig,
    indicator: StixIndicator,
    observedData: StixObservedData,
    scos: ReadonlyArray<StixSco>
  ) => Effect<TheHiveAlert, TheHiveError>

  // Handle webhook from TheHive
  readonly handleWebhook: (
    payload: TheHiveWebhookPayload
  ) => Effect<ReadonlyArray<StixObject>, TheHiveError>

  // Query case status
  readonly getCaseStatus: (
    config: TheHiveConfig,
    caseId: string
  ) => Effect<TheHiveCase, TheHiveError>

  // Run Cortex analyzer on observable
  readonly analyzeObservable: (
    config: TheHiveConfig,
    observable: TheHiveObservable,
    analyzerId: string
  ) => Effect<CortexReport, TheHiveError>

  // Health check
  readonly health: (config: TheHiveConfig) => Effect<HealthStatus, TheHiveError>
}
```

---

## TSG.15.5 Cortex Integration

### TSG.15.5.1 Integration Overview

Cortex is TheHive's analysis engine, providing 300+ analyzers for observable enrichment. Tsingou integrates with Cortex for automated signal enrichment.

| Property | Value |
|----------|-------|
| Protocol | REST API |
| Integration | Via TheHive or standalone |
| Bidirectional | YES (submit observables, receive reports) |
| Priority | P2 |

### TSG.15.5.2 Enrichment Pipeline

```
Tsingou Signal Pipeline
  │
  ▼
SCO Extraction (from observed-data)
  │  IP addresses, domains, URLs, file hashes
  ▼
Cortex Analyzer Dispatch
  │  Submit SCOs as Cortex observables
  │  Select analyzers by observable type
  ▼
Cortex Analysis
  │  VirusTotal, AbuseIPDB, Shodan, etc.
  │  Returns taxonomies + reports
  ▼
Enrichment Merge
  │  Update signal metadata with analysis results
  │  Generate STIX note SDOs with findings
  │  Update indicator confidence based on enrichment
  ▼
NATS Publish
  tsingou.enrichment.<analyzer>.>
```

### TSG.15.5.3 Analyzer Selection Matrix

| Observable Type | Recommended Analyzers | Expected Response |
|----------------|----------------------|-------------------|
| ip | AbuseIPDB, Shodan, MaxMind GeoIP, VirusTotal | Reputation score, geolocation, open ports |
| domain | PassiveTotal, DomainTools, VirusTotal | WHOIS, DNS history, reputation |
| url | VirusTotal, URLhaus, Google Safe Browsing | Reputation, malware detection |
| hash (SHA-256) | VirusTotal, MalwareBazaar, Hybrid Analysis | Malware family, detection rate |
| email | EmailRep, HaveIBeenPwned | Reputation, breach status |

### TSG.15.5.4 Custom Tsingou Analyzer

Implementations SHOULD provide a custom Cortex analyzer for cross-referencing TheHive observables against Tsingou's signal history:

| Property | Value |
|----------|-------|
| Name | Tsingou_SignalCorrelator |
| Version | 1.0 |
| Input types | ip, domain, url, hash, other |
| Output | Report with signal history, first/last seen, signal kinds |
| Integration | Queries Tsingou TAXII server via manifest-based search |

---

## TSG.15.6 Generic TAXII Connector

### TSG.15.6.1 Purpose

The generic TAXII connector enables Tsingou to consume any TAXII 2.1-compliant feed without platform-specific adaptation.

### TSG.15.6.2 Supported Feeds

| Feed Provider | TAXII URL | Content | Auth |
|--------------|-----------|---------|------|
| Anomali STAXX | taxii.anomali.com | Aggregated threat feeds | API Key |
| AlienVault OTX | otx.alienvault.com/taxii/ | Pulse indicators | API Key |
| Hail a TAXII | hailataxii.com | Community feeds | Anonymous |
| CISA AIS | ais.cisa.gov | US government indicators | mTLS |
| CIRCL OSINT | circl.lu/taxii/ | CIRCL open intelligence | API Key |

### TSG.15.6.3 Generic Connector Service

```typescript
interface GenericTaxiiConnector {
  // Configure and register a new feed
  readonly registerFeed: (
    config: TaxiiFeedConfig
  ) => Effect<FeedRegistration, TaxiiConnectorError>

  // Start polling registered feed
  readonly startPolling: (
    feedId: string
  ) => Effect<void, TaxiiConnectorError>

  // Stop polling
  readonly stopPolling: (
    feedId: string
  ) => Effect<void, TaxiiConnectorError>

  // Manual pull
  readonly pullNow: (
    feedId: string
  ) => Effect<SyncResult, TaxiiConnectorError>

  // List registered feeds with status
  readonly listFeeds: Effect<ReadonlyArray<FeedStatus>, TaxiiConnectorError>
}
```

---

## TSG.15.7 STIX Shifter Integration

### TSG.15.7.1 Purpose

STIX Shifter translates STIX patterns into native query languages for SIEMs and data stores. This enables Tsingou-generated indicators to trigger searches across the enterprise security stack.

### TSG.15.7.2 Integration Flow

```
Tsingou d2ts                   STIX Shifter               Target SIEM
───────────                    ─────────────               ───────────

1. d2ts produces STIX indicator:
   pattern: "[ipv4-addr:value = '198.51.100.1']"

2. StixShifterBridge.translate(pattern, "qradar"):
   ◄── "SELECT * FROM events WHERE sourceip = '198.51.100.1'"

3. StixShifterBridge.translate(pattern, "splunk"):
   ◄── 'index=* src_ip="198.51.100.1"'

4. Execute translated query against target SIEM

5. Results → STIX observed-data (via STIX Shifter reverse translate)

6. Publish findings to NATS: tsingou.enrichment.siem.<target>.>
```

### TSG.15.7.3 Supported Backends

| Backend | Query Language | Translation Quality |
|---------|---------------|-------------------|
| QRadar | AQL | Excellent |
| Splunk | SPL | Excellent |
| Elastic | EQL / Lucene | Good |
| Azure Sentinel | KQL | Good |
| CrowdStrike | FQL | Moderate |
| NATS (custom) | JetStream filter | Custom module needed |

### TSG.15.7.4 Custom NATS Module

Implementations SHOULD develop a STIX Shifter module that translates STIX patterns into NATS JetStream filters, enabling STIX-based queries against Tsingou's signal history:

```
STIX Pattern:
  [x-tsingou-nats-message:subject MATCHES '^tsingou\.signals\.nats\.temp']

Translated to NATS filter:
  Subject: tsingou.signals.nats.temp.>
  Consumer filter: subject prefix match
```

---

## TSG.15.8 Connector Lifecycle Management

### TSG.15.8.1 Connector States

```
┌─────────┐    configure    ┌────────────┐    start    ┌─────────┐
│ Unknown  │───────────────►│ Configured  │───────────►│ Running  │
└─────────┘                └────────────┘            └────┬────┘
                                  ▲                       │
                                  │    stop               │
                                  └───────────────────────┘
                                                          │
                                  ┌─────────┐    error    │
                                  │  Error   │◄───────────┘
                                  └────┬────┘
                                       │ retry (auto)
                                       └────────────────►Running
```

### TSG.15.8.2 Health Check Protocol

All connectors MUST implement a health check that returns:

```typescript
const HealthStatus = Schema.Struct({
  status: Schema.Literal("healthy", "degraded", "unhealthy"),
  lastSuccess: Schema.optional(Schema.DateFromString),
  lastFailure: Schema.optional(Schema.DateFromString),
  consecutiveFailures: Schema.Number.pipe(Schema.int()),
  latencyMs: Schema.optional(Schema.Number),
  details: Schema.optional(Schema.String),
})
```

Health checks MUST run at 60-second intervals. After 3 consecutive failures, the connector MUST transition to Error state and emit an alert to `tsingou.alerts.connector.<name>`.

### TSG.15.8.3 Connector Configuration Store

All connector configurations MUST be persisted in NATS KV:

```
Bucket: tsingou-cti-connectors
Key:    connector.<platform>.<instance-id>
Value:  {
  "platform": "opencti",
  "instanceId": "prod-opencti-01",
  "config": { ... },
  "state": "running",
  "lastSync": "2026-02-18T12:00:00Z",
  "watermark": "2026-02-18T11:55:00Z",
  "stats": {
    "objectsIngested": 12345,
    "objectsPublished": 6789,
    "errorsTotal": 3
  }
}
```

---

## TSG.15.9 Data Flow Patterns

### TSG.15.9.1 Hub-and-Spoke (Recommended)

Tsingou acts as a STIX hub, with platform-specific connectors as spokes:

```
                         ┌──────────────┐
                         │   Anomali     │ ─── TAXII feed
                         └──────┬───────┘
                                │
┌──────────┐            ┌───────▼────────┐            ┌──────────┐
│  MISP     │◄──────────│    Tsingou      │──────────►│  OpenCTI  │
│           │──────────►│    STIX Hub     │◄──────────│           │
└──────────┘    REST    │                │   TAXII    └──────────┘
                        │  NATS Fabric   │
                        │  d2ts Engine   │
┌──────────┐            │  STIX Codec    │            ┌──────────┐
│ TheHive   │◄──────────│                │──────────►│  SIEM     │
│           │──────────►│                │  (via      │ (QRadar)  │
└──────────┘   REST     └────────────────┘  STIX     └──────────┘
                                           Shifter)
```

### TSG.15.9.2 Intelligence Enrichment Loop

```
Signal arrives (BaseSignal)
  │
  ├─ Stage 1: Observation
  │  └─ Encode to STIX observed-data
  │     Publish to TAXII collection
  │
  ├─ Stage 2: Indicator Matching
  │  └─ Match against ingested indicators (from OpenCTI, MISP, feeds)
  │     Generate sighting SROs on match
  │
  ├─ Stage 3: External Enrichment
  │  └─ Submit SCOs to Cortex analyzers
  │     Merge enrichment results into signal metadata
  │
  ├─ Stage 4: Correlation
  │  └─ d2ts links related signals
  │     Generate relationship SROs
  │
  ├─ Stage 5: Alert Generation
  │  └─ High-confidence indicators → TheHive alerts
  │     Critical anomalies → TheHive cases
  │
  └─ Stage 6: Intelligence Publication
     └─ Enriched indicators → TAXII server
        Sightings + relationships → OpenCTI, MISP
        Analysis reports → all connected platforms
```

### TSG.15.9.3 TLP Compliance in Cross-Platform Flows

| Flow | Minimum TLP | Enforcement |
|------|------------|-------------|
| Tsingou → OpenCTI (partner) | TLP:AMBER | Collection-level filter |
| Tsingou → MISP (shared) | TLP:GREEN | Feed-level filter |
| Tsingou → TheHive (internal) | TLP:RED allowed | Per-alert marking |
| OpenCTI → Tsingou | Inherit source TLP | Preserve on import |
| MISP → Tsingou | Map MISP distribution → TLP | Distribution-to-TLP mapping |
| Public TAXII feed → Tsingou | TLP:CLEAR | Only public feeds |

**MISP Distribution to TLP Mapping:**

| MISP Distribution Level | TLP Equivalent |
|------------------------|----------------|
| 0 — Your organisation only | TLP:RED |
| 1 — This community only | TLP:AMBER |
| 2 — Connected communities | TLP:AMBER |
| 3 — All communities | TLP:GREEN |
| 4 — Sharing groups | Per-group TLP |
| 5 — Inherit event | Inherit parent |

---

## TSG.15.10 Error Handling and Resilience

### TSG.15.10.1 Error Categories

| Category | Examples | Recovery |
|----------|---------|----------|
| Transient network | Connection timeout, DNS failure | Exponential backoff retry |
| Authentication | Token expired, key revoked | Re-authenticate, alert admin |
| Rate limiting | 429 responses | Honor Retry-After header |
| Validation | Invalid STIX, schema mismatch | Log and skip object, continue batch |
| Platform outage | 503/502 responses | Circuit breaker, alert admin |
| Data conflict | Duplicate UUID, version conflict | Dedup strategy per platform |

### TSG.15.10.2 Circuit Breaker Pattern

Each connector MUST implement a circuit breaker:

| State | Behavior | Transition |
|-------|----------|-----------|
| Closed | Normal operation | → Open on 5 consecutive failures |
| Open | No requests sent | → Half-Open after 60s cooldown |
| Half-Open | Single probe request | → Closed on success, → Open on failure |

### TSG.15.10.3 Dead Letter Queue

Objects that fail ingestion after all retries MUST be published to a dead letter queue:

```
NATS Subject: tsingou.cti.dlq.<connector>.<reason>
Payload: {
  "originalObject": { ... },
  "error": "STIX validation failed: missing required property 'pattern'",
  "connector": "opencti-prod",
  "timestamp": "2026-02-18T12:00:00Z",
  "retryCount": 3
}
```

Operators MUST be able to inspect and replay dead letter queue items.

---

## TSG.15.11 Effect Layer Composition

### TSG.15.11.1 Connector Layer Stack

```typescript
// Individual connector layers
const OpenCtiConnectorLive = OpenCtiConnectorLayer.pipe(
  Layer.provide(TaxiiClientLive),
  Layer.provide(HttpClientLive),
  Layer.provide(StixCodecFull),
)

const MispConnectorLive = MispConnectorLayer.pipe(
  Layer.provide(HttpClientLive),
  Layer.provide(MispToStixTransformerLive),
  Layer.provide(StixCodecFull),
)

const TheHiveConnectorLive = TheHiveConnectorLayer.pipe(
  Layer.provide(HttpClientLive),
  Layer.provide(StixToTheHiveTransformerLive),
)

const GenericTaxiiConnectorLive = GenericTaxiiConnectorLayer.pipe(
  Layer.provide(TaxiiClientLive),
  Layer.provide(StixCodecFull),
)

// Combined CTI bridge layer
const CtiBridgeLive = Layer.mergeAll(
  OpenCtiConnectorLive,
  MispConnectorLive,
  TheHiveConnectorLive,
  GenericTaxiiConnectorLive,
).pipe(
  Layer.provide(NatsClientLive),
  Layer.provide(ConnectorConfigStoreLive),
  Layer.provide(CircuitBreakerLive),
  Layer.provide(MetricsCollectorLive),
)
```

---

## TSG.15.12 Implementation Phases

| Phase | Scope | Priority | Effort |
|-------|-------|----------|--------|
| Phase 1 | OpenCTI bidirectional (TAXII + SSE) | P0 | 3-5 days |
| Phase 2 | MISP inbound (STIX export pull) | P1 | 3-4 days |
| Phase 3 | TheHive alert push | P1 | 2-3 days |
| Phase 4 | MISP outbound (TAXII feed + REST push) | P1 | 2-3 days |
| Phase 5 | Generic TAXII connector (Anomali, OTX, CISA) | P2 | 2-3 days |
| Phase 6 | Cortex enrichment integration | P2 | 2-3 days |
| Phase 7 | STIX Shifter SIEM integration | P2 | 5-8 days |
| Phase 8 | Custom NATS STIX Shifter module | P3 | 3-5 days |

---

## TSG.15.13 Security Considerations

### TSG.15.13.1 Credential Management

All connector credentials MUST be:

1. Stored encrypted at rest (not in plaintext config files)
2. Rotated on a schedule (90-day maximum for API keys)
3. Scoped to minimum required permissions per platform
4. Audited for access patterns

Implementations SHOULD use NATS KV with server-side encryption for credential storage.

### TSG.15.13.2 Cross-Platform Trust

Implementations MUST NOT automatically trust intelligence from external platforms. All ingested STIX objects MUST:

1. Be validated against the STIX 2.1 schema
2. Have their TLP markings preserved and enforced
3. Be attributed to their source identity (not re-attributed to Tsingou)
4. Be tagged with ingestion source for provenance tracking

### TSG.15.13.3 Information Leakage Prevention

When publishing Tsingou intelligence to external platforms, implementations MUST:

1. Strip internal metadata (signal IDs, NATS subjects, internal identifiers)
2. Apply TLP filtering per API Root (TSG.14.3)
3. Redact payload content below the configured TLP threshold
4. Log all external publications for audit

---

## References

| Key | Citation |
|-----|----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [MISP] | CIRCL, "MISP — Malware Information Sharing Platform", https://www.misp-project.org/ |
| [OPENCTI] | Filigran, "OpenCTI — Open Cyber Threat Intelligence Platform", https://www.opencti.io/ |
| [THEHIVE] | StrangeBee, "TheHive 5 — Security Incident Response Platform", https://thehive-project.org/ |
| [CORTEX] | StrangeBee, "Cortex — Observable Analysis Engine", https://thehive-project.org/ |
| [STIXSHIFT] | IBM, "STIX-Shifter — Universal Data Source Connector", GitHub |

---

*End of Section TSG.15*
