# Research: MVR + SmartData Patterns for Manufacturing Commons

> **Date**: 2026-02-09
> **Context**: TMNL metropolitan-scale IIoT platform (Atlanta, GA) targeting 200K-organization manufacturing commons
> **Stack**: Sui blockchain (Move) + Chainlink oracles + NATS real-time + Effect-TS runtime

---

## Table of Contents

1. [Definition Clarification](#1-definition-clarification)
2. [Sui Move Registry (MVR)](#2-sui-move-registry-mvr)
3. [Chainlink SmartData + MVR Feeds](#3-chainlink-smartdata--mvr-feeds)
4. [Registry Architecture Patterns on Sui](#4-registry-architecture-patterns-on-sui)
5. [Verified Data & Attestation Patterns](#5-verified-data--attestation-patterns)
6. [Zero-Knowledge Manufacturing Proofs](#6-zero-knowledge-manufacturing-proofs)
7. [Integration Architecture](#7-integration-architecture)
8. [Recommendations](#8-recommendations)

---

## 1. Definition Clarification

The term "MVR" has **two distinct meanings** in the blockchain ecosystem, both relevant to the manufacturing commons:

| Term | Full Name | Domain | Purpose |
|------|-----------|--------|---------|
| **MVR** (Sui) | Move Registry | Sui/Move ecosystem | On-chain package registry for Move smart contracts |
| **MVR** (Chainlink) | Multiple-Variable Response | Chainlink SmartData | Bundled multi-field data feeds for tokenized RWAs |

**SmartData** is specifically a Chainlink product suite for verified on-chain data about real-world assets (reserves, NAV, AUM).

For the manufacturing commons, both are critical:
- **Sui MVR** provides the package registry and naming infrastructure for our Move modules
- **Chainlink MVR Feeds** provide the mechanism to publish bundled manufacturing data on-chain

---

## 2. Sui Move Registry (MVR)

### 2.1 What It Is

The Move Registry (MVR, pronounced "mover") is Sui's on-chain package management system, analogous to NPM for JavaScript or Crates.io for Rust. Built on top of SuiNS (Sui Name Service), it provides:

- **Human-readable naming**: `@deepbook/core` instead of `0x1a2b3c...`
- **Version resolution**: `@myorg/mypackage/2` pins to version 2
- **Trust signals**: Real on-chain usage data (not just download counts)
- **Dependency management**: Resolve dependencies by name across testnet/mainnet
- **Metadata linking**: Source code, documentation, audit reports attached to packages

### 2.2 Architecture

MVR uses a **two-layer design**:

```
Layer 1: PackageInfo Registration (per-network)
  - Created during package publish
  - Stores source code references, metadata
  - Indexed by Sui indexers
  - Proof of ownership via UpgradeCap

Layer 2: MVR Name Resolution (mainnet-only, single source of truth)
  - Maps human-readable names to PackageInfo objects
  - Format: <suins_name>/<pkg_name>
  - Versioning: optional /version suffix
  - Governed by SuiNS ownership
```

### 2.3 Registration Flow

```
1. Publish Move package on Sui
   -> Receive UpgradeCap (proof of ownership)

2. Create PackageInfo object
   -> Pass UpgradeCap to prove ownership
   -> Attach metadata (title, description, tags)

3. Register MVR name
   -> Requires SuiNS name (e.g., tmnl.sui)
   -> Creates AppRecord linking name -> PackageInfo
   -> Returns AppCap for future management

4. Associate across networks
   -> Mainnet: Full PackageInfo object
   -> Testnet: PackageInfo object ID pointer
```

### 2.4 Relevance to Manufacturing Commons

For a 200K-organization manufacturing commons, MVR provides:

| Use Case | MVR Pattern |
|----------|-------------|
| **Module discovery** | `@tmnl/commons-core`, `@tmnl/quality-oracle` |
| **Versioned contracts** | `@tmnl/equipment-registry/3` for breaking changes |
| **Trust signals** | Real usage data shows which packages manufacturers actually use |
| **Audit trails** | Audit reports linked directly to specific package versions |
| **Ecosystem interop** | Third-party integrations reference `@tmnl/*` by name |

**Example naming scheme for the commons:**

```
@tmnl/commons-core       -- Core identity, membership, governance
@tmnl/equipment-registry -- ISA-95 equipment hierarchy on-chain
@tmnl/quality-oracle     -- Quality metric verification
@tmnl/capability-index   -- Searchable manufacturing capabilities
@tmnl/order-settlement   -- Work order matching and settlement
@tmnl/smartdata-bridge   -- Chainlink SmartData integration
```

### 2.5 MVR CLI & SDK

```bash
# Add dependency by name
mvr add @tmnl/commons-core

# Resolve across networks
mvr resolve @tmnl/equipment-registry --network mainnet
mvr resolve @tmnl/equipment-registry --network testnet
```

TypeScript SDK (for PTBs):
```typescript
import { MVRPlugin } from '@mysten/mvr-plugin';

// Resolve MVR names in programmable transaction blocks
const tx = new Transaction();
tx.moveCall({
  target: '@tmnl/equipment-registry::register::create_equipment',
  arguments: [/* ... */],
});
// Plugin resolves @tmnl/equipment-registry to actual address
```

**Sources:**
- [Announcing the Move Registry (MVR)](https://blog.sui.io/announcing-move-registry-interoperability/)
- [SuiNS MVR Documentation](https://docs.suins.io/move-registry)
- [MVR GitHub Repository](https://github.com/MystenLabs/mvr)
- [Move Package Registry](https://www.moveregistry.com/)

---

## 3. Chainlink SmartData + MVR Feeds

### 3.1 SmartData Suite Overview

Chainlink SmartData is a suite of verified on-chain data products for tokenized real-world assets. It provides:

| Product | Purpose | Data |
|---------|---------|------|
| **Proof of Reserve** | Verify asset backing | Reserve balances, collateral |
| **SmartNAV / NAVLink** | Net Asset Value feeds | Fund/portfolio valuations |
| **SmartAUM** | Assets Under Management | Total managed value |
| **MVR Feeds** | Multi-field data bundles | Arbitrary typed data bundles |

### 3.2 MVR Feeds (Multiple-Variable Response)

Unlike traditional Chainlink feeds that return a single numeric value, MVR feeds **bundle multiple data points of various types** into a single on-chain update. This is the key primitive for manufacturing data.

**Architecture:**

```
Off-Chain Data Source (manufacturing sensors, ERP, MES)
    |
    v
Chainlink DON (Decentralized Oracle Network)
    |
    v
BundleAggregatorProxy Contract (on-chain)
    |
    v
Consumer Contract (reads bundled data)
```

**Core Interface:**

```solidity
interface IBundleAggregatorProxy {
    // Returns the complete data bundle as bytes
    function latestBundle() external view returns (bytes memory);

    // Returns decimal places for each numeric field
    function bundleDecimals() external view returns (uint8[] memory);

    // Returns when the data was last updated
    function latestBundleTimestamp() external view returns (uint256);
}
```

**Data Decoding Pattern:**

```solidity
// Define the expected data structure
struct ManufacturingMetrics {
    uint256 totalOutputUnits;     // Production volume
    uint256 defectRate;           // Parts per million (PPM)
    uint256 oeePercentage;        // Overall Equipment Effectiveness
    string  complianceStandard;   // e.g., "ISO 9001:2015"
    bool    auditCurrent;         // Is latest audit valid?
    uint256 lastAuditTimestamp;   // When last audited
}

// Decode the bundle
function readManufacturingData(address feedAddress) external view {
    bytes memory bundleData = IBundleAggregatorProxy(feedAddress).latestBundle();
    ManufacturingMetrics memory metrics = abi.decode(bundleData, (ManufacturingMetrics));
    // Use metrics...
}
```

### 3.3 Manufacturing SmartData Use Cases

| SmartData Type | Manufacturing Application |
|---------------|--------------------------|
| **Proof of Reserve** | Verify raw material inventory backing production commitments |
| **SmartNAV** | Real-time valuation of work-in-progress inventory |
| **SmartAUM** | Total manufacturing capacity under management |
| **MVR Feed** | Bundled quality metrics (OEE, defect rate, cycle time, compliance status) |

### 3.4 Custom SmartData for Manufacturing

The key insight: Chainlink's SmartData architecture can be extended for **manufacturing-specific verified data products**:

```
SmartQuality: Verified quality metrics per production line
  - Defect rate (PPM)
  - First-pass yield
  - Statistical process control (SPC) status
  - Compliance certificate hash

SmartCapacity: Verified production capacity
  - Available machine hours
  - Current utilization %
  - Lead time estimates
  - Material availability

SmartCompliance: Verified regulatory status
  - ISO certification status
  - Last audit date
  - Non-conformance count
  - Corrective action status
```

### 3.5 Limitations

- MVR feeds **only store the most recent data on-chain** -- historical data requires off-chain indexing
- ISO 27001 + SOC 2 Type 1 certification covers Chainlink Data Feeds (institutional-grade security)
- CCIP does **not yet support Sui natively** (Solana was first non-EVM chain in 2025)

**Sources:**
- [Chainlink SmartData Documentation](https://docs.chain.link/data-feeds/smartdata)
- [MVR Feeds Documentation](https://docs.chain.link/data-feeds/mvr-feeds)
- [SmartData Feed Addresses](https://docs.chain.link/data-feeds/smartdata/addresses)
- [Chainlink Quarterly Review Q3 2025](https://blog.chain.link/quarterly-review-q3-2025/)

---

## 4. Registry Architecture Patterns on Sui

### 4.1 Sui Object Model for Registries

Sui's object-centric model provides unique advantages for registry design:

```
Owned Objects      -- Single owner, fast path (no consensus)
Shared Objects     -- Multiple writers, consensus required
Dynamic Fields     -- Heterogeneous key-value storage on any object
Dynamic Object Fields -- Same, but values are first-class objects
Wrapped Objects    -- Objects stored inside other objects
```

### 4.2 Manufacturing Registry Design

```move
module tmnl::equipment_registry {
    use sui::object::{Self, UID};
    use sui::dynamic_field;
    use sui::transfer;
    use sui::tx_context::TxContext;

    /// The global equipment registry (shared object)
    struct EquipmentRegistry has key {
        id: UID,
        total_registered: u64,
    }

    /// An individual equipment record (owned by manufacturer)
    struct EquipmentRecord has key, store {
        id: UID,
        manufacturer_id: address,
        isa95_level: u8,        // 0=Enterprise..6=Device
        equipment_type: vector<u8>,
        capability_hash: vector<u8>, // Merkle root of capabilities
        last_attestation: u64,       // Epoch of last verification
    }

    /// Capability attestation (attached as dynamic field)
    struct CapabilityAttestation has store, drop {
        capability_type: vector<u8>,  // e.g., "5-axis-cnc"
        verified_by: address,         // Attestor address
        verified_at: u64,             // Epoch
        proof_hash: vector<u8>,       // ZK proof or audit hash
    }

    /// Register new equipment
    public fun register_equipment(
        registry: &mut EquipmentRegistry,
        isa95_level: u8,
        equipment_type: vector<u8>,
        ctx: &mut TxContext,
    ): EquipmentRecord {
        registry.total_registered = registry.total_registered + 1;

        EquipmentRecord {
            id: object::new(ctx),
            manufacturer_id: tx_context::sender(ctx),
            isa95_level,
            equipment_type,
            capability_hash: vector::empty(),
            last_attestation: 0,
        }
    }

    /// Attach a capability attestation
    public fun attest_capability(
        record: &mut EquipmentRecord,
        capability_type: vector<u8>,
        proof_hash: vector<u8>,
        ctx: &TxContext,
    ) {
        let attestation = CapabilityAttestation {
            capability_type: copy capability_type,
            verified_by: tx_context::sender(ctx),
            verified_at: tx_context::epoch(ctx),
            proof_hash,
        };
        dynamic_field::add(&mut record.id, capability_type, attestation);
    }
}
```

### 4.3 Registry Patterns Comparison

| Pattern | Sui Primitive | Use Case |
|---------|--------------|----------|
| **Global Registry** | Shared object + dynamic fields | Equipment registry, capability index |
| **Per-Org Registry** | Owned object + dynamic fields | Manufacturer's equipment portfolio |
| **Credential Registry** | Dynamic object fields | Verifiable credentials per entity |
| **Name Registry** | SuiNS/MVR | Human-readable naming for entities |
| **Derived Objects** | `sui::derive` | Deterministic addressing for registry entries |

### 4.4 Derived Objects for Registries

Sui's derived objects provide registry-like uniqueness without a central bottleneck:

```
Each (parent_id, key) pair -> deterministic object address
```

This means:
- No shared object contention for lookups
- Registry entries can be accessed directly by address
- Key-value uniqueness guaranteed by the protocol

**Sources:**
- [Sui Dynamic Fields](https://docs.sui.io/concepts/dynamic-fields)
- [Sui Derived Objects](https://docs.sui.io/concepts/sui-move-concepts/derived-objects)
- [Sui Object Model](https://docs.sui.io/guides/developer/objects/object-model)

---

## 5. Verified Data & Attestation Patterns

### 5.1 Attestation Landscape

| Framework | Chain | Approach | Relevance |
|-----------|-------|----------|-----------|
| **EAS** (Ethereum Attestation Service) | EVM chains | Schema-based attestations | Gold standard for general attestations |
| **Nautilus** | Sui | TEE-based verifiable off-chain computation | Proves computation integrity |
| **Chainlink PoR** | Multi-chain | Oracle-verified reserves | Inventory/asset backing |
| **Custom (Move)** | Sui | Native object attestations | Manufacturing-specific attestations |

### 5.2 Sui Nautilus for Manufacturing

Nautilus is Sui's framework for **secure verifiable off-chain computation** using Trusted Execution Environments (TEEs):

```
Sensor Data (NATS) -> TEE Enclave (Nautilus) -> Attestation Object (Sui)
```

Use cases for manufacturing:
- **Process verification**: Run quality algorithms in TEE, publish verified results on-chain
- **Privacy-preserving analytics**: Compute metrics without exposing raw sensor data
- **Audit computation**: Prove compliance calculations were performed correctly

```
Flow:
1. Raw sensor readings arrive via NATS
2. Nautilus TEE processes readings (SPC, OEE calculation)
3. TEE produces cryptographic attestation of computation
4. Attestation published as Sui object
5. Smart contracts verify attestation before accepting results
```

### 5.3 EAS-Equivalent on Sui

While Sui lacks a direct EAS equivalent, we can build one using Sui's object model:

```move
module tmnl::attestation_service {
    use sui::object::{Self, UID};

    /// Schema definition (like EAS SchemaRecord)
    struct AttestationSchema has key, store {
        id: UID,
        schema_name: vector<u8>,
        schema_definition: vector<u8>, // JSON Schema or ABI encoding
        resolver: address,             // Optional resolver module
        revocable: bool,
    }

    /// An attestation instance
    struct Attestation has key, store {
        id: UID,
        schema_id: address,           // References AttestationSchema
        subject: address,              // Who/what is being attested
        attester: address,             // Who is attesting
        data: vector<u8>,              // Encoded attestation data
        timestamp: u64,
        expiration: u64,               // 0 = no expiration
        revoked: bool,
    }
}
```

### 5.4 Proof of Provenance for Manufacturing Data

End-to-end data integrity from sensor to settlement:

```
LAYER 1: Sensor (hardware root of trust)
  - TPM-signed readings
  - Device attestation key

LAYER 2: Edge Gateway (NATS broker)
  - Merkle tree of reading batches
  - Batch roots published to Sui

LAYER 3: Processing (Nautilus TEE)
  - Verified computation of quality metrics
  - Attestation of correct algorithm execution

LAYER 4: On-Chain (Sui)
  - Merkle roots stored in objects
  - Attestation objects reference computation proofs
  - Smart contracts enforce provenance chain

LAYER 5: Oracle (Chainlink)
  - SmartData feeds aggregate verified metrics
  - MVR bundles expose multi-field quality data
  - Cross-chain via CCIP (when Sui supported)
```

**Sources:**
- [Ethereum Attestation Service](https://attest.org/)
- [Sui Nautilus Documentation](https://docs.sui.io/concepts/cryptography/nautilus)
- [Nautilus Announcement](https://blog.sui.io/nautilus-tamper-proof-oracles/)

---

## 6. Zero-Knowledge Manufacturing Proofs

### 6.1 Privacy-Preserving Verification

ZK proofs enable manufacturers to prove capabilities without revealing proprietary details:

| Claim | What's Proven | What's Hidden |
|-------|--------------|---------------|
| "I can do 5-axis CNC" | Machine capability exists | Machine model, cost, location |
| "Defect rate < 0.1%" | Statistical threshold met | Actual rate, production volume |
| "ISO 9001 certified" | Valid certification exists | Audit details, non-conformances |
| "Capacity available" | Can fulfill order specs | Current utilization, other orders |
| "Material sourced ethically" | Supply chain compliant | Supplier identities, costs |

### 6.2 Implementation Approach

```
Groth16/PLONK Circuit (off-chain)
  |
  v
ZK Proof Generation
  |
  v
Proof Verification (on-chain, Sui Move)
  |
  v
Attestation Object (with proof reference)
```

Sui supports elliptic curve operations needed for ZK verification. A manufacturing ZK circuit would:

1. Take private inputs (actual production data)
2. Take public inputs (claimed thresholds)
3. Produce a proof that private data satisfies public constraints
4. On-chain verifier confirms proof validity

### 6.3 Practical ZK Use Cases

**Quality Gate**: "My defect rate is below your threshold"
```
Private: actual_defect_rate = 0.03%
Public:  threshold = 0.1%
Proof:   actual_defect_rate < threshold (without revealing 0.03%)
```

**Capacity Match**: "I can fulfill this order"
```
Private: available_hours = 2400, machine_count = 12
Public:  required_hours = 1800, min_machines = 8
Proof:   capacity >= requirements (without revealing exact numbers)
```

**Compliance Range**: "My metrics are within spec"
```
Private: [tolerance_actual, surface_finish, hardness]
Public:  [tolerance_spec, finish_spec, hardness_spec]
Proof:   all_within_range (without revealing actual measurements)
```

---

## 7. Integration Architecture

### 7.1 Full Stack Data Flow

```
                    ┌─────────────────────────────────────────────────┐
                    │               MANUFACTURING FLOOR               │
                    │                                                 │
                    │  Sensors ──> NATS ──> Effect-TS Processing      │
                    │                          │                      │
                    │                    ┌─────┴──────┐               │
                    │                    │             │               │
                    └────────────────────┼─────────────┼───────────────┘
                                        │             │
                              ┌─────────▼──┐    ┌─────▼──────────┐
                              │  Nautilus   │    │   Chainlink    │
                              │  TEE        │    │   DON          │
                              │  (compute)  │    │   (oracle)     │
                              └──────┬──────┘    └──────┬─────────┘
                                     │                  │
                    ┌────────────────┼──────────────────┼──────────┐
                    │                │    SUI BLOCKCHAIN │          │
                    │                ▼                   ▼          │
                    │     ┌──────────────────┐  ┌──────────────┐   │
                    │     │ Attestation      │  │ SmartData    │   │
                    │     │ Objects          │  │ MVR Feeds    │   │
                    │     └────────┬─────────┘  └──────┬───────┘   │
                    │              │                    │           │
                    │              ▼                    ▼           │
                    │     ┌──────────────────────────────────────┐  │
                    │     │  Manufacturing Commons Contracts      │  │
                    │     │  (@tmnl/commons-core via MVR)         │  │
                    │     │                                       │  │
                    │     │  - Equipment Registry                 │  │
                    │     │  - Capability Index                   │  │
                    │     │  - Quality Verification               │  │
                    │     │  - Order Matching & Settlement        │  │
                    │     │  - Reputation & Governance            │  │
                    │     └──────────────────────────────────────┘  │
                    │                                              │
                    └──────────────────────────────────────────────┘
```

### 7.2 Component Integration Matrix

| Component | Role | Integrates With |
|-----------|------|-----------------|
| **NATS** | Real-time sensor transport | Effect-TS (ingestion), Nautilus (input) |
| **Effect-TS** | Service orchestration, stream processing | NATS (subscribe), Sui SDK (publish), Chainlink (read) |
| **Sui MVR** | Package naming & discovery | All Move modules, TypeScript SDK |
| **Sui Objects** | On-chain state, registries | Attestations, equipment records |
| **Nautilus** | Verifiable off-chain computation | NATS data (input), Sui objects (output) |
| **Chainlink DON** | Oracle consensus, data verification | Sensor data (input), SmartData feeds (output) |
| **Chainlink MVR** | Multi-field data bundles | Quality metrics, compliance bundles |
| **Chainlink PoR** | Reserve verification | Material inventory, capacity backing |
| **ZK Proofs** | Privacy-preserving verification | Capability claims, compliance proofs |

### 7.3 End-to-End Flow: Sensor Reading to Verified SmartData

```
1. SENSOR READING
   Sensor emits temperature reading via Sparkplug-B
   -> NATS topic: spBv1.0/site-123/DDATA/line-1/sensor-42

2. EFFECT-TS PROCESSING
   IngestionService receives via SparkplugAdapter
   -> ReadingProcessor validates, enriches
   -> AlarmDetector checks thresholds
   -> EventDistribution broadcasts via ChannelService

3. BATCH AGGREGATION
   Effect-TS aggregates readings into time-windowed batches
   -> Compute Merkle root of batch
   -> Forward batch to Nautilus TEE

4. NAUTILUS VERIFICATION
   TEE computes quality metrics (OEE, SPC, defect rate)
   -> Signs computation result with TEE attestation
   -> Publishes attestation object to Sui

5. CHAINLINK ORACLE
   DON nodes independently verify metrics
   -> Aggregate via decentralized consensus
   -> Publish as SmartData MVR feed

6. ON-CHAIN SETTLEMENT
   Quality metrics available as verified SmartData
   -> Order matching contracts read MVR feeds
   -> Settlement triggered when quality gates pass
   -> Reputation updated based on verified performance

7. MARKETPLACE SIGNAL
   Verified SmartData visible to commons participants
   -> Buyers discover capable manufacturers
   -> ZK proofs protect proprietary details
   -> Trust built through on-chain verification history
```

### 7.4 Effect-TS Integration Points

```typescript
// Reading Chainlink SmartData from Sui
import { Effect, Stream } from 'effect'
import { SuiClient } from '@mysten/sui/client'

// Service for reading verified manufacturing data
class ManufacturingSmartData extends Effect.Service<ManufacturingSmartData>()
  ('ManufacturingSmartData', {
    effect: Effect.gen(function* () {
      const sui = yield* SuiService

      return {
        // Read latest quality metrics for a manufacturer
        getQualityMetrics: (manufacturerId: string) =>
          Effect.gen(function* () {
            const attestation = yield* sui.getObject({
              id: manufacturerId,
              options: { showContent: true },
            })
            // Decode attestation data...
            return attestation
          }),

        // Subscribe to real-time quality updates
        streamQualityUpdates: (registryId: string) =>
          Stream.async<QualityMetric>((emit) => {
            // Subscribe to Sui events for quality attestations
            // Bridge to Effect Stream
          }),
      }
    }),
  }) {}
```

### 7.5 Chainlink CCIP Consideration

**Current status (2026-02):** Chainlink CCIP does NOT yet support Sui natively. Solana was the first non-EVM chain added (2025).

**Bridge strategy:**
- **Short term**: Use EVM-compatible L2 as Chainlink bridge (Sui <-> EVM via Wormhole, then EVM <-> Chainlink)
- **Medium term**: Monitor Chainlink Sui integration announcements
- **Long term**: Native CCIP on Sui would enable direct SmartData feeds and cross-chain messaging

**Workaround for SmartData on Sui:**
- Custom Chainlink-style oracle network on Sui using Nautilus TEEs
- Node operators run Nautilus enclaves that verify manufacturing data
- Results published as Sui objects with TEE attestation
- Not as decentralized as full DON, but verifiable

---

## 8. Recommendations

### 8.1 Architecture Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Package management** | Adopt Sui MVR naming convention | `@tmnl/*` namespace for all commons modules |
| **Quality verification** | Nautilus TEE + custom attestation service | No native EAS on Sui; Nautilus provides verifiable computation |
| **Data feeds** | Design for Chainlink MVR feed compatibility | Bundle manufacturing metrics for eventual Chainlink integration |
| **Privacy** | ZK proofs for sensitive capability claims | Protect proprietary data while enabling trust |
| **Cross-chain** | EVM bridge short-term, native CCIP long-term | Chainlink Sui support not yet available |
| **Registry pattern** | Shared objects + dynamic fields + derived addressing | Balances throughput with composability |

### 8.2 MVR Naming Convention

```
@tmnl/commons-core          -- Membership, governance, identity
@tmnl/equipment-registry    -- ISA-95 hierarchy on-chain
@tmnl/capability-index      -- Searchable manufacturing capabilities
@tmnl/quality-oracle        -- Quality metric verification circuits
@tmnl/order-protocol        -- Work order matching and settlement
@tmnl/smartdata-bridge      -- Chainlink SmartData integration layer
@tmnl/attestation-service   -- EAS-equivalent for manufacturing claims
@tmnl/reputation-engine     -- Performance tracking and scoring
@tmnl/zkp-verifiers         -- ZK proof verification modules
```

### 8.3 SmartData Schema Design

Define manufacturing-specific MVR bundle schemas:

```
SmartQuality Bundle:
  - oee_percentage: uint256 (2 decimals)
  - defect_rate_ppm: uint256
  - first_pass_yield: uint256 (4 decimals)
  - spc_status: uint8 (0=unknown, 1=in_control, 2=warning, 3=out_of_control)
  - compliance_hash: bytes32
  - measurement_timestamp: uint256

SmartCapacity Bundle:
  - available_hours_weekly: uint256
  - current_utilization_pct: uint256 (2 decimals)
  - lead_time_days: uint256
  - material_availability: bool
  - machine_count: uint256
  - measurement_timestamp: uint256
```

### 8.4 Implementation Priority

| Phase | Work | Dependencies |
|-------|------|-------------|
| **Phase A** | Register `tmnl.sui` SuiNS name, set up MVR namespace | Sui mainnet access |
| **Phase B** | Build Equipment Registry + Capability Index (Move) | Phase A |
| **Phase C** | Build custom Attestation Service (Move) | Phase B |
| **Phase D** | Integrate Nautilus TEE for quality verification | Phase C |
| **Phase E** | Design SmartData-compatible MVR bundle schemas | Phase C |
| **Phase F** | Build ZK circuits for privacy-preserving claims | Phase D |
| **Phase G** | Chainlink integration (when Sui CCIP available) | Phase E |
| **Phase H** | Full marketplace with verified SmartData feeds | Phase F + G |

### 8.5 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chainlink never adds Sui CCIP | Low (30%) | High | Custom oracle network via Nautilus |
| MVR naming conflicts | Low (15%) | Low | Register early, monitor namespace |
| ZK proof performance on Sui | Medium (40%) | Medium | Start with simpler attestations, add ZK later |
| Nautilus TEE availability | Medium (35%) | High | Fallback to standard oracle pattern |
| 200K org scale on shared objects | Medium (40%) | High | Derived objects + sharding pattern |

---

## Appendix A: Key Sources

### Sui MVR
- [Move Registry Announcement](https://blog.sui.io/announcing-move-registry-interoperability/)
- [SuiNS MVR Documentation](https://docs.suins.io/move-registry)
- [MVR CLI Documentation](https://docs.suins.io/move-registry/tooling/mvr-cli)
- [MVR GitHub](https://github.com/MystenLabs/mvr)
- [moveregistry.com](https://www.moveregistry.com/)

### Chainlink SmartData
- [SmartData Product Page](https://chain.link/smartdata)
- [SmartData Documentation](https://docs.chain.link/data-feeds/smartdata)
- [MVR Feeds Documentation](https://docs.chain.link/data-feeds/mvr-feeds)
- [Proof of Reserve](https://chain.link/proof-of-reserve)
- [SmartCon 2025 Recap](https://blog.chain.link/smartcon-2025-recap/)

### Sui Architecture
- [Sui Dynamic Fields](https://docs.sui.io/concepts/dynamic-fields)
- [Sui Derived Objects](https://docs.sui.io/concepts/sui-move-concepts/derived-objects)
- [Sui Nautilus](https://docs.sui.io/concepts/cryptography/nautilus)

### Attestation & ZKP
- [Ethereum Attestation Service](https://attest.org/)
- [Cloudflare ZK Web Attestation](https://blog.cloudflare.com/introducing-zero-knowledge-proofs-for-private-web-attestation-with-cross-multi-vendor-hardware/)
- [IoT Data Integrity via Blockchain (IEEE)](https://ieeexplore.ieee.org/document/8421150/)

### RWA on Sui
- [R25 rcUSD on Sui](https://blog.sui.io/r25-rwa-assets-rcusd-rcusdp/)
- [Sui + Ant Digital Technologies](https://cryptoslate.com/press-releases/sui-partners-with-ant-digital-technologies-on-its-rwa-project/)
- [RWA Analytics](https://app.rwa.xyz/networks/sui)

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **MVR** (Sui) | Move Registry -- on-chain package management for Move modules |
| **MVR** (Chainlink) | Multiple-Variable Response -- multi-field data feed bundles |
| **SmartData** | Chainlink's verified RWA data product suite |
| **SmartNAV** | Chainlink NAV (Net Asset Value) feed for tokenized assets |
| **SmartAUM** | Chainlink AUM (Assets Under Management) feed |
| **PoR** | Proof of Reserve -- oracle-verified reserve/inventory backing |
| **SuiNS** | Sui Name Service -- human-readable naming on Sui |
| **PackageInfo** | Sui object storing metadata for a published Move package |
| **AppRecord** | MVR mapping from name to PackageInfo |
| **AppCap** | Capability object for managing MVR name registrations |
| **UpgradeCap** | Sui capability proving ownership of a published package |
| **Nautilus** | Sui's TEE-based verifiable off-chain computation framework |
| **DON** | Decentralized Oracle Network (Chainlink) |
| **CCIP** | Cross-Chain Interoperability Protocol (Chainlink) |
| **TEE** | Trusted Execution Environment |
| **ZKP** | Zero-Knowledge Proof |
| **EAS** | Ethereum Attestation Service |
| **OEE** | Overall Equipment Effectiveness |
| **SPC** | Statistical Process Control |
| **PPM** | Parts Per Million (defect measurement) |
