# Raw Research: STIX 2.1 Complete Object Catalog

```
Document:    STIX 2.1 Object Catalog — Raw Research
Purpose:     Foundation for RFC-002 Section TSG.12 (STIX Data Model)
Author:      Val (stix-specialist)
Created:     2026-02-18
Source:      OASIS STIX 2.1 Specification (stix-v2.1-os)
             https://docs.oasis-open.org/cti/stix/v2.1/os/stix-v2.1-os.html
```

> This document catalogs every object type defined in STIX 2.1 with complete
> property tables, Tsingou relevance assessments, and example JSON instances.
> It serves as the raw research base for the normative RFC section TSG.12.

---

## Table of Contents

1. [STIX 2.1 Architecture](#1-stix-21-architecture)
2. [STIX Common Properties](#2-stix-common-properties)
3. [STIX Domain Objects (SDOs)](#3-stix-domain-objects-sdos)
4. [STIX Relationship Objects (SROs)](#4-stix-relationship-objects-sros)
5. [STIX Cyber-observable Objects (SCOs)](#5-stix-cyber-observable-objects-scos)
6. [STIX Meta Objects](#6-stix-meta-objects)
7. [STIX Patterning Language](#7-stix-patterning-language)
8. [Tsingou Relevance Summary](#8-tsingou-relevance-summary)

---

## 1. STIX 2.1 Architecture

### 1.1 Overview

Structured Threat Information eXpression (STIX) is a language and serialization format for cyber threat intelligence (CTI). STIX 2.1 is the current OASIS standard, published as Committee Specification 02 and adopted as an OASIS Standard.

STIX defines four categories of objects:

| Category | Count | Purpose |
|----------|-------|---------|
| STIX Domain Objects (SDOs) | 18 | High-level intelligence constructs |
| STIX Relationship Objects (SROs) | 2 | Links between objects |
| STIX Cyber-observable Objects (SCOs) | 18 | Observable facts (network, host) |
| STIX Meta Objects | 4 | Structural and administrative |

**Total: 42 object types**

### 1.2 Object Model Hierarchy

```
STIX Bundle
├── SDOs (Domain Objects)
│   ├── attack-pattern       Adversary TTPs
│   ├── campaign             Coordinated activities
│   ├── course-of-action     Remediation steps
│   ├── grouping             Logical collections
│   ├── identity             Actors, organizations
│   ├── indicator            Detection patterns
│   ├── infrastructure       Adversary infra
│   ├── intrusion-set        Named threat groups
│   ├── location             Geographic context
│   ├── malware              Malicious software
│   ├── malware-analysis     Analysis results
│   ├── note                 Analyst annotations
│   ├── observed-data        Observable containers
│   ├── opinion              Analyst assessments
│   ├── report               Collections with context
│   ├── threat-actor          Individuals/groups
│   ├── tool                 Software tools
│   └── vulnerability        CVEs, weaknesses
│
├── SROs (Relationship Objects)
│   ├── relationship         Typed links between objects
│   └── sighting             Observations of intelligence
│
├── SCOs (Cyber-observable Objects)
│   ├── artifact             Raw binary/encoded content
│   ├── autonomous-system    ASN
│   ├── directory            Filesystem directory
│   ├── domain-name          DNS domain
│   ├── email-addr           Email address
│   ├── email-message        Full email
│   ├── file                 Files with hashes
│   ├── ipv4-addr            IPv4 address
│   ├── ipv6-addr            IPv6 address
│   ├── mac-addr             MAC address
│   ├── mutex                Named mutex
│   ├── network-traffic      Network connections
│   ├── process              Running process
│   ├── software             Software identity
│   ├── url                  URL
│   ├── user-account         User account
│   ├── windows-registry-key Registry key/value
│   └── x509-certificate     X.509 certificate
│
└── Meta Objects
    ├── bundle               Container for STIX objects
    ├── marking-definition   TLP, statements
    ├── language-content      Translations
    └── extension-definition  Custom type registration
```

### 1.3 Object Identification

All STIX objects carry a unique identifier in the format:

```
<type>--<UUID>
```

Examples:
- `indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f`
- `observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf`

**UUID Generation Methods:**

| Method | When Used | Algorithm |
|--------|-----------|-----------|
| UUID v4 (random) | Default for most objects | Cryptographically random |
| UUID v5 (deterministic) | When reproducibility needed | SHA-1 hash of namespace + name |

For Tsingou, UUID v5 is preferred for the BaseSignal→STIX mapping to ensure the same signal always produces the same STIX identifier, enabling deduplication and round-trip fidelity.

**Tsingou UUID v5 Namespace:** `d9ee4c69-3e9b-4f53-8cdb-7c8e13d6c2a7` (custom namespace for Tsingou signal IDs)

### 1.4 Versioning Model

STIX objects are versioned via `created` and `modified` timestamps:

| Property | Type | Semantics |
|----------|------|-----------|
| `created` | timestamp | When the object was first created (immutable) |
| `modified` | timestamp | When this version was created |

- First version: `created === modified`
- Subsequent versions: `modified > created`, same `id`
- Consumers SHOULD use the latest `modified` version

**Mapping to Tsingou:** BaseSignal uses d2ts `[tick, source_seq]` versioning which is fundamentally different (multi-dimensional partial ordering vs. wall-clock timestamps). The STIX `created`/`modified` pair maps to `BaseSignal.timestamp` for the initial creation, with d2ts version preserved in a custom extension property `x_tsingou_version`.

### 1.5 Confidence Scale

STIX 2.1 defines a 0-100 integer confidence scale:

| Range | Meaning | Tsingou Usage |
|-------|---------|---------------|
| 0 | No confidence | Never used |
| 1-29 | Low confidence | Unverified OSINT signals |
| 30-69 | Medium confidence | Correlated signals |
| 70-99 | High confidence | Validated indicators |
| 100 | Certain | Human-verified intelligence |

### 1.6 Data Markings

STIX supports two marking types:

**Object Markings** — Applied to entire objects via `object_marking_refs`:

| Marking | TLP Color | Sharing Restriction |
|---------|-----------|---------------------|
| `marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9` | TLP:WHITE | Unlimited |
| `marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da` | TLP:GREEN | Community |
| `marking-definition--f88d31f6-486f-44da-b317-01333bde0b82` | TLP:AMBER | Organization + need-to-know |
| `marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed` | TLP:RED | Named recipients only |

**Granular Markings** — Applied to specific properties via `granular_markings`:

```json
{
  "granular_markings": [
    {
      "marking_ref": "marking-definition--f88d31f6-486f-44da-b317-01333bde0b82",
      "selectors": ["description", "pattern"]
    }
  ]
}
```

---

## 2. STIX Common Properties

Every STIX Domain Object (SDO) and Relationship Object (SRO) carries these common properties. SCOs carry a subset.

### 2.1 SDO/SRO Common Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Object type identifier (e.g., "indicator") |
| `spec_version` | `string` | **Yes** | STIX spec version, always "2.1" |
| `id` | `identifier` | **Yes** | Unique identifier: `<type>--<UUID>` |
| `created_by_ref` | `identifier` | No | Reference to identity SDO of creator |
| `created` | `timestamp` | **Yes** | When first created (immutable) |
| `modified` | `timestamp` | **Yes** | When this version was last modified |
| `revoked` | `boolean` | No | If true, object is no longer valid |
| `labels` | `list of string` | No | Descriptive labels/tags |
| `confidence` | `integer (0-100)` | No | Producer's confidence in correctness |
| `lang` | `string` | No | Language of text content (RFC 5646) |
| `external_references` | `list of external-reference` | No | References to external sources |
| `object_marking_refs` | `list of identifier` | No | Marking definitions applied |
| `granular_markings` | `list of granular-marking` | No | Property-level markings |
| `extensions` | `dictionary` | No | Extension data keyed by extension ID |

### 2.2 SCO Common Properties

SCOs carry a reduced set of common properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Object type identifier |
| `spec_version` | `string` | No | Defaults to "2.1" |
| `id` | `identifier` | **Yes** | Unique identifier |
| `object_marking_refs` | `list of identifier` | No | Marking definitions |
| `granular_markings` | `list of granular-marking` | No | Property-level markings |
| `defanged` | `boolean` | No | If true, value has been defanged |
| `extensions` | `dictionary` | No | Extension data |

**Key difference:** SCOs do NOT have `created`, `modified`, `created_by_ref`, `revoked`, `labels`, or `confidence` properties. They represent observed facts, not intelligence assessments.

### 2.3 External Reference Type

```json
{
  "source_name": "cve",
  "external_id": "CVE-2024-1234",
  "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-1234",
  "description": "Buffer overflow in component X"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `source_name` | `string` | **Yes** | Name of the external source |
| `description` | `string` | No | Description of the reference |
| `url` | `string (URL)` | No | URL to the external resource |
| `hashes` | `hashes-type` | No | Hashes of the external content |
| `external_id` | `string` | No | Identifier in the external system |

---

## 3. STIX Domain Objects (SDOs)

### 3.1 attack-pattern

**Type:** `attack-pattern`
**Description:** A type of TTP that describes ways threat actors attempt to compromise targets. Often references MITRE ATT&CK techniques.

**Tsingou Relevance:** LOW — Tsingou does not generate attack patterns but may import them from CTI feeds for correlation with observed signals.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the attack pattern |
| `description` | `string` | No | Detailed description |
| `aliases` | `list of string` | No | Alternative names |
| `kill_chain_phases` | `list of kill-chain-phase` | No | Kill chain phases (e.g., MITRE ATT&CK) |

**Example:**

```json
{
  "type": "attack-pattern",
  "spec_version": "2.1",
  "id": "attack-pattern--7e33a43e-e34b-40ec-89da-36c9bb2cacd5",
  "created": "2026-01-15T12:00:00.000Z",
  "modified": "2026-01-15T12:00:00.000Z",
  "name": "Spear Phishing via RSS Feed Poisoning",
  "description": "Adversary injects malicious links into RSS feeds monitored by target organizations.",
  "kill_chain_phases": [
    {
      "kill_chain_name": "mitre-attack",
      "phase_name": "initial-access"
    }
  ],
  "external_references": [
    {
      "source_name": "mitre-attack",
      "external_id": "T1566.002",
      "url": "https://attack.mitre.org/techniques/T1566/002/"
    }
  ]
}
```

---

### 3.2 campaign

**Type:** `campaign`
**Description:** A grouping of adversarial behaviors that describes a set of malicious activities or attacks occurring over a period of time against a specific set of targets.

**Tsingou Relevance:** LOW — Campaigns are imported intelligence; Tsingou may correlate observed signals to known campaigns.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the campaign |
| `description` | `string` | No | Detailed description |
| `aliases` | `list of string` | No | Alternative names |
| `first_seen` | `timestamp` | No | When first observed |
| `last_seen` | `timestamp` | No | When last observed |
| `objective` | `string` | No | Campaign's primary objective |

**Example:**

```json
{
  "type": "campaign",
  "spec_version": "2.1",
  "id": "campaign--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-02-01T08:00:00.000Z",
  "modified": "2026-02-01T08:00:00.000Z",
  "name": "Operation Dark Spectrum",
  "description": "Coordinated SDR-based surveillance campaign targeting maritime communications.",
  "first_seen": "2025-11-01T00:00:00.000Z",
  "last_seen": "2026-01-31T23:59:59.000Z",
  "objective": "Intercept maritime VHF communications in contested waters"
}
```

---

### 3.3 course-of-action

**Type:** `course-of-action`
**Description:** A recommendation for how to respond to or prevent an attack pattern or vulnerability.

**Tsingou Relevance:** LOW — May be imported from CTI feeds; Tsingou does not generate courses of action.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the course of action |
| `description` | `string` | No | Detailed description |
| `action` | `open-vocab` | No | Type of action (reserved for future use) |

**Example:**

```json
{
  "type": "course-of-action",
  "spec_version": "2.1",
  "id": "course-of-action--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-01-20T10:00:00.000Z",
  "modified": "2026-01-20T10:00:00.000Z",
  "name": "Block RSS Feed IP Range",
  "description": "Block the IP range 198.51.100.0/24 associated with poisoned RSS feeds."
}
```

---

### 3.4 grouping

**Type:** `grouping`
**Description:** Explicitly asserts that referenced STIX objects have a shared context, without the narrative structure of a report.

**Tsingou Relevance:** HIGH — d2ts analysis sessions naturally map to grouping objects. When an analyst groups related signals for investigation, the export is a STIX grouping.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name of the grouping |
| `description` | `string` | No | Description of shared context |
| `context` | `open-vocab` | **Yes** | Context of the grouping |
| `object_refs` | `list of identifier` | **Yes** | References to grouped objects |

**Context vocabulary:**

| Value | Description |
|-------|-------------|
| `suspicious-activity` | Objects related to suspected malicious activity |
| `malware-analysis` | Objects related to malware analysis |
| `unspecified` | No specific context |

**Example:**

```json
{
  "type": "grouping",
  "spec_version": "2.1",
  "id": "grouping--84e4d88f-44ea-4bcd-bbf3-b2c1c320bcbd",
  "created": "2026-02-18T14:30:00.000Z",
  "modified": "2026-02-18T14:30:00.000Z",
  "name": "Maritime SIGINT Session 2026-02-18",
  "description": "Correlated signals from SDR monitoring of VHF maritime band.",
  "context": "suspicious-activity",
  "object_refs": [
    "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
    "observed-data--c78e41aa-13bd-509b-a30a-43f956f559dg",
    "indicator--9f3f3e3c-28e5-5dce-a49g-a9ff57c4de4g"
  ]
}
```

---

### 3.5 identity

**Type:** `identity`
**Description:** Represents individuals, organizations, or groups, as well as classes of individuals, organizations, groups, or systems.

**Tsingou Relevance:** HIGH — Every BaseSignal export requires an identity SDO to identify the Tsingou system or specific source adapter as the creator. Identity objects are also imported from CTI feeds.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the identity |
| `description` | `string` | No | Detailed description |
| `roles` | `list of string` | No | Roles played |
| `identity_class` | `open-vocab` | No | Type: individual, group, system, organization, class, unknown |
| `sectors` | `list of open-vocab` | No | Industry sectors |
| `contact_information` | `string` | No | Contact details |

**Identity class vocabulary:**

| Value | Description | Tsingou Usage |
|-------|-------------|---------------|
| `individual` | A single person | Analyst identity |
| `group` | Informal group | Team identity |
| `system` | Automated system | **Tsingou system, source adapters** |
| `organization` | Formal organization | Organization identity |
| `class` | Class of entities | Adapter class |
| `unknown` | Unknown type | Imported identities |

**Example (Tsingou system identity):**

```json
{
  "type": "identity",
  "spec_version": "2.1",
  "id": "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "name": "Tsingou Signal Intelligence Platform",
  "description": "Automated signal collection and analysis platform.",
  "identity_class": "system",
  "sectors": ["technology"],
  "contact_information": "https://tsingou.dev"
}
```

**Example (source adapter identity):**

```json
{
  "type": "identity",
  "spec_version": "2.1",
  "id": "identity--a7b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created": "2026-02-18T00:00:00.000Z",
  "modified": "2026-02-18T00:00:00.000Z",
  "name": "Tsingou HTTP Adapter: threat-feeds",
  "description": "HTTP polling adapter monitoring threat intelligence RSS and API feeds.",
  "identity_class": "system"
}
```

---

### 3.6 indicator

**Type:** `indicator`
**Description:** Contains a pattern that can be used to detect suspicious or malicious cyber activity. The most operationally important SDO for detection systems.

**Tsingou Relevance:** **CRITICAL** — d2ts anomaly detection rules export as STIX indicators. The STIX pattern language encodes the detection logic. Indicators are also imported from CTI feeds for matching against observed signals.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name of the indicator |
| `description` | `string` | No | Detailed description |
| `indicator_types` | `list of open-vocab` | No | Type classification |
| `pattern` | `string` | **Yes** | STIX pattern expression |
| `pattern_type` | `string` | **Yes** | Pattern language: "stix", "snort", "yara", etc. |
| `pattern_version` | `string` | No | Version of pattern language |
| `valid_from` | `timestamp` | **Yes** | Start of validity period |
| `valid_until` | `timestamp` | No | End of validity period |
| `kill_chain_phases` | `list of kill-chain-phase` | No | Kill chain phases |

**Indicator type vocabulary:**

| Value | Description |
|-------|-------------|
| `anomalous-activity` | Anomalous but not necessarily malicious |
| `anonymization` | Use of anonymization tools |
| `benign` | Known benign activity (for whitelisting) |
| `compromised` | Compromised asset indicators |
| `malicious-activity` | Known malicious activity |
| `attribution` | Attribution indicators |
| `unknown` | Classification unknown |

**Example (d2ts anomaly exported as indicator):**

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-02-18T15:00:00.000Z",
  "modified": "2026-02-18T15:00:00.000Z",
  "created_by_ref": "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff",
  "name": "Suspicious HTTP beacon pattern",
  "description": "d2ts anomaly detection: periodic HTTP requests to C2-like endpoint at 60s intervals.",
  "indicator_types": ["anomalous-activity"],
  "pattern": "[network-traffic:dst_ref.type = 'ipv4-addr' AND network-traffic:dst_ref.value = '198.51.100.42' AND network-traffic:dst_port = 443]",
  "pattern_type": "stix",
  "valid_from": "2026-02-18T14:00:00.000Z",
  "valid_until": "2026-02-25T14:00:00.000Z",
  "confidence": 75
}
```

---

### 3.7 infrastructure

**Type:** `infrastructure`
**Description:** Represents a type of TTP describing systems, software, and services used by adversaries to support their operations.

**Tsingou Relevance:** LOW — Imported from CTI feeds; may be correlated with infrastructure observed in HTTP/WebSocket signals.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the infrastructure |
| `description` | `string` | No | Detailed description |
| `infrastructure_types` | `list of open-vocab` | No | Type classification |
| `aliases` | `list of string` | No | Alternative names |
| `kill_chain_phases` | `list of kill-chain-phase` | No | Kill chain phases |
| `first_seen` | `timestamp` | No | When first observed |
| `last_seen` | `timestamp` | No | When last observed |

**Example:**

```json
{
  "type": "infrastructure",
  "spec_version": "2.1",
  "id": "infrastructure--38c47d93-d984-4fd9-b87b-d69d0841628d",
  "created": "2026-01-10T00:00:00.000Z",
  "modified": "2026-01-10T00:00:00.000Z",
  "name": "Fast-flux C2 network",
  "description": "Fast-flux DNS infrastructure used for command and control.",
  "infrastructure_types": ["command-and-control"]
}
```

---

### 3.8 intrusion-set

**Type:** `intrusion-set`
**Description:** A grouped set of adversarial behaviors and resources with common properties that is believed to be orchestrated by a single organization.

**Tsingou Relevance:** LOW — Imported from CTI feeds for attribution context.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the intrusion set |
| `description` | `string` | No | Detailed description |
| `aliases` | `list of string` | No | Alternative names |
| `first_seen` | `timestamp` | No | When first observed |
| `last_seen` | `timestamp` | No | When last observed |
| `goals` | `list of string` | No | Objectives of the intrusion set |
| `resource_level` | `open-vocab` | No | Resource level: individual, club, contest, team, organization, government |
| `primary_motivation` | `open-vocab` | No | Primary motivation |
| `secondary_motivations` | `list of open-vocab` | No | Secondary motivations |

**Example:**

```json
{
  "type": "intrusion-set",
  "spec_version": "2.1",
  "id": "intrusion-set--4e78f46f-a023-4e5f-bc24-71b3ca22ec29",
  "created": "2026-01-05T00:00:00.000Z",
  "modified": "2026-01-05T00:00:00.000Z",
  "name": "SPECTRAL BEAR",
  "description": "State-sponsored group targeting maritime communications infrastructure.",
  "aliases": ["SpectralBear", "TEMP.Maritime"],
  "first_seen": "2024-06-01T00:00:00.000Z",
  "goals": ["Signals intelligence collection", "Maritime domain awareness"],
  "resource_level": "government",
  "primary_motivation": "organizational-gain"
}
```

---

### 3.9 location

**Type:** `location`
**Description:** Represents a geographic location, potentially as precise as a set of coordinates or as broad as a country.

**Tsingou Relevance:** MEDIUM — Relevant for geolocation of signal sources, especially SDR captures and IP geolocation of HTTP/WebSocket connections. May be generated from signal metadata.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name of the location |
| `description` | `string` | No | Detailed description |
| `latitude` | `float` | No | WGS 84 latitude (-90 to 90) |
| `longitude` | `float` | No | WGS 84 longitude (-180 to 180) |
| `precision` | `float` | No | Precision in meters |
| `region` | `open-vocab` | No | UN M.49 region code |
| `country` | `string` | No | ISO 3166-1 ALPHA-2 country code |
| `administrative_area` | `string` | No | State, province, etc. |
| `city` | `string` | No | City name |
| `street_address` | `string` | No | Street address |
| `postal_code` | `string` | No | Postal code |

**Note:** At least one of `region`, `country`, `latitude`+`longitude` MUST be present.

**Example:**

```json
{
  "type": "location",
  "spec_version": "2.1",
  "id": "location--a6e9345f-5a15-4c29-8bb3-7dcc5d168d64",
  "created": "2026-02-18T16:00:00.000Z",
  "modified": "2026-02-18T16:00:00.000Z",
  "name": "SDR Capture Site Alpha",
  "description": "Ground station monitoring maritime VHF band.",
  "latitude": 51.5074,
  "longitude": -0.1278,
  "precision": 100.0,
  "country": "GB",
  "city": "London"
}
```

---

### 3.10 malware

**Type:** `malware`
**Description:** A type of TTP representing software designed to compromise the confidentiality, integrity, or availability of a system.

**Tsingou Relevance:** LOW — Imported from CTI feeds; may be correlated with file-watch signals containing malware samples.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name of the malware |
| `description` | `string` | No | Detailed description |
| `malware_types` | `list of open-vocab` | No | Type classification |
| `is_family` | `boolean` | **Yes** | True if this represents a malware family |
| `aliases` | `list of string` | No | Alternative names |
| `kill_chain_phases` | `list of kill-chain-phase` | No | Kill chain phases |
| `first_seen` | `timestamp` | No | When first observed |
| `last_seen` | `timestamp` | No | When last observed |
| `operating_system_refs` | `list of identifier` | No | Target OS (software SCO refs) |
| `architecture_execution_envs` | `list of open-vocab` | No | Target architectures |
| `implementation_languages` | `list of open-vocab` | No | Programming languages |
| `capabilities` | `list of open-vocab` | No | Malware capabilities |
| `sample_refs` | `list of identifier` | No | References to file/artifact SCOs |

**Example:**

```json
{
  "type": "malware",
  "spec_version": "2.1",
  "id": "malware--fdd60b30-b67c-41e3-b0b9-f01faf20d111",
  "created": "2026-01-20T00:00:00.000Z",
  "modified": "2026-01-20T00:00:00.000Z",
  "name": "SpectrumStealer",
  "description": "RAT targeting SDR software to exfiltrate captured IQ data.",
  "malware_types": ["remote-access-trojan", "spyware"],
  "is_family": false,
  "capabilities": ["exfiltrates-data", "communicates-with-c2"]
}
```

---

### 3.11 malware-analysis

**Type:** `malware-analysis`
**Description:** Captures the metadata and results of a particular static or dynamic analysis performed on a malware instance or family.

**Tsingou Relevance:** LOW — May be imported from Cortex analyzer results or CTI feeds.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `product` | `string` | **Yes** | Analysis tool name |
| `version` | `string` | No | Analysis tool version |
| `host_vm_ref` | `identifier` | No | Reference to software SCO (analysis VM) |
| `operating_system_ref` | `identifier` | No | Reference to software SCO (OS) |
| `installed_software_refs` | `list of identifier` | No | Installed software |
| `configuration_version` | `string` | No | Config version used |
| `modules` | `list of string` | No | Analysis modules used |
| `analysis_engine_version` | `string` | No | Engine version |
| `analysis_definition_version` | `string` | No | Signature/definition version |
| `submitted` | `timestamp` | No | When submitted for analysis |
| `analysis_started` | `timestamp` | No | When analysis started |
| `analysis_ended` | `timestamp` | No | When analysis ended |
| `result_name` | `string` | No | Classification result |
| `result` | `open-vocab` | No | Result: malicious, suspicious, benign, unknown |
| `analysis_sco_refs` | `list of identifier` | No | SCOs analyzed |
| `sample_ref` | `identifier` | No | Malware sample reference |

**Example:**

```json
{
  "type": "malware-analysis",
  "spec_version": "2.1",
  "id": "malware-analysis--d4ec5e37-2019-421f-b65f-c3b3dc93a44a",
  "created": "2026-02-18T17:00:00.000Z",
  "modified": "2026-02-18T17:00:00.000Z",
  "product": "Cortex-VirusTotal_GetReport",
  "result": "malicious",
  "result_name": "Trojan.GenericKD.46537890",
  "analysis_started": "2026-02-18T16:55:00.000Z",
  "analysis_ended": "2026-02-18T16:57:30.000Z",
  "sample_ref": "file--8a7b56c3-d40e-5abc-9123-456789abcdef"
}
```

---

### 3.12 note

**Type:** `note`
**Description:** Conveys informative text to provide further context to STIX objects. Used for analyst annotations.

**Tsingou Relevance:** MEDIUM — Analyst annotations on signal groups or indicators can be exported as STIX notes. MISP analyst notes also import as STIX notes.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `abstract` | `string` | No | Brief summary |
| `content` | `string` | **Yes** | Note content |
| `authors` | `list of string` | No | Author names |
| `object_refs` | `list of identifier` | **Yes** | Objects this note applies to |

**Example:**

```json
{
  "type": "note",
  "spec_version": "2.1",
  "id": "note--4395dca3-e37b-4b09-b02d-b3a28a782d0a",
  "created": "2026-02-18T18:00:00.000Z",
  "modified": "2026-02-18T18:00:00.000Z",
  "abstract": "Possible false positive",
  "content": "The HTTP beacon pattern matches a legitimate monitoring service. Confidence downgraded from 75 to 30 pending verification.",
  "authors": ["Analyst J. Smith"],
  "object_refs": [
    "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f"
  ]
}
```

---

### 3.13 observed-data

**Type:** `observed-data`
**Description:** Conveys information about cyber security relevant entities or events that were observed. This is the **primary export target** for Tsingou signals.

**Tsingou Relevance:** **CRITICAL** — Every BaseSignal exports as an observed-data SDO containing referenced SCOs. This is the core of the STIX interop layer.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `first_observed` | `timestamp` | **Yes** | When first observed |
| `last_observed` | `timestamp` | **Yes** | When last observed |
| `number_observed` | `integer (1+)` | **Yes** | Number of times observed |
| `object_refs` | `list of identifier` | **Yes** | References to SCOs in the bundle |
| `objects` | `observable-objects` | **DEPRECATED** | Legacy embedded objects (do not use) |

**Key semantics:**
- `first_observed` and `last_observed` map to `BaseSignal.timestamp`
- For a single signal: `first_observed === last_observed`, `number_observed === 1`
- For aggregated signals: `first_observed = min(timestamps)`, `last_observed = max(timestamps)`, `number_observed = count`
- `object_refs` references SCO objects that MUST exist in the same bundle
- The deprecated `objects` property MUST NOT be used in new content

**Example (single HTTP signal):**

```json
{
  "type": "observed-data",
  "spec_version": "2.1",
  "id": "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
  "created": "2026-02-18T15:30:00.000Z",
  "modified": "2026-02-18T15:30:00.000Z",
  "created_by_ref": "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff",
  "first_observed": "2026-02-18T15:29:45.123Z",
  "last_observed": "2026-02-18T15:29:45.123Z",
  "number_observed": 1,
  "object_refs": [
    "network-traffic--532e7a9b-2e39-4f97-8140-7fa879210eb1",
    "url--947c9d59-d3f2-4e2a-8c43-6d5ed9f3e5a2",
    "domain-name--3c10e93f-798e-5d2a-9087-7c5f5bfcab73"
  ],
  "extensions": {
    "extension-definition--d9ee4c69-3e9b-4f53-8cdb-7c8e13d6c2a7": {
      "x_tsingou_signal_id": "sig_abc123def456",
      "x_tsingou_source_id": "http-adapter-threatfeeds",
      "x_tsingou_version": [42, 7],
      "x_tsingou_kind": "http"
    }
  }
}
```

---

### 3.14 opinion

**Type:** `opinion`
**Description:** An assessment of the correctness of information in a STIX object produced by a different entity. Allows analysts to agree or disagree with intelligence.

**Tsingou Relevance:** MEDIUM — Analyst feedback on imported intelligence or generated indicators can be exported as opinions. MISP analyst opinions map to this SDO.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `explanation` | `string` | No | Explanation of the opinion |
| `authors` | `list of string` | No | Author names |
| `opinion` | `enum` | **Yes** | Assessment value |
| `object_refs` | `list of identifier` | **Yes** | Objects being assessed |

**Opinion vocabulary:**

| Value | Meaning |
|-------|---------|
| `strongly-disagree` | Strongly disagrees with content |
| `disagree` | Disagrees with content |
| `neutral` | Neither agrees nor disagrees |
| `agree` | Agrees with content |
| `strongly-agree` | Strongly agrees with content |

**Example:**

```json
{
  "type": "opinion",
  "spec_version": "2.1",
  "id": "opinion--b01efc25-77b4-4e25-b7e6-027bb29ba9eb",
  "created": "2026-02-18T19:00:00.000Z",
  "modified": "2026-02-18T19:00:00.000Z",
  "explanation": "Pattern confirmed via independent SDR capture at different location.",
  "authors": ["Analyst K. Lee"],
  "opinion": "strongly-agree",
  "object_refs": [
    "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f"
  ]
}
```

---

### 3.15 report

**Type:** `report`
**Description:** A collection of threat intelligence focused on one or more topics, with narrative context. Reports bundle objects together with a human-readable summary.

**Tsingou Relevance:** HIGH — Curated signal collections with analyst commentary export as STIX reports. Analysis session outputs map naturally to this SDO.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Report title |
| `description` | `string` | No | Report body text |
| `report_types` | `list of open-vocab` | No | Type classification |
| `published` | `timestamp` | **Yes** | When published |
| `object_refs` | `list of identifier` | **Yes** | Objects discussed in the report |

**Report type vocabulary:**

| Value | Description |
|-------|-------------|
| `threat-report` | Threat intelligence report |
| `attack-pattern` | Report on attack patterns |
| `campaign` | Campaign analysis |
| `identity` | Identity intelligence |
| `indicator` | Indicator compilation |
| `intrusion-set` | Intrusion set profile |
| `malware` | Malware analysis |
| `observed-data` | **Observation report — primary for Tsingou** |
| `threat-actor` | Threat actor profile |
| `tool` | Tool analysis |
| `vulnerability` | Vulnerability analysis |

**Example:**

```json
{
  "type": "report",
  "spec_version": "2.1",
  "id": "report--84e4d88f-44ea-4bcd-bbf3-b2c1c320bcbd",
  "created": "2026-02-18T20:00:00.000Z",
  "modified": "2026-02-18T20:00:00.000Z",
  "created_by_ref": "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff",
  "name": "Maritime VHF Anomaly Report — February 2026",
  "description": "Analysis of anomalous signals detected in the maritime VHF band (156-174 MHz) during February 2026 monitoring session.",
  "report_types": ["observed-data"],
  "published": "2026-02-18T20:00:00.000Z",
  "object_refs": [
    "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
    "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
    "grouping--84e4d88f-44ea-4bcd-bbf3-b2c1c320bcbd"
  ]
}
```

---

### 3.16 threat-actor

**Type:** `threat-actor`
**Description:** Represents individuals, groups, or organizations believed to operate with malicious intent.

**Tsingou Relevance:** LOW — Imported from CTI feeds for attribution; not generated by Tsingou.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the threat actor |
| `description` | `string` | No | Detailed description |
| `threat_actor_types` | `list of open-vocab` | No | Type classification |
| `aliases` | `list of string` | No | Alternative names |
| `first_seen` | `timestamp` | No | When first observed |
| `last_seen` | `timestamp` | No | When last observed |
| `roles` | `list of open-vocab` | No | Roles: director, sponsor, agent, etc. |
| `goals` | `list of string` | No | Objectives |
| `sophistication` | `open-vocab` | No | Capability level |
| `resource_level` | `open-vocab` | No | Resources available |
| `primary_motivation` | `open-vocab` | No | Primary motivation |
| `secondary_motivations` | `list of open-vocab` | No | Other motivations |
| `personal_motivations` | `list of open-vocab` | No | Personal motivations |

**Example:**

```json
{
  "type": "threat-actor",
  "spec_version": "2.1",
  "id": "threat-actor--56f3f0db-b5d5-431c-ae56-c18f02caf500",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-15T00:00:00.000Z",
  "name": "Spectral Bear",
  "description": "State-sponsored threat actor targeting maritime communications.",
  "threat_actor_types": ["nation-state"],
  "sophistication": "expert",
  "resource_level": "government",
  "primary_motivation": "organizational-gain",
  "goals": ["SIGINT collection", "Maritime domain awareness"]
}
```

---

### 3.17 tool

**Type:** `tool`
**Description:** Legitimate software that can be used by threat actors to perform attacks. Distinguished from malware by legitimacy of the software itself.

**Tsingou Relevance:** LOW — Imported from CTI feeds; may correlate with tools observed in signal payloads.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the tool |
| `description` | `string` | No | Detailed description |
| `tool_types` | `list of open-vocab` | No | Type classification |
| `aliases` | `list of string` | No | Alternative names |
| `kill_chain_phases` | `list of kill-chain-phase` | No | Kill chain phases |
| `tool_version` | `string` | No | Tool version |

**Example:**

```json
{
  "type": "tool",
  "spec_version": "2.1",
  "id": "tool--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-01-10T00:00:00.000Z",
  "modified": "2026-01-10T00:00:00.000Z",
  "name": "GNU Radio",
  "description": "Open-source SDR toolkit used for signal analysis.",
  "tool_types": ["information-gathering"],
  "tool_version": "3.10"
}
```

---

### 3.18 vulnerability

**Type:** `vulnerability`
**Description:** A flaw in software that can be exploited. Typically references CVE identifiers.

**Tsingou Relevance:** LOW — Imported from CTI feeds; may be used to enrich signal context.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Name of the vulnerability |
| `description` | `string` | No | Detailed description |

**Example:**

```json
{
  "type": "vulnerability",
  "spec_version": "2.1",
  "id": "vulnerability--ee916c28-c7a4-4d0d-ad56-a8d357f64333",
  "created": "2026-01-05T00:00:00.000Z",
  "modified": "2026-01-05T00:00:00.000Z",
  "name": "CVE-2025-12345",
  "description": "Buffer overflow in SDR driver allowing arbitrary code execution.",
  "external_references": [
    {
      "source_name": "cve",
      "external_id": "CVE-2025-12345",
      "url": "https://nvd.nist.gov/vuln/detail/CVE-2025-12345"
    }
  ]
}
```

---

## 4. STIX Relationship Objects (SROs)

### 4.1 relationship

**Type:** `relationship`
**Description:** Links two STIX objects with a named relationship type. The most general-purpose connection mechanism in STIX.

**Tsingou Relevance:** HIGH — d2ts correlations (join results) export as relationships between observed-data objects or between indicators and observed-data.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `relationship_type` | `string` | **Yes** | Type of relationship |
| `description` | `string` | No | Detailed description |
| `source_ref` | `identifier` | **Yes** | Source object |
| `target_ref` | `identifier` | **Yes** | Target object |
| `start_time` | `timestamp` | No | When relationship started |
| `stop_time` | `timestamp` | No | When relationship ended |

**Relationship Type Vocabulary (complete list):**

| Relationship Type | Source → Target | Description |
|-------------------|-----------------|-------------|
| `attributed-to` | campaign/intrusion-set/threat-actor → identity/threat-actor | Attribution |
| `based-on` | indicator → observed-data | Indicator derived from observation |
| `beacons-to` | infrastructure/malware → infrastructure | C2 communication |
| `belongs-to` | ipv4-addr/ipv6-addr → autonomous-system | AS membership |
| `communicates-with` | infrastructure/malware/tool → infrastructure/ipv4-addr/ipv6-addr/domain-name/url | Network communication |
| `compromises` | campaign/intrusion-set/threat-actor → infrastructure | Compromise |
| `consists-of` | observed-data → SCO refs | Composition (deprecated, use object_refs) |
| `controls` | malware → malware/tool | Control relationship |
| `delivers` | attack-pattern/campaign/intrusion-set/malware/tool → malware | Delivery mechanism |
| `derived-from` | indicator → indicator | Derivation |
| `downloads` | malware/tool → malware/tool/file | Download activity |
| `drops` | malware/tool → malware/tool/file | Dropped artifacts |
| `duplicate-of` | indicator/malware/observed-data → same type | Duplication |
| `exploits` | attack-pattern/campaign/intrusion-set/malware/tool/threat-actor → vulnerability | Exploitation |
| `has` | identity/infrastructure → vulnerability | Vulnerability possession |
| `hosts` | infrastructure → infrastructure/malware/tool | Hosting |
| `impersonates` | campaign/intrusion-set/threat-actor → identity | Impersonation |
| `indicates` | indicator → attack-pattern/campaign/infrastructure/intrusion-set/malware/threat-actor/tool | Detection |
| `investigates` | course-of-action → indicator | Investigation |
| `located-at` | identity/infrastructure/malware/threat-actor → location | Geographic location |
| `mitigates` | course-of-action → attack-pattern/indicator/malware/tool/vulnerability | Mitigation |
| `originates-from` | campaign/intrusion-set/malware/threat-actor → location | Origin |
| `owns` | identity → infrastructure | Ownership |
| `related-to` | ANY → ANY | General relation (use sparingly) |
| `remediates` | course-of-action → malware/vulnerability | Remediation |
| `resolves-to` | domain-name → domain-name/ipv4-addr/ipv6-addr | DNS resolution |
| `revoked-by` | ANY → same type | Revocation |
| `targets` | attack-pattern/campaign/intrusion-set/malware/threat-actor/tool → identity/location/vulnerability | Targeting |
| `uses` | campaign/intrusion-set/malware/threat-actor/tool → attack-pattern/infrastructure/malware/tool | Tool/technique usage |
| `variant-of` | malware → malware | Variant |

**Example (d2ts correlation):**

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--44298a74-ba52-4f0c-87a3-1824e67e7802",
  "created": "2026-02-18T15:35:00.000Z",
  "modified": "2026-02-18T15:35:00.000Z",
  "relationship_type": "related-to",
  "description": "Temporal correlation: HTTP beacon and SDR capture occurred within 5-second window.",
  "source_ref": "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
  "target_ref": "observed-data--c78e41aa-13bd-509b-a30a-43f956f559dg",
  "start_time": "2026-02-18T15:29:40.000Z",
  "stop_time": "2026-02-18T15:29:50.000Z"
}
```

**Example (indicator based on observation):**

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--55309b85-cb63-5g1d-98b4-2935f78ba913",
  "created": "2026-02-18T15:40:00.000Z",
  "modified": "2026-02-18T15:40:00.000Z",
  "relationship_type": "based-on",
  "source_ref": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "target_ref": "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf"
}
```

---

### 4.2 sighting

**Type:** `sighting`
**Description:** Denotes the belief that something in CTI was seen. Sightings track when and where intelligence (indicators, malware, etc.) has been observed in the real world.

**Tsingou Relevance:** HIGH — When a Tsingou signal matches an imported indicator, the match is exported as a sighting. Also used for tracking re-observations of known patterns.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | No | Detailed description |
| `first_seen` | `timestamp` | No | When first sighted |
| `last_seen` | `timestamp` | No | When last sighted |
| `count` | `integer` | No | Number of times sighted |
| `sighting_of_ref` | `identifier` | **Yes** | What was sighted (SDO reference) |
| `observed_data_refs` | `list of identifier` | No | observed-data objects as evidence |
| `where_sighted_refs` | `list of identifier` | No | Where sighted (identity references) |
| `summary` | `boolean` | No | If true, this is a summary sighting |

**Decision tree: When to use sighting vs relationship:**

```
Was an imported indicator matched against observed signals?
├── YES → sighting (sighting_of_ref = indicator, observed_data_refs = signals)
└── NO
    ├── Are two observed signals temporally correlated?
    │   └── YES → relationship (type: "related-to")
    ├── Was an indicator derived from an observation?
    │   └── YES → relationship (type: "based-on")
    └── Other → relationship (type as appropriate)
```

**Example (indicator matched in live signals):**

```json
{
  "type": "sighting",
  "spec_version": "2.1",
  "id": "sighting--ee20065d-2555-424f-ad9e-0f8428571e2c",
  "created": "2026-02-18T15:45:00.000Z",
  "modified": "2026-02-18T15:45:00.000Z",
  "first_seen": "2026-02-18T15:29:45.123Z",
  "last_seen": "2026-02-18T15:29:45.123Z",
  "count": 1,
  "sighting_of_ref": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "observed_data_refs": [
    "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf"
  ],
  "where_sighted_refs": [
    "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff"
  ],
  "summary": false
}
```

---

## 5. STIX Cyber-observable Objects (SCOs)

### 5.1 artifact

**Type:** `artifact`
**Description:** Captures raw binary content or a reference to it. Used for payloads, files, captures, or any binary data.

**Tsingou Relevance:** **CRITICAL** — Primary SCO for signal kinds that don't map to standard SCOs: RSS content, NATS message data, serial raw bytes, MIDI sysex, OSC blobs, SDR IQ samples.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mime_type` | `string` | No | MIME type of the content |
| `payload_bin` | `binary` | No* | Base64-encoded content |
| `url` | `string` | No* | URL reference to content |
| `hashes` | `hashes-type` | No | Content hashes |
| `encryption_algorithm` | `open-vocab` | No | Encryption algorithm if encrypted |
| `decryption_key` | `string` | No | Decryption key |

*Either `payload_bin` or `url` MUST be present, but not both.

**Tsingou usage per signal kind:**

| Signal Kind | artifact Usage | mime_type |
|-------------|---------------|-----------|
| rss | Full article content | `text/html` or `text/plain` |
| nats | Serialized message data | `application/json` or `application/octet-stream` |
| serial | Raw binary frame | `application/octet-stream` |
| midi (sysex) | SysEx message bytes | `audio/midi` |
| osc (blob args) | OSC blob arguments | `application/octet-stream` |
| sdr | IQ sample data (inline or ref) | `application/vnd.sigmf` |
| file-watch | File content | Inferred from file extension |

**Size threshold:** If `payload_bin` would exceed 1 MB, use `url` with an external reference instead.

**Example (RSS content):**

```json
{
  "type": "artifact",
  "spec_version": "2.1",
  "id": "artifact--7a4f2b3c-8d5e-4f9a-b1c2-d3e4f5a6b7c8",
  "mime_type": "text/html",
  "payload_bin": "PGh0bWw+PGJvZHk+PHA+QXJ0aWNsZSBjb250ZW50IGhlcmUuPC9wPjwvYm9keT48L2h0bWw+",
  "hashes": {
    "SHA-256": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
  }
}
```

**Example (SDR IQ capture reference):**

```json
{
  "type": "artifact",
  "spec_version": "2.1",
  "id": "artifact--1234abcd-5678-efgh-ijkl-mnopqrstuvwx",
  "mime_type": "application/vnd.sigmf",
  "url": "nats://tsingou.captures/sdr/2026-02-18/capture-001.sigmf-data",
  "hashes": {
    "SHA-256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}
```

---

### 5.2 autonomous-system

**Type:** `autonomous-system`
**Description:** Represents an Autonomous System (AS) on the internet.

**Tsingou Relevance:** LOW — May be extracted from HTTP signal IP addresses via ASN lookup enrichment.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `number` | `integer` | **Yes** | AS number |
| `name` | `string` | No | AS name |
| `rir` | `string` | No | Regional Internet Registry |

**Example:**

```json
{
  "type": "autonomous-system",
  "spec_version": "2.1",
  "id": "autonomous-system--f720c34b-98ae-597f-ade5-27244f2a96b6",
  "number": 15169,
  "name": "GOOGLE",
  "rir": "ARIN"
}
```

---

### 5.3 directory

**Type:** `directory`
**Description:** Represents a filesystem directory.

**Tsingou Relevance:** MEDIUM — Generated from file-watch signals as the parent directory of watched files.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | **Yes** | Directory path |
| `path_enc` | `string` | No | Path encoding |
| `ctime` | `timestamp` | No | Creation time |
| `mtime` | `timestamp` | No | Modification time |
| `atime` | `timestamp` | No | Access time |
| `contains_refs` | `list of identifier` | No | References to contained file/directory SCOs |

**Example:**

```json
{
  "type": "directory",
  "spec_version": "2.1",
  "id": "directory--93c0a9b0-520d-545d-9094-1a08ddf46b05",
  "path": "/var/log/sensor-data",
  "ctime": "2026-01-01T00:00:00.000Z",
  "mtime": "2026-02-18T15:30:00.000Z"
}
```

---

### 5.4 domain-name

**Type:** `domain-name`
**Description:** Represents a network domain name.

**Tsingou Relevance:** HIGH — Extracted from HTTP signal URLs and WebSocket connection URLs. Key observable for threat intelligence matching.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | Domain name value |
| `resolves_to_refs` | `list of identifier` | No | IP addresses or other domain names |

**Example:**

```json
{
  "type": "domain-name",
  "spec_version": "2.1",
  "id": "domain-name--3c10e93f-798e-5d2a-9087-7c5f5bfcab73",
  "value": "suspicious-c2.example.com",
  "resolves_to_refs": [
    "ipv4-addr--ff26966f-0065-531e-a509-0ce4a5bddaa8"
  ]
}
```

---

### 5.5 email-addr

**Type:** `email-addr`
**Description:** Represents a single email address.

**Tsingou Relevance:** LOW — May be extracted from RSS author fields or HTTP response bodies during IOC extraction.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | Email address |
| `display_name` | `string` | No | Display name |
| `belongs_to_ref` | `identifier` | No | Reference to user-account SCO |

**Example:**

```json
{
  "type": "email-addr",
  "spec_version": "2.1",
  "id": "email-addr--2d77a846-6264-5d51-b586-e43822ea1ea3",
  "value": "analyst@example.com",
  "display_name": "Jane Analyst"
}
```

---

### 5.6 email-message

**Type:** `email-message`
**Description:** Represents a full email message.

**Tsingou Relevance:** LOW — Not directly generated by Tsingou signal kinds. May appear in imported STIX bundles.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `is_multipart` | `boolean` | **Yes** | Whether the email is multipart |
| `date` | `timestamp` | No | Date sent |
| `content_type` | `string` | No | Content-Type header |
| `from_ref` | `identifier` | No | Sender email-addr ref |
| `sender_ref` | `identifier` | No | Sender (if different from From) |
| `to_refs` | `list of identifier` | No | To recipients |
| `cc_refs` | `list of identifier` | No | CC recipients |
| `bcc_refs` | `list of identifier` | No | BCC recipients |
| `message_id` | `string` | No | Message-ID header |
| `subject` | `string` | No | Subject line |
| `received_lines` | `list of string` | No | Received headers |
| `additional_header_fields` | `dictionary` | No | Other headers |
| `body` | `string` | No | Body text (for non-multipart) |
| `body_multipart` | `list of mime-part` | No | MIME parts (for multipart) |
| `raw_email_ref` | `identifier` | No | artifact ref for raw email |

**Example:**

```json
{
  "type": "email-message",
  "spec_version": "2.1",
  "id": "email-message--72b7698f-10c2-565a-a2c3-b4e0fd7ae9d0",
  "is_multipart": false,
  "from_ref": "email-addr--2d77a846-6264-5d51-b586-e43822ea1ea3",
  "subject": "Suspicious activity report",
  "date": "2026-02-18T12:00:00.000Z",
  "body": "See attached analysis report."
}
```

---

### 5.7 file

**Type:** `file`
**Description:** Represents the properties of a file, including hashes and extensions for specific file types.

**Tsingou Relevance:** **CRITICAL** — Primary SCO for file-watch signals. Includes name, size, hashes, MIME type.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hashes` | `hashes-type` | No* | File hashes (MD5, SHA-1, SHA-256, SHA-512) |
| `size` | `integer` | No | File size in bytes |
| `name` | `string` | No | File name |
| `name_enc` | `string` | No | Character encoding of name |
| `magic_number_hex` | `hex` | No | File magic bytes |
| `mime_type` | `string` | No | MIME type |
| `ctime` | `timestamp` | No | Creation time |
| `mtime` | `timestamp` | No | Modification time |
| `atime` | `timestamp` | No | Access time |
| `parent_directory_ref` | `identifier` | No | Reference to directory SCO |
| `contains_refs` | `list of identifier` | No | Embedded objects |
| `content_ref` | `identifier` | No | Reference to artifact SCO with content |

*At least `hashes` or `name` SHOULD be present.

**File hash types:**

| Key | Algorithm | Length |
|-----|-----------|--------|
| `MD5` | MD5 | 32 hex chars |
| `SHA-1` | SHA-1 | 40 hex chars |
| `SHA-256` | SHA-256 | 64 hex chars |
| `SHA-512` | SHA-512 | 128 hex chars |
| `SHA3-256` | SHA3-256 | 64 hex chars |
| `SHA3-512` | SHA3-512 | 128 hex chars |
| `SSDEEP` | ssdeep fuzzy hash | Variable |
| `TLSH` | TLSH locality-sensitive hash | Variable |

**Extensions:**

| Extension | Type | For |
|-----------|------|-----|
| `ntfs-ext` | NTFS-specific | NTFS alternate data streams |
| `pdf-ext` | PDF-specific | PDF metadata |
| `raster-image-ext` | Image-specific | Image metadata (EXIF) |
| `windows-pebinary-ext` | PE-specific | Windows PE headers |
| `archive-ext` | Archive-specific | ZIP/TAR/RAR contents |

**Example (from file-watch signal):**

```json
{
  "type": "file",
  "spec_version": "2.1",
  "id": "file--8a7b56c3-d40e-5abc-9123-456789abcdef",
  "hashes": {
    "SHA-256": "ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c"
  },
  "size": 25536,
  "name": "sensor-data-2026-02-18.csv",
  "mime_type": "text/csv",
  "mtime": "2026-02-18T15:30:00.000Z",
  "parent_directory_ref": "directory--93c0a9b0-520d-545d-9094-1a08ddf46b05",
  "content_ref": "artifact--7a4f2b3c-8d5e-4f9a-b1c2-d3e4f5a6b7c8"
}
```

---

### 5.8 ipv4-addr

**Type:** `ipv4-addr`
**Description:** Represents an IPv4 address.

**Tsingou Relevance:** HIGH — Extracted from HTTP signal URLs, WebSocket URLs, and network-traffic objects. Key indicator for threat matching.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | IPv4 address (may include CIDR notation) |
| `resolves_to_refs` | `list of identifier` | No | MAC addresses |
| `belongs_to_refs` | `list of identifier` | No | Autonomous system refs |

**Example:**

```json
{
  "type": "ipv4-addr",
  "spec_version": "2.1",
  "id": "ipv4-addr--ff26966f-0065-531e-a509-0ce4a5bddaa8",
  "value": "198.51.100.42",
  "belongs_to_refs": [
    "autonomous-system--f720c34b-98ae-597f-ade5-27244f2a96b6"
  ]
}
```

---

### 5.9 ipv6-addr

**Type:** `ipv6-addr`
**Description:** Represents an IPv6 address.

**Tsingou Relevance:** MEDIUM — Same as ipv4-addr but for IPv6.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | IPv6 address (may include prefix length) |
| `resolves_to_refs` | `list of identifier` | No | MAC addresses |
| `belongs_to_refs` | `list of identifier` | No | Autonomous system refs |

**Example:**

```json
{
  "type": "ipv6-addr",
  "spec_version": "2.1",
  "id": "ipv6-addr--1a2b3c4d-5e6f-7a8b-9c0d-e1f2a3b4c5d6",
  "value": "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
}
```

---

### 5.10 mac-addr

**Type:** `mac-addr`
**Description:** Represents a MAC address.

**Tsingou Relevance:** LOW — Rarely directly observed in Tsingou signals.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | MAC address (colon-separated hex) |

**Example:**

```json
{
  "type": "mac-addr",
  "spec_version": "2.1",
  "id": "mac-addr--65cfcf98-8a6e-5a1b-8f61-379ac4f92d00",
  "value": "d2:fb:49:24:37:18"
}
```

---

### 5.11 mutex

**Type:** `mutex`
**Description:** Represents a named mutual exclusion (mutex) object.

**Tsingou Relevance:** NONE — Not relevant to Tsingou signal kinds.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Mutex name |

**Example:**

```json
{
  "type": "mutex",
  "spec_version": "2.1",
  "id": "mutex--eba44954-d4e4-5d3b-814c-2b17dd8de300",
  "name": "Global\\MutexName"
}
```

---

### 5.12 network-traffic

**Type:** `network-traffic`
**Description:** Represents network communication. The most complex SCO with multiple extensions.

**Tsingou Relevance:** **CRITICAL** — Primary SCO for HTTP and WebSocket signals. Also generated for OSC signals (UDP source).

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `start` | `timestamp` | No | When traffic started |
| `end` | `timestamp` | No | When traffic ended |
| `is_active` | `boolean` | No | Whether connection is active |
| `src_ref` | `identifier` | No | Source address (ipv4/ipv6/mac/domain) |
| `dst_ref` | `identifier` | No | Destination address |
| `src_port` | `integer` | No | Source port |
| `dst_port` | `integer` | No | Destination port |
| `protocols` | `list of string` | **Yes** | Protocol stack (ordered low to high) |
| `src_byte_count` | `integer` | No | Bytes from source |
| `dst_byte_count` | `integer` | No | Bytes from destination |
| `src_packets` | `integer` | No | Packets from source |
| `dst_packets` | `integer` | No | Packets from destination |
| `ipfix` | `dictionary` | No | IPFIX data |
| `src_payload_ref` | `identifier` | No | Source payload artifact ref |
| `dst_payload_ref` | `identifier` | No | Destination payload artifact ref |
| `encapsulates_refs` | `list of identifier` | No | Encapsulated traffic |
| `encapsulated_by_ref` | `identifier` | No | Encapsulating traffic |

**Extensions:**

| Extension | Type | For |
|-----------|------|-----|
| `http-request-ext` | HTTP request details | HTTP signals |
| `icmp-ext` | ICMP details | ICMP traffic |
| `socket-ext` | Socket details | Low-level socket info |
| `tcp-ext` | TCP details | TCP-specific fields |

**http-request-ext properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `request_method` | `string` | **Yes** | HTTP method (GET, POST, etc.) |
| `request_value` | `string` | **Yes** | Request URL path |
| `request_version` | `string` | No | HTTP version |
| `request_header` | `dictionary` | No | HTTP headers |
| `message_body_length` | `integer` | No | Body length |
| `message_body_data_ref` | `identifier` | No | artifact ref for body |

**Example (from HTTP signal):**

```json
{
  "type": "network-traffic",
  "spec_version": "2.1",
  "id": "network-traffic--532e7a9b-2e39-4f97-8140-7fa879210eb1",
  "start": "2026-02-18T15:29:45.000Z",
  "end": "2026-02-18T15:29:45.150Z",
  "is_active": false,
  "src_ref": "ipv4-addr--1a2b3c4d-5e6f-7a8b-9c0d-000000000001",
  "dst_ref": "ipv4-addr--ff26966f-0065-531e-a509-0ce4a5bddaa8",
  "dst_port": 443,
  "protocols": ["ipv4", "tcp", "https"],
  "extensions": {
    "http-request-ext": {
      "request_method": "GET",
      "request_value": "/api/v1/status",
      "request_version": "HTTP/1.1",
      "request_header": {
        "Host": "suspicious-c2.example.com",
        "User-Agent": "Mozilla/5.0"
      }
    }
  }
}
```

**Example (from WebSocket signal):**

```json
{
  "type": "network-traffic",
  "spec_version": "2.1",
  "id": "network-traffic--abcdef12-3456-7890-abcd-ef1234567890",
  "start": "2026-02-18T15:00:00.000Z",
  "is_active": true,
  "dst_ref": "domain-name--websocket-host-id",
  "dst_port": 8080,
  "protocols": ["ipv4", "tcp", "http", "websocket"]
}
```

---

### 5.13 process

**Type:** `process`
**Description:** Represents a running process on a system.

**Tsingou Relevance:** LOW — Not directly generated by Tsingou signals. May appear in imported STIX bundles.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `is_hidden` | `boolean` | No | Whether process is hidden |
| `pid` | `integer` | No | Process ID |
| `created_time` | `timestamp` | No | Process creation time |
| `cwd` | `string` | No | Working directory |
| `command_line` | `string` | No | Full command line |
| `environment_variables` | `dictionary` | No | Environment variables |
| `opened_connection_refs` | `list of identifier` | No | Network connections |
| `creator_user_ref` | `identifier` | No | User who created the process |
| `image_ref` | `identifier` | No | Executable file ref |
| `parent_ref` | `identifier` | No | Parent process ref |
| `child_refs` | `list of identifier` | No | Child processes |

**Extensions:**

| Extension | Type | For |
|-----------|------|-----|
| `windows-service-ext` | Windows Service | Service details |

**Example:**

```json
{
  "type": "process",
  "spec_version": "2.1",
  "id": "process--f52a906a-0dfc-40bd-92f1-e7778ead38a9",
  "pid": 1234,
  "command_line": "gnuradio-companion --capture vhf-maritime.grc",
  "created_time": "2026-02-18T14:00:00.000Z"
}
```

---

### 5.14 software

**Type:** `software`
**Description:** Represents software (OS or application).

**Tsingou Relevance:** LOW — May be used to identify SDR software or analysis tools in exported STIX bundles.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | **Yes** | Software name |
| `cpe` | `string` | No | CPE identifier |
| `swid` | `string` | No | SWID tag identifier |
| `languages` | `list of string` | No | Programming languages |
| `vendor` | `string` | No | Software vendor |
| `version` | `string` | No | Version string |

**Example:**

```json
{
  "type": "software",
  "spec_version": "2.1",
  "id": "software--a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "GNU Radio",
  "vendor": "GNU Radio Project",
  "version": "3.10.9.2"
}
```

---

### 5.15 url

**Type:** `url`
**Description:** Represents a Uniform Resource Locator (URL).

**Tsingou Relevance:** **CRITICAL** — Generated from HTTP signal URLs, RSS feed links, and WebSocket connection URLs. Key indicator for threat matching.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `string` | **Yes** | The URL value |

**Example:**

```json
{
  "type": "url",
  "spec_version": "2.1",
  "id": "url--947c9d59-d3f2-4e2a-8c43-6d5ed9f3e5a2",
  "value": "https://suspicious-c2.example.com/api/v1/status"
}
```

---

### 5.16 user-account

**Type:** `user-account`
**Description:** Represents a user account on a system.

**Tsingou Relevance:** LOW — Not directly generated by Tsingou signals.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `user_id` | `string` | No | User identifier |
| `credential` | `string` | No | Cleartext credential (when applicable) |
| `account_login` | `string` | No | Login name |
| `account_type` | `open-vocab` | No | Account type |
| `display_name` | `string` | No | Display name |
| `is_service_account` | `boolean` | No | Whether it's a service account |
| `is_privileged` | `boolean` | No | Whether it has elevated privileges |
| `can_escalate_privs` | `boolean` | No | Whether it can escalate |
| `is_disabled` | `boolean` | No | Whether it's disabled |
| `account_created` | `timestamp` | No | Account creation date |
| `account_expires` | `timestamp` | No | Account expiration date |
| `credential_last_changed` | `timestamp` | No | Last password change |
| `account_first_login` | `timestamp` | No | First login |
| `account_last_login` | `timestamp` | No | Last login |

**Extensions:** `unix-account-ext` for UNIX-specific properties (uid, gid, groups, home_dir, shell).

**Example:**

```json
{
  "type": "user-account",
  "spec_version": "2.1",
  "id": "user-account--0d5b424b-93b8-5cd8-ac36-306e1789d63c",
  "user_id": "1001",
  "account_login": "analyst",
  "account_type": "unix",
  "display_name": "Signal Analyst",
  "is_privileged": false
}
```

---

### 5.17 windows-registry-key

**Type:** `windows-registry-key`
**Description:** Represents a Windows registry key and its values.

**Tsingou Relevance:** NONE — Not relevant to Tsingou signal kinds.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | `string` | No | Full registry key path |
| `values` | `list of windows-registry-value` | No | Registry values |
| `modified_time` | `timestamp` | No | Last modification time |
| `creator_user_ref` | `identifier` | No | User who created the key |
| `number_of_subkeys` | `integer` | No | Number of subkeys |

**Example:**

```json
{
  "type": "windows-registry-key",
  "spec_version": "2.1",
  "id": "windows-registry-key--2ba37ae7-2745-5082-9dfd-9486dad41016",
  "key": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Tsingou\\Config",
  "values": [
    {
      "name": "InstallPath",
      "data": "C:\\Program Files\\Tsingou",
      "data_type": "REG_SZ"
    }
  ]
}
```

---

### 5.18 x509-certificate

**Type:** `x509-certificate`
**Description:** Represents an X.509 digital certificate.

**Tsingou Relevance:** LOW — May be extracted from HTTPS connections in HTTP signals for certificate transparency analysis.

**Specific Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `is_self_signed` | `boolean` | No | Whether self-signed |
| `hashes` | `hashes-type` | No | Certificate hashes |
| `version` | `string` | No | X.509 version |
| `serial_number` | `string` | No | Serial number |
| `signature_algorithm` | `string` | No | Signature algorithm |
| `issuer` | `string` | No | Issuer DN |
| `validity_not_before` | `timestamp` | No | Not valid before |
| `validity_not_after` | `timestamp` | No | Not valid after |
| `subject` | `string` | No | Subject DN |
| `subject_public_key_algorithm` | `string` | No | Public key algorithm |
| `subject_public_key_modulus` | `string` | No | Public key modulus |
| `subject_public_key_exponent` | `integer` | No | Public key exponent |
| `x509_v3_extensions` | `x509-v3-extensions-type` | No | V3 extensions |

**Example:**

```json
{
  "type": "x509-certificate",
  "spec_version": "2.1",
  "id": "x509-certificate--b595eaf0-0b28-5dad-9e8e-0fab9c1facc9",
  "is_self_signed": false,
  "serial_number": "01:23:45:67:89:AB:CD:EF",
  "issuer": "CN=Let's Encrypt Authority X3, O=Let's Encrypt, C=US",
  "validity_not_before": "2026-01-01T00:00:00.000Z",
  "validity_not_after": "2026-04-01T00:00:00.000Z",
  "subject": "CN=suspicious-c2.example.com"
}
```

---

## 6. STIX Meta Objects

### 6.1 bundle

**Type:** `bundle`
**Description:** A collection of STIX objects grouped together. The top-level container for STIX data exchange.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Always "bundle" |
| `id` | `identifier` | **Yes** | Bundle identifier |
| `objects` | `list of STIX object` | No | Contained STIX objects |

**Key semantics:**
- Bundles are NOT versioned (no `created`/`modified`)
- Objects within a bundle may reference each other
- A bundle is the unit of STIX data exchange (TAXII transfers bundles)
- Objects in a bundle may reference objects NOT in the bundle

**Example:**

```json
{
  "type": "bundle",
  "id": "bundle--d9ee4c69-3e9b-4f53-8cdb-7c8e13d6c2a7",
  "objects": [
    { "type": "identity", "...": "..." },
    { "type": "observed-data", "...": "..." },
    { "type": "network-traffic", "...": "..." },
    { "type": "url", "...": "..." }
  ]
}
```

---

### 6.2 marking-definition

**Type:** `marking-definition`
**Description:** Represents data markings (TLP or statement-based).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Always "marking-definition" |
| `spec_version` | `string` | **Yes** | "2.1" |
| `id` | `identifier` | **Yes** | Marking identifier |
| `created_by_ref` | `identifier` | No | Creator identity |
| `created` | `timestamp` | **Yes** | When created |
| `name` | `string` | No | Marking name |
| `definition_type` | `string` | **Yes** | "statement" or "tlp" |
| `definition` | `marking-type` | **Yes** | Marking definition |

**Pre-defined TLP markings (use these exact IDs):**

| TLP Level | ID | Definition |
|-----------|-----|-----------|
| TLP:WHITE | `marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9` | `{"tlp": "white"}` |
| TLP:GREEN | `marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da` | `{"tlp": "green"}` |
| TLP:AMBER | `marking-definition--f88d31f6-486f-44da-b317-01333bde0b82` | `{"tlp": "amber"}` |
| TLP:AMBER+STRICT | `marking-definition--826578e1-40a3-4b12-afc8-1c1d8e52e3e5` | `{"tlp": "amber+strict"}` |
| TLP:RED | `marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed` | `{"tlp": "red"}` |

**Example (statement marking):**

```json
{
  "type": "marking-definition",
  "spec_version": "2.1",
  "id": "marking-definition--a9ee4c69-3e9b-4f53-8cdb-7c8e13d6c2a7",
  "created": "2026-01-01T00:00:00.000Z",
  "definition_type": "statement",
  "definition": {
    "statement": "Copyright 2026, Tsingou Platform. All rights reserved."
  }
}
```

---

### 6.3 language-content

**Type:** `language-content`
**Description:** Provides translated versions of STIX object properties.

**Tsingou Relevance:** LOW — May be relevant for multi-language deployments.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Always "language-content" |
| `spec_version` | `string` | **Yes** | "2.1" |
| `id` | `identifier` | **Yes** | Identifier |
| `created_by_ref` | `identifier` | No | Creator identity |
| `created` | `timestamp` | **Yes** | When created |
| `modified` | `timestamp` | **Yes** | When modified |
| `object_ref` | `identifier` | **Yes** | Object being translated |
| `object_modified` | `timestamp` | No | Version of object being translated |
| `contents` | `dictionary` | **Yes** | Language code → property translations |

**Example:**

```json
{
  "type": "language-content",
  "spec_version": "2.1",
  "id": "language-content--b86bd89f-98bb-4fa9-8cb2-0b4b4ab4e9f1",
  "created": "2026-02-18T00:00:00.000Z",
  "modified": "2026-02-18T00:00:00.000Z",
  "object_ref": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "contents": {
    "de": {
      "name": "Verdaechtiges HTTP-Beacon-Muster",
      "description": "d2ts Anomalieerkennung: Periodische HTTP-Anfragen..."
    }
  }
}
```

---

### 6.4 extension-definition

**Type:** `extension-definition`
**Description:** Defines a new STIX extension, allowing consumers to understand and validate custom objects and properties.

**Tsingou Relevance:** **CRITICAL** — Required to register the x-tsingou-* custom SCOs so that consumer platforms can validate and process them.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | **Yes** | Always "extension-definition" |
| `spec_version` | `string` | **Yes** | "2.1" |
| `id` | `identifier` | **Yes** | Extension identifier |
| `created_by_ref` | `identifier` | **Yes** | Creator identity |
| `created` | `timestamp` | **Yes** | When created |
| `modified` | `timestamp` | **Yes** | When modified |
| `name` | `string` | **Yes** | Extension name |
| `description` | `string` | No | Extension description |
| `schema` | `string` | **Yes** | URL to JSON Schema defining the extension |
| `version` | `string` | **Yes** | Extension version |
| `extension_types` | `list of string` | **Yes** | Types: "new-sdo", "new-sco", "new-sro", "property-extension", "toplevel-property-extension" |
| `extension_properties` | `list of string` | No | Property names added (for property extensions) |

**Example (Tsingou custom SCO extension):**

```json
{
  "type": "extension-definition",
  "spec_version": "2.1",
  "id": "extension-definition--d9ee4c69-3e9b-4f53-8cdb-7c8e13d6c2a7",
  "created_by_ref": "identity--f431f809-377b-45e0-aa1c-6a4751cae5ff",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-02-18T00:00:00.000Z",
  "name": "Tsingou Signal Intelligence Extensions",
  "description": "Custom SCOs for signal types not covered by standard STIX: NATS messages, MIDI events, OSC messages, serial data, SDR captures.",
  "schema": "https://tsingou.dev/stix/extensions/v1/schema.json",
  "version": "1.0.0",
  "extension_types": ["new-sco", "toplevel-property-extension"]
}
```

---

## 7. STIX Patterning Language

The STIX Patterning Language enables detection of cyber activity by matching against observable properties.

### 7.1 Pattern Syntax

A STIX pattern consists of one or more **Observation Expressions** connected by observation operators:

```
[<comparison_expression>] <observation_operator> [<comparison_expression>]
```

### 7.2 Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal | `[url:value = 'http://example.com']` |
| `!=` | Not equal | `[file:size != 0]` |
| `>` | Greater than | `[file:size > 1024]` |
| `<` | Less than | `[network-traffic:dst_port < 1024]` |
| `>=` | Greater or equal | `[file:size >= 500]` |
| `<=` | Less or equal | `[network-traffic:dst_port <= 443]` |
| `IN` | Set membership | `[network-traffic:dst_port IN (80, 443, 8080)]` |
| `LIKE` | Pattern match (%) | `[domain-name:value LIKE 'c2%.example.com']` |
| `MATCHES` | Regex match | `[url:value MATCHES '^https://.*\\.onion/']` |
| `ISSUBSET` | Subnet check | `[ipv4-addr:value ISSUBSET '198.51.100.0/24']` |
| `ISSUPERSET` | Supernet check | `[ipv4-addr:value ISSUPERSET '198.51.100.0/28']` |

### 7.3 Observation Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `AND` | Both must match in same observation | `[<expr1> AND <expr2>]` |
| `OR` | Either must match in same observation | `[<expr1> OR <expr2>]` |
| `FOLLOWEDBY` | Sequential match across observations | `[<expr1>] FOLLOWEDBY [<expr2>]` |

### 7.4 Qualifiers

| Qualifier | Meaning | Example |
|-----------|---------|---------|
| `WITHIN` | Time window | `[...] FOLLOWEDBY [...] WITHIN 5 MINUTES` |
| `REPEATS` | Minimum count | `[...] REPEATS 10 TIMES` |
| `START` | Time range start | `[...] START '2026-02-18T00:00:00Z'` |
| `STOP` | Time range end | `[...] STOP '2026-02-19T00:00:00Z'` |

### 7.5 Object Path Syntax

Patterns reference SCO properties using dotted path notation:

```
<sco_type>:<property>[.<sub_property>]
```

Examples:
- `network-traffic:dst_port`
- `network-traffic:dst_ref.type`
- `network-traffic:dst_ref.value`
- `file:hashes.'SHA-256'`
- `email-message:from_ref.value`
- `network-traffic:extensions.'http-request-ext'.request_method`

### 7.6 Pattern Examples for Tsingou Signal Types

**HTTP signal — suspicious C2 beacon:**
```
[network-traffic:dst_ref.type = 'ipv4-addr'
 AND network-traffic:dst_ref.value = '198.51.100.42'
 AND network-traffic:dst_port = 443]
REPEATS 5 TIMES WITHIN 10 MINUTES
```

**HTTP signal — specific URL pattern:**
```
[url:value MATCHES 'https://.*\\.example\\.com/api/v[0-9]+/beacon']
```

**File-watch signal — suspicious file hash:**
```
[file:hashes.'SHA-256' = 'ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c']
```

**File-watch signal — large file creation:**
```
[file:size > 10485760 AND file:mime_type = 'application/octet-stream']
```

**Network traffic — specific domain:**
```
[domain-name:value = 'malicious.example.com']
```

**Network traffic — port scan detection:**
```
[network-traffic:dst_port > 0 AND network-traffic:dst_port < 1024
 AND network-traffic:src_ref.type = 'ipv4-addr'
 AND network-traffic:src_ref.value = '10.0.0.1']
REPEATS 100 TIMES WITHIN 1 MINUTES
```

**Artifact — specific MIME type:**
```
[artifact:mime_type = 'application/x-executable']
```

**Chained observation (HTTP followed by file drop):**
```
[network-traffic:dst_ref.value = '198.51.100.42']
FOLLOWEDBY
[file:hashes.'SHA-256' = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890']
WITHIN 30 SECONDS
```

### 7.7 d2ts Anomaly → STIX Pattern Translation

When d2ts detects an anomaly, the detection rule is translated to a STIX pattern:

| d2ts Anomaly Type | STIX Pattern Translation |
|-------------------|-------------------------|
| Periodic HTTP beacon | `[network-traffic:dst_ref.value = '<ip>' AND network-traffic:dst_port = <port>] REPEATS <n> TIMES WITHIN <window>` |
| Unusual file hash | `[file:hashes.'SHA-256' = '<hash>']` |
| Domain resolution anomaly | `[domain-name:value = '<domain>']` |
| Traffic volume spike | `[network-traffic:src_byte_count > <threshold>] REPEATS <n> TIMES WITHIN <window>` |
| New URL pattern | `[url:value MATCHES '<regex>']` |
| SDR signal anomaly | `[artifact:mime_type = 'application/vnd.sigmf']` (limited — no SCO for RF properties) |

**Limitation:** Non-cyber signal kinds (MIDI, OSC, serial, SDR) have limited STIX pattern expressiveness because STIX patterns only reference standard SCO types. Custom SCO properties (x-tsingou-*) can be referenced using the extension path syntax but may not be understood by all STIX consumers.

---

## 8. Tsingou Relevance Summary

### 8.1 SDO Relevance Matrix

| SDO | Relevance | Direction | Tsingou Usage |
|-----|-----------|-----------|---------------|
| attack-pattern | Low | Import | Correlated with observed patterns |
| campaign | Low | Import | Attribution context |
| course-of-action | Low | Import | Remediation reference |
| **grouping** | **High** | **Export** | **d2ts analysis sessions** |
| **identity** | **High** | **Both** | **System/adapter/user identity** |
| **indicator** | **Critical** | **Both** | **d2ts anomalies (export), CTI feeds (import)** |
| infrastructure | Low | Import | C2 infrastructure correlation |
| intrusion-set | Low | Import | Threat group attribution |
| location | Medium | Export | SDR capture geolocation |
| malware | Low | Import | File-watch correlation |
| malware-analysis | Low | Import | Cortex analyzer results |
| note | Medium | Export | Analyst annotations |
| **observed-data** | **Critical** | **Export** | **Primary export for ALL signal kinds** |
| opinion | Medium | Export | Analyst assessments |
| **report** | **High** | **Export** | **Curated analysis output** |
| threat-actor | Low | Import | Attribution |
| tool | Low | Import | Tool identification |
| vulnerability | Low | Import | CVE correlation |

### 8.2 SRO Relevance Matrix

| SRO | Relevance | Direction | Tsingou Usage |
|-----|-----------|-----------|---------------|
| **relationship** | **High** | **Export** | **d2ts correlations, indicator-to-observation links** |
| **sighting** | **High** | **Export** | **CTI indicator matching against live signals** |

### 8.3 SCO Relevance Matrix

| SCO | Relevance | Signal Kind Affinity | Notes |
|-----|-----------|---------------------|-------|
| **artifact** | **Critical** | rss, nats, serial, midi, osc, sdr, file-watch | Primary for non-standard payloads |
| autonomous-system | Low | http (via enrichment) | ASN lookup enrichment |
| directory | Medium | file-watch | Parent directory |
| **domain-name** | **High** | http, websocket | URL extraction |
| email-addr | Low | rss (author) | IOC extraction |
| email-message | None | — | Not generated |
| **file** | **Critical** | file-watch | Primary for file signals |
| **ipv4-addr** | **High** | http, websocket | URL extraction |
| ipv6-addr | Medium | http, websocket | URL extraction |
| mac-addr | Low | — | Rarely observed |
| mutex | None | — | Not relevant |
| **network-traffic** | **Critical** | http, websocket, osc | Primary for network signals |
| process | Low | — | Not generated |
| software | Low | — | Tool identification |
| **url** | **Critical** | http, rss, websocket | Primary for URL observables |
| user-account | Low | — | Not generated |
| windows-registry-key | None | — | Not relevant |
| x509-certificate | Low | http | Certificate transparency |

### 8.4 Signal Kind → STIX Mapping Summary

| Signal Kind | Primary SCOs | Custom Extension? | observed-data? |
|-------------|-------------|-------------------|----------------|
| http | network-traffic, url, domain-name, ipv4-addr | No | Yes |
| rss | artifact, url, (identity for author) | No | Yes |
| nats | **x-tsingou-nats-message**, artifact | **Yes** | Yes |
| websocket | network-traffic, url | No | Yes |
| file-watch | file, directory, artifact | No | Yes |
| serial | **x-tsingou-serial-data**, artifact | **Yes** | Yes |
| midi | **x-tsingou-midi-event**, artifact | **Yes** | Yes |
| osc | **x-tsingou-osc-message**, network-traffic | **Yes** | Yes |
| sdr | artifact (SigMF), **x-tsingou-sdr-capture** | **Yes** | Yes |

**5 of 9 signal kinds require custom STIX extensions** because they represent non-cyber-security signals with no standard STIX SCO equivalent.

---

<!-- RESEARCH NOTES
Sources:
- OASIS STIX 2.1 Specification: https://docs.oasis-open.org/cti/stix/v2.1/os/stix-v2.1-os.html
- STIX 2.1 Examples: https://oasis-open.github.io/cti-documentation/stix/examples.html
- Custom STIX Content: https://stix2.readthedocs.io/en/latest/guide/custom.html
- STIX Patterning: https://docs.oasis-open.org/cti/stix/v2.0/stix-v2.0-part5-stix-patterning.html
- Dogesec STIX guide: https://www.dogesec.com/blog/beginners_guide_stix_objects/
- Dogesec custom extensions: https://www.dogesec.com/blog/create_custom_stix_objects/

Codebase references:
- BaseSignal: src/lib/tsingou-flow/schemas/base-signal.ts
- Signal union: src/lib/tsingou-flow/schemas/signal-union.ts
- Per-kind schemas: src/lib/tsingou-flow/schemas/{kind}-signal.ts
- ADR-009: docs/tsingou/adr/ADR-009-stix-interop-layer.md
-->
