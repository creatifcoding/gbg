# Sparkplug B Research Reference Index

> **Purpose**: Single source of truth for all Sparkplug B research findings.
> **Created**: 2026-02-08
> **Research Sources**: oracle-sparkplug-landscape, arch-sparkplug, arch-nats-advocate, Val (spec analysis)
> **Decision**: Fork `@nortech/sparkplug-client@3.5.2` as `@selfcharters/sparkplug-client` — unlock hardcoded settings, add Effect-native wrappers, fix Will QoS spec violation

---

## Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [npm Package Inventory](#2-npm-package-inventory)
3. [Rust/Go Alternatives](#3-rustgo-alternatives)
4. [Sparkplug B Spec Normative Requirements](#4-sparkplug-b-spec-normative-requirements)
5. [mqtt.js v5 Capabilities](#5-mqttjs-v5-capabilities)
6. [sparkplug-client Source Audit](#6-sparkplug-client-source-audit)
7. [Nortech Fork Analysis](#7-nortech-fork-analysis)
8. [NATS MQTT Bridge Assessment](#8-nats-mqtt-bridge-assessment)
9. [EMQX Assessment (Banked)](#9-emqx-assessment-banked)
10. [External References](#10-external-references)

---

## 1. Architecture Decision

**Decision**: Fork `@nortech/sparkplug-client@3.5.2` as `@selfcharters/sparkplug-client`

**Lineage**: Eclipse Tahu (`sparkplug-client@3.2.4`) → Nortech fork (`@nortech/sparkplug-client@3.5.2`, mqtt.js v5) → **Our fork** (`@selfcharters/sparkplug-client`)

**Package**: `@selfcharters/sparkplug-client` in NX monorepo at `packages/sparkplug-client/`

**What Nortech already did** (we inherit this for free):
- Upgraded mqtt.js from v2/v4 → **v5** (TypeScript-native, MQTT 5.0)
- Exposed `decodePayload`/`decompressPayload` as public exports
- Added `cb` callback params to publish methods

**What we change on top of Nortech**:
- Remove `Omit<>` restriction — make `clean`, `will`, `keepalive` configurable
- Fix Will QoS: default to `1` (spec-compliant) instead of hardcoded `0`
- Make per-publish `retain`/`qos` configurable (defaults remain spec-compliant)
- Add Effect-native wrappers (Service, Layer, Stream.async bridge)
- Add Effect Schema config type
- Add SeqCounter/BdSeqCounter as Effect.Ref
- Add STATE message handling (not present in either upstream)

**Rationale** (four-way consensus):
- Eclipse sparkplug-client v3.2.4 is dead (mqtt.js v2, no TS, spec violation)
- Nortech fork is the best starting point (mqtt.js v5, actively maintained through May 2025)
- But Nortech kept the same hardcoded locks — we need to unlock them
- Effect-native design enables Layer-based broker swapping (NATS vs EMQX)
- Empirical broker testing becomes possible (configurable retain/will/QoS)

**Dependencies** (inherited from Nortech, pinned to latest):
- `mqtt@^5.15.0` — TypeScript-native, MQTT 5.0, per-publish control
- `sparkplug-payload@^1.0.3` — Standalone protobuf codec (no MQTT coupling)

---

## 2. npm Package Inventory

### Primary Libraries

| Package | Version | mqtt.js | TypeScript | Maintained | Status |
|---------|---------|---------|------------|------------|--------|
| `sparkplug-client` | 3.2.4 | **v2.16.0** (!) | No | Last: Sep 2023 | **DEAD** — spec violation, locked config |
| `@nortech/sparkplug-client` | 3.5.2 | **v5** | Compiled TS | Last: May 2025 | Fork — same locks, upgraded mqtt.js |
| `sparkplug-payload` | 1.0.3 | None | Has types | Stable (protobuf) | **KEEP** — standalone codec |
| `@jcoreio/sparkplug-payload` | 3.1.3 | None | Yes | Active | MIT-licensed rewrite, cleaner API |
| `mqtt` | 5.15.0 | N/A | **Native** | Days-old releases | **KEEP** — our MQTT transport |

### Sparkplug Ecosystem (Not Viable for Us)

| Package | Version | Notes |
|---------|---------|-------|
| `@vocovo/sparkplug-host-app` | 1.9.0 | Host Application via Redis, not an MQTT client |
| `tentacle-sparkplug-client` | 0.0.6 | Dead fork (5 years), v3.2.1 base |
| `jcoreio/sparkplug-client-js` | ? | 1 star, 4 open issues, abandoned |
| `node-red-contrib-mqtt-sparkplug-plus` | 2.1.11 | Node-RED specific, not a library |

### Key npm Links

- sparkplug-client: https://www.npmjs.com/package/sparkplug-client
- @nortech/sparkplug-client: https://www.npmjs.com/package/@nortech/sparkplug-client
- sparkplug-payload: https://www.npmjs.com/package/sparkplug-payload
- @jcoreio/sparkplug-payload: https://www.npmjs.com/package/@jcoreio/sparkplug-payload
- mqtt: https://www.npmjs.com/package/mqtt
- @vocovo/sparkplug-host-app: https://www.npmjs.com/package/@vocovo/sparkplug-host-app

---

## 3. Rust/Go Alternatives

### Rust Crates

| Crate | Version | Downloads | Notes |
|-------|---------|-----------|-------|
| `sparkplug-rs` | 0.5.1 | 18k all-time | Protobuf bindings only (like sparkplug-payload) |
| `srad` | 0.3.0 | ~3k each | Full SDK: srad-app, srad-client, srad-eon, srad-types. Uses rumqtt. |

### Go Libraries

| Library | Notes |
|---------|-------|
| `weekaung/sparkplugb-client` | Full client, Sparkplug v3.0 compliant |
| `christopherghenderson/sparkplugbProtobufGo` | Protobuf bindings only |

### Verdict

Not recommended for MVP. Consider `srad` via napi-rs if >100k msg/sec becomes a bottleneck.

**Crate links**:
- sparkplug-rs: https://crates.io/crates/sparkplug-rs
- srad: https://crates.io/crates/srad

---

## 4. Sparkplug B Spec Normative Requirements

**Source**: Sparkplug Specification v3.0.0 (Eclipse Foundation, Nov 2022)

### QoS Requirements by Message Type

| Message Type | QoS | Retain | Spec Language |
|-------------|-----|--------|---------------|
| **NBIRTH** | **MUST be 0** | **MUST be false** | Edge Node birth certificate |
| **DBIRTH** | **MUST be 0** | **MUST be false** | Device birth certificate |
| **NDATA** | 0 (implied) | false (implied) | Edge Node data |
| **DDATA** | 0 (implied) | false (implied) | Device data |
| **NDEATH (Will)** | **MUST be 1** | **MUST be false** | MQTT Will message, QoS 1 for delivery guarantee |
| **DDEATH** | 0 (not explicit) | false (not explicit) | Device death certificate |
| **NCMD** | **Sub QoS MUST be 1** | N/A | Command to Edge Node |
| **DCMD** | **Sub QoS MUST be 1** | N/A | Command to Device |
| **STATE** | 1 (implied) | **MUST be true** | **ONLY message requiring retain** |

### Clean Session / Clean Start

- **MQTT 3.1.1**: ALL Sparkplug clients MUST set `Clean Session = true`
- **MQTT 5.0**: ALL Sparkplug clients MUST set `Clean Start = true` and `Session Expiry Interval = 0`

### Will Message Requirements

- Edge Nodes MUST include a Will Message in CONNECT
- Will topic: `spBv1.0/{groupId}/NDEATH/{edgeNodeId}`
- Will payload: Sparkplug protobuf with `bdSeq` metric
- Will QoS: MUST be 1
- Will retain: MUST be false

### STATE Message Requirements

- Host Application Birth: JSON `{"online": true, "timestamp": <ms>}`
- Host Application Death (Will): JSON `{"online": false, "timestamp": <ms>}`
- Topic: `STATE/{hostId}`
- Retain: MUST be true
- This is the ONLY message type that requires retained messages

### QoS 0 Rationale (from Cirrus Link)

- QoS 1/2 messages persist on broker when subscriber offline — stale data risk in OT
- "In most OT control systems, you do not want old messages treated as live"
- REBIRTH mechanism compensates for QoS 0 data loss
- Sparkplug Store-and-Forward handles edge-side buffering

### Key Normative Statement

> "All non-STATE messages MUST be published on QoS 0 with retain = false.
> STATE messages MUST be published on QoS 1 with retain = true."

**sparkplug-client v3.2.4 VIOLATES the spec**: Will QoS hardcoded to 0 (spec says MUST be 1).

### Spec Documents

- Sparkplug 3.0.0 PDF: https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf
- Sparkplug 2.2 PDF: https://sparkplug.eclipse.org/specification/version/2.2/documents/sparkplug-specification-2.2.pdf
- Operational Behavior (source): https://github.com/eclipse-sparkplug/sparkplug/blob/master/specification/src/main/asciidoc/chapters/Sparkplug_5_Operational_Behavior.adoc
- Normative Statements: https://github.com/eclipse-sparkplug/sparkplug/blob/master/docs/normative_statements.md
- QoS 0 and Data Loss: https://docs.chariot.io/display/CLD80/Sparkplug%2C+QoS+0+and+Potential+Data+Loss

---

## 5. mqtt.js v5 Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| **Version** | 5.15.0 (Feb 2026) | Actively maintained, days-old releases |
| **TypeScript** | Native (rewritten in TS at v5.0.0) | No @types needed |
| **MQTT 3.1.1** | Full | Backward compatible |
| **MQTT 5.0** | Full | Clean Start, Session Expiry, Will Delay, User Properties, Topic Aliases |
| **Retained messages** | Per-publish `{ retain: true/false }` | Full control |
| **Will messages** | Full config including `willDelayInterval` | MQTT 5.0 Will Delay support |
| **QoS** | 0, 1, 2 per-publish/subscribe | Full control |
| **Clean session** | Configurable per connect | `clean` (3.1.1) or `cleanStart` + `sessionExpiryInterval` (5.0) |
| **Topic aliases** | Auto and manual | LRU strategy for automatic |
| **Binary payloads** | Buffer support | Required for Sparkplug protobuf |
| **Reconnect** | Built-in with backoff | Configurable |

**Key**: mqtt.js v5 gives us per-publish control over every MQTT option that sparkplug-client locks down.

**GitHub**: https://github.com/mqttjs/MQTT.js
**npm**: https://www.npmjs.com/package/mqtt

---

## 6. sparkplug-client Source Audit

**Audited by**: arch-sparkplug (Eclipse source), arch-nats-advocate (runtime behavior)

### File: `index.ts` (451 lines compiled to index.js)

**Connect options (lines 126-150)**:
```typescript
this.mqttOptions = {
  ...config.mqttOptions || {},   // user overrides spread FIRST
  clientId,                      // then OVERWRITTEN
  clean: true,                   // HARDCODED
  keepalive,
  reschedulePings: false,        // HARDCODED
  connectTimeout: 30000,         // HARDCODED
  username, password,
  will: {                        // HARDCODED — entire block
    topic: `spBv1.0/${groupId}/NDEATH/${edgeNode}`,
    payload: Buffer.from(encodedDeathPayload),
    qos: 0,                      // HARDCODED (SPEC VIOLATION — should be 1)
    retain: false,               // HARDCODED (correct per spec)
  }
};
```

**TypeScript Omit (index.d.ts:27)**:
```typescript
mqttOptions?: Omit<IClientOptions,
  'clientId' | 'clean' | 'keepalive' | 'reschedulePings' |
  'connectTimeout' | 'username' | 'password' | 'will'
>;
```

TypeScript type system PREVENTS passing `clean`, `will`, or `keepalive` overrides.

**Publish methods**: No explicit QoS/retain in any publish call:
```javascript
this.client.publish(topic, Buffer.from(this.encodePayload(p)));
// ↑ No third argument — mqtt.js defaults: { qos: 0, retain: false }
```

### What sparkplug-client provides (~70 lines of protocol logic)

| Feature | Lines | Complexity |
|---------|-------|-----------|
| bdSeq counter | ~10 | Trivial — one integer |
| seq counter (0-255 wrap) | ~5 | Trivial |
| Will payload construction | ~5 | Low |
| Topic construction | ~5/method | Pure string concatenation |
| NBIRTH bdSeq injection | ~3 | Array push |
| Payload compression (pako) | ~25 | Low |
| Auto-subscribe NCMD/DCMD | ~2 | Two subscribe calls |
| Message routing | ~15 | Topic parse + switch |

### What sparkplug-client does NOT do

- No alias registry management
- No metric type validation
- No topic parsing for incoming DDATA
- No STATE topic handling
- No reconnect state management beyond mqtt.js
- No configurable QoS/retain/clean
- No MQTT 5.0 features

---

## 7. Nortech Fork Analysis

**Package**: `@nortech/sparkplug-client@3.5.2`
**Publisher**: Nortech.ai (industrial data platform company)
**Last published**: May 2025

### What Changed (vs Eclipse v3.2.4)

| Change | Detail |
|--------|--------|
| mqtt.js upgrade | v4 → **v5** |
| Public exports | Added `decodePayload`, `decompressPayload` as public |
| Callback params | Added `cb` callback parameter to publish methods |

### What Did NOT Change

| Locked Setting | Still Hardcoded |
|---------------|-----------------|
| `clean: true` | Yes |
| Will `qos: 0` | Yes |
| Will `retain: false` | Yes |
| `Omit<>` on mqttOptions | Yes |
| Publish QoS/retain | Still no explicit options |

### Significance

Even a well-funded company (Nortech) that actively maintains a fork chose NOT to unlock the hardcoded MQTT settings. This suggests the Sparkplug community treats QoS 0 / no retain / clean sessions as axiomatic — which aligns with the spec's normative requirements.

**However**: The spec says Will QoS MUST be 1. Neither Eclipse nor Nortech fixed this.

### npm link

https://www.npmjs.com/package/@nortech/sparkplug-client

---

## 8. NATS MQTT Bridge Assessment

**Source**: arch-nats-advocate research (nats-only-sparkplug-proposal.md)

### Capabilities (NATS Server 2.9+)

| Feature | NATS Support | Notes |
|---------|-------------|-------|
| MQTT 3.1.1 | Yes | Built-in bridge |
| QoS 0 | Yes | Full support |
| QoS 1 | Yes | Via JetStream |
| Will messages | Yes (2.9+) | Fires on TCP disconnect |
| Retained messages | **No** | Not supported by NATS MQTT bridge |
| Clean session | Yes | Standard behavior |
| Binary payloads | Yes | Protobuf passes through |
| Topic wildcards | Yes | `+` and `#` supported |

### NATS-Only Viability for Sparkplug B

| Requirement | NATS Can Handle? | Notes |
|-------------|-----------------|-------|
| NBIRTH/DBIRTH (QoS 0, no retain) | **Yes** | Exact match |
| NDATA/DDATA (QoS 0, no retain) | **Yes** | Exact match |
| NDEATH Will (QoS 1, no retain) | **Probably** | Needs empirical verification |
| NCMD/DCMD (Sub QoS 1) | **Yes** | Via JetStream |
| STATE (QoS 1, retain=true) | **No** | Requires JetStream KV workaround |

### JetStream KV as Retained Message Substitute

For STATE messages (the only message needing retain), JetStream KV is arguably **superior**:
- History (not just last value)
- TTL expiration
- Watch() for real-time updates
- Key enumeration
- Better than MQTT retained for our use case

### Risk Areas

1. Will message reliability on NATS MQTT bridge — needs empirical testing
2. `.` in edge_node_ids creates extra NATS subject levels
3. MQTT 5.0 features not available (Will Delay, Topic Aliases)

### Full Plan

See: `thoughts/shared/plans/nats-only-sparkplug-proposal.md` (622 lines)

---

## 9. EMQX Assessment (Banked)

**Status**: Plans banked, not deleted. Deploy if third-party MQTT devices require full MQTT 5.0.

### When to Activate EMQX

- Third-party edge nodes that expect MQTT 5.0 broker features
- Need for broker-level retained message serving to late-joining subscribers
- NATS MQTT bridge empirical tests reveal blocking limitations
- Scale beyond NATS MQTT bridge capacity

### Full Plans

- EMQX infrastructure: `thoughts/shared/plans/emqx-broker-infrastructure-plan.md` (841 lines)
- Broker decomposition: `thoughts/shared/plans/broker-infra-decomposition.md`

---

## 10. External References

### Specifications

| Document | URL |
|----------|-----|
| Sparkplug 3.0.0 Spec (PDF) | https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf |
| Sparkplug 2.2 Spec (PDF) | https://sparkplug.eclipse.org/specification/version/2.2/documents/sparkplug-specification-2.2.pdf |
| Operational Behavior (AsciiDoc) | https://github.com/eclipse-sparkplug/sparkplug/blob/master/specification/src/main/asciidoc/chapters/Sparkplug_5_Operational_Behavior.adoc |
| Normative Statements | https://github.com/eclipse-sparkplug/sparkplug/blob/master/docs/normative_statements.md |
| Compatible Software List | https://sparkplug.eclipse.org/compatibility/compatible-software/ |

### Eclipse Tahu Project

| Resource | URL |
|----------|-----|
| Tahu GitHub (main) | https://github.com/eclipse-tahu/tahu |
| Tahu GitHub (mirror) | https://github.com/eclipse/tahu |
| Sparkplug Spec Repo | https://github.com/eclipse-sparkplug/sparkplug |
| Eclipse Project Page | https://projects.eclipse.org/projects/iot.tahu |
| Cirrus Link Sparkplug (original) | https://github.com/Cirrus-Link/Sparkplug |

### Technical Articles

| Article | URL |
|---------|-----|
| QoS 0 and Data Loss (Cirrus Link) | https://docs.chariot.io/display/CLD80/Sparkplug%2C+QoS+0+and+Potential+Data+Loss |
| EMQX Sparkplug B Docs | https://docs.emqx.com/en/emqx/latest/data-integration/sparkplug.html |
| HiveMQ Sparkplug Introduction | https://www.hivemq.com/blog/mqtt-sparkplug-essentials-part-1-introduction/ |
| HiveMQ Sparkplug Payload Structures | https://www.hivemq.com/blog/mqtt-payload-structures-iiot/ |
| Cedalo: Sparkplug on Mosquitto | https://cedalo.com/blog/mqtt-sparkplug-mosquitto/ |
| NATS MQTT Bridge Docs | https://docs.nats.io/running-a-nats-service/configuration/mqtt |
| mqtt.js MQTT 5.0 Upgrade | https://flespi.com/blog/mqttjs-client-library-upgraded-to-mqtt-5-standard |

### GitHub Issues (Sparkplug QoS Discussion)

| Issue | URL |
|-------|-----|
| QoS for Birth/Death (#107) | https://github.com/eclipse-sparkplug/sparkplug/issues/107 |
| Expand QoS Requirements (#22) | https://github.com/eclipse-sparkplug/sparkplug/issues/22 |

---

## 11. Tribal Knowledge & Community Consensus

### The Sparkplug Community Treats QoS 0 / No Retain / Clean Sessions as Axiomatic

Even Nortech.ai — a well-funded company that actively maintains a sparkplug-client fork and upgraded to mqtt.js v5 — chose NOT to unlock the hardcoded MQTT settings (retain, clean, will QoS). This is not oversight; it reflects community consensus that these values are protocol invariants, not configuration options.

**Evidence**:
- `@nortech/sparkplug-client@3.5.2` source: same `Omit<>` type and spread-then-overwrite pattern ([§7 Nortech Fork Analysis](#7-nortech-fork-analysis))
- `sparkplug-client@3.2.4` source: `index.ts` lines 126-150 ([§6 Source Audit](#6-sparkplug-client-source-audit))
- Sparkplug 3.0.0 spec, §5 Operational Behavior: normative QoS/retain requirements ([spec PDF](https://www.eclipse.org/tahu/spec/sparkplug_spec.pdf))
- Cirrus Link QoS rationale: https://docs.chariot.io/display/CLD80/Sparkplug%2C+QoS+0+and+Potential+Data+Loss

**Implication**: If we ever contribute upstream or interact with Sparkplug-compatible devices, our adapter should default to spec-compliant values. We make them *configurable* for testing, but *default to spec*.

### Nobody in the Sparkplug JS Ecosystem Has Needed Configurable Retain/Will/QoS

The npm package graveyard (tentacle-sparkplug-client, jcoreio/sparkplug-client-js) shows multiple attempts to fork sparkplug-client. None of them unlocked the MQTT parameter restrictions. The community simply doesn't need this — because the spec mandates the values.

**Evidence**:
- `tentacle-sparkplug-client@0.0.6`: fork of v3.2.1, last updated 5+ years ago, 2 dependents (https://www.npmjs.com/package/tentacle-sparkplug-client)
- `jcoreio/sparkplug-client-js`: 1 star, 4 open issues, abandoned (https://github.com/jcoreio/sparkplug-client-js)
- `@nortech/sparkplug-client@3.5.2`: active fork, upgraded mqtt.js but kept locks (https://www.npmjs.com/package/@nortech/sparkplug-client)
- npm search "sparkplug" yields no other client libraries ([§2 npm Package Inventory](#2-npm-package-inventory))

### The Spec Has an Internal Tension on Will QoS

- General rule: "All non-STATE messages MUST be QoS 0"
- Specific Will rule: "The Edge Node's MQTT Will Message's MQTT QoS MUST be 1"
- Both sparkplug-client (Eclipse) and @nortech/sparkplug-client chose QoS 0 for the Will
- The spec's normative statement for Will QoS 1 exists in the operational behavior chapter
- GitHub issue #107 discusses this tension — the community is aware but not aligned

**Evidence**:
- Sparkplug 3.0.0 spec, §5.3 (Operational Behavior): "The Edge Node's MQTT Will Message's MQTT QoS MUST be 1" ([AsciiDoc source](https://github.com/eclipse-sparkplug/sparkplug/blob/master/specification/src/main/asciidoc/chapters/Sparkplug_5_Operational_Behavior.adoc))
- sparkplug-client `index.ts:139`: `will: { qos: 0 }` — violates normative statement
- GitHub issue #107: https://github.com/eclipse-sparkplug/sparkplug/issues/107
- GitHub issue #22 (QoS expansion discussion): https://github.com/eclipse-sparkplug/sparkplug/issues/22

**Our position**: We implement Will QoS 1 (spec-compliant) but make it configurable so we can test both.

### STATE Messages Are the Only Retain Gate

The entire EMQX justification collapsed to a single message type: STATE. If we can handle STATE via JetStream KV (which is superior to MQTT retained for our use case), EMQX adds no value for our current architecture.

**Evidence**:
- Sparkplug 3.0.0 spec, §5.6: STATE messages "MUST be published with retain=true, QoS 1" ([§4 Spec Requirements](#4-sparkplug-b-spec-normative-requirements))
- All other message types explicitly MUST be `retain: false` (NBIRTH, DBIRTH, NDEATH per spec §5.3-5.5)
- arch-nats-advocate analysis: JetStream KV provides history, TTL, watch(), enumeration — superior to MQTT retained (see `thoughts/shared/plans/nats-only-sparkplug-proposal.md`, §4.1)
- NATS MQTT bridge docs confirm no retained message support: https://docs.nats.io/running-a-nats-service/configuration/mqtt

**When EMQX becomes necessary**: Third-party edge nodes that expect a standards-compliant MQTT 5.0 broker with native retained message serving. This is a future-state concern, not a current one.

### Sparkplug B Is a Subscribe-Side Protocol for Us

**Source**: Sparkplug 3.0.0 spec §3 (Architecture), arch-sparkplug plan analysis

We are building a **Sparkplug Application** (subscriber/consumer), NOT an **Edge Node** (publisher). This means:
- We receive NBIRTH/DBIRTH/DDATA/DDEATH from edge nodes
- We subscribe to `spBv1.0/+/+/+/+` wildcard patterns
- We MAY publish NCMD/DCMD commands (QoS 1 subscription)
- We MAY publish STATE messages (if acting as Primary Host Application)
- We do NOT publish BIRTH/DATA messages ourselves

This subscriber-side role simplifies our requirements — we don't need to manage Will messages for our own connection (that's the edge node's job). We just need to:
1. Subscribe to topics
2. Decode protobuf payloads
3. Build alias registries from BIRTH messages
4. Route decoded readings to our ingestion pipeline

### mqtt.js v5 Is the Only Viable MQTT Transport for TypeScript

There are no alternatives. mqtt.js has 8k+ GitHub stars, is maintained with days-old releases, is TypeScript-native since v5.0.0, and supports MQTT 5.0. Every other MQTT client for Node.js is either dead or a wrapper around mqtt.js.

**Evidence**:
- mqtt.js GitHub: https://github.com/mqttjs/MQTT.js (8k+ stars)
- npm: v5.15.0 published Feb 2026 (https://www.npmjs.com/package/mqtt)
- TypeScript rewrite announcement: v5.0.0 (July 2023) — https://flespi.com/blog/mqttjs-client-library-upgraded-to-mqtt-5-standard
- DeepWiki confirmation of MQTT 5.0 feature completeness (mqttjs/MQTT.js wiki, queried 2026-02-08)

### Store-and-Forward Is Not in the Sparkplug Spec

Cirrus Link's Store-and-Forward (rolling buffer, 2x keepalive window) is a proprietary extension, not part of the Sparkplug 3.0.0 specification. We should not assume other edge nodes implement it. Our adapter should handle message gaps via REBIRTH requests.

**Evidence**:
- Cirrus Link docs: "Rolling buffer functionality is not in the Sparkplug spec currently" (https://docs.chariot.io/display/CLD80/Sparkplug%2C+QoS+0+and+Potential+Data+Loss)
- Sparkplug 3.0.0 spec: no mention of Store-and-Forward in normative statements (https://github.com/eclipse-sparkplug/sparkplug/blob/master/docs/normative_statements.md)

### The Sparkplug Payload Format Is Stable

sparkplug-payload@1.0.3 uses protobufjs for Sparkplug B protobuf encoding. The protobuf schema is defined by the Sparkplug spec and hasn't changed since v3.0.0 (Nov 2022). This library is safe to depend on as a pure codec — it has no MQTT dependency and no behavior beyond encode/decode.

**Evidence**:
- sparkplug-payload npm: v1.0.3, no updates needed (https://www.npmjs.com/package/sparkplug-payload)
- Sparkplug 3.0.0 spec published Nov 2022, no payload format changes since
- sparkplug-payload source: `eclipse-tahu/tahu/javascript/core/sparkplug-payload/` — pure protobuf, no MQTT imports

---

## Cross-References

| Plan Document | Location | Contents |
|--------------|----------|----------|
| EMQX Infrastructure Plan | `thoughts/shared/plans/emqx-broker-infrastructure-plan.md` | 7-phase EMQX deployment (banked) |
| Sparkplug B Adapter Plan | `thoughts/shared/plans/sparkplug-b-plan.md` | Original adapter + revised fork plan |
| NATS-Only Proposal | `thoughts/shared/plans/nats-only-sparkplug-proposal.md` | Devil's advocate analysis |
| Broker Decomposition | `thoughts/shared/plans/broker-infra-decomposition.md` | V-model epic decomposition |
| WBS Tracker | `.claude/plans/enumerated-crafting-otter.md` | Epics 26-28 task tracking |
| This Index | `thoughts/shared/plans/sparkplug-b-reference-index.md` | You are here |

---

*Generated by Val — Vigilant Architecture Layer*
*Research team: oracle-sparkplug-landscape, arch-sparkplug, arch-nats-advocate*
*Date: 2026-02-08*
