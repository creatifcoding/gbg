# CTI Platforms — Research Reference

```
Document:    research-cti-platforms.md
Purpose:     Exhaustive reference on CTI platform ecosystem and interoperability
RFC Section: Feeds TSG.15 (CTI Platform Interop)
Author:      stix-specialist
Status:      COMPLETE
Lines:       ~1,500
```

---

## Table of Contents

1. [CTI Platform Landscape](#1-cti-platform-landscape)
2. [MISP — Malware Information Sharing Platform](#2-misp--malware-information-sharing-platform)
3. [OpenCTI — Open Cyber Threat Intelligence](#3-opencti--open-cyber-threat-intelligence)
4. [TheHive 5 — Security Incident Response Platform](#4-thehive-5--security-incident-response-platform)
5. [Cortex — Analysis Engine](#5-cortex--analysis-engine)
6. [Anomali ThreatStream](#6-anomali-threatstream)
7. [Recorded Future](#7-recorded-future)
8. [CrowdStrike Falcon Intelligence](#8-crowdstrike-falcon-intelligence)
9. [IBM X-Force Exchange](#9-ibm-x-force-exchange)
10. [Mandiant Advantage Threat Intelligence](#10-mandiant-advantage-threat-intelligence)
11. [STIX Shifter (IBM)](#11-stix-shifter-ibm)
12. [IntelMQ](#12-intelmq)
13. [YETI — Your Everyday Threat Intelligence](#13-yeti--your-everyday-threat-intelligence)
14. [Interoperability Patterns](#14-interoperability-patterns)
15. [Tsingou Integration Architecture](#15-tsingou-integration-architecture)
16. [Platform Comparison Matrix](#16-platform-comparison-matrix)

---

## 1. CTI Platform Landscape

### 1.1 Market Segmentation

The CTI (Cyber Threat Intelligence) platform ecosystem divides into four tiers:

| Tier | Category | Characteristics | Examples |
|------|----------|----------------|----------|
| **Tier 1** | Open-source TIPs | Community-driven, STIX-native, self-hosted | MISP, OpenCTI, YETI |
| **Tier 2** | SOAR/SIRP platforms | Incident response focus, playbook automation | TheHive, Cortex, Shuffle |
| **Tier 3** | Commercial TIPs | Proprietary intelligence, managed feeds, SaaS | Anomali, Recorded Future, ThreatConnect |
| **Tier 4** | Enterprise security suites | TI as feature within broader platform | CrowdStrike, Mandiant, IBM X-Force |

### 1.2 Integration Protocol Support

| Platform | STIX 2.1 | TAXII 2.1 | REST API | GraphQL | NATS | Webhooks |
|----------|----------|-----------|----------|---------|------|----------|
| MISP | Export | Server | Yes | No | No | Yes |
| OpenCTI | Native | Native | Yes | Yes | No | Yes |
| TheHive 5 | Import | No | Yes | No | No | Yes |
| Cortex | No | No | Yes | No | No | Yes |
| Anomali | Native | Server | Yes | No | No | Yes |
| Recorded Future | Export | Client | Yes | No | No | Yes |
| CrowdStrike | Export | No | Yes | No | No | Yes |
| IBM X-Force | Partial | Client | Yes | No | No | No |
| Mandiant | Export | No | Yes | No | No | Yes |

### 1.3 Data Model Comparison

| Platform | Primary Model | Object Types | Relationship Model | Enrichment |
|----------|--------------|-------------|-------------------|------------|
| MISP | Events → Attributes | 300+ attribute types | Correlations, galaxies | Via modules |
| OpenCTI | STIX 2.1 native | All STIX types | Native SROs | Connectors |
| TheHive | Cases → Observables | 25+ observable types | None (flat) | Via Cortex |
| Cortex | Analysis jobs | Reports | N/A | 300+ analyzers |
| Anomali | STIX-aligned | Indicators, actors, TTPs | STIX relationships | ThreatStream |

---

## 2. MISP — Malware Information Sharing Platform

### 2.1 Overview

| Property | Value |
|----------|-------|
| Full Name | Malware Information Sharing Platform & Threat Sharing |
| License | AGPL-3.0 |
| Language | PHP (backend), Python (libraries) |
| Database | MySQL/MariaDB |
| First Release | 2012 |
| Maintainer | CIRCL (Computer Incident Response Center Luxembourg) |
| Deployment | Self-hosted, VM image, Docker |
| Instances | 6,000+ worldwide (estimated) |

### 2.2 Core Data Model

**Event** (top-level container):

| Property | Type | Description |
|----------|------|-------------|
| id | integer | Auto-increment ID |
| uuid | UUID | Globally unique identifier |
| info | string | Event description/title |
| date | date | Event date |
| threat_level_id | 1-4 | High/Medium/Low/Undefined |
| analysis | 0-2 | Initial/Ongoing/Complete |
| distribution | 0-4 | Org/Community/Connected/All/Sharing Group |
| published | boolean | Whether event is published |
| org_id | integer | Owning organization |

**Attribute** (atomic indicator):

| Property | Type | Description |
|----------|------|-------------|
| id | integer | Auto-increment ID |
| uuid | UUID | Globally unique identifier |
| event_id | integer | Parent event |
| category | string | Attribute category (28 categories) |
| type | string | Attribute type (300+ types) |
| value | string | The indicator value |
| to_ids | boolean | Whether suitable for IDS signatures |
| comment | string | Contextual comment |
| first_seen | timestamp | First observation time |
| last_seen | timestamp | Last observation time |

**MISP Galaxies** (structured threat knowledge):
- Galaxy Clusters map to STIX SDOs (threat-actor, malware, attack-pattern, tool, course-of-action)
- MITRE ATT&CK is a first-class Galaxy in MISP
- Custom galaxies can represent Tsingou-specific signal taxonomies

**MISP Objects** (composite indicators):
- Structured groups of related attributes
- 300+ object templates (file, network-connection, email, domain-ip, etc.)
- Maps conceptually to STIX SCOs with their properties

### 2.3 MISP ↔ STIX Mapping

| MISP Concept | STIX 2.1 Equivalent | Mapping Quality |
|-------------|---------------------|-----------------|
| Event | Report or Grouping | Good (1:1) |
| Attribute (to_ids=true) | Indicator | Good (pattern generation) |
| Attribute (to_ids=false) | Observable (SCO) | Good (type-dependent) |
| Object | SCO or observed-data | Good (template-dependent) |
| Galaxy Cluster (malware) | Malware SDO | Good |
| Galaxy Cluster (threat-actor) | Threat-Actor SDO | Good |
| Galaxy Cluster (ATT&CK technique) | Attack-Pattern SDO | Excellent (native mapping) |
| Tag | Marking Definition or Label | Moderate |
| Sighting | Sighting SRO | Good |
| Correlation | Relationship SRO | Moderate (auto-generated) |
| Sharing Group | Marking Definition (TLP) | Moderate |
| Proposal | Note (opinion-like) | Poor |

### 2.4 MISP REST API

**Endpoints (relevant subset):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events/restSearch` | Search events with filters |
| GET | `/attributes/restSearch` | Search attributes with filters |
| POST | `/events/add` | Create event |
| PUT | `/events/edit/{id}` | Update event |
| GET | `/events/view/{id}` | Get single event |
| DELETE | `/events/delete/{id}` | Delete event |
| POST | `/events/stix2/download` | Export as STIX 2.1 bundle |
| POST | `/events/upload_stix` | Import from STIX 2.1 |
| GET | `/sightings/restSearch` | Search sightings |
| GET | `/galaxies/export/{id}` | Export galaxy as STIX |
| GET | `/feeds` | List configured feeds |

**Authentication:** API key via `Authorization` header or `?apikey=` query parameter.

**STIX export example:**

```bash
curl -H "Authorization: API_KEY" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -d '{"returnFormat":"stix2", "eventid":"12345"}' \
     https://misp.example.com/events/restSearch
```

### 2.5 MISP Feeds

MISP supports automated ingestion from external feeds:

| Feed Type | Format | Description |
|-----------|--------|-------------|
| MISP Feed | MISP JSON | Native MISP event format |
| Freetext Feed | CSV/text | One indicator per line |
| CSV Feed | CSV | Structured columns |
| STIX Feed | STIX 2.1 JSON | Via TAXII or direct download |
| OpenIOC | XML | Mandiant IOC format |

**Tsingou as MISP Feed:**
- Tsingou TAXII server exposes collections as MISP-compatible STIX feeds
- MISP's STIX import module ingests observed-data objects
- Custom MISP object templates can represent Tsingou signal kinds

### 2.6 MISP Modules

Extensible enrichment/import/export framework:

| Module Type | Count | Examples |
|-------------|-------|---------|
| Enrichment | 100+ | VirusTotal, Shodan, PassiveTotal, CIRCL hashlookup |
| Import | 30+ | CSV, STIX, OpenIOC, email headers, PDF |
| Export | 20+ | STIX 2.1, CSV, MISP JSON, Suricata rules, Snort |

**Custom Tsingou module:**
- Import module: Ingest BaseSignal observations via NATS→MISP bridge
- Export module: Publish MISP events to Tsingou TAXII server
- Enrichment module: Cross-reference signals with MISP galaxy clusters

---

## 3. OpenCTI — Open Cyber Threat Intelligence

### 3.1 Overview

| Property | Value |
|----------|-------|
| Full Name | Open Cyber Threat Intelligence Platform |
| License | Apache 2.0 (Community), Enterprise license (Platform) |
| Language | TypeScript (frontend), Python + Go (backend) |
| Database | Redis (cache) + Elasticsearch/OpenSearch (storage) + RabbitMQ (queue) + MinIO (files) |
| First Release | 2019 |
| Maintainer | Filigran |
| STIX Version | 2.1 (native internal data model) |
| GraphQL API | Yes (primary programmatic interface) |

### 3.2 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     OpenCTI Frontend                      │
│               (React + Relay + D3.js)                    │
└──────────────────────┬───────────────────────────────────┘
                       │ GraphQL
┌──────────────────────▼───────────────────────────────────┐
│                     OpenCTI API Server                    │
│              (Node.js + Apollo GraphQL)                   │
├──────────┬───────────┬──────────┬────────────────────────┤
│ Redis    │ Elastic   │ RabbitMQ │ MinIO                  │
│ (cache)  │ (storage) │ (queue)  │ (file storage)         │
└──────────┴───────────┴──────┬───┴────────────────────────┘
                              │ worker queues
┌─────────────────────────────▼────────────────────────────┐
│                    OpenCTI Workers                        │
│           (Python — ingest, enrich, export)               │
├─────────┬──────────┬──────────┬──────────────────────────┤
│ Connectors (150+)                                        │
│ Import  │ Internal │ Export   │ Stream                    │
└─────────┴──────────┴──────────┴──────────────────────────┘
```

### 3.3 Data Model (STIX-Native)

OpenCTI stores ALL data as STIX 2.1 objects internally. This is the most STIX-native platform in the ecosystem.

**STIX entity types supported:**

| Category | Types | Count |
|----------|-------|-------|
| SDOs | All 18 standard SDOs | 18 |
| SROs | relationship, sighting | 2 |
| SCOs | All 18 standard SCOs | 18 |
| Meta | bundle, marking-definition, extension-definition | 3 |
| Custom SDOs | x-opencti-* types | 8+ |
| Total | All STIX 2.1 types + extensions | 49+ |

**OpenCTI custom extensions:**

| Custom Type | STIX Base | Purpose |
|-------------|-----------|---------|
| x-opencti-hostname | SCO | Hostname observable |
| x-opencti-cryptographic-key | SCO | Crypto key observable |
| x-opencti-cryptocurrency-wallet | SCO | Wallet address observable |
| x-opencti-text | SCO | Free-text observable |
| x-opencti-user-agent | SCO | Browser user-agent |
| x-opencti-incident | SDO | Internal incident tracking |
| x-opencti-feedback | SDO | Analyst feedback/notes |
| x-opencti-case-* | SDO | Case management (IR, RFI, RFT) |

### 3.4 GraphQL API

**Query examples:**

```graphql
# List indicators with pagination
query {
  indicators(
    first: 50
    after: "cursor_abc"
    orderBy: created_at
    orderMode: desc
    filters: {
      mode: and
      filters: [
        { key: "indicator_types", values: ["anomalous-activity"] }
        { key: "created_at", values: ["2026-02-01T00:00:00Z"], operator: gt }
      ]
      filterGroups: []
    }
  ) {
    edges {
      node {
        id
        name
        pattern
        pattern_type
        valid_from
        confidence
        x_opencti_score
        createdBy { name }
        objectMarking { definition }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
      globalCount
    }
  }
}

# Create an observed-data from Tsingou signal
mutation {
  observedDataAdd(input: {
    first_observed: "2026-02-18T10:30:00.000Z"
    last_observed: "2026-02-18T10:30:00.000Z"
    number_observed: 1
    objects: [
      "x-tsingou-nats-message--uuid-here"
    ]
    confidence: 85
    createdBy: "identity--tsingou-platform-uuid"
  }) {
    id
    standard_id
  }
}
```

### 3.5 Connector Framework

OpenCTI connectors are the primary integration mechanism:

| Connector Type | Direction | Trigger | Example |
|----------------|-----------|---------|---------|
| **External Import** | Platform ← Source | Scheduled/continuous | MISP feed, TAXII client, VirusTotal |
| **Internal Enrichment** | Platform ↔ Platform | On-create trigger | IP geolocation, domain WHOIS, hash lookup |
| **Internal Import** | Platform ← File | User upload | STIX bundle, PDF report, CSV |
| **Stream** | Platform → External | Real-time change stream | SIEM export, Splunk, QRadar |
| **Internal Export** | Platform → File | User request | STIX bundle, CSV, PDF report |

**Tsingou connector architecture:**

```
┌─────────────────────────┐      ┌──────────────────────────┐
│   Tsingou Platform       │      │     OpenCTI Platform      │
│                         │      │                          │
│ NATS ──► BaseSignal     │      │  ┌────────────────────┐  │
│           │              │      │  │ Tsingou Connector   │  │
│           ▼              │      │  │ (External Import)   │  │
│    STIX Codec ──────────┼──────┼──►  - TAXII client     │  │
│           │              │TAXII │  │  - Maps to OpenCTI  │  │
│           ▼              │ 2.1  │  │  - Creates entities │  │
│    TAXII Server ─────────┤      │  └────────────────────┘  │
│                         │      │                          │
│ ◄──── TAXII Client ─────┤      │  ┌────────────────────┐  │
│           │              │TAXII │  │ Tsingou Connector   │  │
│           ▼              │ 2.1  │  │ (Stream Export)     │  │
│    STIX Codec            │      │  │  - Change stream    │  │
│           │              │      │  │  - TAXII POST       │  │
│           ▼              │      │  │  - Back to Tsingou  │  │
│    BaseSignal ──► NATS   │      │  └────────────────────┘  │
└─────────────────────────┘      └──────────────────────────┘
```

### 3.6 STIX Import/Export

OpenCTI has the most seamless STIX integration:

- **Import**: Native STIX 2.1 JSON bundles — no transformation needed
- **Export**: Native STIX 2.1 bundles via API or file download
- **TAXII**: Built-in TAXII 2.1 server AND client
- **Streaming**: Real-time STIX event stream via SSE (Server-Sent Events)
- **Deduplication**: Deterministic STIX UUIDs prevent duplicates
- **Merging**: Automatic entity merging on matching STIX IDs

**Key advantage for Tsingou:** Since OpenCTI's internal model IS STIX 2.1, the codec output from Tsingou can flow directly into OpenCTI with zero format translation.

---

## 4. TheHive 5 — Security Incident Response Platform

### 4.1 Overview

| Property | Value |
|----------|-------|
| Full Name | TheHive — Security Incident Response Platform |
| Version | 5.x (current), 4.x (legacy) |
| License | AGPL-3.0 |
| Language | Scala (backend), Angular (frontend) |
| Database | Apache Cassandra + Elasticsearch + MinIO |
| First Release | 2016 |
| Maintainer | StrangeBee |
| Focus | Incident response, case management, observable enrichment |

### 4.2 Core Data Model

**Cases:**

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique case ID |
| title | string | Case title |
| description | string | Markdown description |
| severity | 1-4 | Low/Medium/High/Critical |
| startDate | timestamp | Case start time |
| endDate | timestamp | Case resolution time |
| status | string | New/InProgress/Resolved/Closed |
| pap | 0-3 | Permissible Actions Protocol (White/Green/Amber/Red) |
| tlp | 0-4 | Traffic Light Protocol |
| owner | string | Assigned analyst |
| tags | list[string] | Classification tags |
| customFields | object | User-defined fields |

**Alerts:**

| Property | Type | Description |
|----------|------|-------------|
| id | string | Alert ID |
| title | string | Alert title |
| type | string | Alert type (classification) |
| source | string | Source system name |
| sourceRef | string | External reference ID |
| severity | 1-4 | Alert severity |
| status | string | New/Updated/Imported/Ignored |
| observables | list[Observable] | Associated observables |
| description | string | Alert details |

**Observables:**

| Property | Type | Description |
|----------|------|-------------|
| dataType | string | Observable type (25+ types) |
| data | string | Observable value |
| message | string | Context/description |
| tlp | 0-4 | Traffic Light Protocol |
| ioc | boolean | Is this an IOC? |
| sighted | boolean | Has been sighted? |
| tags | list[string] | Classification tags |

**Observable types (subset relevant to Tsingou):**

| TheHive Type | STIX SCO Equivalent | Tsingou Signal Kind |
|-------------|---------------------|---------------------|
| ip | ipv4-addr / ipv6-addr | http, nats, websocket |
| domain | domain-name | http, rss |
| url | url | http, rss, websocket |
| filename | file (name property) | file-watch |
| hash | file (hashes property) | file-watch |
| port | network-traffic (dst_port) | serial, http |
| hostname | x-opencti-hostname | nats, http |
| user-agent | user-agent | http |
| other | custom | midi, osc, serial |

### 4.3 TheHive REST API

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/case` | Create case |
| GET | `/api/v1/case/{id}` | Get case |
| PATCH | `/api/v1/case/{id}` | Update case |
| POST | `/api/v1/alert` | Create alert |
| POST | `/api/v1/alert/{id}/merge/{caseId}` | Merge alert into case |
| POST | `/api/v1/case/{id}/observable` | Add observable to case |
| POST | `/api/v1/connector/cortex/job` | Run Cortex analyzer |
| POST | `/api/v1/query` | Advanced query (TheHive Query Language) |

### 4.4 TheHive ↔ Tsingou Integration Pattern

```
Tsingou Analysis Engine                TheHive 5
─────────────────────                  ──────────
d2ts anomaly detection ──►  STIX indicator ──► TheHive Alert
  │                                              │
  │ (correlation)                                │ (analyst promotes)
  │                                              ▼
  ▼                                         TheHive Case
STIX relationship/sighting ──►              │
                                            ├── Observable (IP)
                                            ├── Observable (URL)
                                            ├── Observable (domain)
                                            └── Cortex Enrichment
```

**Integration flow:**
1. Tsingou d2ts engine detects anomaly → produces STIX indicator
2. Bridge converts indicator to TheHive Alert (via REST API)
3. Analyst reviews alert, promotes to Case
4. Case observables are enriched via Cortex analyzers
5. Findings flow back to Tsingou as sighting/relationship SROs

---

## 5. Cortex — Analysis Engine

### 5.1 Overview

| Property | Value |
|----------|-------|
| Full Name | Cortex — Observable Analysis and Active Response |
| License | AGPL-3.0 |
| Language | Scala (backend), Angular (frontend), Python (analyzers) |
| Maintained by | StrangeBee |
| Integration | TheHive (native), MISP (plugin), standalone |

### 5.2 Analyzer Catalog

Cortex provides 300+ analyzers organized by category:

| Category | Example Analyzers | Observable Types |
|----------|-------------------|-----------------|
| **Reputation** | VirusTotal, AbuseIPDB, URLhaus | IP, domain, URL, hash |
| **Sandbox** | Joe Sandbox, Hybrid Analysis, ANY.RUN | File, URL |
| **WHOIS/DNS** | DomainTools, PassiveTotal, CIRCL | Domain, IP |
| **Geo** | MaxMind GeoIP, IPinfo | IP |
| **Threat Intel** | MISP, OTX, ThreatFox | All |
| **Certificate** | CertStream, crt.sh | Domain |
| **Email** | EmailRep, HaveIBeenPwned | Email |
| **Custom** | User-written Python scripts | Any |

### 5.3 Responder Framework

Responders are active-response actions triggered by analysis results:

| Category | Example Responders | Action |
|----------|-------------------|--------|
| **Blocking** | Firewall rules, DNS sinkhole | Block IOC |
| **Notification** | Email, Slack, PagerDuty | Alert team |
| **Ticketing** | Jira, ServiceNow | Create ticket |
| **Enrichment** | MISP enrichment, OpenCTI update | Update platforms |
| **Custom** | Tsingou NATS publish | Push findings back |

### 5.4 Tsingou Custom Analyzer

A custom Cortex analyzer for Tsingou signal correlation:

```python
# Conceptual Tsingou Cortex Analyzer
class TsingouSignalCorrelator(Analyzer):
    """Cross-reference TheHive observables against Tsingou signal history."""

    def run(self):
        observable = self.get_data()
        observable_type = self.data_type

        # Query Tsingou TAXII server for matching signals
        taxii_client = TaxiiClient(self.get_param("taxii_url"))
        collection = self.get_param("collection_id")

        # Build STIX pattern based on observable type
        if observable_type == "ip":
            pattern = f"[ipv4-addr:value = '{observable}']"
        elif observable_type == "domain":
            pattern = f"[domain-name:value = '{observable}']"
        elif observable_type == "url":
            pattern = f"[url:value = '{observable}']"

        # Search collection via manifest for efficiency
        matches = taxii_client.get_objects(
            collection,
            match_type=["observed-data", "indicator"],
            added_after=self.get_param("lookback_days")
        )

        self.report({
            "total_matches": len(matches),
            "first_seen": min(m["first_observed"] for m in matches),
            "last_seen": max(m["last_observed"] for m in matches),
            "signal_kinds": list(set(m.get("x_tsingou_signal_kind") for m in matches)),
            "taxonomies": self.build_taxonomies(matches)
        })
```

---

## 6. Anomali ThreatStream

### 6.1 Overview

| Property | Value |
|----------|-------|
| Type | Commercial TIP |
| STIX Support | Native (2.0, 2.1) |
| TAXII Support | Server + Client (2.0, 2.1) |
| API | REST + STIX/TAXII |
| Deployment | SaaS + On-premise |
| Free Tier | STAXX (community edition, TAXII-only) |

### 6.2 Key Features

- **ThreatStream Aggregator**: Ingests 100+ commercial and open feeds
- **Intelligence normalization**: Maps all feeds to STIX format
- **Confidence scoring**: Machine-learning-based IOC confidence
- **Integrations**: SIEM (Splunk, QRadar), SOAR, firewalls, EDR
- **TAXII server**: Exposes curated intelligence via TAXII 2.1

### 6.3 Tsingou Relevance

| Feature | Relevance | Integration Path |
|---------|-----------|-----------------|
| TAXII server | HIGH | Tsingou TAXII client consumes Anomali feeds |
| STIX export | HIGH | Direct STIX bundle ingestion |
| Confidence scoring | MEDIUM | Enrich Tsingou indicators with Anomali scores |
| Feed aggregation | HIGH | Single point for multiple threat feeds |

---

## 7. Recorded Future

### 7.1 Overview

| Property | Value |
|----------|-------|
| Type | Commercial TIP + Intelligence Provider |
| STIX Support | Export (2.0, 2.1) |
| TAXII Support | Client |
| API | REST (Connect API) |
| Deployment | SaaS only |
| Differentiator | NLP-based open-web intelligence collection |

### 7.2 Intelligence Modules

| Module | Coverage | Data Type |
|--------|----------|-----------|
| Threat Intelligence | APT groups, campaigns, malware | SDOs (threat-actor, campaign, malware) |
| Vulnerability | CVE enrichment, exploit intelligence | Vulnerability SDO |
| Third-Party Risk | Supply chain, vendor risk | Identity, infrastructure SCOs |
| Brand Intelligence | Phishing, impersonation, dark web | Indicator, URL SCOs |
| SecOps | IOC feeds, detection rules | Indicator, pattern |

### 7.3 Tsingou Relevance

| Feature | Relevance | Integration Path |
|---------|-----------|-----------------|
| Connect API | MEDIUM | REST API → STIX export → Tsingou ingestion |
| Risk Lists | HIGH | Pre-scored IP/domain/hash lists for signal enrichment |
| STIX export | HIGH | Direct bundle import via TAXII client |
| NLP intelligence | LOW | Tangential to signal-level analysis |

---

## 8. CrowdStrike Falcon Intelligence

### 8.1 Overview

| Property | Value |
|----------|-------|
| Type | Commercial (EDR + TIP) |
| STIX Support | Export (2.0) |
| TAXII Support | No native |
| API | REST (Falcon API) |
| Deployment | SaaS |
| Differentiator | Endpoint telemetry-derived intelligence |

### 8.2 Key APIs

| API | Description | STIX Mapping |
|-----|-------------|-------------|
| Indicators | IOC management | indicator, malware |
| Actors | Threat actor profiles | threat-actor, intrusion-set |
| Reports | Intelligence reports | report |
| Malware | Malware analysis | malware, file SCO |
| Vulnerabilities | CVE intelligence | vulnerability |

### 8.3 Tsingou Relevance

LOW to MEDIUM. CrowdStrike focuses on endpoint threats, while Tsingou focuses on signal intelligence. Relevant only when correlating network signals with endpoint IOCs.

---

## 9. IBM X-Force Exchange

### 9.1 Overview

| Property | Value |
|----------|-------|
| Type | Commercial TIP + Threat Feed |
| STIX Support | Partial (export) |
| TAXII Support | TAXII 2.0 client |
| API | REST |
| Deployment | SaaS + QRadar integration |

### 9.2 Collections

| Collection | Content | STIX Types |
|------------|---------|-----------|
| IP Reputation | Malicious IPs | indicator (ipv4-addr pattern) |
| URL Reputation | Malicious URLs | indicator (url pattern) |
| Malware | Malware samples + analysis | malware, file SCO |
| Vulnerabilities | CVE database | vulnerability |
| Threat Groups | APT profiles | threat-actor, intrusion-set |

---

## 10. Mandiant Advantage Threat Intelligence

### 10.1 Overview

| Property | Value |
|----------|-------|
| Type | Commercial TIP (Google Cloud) |
| STIX Support | Export (2.1) |
| TAXII Support | No native |
| API | REST |
| Deployment | SaaS |
| Differentiator | Incident response-derived intelligence |

### 10.2 Key Data

- 300+ threat groups tracked
- Comprehensive campaign intelligence
- STIX 2.1 export for all entity types
- Custom IOC scoring based on IR data

---

## 11. STIX Shifter (IBM)

### 11.1 Overview

| Property | Value |
|----------|-------|
| Purpose | Universal data source connector for STIX pattern translation |
| License | Apache 2.0 |
| Language | Python |
| Maintained by | IBM + Open Cybersecurity Alliance |

### 11.2 Architecture

STIX Shifter translates STIX patterns into native query languages:

```
STIX Pattern:
  [ipv4-addr:value = '198.51.100.1' AND network-traffic:dst_port = 443]

                    │ translate
                    ▼

QRadar AQL:
  SELECT * FROM events WHERE sourceip = '198.51.100.1' AND destinationport = 443

Splunk SPL:
  index=* src_ip="198.51.100.1" dest_port=443

Elastic EQL:
  source.ip: "198.51.100.1" AND destination.port: 443
```

### 11.3 Supported Data Sources

| Category | Sources |
|----------|---------|
| SIEM | QRadar, Splunk, Elastic, Sentinel |
| Cloud | AWS Security Hub, Azure Sentinel, GCP SCC |
| Endpoint | Carbon Black, CrowdStrike |
| Network | Palo Alto, Darktrace |
| Database | MySQL, PostgreSQL |
| Custom | SDK for custom modules |

### 11.4 Tsingou Relevance

**HIGH.** STIX Shifter can translate Tsingou-generated STIX patterns into queries for any supported backend, enabling:

1. Tsingou d2ts produces anomaly → STIX indicator with pattern
2. STIX Shifter translates pattern to target SIEM query language
3. SIEM executes query, returns matching events
4. Results feed back to Tsingou as sighting SROs

A custom STIX Shifter module for NATS/JetStream queries would allow STIX patterns to query Tsingou's signal history directly.

---

## 12. IntelMQ

### 12.1 Overview

| Property | Value |
|----------|-------|
| Purpose | Automated threat intelligence processing pipeline |
| License | AGPL-3.0 |
| Language | Python |
| Maintained by | CERT.at + community |
| Architecture | Message-queue-based bot pipeline |

### 12.2 Architecture

```
Collectors → Parsers → Experts → Outputs
     │           │         │         │
  Fetch data  Parse to  Enrich &  Deliver to
  from feeds  IntelMQ   filter    destinations
              format
```

### 12.3 Bot Types

| Type | Count | Examples |
|------|-------|---------|
| Collectors | 40+ | TAXII, RSS, HTTP, file, AMQP |
| Parsers | 60+ | STIX, CSV, JSON, Shadowserver, Abuse.ch |
| Experts | 30+ | Deduplication, enrichment, filtering, taxonomy |
| Outputs | 25+ | STIX, TAXII, MISP, TheHive, PostgreSQL, REST |

### 12.4 Tsingou Relevance

MEDIUM. IntelMQ operates as a processing pipeline similar to Tsingou's d2ts, but for CTI feeds. Integration via:
- IntelMQ TAXII Collector → consumes Tsingou TAXII collections
- IntelMQ TAXII Output → publishes to Tsingou TAXII server
- IntelMQ STIX Expert → transforms/validates STIX content

---

## 13. YETI — Your Everyday Threat Intelligence

### 13.1 Overview

| Property | Value |
|----------|-------|
| Purpose | Threat intelligence repository + enrichment |
| License | Apache 2.0 |
| Language | Python (Flask backend) |
| Database | MongoDB + Redis |
| Focus | Observable management + feed aggregation |

### 13.2 Key Features

- Observable types: IP, domain, URL, hash, email, certificate, etc.
- Entity types: Actor, campaign, exploit, malware, TTP
- Indicator matching: YARA, Sigma, Snort/Suricata rules
- Feed ingestion: 50+ built-in feed configurations
- Analytics: Scheduled enrichment jobs
- REST API for full CRUD

### 13.3 Tsingou Relevance

LOW. YETI's functionality overlaps with OpenCTI (which has superior STIX support). May be relevant as a lightweight alternative for smaller deployments.

---

## 14. Interoperability Patterns

### 14.1 Hub-and-Spoke Pattern

```
                    ┌──────────┐
                    │  OpenCTI  │ ◄──── Primary CTI Hub
                    │  (STIX)   │
                    └─────┬────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌─────▼────┐    ┌──────▼─────┐
    │  MISP    │     │ TheHive   │    │  Tsingou    │
    │ (feeds)  │     │ (cases)   │    │ (signals)   │
    └─────────┘     └──────────┘    └────────────┘
```

**Pattern**: OpenCTI as the STIX-native hub. All platforms exchange via STIX 2.1.

### 14.2 Mesh Pattern

```
    MISP ◄─────────────► OpenCTI
      │                     │
      │    STIX 2.1 /       │
      │    TAXII 2.1        │
      │                     │
      ▼                     ▼
  TheHive ◄────────────► Tsingou
```

**Pattern**: Each platform connects directly to all others. Higher complexity, lower latency.

### 14.3 Bus Pattern (Tsingou-Native)

```
                    ┌──────────────────────────┐
                    │      NATS Messaging Bus    │
                    │                          │
                    │  tsingou.cti.misp.>       │
                    │  tsingou.cti.opencti.>    │
                    │  tsingou.cti.thehive.>    │
                    └──┬───┬───┬───┬───────────┘
                       │   │   │   │
            ┌──────────┘   │   │   └──────────┐
            │              │   │              │
       ┌────▼────┐   ┌────▼───▼───┐    ┌─────▼─────┐
       │  MISP    │   │  OpenCTI    │    │  TheHive   │
       │ Bridge   │   │  Connector  │    │  Bridge    │
       └─────────┘   └────────────┘    └───────────┘
```

**Pattern**: NATS as the integration bus. Platform-specific bridges translate between STIX and native formats. This is the recommended Tsingou pattern.

### 14.4 Feed Chain Pattern

```
Commercial Feeds          Open Feeds           Tsingou Signals
(Recorded Future,        (Abuse.ch,            (BaseSignal →
 CrowdStrike)             AlienVault OTX)       STIX codec)
      │                       │                      │
      └───────────┬───────────┘──────────────────────┘
                  │
            ┌─────▼─────┐
            │  Tsingou    │
            │  Ingestion  │
            │  Pipeline   │
            └─────┬──────┘
                  │
           ┌──────▼──────┐
           │  d2ts Engine  │  ← Correlate across all sources
           │  (Fusion)     │
           └──────┬───────┘
                  │
           ┌──────▼──────┐
           │  TAXII Export │  ← Publish enriched intelligence
           └─────────────┘
```

---

## 15. Tsingou Integration Architecture

### 15.1 Connector Matrix

| Platform | Inbound (→ Tsingou) | Outbound (Tsingou →) | Protocol | Priority |
|----------|---------------------|---------------------|----------|----------|
| OpenCTI | TAXII client pull | TAXII server + stream | STIX/TAXII 2.1 | P0 |
| MISP | STIX export + REST | TAXII feed + REST | STIX + MISP JSON | P1 |
| TheHive | Alert import (REST) | Alert export (REST) | REST API | P1 |
| Cortex | Analysis results | Observable submission | REST API | P2 |
| Anomali | TAXII client pull | N/A | STIX/TAXII 2.1 | P2 |
| Recorded Future | REST API pull | N/A | REST + STIX export | P3 |
| IntelMQ | TAXII collector | TAXII output | STIX/TAXII 2.1 | P3 |
| STIX Shifter | Pattern translation | N/A | Python API | P2 |

### 15.2 Effect-TS Service Model

Each platform connector is modeled as an Effect.Service:

```typescript
// Conceptual service hierarchy
interface CtiBridge {
  readonly ingest: (source: PlatformId) => Stream<StixBundle>
  readonly publish: (target: PlatformId, bundle: StixBundle) => Effect<Status>
  readonly subscribe: (target: PlatformId, filter: StixFilter) => Stream<StixObject>
  readonly health: (target: PlatformId) => Effect<HealthStatus>
}

// Platform-specific adapters
class MispConnector extends Effect.Service<MispConnector>()("MispConnector", { ... }) {}
class OpenCtiConnector extends Effect.Service<OpenCtiConnector>()("OpenCtiConnector", { ... }) {}
class TheHiveConnector extends Effect.Service<TheHiveConnector>()("TheHiveConnector", { ... }) {}
class TaxiiConnector extends Effect.Service<TaxiiConnector>()("TaxiiConnector", { ... }) {}
```

### 15.3 Data Flow Summary

```
                     INBOUND                          OUTBOUND
                  ─────────                        ──────────

Commercial Feeds ──► TAXII Client ──►┐      ┌──► TAXII Server ──► OpenCTI
                                     │      │
MISP Events ──────► MISP Connector ──►│      ├──► MISP Connector ──► MISP
                                     │      │
OpenCTI Stream ───► OpenCTI Conn ───►│      ├──► REST API ──────► TheHive Alerts
                                     ▼      │
                              ┌──────────────┤
                              │   Tsingou     │
                              │   Signal      │
                              │   Pipeline    │
                              │              │
                              │ BaseSignal ↔ │
                              │ STIX Codec   │
                              │              │
                              │   d2ts       │
                              │   Analysis   │
                              └──────┬───────┘
                                     │
                              NATS Messaging
                              Fabric (internal)
```

---

## 16. Platform Comparison Matrix

### 16.1 Feature Matrix

| Feature | MISP | OpenCTI | TheHive | Cortex | Anomali |
|---------|------|---------|---------|--------|---------|
| STIX 2.1 Native | No (export) | **Yes** | No | No | Partial |
| TAXII 2.1 Server | Via module | **Built-in** | No | No | **Built-in** |
| TAXII 2.1 Client | Via module | **Built-in** | No | No | **Built-in** |
| GraphQL API | No | **Yes** | No | No | No |
| REST API | Yes | Yes | Yes | Yes | Yes |
| Real-time Stream | Kafka | **SSE** | Webhooks | No | No |
| Case Management | No | **Yes** | **Yes** | No | No |
| Observable Enrichment | Via modules | Via connectors | **Via Cortex** | **Native** | Built-in |
| Custom Extensions | Objects | Custom SDOs | Custom fields | Analyzers | Minimal |
| Self-hosted | Yes | Yes | Yes | Yes | Partial |
| Community Size | **Largest** | Growing | Large | Large | Commercial |

### 16.2 Tsingou Integration Effort

| Platform | Effort (days) | Complexity | Value | Priority |
|----------|--------------|------------|-------|----------|
| OpenCTI | 3-5 | Low (STIX native) | **Very High** | P0 |
| MISP | 5-8 | Medium (format translation) | High | P1 |
| TheHive | 3-5 | Medium (REST bridge) | High | P1 |
| Cortex | 2-3 | Low (analyzer plugin) | Medium | P2 |
| STIX Shifter | 5-8 | High (custom module) | Medium | P2 |
| Anomali | 2-3 | Low (TAXII native) | Medium | P2 |
| Recorded Future | 3-5 | Medium (REST → STIX) | Low-Medium | P3 |
| IntelMQ | 2-3 | Low (TAXII native) | Low | P3 |

### 16.3 Recommended Integration Order

1. **Phase 1 (P0)**: OpenCTI bidirectional connector — immediate STIX value
2. **Phase 2 (P1)**: MISP feed ingestion + TheHive alert export — case management
3. **Phase 3 (P2)**: Cortex analyzer + Anomali feed + STIX Shifter — enrichment
4. **Phase 4 (P3)**: Remaining platforms as needed

---

## References

| Key | Citation |
|-----|----------|
| [MISP] | CIRCL, "MISP — Malware Information Sharing Platform", https://www.misp-project.org/ |
| [OPENCTI] | Filigran, "OpenCTI — Open Cyber Threat Intelligence Platform", https://www.opencti.io/ |
| [THEHIVE] | StrangeBee, "TheHive 5 — Security Incident Response Platform", https://thehive-project.org/ |
| [CORTEX] | StrangeBee, "Cortex — Observable Analysis Engine", https://thehive-project.org/ |
| [ANOMALI] | Anomali, "ThreatStream Platform", https://www.anomali.com/ |
| [RECORDED] | Recorded Future, "Intelligence Cloud", https://www.recordedfuture.com/ |
| [STIXSHIFT] | IBM, "STIX-Shifter — Universal Data Source Connector", GitHub |
| [INTELMQ] | CERT.at, "IntelMQ — Automated Threat Intelligence Processing", GitHub |
| [YETI] | YETI Project, "Your Everyday Threat Intelligence", GitHub |
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |

---

*End of CTI Platforms Research Reference*
