# DePIN for Manufacturing Commons: Research Report

> **Date**: 2026-02-09
> **Author**: Val (Research Agent)
> **Context**: TMNL metropolitan-scale IIoT platform targeting 200K+ manufacturing organizations in Atlanta, Georgia
> **Stack**: Effect-TS + @effect/cluster + NATS + Sui blockchain + Chainlink oracles

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [DePIN Fundamentals](#2-depin-fundamentals)
3. [Manufacturing Commons as DePIN](#3-manufacturing-commons-as-depin)
4. [Token Economics for Manufacturing DePIN](#4-token-economics-for-manufacturing-depin)
5. [Governance Framework](#5-governance-framework)
6. [Technical Architecture](#6-technical-architecture)
7. [Competitive Landscape](#7-competitive-landscape)
8. [Regulatory Risk Assessment](#8-regulatory-risk-assessment)
9. [Comparison Table](#9-comparison-table)
10. [Recommendations](#10-recommendations)
11. [Sources](#11-sources)

---

## 1. Executive Summary

The manufacturing commons **is** a DePIN. It is a network of physical manufacturing infrastructure -- CNC machines, lathes, presses, welding robots -- coordinated through a decentralized protocol. This framing unlocks an entire ecosystem of proven patterns in token economics, incentive design, governance, and network bootstrapping.

### Key Findings

- **DePIN market** reached $19.2B combined market cap (Sep 2025), up 270% YoY, with 250+ tracked projects. The World Economic Forum projects the broader DePIN market could reach $3.5 trillion by 2028.
- **Manufacturing is a white-space opportunity**. Most DePINs focus on compute, wireless, storage, and mobility. No significant DePIN targets distributed manufacturing capacity as a first-class resource.
- **Sui blockchain** provides native advantages for manufacturing DePIN: object-centric data model (machines as objects), sponsored transactions (gasless onboarding for small shops), low gas costs (~$0.001/tx), and high throughput (10K+ TPS, roadmap to 100K+).
- **Regulatory clarity is improving**. The SEC issued its first DePIN-specific no-action letters in 2025, establishing a framework where utility tokens that reward infrastructure contribution (not investment returns) may fall outside securities classification.
- **The Helium lesson** is critical: supply-side incentives alone are insufficient. TMNL must architect demand-side value from day one -- the capacity marketplace, fleet intelligence, and quality verification features ARE the demand.
- **peaq network** is the closest architectural peer: a Layer 1 designed for machine identity, machine DeFi, and the "Economy of Things," with 49 DePINs on its platform by Q1 2025. TMNL's differentiation is manufacturing-specific domain expertise and the NATS/Effect-TS real-time substrate.

---

## 2. DePIN Fundamentals

### 2.1 Definition and Taxonomy

**Decentralized Physical Infrastructure Networks (DePINs)** are blockchain-based protocols that incentivize the deployment, maintenance, and operation of physical infrastructure through token rewards. Unlike purely digital protocols, DePINs bridge on-chain economics with real-world hardware.

The IEEE taxonomy (2024) identifies three key dimensions:
1. **Distributed Ledger Technology** -- the settlement and coordination layer
2. **Cryptoeconomic Design** -- token incentives, slashing, proofs
3. **Physical Infrastructure Network** -- the actual hardware being coordinated

DePINs divide into two sub-categories:

| Category | Description | Examples |
|---|---|---|
| **Physical Resource Networks (PRNs)** | Rely on physical assets (sensors, radios, machines). Location-dependent. Reward for contributing data or network resources. | Helium (wireless), Hivemapper (mapping), DIMO (vehicles) |
| **Digital Resource Networks (DRNs)** | Leverage digital assets (compute, storage, bandwidth). Location-agnostic. Tap the "long tail" of idle capacity. | Render (GPU), Filecoin (storage), Akash (compute) |

**Manufacturing commons is a PRN** -- it coordinates location-bound physical machines. However, it has DRN characteristics when sensor data and quality intelligence are the resources being contributed.

### 2.2 The DePIN Flywheel

The DePIN flywheel is the core growth mechanism:

```
Token Incentives
     │
     ▼
Infrastructure Deployment (shops connect machines)
     │
     ▼
Network Supply Grows (more capacity available)
     │
     ▼
Service Quality Improves (geographic coverage, machine diversity)
     │
     ▼
Demand Side Attracted (buyers find capacity)
     │
     ▼
Revenue Generated (marketplace fees, data sales)
     │
     ▼
Token Value Accrues (burn-and-mint, buy-backs)
     │
     ▼
More Infrastructure Deployment ← ← ← ← (loop)
```

**Critical insight from Helium's experience**: The flywheel stalls if you only incentivize the supply side. Helium deployed $1 billion in hardware through token incentives but struggled with demand until its Helium Mobile partnership created real-world usage (576 TB offloaded in Q4 2024 alone, a 555% QoQ increase).

### 2.3 Major DePIN Projects and Lessons

#### Helium (Wireless)
- **What worked**: Token incentives successfully bootstrapped 900K+ hotspot deployments globally. Proof of Coverage created verifiable network maps.
- **What failed**: Demand lagged supply catastrophically. Migration from L1 to Solana was necessary for performance. MOBILE token plunged 87% after deprecation under HIP 13.
- **Manufacturing lesson**: Bootstrap supply, but architect demand mechanisms from day one. Capacity without demand is a burning treasury.

#### Filecoin (Storage)
- **What worked**: Proof of Replication and Proof of Spacetime created cryptographically verifiable proof that storage providers actually hold client data. Retrieval market creates real demand.
- **Manufacturing lesson**: "Proof of Capacity" for machines must be similarly rigorous. A claim of "5-axis CNC available" needs cryptographic verification, not just self-attestation.

#### Render Network (GPU Compute)
- **What worked**: Capacity marketplace with on-chain bidding. GPU owners list capacity; buyers rent for rendering/AI. Market-driven pricing.
- **Manufacturing lesson**: The capacity marketplace model maps directly. Machine shops list available capacity; manufacturers with overflow bid for it.

#### Hivemapper (Mapping)
- **What worked**: Data contribution rewards weighted by quality and freshness. Dashcam contributors earn for unique coverage; re-mapping stale areas earns more than re-mapping fresh ones.
- **Manufacturing lesson**: Weight rewards by data quality, not just volume. Quality metrics from a calibrated CMM should earn more than uncalibrated temperature readings.

#### IoTeX (IoT Devices)
- **What worked**: W3bstream provides decentralized off-chain compute for IoT data verification. ioID gives devices programmable on-chain identities. Zero-knowledge proofs for device attestation.
- **Manufacturing lesson**: Machine identity is foundational. Every CNC, lathe, and press needs a DID (Decentralized Identifier) that follows it through its lifecycle. IoTeX's ioID pattern maps directly.

#### DIMO (Vehicle Data)
- **What worked**: Vehicle owners mint their car as an NFT, self-custody their data, and choose if/when to monetize it. "Vehicle identity" as a smart-contract wallet. Approved parties access selected metrics.
- **Manufacturing lesson**: Machine owners (Earl) must own their machine data. Selective disclosure -- share OEE metrics with the marketplace without exposing proprietary toolpaths. DIMO's consent model is the template.

---

## 3. Manufacturing Commons as DePIN

### 3.1 Concept Mapping

| DePIN Concept | Manufacturing Equivalent | Implementation |
|---|---|---|
| **Node operators** | Machine shop owners (Earl) | Deploy edge device + connect machines |
| **Coverage/capacity proofs** | Machine uptime + capability verification | Proof of Capacity via sensor attestation |
| **Data contribution** | Sensor readings, quality metrics, OEE data | Sparkplug-B telemetry → NATS → chain |
| **Network utility** | Capacity marketplace, fleet intelligence | Bid/ask marketplace for overflow work |
| **Token rewards** | Incentives for contributing capacity/data | $TMNL utility token (see Section 4) |
| **Slashing** | Penalty for false capability claims, quality failures | Staked reputation; slash on failed QC |
| **Proof of work** | Proof of Manufacturing (completed work orders) | Chainlink oracle verifies completion |
| **Node hardware** | Raspberry Pi / industrial gateway + sensors | Edge device running NATS leaf node |
| **Network coverage** | Geographic manufacturing coverage | Metro-area capacity map (Atlanta first) |
| **Data marketplace** | Machine intelligence exchange | Anonymized OEE, quality, and downtime data |

### 3.2 The Manufacturing DePIN Value Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICAL LAYER                                │
│  Machine Shop ──> Sensors ──> Edge Device (NATS leaf)           │
│  [CNC, Lathe]     [Vibration,   [Raspberry Pi /                 │
│                     Temp, Power]  Industrial Gateway]            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Sparkplug-B / MQTT
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGING LAYER                               │
│  NATS Leaf Node ──> NATS Hub (metro) ──> NATS Super-cluster     │
│  [Shop-local]       [Atlanta hub]        [Multi-metro]          │
│                                                                  │
│  Functions: Real-time telemetry, capacity signals,               │
│             work order routing, alarm propagation                │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Effect-TS services
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                              │
│  @effect/cluster ──> Entity Services ──> RPC/HTTP/WebSocket     │
│  [Distributed        [Machine, Work      [TMNL dashboard,       │
│   state mgmt]         Order, Quality]     marketplace UI]       │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Oracle bridge
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                               │
│  Sui ────────> Chainlink ────────> Smart Contracts               │
│  [Settlement,   [Oracle for         [Token rewards,              │
│   machine IDs,   sensor data         marketplace escrow,        │
│   token ops]     verification]       quality staking]           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Manufacturing-Specific Proof Mechanisms

#### Proof of Capacity (PoC)
- **What**: Machine is actually available for work at claimed specifications
- **How**: Edge device reports machine state (idle/running/maintenance) via Sparkplug-B. Chainlink oracle attests uptime over rolling window. On-chain staking backs the claim.
- **Anti-gaming**: Cross-reference power consumption data with claimed machine state. A "5-axis CNC running" that draws 50W is clearly fraudulent. Random spot-check challenges require demonstrating capability (e.g., produce a test part to specification).

#### Proof of Quality (PoQ)
- **What**: Work output meets specifications
- **How**: CMM (Coordinate Measuring Machine) readings, SPC (Statistical Process Control) data, and in-process sensor data are hashed and anchored on-chain. Chainlink oracle verifies the measurement chain.
- **Anti-gaming**: Third-party inspection services can be randomly assigned. Quality data must correlate with machine telemetry (e.g., vibration signature during claimed operation).

#### Proof of Uptime (PoU)
- **What**: Machine is reliably connected and responsive
- **How**: Heartbeat protocol via NATS. Edge device signs heartbeats with device key. Sustained uptime earns higher reward tier.
- **Anti-gaming**: Variable-interval challenges require machine-specific responses (not just heartbeat replay). Hardware attestation via TPM or similar.

---

## 4. Token Economics for Manufacturing DePIN

### 4.1 Token Design: $TMNL

| Property | Design |
|---|---|
| **Name** | $TMNL (Terminal) |
| **Type** | Utility token on Sui |
| **Supply model** | Capped supply with deflationary pressure via burn-and-mint |
| **Primary utility** | Pay for marketplace services, stake for capability verification, earn for contributing capacity/data, governance voting |

### 4.2 Burn-and-Mint Equilibrium (BME)

The proven DePIN tokenomics pattern, validated by Helium and others:

```
DEMAND SIDE (Buyers)                    SUPPLY SIDE (Shops)
─────────────────────                   ──────────────────
Pay USD for capacity  ──> Buy $TMNL     Contribute capacity ──> Earn $TMNL
                          │                                      ▲
                          ▼                                      │
                     BURN $TMNL ──> Mint Data Credits ──> Protocol Treasury
                                                              │
                                                              ▼
                                                    Emit $TMNL to suppliers
```

- **Buyers** purchase capacity/data in fiat (USD). The protocol uses this revenue to buy $TMNL on the open market and burn it, creating "Manufacturing Credits" (MCs).
- **Suppliers** earn $TMNL emissions for contributing capacity, data, and maintaining uptime.
- **Equilibrium**: As demand grows, more $TMNL is burned. If burn > emission, deflationary pressure increases token value, attracting more supply-side participants.

### 4.3 Reward Tiers

| Tier | Requirements | Base Reward Multiplier | Description |
|---|---|---|---|
| **Bronze** | Edge device connected, heartbeat active | 1.0x | Basic connectivity. Earl's first step. |
| **Silver** | + OEE data shared, uptime > 90% | 2.5x | Meaningful data contribution |
| **Gold** | + Quality metrics (SPC, CMM), uptime > 97% | 5.0x | Full telemetry + quality |
| **Platinum** | + Marketplace capacity listed, completed work orders | 10.0x | Active marketplace participant |

Multipliers are illustrative. Actual rates governed by protocol DAO.

### 4.4 Staking and Slashing

| Mechanism | Purpose | Implementation |
|---|---|---|
| **Capability Stake** | Back capability claims with skin-in-the-game | Stake $TMNL when claiming machine specs. Slashed if random audit fails. |
| **Quality Stake** | Guarantee work output quality | Stake when accepting marketplace work order. Slashed on failed inspection. |
| **Marketplace Escrow** | Protect both buyer and seller | Buyer's payment held in smart contract. Released on delivery + QC pass. |
| **Reputation Stake** | Long-term credibility | Higher stakes earn higher marketplace visibility. History is public. |

### 4.5 Token Distribution

| Allocation | Percentage | Vesting | Purpose |
|---|---|---|---|
| Network Rewards | 40% | Emitted over 10 years, halvings | Incentivize infrastructure deployment |
| Ecosystem Fund | 20% | DAO-governed | Grants, subsidized edge hardware, integrations |
| Core Team | 15% | 4-year linear, 1-year cliff | Development and operations |
| Early Adopters / Bootstrap | 10% | 2-year linear | First 1,000 connected shops |
| Hub Operators | 5% | Performance-based | NATS hub infrastructure operators |
| Treasury | 10% | DAO-governed | Strategic reserve, partnerships |

### 4.6 Anti-Gaming Mechanisms

Drawing from a16z crypto's research on DePIN security:

| Attack Vector | Defense |
|---|---|
| **Fake nodes** (claiming nonexistent machines) | Hardware attestation (TPM/secure element on edge device), power consumption correlation, random physical audit |
| **Sybil attacks** (one operator pretending to be many) | IP fingerprinting, device fingerprinting, geographic clustering detection, stake requirements |
| **Wash trading** (self-dealing on marketplace) | Minimum distinct counterparties, payment verification through banking rails, anomaly detection |
| **Data fabrication** (fake sensor readings) | Cross-sensor correlation (vibration vs. power vs. temperature), statistical anomaly detection, Chainlink oracle validation |
| **Capability inflation** (claiming better specs than reality) | Random challenge-response (produce test part), third-party audits, historical quality record |

---

## 5. Governance Framework

### 5.1 Ostrom's Principles Mapped to Manufacturing DAO

Elinor Ostrom's eight principles for governing commons, mapped to the manufacturing DePIN:

| Ostrom Principle | Manufacturing DAO Implementation |
|---|---|
| **1. Clearly defined boundaries** | Machine identity (DID), shop verification, geographic zones |
| **2. Proportional equivalence** | Rewards proportional to contribution (capacity, data, quality) |
| **3. Collective-choice arrangements** | Token-weighted + quadratic voting for protocol parameters |
| **4. Monitoring** | Sensor telemetry, Chainlink oracles, random audits |
| **5. Graduated sanctions** | Warning → reward reduction → slashing → exclusion |
| **6. Conflict-resolution mechanisms** | Arbitration DAO with domain experts (see 5.3) |
| **7. Minimal rights to organize** | Open participation, low barrier to entry (subsidized hardware) |
| **8. Nested enterprises** | Sub-DAOs per vertical, hub-level governance, metro coordination |

### 5.2 DAO Structure

```
┌─────────────────────────────────────────────────────────┐
│                     TMNL DAO (Root)                       │
│  Protocol parameters, token emission schedule,            │
│  major partnerships, treasury allocation                  │
│  Voting: Quadratic (sqrt of $TMNL staked)                │
└──────────┬────────────────────────────────┬──────────────┘
           │                                │
    ┌──────▼──────┐                  ┌──────▼──────┐
    │  Vertical    │                  │  Vertical    │
    │  Sub-DAOs    │                  │  Hub DAOs    │
    ├─────────────┤                  ├─────────────┤
    │ Aerospace    │                  │ Atlanta Hub  │
    │ Automotive   │                  │ Detroit Hub  │
    │ Medical      │                  │ Houston Hub  │
    │ General Mfg  │                  │ ...          │
    └─────────────┘                  └─────────────┘
    Standards,                        Local capacity,
    certifications,                   geographic rules,
    quality thresholds                hub operations
```

#### Root DAO
- **Scope**: Protocol-level decisions affecting all participants
- **Voting**: Quadratic voting (sqrt of staked $TMNL) to prevent whale dominance
- **Quorum**: 10% of staked supply
- **Timelock**: 48-hour execution delay after vote passes

#### Vertical Sub-DAOs
- **Scope**: Industry-specific standards, certifications, quality thresholds
- **Membership**: Self-selected by vertical; must stake minimum + demonstrate domain expertise
- **Why needed**: Aerospace tolerances differ radically from general fabrication. A single governance body cannot set standards across all verticals.
- **Voting**: One-member-one-vote within the vertical (prevents large shops from dominating niche standards)

#### Hub DAOs
- **Scope**: Local capacity planning, geographic rules, hub infrastructure
- **Membership**: Shops and operators within the metro area
- **Why needed**: Atlanta's manufacturing ecosystem has different needs than Detroit's
- **Voting**: Proportional to local contribution (uptime + marketplace activity in the region)

### 5.3 Dispute Resolution

Manufacturing disputes (quality, delivery, specification interpretation) are handled through a tiered system:

1. **Automated** -- Smart contract rules (escrow timeout, SPC threshold breach) handle 80%+ of cases
2. **Peer Arbitration** -- Panel of 3 randomly selected Gold/Platinum-tier shops with domain expertise. Stake-weighted selection. Arbitrators earn fees.
3. **Expert Panel** -- For high-value disputes (>$50K), a panel of domain-certified arbitrators. May include third-party inspection services.
4. **Off-chain Legal** -- Final backstop. Smart contract can pause/freeze disputed assets pending off-chain resolution.

---

## 6. Technical Architecture

### 6.1 Stack Integration: Sui + Chainlink + NATS

```
┌──────────────────────────────────────────────────────────────┐
│  SHOP FLOOR                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ CNC Mill │  │ Lathe    │  │ CMM      │                   │
│  │ (OPC-UA) │  │ (MTConn) │  │ (RS-232) │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │              │              │                         │
│  ┌────▼──────────────▼──────────────▼────┐                   │
│  │  Edge Device (RPi 5 / Industrial GW)  │                   │
│  │  ┌─────────────┐ ┌────────────────┐   │                   │
│  │  │ Sparkplug-B │ │ NATS Leaf Node │   │                   │
│  │  │ Adapter     │ │ + JetStream    │   │                   │
│  │  └─────────────┘ └────────────────┘   │                   │
│  │  ┌─────────────┐ ┌────────────────┐   │                   │
│  │  │ Device Key  │ │ Proof Agent    │   │                   │
│  │  │ (TPM/SE)    │ │ (PoC/PoU/PoQ) │   │                   │
│  │  └─────────────┘ └────────────────┘   │                   │
│  └────────────────────┬──────────────────┘                   │
└───────────────────────┼──────────────────────────────────────┘
                        │ NATS (TLS + NKey auth)
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  METRO HUB (Atlanta)                                          │
│  ┌────────────────┐  ┌────────────────┐                      │
│  │ NATS Hub Server │  │ Effect-TS      │                      │
│  │ (JetStream +    │  │ @effect/cluster│                      │
│  │  KV + Object)   │  │ Entity Services│                      │
│  └────────┬───────┘  └───────┬────────┘                      │
│           │                   │                               │
│  ┌────────▼───────────────────▼────────┐                     │
│  │  TMNL Application Layer              │                     │
│  │  - Capacity Marketplace              │                     │
│  │  - Fleet Intelligence                │                     │
│  │  - Quality Dashboard                 │                     │
│  │  - Work Order Management             │                     │
│  └────────────────────┬────────────────┘                     │
└───────────────────────┼──────────────────────────────────────┘
                        │ Chainlink Oracle / Sui SDK
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER                                             │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ Sui Blockchain    │  │ Chainlink DON    │                  │
│  │ ┌──────────────┐ │  │ (Decentralized   │                  │
│  │ │ Machine NFTs  │ │  │  Oracle Network)  │                  │
│  │ │ (Sui Objects) │ │  │                   │                  │
│  │ └──────────────┘ │  │ Functions:        │                  │
│  │ ┌──────────────┐ │  │ - Sensor data     │                  │
│  │ │ $TMNL Token   │ │  │   attestation    │                  │
│  │ │ (Move module) │ │  │ - Quality proof  │                  │
│  │ └──────────────┘ │  │   verification    │                  │
│  │ ┌──────────────┐ │  │ - Uptime oracle   │                  │
│  │ │ Marketplace   │ │  │ - Price feeds    │                  │
│  │ │ Escrow        │ │  └──────────────────┘                  │
│  │ └──────────────┘ │                                         │
│  │ ┌──────────────┐ │                                         │
│  │ │ Governance    │ │                                         │
│  │ │ (DAO modules) │ │                                         │
│  │ └──────────────┘ │                                         │
│  └──────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Why Sui for Manufacturing DePIN

| Sui Feature | Manufacturing Benefit |
|---|---|
| **Object-centric model** | Each machine is a Sui Object (NFT). Machine identity, capability attestations, maintenance records, quality history -- all stored as object properties. Natural fit. |
| **Sponsored transactions** | Earl (2-person shop) doesn't need to understand gas or own $SUI. TMNL sponsors onboarding transactions. Zero friction. |
| **Low gas costs** | ~$0.001/tx. At 200K orgs generating telemetry anchoring transactions, gas must be negligible. |
| **High throughput** | 10K TPS today, roadmap to 100K+. Manufacturing telemetry generates high-volume, low-value transactions. |
| **Move language** | Resource-oriented programming prevents accidental token duplication/loss. Machine capability attestations are "resources" that can't be copied -- only moved or destroyed. |
| **Programmable Transaction Blocks** | Bundle multiple operations (mint machine NFT + stake capability + register on marketplace) in a single transaction. |

### 6.3 Chainlink Integration Points

| Oracle Function | Description |
|---|---|
| **Sensor Data Attestation** | Chainlink DON reads aggregated sensor data from NATS JetStream, validates consistency, anchors hash on Sui |
| **Quality Verification** | CMM readings + SPC data are verified against specification tolerances. Oracle attests pass/fail on-chain |
| **Uptime Oracle** | Monitors edge device heartbeats via NATS. Reports uptime percentages for reward tier calculation |
| **Price Feeds** | USD/TMNL exchange rate for burn-and-mint equilibrium. Also raw material price feeds for marketplace pricing |
| **Cross-Chain** | If manufacturing data needs to be verified across chains (e.g., supply chain partners on different blockchains) |

### 6.4 NATS as the DePIN Communication Substrate

NATS is not just a message bus -- it IS the DePIN's nervous system:

| NATS Feature | DePIN Role |
|---|---|
| **Leaf Nodes** | Each shop's edge device runs a NATS leaf node. Local-first, survives internet outages, syncs when reconnected. |
| **JetStream** | Persistent telemetry streams. No data loss even during network partitions. |
| **KV Store** | Machine state (idle/running/maintenance) stored locally. Replicated to hub. |
| **Multi-tenancy** | Account-based isolation. Each shop is a NATS account. Zero-trust between tenants. |
| **Subject-based routing** | `mfg.atlanta.shop-{id}.machine-{id}.telemetry` -- natural topic hierarchy for manufacturing |
| **Edge-to-cloud** | Leaf → Hub → Super-cluster. Same protocol at every tier. |

### 6.5 Machine Identity Architecture

```
Machine Identity (Sui Object)
├── DID (Decentralized Identifier) — w3c-did:sui:machine:{id}
├── Capability Attestations
│   ├── Machine Type (CNC, Lathe, Press, ...)
│   ├── Axis Count, Spindle Speed, Table Size
│   ├── Material Capabilities (aluminum, steel, titanium, ...)
│   └── Certification Attestations (AS9100, ISO 13485, ...)
├── Telemetry Anchor (latest Chainlink-attested hash)
├── Quality History (rolling window of PoQ results)
├── Uptime Score (Chainlink-attested percentage)
├── Marketplace Listing (if active)
└── Owner (shop wallet address)
```

Each machine is minted as a Sui Object when the edge device first connects. The object is owned by the shop's wallet. Capabilities are attested through a combination of self-declaration (staked) and third-party verification (Chainlink + auditor attestation).

---

## 7. Competitive Landscape

### 7.1 Direct Competitors

| Project | Focus | Chain | Status | Differentiation from TMNL |
|---|---|---|---|---|
| **Festo Blockchain Marketplace** | Decentralized manufacturing marketplace with autonomous software agents | Ethereum (private) | Research prototype | Academic/research focus. No token economics. No DePIN incentives. |
| **VeChain** | Supply chain traceability (QR/NFC/RFID → blockchain) | VeChainThor | Production (enterprise) | Traceability-focused, not capacity marketplace. No DePIN token incentives. Enterprise-first (Walmart, BMW). |
| **OriginTrail** | Decentralized knowledge graph for supply chains | Multi-chain | Production | Supply chain data layer, not manufacturing capacity. Knowledge graph focus. |

### 7.2 Adjacent DePINs

| Project | Category | Relevance | Lessons |
|---|---|---|---|
| **peaq** | Machine Economy L1 | HIGH -- Machine identity, machine DeFi, 49 DePINs | Machine identity (peaq ID) is a proven primitive. MachineX DEX model could apply to manufacturing capacity trading. |
| **IoTeX** | IoT device identity | HIGH -- ioID, W3bstream, zero-knowledge proofs | Device identity + off-chain compute verification. W3bstream pattern for manufacturing data processing. |
| **DIMO** | Vehicle data ownership | MEDIUM -- User-owned data, selective disclosure | Machine owner data sovereignty model. Consent-based data sharing. |
| **Helium** | Wireless coverage | MEDIUM -- DePIN pioneer, flywheel lessons | Supply-side incentives, Proof of Coverage, demand-side challenges. |
| **Render** | GPU compute marketplace | MEDIUM -- Capacity marketplace model | Bid/ask marketplace for compute maps to manufacturing capacity. |

### 7.3 DeFi / RWA Competitors

| Project | Focus | Relevance |
|---|---|---|
| **MakerDAO (Sky)** | RWA collateral ($4.6B in Treasuries, RWAs = 14% of reserves) | RWA framework for factory equipment as collateral. Not a marketplace -- a lending protocol. |
| **Centrifuge** | Tokenized invoices and loans | Manufacturing invoice financing. Complementary, not competitive. |
| **Goldfinch** | Emerging market lending | Lending to manufacturers in developing economies. Different market. |

### 7.4 What Exists vs. What's Missing (TMNL's Opportunity)

| Capability | Exists? | Gap |
|---|---|---|
| Supply chain traceability | Yes (VeChain, OriginTrail) | Not the same as manufacturing capacity marketplace |
| Machine identity | Yes (peaq, IoTeX) | Not manufacturing-specific. No ISA-95 hierarchy. |
| Equipment financing / RWA | Yes (MakerDAO, Centrifuge) | Lending, not operational coordination |
| Sensor data DePIN | Yes (WeatherXM, DIMO) | Not industrial/manufacturing sensors |
| Manufacturing capacity marketplace | **NO** | **White space. This is TMNL's opportunity.** |
| Quality verification on-chain | **NO** | **No DePIN does manufacturing QC.** |
| ISA-95 compliant DePIN | **NO** | **Industrial standard hierarchy missing from all DePINs.** |
| Metropolitan manufacturing network | **NO** | **Geographic-first manufacturing coordination does not exist.** |

---

## 8. Regulatory Risk Assessment

### 8.1 SEC / Howey Test Analysis

The Howey Test classifies a token as a security if there is:
1. An investment of money
2. In a common enterprise
3. With an expectation of profits
4. Derived primarily from the efforts of others

**$TMNL Analysis**:

| Howey Prong | Assessment | Risk Level |
|---|---|---|
| Investment of money | Shops invest in edge hardware + staking. But hardware purchase is for utility (connecting machines), not speculation. | LOW |
| Common enterprise | Shared marketplace and network. However, individual shops operate independently. | MEDIUM |
| Expectation of profits | Token rewards exist, but primary value is operational (marketplace access, fleet intelligence, quality certification). | LOW-MEDIUM |
| Efforts of others | Rewards depend on the SHOP'S OWN EFFORTS (uptime, quality, capacity contribution), not on a central team. | LOW |

**Overall Assessment**: LOW-MEDIUM risk. The $TMNL token has strong utility characteristics. Rewards are tied to individual contribution (own effort), not passive investment returns.

### 8.2 Precedent: SEC DePIN No-Action Letters (2025)

In September 2025, the SEC Division of Corporation Finance issued a no-action letter confirming that programmatic token distributions in DePIN protocols where:
- Tokens are earned through infrastructure operation (not investment)
- Rewards depend on operators' own efforts
- Token utility is functional (access services, not dividends)

...would not be recommended for enforcement action. This was the SEC's second such approval for the DePIN sector in 2025.

**Implication for TMNL**: Design the token such that:
1. Rewards are strictly tied to measurable infrastructure contribution (uptime, data quality, capacity)
2. No promises of investment returns or profit expectations
3. Token utility is functional (marketplace access, governance, staking)
4. Governance is progressively decentralized (no founding team control after launch)

### 8.3 Georgia-Specific Considerations

- **Georgia Securities Act**: Follows federal framework. No additional state-level crypto-specific legislation as of 2026.
- **Atlanta FinTech Corridor**: Generally favorable regulatory environment for blockchain innovation.
- **Manufacturing Tax Incentives**: Georgia offers manufacturing tax credits that could complement (not conflict with) DePIN token economics.
- **NIST MEP Partnership**: The Georgia Manufacturing Extension Partnership (GaMEP) at Georgia Tech is a natural ally for onboarding manufacturers. Federal partnership adds legitimacy.

### 8.4 Risk Mitigation Strategy

| Risk | Mitigation |
|---|---|
| Token classified as security | Design strictly as utility token. No investment language. Progressive decentralization. Engage securities counsel pre-launch. |
| State regulatory action | Proactive engagement with Georgia regulators. Join Atlanta FinTech sandbox if available. |
| Hardware subsidy as "free money" | Structure as earned rewards for network contribution, not airdrops. Subsidized hardware requires minimum commitment period. |
| Token volatility affecting marketplace | Use burn-and-mint with USD-pegged Manufacturing Credits for marketplace transactions. Token volatility doesn't affect operational pricing. |
| International expansion | Each new jurisdiction requires regulatory review. Start US-only. |

---

## 9. Comparison Table: Manufacturing Commons vs. Existing DePINs

| Dimension | Helium | DIMO | Render | IoTeX | peaq | **TMNL** |
|---|---|---|---|---|---|---|
| **Resource type** | Wireless coverage | Vehicle data | GPU compute | IoT identity | Machine economy | Manufacturing capacity |
| **Infrastructure** | Hotspots | OBD-II dongles | GPUs | IoT devices | Any machine | CNC, lathes, presses |
| **Proof mechanism** | Proof of Coverage | Data contribution | Job completion | ioID attestation | Machine ID | PoCapacity + PoQuality + PoUptime |
| **Token model** | BME (HNT→DC) | Earn for data | Earn for render | IOTX staking | PEAQ staking | BME ($TMNL→MC) |
| **Chain** | Solana | Polygon | Ethereum/Solana | IoTeX L1 | peaq L1 (Polkadot) | **Sui** |
| **Oracle** | Internal PoC | W3bstream (IoTeX) | Job verification | W3bstream | Internal | **Chainlink** |
| **Messaging** | LoRaWAN | Cellular/BLE | Internet | Various | Various | **NATS** |
| **Governance** | HIP voting | DIMO DAO | Render DAO | IoTeX DAO | peaq DAO | **Ostrom-based multi-tier DAO** |
| **Target users** | Consumers/ISPs | Drivers/fleets | 3D artists/AI | Device makers | Machine operators | **Manufacturers (2-person to Boeing)** |
| **Geography** | Global | Global | Global | Global | Global | **Metro-first (Atlanta)** |
| **Market cap** | ~$1.2B | ~$300M | ~$3B | ~$400M | ~$500M | **Pre-launch** |
| **Unique value** | Telco disruption | User-owned vehicle data | Decentralized GPU | Device identity | Machine DEX | **Manufacturing QC + capacity marketplace** |

---

## 10. Recommendations

### 10.1 Immediate Actions (0-6 months)

1. **Adopt DePIN framing in all external communications**. The manufacturing commons IS a DePIN. This unlocks investor vocabulary, community patterns, and partnership opportunities.

2. **Design $TMNL tokenomics formally**. Engage a tokenomics consultant (e.g., Tokenomics.net, Parameter Ventures). Key decisions:
   - BME ratio (emission rate vs. burn rate)
   - Reward tier thresholds
   - Staking minimums for capability claims
   - Slashing severity for quality failures

3. **Prototype Proof of Capacity on Sui testnet**. Mint machine NFTs as Sui Objects. Implement basic Chainlink oracle for uptime attestation. Validate the object model with real sensor data from a pilot shop.

4. **Engage securities counsel**. Get a formal Howey Test opinion for the $TMNL token design. Reference the 2025 SEC no-action letters for DePIN tokens.

5. **Partner with GaMEP (Georgia Tech)**. They reach 700+ Georgia manufacturers annually. Natural onboarding channel. Subsidized edge hardware program through MEP grants.

### 10.2 Medium-Term (6-18 months)

6. **Build the Machine Identity system on Sui**. Move-language smart contract for machine NFTs with:
   - Capability attestation storage
   - Quality history accumulation
   - Marketplace listing primitives
   - Sponsored transaction support for onboarding

7. **Implement Chainlink oracle integration**. Priority order:
   - Uptime oracle (simplest, highest ROI)
   - Sensor data attestation
   - Quality verification
   - Price feeds for BME

8. **Launch Atlanta Metro Pilot**. Target 50-100 shops. Subsidize edge hardware (RPi 5 + industrial gateway). Bronze/Silver tier rewards only. Focus on data contribution, not marketplace.

9. **Establish Vertical Sub-DAOs**. Start with General Manufacturing (largest audience). Add Aerospace and Automotive when 10+ qualified shops in each vertical.

10. **Publish Manufacturing DePIN whitepaper**. Position TMNL as the canonical reference for manufacturing DePIN. Submit to conferences (IEEE IoT, DePIN Summit).

### 10.3 Long-Term (18-36 months)

11. **Launch capacity marketplace**. Buyer/seller matching with escrow. Gold/Platinum tier shops eligible. Start with simple overflow work, expand to complex multi-step jobs.

12. **Multi-metro expansion**. Detroit (automotive), Houston (energy/industrial), Pittsburgh (advanced manufacturing). Each metro gets a Hub DAO.

13. **Cross-chain interoperability**. Partners on VeChain (supply chain) or Ethereum (DeFi) need to interact with TMNL. Chainlink CCIP or Wormhole bridge.

14. **Manufacturing RWA integration**. Machine NFTs as collateral for equipment financing (MakerDAO/Centrifuge integration). A machine with 3 years of on-chain quality history and 99% uptime is a bankable asset.

15. **AI + Manufacturing Intelligence**. Anonymized, aggregated manufacturing data (OEE benchmarks, downtime patterns, quality trends) becomes a data product. Fleet intelligence for the entire metro network.

### 10.4 Critical Success Factors

| Factor | Why It Matters | How to Achieve |
|---|---|---|
| **Demand-side from day one** | Helium's #1 lesson: supply without demand burns treasury | Marketplace, fleet intelligence, and quality certification ARE the demand |
| **Earl-friendly onboarding** | 2-person shop can't understand gas fees, wallets, or staking | Sponsored transactions, managed wallets, hardware-as-a-service |
| **Quality over quantity** | 1,000 quality-verified shops > 10,000 heartbeat-only nodes | Weight rewards heavily toward quality metrics (PoQ) |
| **Progressive decentralization** | SEC compliance + operational pragmatism | Start with foundation governance, transition to DAO over 24 months |
| **Real revenue, not just tokens** | Sustainable DePINs generate fiat revenue | Marketplace fees, data licensing, quality certification fees |

---

## 11. Sources

### DePIN Fundamentals and Market
- [The DePIN Report 2025 - DePIN Scan](https://depinscan.io/news/2025-07-03/the-depin-report-2025-transforming-infrastructure-through-decentralization)
- [The DePIN Report 2025 - The Block](https://www.theblock.co/post/360958/state-of-depin-2025)
- [DePIN Challenges and Opportunities - IEEE Xplore](https://ieeexplore.ieee.org/document/10737386/)
- [DePIN Taxonomy - IEEE Conference](https://ieeexplore.ieee.org/document/10539514)
- [How DePIN Bridges Crypto to Physical Systems - Grayscale](https://research.grayscale.com/reports/the-real-world-how-depin-bridges-crypto-back-to-physical-systems)
- [DePIN Wikipedia](https://en.wikipedia.org/wiki/Decentralized_physical_infrastructure_network)
- [DePINs & Next-Gen Blockchain Infrastructure - J.P. Morgan](https://www.jpmorgan.com/kinexys/content-hub/depin-decentralized-physical-infrastructure-networks)
- [Top 10 DePIN Projects in 2026 - QuickNode](https://www.quicknode.com/builders-guide/best/top-10-decentralized-physical-infrastructure-networks)

### DePIN Flywheel and Token Economics
- [DePIN Flywheel and Token Rewards - Sourceful Energy](https://sourceful.energy/blog/why-the-depin-flywheel-and-token-rewards-are-the-future-of-infrastructure-networks)
- [DePIN Flywheel Balance - Onchain Magazine](https://onchain.org/magazine/depin-flywheel-looking-for-a-perfect-balance/)
- [DePIN Tokenomics - Frontiers in Blockchain](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1644115/abstract)
- [DePIN Token Economics Report - DePINed](https://depined.xyz/report)
- [DePIN Economic Models - Parameter Ventures](https://www.parameter.ventures/p/depin-economic-models-the-good-the)
- [Tokenomics for DePIN Projects - Tokenomics.net](https://tokenomics.net/blog/tokenomics-considerations-for-depin-projects)
- [Token Incentives to Bootstrap Networks - Blockworks Research](https://app.blockworksresearch.com/unlocked/decentralized-physical-infrastructure-networks-embracing-the-power-of-token-incentives-to-bootstrap-networks)

### Helium and DePIN Lessons
- [From Hype to Fundamentals: Helium Case Study](https://medium.com/@hilary.h.brown/from-hype-to-fundamentals-helium-depin-4bc466e868d4)
- [State of Helium Q4 2024 - Messari](https://messari.io/report/state-of-helium-q4-2024)
- [Helium Technical Deep Dive - Solana](https://solana.com/news/case-study-helium-technical-guide)
- [DePIN Challenges 2024 - ChainCatcher](https://www.chaincatcher.com/en/article/2179461)
- [DePIN in 2024: Growth and Challenges - DWF Labs](https://www.dwf-labs.com/research/depin-sector-overview-growth-challenges-and-the-road-ahead)

### DIMO and IoTeX
- [DIMO Explorer - DePIN Scan](https://depinscan.io/projects/dimo)
- [IoTeX and DIMO Partnership](https://iotex.io/blog/iotex-dimo-partnership-for-mobility/)
- [IoTeX and GEODNET DePIN Verifiability](https://iotex.io/blog/iotex-and-geodnet-announce-pioneering-collaboration-for-depin-verifiability/)
- [DIMO: Decentralized Vehicle Data - Gate.io](https://www.gate.io/learn/articles/dimo-decentralized-revolution-of-vehicle-data/2789)

### DePIN Security and Anti-Gaming
- [Why DePIN Matters - a16z crypto](https://a16zcrypto.com/posts/listicles/why-depin-matters/)
- [Manipulated Signals in DePIN - a16z crypto](https://a16zcrypto.com/posts/article/manipulated-signals-in-depin-protocols/)
- [On-Device Proofs for DePIN - CoinDesk](https://www.coindesk.com/opinion/2024/08/02/on-device-proofs-solve-depin-verification-challenges)
- [DePIN Security Best Practices - Cantina](https://cantina.xyz/blog/depin-security-best-practices)

### Governance and Ostrom's Principles
- [When Ostrom Meets Blockchain - SAGE Open](https://journals.sagepub.com/doi/full/10.1177/21582440211002526)
- [DAO Design for Commons - Frontiers](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2023.1287249/full)
- [Ostrom's Principles in DAO Governance - Colony](https://blog.colony.io/applying-ostroms-principles-to-dao-governance/)
- [Decentralizing Governance: DAOs and Digital Commons - Frontiers 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1538227/full)
- [DAO Governance Evolution - Frontiers 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1630402/full)

### Sui Blockchain
- [Sui Sponsored Transactions - Docs](https://docs.sui.io/concepts/transactions/sponsored-transactions)
- [Sponsored Transactions Explained - Sui Blog](https://blog.sui.io/sponsored-transactions-explained/)
- [Built for Scale: Why Sui Stands Out - Grayscale](https://research.grayscale.com/reports/built-for-scale-why-sui-stands-out)
- [Sui Blockchain Explained 2025 - MEXC](https://www.mexc.com/news/sui-blockchain-explained-2025-move-language-high-speed-layer-1-the-future-of-web3/117173)

### Regulatory
- [SEC DePIN No-Action Letter 2025](https://www.fintechanddigitalassets.com/2025/10/sec-staff-issues-no-action-letter-for-depin-token-distributions/)
- [SEC DePIN Guidance - Bitget](https://www.bitget.site/news/detail/12560605082115)
- [Howey Test and Crypto - Skadden](https://www.skadden.com/insights/publications/2025/08/howeys-still-here)
- [SEC 2025 Token Guidance - Cointelegraph](https://cointelegraph.com/explained/secs-2025-guidance-what-tokens-are-and-arent-securities)
- [SEC Chairman Token Taxonomy - Winston & Strawn](https://www.winston.com/en/blogs-and-podcasts/capital-markets-and-securities-law-watch/sec-chairman-atkins-signals-major-shift-potential-token-taxonomy-and-evolving-application-of-howey-test-to-crypto-assets)

### peaq Network
- [peaq Network](https://www.peaq.network/)
- [State of peaq Q1 2025 - Messari](https://messari.io/report/state-of-peaq-q1-2025)
- [peaq: A Layer-1 for DePINs](https://www.peaq.xyz/blog/peaq-a-layer-1-blockchain-designed-for-depins-decentralized-physical-infrastructure-networks)
- [Why DePINs Need an Industry-Specific L1 - Blockworks](https://blockworks.co/news/why-depins-need-an-industry-specific-layer-1-blockchain)

### Chainlink
- [Chainlink IoT Integrations](https://blog.chain.link/how-chainlink-enables-blockchain-iot-integrations/)
- [Chainlink Use Cases](https://chain.link/use-cases)
- [Chainlink: Oracle to Data Infrastructure - Medium](https://medium.com/@originvc/chainlink-from-oracle-network-to-blockchain-data-infrastructure-f43430bdf295)

### Supply Chain and Manufacturing
- [VeChain Supply Chain - Gemini](https://www.gemini.com/cryptopedia/vechain-crypto-blockchain-supply-chain-management)
- [Festo Decentralized Manufacturing Marketplace](https://www.festo.com/us/en/e/about-festo/research-and-development/research-projects/blockchain-decentralized-manufacturing-marketplace-id_769647/)
- [NIST Manufacturing Supply Chain Traceability](https://www.nccoe.nist.gov/projects/manufacturing-supply-chain-traceability-using-blockchain-related-technologies)
- [Georgia Manufacturing Alliance](https://www.georgiamanufacturingalliance.com/)
- [GaMEP at Georgia Tech](https://gamep.org)
- [Industrial Commons - Manufacturing.gov](https://www.manufacturing.gov/topic/industrial-commons)

### NATS Messaging
- [NATS About](https://nats.io/about/)
- [MachineMetrics IoT with NATS - Synadia](https://www.synadia.com/customer-stories/machinemetrics)
- [NATS at the Edge - InfoQ](https://www.infoq.com/presentations/nats/)
