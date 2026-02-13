# RFC Section: Oracle Integration Architecture

```
Section:       Oracle Integration Architecture (Amendment 3)
RFC:           001 (Entity Lifecycle Event Distribution)
Number:        18.12
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-09
Research Base: docs/specifications/research-chainlink-ecosystem.md
               docs/specifications/research-mvr-smartdata.md
               docs/specifications/research-hybrid-architecture.md
               docs/specifications/research-sui-effect-integration.md
               docs/specifications/research-rfc-sui-chainlink-audit.md
Dependencies:  Section 18.11 (Sui Settlement Architecture)
               Section 20.12 (Sui Identity Objects)
               Section M (Marketplace Protocol)
```

---

## 18.12 Oracle Integration Architecture

### 18.12.1 Oracle Landscape and Constraints

#### 18.12.1.1 Scope

This section specifies the oracle architecture for the metropolitan
manufacturing commons -- the mechanism by which external, independently
verified data enters the on-chain settlement, compliance, and reputation
systems. Oracles bridge the trust gap between platform-operated infrastructure
(NATS JetStream) and decentralized trust (Sui blockchain).

The oracle layer serves three fundamental purposes:

1. **Price attestation** -- Material costs, energy rates, FX rates, and market
   indices required for dynamic pricing and settlement
2. **Verification attestation** -- Certification status, compliance proofs, and
   quality attestations verified by independent oracle nodes
3. **Cross-chain interoperability** -- Message relay and settlement between Sui
   and external blockchain networks

#### 18.12.1.2 Critical Platform Constraint: Chainlink and Sui

**CRITICAL**: As of February 2026, Chainlink does NOT natively support the Sui
blockchain. Chainlink's oracle infrastructure (Data Feeds, Data Streams,
Functions, CCIP, SmartData, Automation) is deployed on EVM-compatible chains
and, via recent expansion, on Aptos (a Move-based chain) and Solana. Sui is
NOT in the supported chain directory for any Chainlink service [CL-ECOSYSTEM].

This constraint is architecturally significant and MUST NOT be obscured. The
oracle strategy for the manufacturing commons MUST account for it explicitly.

Implementations MUST adopt the following hybrid strategy:

| Oracle Provider | Deployment | Role | Sui Integration |
|-----------------|-----------|------|-----------------|
| **Pyth Network** | Sui-native | Price feeds, commodity data, FX rates | Direct on-chain (Move module) |
| **Chainlink** | EVM sidechain | Functions, Automation, VRF, SmartData, CCIP | Via cross-chain bridge |
| **Nautilus TEE** | Sui-native | Verifiable off-chain computation, attestation | Direct on-chain (TEE attestation) |
| **Custom NATS Adapter** | Platform-operated | Manufacturing-specific data relay | Direct to Sui via SuiBridgeService |

#### 18.12.1.3 Architecture Decision Matrix

Implementations MUST use the following decision matrix when selecting an oracle
provider for a given data requirement:

```
Is the data a standard price feed (commodity, FX, crypto)?
├─ YES → Is sub-second latency required?
│        ├─ YES → Pyth Network pull oracle (Sui-native)
│        └─ NO  → Pyth Network or Chainlink Data Feed (via EVM bridge)
└─ NO  → Is the data manufacturing-internal (from NATS)?
         ├─ YES → Custom NATS→Sui bridge (no oracle needed)
         └─ NO  → Does verification require external API calls?
                  ├─ YES → Is Sui-native attestation sufficient?
                  │        ├─ YES → Nautilus TEE
                  │        └─ NO  → Chainlink Functions (via EVM bridge)
                  └─ NO  → Chainlink Data Streams custom channel (via EVM bridge)
```

#### 18.12.1.4 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

#### 18.12.1.5 Terminology

| Term | Definition |
|------|-----------|
| **DON** | Decentralized Oracle Network -- a set of independent oracle nodes that reach consensus on off-chain data |
| **Pull Oracle** | Oracle model where consumers request price updates (Pyth model) |
| **Push Oracle** | Oracle model where oracle networks push updates to on-chain contracts (traditional Chainlink Data Feeds) |
| **TEE** | Trusted Execution Environment -- hardware-isolated compute enclave |
| **MVR Feed** | Multiple-Variable Response feed -- bundles multiple data points into a single on-chain update |
| **CCIP** | Cross-Chain Interoperability Protocol (Chainlink) |
| **CRE** | Chainlink Runtime Environment -- unified workflow orchestration layer |
| **TWAP** | Time-Weighted Average Price -- manipulation-resistant price computation |
| **SLA** | Service Level Agreement governing oracle response times and availability |

---

### 18.12.2 Pyth Network Integration (Sui-Native)

#### 18.12.2.1 Overview

Pyth Network is the primary oracle for the manufacturing commons on Sui. Pyth
provides a pull-based oracle model with sub-second price delivery, 500+ price
feeds, and native Sui Move integration [PYTH-SUI].

Implementations MUST use Pyth Network for all standard price feed requirements
on Sui where low-latency price data is needed and the feed exists in Pyth's
catalog.

#### 18.12.2.2 Pull-Based Oracle Model

Pyth operates a pull-based model where the consuming application requests a
price update. This differs from traditional push-based oracles and has specific
implications for the manufacturing commons:

```
              PYTH PULL-BASED ORACLE FLOW

  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Data Provider │────>│  Pythnet         │────>│ Wormhole     │
  │ (exchange,   │     │  (aggregate +    │     │ Guardians    │
  │  market data)│     │   sign price)    │     │ (attest)     │
  └──────────────┘     └──────────────────┘     └──────┬───────┘
                                                        │
                                                        │ VAA (signed)
                                                        v
  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Consumer     │<────│  Hermes API      │<────│ Price Update │
  │ (our dApp)   │     │  (REST/WS)       │     │ Attestation  │
  │ Pull price   │     │  Latest prices   │     │              │
  └──────┬───────┘     └──────────────────┘     └──────────────┘
         │
         │ Submit price update + consumer tx
         v
  ┌──────────────────┐
  │ Sui Blockchain   │
  │ pyth::update()   │
  │ + consume price  │
  │ (single PTB)     │
  └──────────────────┘
```

**Advantages for manufacturing**:
- Consumer pays for update only when needed (cost-efficient)
- Sub-second freshness via Hermes WebSocket API
- No stale on-chain data accumulation
- Price is guaranteed fresh at point of consumption

**Constraint**: Consumer MUST submit the price update in the same PTB as the
consuming transaction. This ensures the price was fresh at the moment of use.

#### 18.12.2.3 Supported Manufacturing Price Feeds

The following price feeds from Pyth's catalog are directly relevant to the
manufacturing commons:

| Feed | Pyth Feed ID | Use Case | Update Frequency |
|------|-------------|----------|-----------------|
| **Aluminum (LME)** | `0x...` (catalog lookup) | Raw material pricing for CNC/machining | Real-time |
| **Steel (HRC)** | `0x...` | Structural steel fabrication pricing | Real-time |
| **Copper** | `0x...` | Electrical component manufacturing | Real-time |
| **Natural Gas (Henry Hub)** | `0x...` | Energy cost input for pricing engine | Real-time |
| **EUR/USD** | `0x...` | International work order settlement | Real-time |
| **GBP/USD** | `0x...` | UK supplier settlement | Real-time |
| **SUI/USD** | `0x...` | On-chain escrow valuation | Real-time |

Implementations MUST verify feed availability in the Pyth catalog before
depending on a specific feed. Feed IDs are stable but SHOULD be stored in
configuration, not hardcoded.

#### 18.12.2.4 Sui Move Integration Pattern

The on-chain consumer pattern for Pyth on Sui:

```move
module tmnl_commons::price_oracle {
    use pyth::pyth;
    use pyth::price::{Self, Price};
    use pyth::price_info::{Self, PriceInfoObject};
    use pyth::price_identifier::{PriceIdentifier};
    use sui::clock::{Clock};
    use sui::coin::{Coin};
    use sui::sui::SUI;

    /// Maximum acceptable staleness for price data.
    /// Implementations MUST NOT consume prices older than this threshold.
    const MAX_PRICE_AGE_SECS: u64 = 60;

    /// Error: Price is too stale for consumption
    const E_PRICE_STALE: u64 = 1001;
    /// Error: Price confidence interval too wide
    const E_PRICE_UNCERTAIN: u64 = 1002;

    /// Get material price with staleness and confidence checks.
    ///
    /// Implementations MUST verify:
    /// 1. Price timestamp is within MAX_PRICE_AGE_SECS of current time
    /// 2. Confidence interval is within acceptable bounds for the use case
    /// 3. Price exponent is correctly applied to the integer price value
    public fun get_verified_price(
        pyth_state: &pyth::PythState,
        price_info_object: &PriceInfoObject,
        price_update_data: vector<vector<u8>>,
        fee: Coin<SUI>,
        clock: &Clock,
    ): (i64, u64, i32) {  // (price, confidence, exponent)
        // Update price feed with latest Hermes data
        let verified_vaas = pyth::update_price_feeds(
            pyth_state,
            price_update_data,
            fee,
            clock,
        );

        // Get price with staleness check
        let price = pyth::get_price(
            pyth_state,
            price_info_object,
            clock,
            MAX_PRICE_AGE_SECS,
        );

        let price_value = price::get_price(&price);
        let confidence = price::get_conf(&price);
        let exponent = price::get_expo(&price);

        (price_value, confidence, exponent)
    }
}
```

#### 18.12.2.5 Staleness Requirements

All oracle price data consumed by the manufacturing commons MUST include
timestamp verification. Implementations MUST enforce the following staleness
thresholds:

| Use Case | Max Staleness | Rationale |
|----------|-------------|-----------|
| **Escrow valuation** | 60 seconds | Settlement amounts must reflect current pricing |
| **Dynamic pricing calculation** | 300 seconds | Hourly rate updates tolerate moderate staleness |
| **Material cost estimation** | 3600 seconds | Quoting process allows hourly granularity |
| **Compliance reporting** | 86400 seconds | Daily aggregates sufficient for regulatory reports |

Implementations MUST reject price data that exceeds the applicable staleness
threshold. The consuming transaction MUST fail rather than proceed with stale
data. This is NON-NEGOTIABLE for settlement operations.

#### 18.12.2.6 Confidence Interval Handling

Pyth provides confidence intervals alongside prices. Implementations SHOULD
use confidence intervals as follows:

- For **settlement**: Use the price midpoint. If confidence exceeds 2% of
  price value, the settlement SHOULD be deferred until confidence narrows.
- For **quoting**: Use the price + confidence as the worst-case material cost
  input, protecting the quoting organization.
- For **display**: Show both price and confidence to the user.

---

### 18.12.3 Chainlink Functions (via EVM Bridge)

#### 18.12.3.1 Overview

Chainlink Functions provides serverless JavaScript execution on a Decentralized
Oracle Network (DON). Each node independently executes the provided source code,
fetches external data, and the DON reaches consensus on the result before
returning it on-chain [CL-FUNCTIONS].

For the manufacturing commons, Chainlink Functions serves use cases that require
**external API calls with DON consensus** -- specifically, verification tasks
that Pyth cannot address and Nautilus TEE cannot reach.

Because Chainlink does NOT support Sui natively, all Functions invocations
MUST route through an EVM-compatible chain and bridge results to Sui.

#### 18.12.3.2 Architecture

```
              CHAINLINK FUNCTIONS VIA EVM BRIDGE

  ┌──────────────────┐
  │ TMNL Platform    │
  │ (Effect-TS)      │
  │                  │
  │ SuiBridgeService │──── Sui PTB: anchor attestation
  │        │         │
  │        │         │──── EVM TX: sendRequest()
  └────────┼─────────┘
           │
           v
  ┌──────────────────┐     ┌──────────────────┐
  │ EVM Sidechain    │────>│ Chainlink DON    │
  │ (Arbitrum/Base)  │     │                  │
  │                  │     │ ┌──────────────┐ │
  │ FunctionsRouter  │     │ │ Node 1: exec │ │
  │ FunctionsConsumer│     │ │ Node 2: exec │ │
  │                  │     │ │ Node 3: exec │ │
  └──────────────────┘     │ │ ...          │ │
           │               │ │ Consensus    │ │
           │               │ └──────────────┘ │
           │               └────────┬─────────┘
           │                        │ fulfillRequest()
           v                        v
  ┌──────────────────┐     ┌──────────────────┐
  │ Bridge Relay     │<────│ EVM Consumer     │
  │ (Wormhole or     │     │ Contract         │
  │  custom relay)   │     │ (stores result)  │
  └────────┬─────────┘     └──────────────────┘
           │
           v
  ┌──────────────────┐
  │ Sui Blockchain   │
  │ Attestation obj  │
  └──────────────────┘
```

**Latency budget**: 30-120 seconds end-to-end. This latency is acceptable for
verification tasks (not real-time pricing).

#### 18.12.3.3 Manufacturing Use Cases

| Use Case | JavaScript Logic | External Data Source | Priority |
|----------|-----------------|---------------------|----------|
| **Certification verification** | Fetch cert status, validate expiry, hash attestation | ISO registries, AS9100 databases, IATF portal | P1 |
| **Merkle batch verification** | Fetch batch from TMNL API, recompute Merkle root, compare | TMNL batch verification API endpoint | P1 |
| **Credit/insurance check** | Query credit rating APIs, return pass/fail | Dun & Bradstreet, trade credit APIs | P2 |
| **OEE attestation** | Fetch sensor aggregates, compute OEE, sign result | TMNL sensor aggregation API | P2 |
| **Geographic compliance** | Verify data routing paths stayed within jurisdiction | TMNL data routing audit API | P2 |

#### 18.12.3.4 Functions Source Code: Merkle Batch Verification

The following JavaScript source code MUST be deployed to the Chainlink DON for
Merkle batch verification. Each DON node independently executes this code and
the consensus result is returned on-chain:

```javascript
// Chainlink Function: Verify Merkle batch integrity
// Deployed to DON, executed by each oracle node independently
//
// args[0]: merkleRoot (hex string)
// args[1]: batchId (string)
// args[2]: orgId (string)

const merkleRoot = args[0]
const batchId = args[1]
const orgId = args[2]

// Step 1: Fetch batch data from TMNL verification API
const response = await Functions.makeHttpRequest({
  url: `https://api.tmnl.io/v1/batches/${batchId}/verify`,
  headers: {
    "X-Oracle-Key": secrets.TMNL_API_KEY,
    "X-Org-Id": orgId,
  },
  timeout: 10000,
})

if (response.error) {
  throw new Error(`TMNL API error: ${response.statusCode}`)
}

const batch = response.data

// Step 2: Verify batch metadata
if (batch.orgId !== orgId) {
  return Functions.encodeString("REJECTED:ORG_MISMATCH")
}

if (batch.eventCount === 0) {
  return Functions.encodeString("REJECTED:EMPTY_BATCH")
}

// Step 3: Independently recompute Merkle root from leaf hashes
const leaves = batch.leafHashes  // Pre-hashed leaves from API
let layer = leaves.map(l => l)

while (layer.length > 1) {
  const nextLayer = []
  for (let i = 0; i < layer.length; i += 2) {
    const left = layer[i]
    const right = i + 1 < layer.length ? layer[i + 1] : layer[i]
    // DON nodes use ethers for hashing
    nextLayer.push(ethers.utils.keccak256(
      ethers.utils.solidityPack(["bytes32", "bytes32"], [left, right])
    ))
  }
  layer = nextLayer
}

const computedRoot = layer[0]

// Step 4: Compare roots
if (computedRoot !== merkleRoot) {
  return Functions.encodeString(`REJECTED:ROOT_MISMATCH:${computedRoot}`)
}

// Step 5: Return verification attestation
const attestation = ethers.utils.defaultAbiCoder.encode(
  ["string", "bytes32", "uint256", "uint256"],
  ["VERIFIED", merkleRoot, batch.eventCount, Math.floor(Date.now() / 1000)]
)
return Functions.encodeBytes(attestation)
```

#### 18.12.3.5 Functions Source Code: Certification Verification

```javascript
// Chainlink Function: Verify ISO/AS9100 certification status
//
// args[0]: orgId (string)
// args[1]: certType (string, e.g., "ISO_9001", "AS9100")
// args[2]: certNumber (string)

const orgId = args[0]
const certType = args[1]
const certNumber = args[2]

// Query certification registry
const registryUrl = certType === "AS9100"
  ? "https://www.iaqg.org/oasis/login"  // IAQG OASIS database
  : "https://www.iso.org/certificate-search"

const response = await Functions.makeHttpRequest({
  url: `https://api.tmnl.io/v1/certs/verify`,
  headers: { "X-Oracle-Key": secrets.TMNL_API_KEY },
  params: { certType, certNumber, orgId },
  timeout: 15000,
})

if (response.error) {
  return Functions.encodeString("REJECTED:REGISTRY_UNAVAILABLE")
}

const cert = response.data

if (!cert.valid) {
  return Functions.encodeString(`REJECTED:CERT_INVALID:${cert.reason}`)
}

if (cert.expiresAt < Date.now()) {
  return Functions.encodeString("REJECTED:CERT_EXPIRED")
}

// Return attestation with certificate metadata
return Functions.encodeString(
  `VERIFIED:${certType}:${certNumber}:${cert.expiresAt}:${cert.issuingBody}`
)
```

#### 18.12.3.6 Cost Model

| Item | Cost per Invocation | Monthly Estimate (per org) |
|------|--------------------|-----------------------------|
| Chainlink Functions request | ~$0.05-$0.15 (gas + premium) | -- |
| Merkle batch verification (hourly) | $0.10 | $72/month |
| Certification verification (on-demand) | $0.10 | $0.50/month (5 certs/year) |
| OEE attestation (daily) | $0.10 | $3/month |
| **Total per org (typical)** | -- | **$75/month** |

Implementations SHOULD batch multiple verification requests within a single
Functions call where possible to reduce per-invocation overhead.

#### 18.12.3.7 Normative Requirements

- R-ORC-1: Implementations MUST deploy Chainlink Functions on an EVM chain
  that supports CCIP or has a production bridge to Sui.
- R-ORC-2: Chainlink Functions source code MUST be version-controlled and
  auditable. The source code hash SHOULD be published on-chain.
- R-ORC-3: The TMNL verification API endpoint called by Functions MUST
  implement rate limiting (per DON node), authentication (per-oracle API keys),
  and request logging.
- R-ORC-4: Functions results MUST be bridged to Sui within 5 minutes of
  fulfillment on the EVM chain.
- R-ORC-5: If Functions fulfillment fails (DON consensus not reached), the
  batch MUST be queued for retry. The MerkleAnchorService MUST NOT discard
  unfulfilled batches.

---

### 18.12.4 Chainlink Automation

#### 18.12.4.1 Overview

Chainlink Automation (formerly Keepers) provides decentralized, trust-minimized
trigger execution for time-based and condition-based smart contract operations
[CL-AUTOMATION]. For the manufacturing commons, Automation handles settlement
timeouts and compliance deadlines that no single party should control.

Because Chainlink Automation requires an EVM chain, the architecture is:

```
              AUTOMATION FOR TIMEOUT ENFORCEMENT

  ┌──────────────────┐     ┌──────────────────┐
  │ Sui Blockchain   │     │ EVM Sidechain    │
  │                  │     │                  │
  │ Escrow object:   │     │ Keeper Registry: │
  │   timeout_ms     │     │   checkUpkeep()  │
  │   created_at     │     │   performUpkeep()│
  │                  │     │                  │
  └────────┬─────────┘     └────────┬─────────┘
           │                        │
           │  State sync            │  Monitor
           └──────────┐     ┌───────┘
                      │     │
                      v     v
              ┌──────────────────┐
              │ Bridge Relay     │
              │ Monitors Sui     │
              │ escrow timeouts  │
              │ Triggers EVM     │
              │ automation       │
              └──────────────────┘
```

#### 18.12.4.2 Manufacturing Use Cases

| Use Case | Trigger Type | Action | SLA |
|----------|-------------|--------|-----|
| **Escrow timeout release** | Time-based | Release escrowed funds to seller after buyer fails to respond within deadline | Execute within 5 min of timeout |
| **Certification expiry alert** | Time-based | Flag organizations with expiring certifications; downgrade marketplace tier | Execute on expiry date |
| **Capacity reservation forfeit** | Time-based | Forfeit capacity reservation deposit if manufacturer fails to begin work by deadline | Execute within 15 min of deadline |
| **Dispute escalation** | Condition-based | Escalate dispute to arbitration panel if parties fail to resolve within 7 days | Execute within 1 hour of escalation threshold |
| **Reputation decay** | Time-based | Apply time-based reputation decay for organizations with no recent activity | Execute daily |

#### 18.12.4.3 Alternative: Sui-Native Timeout Enforcement

For use cases where EVM-bridge latency is unacceptable, implementations MAY
use a Sui-native timeout pattern:

```move
/// Anyone can call this function after the timeout has elapsed.
/// This provides permissionless timeout enforcement without an oracle.
public entry fun enforce_timeout(
    escrow: &mut Escrow,
    clock: &Clock,
) {
    let now = clock::timestamp_ms(clock);
    assert!(now >= escrow.created_at + escrow.timeout_ms, E_TIMEOUT_NOT_REACHED);
    escrow.state = RELEASED;
}
```

This pattern allows any party (or a platform-operated cron) to trigger the
timeout, removing the dependency on Chainlink Automation for simple time-based
triggers. Implementations SHOULD prefer this pattern for Sui-native operations
and reserve Chainlink Automation for condition-based triggers that require
off-chain state evaluation.

#### 18.12.4.4 Normative Requirements

- R-ORC-6: Escrow timeout enforcement MUST be permissionless. Any address
  MUST be able to trigger timeout release after the deadline has elapsed.
- R-ORC-7: Implementations MUST NOT rely solely on a single party to trigger
  timeouts. Either Chainlink Automation or permissionless Sui-native triggers
  (or both) MUST be used.
- R-ORC-8: Timeout enforcement MUST execute within 15 minutes of the deadline.
  If Chainlink Automation is used, the `checkUpkeep` interval MUST be
  configured to meet this SLA.

---

### 18.12.5 Chainlink VRF (Verifiable Random Function)

#### 18.12.5.1 Overview

Chainlink VRF provides provably random number generation. Each random value
comes with a cryptographic proof that the result was generated by the oracle
without manipulation [CL-VRF].

#### 18.12.5.2 Manufacturing Use Cases

| Use Case | Why Randomness Must Be Verifiable | Frequency |
|----------|----------------------------------|-----------|
| **Randomized audit sampling** | Audited parties must not be able to predict which batches will be selected for detailed verification | Monthly per org |
| **Dispute arbitrator selection** | Neither party to a dispute should be able to influence which arbitrator is assigned | Per dispute |
| **Quality spot-check selection** | Random selection of production lots for additional QC prevents gaming | Weekly per active work order |
| **Reputation audit** | Random selection of reputation claims for verification prevents inflation | Monthly platform-wide |

#### 18.12.5.3 Architecture

Because VRF is an EVM-only Chainlink service, the random value MUST be
generated on the EVM chain and bridged to Sui:

```
  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Sui Blockchain   │     │ EVM Sidechain    │     │ Chainlink    │
  │                  │     │                  │     │ VRF v2.5     │
  │ AuditScheduler:  │     │ VRFConsumer:     │     │              │
  │   needs random   │────>│   requestRandom()│────>│ Generate     │
  │   for sampling   │     │                  │     │ + Prove      │
  │                  │     │                  │<────│              │
  │ Receive random   │<────│   fulfillRandom()│     └──────────────┘
  │ via bridge       │     │                  │
  └──────────────────┘     └──────────────────┘
```

#### 18.12.5.4 Normative Requirements

- R-ORC-9: Randomized audit sampling MUST use verifiable randomness. Platform
  operators MUST NOT be able to predict or influence which batches are selected.
- R-ORC-10: The VRF proof MUST be stored on Sui alongside the random value so
  that any party can independently verify the randomness was not manipulated.
- R-ORC-11: Dispute arbitrator selection MUST use VRF when the arbitration
  pool contains more than one eligible arbitrator.

---

### 18.12.6 Chainlink CCIP (Cross-Chain Interoperability Protocol)

#### 18.12.6.1 Overview

CCIP enables cross-chain messaging and token transfers between blockchains.
For the manufacturing commons, CCIP provides the infrastructure for multi-chain
settlement and cross-network reputation portability [CL-CCIP].

**CRITICAL STATUS**: CCIP does NOT currently support Sui as a destination or
source chain. Aptos (Move-based), Solana, and 60+ EVM chains are supported.
This section specifies the architecture for when Sui CCIP support becomes
available, and the interim bridge strategy.

#### 18.12.6.2 Interim Bridge Strategy

Until CCIP supports Sui natively, implementations MUST use one of the
following bridge strategies:

| Option | Bridge | Latency | Cost | Trust Assumption |
|--------|--------|---------|------|-----------------|
| **A (RECOMMENDED)** | Wormhole | 5-15 min | ~$0.10/msg | Wormhole Guardian set (19/19 signatures) |
| **B** | Custom relay | 1-5 min | Gas only | Platform operator (single point of trust) |
| **C** | Wait for CCIP | N/A | N/A | Blocks on Chainlink roadmap |

Implementations SHOULD use Option A (Wormhole) for production deployments
and Option B (custom relay) for development/testing environments.

#### 18.12.6.3 Cross-Chain Use Cases

| Use Case | CCIP Primitive | Latency | Monthly Volume (est.) |
|----------|---------------|---------|----------------------|
| **Multi-chain settlement** | Programmable token transfer | 5-20 min | Low (enterprises only) |
| **Reputation portability** | Arbitrary messaging | 5-20 min | On demand |
| **Supply chain interop** | Arbitrary messaging | 5-20 min | Per bilateral agreement |
| **Cross-network audit** | Arbitrary messaging | 5-20 min | On demand |

#### 18.12.6.4 CCIP Fee Model

| Transfer Type | LINK Payment | Native Token Payment |
|--------------|-------------|---------------------|
| Token transfers | 0.063% of amount | 0.07% of amount |
| Messaging (Ethereum lanes) | $0.45 flat | $0.50 flat |
| Messaging (non-Ethereum lanes) | $0.09 flat | $0.10 flat |

At 100 cross-chain messages per day (platform-wide):
- Non-Ethereum lanes: 100 x $0.09 = **$9/day** ($270/month)
- Plus destination chain gas costs

#### 18.12.6.5 Normative Requirements

- R-ORC-12: Cross-chain settlement MUST NOT proceed until the bridge message
  has been confirmed on both source and destination chains.
- R-ORC-13: Implementations MUST implement a dead-letter queue for failed
  cross-chain messages. Failed messages MUST be retried with exponential
  backoff, not silently dropped.
- R-ORC-14: The bridge strategy MUST be abstracted behind the SuiBridgeService
  interface (Section 22.X) so that the transition from Wormhole to CCIP
  requires no consumer-facing changes.

---

### 18.12.7 Custom Data Streams for Manufacturing Intelligence

#### 18.12.7.1 Overview

Chainlink Data Streams and SmartData MVR (Multiple-Variable Response) feeds
enable publication of manufacturing-specific data products. These are bundles
of verified, attested data points published on-chain for consumption by
marketplace contracts and external parties [CL-SMARTDATA].

#### 18.12.7.2 Manufacturing Data Products

The following custom data streams SHOULD be developed as the commons scales:

| Data Product | Variables | Update Frequency | Consumers |
|-------------|-----------|-----------------|-----------|
| **Regional Capacity Index** | Available machine count, avg utilization %, avg hourly rate, capability breakdown | 60-second heartbeat | Marketplace matching, pricing engine |
| **Material Price Index** | Aluminum spot, steel HRC, titanium, copper -- regional premiums applied | 5-minute heartbeat | Dynamic pricing, quoting engine |
| **Quality Aggregate** | Regional avg OEE, defect rate (PPM), first-pass yield, SPC status | Hourly | Reputation system, buyer discovery |
| **Energy Cost Index** | Industrial electricity rate, natural gas rate -- by utility zone | Hourly | Dynamic pricing, ESG reporting |

#### 18.12.7.3 SmartData MVR Feed Schema

The manufacturing commons publishes verified multi-field data bundles following
the Chainlink MVR feed pattern:

```
SmartQuality MVR Bundle:
┌──────────────────────────────────────────────────────┐
│ Field                    │ Type    │ Decimals │ Unit  │
├──────────────────────────┼─────────┼──────────┼───────┤
│ oee_percentage           │ uint256 │ 2        │ %     │
│ defect_rate_ppm          │ uint256 │ 0        │ PPM   │
│ first_pass_yield         │ uint256 │ 4        │ ratio │
│ spc_status               │ uint8   │ 0        │ enum  │
│ compliance_hash          │ bytes32 │ --       │ --    │
│ measurement_timestamp    │ uint256 │ 0        │ epoch │
└──────────────────────────┴─────────┴──────────┴───────┘

SmartCapacity MVR Bundle:
┌──────────────────────────────────────────────────────┐
│ Field                    │ Type    │ Decimals │ Unit  │
├──────────────────────────┼─────────┼──────────┼───────┤
│ available_hours_weekly   │ uint256 │ 0        │ hours │
│ current_utilization_pct  │ uint256 │ 2        │ %     │
│ lead_time_days           │ uint256 │ 0        │ days  │
│ material_availability    │ bool    │ --       │ --    │
│ machine_count            │ uint256 │ 0        │ count │
│ measurement_timestamp    │ uint256 │ 0        │ epoch │
└──────────────────────────┴─────────┴──────────┴───────┘
```

#### 18.12.7.4 Normative Requirements

- R-ORC-15: All data products MUST include a `measurement_timestamp` field.
  Consumers MUST verify freshness before using data in settlement decisions.
- R-ORC-16: Aggregate data products (e.g., Regional Capacity Index) MUST
  enforce k-anonymity with k >= 5. No data product SHALL be published that
  could identify the capacity status of fewer than 5 organizations.
- R-ORC-17: Custom data streams SHOULD be published to the EVM chain first
  and bridged to Sui, following the same pattern as other Chainlink services.

---

### 18.12.8 Nautilus TEE Attestation (Sui-Native)

#### 18.12.8.1 Overview

Sui Nautilus provides trusted execution environments for verifiable off-chain
computation. A Nautilus enclave executes computations in hardware-isolated
memory, and produces a cryptographic attestation that the computation was
performed correctly [SUI-NAUTILUS].

For the manufacturing commons, Nautilus is the **Sui-native alternative** to
Chainlink Functions for computations that do not require external API calls
but do require verifiable integrity.

#### 18.12.8.2 Architecture

```
              NAUTILUS TEE ATTESTATION FLOW

  ┌──────────────────┐
  │ NATS JetStream   │
  │ Sensor readings  │
  │ Entity events    │
  └────────┬─────────┘
           │ Batch of readings
           v
  ┌──────────────────┐
  │ Nautilus TEE     │
  │ Enclave          │
  │                  │
  │ 1. Receive batch │
  │ 2. Compute OEE   │
  │ 3. Compute SPC   │
  │ 4. Generate      │
  │    attestation   │
  └────────┬─────────┘
           │ Signed attestation
           v
  ┌──────────────────┐
  │ Sui Blockchain   │
  │                  │
  │ AttestationObj:  │
  │   computation_id │
  │   result_hash    │
  │   tee_signature  │
  │   timestamp      │
  └──────────────────┘
```

#### 18.12.8.3 Manufacturing Use Cases

| Use Case | Computation | Why TEE? |
|----------|------------|----------|
| **OEE verification** | Availability x Performance x Quality from raw sensor data | Prevents organizations from inflating their OEE scores |
| **SPC analysis** | Control chart computation, Cp/Cpk calculation | Ensures statistical methods were applied correctly |
| **Quality metric computation** | Defect rate, first-pass yield from inspection data | Tamper-proof quality reporting for marketplace |
| **Compliance threshold check** | Verify all readings within regulatory spec | Proves compliance without revealing raw readings |

#### 18.12.8.4 Nautilus vs Chainlink Functions Decision Matrix

| Criterion | Nautilus TEE | Chainlink Functions |
|-----------|-------------|-------------------|
| **Sui-native** | YES | NO (EVM bridge) |
| **External API calls** | LIMITED (enclave network restrictions) | YES (full HTTP access) |
| **Latency** | <5 seconds | 10-30 seconds + bridge |
| **Cost** | Gas only (~$0.003) | Gas + LINK premium (~$0.10) |
| **Trust model** | TEE hardware attestation | DON BFT consensus (2/3 nodes) |
| **Decentralization** | Single TEE operator (weaker) | Multi-node DON (stronger) |
| **Best for** | Internal data verification | External data fetching + verification |

Implementations SHOULD use Nautilus for internal data verification (OEE, SPC,
quality metrics from NATS data) and Chainlink Functions for external data
verification (certifications, credit checks, geographic compliance).

#### 18.12.8.5 Normative Requirements

- R-ORC-18: Nautilus TEE attestations MUST include the TEE quote (hardware
  attestation) alongside the computation result.
- R-ORC-19: The Sui smart contract that consumes Nautilus attestations MUST
  verify the TEE quote before accepting the result.
- R-ORC-20: Implementations SHOULD run Nautilus enclaves on at least 2
  independent TEE providers to mitigate single-vendor hardware vulnerabilities.

---

### 18.12.9 Oracle Security Model

#### 18.12.9.1 Price Manipulation Resistance

Implementations MUST employ the following defenses against oracle price
manipulation:

| Defense | Mechanism | Applicable To |
|---------|-----------|---------------|
| **TWAP** | Time-Weighted Average Price computed over configurable window (minimum 15 minutes) | All settlement pricing |
| **Circuit breakers** | Reject price updates that deviate >10% from previous accepted price within a 5-minute window | Escrow valuation, dynamic pricing |
| **Multi-source verification** | Cross-reference Pyth price with at least one secondary source before settlement | Settlement amounts >$10,000 |
| **Confidence threshold** | Reject prices where oracle confidence interval exceeds 5% of price value | All price-dependent operations |
| **Staleness detection** | All price data MUST include timestamp; reject stale prices per 18.12.2.5 thresholds | All oracle consumers |

#### 18.12.9.2 DON Consensus Security

For Chainlink Functions and Data Streams:

- The DON operates with Byzantine Fault Tolerance. A minimum of 2/3 + 1 oracle
  nodes MUST agree on a result before it is finalized.
- Implementations MUST NOT accept oracle results from a DON with fewer than 4
  nodes (minimum for BFT with 1 faulty node).
- Oracle node rotation SHOULD be enabled to prevent long-term collusion.

#### 18.12.9.3 Fallback Strategy

If an oracle is unavailable, the manufacturing commons MUST degrade gracefully:

| Oracle Failure | Impact | Response |
|---------------|--------|----------|
| **Pyth unavailable** | Cannot price material costs | Settlement PAUSES; work orders continue in NATS; resume on oracle recovery |
| **Chainlink Functions timeout** | Cannot verify Merkle batch or certification | Batch queued for retry; marketplace continues with existing trust scores |
| **Chainlink VRF unavailable** | Cannot select audit sample | Defer audit selection; use deterministic (less secure) fallback after 24h |
| **Nautilus TEE unreachable** | Cannot attest OEE/SPC | Use unattested values with `trust_level: "self_reported"` flag; marketplace displays warning |
| **All oracles down** | No external verification | Platform enters "NATS-only" mode; settlement pauses; real-time operations continue |

**Critical invariant**: Oracle unavailability MUST cause settlement to **pause**,
never to **proceed with unverified data**. NATS real-time operations (sensor
readings, alarms, entity state) are NOT affected by oracle outages.

#### 18.12.9.4 Cost Budget and Alerting

Implementations MUST enforce per-organization oracle usage caps to prevent
runaway costs:

| Organization Tier | Monthly Oracle Budget | Alert Threshold | Hard Cap |
|-------------------|---------------------|-----------------|----------|
| **Solo** (1-5 machines) | $50 | 80% ($40) | 120% ($60) |
| **Small** (6-20 machines) | $200 | 80% ($160) | 120% ($240) |
| **Medium** (21-100 machines) | $1,000 | 80% ($800) | 120% ($1,200) |
| **Enterprise** (100+ machines) | $5,000 | 80% ($4,000) | 120% ($6,000) |

When an organization reaches its alert threshold, the platform MUST notify the
organization admin. When the hard cap is reached, non-critical oracle calls
(OEE attestation, reputation updates) MUST be throttled. Settlement-critical
oracle calls (escrow valuation, certification verification) MUST NOT be
throttled.

#### 18.12.9.5 Normative Requirements

- R-ORC-21: Implementations MUST use TWAP (minimum 15-minute window) for all
  settlement pricing. Spot prices MUST NOT be used directly for settlement.
- R-ORC-22: Circuit breakers MUST be implemented for all price feeds.
  Deviation thresholds MUST be configurable per feed type.
- R-ORC-23: Oracle unavailability MUST cause settlement operations to pause.
  Implementations MUST NOT fall back to unverified pricing for settlement.
- R-ORC-24: Per-organization oracle cost caps MUST be enforced. Alerting
  MUST trigger at the 80% threshold.
- R-ORC-25: All oracle interactions MUST be logged with timestamps, oracle
  provider, request parameters, and response status for audit trail purposes.

---

### 18.12.10 Effect-TS Oracle Service Architecture

#### 18.12.10.1 Service Definition

The oracle layer is composed as Effect-TS services with Layer-based dependency
injection. This enables testing with mock oracles and gradual adoption.

```typescript
import { Context, Effect, Layer, Schema, Stream, Schedule } from 'effect'

// ─── Oracle Error Types ──────────────────────────────────────────

class OracleError extends Schema.TaggedError<OracleError>()(
  'OracleError',
  {
    provider: Schema.Literal('pyth', 'chainlink', 'nautilus', 'custom'),
    code: Schema.Literal(
      'UNAVAILABLE', 'STALE_PRICE', 'CONFIDENCE_TOO_WIDE',
      'CIRCUIT_BREAKER', 'BUDGET_EXCEEDED', 'VERIFICATION_FAILED'
    ),
    message: Schema.String,
    retryable: Schema.Boolean,
  }
) {}

// ─── Pyth Oracle Service ─────────────────────────────────────────

const PythFeedId = Schema.String.pipe(Schema.brand('PythFeedId'))

const PriceResult = Schema.TaggedStruct('PriceResult', {
  feedId: PythFeedId,
  price: Schema.Number,
  confidence: Schema.Number,
  exponent: Schema.Number,
  publishTime: Schema.Number,
  provider: Schema.Literal('pyth'),
})

interface PythOracleService {
  readonly getPrice: (
    feedId: Schema.Schema.Type<typeof PythFeedId>
  ) => Effect.Effect<Schema.Schema.Type<typeof PriceResult>, OracleError>

  readonly getPriceWithStalenessCheck: (
    feedId: Schema.Schema.Type<typeof PythFeedId>,
    maxAgeSecs: number
  ) => Effect.Effect<Schema.Schema.Type<typeof PriceResult>, OracleError>

  readonly subscribePriceUpdates: (
    feedIds: ReadonlyArray<Schema.Schema.Type<typeof PythFeedId>>
  ) => Stream.Stream<Schema.Schema.Type<typeof PriceResult>, OracleError>
}

const PythOracleService = Context.GenericTag<PythOracleService>(
  'PythOracleService'
)

// ─── Chainlink Oracle Service ────────────────────────────────────

const FunctionRequestId = Schema.String.pipe(
  Schema.brand('FunctionRequestId')
)

const FunctionResult = Schema.TaggedStruct('FunctionResult', {
  requestId: FunctionRequestId,
  result: Schema.String,
  timestamp: Schema.Number,
  gasUsed: Schema.Number,
})

interface ChainlinkOracleService {
  readonly requestFunction: (params: {
    source: string
    args: ReadonlyArray<string>
    secretsUrl?: string
  }) => Effect.Effect<
    Schema.Schema.Type<typeof FunctionResult>,
    OracleError
  >

  readonly requestVRF: (params: {
    numWords: number
  }) => Effect.Effect<ReadonlyArray<bigint>, OracleError>
}

const ChainlinkOracleService = Context.GenericTag<ChainlinkOracleService>(
  'ChainlinkOracleService'
)

// ─── Nautilus Attestation Service ────────────────────────────────

const AttestationResult = Schema.TaggedStruct('AttestationResult', {
  computationId: Schema.String,
  resultHash: Schema.String,
  teeQuote: Schema.String,
  timestamp: Schema.Number,
})

interface NautilusService {
  readonly attest: (params: {
    computation: string
    inputs: ReadonlyArray<unknown>
  }) => Effect.Effect<
    Schema.Schema.Type<typeof AttestationResult>,
    OracleError
  >
}

const NautilusService = Context.GenericTag<NautilusService>(
  'NautilusService'
)

// ─── Composed Oracle Layer ───────────────────────────────────────

// OracleLayer composes all oracle services for the manufacturing commons
const OracleLayer = Layer.mergeAll(
  PythOracleServiceLive,
  ChainlinkOracleServiceLive,
  NautilusServiceLive,
).pipe(
  Layer.provide(SuiClientLive),        // Pyth needs Sui RPC
  Layer.provide(EvmClientLive),        // Chainlink needs EVM RPC
  Layer.provide(OracleConfigLive),     // API keys, endpoints, budgets
)
```

#### 18.12.10.2 Normative Requirements

- R-ORC-26: Each oracle provider MUST be wrapped in its own Effect Service
  with a dedicated Layer. Implementations MUST NOT call oracle SDKs directly
  from business logic.
- R-ORC-27: All oracle services MUST implement `Effect.retry` with exponential
  backoff for transient failures. The retry schedule MUST be configurable.
- R-ORC-28: Oracle services MUST be testable with mock Layers. The test suite
  MUST include tests with simulated oracle failures.
- R-ORC-29: The oracle budget enforcement (R-ORC-24) MUST be implemented as
  an Effect middleware that wraps all oracle service calls.

---

### 18.12.11 Cost Summary

#### 18.12.11.1 Per-Organization Monthly Oracle Costs

| Org Size | Machines | Pyth Feeds | Chainlink Functions | Nautilus TEE | VRF | Total/month |
|----------|----------|-----------|--------------------|--------------|----|-------------|
| **Earl** (Solo) | 2 | $0.50 | $12 (hourly batches) | $2 | $0.10 | **~$15** |
| **Mid Shop** | 20 | $2 | $72 (hourly batches) | $20 | $0.50 | **~$95** |
| **Enterprise** | 200 | $5 | $720 (hourly batches) | $200 | $2 | **~$927** |

#### 18.12.11.2 Platform-Wide Monthly Costs (200K Organizations)

| Component | Monthly Estimate | Notes |
|-----------|-----------------|-------|
| Pyth price feed consumption | $20,000 | Shared feeds, amortized across orgs |
| Chainlink Functions | $2,000,000 | Dominant cost; optimize batch intervals |
| Nautilus TEE compute | $200,000 | Lower cost than Chainlink |
| Chainlink VRF | $5,000 | Low volume, audit sampling only |
| Cross-chain bridges | $50,000 | CCIP/Wormhole messaging |
| **Total** | **~$2,275,000** | |

**Optimization lever**: Chainlink Functions is the dominant cost. Moving
verification workloads from Chainlink Functions to Nautilus TEE where external
API calls are not required reduces platform costs by ~40%.

---

### 18.12.12 References

| Tag | Reference |
|-----|-----------|
| [CL-ECOSYSTEM] | Chainlink Ecosystem, https://chain.link/ecosystem |
| [CL-FUNCTIONS] | Chainlink Functions Documentation, https://docs.chain.link/chainlink-functions |
| [CL-AUTOMATION] | Chainlink Automation Documentation, https://docs.chain.link/chainlink-automation |
| [CL-VRF] | Chainlink VRF Documentation, https://docs.chain.link/vrf |
| [CL-CCIP] | Chainlink CCIP Documentation, https://docs.chain.link/ccip |
| [CL-SMARTDATA] | Chainlink SmartData Documentation, https://docs.chain.link/data-feeds/smartdata |
| [CL-BILLING] | Chainlink CCIP Billing, https://docs.chain.link/ccip/billing |
| [PYTH-SUI] | Pyth Network Sui Integration, https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/sui |
| [SUI-NAUTILUS] | Sui Nautilus Documentation, https://docs.sui.io/concepts/cryptography/nautilus |
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", RFC 2119, March 1997 |

---

*This section was authored by Val (Vigilant Architecture Layer) on 2026-02-09.
All Chainlink integration patterns are based on published documentation as of
February 2026. The Chainlink-Sui native integration status SHOULD be
re-evaluated quarterly. All Pyth patterns are based on production Sui mainnet
integration documentation.*
