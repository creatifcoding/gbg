# AVA.DS.4: OSINT/Social/Financial Domain Data Sources

```
Section:       AVA.DS.4 — OSINT/Social/Financial Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
SignalKinds:   Osint, Social, Financial, Travel
EntityClasses: Person, Organization, Campaign
```

> This section catalogs open-source intelligence, social media, financial/sanctions,
> and travel data sources that feed the ava-fusion pipeline. These four SignalKinds
> share a common characteristic: they produce **identity-centric** signals rather than
> geospatial tracks, making them primary inputs for **Person**, **Organization**, and
> **Campaign** entity resolution. The key words "MUST", "MUST NOT", "REQUIRED",
> "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED",
> "MAY", and "OPTIONAL" in this document are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Overview](#avads41-overview)
2. [Signal Kind: Osint](#avads42-signal-kind-osint)
3. [Signal Kind: Social](#avads43-signal-kind-social)
4. [Signal Kind: Financial](#avads44-signal-kind-financial)
5. [Signal Kind: Travel](#avads45-signal-kind-travel)
6. [Cross-Domain Correlation Summary](#avads46-cross-domain-correlation-summary)
7. [JetStream Configuration](#avads47-jetstream-configuration)
8. [References](#avads48-references)

---

## AVA.DS.4.1 Overview

The OSINT/Social/Financial domain encompasses four SignalKinds that observe
human and organizational activity through publicly available information channels:

| SignalKind | DataType | Description | Primary Entities |
|------------|----------|-------------|-----------------|
| `Osint` | Event | News events, web archives, knowledge graphs | Person, Organization, Campaign |
| `Social` | Event | Social media posts, handles, network graphs | Person, Organization |
| `Financial` | Reference | Sanctions lists, corporate registries, filings | Person, Organization |
| `Travel` | Event | Passenger records, route data, border crossings | Person |

**Fusion role**: These signals provide the **identity layer** of the fusion pipeline.
While kinetic and RF domains produce geospatial tracks, OSINT/Social/Financial
signals resolve **who** is behind those tracks. Tier 1 joins use hard identifiers
(social handles, LEI codes, OFAC entity IDs). Tier 2 joins use name matching,
temporal co-occurrence, and network proximity.

**DataType split**: `Financial` sources are primarily `Reference` (slowly-changing
registries materialized as d2ts arrangements). `Osint`, `Social`, and `Travel` are
`Event` streams (volatile, append-only, timestamped).

---

## AVA.DS.4.2 Signal Kind: Osint

### AVA.DS.4.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| GDELT Event Database | https://www.gdeltproject.org/ | CSV/BigQuery | REST + BigQuery | None (BigQuery needs GCP) | `GLOBALEVENTID`, `Actor1Name`, `Actor2Name`, `ActionGeo_*`, `DATEADDED` | 15 min | Free/Open |
| GDELT GKG | https://www.gdeltproject.org/ | CSV/BigQuery | REST + BigQuery | None (BigQuery needs GCP) | `DocumentIdentifier`, `Persons`, `Organizations`, `Themes`, `Tone` | 15 min | Free/Open |
| Wayback Machine CDX | https://web.archive.org/cdx/search/cdx | JSON/CDX | REST GET | None | `urlkey`, `timestamp`, `mimetype`, `statuscode`, `digest` | Continuous | Free/Open |
| Common Crawl | https://commoncrawl.org/ | WARC/WET/WAT | S3 (`s3://commoncrawl/`) | None (`--no-sign-request`) | `url`, `timestamp`, `content-type`, `payload` | Monthly crawl | Free/Open |
| RSS/Atom News Feeds | Various | XML (RSS 2.0/Atom) | HTTP GET | None | `title`, `link`, `pubDate`, `description`, `author` | Publisher-dependent | Varies |

**Notes**:
- **GDELT** is the highest-value OSINT source. The Event Database encodes geopolitical
  events using the CAMEO coding system with actor identification, event type, and
  geolocation. The GKG extracts persons, organizations, themes, and sentiment from
  every news article worldwide.
- **GDELT direct download**: Files are available at
  `http://data.gdeltproject.org/gdeltv2/{YYYYMMDDHHMMSS}.export.CSV.zip` (events)
  and `http://data.gdeltproject.org/gdeltv2/{YYYYMMDDHHMMSS}.gkg.csv.zip` (GKG),
  published every 15 minutes. No authentication required.
- **Common Crawl**: As of March 2025 (CC-MAIN-2025-13), the truncation threshold
  increased from 1 MiB to 5 MiB. Access via `aws --no-sign-request s3 ls s3://commoncrawl/`.
- **Wayback Machine CDX**: The only required parameter is `url=`. Supports
  `output=json`, field selection via `fl=`, and timestamp filtering with `from=`/`to=`.

### AVA.DS.4.2.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.osint.gdelt.events` | JSON | Parsed GDELT event records (CAMEO-coded) |
| `sensor.osint.gdelt.gkg` | JSON | GDELT Global Knowledge Graph extracts |
| `sensor.osint.wayback.json` | JSON | Wayback Machine CDX query results |
| `sensor.osint.commoncrawl.json` | JSON | Common Crawl extracted page metadata |
| `sensor.osint.news.rss` | JSON | Normalized RSS/Atom feed items |
| `sensor.osint.gdelt.raw` | CSV | Raw GDELT CSV before parsing |
| `sensor.osint.commoncrawl.raw` | WARC ref | Object Store reference to WARC segment |

**Normative**: Source adapters MUST normalize all OSINT sources into the canonical
`OsintSignal` payload schema (AVA.DS.4.2.3) before publishing to `.events`/`.gkg`
subjects. Raw formats MAY be published to `.raw` subjects for replay.

### AVA.DS.4.2.3 Payload Schema

```json
{
  "$id": "ava://schemas/osint-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "timestamp", "headline"],
  "properties": {
    "signalKind": { "const": "osint" },
    "sourceId": {
      "type": "string",
      "description": "Unique signal ID (e.g., 'gdelt:1234567890')"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 event timestamp"
    },
    "headline": {
      "type": "string",
      "description": "Article title or event summary"
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Source document URL"
    },
    "persons": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extracted person names"
    },
    "organizations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extracted organization names"
    },
    "themes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "GDELT GKG themes or user-defined tags"
    },
    "tone": {
      "type": "number",
      "description": "Sentiment score (-10 to +10, GDELT tone scale)"
    },
    "cameoEventCode": {
      "type": "string",
      "description": "CAMEO event code (GDELT events only)"
    },
    "geo": {
      "type": "object",
      "properties": {
        "lat": { "type": "number" },
        "lon": { "type": "number" },
        "name": { "type": "string" },
        "countryCode": { "type": "string" }
      },
      "description": "Geolocation of the event (if available)"
    }
  }
}
```

### AVA.DS.4.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `persons[]` | Person | Custom (name) | `"John Smith"` |
| `organizations[]` | Organization | Custom (name) | `"Acme Corp"` |
| `cameoEventCode` + actors | Campaign | Custom (campaign ID) | `"cameo:040"` (verbal conflict) |
| `url` (domain) | Domain | DomainName | `"reuters.com"` |

**Identity resolution**: OSINT person/org names require fuzzy matching against
known entity registries (Financial domain sanctions lists, corporate registries).
This is a **Tier 2** (soft key) operation — no hard identifier exists in raw OSINT.

### AVA.DS.4.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Social | Name + Temporal | Person/Org name + time window | Tier 2 |
| Financial | Name match | Organization name ↔ SDN/LEI name | Tier 2 |
| Cyber | URL/Domain | Document URL domain ↔ threat indicator domain | Tier 1 |
| Humint | Name + Location | Actor names + geo coordinates | Tier 2 |
| AdsB/Ais | Geo + Temporal | Event geo ↔ track position + time | Tier 3 |

### AVA.DS.4.2.6 Synthetic Data Generation

**GDELT synthetic**: Not required — GDELT is freely available with 15-minute updates.
For **offline testing**, replay captured GDELT CSV files via the feeder.

**RSS synthetic**: Generate with parametric templates:
- Schema: `{ title: string, link: string, pubDate: ISO8601, description: string, author: string }`
- Topics: draw from GDELT theme taxonomy (2000+ themes)
- Names: sample from census name lists + country-appropriate org names
- Rate: 1-10 articles/minute per simulated feed

---

## AVA.DS.4.3 Signal Kind: Social

### AVA.DS.4.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| Mastodon Public Timeline | https://docs.joinmastodon.org/methods/timelines/ | JSON | REST | None (public) / OAuth (auth'd) | `id`, `account.acct`, `content`, `created_at`, `tags[]` | Real-time | AGPL-3.0 (server) |
| Bluesky AT Protocol Firehose | https://docs.bsky.app/docs/advanced-guides/firehose | CBOR/JSON | WebSocket (`com.atproto.sync.subscribeRepos`) | None | `did`, `handle`, `text`, `createdAt`, `facets[]` | Real-time | MIT |
| Reddit API | https://www.reddit.com/dev/api/ | JSON | REST (OAuth) | OAuth2 required | `author`, `subreddit`, `title`, `selftext`, `created_utc`, `score` | Real-time | Reddit TOS |
| Pushshift (Reddit Archive) | https://archive.org/details/reddit-data-comments | JSON/ZSTD | Bulk download / API (mod-only) | Mod approval | `author`, `subreddit`, `body`, `created_utc` | Archive (2005-2022) | Research |
| GitHub Events API | https://docs.github.com/en/rest/activity/events | JSON | REST | Token (optional) | `type`, `actor.login`, `repo.name`, `created_at`, `payload` | Real-time | GitHub TOS |

**Notes**:
- **Mastodon**: Per-instance API. Rate limit: 300 req/5min (authenticated), 7500 req/5min
  (per-IP unauthenticated). Public timeline requires no auth. Each instance has its own
  endpoint (e.g., `mastodon.social`, `hachyderm.io`).
- **Bluesky**: The firehose is a WebSocket stream at
  `wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos`. No authentication required.
  Receives **all** public network events. Jetstream alternative available but not
  protocol-stable.
- **Reddit**: Free tier = 60 req/min (OAuth), 10 req/min (unauthenticated). Non-commercial
  use only for free tier. Commercial use requires pre-approval.
- **Pushshift**: Real-time ingestion stopped in 2023. Historical archive (2005-2022)
  available via Internet Archive. API access restricted to approved Reddit moderators.
- **GitHub Events**: 60 req/hr (unauthenticated), 5000 req/hr (authenticated with token).
  Public events endpoint returns the last 300 events.

### AVA.DS.4.3.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.social.mastodon.json` | JSON | Mastodon public timeline posts |
| `sensor.social.bluesky.json` | JSON | Bluesky AT Protocol firehose events |
| `sensor.social.reddit.json` | JSON | Reddit submissions and comments |
| `sensor.social.github.json` | JSON | GitHub public events |
| `sensor.social.pushshift.json` | JSON | Pushshift archive replay |
| `sensor.social.mastodon.raw` | JSON | Raw Mastodon API response (before normalization) |
| `sensor.social.bluesky.raw` | CBOR | Raw AT Protocol repo events (CBOR-encoded) |

**Normative**: Bluesky raw events are CBOR-encoded repository operations. Source
adapters MUST decode CBOR and extract post/like/follow records before publishing to
the `.json` subject. The `.raw` subject MAY carry the original CBOR for archival.

### AVA.DS.4.3.3 Payload Schema

```json
{
  "$id": "ava://schemas/social-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "platform", "handle", "timestamp"],
  "properties": {
    "signalKind": { "const": "social" },
    "sourceId": {
      "type": "string",
      "description": "Platform-qualified post ID (e.g., 'mastodon:12345@mastodon.social')"
    },
    "platform": {
      "type": "string",
      "enum": ["mastodon", "bluesky", "reddit", "github", "pushshift"],
      "description": "Source platform identifier"
    },
    "handle": {
      "type": "string",
      "description": "User handle (e.g., '@user@instance', 'user.bsky.social', 'u/username')"
    },
    "displayName": {
      "type": "string",
      "description": "User display name (may differ from handle)"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "content": {
      "type": "string",
      "description": "Post text content (HTML stripped)"
    },
    "eventType": {
      "type": "string",
      "enum": ["post", "reply", "repost", "like", "follow", "commit", "issue", "pr"],
      "description": "Type of social activity"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Hashtags or topic tags"
    },
    "mentions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Mentioned handles"
    },
    "urls": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "description": "Embedded URLs"
    },
    "replyTo": {
      "type": "string",
      "description": "Parent post ID if this is a reply"
    },
    "engagement": {
      "type": "object",
      "properties": {
        "likes": { "type": "integer" },
        "reposts": { "type": "integer" },
        "replies": { "type": "integer" }
      }
    }
  }
}
```

### AVA.DS.4.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `handle` | Person | SocialHandle | `"@user@mastodon.social"` |
| `handle` (org accounts) | Organization | SocialHandle | `"@mozilla@mozilla.social"` |
| `mentions[]` | Person | SocialHandle | `"user.bsky.social"` |
| `urls[]` (domain) | Domain | DomainName | `"github.com"` |
| `tags[]` (campaign hashtags) | Campaign | Custom | `"#OpName"` |

**Identity resolution**: Social handles are the **primary hard key** for Person entities
in this domain. Cross-platform identity linkage (same person on Mastodon + Bluesky +
Reddit) is a **Tier 2** operation requiring profile bio matching, temporal correlation,
or explicit cross-references in user profiles.

### AVA.DS.4.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Osint | Name + Temporal | Social handle display name ↔ OSINT person name | Tier 2 |
| Financial | Name match | Display name ↔ SDN entity name | Tier 2 |
| Cyber | URL + Domain | Shared URLs in posts ↔ threat indicator URLs | Tier 1 |
| Social (cross-platform) | Profile matching | Handle bio, display name, linked URLs | Tier 2 |
| Dns | Domain | URLs in posts ↔ passive DNS records | Tier 1 |

### AVA.DS.4.3.6 Synthetic Data Generation

**Mastodon synthetic**: Generate mock ActivityPub-style posts:
- Schema: `{ id, account: { acct, display_name }, content, created_at, tags: [{name}] }`
- Handles: `@{firstname}{lastname}@{instance}` from name lists + instance pool
- Content: Template-based with topic hashtags from a configurable theme set
- Rate: 5-50 posts/second per simulated instance
- Engagement: Poisson-distributed likes/boosts (lambda=3)

**Bluesky synthetic**: Generate mock AT Protocol records:
- Schema: `{ did, handle, text, createdAt, facets: [{mention, link}] }`
- DIDs: `did:plc:{random-32char}` format
- Handles: `{name}.bsky.social`

**Reddit synthetic**: Generate mock submissions:
- Schema: `{ author, subreddit, title, selftext, created_utc, score }`
- Subreddits: Pool of 50 simulated communities
- Score: Log-normal distribution (median=10, sigma=2)

---

## AVA.DS.4.4 Signal Kind: Financial

### AVA.DS.4.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OFAC SDN List | https://ofac.treasury.gov/sanctions-list-service | XML/CSV | Download | None | `uid`, `sdnName`, `sdnType`, `programList`, `idList`, `addressList` | ~Weekly | US Gov (Public Domain) |
| OpenSanctions | https://www.opensanctions.org/ | JSON (FtM)/CSV | REST + Bulk | None (bulk), API key (search) | `id`, `schema`, `properties.name`, `datasets[]` | Daily | Open (non-commercial free) |
| GLEIF LEI Database | https://www.gleif.org/en/lei-data/gleif-api | JSON/XML/CSV | REST API | None | `LEI`, `Entity.LegalName`, `Entity.LegalAddress`, `Registration.Status` | Daily | Free/Open |
| SEC EDGAR | https://data.sec.gov/ | JSON/XBRL | REST | None (User-Agent required) | `cik`, `entityName`, `filings[]`, `facts.us-gaap.*` | Continuous | US Gov (Public Domain) |
| OpenCorporates | https://api.opencorporates.com/ | JSON | REST | API key | `company_number`, `name`, `jurisdiction_code`, `incorporation_date` | Daily | Open (free tier limited) |

**Notes**:
- **OFAC SDN**: The canonical sanctions list. Available as `SDN.xml` (full structured),
  `sdn.csv` (flat), and the newer Advanced Sanctions XML standard. Download from
  `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML`.
  No API key, no rate limit on downloads. Updated approximately weekly.
- **OpenSanctions**: Aggregates 100+ sanctions and PEP lists worldwide. Bulk download:
  `https://data.opensanctions.org/datasets/latest/default/entities.ftm.json`. Free for
  non-commercial use. Commercial use requires license.
- **GLEIF**: Free API, no registration required. Supports up to 200 LEI records per
  request. Concatenated files published daily for bulk download.
- **SEC EDGAR**: Free, no API key required. User-Agent header MUST include contact
  email. Rate limit: 10 requests/second. XBRL data available as structured JSON at
  `https://data.sec.gov/api/xbrl/companyfacts/CIK{number}.json`.
- **OpenCorporates**: Free tier = 200 requests/month, 50 requests/day. Open data projects
  get free unlimited access. Covers 200M+ companies across jurisdictions.

### AVA.DS.4.4.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.financial.ofac.json` | JSON | Parsed OFAC SDN entries |
| `sensor.financial.opensanctions.json` | JSON | OpenSanctions entity records |
| `sensor.financial.gleif.json` | JSON | GLEIF LEI records |
| `sensor.financial.edgar.json` | JSON | SEC EDGAR filing metadata |
| `sensor.financial.opencorporates.json` | JSON | OpenCorporates company records |
| `sensor.financial.ofac.raw` | XML | Raw OFAC SDN XML |
| `sensor.financial.gleif.raw` | CSV | Raw GLEIF concatenated file |

**Normative**: Financial sources are **Reference** data (DataType::Reference).
Source adapters SHOULD publish to the `.json` normalized subject after parsing.
The `.raw` subjects MAY be used for archival of original formats. Financial data
MUST be materialized in the `ava-state` KV bucket for O(1) lookup by entity ID.

### AVA.DS.4.4.3 Payload Schema

```json
{
  "$id": "ava://schemas/financial-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "source", "entityName", "entityType", "lastUpdated"],
  "properties": {
    "signalKind": { "const": "financial" },
    "sourceId": {
      "type": "string",
      "description": "Source-qualified entity ID (e.g., 'ofac:12345', 'lei:5493001KJTIIGC8Y1R12')"
    },
    "source": {
      "type": "string",
      "enum": ["ofac", "opensanctions", "gleif", "edgar", "opencorporates"],
      "description": "Data source identifier"
    },
    "entityName": {
      "type": "string",
      "description": "Primary entity name"
    },
    "entityType": {
      "type": "string",
      "enum": ["individual", "entity", "vessel", "aircraft"],
      "description": "OFAC-style entity type classification"
    },
    "aliases": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Known aliases / alternate names"
    },
    "identifiers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "description": "ID type (passport, taxId, LEI, CIK)" },
          "value": { "type": "string" },
          "country": { "type": "string" }
        }
      },
      "description": "Government/corporate identifiers"
    },
    "sanctionsPrograms": {
      "type": "array",
      "items": { "type": "string" },
      "description": "OFAC/sanctions program codes (e.g., 'SDGT', 'IRAN')"
    },
    "jurisdiction": {
      "type": "string",
      "description": "Country or jurisdiction code (ISO 3166-1 alpha-2)"
    },
    "addresses": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "street": { "type": "string" },
          "city": { "type": "string" },
          "country": { "type": "string" }
        }
      }
    },
    "legalForm": {
      "type": "string",
      "description": "Legal entity form (GLEIF/OpenCorporates)"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "dissolved", "sanctioned"],
      "description": "Current entity status"
    },
    "lastUpdated": {
      "type": "string",
      "format": "date-time",
      "description": "Last update timestamp from source"
    }
  }
}
```

### AVA.DS.4.4.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `entityName` (individual) | Person | Custom (name) | `"PUTIN, Vladimir Vladimirovich"` |
| `entityName` (entity) | Organization | Custom (name/LEI) | `"SBERBANK"` |
| `identifiers[type=LEI]` | Organization | Custom (LEI) | `"5493001KJTIIGC8Y1R12"` |
| `identifiers[type=passport]` | Person | Custom (passport) | `"AB1234567"` |
| `entityType=vessel` | Vessel | Mmsi | (cross-reference to AIS) |
| `entityType=aircraft` | Aircraft | IcaoHex | (cross-reference to ADS-B) |
| `sanctionsPrograms` + linked entities | Campaign | Custom (program code) | `"SDGT"` (terrorism) |

**Identity resolution**: Financial sources provide the **richest identity attributes**
in the pipeline. OFAC SDN entries include passport numbers, tax IDs, dates of birth,
and aliases — enabling high-confidence Tier 1 matching against other identity-bearing
signals. LEI codes from GLEIF provide **globally unique** organization identifiers.

### AVA.DS.4.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Osint | Name match | SDN/LEI entity name ↔ OSINT person/org name | Tier 2 |
| Social | Name match | Entity name/alias ↔ social display name | Tier 2 |
| AdsB | ICAO hex | OFAC aircraft entries ↔ ADS-B tracks | Tier 1 |
| Ais | MMSI/vessel name | OFAC vessel entries ↔ AIS tracks | Tier 1 |
| Cyber | Domain/IP | Corporate domains ↔ threat indicators | Tier 2 |
| Travel | Name + Document | Person name + passport ↔ PNR passenger | Tier 1 |
| Financial (cross-source) | LEI/Name | GLEIF LEI ↔ EDGAR CIK ↔ OpenCorporates ID | Tier 1 |

### AVA.DS.4.4.6 Synthetic Data Generation

**OFAC synthetic**: Not required for basic testing — the real SDN list is freely
downloadable. For **volume testing**, generate synthetic entries:
- Schema: mirrors `FinancialSignal` above
- Names: Random person/org names with culturally appropriate aliases
- Programs: Sample from real OFAC program codes (`SDGT`, `IRAN`, `CYBER2`, `UKRAINE-EO13661`)
- Identifiers: Random passport/tax ID formats per country
- Rate: Bulk load (1000-10000 entries), not streaming

**GLEIF synthetic**:
- LEI format: `{4-digit prefix}{14-digit random}{2-digit checksum}`
- Legal names: Company name generator + jurisdiction suffix
- Status: 80% active, 15% lapsed, 5% retired

---

## AVA.DS.4.5 Signal Kind: Travel

### AVA.DS.4.5.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OpenFlights Routes DB | https://openflights.org/data | CSV (`.dat`) | Download | None | `airline`, `source_airport`, `dest_airport`, `stops`, `equipment` | Static (last updated 2014) | ODbL |
| Synthetic PNR Generator | N/A | JSON | Internal | N/A | `pnr_id`, `passenger_name`, `flight`, `departure`, `arrival`, `passport` | Configurable | Synthetic |

**Notes**:
- **OpenFlights**: Historical route data (67,663 routes, 3,321 airports, 548 airlines as
  of June 2014). Useful as **reference data** for route plausibility validation and
  synthetic PNR generation, but not current operational data.
- **Real PNR/APIS data**: Government-classified (CBP, Europol). Not available for open
  integration. The ava-fusion pipeline uses **synthetic PNR generation** for development
  and testing, with schemas modeled after IATA PNRGOV and UN/EDIFACT PAXLST standards.

### AVA.DS.4.5.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.travel.synthetic.json` | JSON | Synthetic PNR records |
| `sensor.travel.openflights.csv` | CSV | OpenFlights route reference data |
| `sensor.travel.synthetic.pnr` | JSON | Structured PNR with passenger details |
| `sensor.travel.synthetic.apis` | JSON | Synthetic APIS (passenger manifest) records |

**Normative**: All travel signals in the dev/test pipeline MUST be synthetic.
Production travel integrations require separate compliance review and are out of
scope for this RFC.

### AVA.DS.4.5.3 Payload Schema

```json
{
  "$id": "ava://schemas/travel-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "recordType", "timestamp"],
  "properties": {
    "signalKind": { "const": "travel" },
    "sourceId": {
      "type": "string",
      "description": "PNR record locator or manifest ID (e.g., 'pnr:ABC123')"
    },
    "recordType": {
      "type": "string",
      "enum": ["pnr", "apis", "border_crossing"],
      "description": "Travel record type"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Record creation or flight departure time"
    },
    "passenger": {
      "type": "object",
      "properties": {
        "givenName": { "type": "string" },
        "surname": { "type": "string" },
        "dob": { "type": "string", "format": "date" },
        "nationality": { "type": "string", "description": "ISO 3166-1 alpha-2" },
        "documentType": { "type": "string", "enum": ["passport", "national_id", "visa"] },
        "documentNumber": { "type": "string" },
        "documentCountry": { "type": "string" }
      },
      "required": ["givenName", "surname"]
    },
    "itinerary": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "flightNumber": { "type": "string" },
          "airline": { "type": "string" },
          "departureAirport": { "type": "string", "description": "IATA code" },
          "arrivalAirport": { "type": "string", "description": "IATA code" },
          "departureTime": { "type": "string", "format": "date-time" },
          "arrivalTime": { "type": "string", "format": "date-time" },
          "seatNumber": { "type": "string" },
          "bookingClass": { "type": "string" }
        }
      }
    },
    "companions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "PNR co-travelers (names)"
    },
    "paymentMethod": {
      "type": "string",
      "enum": ["credit_card", "cash", "wire_transfer", "crypto"],
      "description": "Booking payment method"
    }
  }
}
```

### AVA.DS.4.5.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `passenger.givenName` + `surname` | Person | Custom (name) | `"SMITH, John"` |
| `passenger.documentNumber` | Person | Custom (passport) | `"AB1234567"` |
| `itinerary[].airline` | Organization | Custom (IATA code) | `"BA"` (British Airways) |
| `itinerary[].departureAirport` | Facility | Custom (IATA code) | `"LHR"` |

### AVA.DS.4.5.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Financial | Document + Name | Passport number ↔ OFAC SDN identifiers | Tier 1 |
| AdsB | Flight + Time | Flight number ↔ ADS-B callsign + departure time | Tier 1 |
| Social | Name + Temporal | Passenger name ↔ social media check-in posts | Tier 3 |
| Osint | Name + Location | Passenger name ↔ news mentions at destination | Tier 3 |
| Travel (self-join) | Document | Passport number across multiple PNRs → travel pattern | Tier 1 |

### AVA.DS.4.5.6 Synthetic Data Generation

PNR generation is the **primary data strategy** for the Travel signal kind:

- **Passenger identity**: Random realistic names from census data, weighted by
  nationality. Passport numbers formatted per issuing country conventions.
- **Itinerary**: Select routes from OpenFlights database. Generate 1-4 leg itineraries
  with realistic connection times (45min-4hr domestic, 2hr-8hr international).
- **Temporal distribution**: Flights weighted toward business hours (0600-2200 local).
  Seasonal variation: +30% summer, -20% winter for leisure routes.
- **Companions**: 40% solo, 35% pairs, 15% family (3-5), 10% group (6+).
- **Payment**: 70% credit card, 20% cash, 8% wire transfer, 2% crypto.
- **Red flag injection**: 5% of synthetic PNRs include anomaly indicators:
  - Last-minute booking (<24hr before departure)
  - One-way ticket to high-risk destination
  - Cash payment for expensive route
  - Passport country mismatch with departure location
  - Known OFAC SDN name match (synthetic)
- **Rate**: 10-100 PNR records/minute for pipeline testing
- **Generation strategy**: Parametric with configurable anomaly rate

---

## AVA.DS.4.6 Cross-Domain Correlation Summary

This matrix summarizes all join paths originating from OSINT/Social/Financial/Travel
signals to other domains:

| From → To | Join Key | Tier | Confidence | Notes |
|-----------|----------|------|------------|-------|
| Financial → AdsB | OFAC aircraft ICAO hex | Tier 1 | High | Sanctioned aircraft tracking |
| Financial → Ais | OFAC vessel MMSI/name | Tier 1 | High | Sanctioned vessel tracking |
| Financial → Travel | Passport/name match | Tier 1 | High | Watchlist screening |
| Financial → Financial | LEI/CIK cross-ref | Tier 1 | High | Corporate identity linkage |
| Social → Cyber | Shared URLs/domains | Tier 1 | High | Threat actor infrastructure |
| Social → Social | Cross-platform profile | Tier 2 | Medium | Identity unification |
| Social → Osint | Name + time window | Tier 2 | Medium | Person activity correlation |
| Osint → Financial | Org name match | Tier 2 | Medium | Entity enrichment |
| Osint → Humint | Name + geo | Tier 2 | Medium | Ground truth correlation |
| Osint → AdsB/Ais | Geo + time | Tier 3 | Low | Event-track correlation |
| Travel → AdsB | Flight callsign | Tier 1 | High | Passenger-aircraft linkage |
| Travel → Social | Name + temporal | Tier 3 | Low | Travel behavior inference |

**Highest-value fusion paths**:
1. **Financial → AdsB/Ais**: Sanctioned entity tracking (OFAC aircraft/vessel → live tracks)
2. **Financial → Travel**: Watchlist passenger screening (SDN name/passport → PNR)
3. **Social → Cyber**: Threat actor infrastructure mapping (posted URLs → IOC domains)
4. **Osint → Financial → AdsB**: Chain: news mention → sanctions match → live track

---

## AVA.DS.4.7 JetStream Configuration

All OSINT/Social/Financial/Travel signals are captured by the `SENSOR_OSINT` JetStream
stream (as defined in AVA.3.7):

| Stream Name | Subjects | Retention | Max Age | Storage |
|-------------|----------|-----------|---------|---------|
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | File |

**Consumer groups**:

| Consumer | Filter Subject | Deliver Policy | Ack Policy |
|----------|---------------|----------------|------------|
| `osint-normalizer` | `sensor.osint.*.raw` | All | Explicit |
| `social-normalizer` | `sensor.social.*.raw` | All | Explicit |
| `financial-loader` | `sensor.financial.*.json` | All | Explicit |
| `travel-screener` | `sensor.travel.*.json` | All | Explicit |
| `identity-resolver` | `sensor.social.*.json`, `sensor.osint.*.json` | All | Explicit |

**KV materialization** (Financial reference data):

| KV Bucket | Key Pattern | Source | TTL |
|-----------|-------------|--------|-----|
| `ava-state` | `entity.ofac.{uid}` | OFAC SDN | 7d |
| `ava-state` | `entity.sanctions.{id}` | OpenSanctions | 24h |
| `ava-state` | `entity.lei.{lei_code}` | GLEIF | 7d |
| `ava-state` | `entity.edgar.{cik}` | SEC EDGAR | 7d |

---

## AVA.DS.4.8 References

- [GDELT Project] https://www.gdeltproject.org/data.html — Event database and GKG
- [Wayback CDX API] https://archive.org/developers/wayback-cdx-server.html — CDX server BETA
- [Common Crawl] https://commoncrawl.org/get-started — S3 data access
- [Mastodon API] https://docs.joinmastodon.org/methods/timelines/ — Public timeline
- [Mastodon Rate Limits] https://docs.joinmastodon.org/api/rate-limits/ — 300 req/5min
- [Bluesky Firehose] https://docs.bsky.app/docs/advanced-guides/firehose — AT Protocol stream
- [Reddit Data API] https://support.reddithelp.com/hc/en-us/articles/16160319875092 — API wiki
- [GitHub Events API] https://docs.github.com/en/rest/activity/events — Public events
- [Pushshift Archive] https://archive.org/details/reddit-data-comments — Reddit 2005-2022
- [OFAC SDN] https://ofac.treasury.gov/sanctions-list-service — Sanctions List Service
- [OpenSanctions] https://www.opensanctions.org/docs/bulk/ — Bulk data documentation
- [GLEIF API] https://www.gleif.org/en/lei-data/gleif-api — Free LEI lookup
- [SEC EDGAR API] https://www.sec.gov/search-filings/edgar-application-programming-interfaces — EDGAR APIs
- [OpenCorporates API] https://api.opencorporates.com/documentation/API-Reference — v0.4.8
- [OpenFlights] https://openflights.org/data — Airport, airline, and route data
- [RFC2119] Bradner, S., "Key words for use in RFCs", BCP 14, RFC 2119, March 1997
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119", BCP 14, RFC 8174, May 2017
- [ava-fusion SignalKind] `ava-fusion/src/signal.rs` — Osint, Social, Financial, Travel variants
- [ava-fusion EntityClass] `ava-fusion/src/entity.rs` — Person, Organization, Campaign
- [NATS Subject Taxonomy] `docs/specifications/rfc/rfc-section-nats-subject-taxonomy.md` — AVA.3

---

*End of Section AVA.DS.4*
