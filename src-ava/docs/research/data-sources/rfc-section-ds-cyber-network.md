# AVA.DS.3: Cyber/Network Domain Data Sources

```
Section:       AVA.DS.3 — Cyber/Network Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
SignalKinds:   Http, Dns, Cyber
EntityClasses: NetworkHost, Domain, Campaign, Organization
Prerequisites: AVA.DS.6 (NATS Subject Taxonomy)
```

> This section catalogs the data sources, payload schemas, entity mappings, and
> cross-correlation targets for the three Cyber/Network domain signal kinds:
> **Http** (network flow metadata), **Dns** (passive and active DNS records), and
> **Cyber** (threat intelligence indicators in STIX 2.1 and proprietary formats).
> The Cyber signal kind is a key differentiator for the ava-fusion pipeline,
> providing structured threat context via STIX 2.1 bundles that enrich kinetic
> and RF observations with adversary attribution.

---

## Table of Contents

1. [Overview](#ava-ds-31-overview)
2. [Signal Kind: Http](#ava-ds-32-signal-kind-http)
3. [Signal Kind: Dns](#ava-ds-33-signal-kind-dns)
4. [Signal Kind: Cyber](#ava-ds-34-signal-kind-cyber)

---

## AVA.DS.3.1 Overview

The Cyber/Network domain covers three complementary signal kinds that together
provide deep visibility into network infrastructure and adversary operations:

| SignalKind | DataType  | Primary EntityClass | Purpose |
|------------|-----------|--------------------:|---------|
| `Http`     | Event     | NetworkHost         | Network flow metadata — HTTP/HTTPS request/response records from IDS sensors, PCAP extraction, and labeled intrusion detection datasets |
| `Dns`      | Event + Reference | Domain      | DNS resolution records — passive DNS archives, active resolver logs, and domain reputation lists |
| `Cyber`    | Reference + Event | Campaign    | Cyber threat intelligence — STIX 2.1 indicators, IOCs, vulnerability catalogs, and threat feeds |

**Key integration principle**: Cyber signals provide the *attribution context*
that transforms raw network observations (Http, Dns) into actionable intelligence.
An IP address in an Http flow becomes meaningful when correlated with a STIX
Indicator; a DNS query becomes suspicious when the domain appears in a threat feed.

### EntityClass Mapping Summary

| EntityClass   | Primary Namespace | Observable By | Identifier Example |
|---------------|-------------------|---------------|--------------------|
| NetworkHost   | IpAddress         | Http, Dns, Cyber | `192.168.1.100` |
| Domain        | DomainName        | Dns, Cyber, Http | `evil.example.com` |
| Campaign      | STIX ID           | Cyber         | `campaign--8e2e2d2b-...` |
| Organization  | Name / LEI        | Cyber, Osint  | `APT29` |

---

## AVA.DS.3.2 Signal Kind: Http

### AVA.DS.3.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **Zeek http.log** | https://docs.zeek.org/en/master/logs/http.html | JSON (line-delimited) | Local file / Kafka | None (sensor) | `id.orig_h`, `id.resp_h`, `method`, `host`, `uri`, `status_code`, `user_agent` | Real-time | BSD |
| **tshark PCAP export** | https://www.wireshark.org/docs/man-pages/tshark.html | JSON (`-T json`) | CLI | None (local) | `ip.src`, `ip.dst`, `tcp.dstport`, `http.request.uri`, `http.host` | Batch | GPL-2.0 |
| **CICIDS2017** | https://www.unb.ca/cic/datasets/ids-2017.html | CSV (79 features) | Download | None | `Flow Duration`, `Src IP`, `Dst IP`, `Src Port`, `Dst Port`, `Protocol`, `Label` | Static | Research |
| **CSE-CIC-IDS2018** | https://www.unb.ca/cic/datasets/ids-2018.html | CSV + PCAP | AWS S3 | None | Same as CICIDS2017 + additional features | Static | Research |
| **CIC-DDoS2019** | https://www.unb.ca/cic/datasets/ddos-2019.html | CSV | Download | None | Flow features + `Label` (DDoS type) | Static | Research |

### AVA.DS.3.2.2 NATS Subject Taxonomy

```
sensor.http.zeek.json        # Zeek http.log JSON records
sensor.http.zeek.raw         # Zeek http.log TSV (original format)
sensor.http.pcap.json        # tshark -T json PCAP metadata
sensor.http.cicids.csv       # CICIDS2017/2018 labeled flows
sensor.http.ddos.csv         # CIC-DDoS2019 labeled flows
sensor.http.synthetic.json   # Generated test HTTP flows
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.http.zeek.json` | JSON | Zeek http.log JSON — primary production source |
| `sensor.http.pcap.json` | JSON | Parsed PCAP HTTP metadata via tshark |
| `sensor.http.cicids.csv` | CSV | Labeled IDS dataset flows for ML training |
| `sensor.http.synthetic.json` | JSON | Synthetic HTTP flow generator output |

### AVA.DS.3.2.3 Payload Schema

**Canonical: Zeek http.log JSON**

```json
{
  "ts": 1708432456.789012,
  "uid": "CYkN4p3jMHa7ZeMPbi",
  "id.orig_h": "192.168.1.100",
  "id.orig_p": 46378,
  "id.resp_h": "93.184.216.34",
  "id.resp_p": 443,
  "trans_depth": 1,
  "method": "GET",
  "host": "example.com",
  "uri": "/api/v1/data",
  "version": "1.1",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "request_body_len": 0,
  "response_body_len": 1256,
  "status_code": 200,
  "status_msg": "OK",
  "tags": [],
  "resp_fuids": ["FmHxM41UOhQoFKNR3h"],
  "resp_mime_types": ["application/json"]
}
```

**BaseSignal mapping** (Rust struct: `ava-fusion/src/signal.rs`):

```rust
BaseSignal {
    signal_kind: SignalKind::Http,
    timestamp: ts,                    // Zeek ts field (epoch float)
    source_id: "zeek",
    entity_ids: vec![
        EntityId { class: NetworkHost, namespace: IpAddress, value: id.orig_h },
        EntityId { class: NetworkHost, namespace: IpAddress, value: id.resp_h },
        EntityId { class: Domain,      namespace: DomainName, value: host },
    ],
    payload: serde_json::Value,       // Full Zeek record
    confidence: 0.95,                 // High — direct observation
}
```

### AVA.DS.3.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| `id.orig_h` | NetworkHost | IpAddress | `192.168.1.100` |
| `id.resp_h` | NetworkHost | IpAddress | `93.184.216.34` |
| `host` | Domain | DomainName | `example.com` |
| `user_agent` | — | — | Used for fingerprinting, not entity ID |

### AVA.DS.3.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Dns | Temporal + Key | Domain name + time window | Tier 1 | DNS resolution preceding HTTP request |
| Cyber | Key-based | IP or Domain vs. STIX Indicator pattern | Tier 1 | IOC match on dest IP or host |
| Osint | Key-based | Domain or IP in news/reports | Tier 2 | OSINT enrichment of suspicious hosts |
| AdsB / Ais | Temporal | Timestamp overlap at facility | Tier 3 | Kinetic asset at network origin |
| RfBearing | Spatial + Temporal | Geolocation of IP + bearing | Tier 3 | RF emission co-located with network host |

### AVA.DS.3.2.6 Synthetic Data Generation

| Parameter | Range / Strategy |
|-----------|------------------|
| `id.orig_h` | RFC 1918 private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` |
| `id.resp_h` | Mix of public IPs (randomized) + known-bad IPs from threat feeds |
| `method` | Weighted: GET (70%), POST (20%), PUT (5%), DELETE (3%), HEAD (2%) |
| `host` | Sampled from Tranco top-1M + synthetic suspicious domains |
| `status_code` | Weighted: 200 (60%), 301/302 (15%), 404 (10%), 403 (5%), 500 (5%), other (5%) |
| `user_agent` | Sampled from real UA databases + known malware UA strings |
| `Label` | For IDS datasets: BENIGN (80%), DDoS (8%), PortScan (5%), BruteForce (4%), Other (3%) |
| **Generation strategy** | Parametric: Markov chain session modeling with configurable attack injection rate |

---

## AVA.DS.3.3 Signal Kind: Dns

### AVA.DS.3.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **Zeek dns.log** | https://docs.zeek.org/en/master/logs/dns.html | JSON (line-delimited) | Local file / Kafka | None (sensor) | `query`, `qtype_name`, `answers`, `rcode_name`, `id.orig_h` | Real-time | BSD |
| **Farsight DNSDB** | https://docs.farsightsecurity.com/ | JSON (NDJSON) | REST (v2) | API key (commercial) | `rrname`, `rrtype`, `rdata`, `time_first`, `time_last`, `count` | Minutes | Commercial + Research |
| **CIRCL Passive DNS** | https://www.circl.lu/services/passive-dns/ | JSON | REST | API key (free for researchers) | `rrname`, `rrtype`, `rdata`, `time_first`, `time_last`, `count` | Hourly | Free (research) |
| **Tranco Top-1M** | https://tranco-list.eu/ | CSV (rank, domain) | REST + Download | None | `rank`, `domain` | Daily | MIT |
| **DNS-over-HTTPS logs** | Operator-specific | JSON | N/A | N/A | `question.name`, `question.type`, `answer.data` | Real-time | Operator |

### AVA.DS.3.3.2 NATS Subject Taxonomy

```
sensor.dns.zeek.json         # Zeek dns.log JSON records
sensor.dns.zeek.raw          # Zeek dns.log TSV (original format)
sensor.dns.farsight.json     # Farsight DNSDB passive DNS lookups
sensor.dns.circl.json        # CIRCL passive DNS records
sensor.dns.tranco.csv        # Tranco top-1M domain list
sensor.dns.doh.json          # DNS-over-HTTPS resolver logs
sensor.dns.synthetic.json    # Generated test DNS records
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.dns.zeek.json` | JSON | Zeek dns.log — primary production source |
| `sensor.dns.farsight.json` | JSON | Farsight DNSDB passive DNS (commercial) |
| `sensor.dns.circl.json` | JSON | CIRCL passive DNS (research tier) |
| `sensor.dns.tranco.csv` | CSV | Tranco top-1M reference list (daily refresh) |
| `sensor.dns.synthetic.json` | JSON | Synthetic DNS record generator output |

### AVA.DS.3.3.3 Payload Schema

**Canonical: Zeek dns.log JSON**

```json
{
  "ts": 1708432456.123456,
  "uid": "CYkN4p3jMHa7ZeMPbi",
  "id.orig_h": "192.168.1.100",
  "id.orig_p": 52311,
  "id.resp_h": "8.8.8.8",
  "id.resp_p": 53,
  "proto": "udp",
  "trans_id": 42567,
  "query": "evil.example.com",
  "qclass": 1,
  "qclass_name": "C_INTERNET",
  "qtype": 1,
  "qtype_name": "A",
  "rcode": 0,
  "rcode_name": "NOERROR",
  "AA": false,
  "TC": false,
  "RD": true,
  "RA": true,
  "Z": 0,
  "answers": ["93.184.216.34"],
  "TTLs": [3600.0],
  "rejected": false
}
```

**Passive DNS Common Output Format** (Farsight DNSDB / CIRCL):

```json
{
  "rrname": "evil.example.com.",
  "rrtype": "A",
  "rdata": "93.184.216.34",
  "time_first": 1708300000,
  "time_last": 1708432456,
  "count": 47,
  "bailiwick": "example.com.",
  "origin": "sensor-id-123"
}
```

**BaseSignal mapping**:

```rust
BaseSignal {
    signal_kind: SignalKind::Dns,
    timestamp: ts,
    source_id: "zeek",       // or "farsight", "circl"
    entity_ids: vec![
        EntityId { class: Domain,      namespace: DomainName, value: query },
        EntityId { class: NetworkHost, namespace: IpAddress,  value: answers[0] },
        EntityId { class: NetworkHost, namespace: IpAddress,  value: id.orig_h },
    ],
    payload: serde_json::Value,
    confidence: 0.95,         // Direct observation
}
```

### AVA.DS.3.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| `query` / `rrname` | Domain | DomainName | `evil.example.com` |
| `answers[*]` / `rdata` | NetworkHost | IpAddress | `93.184.216.34` |
| `id.orig_h` | NetworkHost | IpAddress | `192.168.1.100` (resolver client) |
| `id.resp_h` | NetworkHost | IpAddress | `8.8.8.8` (DNS server) |

### AVA.DS.3.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Http | Temporal + Key | Domain + time window | Tier 1 | DNS lookup followed by HTTP connection |
| Cyber | Key-based | Domain vs. STIX Indicator | Tier 1 | Domain matches IOC indicator pattern |
| Osint | Key-based | Domain in GDELT/news | Tier 2 | OSINT mention of suspicious domain |
| Social | Key-based | Domain in social media posts | Tier 2 | Social media discussion of domain |
| Financial | Key-based | WHOIS registrant vs. sanctions | Tier 3 | Domain registrant on OFAC/sanctions list |

### AVA.DS.3.3.6 Synthetic Data Generation

| Parameter | Range / Strategy |
|-----------|------------------|
| `query` | Mix of: Tranco top-1M samples (70%), DGA-like random labels (15%), known-bad from threat feeds (10%), typosquat variants (5%) |
| `qtype_name` | Weighted: A (60%), AAAA (15%), CNAME (10%), MX (5%), TXT (5%), NS (3%), SOA (2%) |
| `rcode_name` | Weighted: NOERROR (85%), NXDOMAIN (10%), SERVFAIL (3%), REFUSED (2%) |
| `answers` | Random public IPs for benign; known-bad IPs for malicious; empty for NXDOMAIN |
| `TTLs` | Range 60-86400; low TTLs (< 300) flagged as suspicious (fast-flux) |
| `count` (passive DNS) | Power-law distribution: most domains seen 1-10 times, popular domains 10K+ |
| **Generation strategy** | Replay: replay real Zeek dns.log with anonymized IPs + injected malicious queries |

---

## AVA.DS.3.4 Signal Kind: Cyber

> **STIX 2.1 integration is a key differentiator for ava-fusion.** This section
> documents the STIX bundle ingestion path, the mapping from STIX Domain Objects
> (SDOs) and STIX Cyber-observable Objects (SCOs) to BaseSignal and EntityClass,
> and the non-STIX threat intelligence feeds that supplement the STIX pipeline.

### AVA.DS.3.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **MITRE ATT&CK** | https://github.com/mitre-attack/attack-stix-data | STIX 2.1 JSON | GitHub raw + TAXII 2.1 | None (GitHub) / Rate-limited (TAXII) | `type`, `id`, `name`, `external_references`, `kill_chain_phases` | ~Quarterly | MIT |
| **abuse.ch URLhaus** | https://urlhaus.abuse.ch/api/ | JSON | REST POST | API key (free) | `url`, `url_status`, `threat`, `tags`, `host`, `date_added` | Minutes | CC0 |
| **abuse.ch ThreatFox** | https://threatfox-api.abuse.ch/api/v1/ | JSON | REST POST | API key (free) | `ioc_type`, `ioc_value`, `threat_type`, `malware`, `confidence_level` | Minutes | CC0 |
| **abuse.ch MalwareBazaar** | https://bazaar.abuse.ch/api/ | JSON | REST POST | API key (free) | `sha256_hash`, `file_type`, `signature`, `tags`, `first_seen` | Minutes | CC0 |
| **CISA KEV** | https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json | JSON | Direct download | None | `cveID`, `vendorProject`, `product`, `vulnerabilityName`, `dateAdded`, `dueDate`, `knownRansomwareCampaignUse` | Daily | Public domain |
| **AlienVault OTX** | https://otx.alienvault.com/api/ | JSON | REST v2 | API key (free) | `id`, `name`, `indicators[].type`, `indicators[].indicator`, `tags`, `TLP` | Minutes | Free tier |
| **MISP Default Feeds** | https://www.misp-project.org/feeds/ | MISP JSON + STIX | REST | API key (self-hosted) | Event attributes, indicators, tags, galaxies | Varies per feed | Mixed (mostly free) |
| **PhishTank** | https://checkurl.phishtank.com/checkurl/ | JSON / CSV | REST POST | API key (free) | `url`, `phish_id`, `verified`, `valid`, `verified_at` | Hourly | CC BY-SA |

### AVA.DS.3.4.2 NATS Subject Taxonomy

```
sensor.cyber.mitre.stix      # MITRE ATT&CK STIX 2.1 bundles
sensor.cyber.abusech.json    # abuse.ch (URLhaus, ThreatFox, MalwareBazaar)
sensor.cyber.cisa.json       # CISA KEV catalog
sensor.cyber.otx.json        # AlienVault OTX pulses
sensor.cyber.misp.stix       # MISP feeds in STIX format
sensor.cyber.misp.json       # MISP feeds in native MISP JSON
sensor.cyber.phishtank.json  # PhishTank verified phishing URLs
sensor.cyber.synthetic.stix  # Synthetic STIX bundles for testing
sensor.cyber.synthetic.json  # Synthetic IOC records for testing
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.cyber.mitre.stix` | STIX 2.1 JSON | MITRE ATT&CK knowledge base bundles |
| `sensor.cyber.abusech.json` | JSON | abuse.ch unified feed (URLhaus + ThreatFox + MalwareBazaar) |
| `sensor.cyber.cisa.json` | JSON | CISA KEV vulnerability catalog |
| `sensor.cyber.otx.json` | JSON | AlienVault OTX pulse indicators |
| `sensor.cyber.misp.stix` | STIX 2.1 JSON | MISP feeds exported as STIX bundles |
| `sensor.cyber.synthetic.stix` | STIX 2.1 JSON | Test STIX bundles |

**AVA.3-R6 compliance**: All STIX 2.1 bundles MUST use format token `stix`.
Non-STIX threat feeds MUST use `json`. This enables format-specific deserialization
at the SensorIngestor bridge.

### AVA.DS.3.4.3 Payload Schema

#### STIX 2.1 Bundle Format (Canonical)

The STIX 2.1 bundle is the canonical payload format for the `Cyber` signal kind.
All non-STIX feeds SHOULD be converted to STIX 2.1 at the adapter layer where
feasible.

**Bundle envelope**:

```json
{
  "type": "bundle",
  "id": "bundle--a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "objects": [
    { "type": "indicator", "..." : "..." },
    { "type": "malware", "..." : "..." },
    { "type": "relationship", "..." : "..." },
    { "type": "observed-data", "..." : "..." }
  ]
}
```

**STIX 2.1 Domain Objects (SDOs) relevant to ava-fusion**:

| STIX Type | ava-fusion EntityClass | Purpose |
|-----------|----------------------|---------|
| `indicator` | NetworkHost / Domain / Campaign | IOC with detection pattern |
| `malware` | Campaign | Malware family definition |
| `campaign` | Campaign | Named adversary campaign |
| `threat-actor` | Organization / Person | Adversary attribution |
| `attack-pattern` | Campaign | ATT&CK technique reference |
| `infrastructure` | NetworkHost / Domain | Adversary infrastructure (C2 servers) |
| `vulnerability` | — | CVE reference (joins with CISA KEV) |
| `observed-data` | NetworkHost / Domain | Sighting of observable in the wild |
| `relationship` | — | Links between SDOs (e.g., indicator → malware) |
| `identity` | Organization | Named entity (victim, reporter) |
| `report` | — | Aggregation of related objects |

**STIX 2.1 Cyber-observable Objects (SCOs) embedded in Observed Data**:

| SCO Type | ava-fusion Entity | Key Properties |
|----------|-------------------|----------------|
| `ipv4-addr` | NetworkHost | `value`: `"93.184.216.34"` |
| `ipv6-addr` | NetworkHost | `value`: `"2001:db8::1"` |
| `domain-name` | Domain | `value`: `"evil.example.com"` |
| `url` | Domain + NetworkHost | `value`: full URL |
| `email-addr` | Person | `value`: email address |
| `file` | — | `hashes.SHA-256`, `name`, `size` |
| `network-traffic` | NetworkHost | `src_ref`, `dst_ref`, `protocols` |
| `autonomous-system` | NetworkHost | `number`, `name` |

**Example: STIX 2.1 Indicator (IP-based IOC)**:

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--a932fcc6-e032-476c-826f-cb970a5a1ade",
  "created": "2026-02-20T12:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "name": "Malicious IP — C2 Server",
  "description": "Known command-and-control server for APT campaign",
  "indicator_types": ["malicious-activity"],
  "pattern": "[ipv4-addr:value = '93.184.216.34']",
  "pattern_type": "stix",
  "valid_from": "2026-02-20T00:00:00Z",
  "valid_until": "2026-08-20T00:00:00Z",
  "kill_chain_phases": [
    {
      "kill_chain_name": "mitre-attack",
      "phase_name": "command-and-control"
    }
  ],
  "labels": ["c2", "apt"],
  "confidence": 85,
  "external_references": [
    {
      "source_name": "abuse.ch",
      "url": "https://threatfox.abuse.ch/ioc/12345/"
    }
  ]
}
```

**Example: STIX 2.1 Campaign**:

```json
{
  "type": "campaign",
  "spec_version": "2.1",
  "id": "campaign--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-02-20T12:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "name": "Operation Northern Storm",
  "description": "Multi-vector campaign targeting maritime infrastructure",
  "aliases": ["NorthStorm", "FrozenTide"],
  "first_seen": "2026-01-15T00:00:00Z",
  "objective": "Disruption of port logistics systems"
}
```

#### STIX Bundle → BaseSignal Conversion Path

The STIX-to-BaseSignal conversion is the critical ingestion bridge. The adapter
layer MUST implement the following transformation:

```
STIX Bundle
  │
  ├── Extract objects[] by type
  │     ├── indicator  → parse pattern → extract SCO values
  │     ├── malware    → extract name, hashes
  │     ├── campaign   → extract name, aliases
  │     ├── threat-actor → extract name, aliases
  │     ├── observed-data → extract SCO refs
  │     └── relationship → build entity graph edges
  │
  ├── For each extractable entity:
  │     BaseSignal {
  │       signal_kind: SignalKind::Cyber,
  │       timestamp: object.modified (or object.created),
  │       source_id: "mitre" | "abusech" | "otx" | ...,
  │       entity_ids: [extracted EntityId values],
  │       payload: original STIX object (JSON),
  │       confidence: object.confidence / 100.0  (STIX: 0-100, BaseSignal: 0.0-1.0),
  │     }
  │
  └── Publish to: sensor.cyber.{source}.stix
```

**Pattern parsing**: STIX indicator patterns follow the STIX Patterning Language.
Common patterns relevant to ava-fusion:

| Pattern | Extracted Entity |
|---------|-----------------|
| `[ipv4-addr:value = '1.2.3.4']` | NetworkHost (IpAddress: `1.2.3.4`) |
| `[domain-name:value = 'evil.com']` | Domain (DomainName: `evil.com`) |
| `[url:value = 'http://evil.com/mal']` | Domain + NetworkHost |
| `[file:hashes.SHA-256 = 'abc...']` | — (file hash, no direct entity) |
| `[email-addr:value = 'bad@evil.com']` | Person (email) |
| `[network-traffic:dst_ref.type = 'ipv4-addr' AND ...]` | NetworkHost |

#### Non-STIX Feed Schemas

**abuse.ch ThreatFox IOC**:

```json
{
  "id": "12345",
  "ioc": "93.184.216.34:443",
  "ioc_type": "ip:port",
  "threat_type": "botnet_cc",
  "threat_type_desc": "Indicator that identifies a botnet command&control server",
  "malware": "Cobalt Strike",
  "malware_alias": "CobaltStrike,Agentemis",
  "malware_malpedia": "https://malpedia.caad.fkie.fraunhofer.de/details/win.cobalt_strike",
  "confidence_level": 75,
  "first_seen": "2026-02-20 10:00:00 UTC",
  "last_seen": null,
  "reporter": "analyst123",
  "tags": ["CobaltStrike", "C2"]
}
```

**CISA KEV entry**:

```json
{
  "cveID": "CVE-2024-12345",
  "vendorProject": "Apache",
  "product": "HTTP Server",
  "vulnerabilityName": "Apache HTTP Server Path Traversal",
  "dateAdded": "2026-02-18",
  "shortDescription": "Apache HTTP Server contains a path traversal vulnerability...",
  "requiredAction": "Apply mitigations per vendor instructions or discontinue use.",
  "dueDate": "2026-03-10",
  "knownRansomwareCampaignUse": "Known",
  "notes": ""
}
```

**AlienVault OTX Pulse (abbreviated)**:

```json
{
  "id": "65abc123def456",
  "name": "Maritime Infrastructure Campaign IOCs",
  "description": "Indicators associated with attacks on port logistics",
  "author_name": "analyst",
  "created": "2026-02-19T08:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "TLP": "green",
  "tags": ["maritime", "apt", "c2"],
  "indicators": [
    {
      "type": "IPv4",
      "indicator": "93.184.216.34",
      "description": "C2 server",
      "is_active": 1,
      "role": "c2"
    },
    {
      "type": "domain",
      "indicator": "evil.example.com",
      "description": "Phishing domain",
      "is_active": 1,
      "role": "phishing"
    },
    {
      "type": "FileHash-SHA256",
      "indicator": "e3b0c44298fc1c149afbf4c8996fb924...",
      "description": "Malware dropper",
      "is_active": 1
    }
  ],
  "references": ["https://example.com/report"],
  "targeted_countries": ["US", "NO", "NL"]
}
```

### AVA.DS.3.4.4 Entity Mapping

**From STIX 2.1 objects**:

| STIX Object Type | STIX Property | EntityClass | IdentifierNamespace | Example |
|------------------|---------------|-------------|---------------------|---------|
| `indicator` (pattern) | `ipv4-addr:value` | NetworkHost | IpAddress | `93.184.216.34` |
| `indicator` (pattern) | `domain-name:value` | Domain | DomainName | `evil.example.com` |
| `campaign` | `id` | Campaign | STIX ID | `campaign--8e2e2d2b-...` |
| `campaign` | `name` | Campaign | Name | `Operation Northern Storm` |
| `threat-actor` | `name` | Organization | Name | `APT29` |
| `infrastructure` | `name` + pattern | NetworkHost / Domain | IpAddress / DomainName | C2 server IP/domain |
| `observed-data` → `ipv4-addr` | `value` | NetworkHost | IpAddress | `10.0.0.1` |
| `observed-data` → `domain-name` | `value` | Domain | DomainName | `suspect.example.org` |
| `identity` | `name` | Organization | Name | `Victim Corp` |

**From non-STIX feeds**:

| Source | Source Field | EntityClass | IdentifierNamespace | Example |
|--------|-------------|-------------|---------------------|---------|
| abuse.ch ThreatFox | `ioc` (ip:port) | NetworkHost | IpAddress | `93.184.216.34` |
| abuse.ch URLhaus | `host` | Domain / NetworkHost | DomainName / IpAddress | `evil.example.com` |
| abuse.ch MalwareBazaar | `sha256_hash` | — | — | File hash (no entity) |
| CISA KEV | `vendorProject` + `product` | — | — | Vulnerability (enrichment only) |
| AlienVault OTX | `indicators[].indicator` (IPv4) | NetworkHost | IpAddress | `93.184.216.34` |
| AlienVault OTX | `indicators[].indicator` (domain) | Domain | DomainName | `evil.example.com` |
| PhishTank | `url` (extracted host) | Domain | DomainName | `phishing.example.com` |

### AVA.DS.3.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Http | Key-based | IP / Domain from STIX indicator pattern vs. Http flow `id.resp_h` / `host` | Tier 1 | **Critical path** — IOC match on network flows |
| Dns | Key-based | Domain from STIX indicator vs. DNS `query` / `rrname` | Tier 1 | **Critical path** — DNS resolution to malicious domain |
| Osint | Key-based | Campaign name / threat actor in GDELT/news | Tier 2 | Campaign context enrichment from open sources |
| Social | Key-based | IOC domains/IPs discussed on social media | Tier 2 | Social amplification of threat intelligence |
| AdsB | Behavioral | Campaign targeting aviation → ADS-B tracks at targeted airports | Tier 3 | Kinetic situational awareness during cyber campaign |
| Ais | Behavioral | Campaign targeting maritime → AIS tracks at targeted ports | Tier 3 | Maritime situational awareness during cyber campaign |
| Financial | Key-based | Threat actor org vs. sanctions lists | Tier 2 | Financial sanctions enrichment for attribution |
| RfBearing | Spatial | C2 server geolocation vs. RF bearing intersection | Tier 3 | Geolocation of adversary infrastructure |

### AVA.DS.3.4.6 Synthetic Data Generation

**STIX 2.1 synthetic bundle generation**:

| Object Type | Generation Strategy |
|-------------|---------------------|
| `indicator` | Generate with randomized IP/domain patterns; confidence 50-95; valid_from within last 30 days |
| `malware` | Sample names from MITRE ATT&CK software list; randomize hashes |
| `campaign` | Named campaigns with 3-8 related indicators; first_seen within last 90 days |
| `threat-actor` | Named actors with aliases; resource_level from [individual, club, organization, government] |
| `relationship` | `indicator` → `indicates` → `malware`; `campaign` → `uses` → `malware`; `threat-actor` → `attributed-to` → `campaign` |
| `observed-data` | Embed synthetic SCOs (ipv4-addr, domain-name, network-traffic) |
| `bundle` | 5-50 objects per bundle; realistic relationship graph |

**Non-STIX synthetic IOC generation**:

| Parameter | Range / Strategy |
|-----------|------------------|
| IP IOCs | Mix of RFC 5737 documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) + random public IPs |
| Domain IOCs | DGA-like labels (consonant-heavy, 8-20 chars) + typosquat of Tranco top-1K |
| File hashes | Random SHA-256; some matching MalwareBazaar known hashes for replay |
| Confidence | Uniform 30-100 for ThreatFox; binary verified/unverified for PhishTank |
| Temporal | `first_seen` uniformly distributed over last 30 days |
| **Generation strategy** | Scenario-based: generate a campaign with 10-30 indicators, 2-5 malware families, 1-3 threat actors, and realistic relationship graph. Publish as STIX bundle + individual IOC records. |

---

## Appendix A: STIX 2.1 Integration Architecture

### A.1 Ingestion Pipeline

```
                    ┌──────────────────────────────────┐
                    │         Source Adapters           │
                    ├──────────────────────────────────┤
                    │ MITRE ATT&CK  │  TAXII 2.1 poll │
                    │ abuse.ch      │  REST poll (5m)  │
                    │ CISA KEV      │  HTTP GET (1h)   │
                    │ AlienVault OTX│  REST poll (5m)  │
                    │ MISP feeds    │  REST pull        │
                    │ PhishTank     │  REST poll (1h)  │
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │     STIX Normalization Layer      │
                    │                                  │
                    │  Non-STIX → STIX 2.1 converter   │
                    │  (ThreatFox IOC → STIX indicator) │
                    │  (CISA KEV → STIX vulnerability)  │
                    │  (OTX pulse → STIX bundle)        │
                    │  (PhishTank → STIX indicator)      │
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │        NATS Publication           │
                    │                                  │
                    │  Native STIX → sensor.cyber.*.stix│
                    │  Converted   → sensor.cyber.*.stix│
                    │  Raw non-STIX→ sensor.cyber.*.json│
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │    SensorIngestor (Cyber)         │
                    │    Subscribes: sensor.cyber.>     │
                    │                                  │
                    │  1. Deserialize STIX/JSON         │
                    │  2. Extract entities (pattern parse)│
                    │  3. Build BaseSignal              │
                    │  4. Publish to fusion pipeline    │
                    └──────────────────────────────────┘
```

### A.2 STIX Pattern Parser Requirements

The SensorIngestor for `Cyber` MUST implement a STIX Patterning Language parser
capable of extracting observable values from at minimum these pattern types:

| Pattern Type | Example | Extraction |
|-------------|---------|------------|
| Simple comparison | `[ipv4-addr:value = '1.2.3.4']` | IP address |
| Simple comparison | `[domain-name:value = 'evil.com']` | Domain name |
| Simple comparison | `[url:value = 'http://evil.com/path']` | URL (domain + path) |
| Simple comparison | `[file:hashes.SHA-256 = 'abc...']` | File hash |
| AND compound | `[network-traffic:dst_ref.type = 'ipv4-addr' AND network-traffic:dst_port = 443]` | IP + port |
| OR compound | `[ipv4-addr:value = '1.2.3.4' OR ipv4-addr:value = '5.6.7.8']` | Multiple IPs |

Complex patterns (LIKE, MATCHES, nested observations) MAY be deferred to a
later implementation phase.

### A.3 Confidence Normalization

Different sources use different confidence scales. The adapter layer MUST normalize
to the BaseSignal `confidence: f64` field (range 0.0 to 1.0):

| Source | Native Scale | Normalization |
|--------|-------------|---------------|
| STIX 2.1 `confidence` | 0-100 (integer) | `value / 100.0` |
| abuse.ch ThreatFox `confidence_level` | 0-100 (integer) | `value / 100.0` |
| AlienVault OTX | No explicit confidence | Default `0.70` |
| CISA KEV | Binary (in catalog = exploited) | Fixed `0.95` |
| MITRE ATT&CK | No explicit confidence | Default `0.90` (curated by MITRE) |
| PhishTank `verified` | Boolean | `true` → `0.85`, `false` → `0.40` |
| MISP `threat_level_id` | 1-4 (High to Undefined) | `[0.90, 0.70, 0.50, 0.30]` |

### A.4 TAXII 2.1 Polling Configuration

For the MITRE ATT&CK TAXII server:

| Parameter | Value |
|-----------|-------|
| Discovery URL | `https://attack-taxii.mitre.org/taxii2/` |
| API Root | `https://attack-taxii.mitre.org/api/v21/` |
| Collections | `enterprise-attack`, `mobile-attack`, `ics-attack` |
| Rate Limit | 10 requests per 10-minute window per source IP |
| Poll Interval | Every 6 hours (data updates ~quarterly) |
| Auth | None (public) |

---

## Appendix B: JetStream Configuration for Cyber Domain

From the NATS Subject Taxonomy (AVA.3.7):

| Stream Name | Subjects | Retention | Max Age | Storage | Notes |
|-------------|----------|-----------|---------|---------|-------|
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | File | Longer retention than kinetic — threat intel has longer relevance window |

**Consumer groups**:

| Consumer | Filter | Deliver Policy | Ack Policy |
|----------|--------|----------------|------------|
| `cyber-ingestor` | `sensor.cyber.>` | All | Explicit |
| `http-ingestor` | `sensor.http.>` | All | Explicit |
| `dns-ingestor` | `sensor.dns.>` | All | Explicit |
| `ioc-matcher` | `sensor.cyber.*.stix` | All | Explicit |
| `dns-enricher` | `sensor.dns.*.json` | New | None |

---

*End of Section AVA.DS.3*
