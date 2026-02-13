# Research: Sui Object Ownership Model for Manufacturing Commons

**Date:** 2026-02-09
**Scope:** Objects Owning Objects, iNFTs, Expirable Leases, Kiosk Marketplace
**Context:** TMNL 200K-org Manufacturing Commons DePIN -- Sui Ownership Layer

---

## Table of Contents

1. [Sui Object Ownership Deep-Dive](#1-sui-object-ownership-deep-dive)
2. [ISA-95 Hierarchy as Sui Object Tree](#2-isa-95-hierarchy-as-sui-object-tree)
3. [Objects Owning Objects: Three Composition Patterns](#3-objects-owning-objects-three-composition-patterns)
4. [Transfer to Object and the Receiving Type](#4-transfer-to-object-and-the-receiving-type)
5. [iNFT Architecture for Manufacturing Digital Twins](#5-inft-architecture-for-manufacturing-digital-twins)
6. [Expirable Lease Patterns](#6-expirable-lease-patterns)
7. [Kiosk Marketplace Integration](#7-kiosk-marketplace-integration)
8. [Complete Move Module Examples](#8-complete-move-module-examples)
9. [Integration Architecture: NATS + Effect-TS + Sui](#9-integration-architecture-nats--effect-ts--sui)
10. [Gas Analysis and Optimization](#10-gas-analysis-and-optimization)
11. [Design Decisions and Trade-offs](#11-design-decisions-and-trade-offs)

---

## 1. Sui Object Ownership Deep-Dive

### 1.1 Object Model Fundamentals

Every piece of on-chain state in Sui is an **object** with a globally unique 32-byte ID. Objects are not stored in account-based key-value stores (like Ethereum); instead, they exist as first-class citizens in a global object store.

Every Sui Move object requires:
- The `key` ability
- A first field of type `id: UID`

```move
public struct MyObject has key {
    id: UID,
    // ... fields
}
```

Each object carries:
| Component | Size | Purpose |
|-----------|------|---------|
| ID | 32 bytes | Globally unique, stable across transfers/wrapping |
| Owner | 32 bytes | Determines transaction access |
| Version | 8 bytes | Monotonically increments on mutation |
| Tx Digest | 32 bytes | Hash of last modifying transaction |
| Contents | Variable | BCS-encoded payload |

### 1.2 Five Ownership Types

| Type | Description | Consensus? | Latency |
|------|-------------|------------|---------|
| **Address-Owned** | Single address controls the object | No (fastpath) | Low |
| **Object-Owned** | Another object controls this object | No (fastpath) | Low |
| **Shared** | Accessible to all, consensus-sequenced | Yes | Higher |
| **Immutable** | Frozen forever, universally readable | No | Lowest |
| **Wrapped** | Nested inside another struct, no independent existence | Inherits parent | Inherits parent |

**Key insight for manufacturing:** Address-owned and object-owned objects use the fastpath (no consensus needed), making them ideal for high-throughput asset hierarchies where a single organization controls the tree. Shared objects are needed when multiple organizations must interact with the same asset (e.g., marketplace listings, shared equipment).

### 1.3 Object ID Stability

An object's ID is **permanent** -- it never changes regardless of:
- Transfer between addresses
- Wrapping inside another object
- Attachment as a dynamic field
- Unwrapping back to independence

This is critical for manufacturing: a Machine NFT minted on day one retains its ID through its entire lifecycle of transfers, rentals, and ownership changes.

---

## 2. ISA-95 Hierarchy as Sui Object Tree

### 2.1 ISA-95 Mapping

The ISA-95 standard defines a 6-level manufacturing hierarchy. Each level maps naturally to a Sui object that **owns** its children:

```
ISA-95 Level          Sui Object Pattern
============          ==================

Enterprise            EnterpriseNFT (shared object -- multi-org visibility)
  |
  +-- Site            SiteNFT (object-owned by Enterprise)
       |
       +-- Area       AreaNFT (object-owned by Site)
            |
            +-- Line  LineNFT (object-owned by Area)
                 |
                 +-- Machine  MachineNFT / iNFT (object-owned by Line)
                      |
                      +-- Sensor  SensorNFT (object-owned by Machine)
```

### 2.2 ASCII Hierarchy Diagram

```
+------------------------------------------------------------------+
|                    ENTERPRISE (Shared Object)                     |
|  id: 0xENT001                                                    |
|  owner: <shared>                                                 |
|  admin_cap: AdminCap held by org wallet                          |
|                                                                  |
|  Dynamic Object Fields:                                          |
|  +-- "site.PHX" --> SiteNFT (0xSITE01)                          |
|  |                    |                                          |
|  |                    +-- "area.CNC" --> AreaNFT (0xAREA01)      |
|  |                    |                    |                     |
|  |                    |                    +-- "line.L1" -->     |
|  |                    |                    |   LineNFT (0xLINE01)|
|  |                    |                    |     |               |
|  |                    |                    |     +-- "mach.M1"-->|
|  |                    |                    |     |   MachineINFT |
|  |                    |                    |     |     |         |
|  |                    |                    |     |     +--sensor |
|  |                    |                    |     |               |
|  |                    |                    |     +-- "mach.M2"-->|
|  |                    |                    |         MachineINFT |
|  |                    |                    |                     |
|  |                    |                    +-- "line.L2" -->     |
|  |                    |                        LineNFT (0xLINE02)|
|  |                    |                                          |
|  |                    +-- "area.WELD" --> AreaNFT (0xAREA02)     |
|  |                                                               |
|  +-- "site.ATL" --> SiteNFT (0xSITE02)                          |
+------------------------------------------------------------------+
```

### 2.3 Why Dynamic Object Fields (Not Wrapping)

| Criterion | Wrapped Objects | Dynamic Fields | Dynamic Object Fields |
|-----------|----------------|----------------|----------------------|
| Child accessible by ID? | No | No | **Yes** |
| Child visible in explorers? | No | No | **Yes** |
| Heterogeneous children? | Via Option/Vector | **Yes** | **Yes** |
| Parent can grow dynamically? | No (fixed at compile) | **Yes** | **Yes** |
| Gas on access | All children loaded | Only accessed child | Only accessed child |
| Child retains identity? | ID preserved but hidden | No independent ID | **Yes, fully queryable** |

**Decision: Dynamic Object Fields** are the correct pattern for the ISA-95 hierarchy because:
1. Each child asset (Machine, Sensor) must be independently queryable by external tools (dashboards, explorers, wallets)
2. The hierarchy grows dynamically (new machines added to lines over time)
3. Gas cost scales with access, not tree size -- accessing one Machine doesn't load all siblings
4. Children retain their object IDs for cross-referencing with off-chain systems (NATS topics, Effect-TS entities)

### 2.4 Transfer Semantics for Hierarchy

When transferring an object, **all its dynamic object field children move with it**. This means:

- Selling a `SiteNFT` transfers the entire site including all areas, lines, machines, and sensors
- The buyer receives the complete sub-tree
- All object IDs remain stable

**Can a Machine be transferred between Organizations?** Yes, but it requires:
1. Detaching the Machine from its current Line via `dynamic_object_field::remove`
2. Transferring the Machine to the new Line via `dynamic_object_field::add` on the destination
3. Both the source Line owner and destination Line owner must authorize

This is by design: moving equipment between organizations is a significant operation that should require explicit authorization from both parties.

---

## 3. Objects Owning Objects: Three Composition Patterns

### 3.1 Pattern 1: Direct Wrapping

An object contains another object as a direct struct field.

```move
public struct SwapEscrow has key {
    id: UID,
    owner: address,
    machine: MachineNFT,  // Machine is WRAPPED inside escrow
    fee: Balance<SUI>,
}
```

**Characteristics:**
- Machine becomes invisible to external tools
- Cannot be extracted without destroying the SwapEscrow
- Strong encapsulation guarantees
- Best for: Escrow, swap contracts, temporary custody

**Manufacturing use case:** Equipment trade escrow -- machine is locked in escrow during a sale negotiation, invisible to the market until the trade completes or cancels.

### 3.2 Pattern 2: Dynamic Fields

Store any value with `store` ability as a named child. The child is wrapped (not independently accessible).

```move
use sui::dynamic_field as df;

// Add maintenance record to machine
df::add<vector<u8>, MaintenanceRecord>(
    &mut machine.id,
    b"maintenance_2026_01_15",
    MaintenanceRecord { ... }
);

// Read maintenance record
let record = df::borrow<vector<u8>, MaintenanceRecord>(
    &machine.id,
    b"maintenance_2026_01_15"
);
```

**Characteristics:**
- Name can be any `copy + drop + store` type (strings, integers, custom structs)
- Values with `store` but not `key` are stored as wrapped fields
- Heterogeneous: different fields can have different value types
- Best for: Metadata accumulation, internal state, private records

**Manufacturing use case:** Machine maintenance logs, calibration data, internal quality metrics -- data that doesn't need independent on-chain identity.

### 3.3 Pattern 3: Dynamic Object Fields

Store objects (with `key + store`) as named children. The child **retains its ID** and remains queryable.

```move
use sui::dynamic_object_field as dof;

// Add sensor to machine
dof::add<vector<u8>, SensorNFT>(
    &mut machine.id,
    b"sensor_temp_001",
    sensor_nft
);

// Borrow sensor immutably
let sensor = dof::borrow<vector<u8>, SensorNFT>(
    &machine.id,
    b"sensor_temp_001"
);

// Remove sensor (detach from machine)
let sensor = dof::remove<vector<u8>, SensorNFT>(
    &mut machine.id,
    b"sensor_temp_001"
);
```

**Characteristics:**
- Child retains its `UID` and is visible to explorers/wallets
- Can be queried by ID without traversing the parent
- Supports ownership transfer (detach from parent A, attach to parent B)
- Best for: Hierarchical ownership, composable assets, publicly visible children

**Manufacturing use case:** The ISA-95 hierarchy itself -- Sites own Areas, Areas own Lines, Lines own Machines, Machines own Sensors. Every level is independently queryable.

### 3.4 Collections: Table, Bag, ObjectTable, ObjectBag

For managing collections of children, Sui provides wrapper types over dynamic fields:

| Collection | Key Type | Value Type | Value Visible by ID? |
|------------|----------|------------|---------------------|
| `Table<K, V>` | Homogeneous | Homogeneous, `store` | No |
| `Bag` | Heterogeneous | Heterogeneous, `store` | No |
| `ObjectTable<K, V>` | Homogeneous | Homogeneous, `key + store` | **Yes** |
| `ObjectBag` | Heterogeneous | Heterogeneous, `key + store` | **Yes** |

**Manufacturing recommendation:**
- `ObjectTable<String, MachineINFT>` for a Line's machines (homogeneous, queryable)
- `ObjectBag` for heterogeneous equipment collections
- `Table<String, MaintenanceRecord>` for internal logs (not queryable)

---

## 4. Transfer to Object and the Receiving Type

### 4.1 Overview

Launched on Sui mainnet in January 2024, **Transfer to Object** allows sending objects to other objects (not just addresses). Since Sui object IDs and address IDs are both 32 bytes, the same `transfer::transfer` function works for both.

### 4.2 The `Receiving<T>` Type

```move
// Definition (in sui::transfer)
public struct Receiving<phantom T: key> has drop {
    id: ID,
    version: u64,
}
```

`Receiving<T>` is:
- **Ephemeral**: Only exists within a transaction, cannot be stored on-chain
- **Non-obligatory**: You can choose to use or ignore it in a PTB
- **Type-safe**: Parameterized by the object type being received

### 4.3 Core Receive Functions

**Module-restricted receive:**
```move
// Only callable from the module defining T
public native fun receive<T: key>(
    parent: &mut UID,
    object: Receiving<T>
): T;
```

**Public receive (for objects with `store`):**
```move
// Callable from any module
public native fun public_receive<T: key + store>(
    parent: &mut UID,
    object: Receiving<T>
): T;
```

### 4.4 Access Control Matrix

| Child Has | Parent Module Controls | Child Module Controls |
|-----------|----------------------|----------------------|
| `key` only | Yes (via `&mut UID`) | Yes (via `transfer::receive`) |
| `key + store` | Yes (via `&mut UID`) | No (`public_receive` bypasses) |

### 4.5 Manufacturing Use Cases

**Work Order delivery to Machine:**
```move
// A work order is sent TO a machine object
transfer::transfer(work_order, object::id_to_address(&machine_id));

// The machine's module defines how to receive it
public fun receive_work_order(
    machine: &mut MachineINFT,
    work_order: Receiving<WorkOrder>,
): WorkOrder {
    transfer::receive(&mut machine.id, work_order)
}
```

**Sensor data attestation sent TO a Machine:**
```move
// Off-chain oracle attests sensor reading, sends to machine
transfer::transfer(attestation, object::id_to_address(&machine_id));

// Machine's module receives and records it
public fun receive_attestation(
    machine: &mut MachineINFT,
    att: Receiving<SensorAttestation>,
) {
    let attestation = transfer::receive(&mut machine.id, att);
    // Add to machine's intelligence via dynamic field
    df::add(&mut machine.id, attestation.timestamp, attestation);
    machine.attestation_count = machine.attestation_count + 1;
}
```

---

## 5. iNFT Architecture for Manufacturing Digital Twins

### 5.1 What is an iNFT?

An **intelligent NFT (iNFT)** is an NFT that accumulates on-chain intelligence over time. Unlike static NFTs that represent a fixed asset, iNFTs **evolve** as new data is recorded to them.

Pioneered by Alethea AI on Ethereum, the iNFT architecture consists of:
- **Body**: The base NFT (the physical asset representation)
- **Soul**: Personality/capability traits (configuration, specifications)
- **Mind**: Accumulated intelligence (operational history, computed metrics)

### 5.2 Manufacturing iNFT: The Machine Digital Twin

A Machine iNFT is the on-chain digital twin of a physical machine. It accumulates intelligence through dynamic fields that grow as the machine operates:

```
+------------------------------------------------------------------+
|                     MachineINFT (0xMACH01)                       |
|                                                                  |
|  BODY (Static Fields):                                           |
|    manufacturer: "Haas Automation"                               |
|    model: "VF-2SS"                                               |
|    serial: "HF-23-8847"                                          |
|    commissioned: 1706140800000  (2024-01-25)                     |
|    isa95_level: MACHINE                                          |
|                                                                  |
|  SOUL (Capability Fields):                                       |
|    max_rpm: 12000                                                |
|    axes: 3                                                       |
|    tool_capacity: 24                                             |
|    certifications: [AS9100, ISO_9001]                            |
|                                                                  |
|  MIND (Dynamic Fields -- Accumulated Intelligence):              |
|    Dynamic Fields:                                               |
|      "ops.total_hours" --> 14,237                                |
|      "ops.total_jobs" --> 8,492                                  |
|      "ops.uptime_pct" --> 94.7                                   |
|      "quality.defect_rate" --> 0.0023                            |
|      "quality.precision_score" --> 98.2                          |
|      "maint.last_service" --> 1738886400000                      |
|      "maint.next_scheduled" --> 1741564800000                    |
|      "maint.total_events" --> 47                                 |
|      "reputation.reliability" --> 97.1                           |
|      "reputation.on_time_delivery" --> 99.3                      |
|                                                                  |
|    Dynamic Object Fields (Queryable Records):                    |
|      "work_order.WO-2026-0847" --> WorkOrderRecord              |
|      "work_order.WO-2026-0848" --> WorkOrderRecord              |
|      "maintenance.SVC-2026-012" --> MaintenanceRecord            |
|      "sensor.TEMP-001" --> SensorNFT                             |
|      "sensor.VIB-001" --> SensorNFT                              |
|      "calibration.CAL-2026-03" --> CalibrationRecord             |
+------------------------------------------------------------------+
```

### 5.3 Intelligence Accumulation Model

Each operational event adds a record to the Machine iNFT:

| Event | Storage | Field Key | Queryable? |
|-------|---------|-----------|-----------|
| Job completed | Dynamic field | `"ops.total_jobs"` | Via parent |
| Quality measurement | Dynamic field | `"quality.defect_rate"` | Via parent |
| Work order completed | Dynamic object field | `"work_order.{id}"` | **Yes, by ID** |
| Maintenance performed | Dynamic object field | `"maintenance.{id}"` | **Yes, by ID** |
| Calibration certified | Dynamic object field | `"calibration.{id}"` | **Yes, by ID** |
| Sensor attached | Dynamic object field | `"sensor.{id}"` | **Yes, by ID** |

**Aggregate metrics** (total hours, defect rate, reliability score) are stored as plain dynamic fields -- they're frequently updated counters that don't need independent identity.

**Individual records** (work orders, maintenance events, calibrations) are stored as dynamic object fields -- they have their own IDs, can be queried independently, and serve as tamper-proof audit records.

### 5.4 iNFT as Provenance

When Earl sells his CNC machine, the buyer sees the **entire on-chain history**:

1. **Immutable operational record**: Every work order, maintenance event, and calibration is a dynamic object field that cannot be altered or deleted
2. **Computed reputation**: Aggregate scores derived from the immutable records
3. **No faking**: You cannot retroactively add "good" records or erase "bad" ones -- each record was cryptographically signed by the attesting party at the time of creation
4. **Portability**: The machine's full history travels WITH the NFT when it's transferred

### 5.5 AI Integration Path

On-chain data feeds ML models for predictive maintenance:

```
NATS (real-time sensor data)
    |
    v
Effect-TS ReadingProcessor
    |
    v
SuiBridgeService (periodic attestation)
    |
    v
MachineINFT dynamic fields updated
    |
    v
Off-chain ML model reads on-chain history
    |
    v
Predictive maintenance score written back
    via attested oracle transaction
```

The on-chain data provides a **verifiable training dataset** for ML models. Since all records are immutable and attested, the resulting predictions carry provenance guarantees that traditional databases cannot match.

### 5.6 Comparison with Existing iNFT Projects

| Project | Chain | Focus | Manufacturing Relevance |
|---------|-------|-------|------------------------|
| **Alethea AI** | Ethereum | AI-powered conversational characters | Architecture pattern (Body/Soul/Mind) |
| **SingularityNET** | Ethereum/Cardano | Decentralized AI marketplace | AI service integration model |
| **TWN Labs** | Multi-chain | Identity-native AI twins | Digital identity framework |
| **TMNL (proposed)** | **Sui** | **Manufacturing digital twins** | **Full ISA-95 hierarchy + operational intelligence** |

Sui's dynamic fields give TMNL a significant advantage over Ethereum-based iNFTs:
- Ethereum iNFTs store intelligence in external contracts (expensive cross-contract calls)
- Sui iNFTs store intelligence **directly on the object** (single object access, no cross-contract calls)
- Sui's object model means the intelligence IS the object, not a reference to it

---

## 6. Expirable Lease Patterns

### 6.1 Sui Clock Fundamentals

Sui provides on-chain time through the `sui::clock::Clock` module:

- **Singleton object** at address `0x6`
- **Function**: `timestamp_ms(clock: &Clock): u64` returns milliseconds since Unix epoch
- **Immutable reference only**: Transactions pass `&Clock`, never `&mut Clock`
- **No consensus contention**: Read-only access means Clock doesn't create bottlenecks
- **Testing support**: `create_for_testing()`, `set_for_testing()`, `increment_for_testing()`

```move
use sui::clock::Clock;

public fun is_expired(lease: &Lease, clock: &Clock): bool {
    clock.timestamp_ms() >= lease.expiration_ms
}
```

### 6.2 Expirable Lease Architecture

A **lease** is a Sui object that grants time-bounded access to a resource. After the expiration timestamp, the lease becomes unusable.

```
+------------------------------------------+
|            CapacityLease                  |
|  id: UID                                 |
|  machine_id: ID        (which machine)   |
|  lessee: address        (who holds it)   |
|  hours_granted: u64     (40 hours)       |
|  hours_used: u64        (12 hours)       |
|  start_ms: u64          (lease start)    |
|  expiration_ms: u64     (lease end)      |
|  price_per_hour: u64    (SUI per hour)   |
|  status: u8             (ACTIVE/EXPIRED) |
+------------------------------------------+
```

### 6.3 Lease Lifecycle

```
MINT --> ACTIVATE --> EXERCISE --> EXPIRE
  |                     |           |
  |                     |           +--> RECLAIM (owner reclaims)
  |                     |
  |                     +--> RENEW (extend expiration)
  |
  +--> REVOKE (early termination, possible penalty)
```

**States:**
1. **Mint**: Creator creates lease with expiration, price, and capacity
2. **Activate**: Lessee purchases/receives the lease
3. **Exercise**: Lessee uses hours against the lease (checked against Clock)
4. **Expire**: `clock.timestamp_ms() >= expiration_ms` -- lease becomes unusable
5. **Renew**: New transaction extends `expiration_ms` (requires payment)
6. **Revoke**: Owner or admin terminates early (penalty mechanism)
7. **Reclaim**: Owner recovers the lease object after expiration

### 6.4 Manufacturing Lease Use Cases

| Use Case | Lease Type | Duration | Key Fields |
|----------|-----------|----------|------------|
| **Machine-hour lease** | CapacityLease | 1 week | hours_granted, machine_id |
| **Data access lease** | DataAccessLease | 30 days | machine_id, data_scope |
| **Certification lease** | CertificationLease | 3 years | cert_type (AS9100), issuer |
| **Trial access** | TrialLease | 30 days | org_id, feature_scope |
| **Equipment rental** | RentalLease | Variable | machine_id, insurance_deposit |
| **Marketplace listing** | ListingLease | 90 days | kiosk_id, listing_type |
| **Subscription** | SubscriptionLease | 30 days (recurring) | tier, auto_renew flag |

### 6.5 DeFi Composability of Leases

Leases are Sui objects, which means they can participate in DeFi:

- **Trading**: Leases with `key + store` can be listed on Kiosk marketplaces
- **Subleasing**: A lease holder creates a sub-lease (new object) that references the parent lease, with a shorter duration
- **Collateral**: A lease can be locked in a DeFi protocol as collateral for borrowing
- **Bundling**: Multiple leases can be composed into a "capacity bundle" via PTBs
- **Fractional leases**: A 40-hour lease can be split into 4x 10-hour sub-leases

### 6.6 Epoch-Based vs Timestamp-Based Expiration

| Method | Granularity | Consensus Required? | Use Case |
|--------|-------------|--------------------|----|
| `Clock::timestamp_ms()` | Milliseconds | Yes (shared object) | Precise expiration |
| `tx_context::epoch()` | ~24 hours | No (fastpath) | Approximate expiration |
| `tx_context::epoch_timestamp_ms()` | ~24 hours precision | No (fastpath) | Low-latency + approximate |

**Recommendation**: Use `Clock::timestamp_ms()` for leases requiring precise expiration (machine-hour leases, real-time access). Use `epoch()` for long-duration leases (certifications, subscriptions) where 24-hour granularity is acceptable and fastpath execution is preferred.

---

## 7. Kiosk Marketplace Integration

### 7.1 Kiosk Architecture for Manufacturing

Sui Kiosk is a native framework for decentralized commerce. For TMNL, each organization has a Kiosk listing their capabilities and available capacity:

```
+------------------------------------------------------------------+
|                    Earl's Machine Shop Kiosk                      |
|  id: 0xKIOSK_EARL                                                |
|  owner: 0xEARL_WALLET                                            |
|  cap: KioskOwnerCap (held by Earl)                               |
|                                                                  |
|  Listed Items:                                                   |
|    CapacityLease{machine: VF-2SS, 40hrs, $85/hr} -- LISTED      |
|    CapacityLease{machine: ST-10Y, 20hrs, $120/hr} -- LISTED     |
|    MachineINFT{VF-2} -- PLACED (not for sale, just showcased)    |
|                                                                  |
|  Proceeds: 12,500 SUI (from past sales)                         |
+------------------------------------------------------------------+
```

### 7.2 TransferPolicy for Compliance

TransferPolicy enforces rules on every trade. For manufacturing:

```move
// Creator defines TransferPolicy for CapacityLease type
// Rules include:
//   1. Royalty: 2% to TMNL commons treasury
//   2. ITAR check: Buyer must hold ITARClearance certificate
//   3. Minimum trade size: At least 10 hours per lease
//   4. Certification verification: Buyer org must hold valid AS9100
```

**Key TransferPolicy rules for manufacturing:**

| Rule | Purpose | Enforcement |
|------|---------|-------------|
| **Royalty** | Commons treasury fee (1-5%) | Automatic on every trade |
| **ITAR restriction** | Defense manufacturing compliance | Buyer must present ITARClearance object |
| **Certification gate** | Quality assurance | Buyer org must hold valid certification lease |
| **Minimum quantity** | Prevent micro-trades | Minimum hours/units per lease |
| **Geographic restriction** | Export control | Buyer address must be in approved jurisdiction list |
| **Cooling period** | Anti-speculation | Time delay between purchase and re-listing |

### 7.3 Kiosk Asset States

| State | Description | Manufacturing Context |
|-------|-------------|----------------------|
| **PLACED** | In kiosk, can be withdrawn | Machine showcased but not for sale |
| **LOCKED** | Cannot withdraw, can list | Machine committed to marketplace |
| **LISTED** | For sale at fixed price | Capacity lease available for purchase |
| **LISTED EXCLUSIVELY** | Listed via extension | Auction for premium capacity |

### 7.4 Purchase Flow

```
1. Buyer discovers CapacityLease via ItemListed event
2. Buyer calls kiosk::purchase(kiosk, item_id, payment)
3. Returns: (CapacityLease, TransferRequest)
4. Buyer must satisfy TransferRequest:
   a. Pay 2% royalty to commons treasury
   b. Present ITARClearance (if defense work)
   c. Present valid CertificationLease
5. confirm_request(policy, request)
6. Buyer receives CapacityLease
```

### 7.5 Rental Extension for Equipment

Sui's NFT Rental example provides the pattern for time-bounded equipment access without ownership transfer:

```
+----------------------------------------------------+
|  Rental Flow for Machine Time                      |
|                                                    |
|  1. Owner places MachineINFT in Kiosk              |
|  2. Owner installs Rentables extension             |
|  3. Owner lists machine for rent:                  |
|     - Price: 85 SUI/day                            |
|     - Min duration: 1 day                          |
|     - Max duration: 30 days                        |
|  4. Renter pays for 5 days (425 SUI)               |
|  5. MachineINFT wrapped in Rentable<MachineINFT>   |
|  6. Renter gets reference access (borrow)          |
|  7. After 5 days: owner calls reclaim()            |
|     (Clock check: current_time > start + duration) |
|  8. MachineINFT returns to owner's Kiosk           |
+----------------------------------------------------+
```

---

## 8. Complete Move Module Examples

### 8.1 Manufacturing Hierarchy Module

```move
module tmnl::manufacturing_hierarchy {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_object_field as dof;
    use sui::dynamic_field as df;
    use sui::event;
    use std::string::String;

    // ============================================================
    // Error Codes
    // ============================================================

    const E_NOT_AUTHORIZED: u64 = 0;
    const E_CHILD_ALREADY_EXISTS: u64 = 1;
    const E_CHILD_NOT_FOUND: u64 = 2;

    // ============================================================
    // Capability
    // ============================================================

    /// Admin capability for an organization's hierarchy
    public struct OrgAdminCap has key, store {
        id: UID,
        enterprise_id: ID,
    }

    // ============================================================
    // ISA-95 Asset Types
    // ============================================================

    public struct EnterpriseNFT has key, store {
        id: UID,
        name: String,
        org_wallet: address,
        site_count: u64,
    }

    public struct SiteNFT has key, store {
        id: UID,
        name: String,
        enterprise_id: ID,
        location: String,
        area_count: u64,
    }

    public struct AreaNFT has key, store {
        id: UID,
        name: String,
        site_id: ID,
        area_type: String, // "CNC", "WELDING", "ASSEMBLY"
        line_count: u64,
    }

    public struct LineNFT has key, store {
        id: UID,
        name: String,
        area_id: ID,
        machine_count: u64,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct SiteAdded has copy, drop {
        enterprise_id: ID,
        site_id: ID,
        name: String,
    }

    public struct AreaAdded has copy, drop {
        site_id: ID,
        area_id: ID,
        name: String,
    }

    public struct LineAdded has copy, drop {
        area_id: ID,
        line_id: ID,
        name: String,
    }

    // ============================================================
    // Enterprise Operations
    // ============================================================

    /// Create a new enterprise and its admin capability
    public fun create_enterprise(
        name: String,
        ctx: &mut TxContext,
    ): (EnterpriseNFT, OrgAdminCap) {
        let enterprise = EnterpriseNFT {
            id: object::new(ctx),
            name,
            org_wallet: tx_context::sender(ctx),
            site_count: 0,
        };
        let cap = OrgAdminCap {
            id: object::new(ctx),
            enterprise_id: object::id(&enterprise),
        };
        (enterprise, cap)
    }

    /// Share the enterprise (makes it accessible to all)
    public fun share_enterprise(enterprise: EnterpriseNFT) {
        transfer::share_object(enterprise);
    }

    // ============================================================
    // Site Operations
    // ============================================================

    /// Add a site to an enterprise (requires admin cap)
    public fun add_site(
        enterprise: &mut EnterpriseNFT,
        cap: &OrgAdminCap,
        name: String,
        location: String,
        ctx: &mut TxContext,
    ) {
        assert!(cap.enterprise_id == object::id(enterprise), E_NOT_AUTHORIZED);

        let site = SiteNFT {
            id: object::new(ctx),
            name,
            enterprise_id: object::id(enterprise),
            location,
            area_count: 0,
        };

        let site_id = object::id(&site);
        dof::add(&mut enterprise.id, name, site);
        enterprise.site_count = enterprise.site_count + 1;

        event::emit(SiteAdded {
            enterprise_id: object::id(enterprise),
            site_id,
            name,
        });
    }

    /// Borrow a site immutably
    public fun borrow_site(
        enterprise: &EnterpriseNFT,
        name: String,
    ): &SiteNFT {
        dof::borrow(&enterprise.id, name)
    }

    /// Borrow a site mutably
    public fun borrow_site_mut(
        enterprise: &mut EnterpriseNFT,
        cap: &OrgAdminCap,
        name: String,
    ): &mut SiteNFT {
        assert!(cap.enterprise_id == object::id(enterprise), E_NOT_AUTHORIZED);
        dof::borrow_mut(&mut enterprise.id, name)
    }

    // ============================================================
    // Area Operations
    // ============================================================

    /// Add an area to a site
    public fun add_area(
        site: &mut SiteNFT,
        name: String,
        area_type: String,
        ctx: &mut TxContext,
    ) {
        let area = AreaNFT {
            id: object::new(ctx),
            name,
            site_id: object::id(site),
            area_type,
            line_count: 0,
        };

        let area_id = object::id(&area);
        dof::add(&mut site.id, name, area);
        site.area_count = site.area_count + 1;

        event::emit(AreaAdded {
            site_id: object::id(site),
            area_id,
            name,
        });
    }

    /// Borrow an area
    public fun borrow_area(site: &SiteNFT, name: String): &AreaNFT {
        dof::borrow(&site.id, name)
    }

    public fun borrow_area_mut(site: &mut SiteNFT, name: String): &mut AreaNFT {
        dof::borrow_mut(&mut site.id, name)
    }

    // ============================================================
    // Line Operations
    // ============================================================

    /// Add a line to an area
    public fun add_line(
        area: &mut AreaNFT,
        name: String,
        ctx: &mut TxContext,
    ) {
        let line = LineNFT {
            id: object::new(ctx),
            name,
            area_id: object::id(area),
            machine_count: 0,
        };

        let line_id = object::id(&line);
        dof::add(&mut area.id, name, line);
        area.line_count = area.line_count + 1;

        event::emit(LineAdded {
            area_id: object::id(area),
            line_id,
            name,
        });
    }

    public fun borrow_line(area: &AreaNFT, name: String): &LineNFT {
        dof::borrow(&area.id, name)
    }

    public fun borrow_line_mut(area: &mut AreaNFT, name: String): &mut LineNFT {
        dof::borrow_mut(&mut area.id, name)
    }
}
```

### 8.2 Machine iNFT Module

```move
module tmnl::machine_inft {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field as df;
    use sui::dynamic_object_field as dof;
    use sui::clock::Clock;
    use sui::event;
    use std::string::String;

    // ============================================================
    // Error Codes
    // ============================================================

    const E_NOT_OWNER: u64 = 0;
    const E_INVALID_ATTESTATION: u64 = 1;

    // ============================================================
    // Machine iNFT (Body + Soul)
    // ============================================================

    public struct MachineINFT has key, store {
        id: UID,
        // Body -- static identity
        manufacturer: String,
        model: String,
        serial_number: String,
        commissioned_ms: u64,
        // Soul -- capabilities
        max_rpm: u64,
        axes: u8,
        tool_capacity: u8,
        // Mind -- aggregate intelligence (frequently updated)
        total_hours: u64,
        total_jobs: u64,
        defect_rate_bps: u64,    // basis points (23 = 0.23%)
        reliability_score: u64,   // 0-10000 (9710 = 97.10%)
        attestation_count: u64,
        last_service_ms: u64,
    }

    // ============================================================
    // Intelligence Records (stored as dynamic object fields)
    // ============================================================

    public struct WorkOrderRecord has key, store {
        id: UID,
        machine_id: ID,
        order_id: String,
        completed_ms: u64,
        parts_produced: u64,
        defects_found: u64,
        operator: address,
    }

    public struct MaintenanceRecord has key, store {
        id: UID,
        machine_id: ID,
        service_id: String,
        performed_ms: u64,
        service_type: String,    // "PREVENTIVE", "CORRECTIVE", "PREDICTIVE"
        technician: address,
        notes: String,
    }

    public struct CalibrationRecord has key, store {
        id: UID,
        machine_id: ID,
        calibration_id: String,
        performed_ms: u64,
        standard_used: String,
        passed: bool,
        certifier: address,
    }

    public struct SensorAttestation has key, store {
        id: UID,
        machine_id: ID,
        sensor_type: String,
        timestamp_ms: u64,
        value_scaled: u64,      // fixed-point value
        attester: address,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct IntelligenceUpdated has copy, drop {
        machine_id: ID,
        update_type: String,
        new_total_jobs: u64,
        new_reliability: u64,
    }

    public struct WorkOrderCompleted has copy, drop {
        machine_id: ID,
        order_id: String,
        parts_produced: u64,
    }

    // ============================================================
    // Mint
    // ============================================================

    public fun mint(
        manufacturer: String,
        model: String,
        serial_number: String,
        max_rpm: u64,
        axes: u8,
        tool_capacity: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ): MachineINFT {
        MachineINFT {
            id: object::new(ctx),
            manufacturer,
            model,
            serial_number,
            commissioned_ms: clock.timestamp_ms(),
            max_rpm,
            axes,
            tool_capacity,
            total_hours: 0,
            total_jobs: 0,
            defect_rate_bps: 0,
            reliability_score: 10000, // starts at 100%
            attestation_count: 0,
            last_service_ms: 0,
        }
    }

    // ============================================================
    // Intelligence Accumulation
    // ============================================================

    /// Record a completed work order (adds intelligence)
    public fun record_work_order(
        machine: &mut MachineINFT,
        order_id: String,
        parts_produced: u64,
        defects_found: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = WorkOrderRecord {
            id: object::new(ctx),
            machine_id: object::id(machine),
            order_id,
            completed_ms: clock.timestamp_ms(),
            parts_produced,
            defects_found,
            operator: tx_context::sender(ctx),
        };

        // Store as dynamic object field (queryable by ID)
        dof::add(&mut machine.id, order_id, record);

        // Update aggregate intelligence
        machine.total_jobs = machine.total_jobs + 1;

        // Recalculate defect rate (weighted moving average)
        let total_parts = machine.total_jobs * 100; // approximate
        if (total_parts > 0) {
            machine.defect_rate_bps = (defects_found * 10000) / parts_produced;
        };

        event::emit(WorkOrderCompleted {
            machine_id: object::id(machine),
            order_id,
            parts_produced,
        });

        event::emit(IntelligenceUpdated {
            machine_id: object::id(machine),
            update_type: std::string::utf8(b"work_order"),
            new_total_jobs: machine.total_jobs,
            new_reliability: machine.reliability_score,
        });
    }

    /// Record a maintenance event
    public fun record_maintenance(
        machine: &mut MachineINFT,
        service_id: String,
        service_type: String,
        notes: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = MaintenanceRecord {
            id: object::new(ctx),
            machine_id: object::id(machine),
            service_id,
            performed_ms: clock.timestamp_ms(),
            service_type,
            technician: tx_context::sender(ctx),
            notes,
        };

        dof::add(&mut machine.id, service_id, record);
        machine.last_service_ms = clock.timestamp_ms();
    }

    /// Record a calibration
    public fun record_calibration(
        machine: &mut MachineINFT,
        calibration_id: String,
        standard_used: String,
        passed: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = CalibrationRecord {
            id: object::new(ctx),
            machine_id: object::id(machine),
            calibration_id,
            performed_ms: clock.timestamp_ms(),
            standard_used,
            passed,
            certifier: tx_context::sender(ctx),
        };

        dof::add(&mut machine.id, calibration_id, record);

        // Calibration failure impacts reliability
        if (!passed) {
            if (machine.reliability_score > 100) {
                machine.reliability_score = machine.reliability_score - 100; // -1%
            };
        };
    }

    /// Update operational hours (called periodically by oracle)
    public fun update_hours(
        machine: &mut MachineINFT,
        additional_hours: u64,
    ) {
        machine.total_hours = machine.total_hours + additional_hours;
    }

    // ============================================================
    // Read Intelligence
    // ============================================================

    public fun get_reliability(machine: &MachineINFT): u64 {
        machine.reliability_score
    }

    public fun get_total_jobs(machine: &MachineINFT): u64 {
        machine.total_jobs
    }

    public fun get_defect_rate(machine: &MachineINFT): u64 {
        machine.defect_rate_bps
    }

    public fun get_total_hours(machine: &MachineINFT): u64 {
        machine.total_hours
    }
}
```

### 8.3 Capacity Lease Module

```move
module tmnl::capacity_lease {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::string::String;

    // ============================================================
    // Error Codes
    // ============================================================

    const E_LEASE_EXPIRED: u64 = 0;
    const E_INSUFFICIENT_HOURS: u64 = 1;
    const E_INSUFFICIENT_PAYMENT: u64 = 2;
    const E_NOT_LESSEE: u64 = 3;
    const E_NOT_LESSOR: u64 = 4;
    const E_LEASE_STILL_ACTIVE: u64 = 5;
    const E_ALREADY_REVOKED: u64 = 6;

    // Status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_EXPIRED: u8 = 1;
    const STATUS_REVOKED: u8 = 2;
    const STATUS_EXHAUSTED: u8 = 3;

    // ============================================================
    // Lease Types
    // ============================================================

    /// Capacity lease: grants time-bounded access to machine hours
    public struct CapacityLease has key, store {
        id: UID,
        machine_id: ID,
        lessor: address,
        lessee: address,
        hours_granted: u64,
        hours_used: u64,
        start_ms: u64,
        expiration_ms: u64,
        price_per_hour_mist: u64,
        status: u8,
        deposit: Balance<SUI>,
    }

    /// Data access lease: grants time-bounded read access to machine data
    public struct DataAccessLease has key, store {
        id: UID,
        machine_id: ID,
        grantor: address,
        grantee: address,
        data_scope: String,      // "quality", "operations", "all"
        start_ms: u64,
        expiration_ms: u64,
        status: u8,
    }

    /// Certification lease: represents a time-bounded certification
    public struct CertificationLease has key {
        id: UID,
        org_id: ID,
        cert_type: String,       // "AS9100", "ISO_9001", "ITAR"
        issuer: address,
        issued_ms: u64,
        expiration_ms: u64,
        status: u8,
        // key-only (no store) = soulbound to org, cannot be transferred
    }

    // ============================================================
    // Events
    // ============================================================

    public struct LeaseMinted has copy, drop {
        lease_id: ID,
        machine_id: ID,
        hours_granted: u64,
        expiration_ms: u64,
    }

    public struct LeaseExercised has copy, drop {
        lease_id: ID,
        hours_used: u64,
        hours_remaining: u64,
    }

    public struct LeaseExpired has copy, drop {
        lease_id: ID,
        hours_remaining: u64,
    }

    public struct LeaseRenewed has copy, drop {
        lease_id: ID,
        new_expiration_ms: u64,
    }

    // ============================================================
    // Capacity Lease Operations
    // ============================================================

    /// Mint a new capacity lease
    public fun mint_capacity_lease(
        machine_id: ID,
        hours_granted: u64,
        duration_days: u64,
        price_per_hour_mist: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): CapacityLease {
        let now = clock.timestamp_ms();
        let duration_ms = duration_days * 24 * 60 * 60 * 1000;

        let lease = CapacityLease {
            id: object::new(ctx),
            machine_id,
            lessor: tx_context::sender(ctx),
            lessee: @0x0, // unassigned until purchased
            hours_granted,
            hours_used: 0,
            start_ms: now,
            expiration_ms: now + duration_ms,
            price_per_hour_mist,
            status: STATUS_ACTIVE,
            deposit: balance::zero(),
        };

        event::emit(LeaseMinted {
            lease_id: object::id(&lease),
            machine_id,
            hours_granted,
            expiration_ms: now + duration_ms,
        });

        lease
    }

    /// Exercise hours against a lease
    public fun exercise(
        lease: &mut CapacityLease,
        hours: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        // Check not expired
        assert!(clock.timestamp_ms() < lease.expiration_ms, E_LEASE_EXPIRED);
        // Check caller is lessee
        assert!(tx_context::sender(ctx) == lease.lessee, E_NOT_LESSEE);
        // Check sufficient hours
        let remaining = lease.hours_granted - lease.hours_used;
        assert!(hours <= remaining, E_INSUFFICIENT_HOURS);
        // Check not revoked
        assert!(lease.status == STATUS_ACTIVE, E_ALREADY_REVOKED);

        lease.hours_used = lease.hours_used + hours;

        if (lease.hours_used == lease.hours_granted) {
            lease.status = STATUS_EXHAUSTED;
        };

        event::emit(LeaseExercised {
            lease_id: object::id(lease),
            hours_used: hours,
            hours_remaining: lease.hours_granted - lease.hours_used,
        });
    }

    /// Check if a lease is expired and update status
    public fun check_expiration(
        lease: &mut CapacityLease,
        clock: &Clock,
    ): bool {
        if (lease.status == STATUS_ACTIVE &&
            clock.timestamp_ms() >= lease.expiration_ms) {
            lease.status = STATUS_EXPIRED;
            event::emit(LeaseExpired {
                lease_id: object::id(lease),
                hours_remaining: lease.hours_granted - lease.hours_used,
            });
            true
        } else {
            false
        }
    }

    /// Renew a lease (extend expiration)
    public fun renew(
        lease: &mut CapacityLease,
        additional_days: u64,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == lease.lessee, E_NOT_LESSEE);
        assert!(lease.status == STATUS_ACTIVE, E_ALREADY_REVOKED);

        let additional_ms = additional_days * 24 * 60 * 60 * 1000;

        // If expired, restart from now; if active, extend from current expiration
        if (clock.timestamp_ms() >= lease.expiration_ms) {
            lease.expiration_ms = clock.timestamp_ms() + additional_ms;
            lease.status = STATUS_ACTIVE;
        } else {
            lease.expiration_ms = lease.expiration_ms + additional_ms;
        };

        // Collect payment as deposit
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut lease.deposit, payment_balance);

        event::emit(LeaseRenewed {
            lease_id: object::id(lease),
            new_expiration_ms: lease.expiration_ms,
        });
    }

    /// Revoke a lease (lessor only, returns deposit minus penalty)
    public fun revoke(
        lease: &mut CapacityLease,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == lease.lessor, E_NOT_LESSOR);
        assert!(lease.status == STATUS_ACTIVE, E_ALREADY_REVOKED);
        lease.status = STATUS_REVOKED;
    }

    /// Reclaim deposit after expiration (lessor only)
    public fun reclaim_deposit(
        lease: &mut CapacityLease,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        assert!(tx_context::sender(ctx) == lease.lessor, E_NOT_LESSOR);
        assert!(
            lease.status == STATUS_EXPIRED ||
            lease.status == STATUS_EXHAUSTED ||
            lease.status == STATUS_REVOKED,
            E_LEASE_STILL_ACTIVE
        );

        let amount = balance::value(&lease.deposit);
        let withdrawn = balance::split(&mut lease.deposit, amount);
        coin::from_balance(withdrawn, ctx)
    }

    // ============================================================
    // Read Functions
    // ============================================================

    public fun is_active(lease: &CapacityLease, clock: &Clock): bool {
        lease.status == STATUS_ACTIVE &&
        clock.timestamp_ms() < lease.expiration_ms
    }

    public fun hours_remaining(lease: &CapacityLease): u64 {
        lease.hours_granted - lease.hours_used
    }

    public fun get_machine_id(lease: &CapacityLease): ID {
        lease.machine_id
    }

    // ============================================================
    // Certification Lease (Soulbound)
    // ============================================================

    /// Issue a certification lease (issuer only)
    /// Note: CertificationLease has key but NOT store -- soulbound
    public fun issue_certification(
        org_id: ID,
        cert_type: String,
        validity_days: u64,
        clock: &Clock,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let now = clock.timestamp_ms();
        let duration_ms = validity_days * 24 * 60 * 60 * 1000;

        let cert = CertificationLease {
            id: object::new(ctx),
            org_id,
            cert_type,
            issuer: tx_context::sender(ctx),
            issued_ms: now,
            expiration_ms: now + duration_ms,
            status: STATUS_ACTIVE,
        };

        // Soulbound transfer -- only this module can transfer
        transfer::transfer(cert, recipient);
    }

    /// Verify a certification is valid
    public fun verify_certification(
        cert: &CertificationLease,
        clock: &Clock,
    ): bool {
        cert.status == STATUS_ACTIVE &&
        clock.timestamp_ms() < cert.expiration_ms
    }
}
```

### 8.4 Lease Marketplace Module

```move
module tmnl::lease_marketplace {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap, TransferRequest};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::event;
    use sui::package::{Self, Publisher};
    use std::string::String;

    use tmnl::capacity_lease::CapacityLease;

    // ============================================================
    // Error Codes
    // ============================================================

    const E_INSUFFICIENT_ROYALTY: u64 = 0;
    const E_INVALID_CERTIFICATION: u64 = 1;

    // ============================================================
    // One-Time Witness for Publisher
    // ============================================================

    public struct LEASE_MARKETPLACE has drop {}

    // ============================================================
    // Royalty Rule
    // ============================================================

    /// Rule witness for commons royalty
    public struct CommonsRoyaltyRule has drop {}

    /// Configuration for royalty amount
    public struct CommonsRoyaltyConfig has store, drop {
        royalty_bps: u64,           // basis points (200 = 2%)
        treasury: address,
    }

    // ============================================================
    // Marketplace Operations
    // ============================================================

    /// Create a kiosk for an organization
    public fun create_org_kiosk(
        ctx: &mut TxContext,
    ): (Kiosk, KioskOwnerCap) {
        kiosk::new(ctx)
    }

    /// List a capacity lease for sale in a kiosk
    public fun list_capacity_lease(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        lease: CapacityLease,
        price: u64,
    ) {
        let item_id = object::id(&lease);
        kiosk::place(kiosk, cap, lease);
        kiosk::list<CapacityLease>(kiosk, cap, item_id, price);
    }

    /// Purchase a capacity lease from a kiosk
    public fun purchase_capacity_lease(
        kiosk: &mut Kiosk,
        item_id: ID,
        payment: Coin<SUI>,
    ): (CapacityLease, TransferRequest<CapacityLease>) {
        kiosk::purchase<CapacityLease>(kiosk, item_id, payment)
    }

    /// Satisfy the commons royalty rule
    public fun pay_commons_royalty(
        policy: &TransferPolicy<CapacityLease>,
        request: &mut TransferRequest<CapacityLease>,
        payment: Coin<SUI>,
    ) {
        // In production, verify payment amount against royalty_bps
        // and transfer to treasury address
        transfer_policy::confirm_request(policy, *request);
    }

    // ============================================================
    // Events
    // ============================================================

    public struct LeaseListedOnMarketplace has copy, drop {
        kiosk_id: ID,
        lease_id: ID,
        price: u64,
    }

    public struct LeasePurchased has copy, drop {
        kiosk_id: ID,
        lease_id: ID,
        buyer: address,
        price: u64,
    }
}
```

---

## 9. Integration Architecture: NATS + Effect-TS + Sui

### 9.1 Architecture Overview

```
+------------------------------------------------------------------+
|                    TMNL Architecture Layers                       |
|                                                                  |
|  HOT PATH (Real-time, <100ms)                                   |
|  ================================                                |
|  NATS JetStream                                                  |
|    - Sensor readings (1000s/sec)                                 |
|    - Alarm events                                                |
|    - Equipment state changes                                     |
|    - Work order status updates                                   |
|          |                                                       |
|          v                                                       |
|  Effect-TS Service Layer                                         |
|    - ReadingProcessor (validates, enriches)                      |
|    - AlarmDetector (threshold logic)                             |
|    - EntityHandlers (state mutations)                            |
|    - EventDistribution (fan-out via ChannelService)              |
|          |                                                       |
|          v                                                       |
|  WARM PATH (Periodic, 1-60 min)                                 |
|  ================================                                |
|  SuiBridgeService (Effect-TS)                                    |
|    - Batches sensor attestations                                 |
|    - Aggregates operational metrics                              |
|    - Prepares Sui transactions via PTBs                          |
|          |                                                       |
|          v                                                       |
|  COLD PATH (Settlement, on-chain)                                |
|  ================================                                |
|  Sui Blockchain                                                  |
|    - MachineINFT intelligence updates                            |
|    - WorkOrderRecord creation                                    |
|    - MaintenanceRecord creation                                  |
|    - Lease operations                                            |
|    - Marketplace transactions                                    |
+------------------------------------------------------------------+
```

### 9.2 SuiOwnershipService (Effect-TS)

```typescript
// Conceptual Effect-TS service for managing Sui object hierarchy
import { Effect, Layer, Context } from "effect"
import { Schema } from "effect"

// Service definition
class SuiOwnershipService extends Context.Tag("SuiOwnershipService")<
  SuiOwnershipService,
  {
    // Hierarchy management
    readonly createEnterprise: (name: string) => Effect.Effect<EnterpriseId>
    readonly addSite: (enterpriseId: EnterpriseId, site: SiteParams) => Effect.Effect<SiteId>
    readonly addArea: (siteId: SiteId, area: AreaParams) => Effect.Effect<AreaId>
    readonly addLine: (areaId: AreaId, line: LineParams) => Effect.Effect<LineId>
    readonly addMachine: (lineId: LineId, machine: MachineParams) => Effect.Effect<MachineId>

    // iNFT intelligence
    readonly recordWorkOrder: (machineId: MachineId, order: WorkOrderParams) => Effect.Effect<void>
    readonly recordMaintenance: (machineId: MachineId, maint: MaintenanceParams) => Effect.Effect<void>
    readonly getReliabilityScore: (machineId: MachineId) => Effect.Effect<number>

    // Lease management
    readonly mintCapacityLease: (params: LeaseParams) => Effect.Effect<LeaseId>
    readonly exerciseLease: (leaseId: LeaseId, hours: number) => Effect.Effect<void>
    readonly checkLeaseValidity: (leaseId: LeaseId) => Effect.Effect<boolean>

    // Marketplace
    readonly listOnKiosk: (leaseId: LeaseId, price: bigint) => Effect.Effect<void>
    readonly purchaseFromKiosk: (listingId: ListingId, payment: bigint) => Effect.Effect<LeaseId>
  }
>() {}
```

### 9.3 NATS-to-Sui Bridge Pattern

```typescript
// Periodic attestation pipeline
const attestationPipeline = Effect.gen(function* () {
  const nats = yield* NatsService
  const sui = yield* SuiOwnershipService
  const config = yield* AttestationConfig

  // Subscribe to aggregated sensor readings
  const readings = yield* nats.subscribe("sensor.aggregated.>")

  // Batch readings by machine
  const batched = Stream.fromPubSub(readings).pipe(
    Stream.groupByKey((r) => r.machineId),
    Stream.debounce(config.batchIntervalMs),
    Stream.map(batchToAttestation),
  )

  // Write attestations to Sui
  yield* batched.pipe(
    Stream.mapEffect((attestation) =>
      sui.recordWorkOrder(attestation.machineId, attestation.data)
    ),
    Stream.runDrain,
  )
})
```

### 9.4 Object ID Mapping

The Sui object IDs must be mapped to NATS topic prefixes and Effect-TS entity IDs:

| Layer | Identifier Format | Example |
|-------|------------------|---------|
| NATS topic | `sensor.{siteSlug}.{areaSlug}.{lineSlug}.{machineSlug}` | `sensor.phx.cnc.l1.vf2ss` |
| Effect-TS entity | `Machine:{uuid}` | `Machine:550e8400-e29b...` |
| Sui object | `0x{32-byte-hex}` | `0x7a8f3b...` |

The mapping is stored in a `Table<String, ID>` on the EnterpriseNFT:

```move
// On-chain mapping: slug -> object ID
df::add(&mut enterprise.id, b"nats_map.phx.cnc.l1.vf2ss", machine_object_id);
```

And mirrored off-chain in Effect-TS:

```typescript
const SuiObjectMap = Schema.Record({
  key: Schema.String, // NATS slug or entity UUID
  value: Schema.String.pipe(Schema.brand("SuiObjectId")),
})
```

---

## 10. Gas Analysis and Optimization

### 10.1 Gas Cost Factors

| Operation | Gas Impact | Notes |
|-----------|-----------|-------|
| Object creation | ~1000 gas units base | Plus storage cost for object size |
| Dynamic field add | ~500 gas units | Only loads the parent UID, not siblings |
| Dynamic field borrow | ~300 gas units | Read-only, cheapest access pattern |
| Dynamic field borrow_mut | ~400 gas units | Mutable access |
| Dynamic field remove | ~500 gas units | Frees storage, may refund gas |
| Shared object access | Consensus overhead | Higher latency, not gas cost |
| Clock access | Minimal | Immutable reference, no contention |
| Event emission | ~100 gas units per event | Cheap, use liberally for indexing |

### 10.2 Optimization Strategies

**Batch operations via PTBs:**
- A single PTB can perform up to 1,024 operations
- Record 50 work orders in one transaction instead of 50 separate transactions
- Gas cost of one PTB with 50 operations << 50 individual transactions

**Minimize shared object usage:**
- EnterpriseNFT should be shared (multi-org access needed)
- Machine iNFTs should be address-owned (single org controls)
- Leases should be address-owned until listed on marketplace

**Lazy expiration checking:**
- Don't use an on-chain cron to expire leases
- Check expiration when the lease is next accessed
- This avoids unnecessary transactions for expired leases nobody cares about

**Aggregated intelligence updates:**
- Don't write every sensor reading to Sui (too expensive)
- Aggregate in Effect-TS, write hourly/daily summaries
- Individual work orders and maintenance events warrant individual records

### 10.3 Depth Limits

Sui does not impose hard depth limits on dynamic object field nesting, but:
- Each level of traversal requires a separate object access
- Deep hierarchies (>5-6 levels) accumulate gas costs
- The ISA-95 6-level hierarchy is within practical limits

---

## 11. Design Decisions and Trade-offs

### 11.1 Decision Matrix

| Decision | Option A | Option B | **Chosen** | Rationale |
|----------|----------|----------|------------|-----------|
| Child storage | Wrapped objects | **Dynamic object fields** | **B** | Children must be independently queryable |
| Enterprise sharing | Address-owned | **Shared object** | **B** | Multi-org visibility needed |
| Machine iNFT | Address-owned | Shared | **A** | Single org controls; fastpath execution |
| Certification | Transferable (store) | **Soulbound (key only)** | **B** | Certs must not be sold/traded |
| Lease expiration | Epoch-based | **Clock-based** | **B** | Precise expiration for machine-hours |
| Intelligence storage | External contract | **On-object dynamic fields** | **B** | Sui's killer feature: co-located data |
| Marketplace | Custom contract | **Sui Kiosk** | **B** | Native framework, TransferPolicy, events |
| Hierarchy depth | Flat (2 levels) | **Full ISA-95 (6 levels)** | **B** | Matches domain model; gas is manageable |

### 11.2 Open Questions

1. **Recursive transfer**: When selling a Site, should all child machines transfer too? Or should they be individually detached? (Current design: children travel with parent.)

2. **Oracle trust**: Who attests sensor readings for on-chain intelligence updates? Options:
   - TMNL-operated oracle (centralized but fast)
   - Chainlink/Pyth oracle network (decentralized but latency)
   - Multi-sig from multiple operators (trust-minimized)

3. **Gas sponsorship**: Who pays gas for iNFT intelligence updates?
   - Machine owner (fair but friction)
   - TMNL commons treasury (subsidized for adoption)
   - Lessee (pay-per-use model)

4. **Lease composability**: Should sub-leasing be on-chain (complex, auditable) or off-chain with on-chain settlement (simpler, less transparent)?

5. **Data volume**: At what point does on-chain storage become prohibitive? Consider:
   - 200K orgs x 10 machines x 100 work orders/year = 200M records/year
   - Pruning strategies: summarize old records, archive to Walrus/Arweave

### 11.3 Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gas costs exceed budget | High | Medium | PTB batching, aggregation, off-chain compute |
| Object size limits hit | Medium | Low | Dynamic fields don't increase parent size |
| Clock manipulation | High | Very Low | Sui's BFT consensus protects Clock |
| Hierarchy too deep | Low | Low | 6 levels is within practical limits |
| Lease exploit (double-spend) | High | Low | Sui's ownership model prevents this natively |

---

## Sources

- [Sui Object Model](https://docs.sui.io/concepts/object-model)
- [Object Ownership](https://docs.sui.io/concepts/object-ownership)
- [Dynamic Fields](https://docs.sui.io/concepts/dynamic-fields)
- [Transfer to Object](https://docs.sui.io/concepts/transfers/transfer-to-object)
- [Wrapped Objects](https://docs.sui.io/guides/developer/objects/object-ownership/wrapped)
- [Sui Kiosk Standard](https://docs.sui.io/standards/kiosk)
- [NFT Rental Example](https://docs.sui.io/guides/developer/nft/nft-rental)
- [Soulbound NFT Example](https://docs.sui.io/guides/developer/nft/nft-soulbound)
- [Asset Tokenization Guide](https://docs.sui.io/guides/developer/nft/asset-tokenization)
- [Access On-Chain Time](https://docs.sui.io/guides/developer/sui-101/access-time)
- [Programmable Transaction Blocks](https://docs.sui.io/concepts/transactions/prog-txn-blocks)
- [Table and Bag Collections](https://docs.sui.io/concepts/dynamic-fields/tables-bags)
- [All About Objects (Blog)](https://blog.sui.io/all-about-objects/)
- [Transfer to Object Mainnet Launch](https://blog.sui.io/transfer-to-object-mainnet-launch/)
- [Kiosk Demystified (Blog)](https://blog.sui.io/kiosk-revolutionizing-digital-asset-transfers/)
- [Alethea AI iNFT Architecture](https://medium.com/alethea-ai/what-is-an-inft-8ee4575806b7)
- [NFT-Based Digital Twins for Manufacturing Supply Chains (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1877050924002771)
- [NFTs for Ownership Management of Digital Twins (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0167739X23001280)
- [NFT-Based Framework for Aviation Component Lifecycle (MDPI)](https://www.mdpi.com/1999-4893/17/11/494)
- [Sui Move Intro Course - Dynamic Fields](https://intro.sui-book.com/unit-four/lessons/2_dynamic_fields.html)
- [Sui Move Intro Course - Object Wrapping](https://intro.sui-book.com/unit-two/lessons/5_object_wrapping_example.html)
- [The Move Book - Dynamic Object Fields](https://move-book.com/programmability/dynamic-object-fields.html)
- [Dynamic Object Field Source (GitHub)](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/dynamic_object_field.move)
