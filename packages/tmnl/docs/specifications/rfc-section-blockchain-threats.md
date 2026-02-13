# RFC-001 Amendment 4: Section 19.3.5 -- Blockchain-Specific Threat Model

```
Section:      19.3.5 — Blockchain-Specific Threat Model
RFC:          TMNL-RFC-001
Status:       DRAFT
Author:       Val (Vigilant Architecture Layer)
Date:         2026-02-09
Amends:       Section 19.3 (Threat Model)
Dependencies: Section 19.3.1 (Network Threats)
              Section 19.3.2 (Application Threats)
              Section 19.3.3 (Data Threats)
              Section 19.3.4 (Operational Threats)
References:   research-sui-blockchain-integration.md
              research-chainlink-ecosystem.md
              research-hybrid-architecture.md (Section 7)
              research-rfc-sui-chainlink-audit.md (S-1 through S-10)
              research-sui-identity-auth.md (Sections 6, 8, 11)
Keywords:     The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
              "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
              "MAY", and "OPTIONAL" in this document are to be
              interpreted as described in RFC 2119 [RFC2119].
```

---

## 19.3.5 Blockchain-Specific Threat Model

The introduction of Sui blockchain as the trust and settlement layer, Chainlink oracle infrastructure as the attestation bridge, and the SuiBridgeService as the NATS-to-chain relay creates three new attack surfaces that are absent from the existing NATS-only threat model (Sections 19.3.1--19.3.4). This section provides a systematic analysis of blockchain-specific threats, their severity, mitigations inherent to the chosen technology stack, and normative requirements for the manufacturing commons.

The threat analysis follows the architecture principle established in the hybrid architecture research: *data moves from hot (NATS) to cold (Sui) as trust requirements increase; speed decreases, permanence increases.* Threats are analyzed at each layer and at the interfaces between layers.

### 19.3.5.1 Threat Surface Overview

The blockchain integration introduces three distinct attack surfaces beyond those covered in Sections 19.3.1--19.3.4:

| Attack Surface | Components | Trust Boundary |
|----------------|-----------|----------------|
| **Sui Smart Contracts** | Move modules (escrow, org_registry, capability, reputation, compliance_anchor, marketplace), Programmable Transaction Blocks (PTBs), object model | Cryptographic -- Sui validator consensus (Mysticeti BFT, 2f+1 of 3f+1 validators) |
| **Oracle Infrastructure** | Chainlink Functions (DON compute), Chainlink Data Streams (price feeds), Chainlink Data Feeds (push-based), future CCIP lanes | Decentralized oracle network -- DON BFT consensus (2/3 node agreement) |
| **Bridge Service** | SuiBridgeService (Effect-TS Layer), MerkleAnchorService, Auth Bridge (NATS Auth Callout), MarketplaceSignalBridge | Platform-operated -- Effect-TS service within TMNL infrastructure |

**Threat Actor Classification:**

| Actor | Capability | Motivation | Examples |
|-------|-----------|-----------|---------|
| **TA-1: Malicious Organization** | Legitimate platform participant with valid Sui address and NATS account | Financial gain, competitive intelligence, reputation manipulation | Sybil attacker creating fake orgs; org inflating quality scores |
| **TA-2: External Attacker** | No platform credentials; targets infrastructure | Financial theft, disruption, data exfiltration | Smart contract exploiter; DDoS against bridge service |
| **TA-3: Compromised Oracle** | Controls one or more Chainlink DON nodes | False attestation, price manipulation, data injection | Insider at oracle operator; compromised node infrastructure |
| **TA-4: Governance Attacker** | Accumulates governance tokens or stake weight | Capture governance decisions, redirect treasury, modify protocol rules | Hostile acquisition of stake; coordinated voting bloc |
| **TA-5: Compromised Platform Operator** | Controls SuiBridgeService, NATS infrastructure, gas station | Forge attestations, manipulate bridge, censor transactions | Insider threat; supply chain compromise of platform infrastructure |

**Risk Classification Alignment:**

This section uses the same risk classification as Sections 19.3.1--19.3.4:

| Level | Likelihood x Impact | Response Requirement |
|-------|--------------------|--------------------|
| **CRITICAL** | Any likelihood x Catastrophic impact, or High likelihood x High impact | Immediate architectural mitigation; formal verification REQUIRED |
| **HIGH** | Medium+ likelihood x High impact, or High likelihood x Medium impact | Architectural mitigation REQUIRED; monitoring REQUIRED |
| **MEDIUM** | Medium likelihood x Medium impact | Mitigation RECOMMENDED; monitoring RECOMMENDED |
| **LOW** | Low likelihood x Low impact | Mitigation MAY be implemented; awareness sufficient |

---

### 19.3.5.2 Smart Contract Threats (Sui Move)

The manufacturing commons deploys Move modules for escrow, organization identity, capability NFTs, reputation tokens, compliance anchoring, and marketplace operations. Move's resource-oriented type system provides structural defenses against several classes of vulnerabilities common in EVM-based smart contracts. However, logic-level vulnerabilities remain possible.

#### T-BC-1: Logic Bug in Escrow Module

**Threat**: An incorrect state transition guard in the `commons::escrow` Move module allows unauthorized release of escrowed funds. For example, a missing assertion in `release()` permits the seller to self-release escrow without buyer confirmation or QC attestation.

**Severity**: CRITICAL

**Threat Actor**: TA-1 (Malicious Organization), TA-2 (External Attacker)

**Attack Vector**: Attacker identifies a logic flaw in the escrow state machine -- for instance, calling `timeout_release()` with a manipulated Clock object reference, or exploiting a state where `FUNDED` transitions directly to `SETTLED` bypassing the `RELEASED` intermediate state.

**Move Mitigations (By Design)**:
- **Linear types** prevent double-spending: a `Coin<SUI>` object consumed by escrow cannot be simultaneously spent elsewhere. The `Escrow` struct holds a `Balance<SUI>` which is a linear resource -- it must be explicitly consumed via `balance::withdraw_all` or transferred. There is no path to duplicate the balance.
- **No reentrancy**: Move's execution model does not permit re-entrant calls. A function executing `settle()` cannot be recursively invoked before the first invocation completes. This eliminates the entire class of reentrancy attacks that have caused billions in losses on EVM chains.
- **Type-safe state encoding**: Escrow state is encoded as `u8` constants. Move's abort semantics ensure that any assertion failure (`assert!(escrow.state == FUNDED, E_INVALID_STATE)`) aborts the entire transaction, leaving no partial state.

**Residual Risk**: Logic errors in guard conditions remain possible despite Move's type safety. For example:
- Off-by-one in timeout calculation (`now >= created_at + timeout_ms` vs `now > created_at + timeout_ms`)
- Missing authorization check (function does not verify `tx_context::sender(ctx) == order.buyer`)
- Incorrect state transition ordering (allowing `FROZEN -> RELEASED` when only `FROZEN -> DISPUTED -> RESOLVED` should be permitted)

**Normative Requirements**:
- **R-BC-1.1**: Escrow Move modules MUST undergo formal verification using the Move Prover before deployment to Sui mainnet. The formal specification MUST cover all state transition invariants, fund conservation (total escrowed = sum of all active escrow balances), and authorization predicates.
- **R-BC-1.2**: Escrow Move modules MUST be audited by at least one independent security firm with demonstrated Move/Sui audit experience before mainnet deployment.
- **R-BC-1.3**: The escrow module MUST implement a `dryRun` validation step via the SuiBridgeService before executing any settlement PTB. The dry run result MUST be verified to match expected state changes before signing and submitting the transaction.
- **R-BC-1.4**: The escrow module SHOULD implement a time-locked upgrade policy. Package upgrades MUST require multi-signature authorization from the platform governance multi-sig (see Section 20.12).

---

#### T-BC-2: Access Control Bypass

**Threat**: An unauthorized party calls an `entry` function that should be restricted to a specific role (e.g., the buyer, the platform operator, or a designated arbiter). For example, a random Sui address calls `work_order::complete()` to release escrow to the seller without being the buyer.

**Severity**: HIGH

**Threat Actor**: TA-1 (Malicious Organization), TA-2 (External Attacker)

**Attack Vector**: The attacker submits a Sui transaction calling the `entry` function directly, bypassing any off-chain authorization checks. If the Move function does not verify the caller's identity against the expected role, the function executes with the attacker's address as `tx_context::sender(ctx)`.

**Move Mitigations (By Design)**:
- **Sender verification**: Move entry functions receive `TxContext` which provides `sender(ctx)` -- the authenticated Sui address of the transaction signer. This address is cryptographically verified by Sui validators and cannot be forged.
- **Capability-based access control**: The Sui capability pattern uses owned objects (`OrgAdminCap`, `MarketplaceParticipantCap`, `QualityInspectorCap`) as authorization tokens. Functions that require a capability reference (`cap: &OrgAdminCap`) can only be called by the address that owns the capability object. Move's borrow checker ensures the caller demonstrably possesses the object.

**Residual Risk**:
- Developer error: omitting the `assert!(tx_context::sender(ctx) == expected_address)` check from a function that requires it.
- Capability delegation: if a capability object has the `store` ability, it can be transferred to an unauthorized address. If it lacks `store`, it is soulbound to the original recipient.

**Normative Requirements**:
- **R-BC-2.1**: Every `entry` function in the manufacturing commons Move modules that modifies economic state (escrow, reputation, marketplace) MUST verify caller authorization via either `tx_context::sender(ctx)` comparison or capability object reference.
- **R-BC-2.2**: Capability objects used for authorization (e.g., `OrgAdminCap`, `PlatformAdminCap`) MUST NOT have the `store` ability unless transferability is an explicit design requirement. Soulbound (non-transferable) SHOULD be the default.
- **R-BC-2.3**: Authorization checks MUST be the first operations in any state-mutating entry function, before any reads or writes to shared objects.

---

#### T-BC-3: Integer Overflow/Underflow

**Threat**: Arithmetic manipulation in fee calculation, escrow splitting, or settlement amounts causes incorrect fund distribution. For example, an attacker crafts a transaction where `amount * network_fee_bps` overflows, resulting in a near-zero fee and the attacker receiving nearly all escrowed funds.

**Severity**: HIGH (on EVM); **LOW** (on Sui Move)

**Threat Actor**: TA-1 (Malicious Organization), TA-2 (External Attacker)

**Move Mitigations (By Design)**:
- **Automatic overflow abort**: Move arithmetic operations (`+`, `-`, `*`, `/`) abort the transaction on overflow or underflow by default. There is no wrapping arithmetic. An expression `amount * network_fee_bps` where the result exceeds `u64::MAX` (18,446,744,073,709,551,615) will abort the entire transaction, not wrap to a small number.
- **Division by zero abort**: Division by zero aborts the transaction rather than producing undefined behavior.
- **No unchecked arithmetic**: Unlike Solidity (pre-0.8.0) or C, Move has no mode for unchecked arithmetic. All arithmetic is checked at runtime.

**Residual Risk**: Effectively zero for standard arithmetic operations. The only scenario where integer issues could arise is through explicit truncation in type casts (e.g., casting a `u128` to `u64`), which is uncommon in the manufacturing commons Move modules.

**Normative Requirements**:
- **R-BC-3.1**: Move modules SHOULD use `u64` for all monetary amounts (denominated in MIST, Sui's smallest unit). This provides a maximum value of ~18.4 quintillion MIST, equivalent to ~18.4 billion SUI, which is well above the total SUI supply.
- **R-BC-3.2**: Fee calculations MUST perform multiplication before division to minimize truncation loss: `fee = (amount * fee_bps) / 10000` rather than `fee = amount * (fee_bps / 10000)`.

---

#### T-BC-4: Object Duplication / Fake Identity Creation

**Threat**: An attacker creates counterfeit organization identity objects, capability NFTs, or reputation tokens to impersonate a legitimate organization or fraudulently claim manufacturing capabilities they do not possess.

**Severity**: HIGH

**Threat Actor**: TA-1 (Malicious Organization)

**Attack Vector**: The attacker deploys their own Move package mimicking the manufacturing commons module structure and creates objects with identical field values to a legitimate organization's objects. Alternatively, the attacker attempts to call the legitimate module's `mint_verified()` function without being an authorized verifier.

**Move Mitigations (By Design)**:
- **One-Time Witness (OTW) pattern**: Module-level singleton objects are created using the OTW pattern, where the `init()` function runs exactly once on package publication. The platform's `AdminCap` and `TreasuryCap` objects are created via OTW, ensuring no second instance can exist.
- **Package publisher authority**: Move modules are published by a specific address. Only the publishing address (or an address holding the `UpgradeCap`) can upgrade the package. Objects created by package `0xAAAA::org_registry` are typed differently from objects created by a fake package `0xBBBB::org_registry` -- the full package address is part of the type identity.
- **Type system prevents cross-package substitution**: A function requiring `&commons::escrow::Escrow` will not accept an object of type `fake::escrow::Escrow`, even if all fields are identical. The Sui runtime enforces type identity at the package level.

**Residual Risk**:
- Off-chain systems (dashboards, indexers) that do not verify the originating package address could display fake objects as legitimate.
- The SuiBridgeService must verify that on-chain objects originate from the canonical manufacturing commons package ID.

**Normative Requirements**:
- **R-BC-4.1**: Identity, capability, and reputation objects MUST use the One-Time Witness (OTW) creation guard pattern for any singleton or authority objects.
- **R-BC-4.2**: The SuiBridgeService MUST verify that all on-chain objects it reads or references originate from the canonical manufacturing commons package ID. Objects from non-canonical packages MUST be rejected.
- **R-BC-4.3**: The canonical package ID MUST be stored in a platform configuration (e.g., Effect-TS Layer config, NATS KV) and updated only via the package upgrade governance ceremony.
- **R-BC-4.4**: Off-chain indexers and dashboards MUST filter Sui objects by the canonical package ID. Unverified package IDs MUST NOT be displayed to users without an explicit warning.

---

### 19.3.5.3 Oracle Threats

Chainlink oracle infrastructure bridges off-chain manufacturing data (from NATS JetStream) to on-chain smart contracts (on Sui). The oracle layer operates between the platform-operated hot path and the cryptographically-secured cold path. Compromise of the oracle layer can inject false data into permanent on-chain records.

#### T-BC-5: Price Feed Manipulation

**Threat**: A manipulated price feed from Chainlink Data Feeds or Pyth Network causes incorrect marketplace settlement. For example, an attacker manipulates the aluminum spot price feed downward before settling a large work order, reducing the seller's payment.

**Severity**: HIGH

**Threat Actor**: TA-3 (Compromised Oracle), TA-2 (External Attacker via market manipulation)

**Attack Vector**:
1. **Direct oracle manipulation**: Compromise of oracle source APIs or oracle node infrastructure to inject false price data.
2. **Market manipulation**: Temporary manipulation of the underlying market (e.g., illiquid commodity market) to move the oracle-reported price, then executing settlement during the manipulation window.

**Mitigations**:
- **Time-Weighted Average Price (TWAP)**: Using a time-weighted average over a minimum window rather than spot price prevents momentary price spikes or dips from affecting settlement.
- **Circuit breakers**: On-chain price deviation checks reject data that deviates beyond a configured threshold from the last accepted value.
- **Multiple oracle sources**: Cross-referencing Chainlink Data Feeds with Pyth Network feeds (already live on Sui) provides independent verification. Discrepancy beyond threshold triggers manual review.
- **Heartbeat + deviation model**: Chainlink Data Feeds update on heartbeat (periodic) and deviation (triggered by % change). Stale data is detectable via timestamp.

**Normative Requirements**:
- **R-BC-5.1**: Settlement price feeds MUST use a time-weighted average price (TWAP) computed over a minimum 5-minute window. Spot prices MUST NOT be used directly for settlement calculations.
- **R-BC-5.2**: The settlement smart contract MUST implement a circuit breaker that rejects price updates deviating more than [CONFIGURABLE, default 10%] from the previous accepted price within a single heartbeat interval.
- **R-BC-5.3**: Settlement operations exceeding [CONFIGURABLE, default $10,000 USD equivalent] MUST cross-reference at least two independent oracle sources (e.g., Chainlink + Pyth). Divergence exceeding [CONFIGURABLE, default 2%] between sources MUST halt settlement and trigger manual review.
- **R-BC-5.4**: All price data used in settlement MUST be recorded on-chain as part of the settlement PTB, creating an immutable audit trail of the price inputs.

---

#### T-BC-6: Oracle DON Compromise

**Threat**: A majority (>2/3) of Chainlink DON oracle nodes collude or are simultaneously compromised, allowing them to produce a false consensus on off-chain data. For example, compromised nodes attest that a Merkle root is valid when the underlying NATS event data has been tampered with.

**Severity**: HIGH

**Threat Actor**: TA-3 (Compromised Oracle), TA-2 (External Attacker with infrastructure access)

**Attack Vector**: The attacker compromises 2/3 or more of the nodes in the DON assigned to the manufacturing commons. The compromised nodes return false attestations that pass DON consensus, resulting in fraudulent on-chain records.

**Mitigations**:
- **DON diversity requirements**: Chainlink DON nodes are operated by independent, geographically distributed operators with distinct infrastructure. Compromising 2/3 of a diverse DON requires simultaneously breaching multiple independent security perimeters.
- **Threshold signatures**: DON consensus uses threshold cryptographic signatures where a minimum quorum of nodes must agree. The threshold can be configured per DON.
- **Economic incentives**: Chainlink node operators stake LINK tokens that can be slashed for provably false attestations. The economic cost of collusion must exceed the potential gain.
- **Independent verification**: The manufacturing commons can operate a verification service that independently queries NATS data and compares against oracle attestations, detecting discrepancies.

**Residual Risk**: If the DON assigned to the manufacturing commons has few operators or operators with shared infrastructure dependencies (e.g., same cloud provider), collusion risk increases. This is a configuration risk, not a protocol risk.

**Normative Requirements**:
- **R-BC-6.1**: Oracle attestation results SHOULD be verified against at least one independent data source when used for compliance-critical operations (FDA 21 CFR Part 11, ITAR, SOC 2). Independent verification MAY be performed by a platform-operated verification service that queries NATS data directly.
- **R-BC-6.2**: The platform SHOULD monitor oracle attestation patterns for anomalies, including: sudden changes in attestation latency, attestation results that diverge from independent NATS data queries, and node set composition changes.
- **R-BC-6.3**: For compliance-critical anchoring (T1 tier organizations per the tiered anchoring model), the platform SHOULD use a DON with a minimum of [CONFIGURABLE, default 7] independent node operators.

---

#### T-BC-7: Stale Oracle Data

**Threat**: Settlement or compliance anchoring uses outdated oracle data because the Chainlink DON has not updated within the expected freshness window. For example, a settlement uses a material price that is 6 hours old, during which the actual market price moved significantly.

**Severity**: MEDIUM

**Threat Actor**: TA-2 (External Attacker via DON disruption), TA-5 (Compromised Platform Operator disabling refresh)

**Attack Vector**: The attacker disrupts communication between the DON and the manufacturing commons (e.g., DDoS on the Chainlink API endpoint, or network partition between DON and Sui RPC), causing oracle data to become stale while settlement proceeds with the last known value.

**Mitigations**:
- **Timestamp validation**: All oracle reports include a timestamp of when the data was observed and when the DON reached consensus. The consuming smart contract can validate freshness.
- **Staleness bounds**: Configurable maximum age for oracle data. Data exceeding the staleness bound is rejected.
- **Pull-based architecture**: Chainlink Data Streams use a pull-based model where the consuming application requests fresh data on-demand, rather than relying on push updates. This gives the application control over freshness.

**Normative Requirements**:
- **R-BC-7.1**: All oracle data consumed by manufacturing commons smart contracts MUST include the observation timestamp and the DON consensus timestamp.
- **R-BC-7.2**: Oracle data with an observation timestamp older than [CONFIGURABLE] seconds MUST be rejected by the consuming smart contract. Default staleness bounds:
  - Price feeds for settlement: 300 seconds (5 minutes)
  - Compliance attestations: 3600 seconds (1 hour)
  - Capacity data: 60 seconds (1 minute)
- **R-BC-7.3**: The SuiBridgeService MUST pre-fetch oracle data and verify freshness before constructing settlement PTBs. Stale data MUST trigger a fresh oracle request before proceeding.

---

#### T-BC-8: Flash Loan Attack

**Threat**: An attacker uses a flash loan (instant uncollateralized borrowing within a single transaction) to temporarily manipulate an oracle-observed market, execute a settlement at the manipulated price, and repay the loan -- all within one atomic transaction.

**Severity**: LOW (on Sui)

**Threat Actor**: TA-2 (External Attacker)

**Attack Vector**: On EVM chains, flash loans from protocols like Aave or dYdX enable attackers to temporarily control massive capital within a single transaction, manipulate DEX-based oracle prices, execute profitable trades, and repay the loan. The attack is profitable if the manipulated settlement exceeds the flash loan fee.

**Mitigations (Sui-Specific)**:
- **Limited flash loan infrastructure on Sui**: As of February 2026, the Sui DeFi ecosystem is significantly smaller than Ethereum's. Flash loan protocols are less mature and have lower liquidity, reducing the capital available for manipulation.
- **TWAP mitigation**: The TWAP requirement (R-BC-5.1) prevents single-transaction price manipulation from affecting settlement, because the TWAP spans multiple transactions across a time window.
- **Object model**: Sui's object-centric model means shared objects (like marketplace state) require consensus, adding latency that prevents same-transaction manipulation of multiple shared objects in the way EVM atomic transactions can.
- **Pull-based oracle**: Chainlink Data Streams' pull model means the price data is fetched separately from the settlement transaction, unlike EVM where oracle reads and settlement can occur in a single atomic transaction.

**Residual Risk**: As the Sui DeFi ecosystem matures, flash loan protocols may achieve higher liquidity, increasing this risk. Periodic re-evaluation is warranted.

**Normative Requirements**:
- **R-BC-8.1**: Settlement smart contracts MUST use TWAP-based pricing (per R-BC-5.1), which inherently mitigates single-transaction price manipulation.
- **R-BC-8.2**: The platform SHOULD monitor the Sui DeFi ecosystem for the emergence of high-liquidity flash loan protocols and re-evaluate this threat when total flash loan liquidity on Sui exceeds [CONFIGURABLE, default $100M USD].

---

### 19.3.5.4 Bridge Service Threats

The SuiBridgeService is the platform-operated component that mediates between NATS JetStream (hot path) and Sui blockchain (cold path). It constructs and submits Sui transactions on behalf of organizations. Because it operates within the platform's trust boundary, compromise of the bridge service can have cascading effects across both layers.

#### T-BC-9: Bridge Service Compromise

**Threat**: An attacker gains control of the SuiBridgeService, enabling them to submit malicious transactions to Sui using the platform's signing keys. For example, the attacker submits a settlement PTB that releases escrow to an attacker-controlled address instead of the legitimate seller.

**Severity**: CRITICAL

**Threat Actor**: TA-2 (External Attacker), TA-5 (Compromised Platform Operator)

**Attack Vector**: The attacker exploits a vulnerability in the SuiBridgeService (RCE, dependency supply chain attack, infrastructure compromise) to gain control of the transaction signing process. The attacker then constructs and signs malicious PTBs.

**Mitigations**:
- **Organization wallet signing**: Settlement transactions require the organization's own wallet signature, not just the platform's. The SuiBridgeService constructs the PTB, but the organization must co-sign. The bridge service cannot unilaterally release escrow.
- **Multi-signature for high-value transactions**: Transactions above a configurable threshold require multi-sig authorization (per Section 8 of the identity auth research). The bridge service holds at most one key of the multi-sig set.
- **Transaction simulation (dry run)**: All PTBs are simulated via `SuiClient.dryRun()` before signing. The expected state changes are verified against the operation intent. Unexpected state changes abort the operation.
- **HSM-backed signing**: The platform's Sui signing key is stored in a Hardware Security Module (HSM) with transaction rate limiting and audit logging.
- **Anomaly detection**: Transaction patterns are monitored for anomalies (unusual recipients, abnormal amounts, high frequency).

**Normative Requirements**:
- **R-BC-9.1**: Transactions above [CONFIGURABLE, default $1,000 USD equivalent] MUST require multi-signature authorization where at least one signature comes from the affected organization's wallet and at least one from the platform operator.
- **R-BC-9.2**: All Sui transactions submitted by the SuiBridgeService MUST be simulated via dry run before signing. The dry run result MUST be validated against expected state changes. Transactions with unexpected object mutations MUST be rejected and logged as a security event.
- **R-BC-9.3**: The SuiBridgeService's Sui signing key MUST be stored in a Hardware Security Module (HSM) or equivalent secure key management system. The HSM MUST enforce transaction rate limiting (maximum [CONFIGURABLE] transactions per minute).
- **R-BC-9.4**: The SuiBridgeService MUST log all submitted transactions with full PTB contents, dry run results, and signing metadata. Logs MUST be retained for a minimum of [CONFIGURABLE, default 7 years] for compliance audit purposes.

---

#### T-BC-10: NATS-Sui State Divergence

**Threat**: The authoritative state in NATS JetStream and the anchored state on Sui permanently diverge. For example, NATS records that an escrow has been released (via entity state event), but the on-chain escrow object remains in `FUNDED` state because the Sui transaction failed silently. Or conversely, the on-chain state transitions to `SETTLED` but the NATS entity event was never published.

**Severity**: HIGH

**Threat Actor**: TA-5 (Compromised Platform Operator), or systemic (infrastructure failure, race condition, bug in bridge service)

**Attack Vector**:
1. **Transaction failure without propagation**: The SuiBridgeService submits a Sui transaction that fails (gas exhaustion, shared object contention, validator rejection), but the failure is not propagated back to the NATS entity handler. The NATS-side state machine advances as if the transaction succeeded.
2. **Event loss**: The Sui transaction succeeds but the bridge service crashes before publishing the confirmation event to NATS. NATS state remains stale.
3. **Intentional manipulation**: A compromised bridge service selectively drops confirmation events or fabricates failure responses.

**Mitigations**:
- **Reconciliation daemon**: A background service periodically compares NATS entity state with on-chain object state, detecting divergence.
- **Idempotent bridge operations**: The SuiBridgeService uses idempotency keys (derived from the NATS event sequence number) to ensure that retried operations produce the same on-chain result.
- **Outbox pattern**: The bridge service uses an outbox table (or NATS KV) to track pending Sui transactions. Transactions are not removed from the outbox until both the Sui transaction is confirmed AND the NATS confirmation event is published.
- **On-chain event monitoring**: The platform subscribes to Sui events emitted by the manufacturing commons package and independently verifies that expected events occur within bounded time.

**Normative Requirements**:
- **R-BC-10.1**: The SuiBridgeService MUST detect and alert on state divergence between NATS entity state and Sui on-chain state within [CONFIGURABLE, default 5 minutes] of divergence onset.
- **R-BC-10.2**: The SuiBridgeService MUST implement the outbox pattern for all state-mutating Sui transactions. A transaction MUST NOT be considered complete until both the Sui transaction receipt is confirmed and the corresponding NATS event is published and acknowledged.
- **R-BC-10.3**: A reconciliation daemon MUST run at [CONFIGURABLE, default 15-minute] intervals, comparing NATS entity state for all active escrow and work order entities against their on-chain counterparts. Divergence MUST trigger an alert and SHOULD trigger automatic remediation where safe to do so.
- **R-BC-10.4**: The NATS entity handler MUST treat on-chain state as authoritative for escrow and settlement state. If reconciliation detects divergence, the NATS state MUST be corrected to match the on-chain state, not the reverse.

---

#### T-BC-11: Transaction Replay

**Threat**: A previously submitted and executed Sui transaction is replayed, causing duplicate settlement, double escrow funding, or duplicate reputation token minting.

**Severity**: MEDIUM

**Threat Actor**: TA-1 (Malicious Organization), TA-2 (External Attacker)

**Attack Vector**: The attacker captures a valid settlement transaction (including signatures) and resubmits it to the Sui network, attempting to trigger a second settlement for the same work order.

**Mitigations (Sui-Specific)**:
- **Object versioning**: Sui objects have a monotonically increasing version number. A transaction that references an object at version N will fail if the object is at version N+1 (because a prior transaction already mutated it). This is the primary replay protection mechanism in Sui's object model.
- **Linear types (object consumption)**: When a Sui object is consumed (e.g., `Escrow` destructured in `settle()`), it ceases to exist. A replayed `settle()` transaction referencing the now-deleted `Escrow` object will fail because the object no longer exists.
- **Transaction digest uniqueness**: Each Sui transaction has a unique digest derived from its contents (including the object versions referenced). Sui validators reject duplicate transaction digests.
- **Nonce management**: The SuiBridgeService tracks submitted transaction digests and rejects duplicate submission requests at the application layer.

**Residual Risk**: Effectively zero for properly consumed objects. The risk exists only if the Move module mutates an object (changing version) rather than consuming it -- a replayed mutation transaction would still fail due to version mismatch.

**Normative Requirements**:
- **R-BC-11.1**: Settlement operations MUST consume (destructure) the `Escrow` object upon successful settlement, ensuring the object ceases to exist and cannot be referenced by a replay attempt.
- **R-BC-11.2**: The SuiBridgeService MUST maintain a local cache of submitted transaction digests (minimum retention: 24 hours) and MUST reject duplicate submission requests.

---

### 19.3.5.5 Consensus and Network Threats

These threats target the Sui blockchain's consensus mechanism and network layer. They are largely inherited from Sui's security model and are included for completeness and risk assessment within the manufacturing commons context.

#### T-BC-12: Validator Collusion

**Threat**: Sui validators controlling more than 1/3 of the total stake collude to censor or reorder transactions targeting the manufacturing commons. For example, colluding validators refuse to include a specific organization's transactions, effectively freezing their escrow and marketplace access.

**Severity**: LOW

**Threat Actor**: TA-4 (Governance Attacker controlling validator stake)

**Analysis**:
- Sui uses Mysticeti BFT consensus (v2 since November 2025), which provides safety as long as >2/3 of validators (by stake weight) are honest. As of early 2026, Sui mainnet has 100+ validators with a diverse stake distribution.
- **Censorship resistance**: With >2/3 honest validators, censored transactions will eventually be included by honest validators. Temporary censorship (1-2 epochs) is theoretically possible with >1/3 colluding stake, but permanent censorship requires >2/3.
- **Reordering**: Sui's DAG-based consensus reduces the impact of transaction reordering compared to linear blockchains. Owned-object transactions bypass consensus entirely (fast path), making them immune to validator ordering manipulation.

**Residual Risk**: For the manufacturing commons specifically, the risk is low because: (a) most manufacturing commons transactions use owned objects (identity, compliance anchoring, reputation), which bypass consensus; (b) the commons represents a small fraction of total Sui network activity, making targeted censorship economically irrational; (c) Sui's validator set is large and diverse.

**Normative Requirements**:
- **R-BC-12.1** (INFORMATIVE): The manufacturing commons inherits Sui's BFT safety guarantee: consensus is safe as long as >2/3 of validator stake is honest. The platform SHOULD monitor the Sui validator set composition and alert if stake concentration in any single entity or colluding group approaches 1/3.
- **R-BC-12.2**: The platform SHOULD prefer owned-object operations over shared-object operations where the application logic permits. Owned objects bypass consensus and are immune to validator censorship.

---

#### T-BC-13: Front-Running / MEV (Maximal Extractable Value)

**Threat**: A validator or observer monitors pending transactions and front-runs them for profit. For example, an observer sees a pending large marketplace settlement transaction and submits a transaction that manipulates the capacity listing price before the settlement executes.

**Severity**: LOW

**Threat Actor**: TA-2 (External Attacker), validators, or mempool observers

**Analysis**:
- **Sui's DAG-based consensus reduces ordering manipulation**: Unlike linear blockchains where block producers fully control transaction ordering within a block, Sui's DAG consensus (Mysticeti) processes transactions in parallel. Transactions on different objects execute concurrently without ordering dependencies.
- **Owned objects have no mempool exposure**: Owned-object transactions are processed via the fast path without entering the consensus mempool, making them invisible to front-running observers.
- **Shared objects have limited MEV surface**: Shared-object transactions go through consensus, where validators could theoretically reorder them. However, the manufacturing commons' shared objects (marketplace, work orders) have limited financial MEV compared to DeFi trading pairs.

**Mitigations**:
- **Commit-reveal for sensitive operations**: For competitive marketplace operations (sealed-bid auctions per the marketplace protocol), a commit-reveal scheme prevents observers from seeing bid values before the reveal phase.
- **Time-locked transactions**: Settlement transactions can include a minimum timestamp before which they cannot execute, reducing the window for front-running.

**Normative Requirements**:
- **R-BC-13.1**: Sealed-bid marketplace operations (RFQ quoting) SHOULD use a commit-reveal scheme on Sui to prevent front-running of bid values. The commit phase MUST use a cryptographic hash of the bid. The reveal phase MUST verify the hash matches.
- **R-BC-13.2**: Settlement transactions SHOULD be submitted with a maximum acceptable price deviation parameter. The smart contract MUST abort the transaction if the actual price at execution time deviates from the expected price by more than [CONFIGURABLE, default 1%].

---

#### T-BC-14: Sui Network Partition or Outage

**Threat**: The Sui network experiences a partition or complete outage, rendering all on-chain operations unavailable. During the outage, the manufacturing commons cannot perform identity verification, escrow operations, marketplace settlement, or compliance anchoring.

**Severity**: MEDIUM

**Threat Actor**: Systemic (network failure, software bug, coordinated attack on validators)

**Analysis**:
- Sui mainnet has experienced brief outages historically (most L1 blockchains have). The Mysticeti v2 consensus reduces the likelihood of consensus failures, but zero downtime cannot be guaranteed.
- The manufacturing commons' hot path (NATS JetStream) is entirely independent of Sui. Sensor data collection, entity state transitions, alarm processing, and equipment state changes continue unaffected.
- The cold path (settlement, compliance anchoring, identity operations) is unavailable during a Sui outage.

**Mitigations**:
- **SuiBridgeService queue + retry**: The bridge service queues pending Sui transactions during an outage and replays them in order when connectivity resumes. Transactions are persisted in NATS KV to survive bridge service restarts.
- **NATS continues independently**: The fundamental principle of the hybrid architecture is that NATS real-time operations MUST NOT depend on Sui availability.
- **Multiple RPC endpoints**: The SuiService is configured with multiple Sui RPC endpoints (Mysten Labs fullnode, Shinami, BlockEden, self-hosted) for redundancy.
- **Graceful degradation**: The platform transitions to a "NATS-only" mode where marketplace operations are paused (no new escrow), but existing work-in-progress continues.

**Normative Requirements**:
- **R-BC-14.1**: NATS real-time operations (sensor ingestion, entity state transitions, alarm processing, equipment state changes, WebSocket subscriptions) MUST NOT depend on Sui blockchain availability. A Sui outage MUST NOT degrade hot-path operations.
- **R-BC-14.2**: The SuiBridgeService MUST queue pending transactions during a Sui outage and MUST replay them in chronological order upon connectivity restoration. Queued transactions MUST be persisted durably (NATS KV or equivalent) and MUST survive bridge service restarts.
- **R-BC-14.3**: The SuiService Layer MUST be configured with at least [CONFIGURABLE, default 3] independent Sui RPC endpoints. Endpoint health MUST be monitored with automatic failover.
- **R-BC-14.4**: The platform MUST expose a health indicator reflecting Sui connectivity status. Dashboard UIs SHOULD display a degraded-mode indicator when Sui is unavailable.

---

### 19.3.5.6 Governance and Economic Threats

These threats target the governance and economic mechanisms of the manufacturing commons, including any future token-based governance, staking for Sybil resistance, and treasury management.

#### T-BC-15: Governance Attack

**Threat**: A governance mechanism (if implemented) that uses token-weighted or stake-weighted voting is captured by an adversarial entity that accumulates sufficient voting power to unilaterally change protocol rules, redirect treasury funds, or modify smart contract parameters.

**Severity**: HIGH

**Threat Actor**: TA-4 (Governance Attacker)

**Attack Vector**: The attacker acquires a majority of governance tokens (via market purchase, token farming through Sybil attack, or social engineering of delegation) and submits governance proposals that benefit the attacker at the expense of the commons.

**Mitigations**:
- **Time-locked governance**: Governance changes are subject to a minimum timelock period during which the community can review and object. Emergency proposals may have a shorter timelock but require a higher quorum.
- **Reputation-weighted voting**: Voting power is weighted by on-chain reputation (G-10 trust score) in addition to or instead of pure token holdings. This makes governance capture more expensive because reputation cannot be purchased -- it must be earned through legitimate platform participation.
- **Quorum requirements**: Governance proposals require a minimum participation threshold (quorum) to pass. Low-participation votes cannot be used to sneak through adversarial changes.
- **Veto mechanisms**: A security council or guardian multi-sig has the ability to veto clearly adversarial proposals within the timelock period.

**Normative Requirements**:
- **R-BC-15.1**: If token-weighted governance is implemented, governance changes MUST have a minimum timelock period of [CONFIGURABLE, default 7 days] between proposal approval and execution.
- **R-BC-15.2**: Governance proposals MUST require a quorum of [CONFIGURABLE, default 10%] of eligible voting power for standard proposals and [CONFIGURABLE, default 25%] for proposals modifying core protocol parameters (fee rates, escrow logic, identity requirements).
- **R-BC-15.3**: Governance SHOULD incorporate reputation-weighted voting where an organization's voting power is a function of both stake and G-10 trust score, reducing the effectiveness of pure capital-based governance capture.
- **R-BC-15.4**: A guardian multi-sig (minimum 5-of-9) SHOULD have the ability to veto governance proposals during the timelock period. Veto power MUST be limited to preventing execution; it MUST NOT enable the guardian to unilaterally enact changes.

---

#### T-BC-16: Token Price Manipulation

**Threat**: If the manufacturing commons uses a native token ($TMNL) for staking, governance, or transaction fees, manipulation of the token's market price could affect staking requirements, governance power distribution, or the economic viability of platform operations.

**Severity**: MEDIUM

**Threat Actor**: TA-2 (External Attacker), TA-4 (Governance Attacker)

**Attack Vector**: The attacker manipulates the $TMNL token price on decentralized exchanges (via flash loans, wash trading, or market manipulation) and then exploits the manipulated price in governance votes, staking calculations, or fee assessments.

**Mitigations**:
- **Separate governance from token price**: Governance power should be derived from time-weighted average stake (not spot stake), reputation score, and participation history -- not token price.
- **Time-locked unstaking**: Staked tokens require a cooldown period for unstaking, preventing flash-stake attacks where an attacker temporarily stakes large amounts for a single governance vote.
- **TWAP for staking calculations**: Staking-based Sybil resistance calculations use time-weighted average stake over a minimum window, not instantaneous balance.

**Normative Requirements**:
- **R-BC-16.1**: If staking is used for Sybil resistance, staking calculations MUST use the time-weighted average stake over a minimum [CONFIGURABLE, default 30 days] window, not instantaneous balance.
- **R-BC-16.2**: Unstaking MUST require a cooldown period of [CONFIGURABLE, default 14 days] during which tokens are locked and do not accrue governance power.
- **R-BC-16.3**: Governance power calculations MUST NOT depend solely on token holdings. Reputation score (G-10) and platform participation history SHOULD be incorporated as additional factors.

---

#### T-BC-17: Sybil Attack via Cheap Identity

**Threat**: An attacker creates many fake manufacturing organizations on the Sui blockchain with minimal cost, then uses these fake identities to manipulate marketplace matching, inflate reputation through self-dealing, game governance votes, or conduct wash trading of capacity tokens.

**Severity**: HIGH

**Threat Actor**: TA-1 (Malicious Organization)

**Attack Vector**: If organization registration requires only a Sui transaction (cost: ~$0.003), an attacker can create thousands of fake organizations for less than $10. These fake organizations then:
1. Submit work orders to each other, completing them instantly to build fraudulent reputation.
2. Vote as a bloc in governance decisions.
3. Artificially inflate marketplace activity and capacity metrics.
4. Claim sponsored gas subsidies intended for legitimate small organizations.

**Mitigations**:
- **Minimum stake requirement**: Organization activation requires staking a minimum amount of SUI or $TMNL tokens. The stake is returned upon legitimate departure but slashed for provable fraud.
- **Progressive trust tiers**: New organizations start at `NEWCOMER` tier with severely limited capabilities (browse only). Access to marketplace operations, escrow, and reputation accrual requires progression through trust tiers, which requires demonstrated legitimate activity over time.
- **Peer validation**: Trust tier progression from `ESTABLISHED` to `TRUSTED` and beyond requires peer validation from organizations that are themselves `TRUSTED` or `PREMIUM`. This creates a web-of-trust barrier that Sybil identities cannot self-generate.
- **Chainlink verification**: Capability claims are verified by Chainlink Functions querying external certification databases. Fake organizations cannot produce valid external certifications.
- **Economic friction**: Cross-org work orders require different buyer and seller addresses (enforced in the Move module). Self-dealing between addresses owned by the same entity is detectable via on-chain analysis.

**Normative Requirements**:
- **R-BC-17.1**: Organization identity activation on the manufacturing commons MUST require a minimum stake of [CONFIGURABLE, default 10 SUI] that is locked for the duration of active platform membership.
- **R-BC-17.2**: New organizations MUST start at `NEWCOMER` trust tier with limited capabilities. Marketplace participation (escrow, bidding, settlement) MUST require at least `BASIC` trust tier.
- **R-BC-17.3**: Trust tier progression MUST require demonstrated legitimate activity that includes interaction with organizations at equal or higher trust tiers. Self-referential trust building (interactions solely between commonly-controlled addresses) MUST be detectable and SHOULD trigger review.
- **R-BC-17.4**: The work order Move module MUST enforce that the buyer and seller addresses are different. Work orders between addresses controlled by the same entity SHOULD be detectable via on-chain graph analysis.

---

### 19.3.5.7 Key Management Threats

These threats address the cryptographic key management challenges introduced by the dual-key architecture (Sui identity key + NATS account key) recommended in the identity auth research.

#### T-BC-18: Organization Key Loss

**Threat**: An organization permanently loses access to its Sui private key, resulting in inability to sign transactions, frozen escrow funds, unrecoverable identity, and loss of all on-chain capabilities and reputation.

**Severity**: HIGH

**Threat Actor**: Accidental (hardware failure, lost backup, personnel departure)

**Attack Vector**: This is not an adversarial attack but an operational failure. Scenarios include:
1. Earl's $5 hardware token breaks and he has no backup of the seed phrase.
2. A key employee who held the sole private key leaves the organization.
3. A natural disaster destroys the facility containing the only copy of the key.

**Mitigations**:
- **Multi-sig recovery**: Organizations are strongly encouraged to use multi-sig wallets (2-of-3 or 3-of-5). Loss of one key does not prevent transaction execution.
- **Social recovery**: A future social recovery mechanism where designated trusted organizations can attest to the identity of the key holder and authorize a key rotation to a new address.
- **Key escrow**: The platform MAY offer an optional, encrypted key escrow service where organizations deposit an encrypted backup of their key, recoverable via a challenge-response protocol.
- **Hierarchical key derivation**: Using BIP-32 or similar hierarchical deterministic key derivation, multiple device keys can be derived from a master seed, enabling recovery from any device holding a derived key.

**Normative Requirements**:
- **R-BC-18.1**: Organizations SHOULD configure multi-signature wallets (minimum 2-of-3) for their Sui identity, ensuring that loss of a single key does not result in identity loss.
- **R-BC-18.2**: The platform SHOULD provide documentation and tooling for secure key backup procedures, including encrypted seed phrase storage and multi-location backup strategies.
- **R-BC-18.3**: The platform MAY offer an optional social recovery mechanism where [CONFIGURABLE, default 3-of-5] designated trusted organizations can authorize a key rotation ceremony for a lost key.
- **R-BC-18.4**: For escrow objects containing significant value, the Move module SHOULD implement a time-locked emergency recovery mechanism where, if neither buyer nor seller acts within [CONFIGURABLE, default 90 days], the escrow can be resolved by an arbitration panel via multi-sig.

---

#### T-BC-19: Organization Key Compromise

**Threat**: An attacker obtains an organization's Sui private key, gaining the ability to sign transactions as the organization -- transferring funds, releasing escrow, modifying identity, claiming capabilities, and spending reputation.

**Severity**: CRITICAL

**Threat Actor**: TA-2 (External Attacker via phishing, malware, infrastructure breach)

**Attack Vector**: The attacker compromises the private key through:
1. Phishing attack targeting the key holder (social engineering).
2. Malware on the device storing the key.
3. Breach of the key management infrastructure (cloud HSM, secrets manager).
4. Insider threat (disgruntled employee with key access).

**Mitigations**:
- **HSM storage**: Private keys stored in Hardware Security Modules (HSMs) are resistant to software-based extraction. The HSM performs signing operations internally without exposing the key material.
- **Multi-sig requirement**: Even if one key is compromised, multi-sig wallets (2-of-3) prevent unauthorized transactions. The attacker would need to compromise multiple independent keys.
- **Key rotation ceremony**: On detection of compromise, the organization initiates a key rotation via the on-chain DID document update mechanism. The old key is deauthorized and a new key is authorized, all in a single atomic transaction signed by the remaining (uncompromised) multi-sig keys.
- **On-chain revocation**: Compromised capability objects can be burned (revoked) by the platform using the `RevocationAuthorityCap`. NATS JWTs signed by the compromised key can be revoked by updating the account JWT to exclude the compromised signing key.
- **Dual-key architecture**: Per the identity auth research (Section 6.4), the Sui identity key and NATS account key are separate. Compromise of the NATS key does not grant on-chain authority, and vice versa. This limits blast radius.

**Normative Requirements**:
- **R-BC-19.1**: Key rotation MUST be supported without identity loss. The on-chain identity object MUST support address migration, where the organization's on-chain identity (capabilities, reputation, compliance anchors) can be re-bound to a new Sui address via a governance-approved key rotation ceremony.
- **R-BC-19.2**: The dual-key architecture MUST be implemented: separate Ed25519 keypairs for Sui identity (cold storage/HSM) and NATS account (warm storage). Compromise of one key MUST NOT grant access to the other system.
- **R-BC-19.3**: Organizations with active escrow value exceeding [CONFIGURABLE, default $10,000 USD equivalent] MUST use multi-signature wallets for their Sui identity.
- **R-BC-19.4**: The platform MUST provide an emergency key compromise response procedure that includes: (a) immediate suspension of the compromised address via platform-side blocklist; (b) NATS JWT revocation for all JWTs associated with the compromised key; (c) guided key rotation ceremony with multi-sig authorization; (d) post-incident audit of all transactions signed by the compromised key.
- **R-BC-19.5**: The platform SHOULD implement anomaly detection for on-chain transactions, flagging unusual patterns (e.g., transactions from a new IP/geography, unusual transaction frequency, large value transfers) associated with an organization's address.

---

### 19.3.5.8 Threat Severity Matrix

| Threat ID | Threat | Likelihood | Impact | Risk Level | Primary Mitigation | Move/Sui Mitigation Status |
|-----------|--------|-----------|--------|-----------|-------------------|---------------------------|
| T-BC-1 | Logic bug in escrow module | MEDIUM | CATASTROPHIC | **CRITICAL** | Formal verification, audit | Reentrancy prevented by design; linear types prevent double-spend; logic errors remain possible |
| T-BC-2 | Access control bypass | LOW | HIGH | **HIGH** | Capability-based auth, sender checks | Capability pattern enforced by type system; developer omission possible |
| T-BC-3 | Integer overflow/underflow | LOW | HIGH | **LOW** | N/A (mitigated by design) | Move aborts on overflow/underflow by default; no residual risk |
| T-BC-4 | Object duplication / fake identity | MEDIUM | HIGH | **HIGH** | OTW pattern, package ID verification | Package-level type identity prevents cross-package substitution |
| T-BC-5 | Price feed manipulation | MEDIUM | HIGH | **HIGH** | TWAP, circuit breakers, multi-source | Requires external oracle discipline; Move cannot verify price independently |
| T-BC-6 | Oracle DON compromise | LOW | HIGH | **HIGH** | DON diversity, economic incentives, independent verification | Outside Move/Sui mitigation scope; application-layer verification required |
| T-BC-7 | Stale oracle data | MEDIUM | MEDIUM | **MEDIUM** | Timestamp checks, staleness bounds | Application-layer validation in Move smart contract |
| T-BC-8 | Flash loan attack | LOW | MEDIUM | **LOW** | TWAP, limited Sui flash loan infrastructure | Sui DeFi immaturity is current mitigation; re-evaluate as ecosystem matures |
| T-BC-9 | Bridge service compromise | LOW | CATASTROPHIC | **CRITICAL** | Multi-sig, dry run, HSM, anomaly detection | Move multi-sig support is native; dry run available via SDK |
| T-BC-10 | NATS-Sui state divergence | MEDIUM | HIGH | **HIGH** | Outbox pattern, reconciliation daemon, on-chain authority | Application-layer pattern; not directly mitigated by Move/Sui |
| T-BC-11 | Transaction replay | LOW | MEDIUM | **MEDIUM** | Object versioning, linear types, digest uniqueness | Sui object model prevents replay by design |
| T-BC-12 | Validator collusion | LOW | HIGH | **LOW** | Mysticeti BFT (2/3 honest), diverse validator set | Sui consensus design; owned objects bypass consensus entirely |
| T-BC-13 | Front-running / MEV | LOW | MEDIUM | **LOW** | Commit-reveal, DAG consensus, owned objects | Sui DAG reduces ordering manipulation; owned objects immune |
| T-BC-14 | Sui network partition | LOW | MEDIUM | **MEDIUM** | Queue + retry, NATS independence, multi-endpoint | Application-layer resilience; NATS hot path unaffected |
| T-BC-15 | Governance attack | MEDIUM | HIGH | **HIGH** | Timelock, reputation-weighted voting, quorum, guardian veto | Move can enforce timelock and quorum on-chain |
| T-BC-16 | Token price manipulation | MEDIUM | MEDIUM | **MEDIUM** | TWAP stake, cooldown, multi-factor governance | Application-layer policy; Move can enforce cooldown |
| T-BC-17 | Sybil attack via cheap identity | HIGH | MEDIUM | **HIGH** | Minimum stake, progressive tiers, peer validation, external verification | Move can enforce stake and tier requirements; Chainlink for external verification |
| T-BC-18 | Key loss | MEDIUM | HIGH | **HIGH** | Multi-sig recovery, social recovery, key escrow | Sui multi-sig is native; social recovery requires Move module |
| T-BC-19 | Key compromise | LOW | CATASTROPHIC | **CRITICAL** | HSM, multi-sig, key rotation, dual-key architecture, anomaly detection | Sui multi-sig and key rotation are native; anomaly detection is application-layer |

---

### 19.3.5.9 Security Requirements Summary

The following table consolidates all normative requirements from this section, classified by RFC 2119 keyword level.

#### MUST Requirements

| Requirement | Description | Threat(s) Addressed | Cross-Reference |
|-------------|-------------|--------------------|-----------------|
| R-BC-1.1 | Escrow Move modules MUST undergo formal verification before mainnet deployment | T-BC-1 | Section 18.11.1 (proposed) |
| R-BC-1.2 | Escrow Move modules MUST be audited by independent security firm | T-BC-1 | Section 18.11.1 (proposed) |
| R-BC-1.3 | SuiBridgeService MUST dry-run all settlement PTBs before execution | T-BC-1, T-BC-9 | Section 22.X (proposed SuiBridgeService) |
| R-BC-2.1 | Every state-mutating entry function MUST verify caller authorization | T-BC-2 | Section 19.5 (Authorization Model) |
| R-BC-2.3 | Authorization checks MUST precede all reads/writes | T-BC-2 | Section 19.5 |
| R-BC-4.2 | SuiBridgeService MUST verify canonical package ID for all on-chain objects | T-BC-4 | Section 22.X (proposed) |
| R-BC-4.3 | Canonical package ID MUST be stored in platform configuration | T-BC-4 | Section 22.X (proposed) |
| R-BC-5.1 | Settlement prices MUST use TWAP over minimum 5-minute window | T-BC-5, T-BC-8 | Section 18.12.1 (proposed) |
| R-BC-5.2 | Settlement contract MUST implement price circuit breaker | T-BC-5 | Section 18.12.1 (proposed) |
| R-BC-5.3 | High-value settlements MUST cross-reference two+ oracle sources | T-BC-5 | Section 18.12.1 (proposed) |
| R-BC-5.4 | Settlement price inputs MUST be recorded on-chain | T-BC-5 | Section 18.11.2 (proposed) |
| R-BC-7.1 | Oracle data MUST include observation and consensus timestamps | T-BC-7 | Section 18.12.7 (proposed) |
| R-BC-7.2 | Oracle data exceeding staleness bound MUST be rejected | T-BC-7 | Section 18.12.7 (proposed) |
| R-BC-8.1 | Settlement MUST use TWAP-based pricing | T-BC-8 | Section 18.11.2 (proposed) |
| R-BC-9.1 | High-value transactions MUST require multi-sig | T-BC-9 | Section 20.12.3 (proposed) |
| R-BC-9.2 | All Sui transactions MUST be dry-run validated | T-BC-9 | Section 22.X (proposed) |
| R-BC-9.3 | Sui signing key MUST be stored in HSM | T-BC-9 | Section 19.6 |
| R-BC-9.4 | All submitted transactions MUST be logged with full contents | T-BC-9 | Section 21.9 (Audit Trail) |
| R-BC-10.1 | SuiBridgeService MUST detect divergence within configurable bound | T-BC-10 | Section 22.X (proposed) |
| R-BC-10.2 | SuiBridgeService MUST implement outbox pattern | T-BC-10 | Section 22.X (proposed) |
| R-BC-10.3 | Reconciliation daemon MUST run at configurable intervals | T-BC-10 | Section 22.X (proposed) |
| R-BC-10.4 | On-chain state MUST be treated as authoritative for escrow/settlement | T-BC-10 | Section 22.X (proposed) |
| R-BC-11.1 | Settlement MUST consume escrow objects | T-BC-11 | Section 18.11.2 (proposed) |
| R-BC-11.2 | SuiBridgeService MUST maintain transaction digest cache | T-BC-11 | Section 22.X (proposed) |
| R-BC-14.1 | NATS hot-path MUST NOT depend on Sui availability | T-BC-14 | Section 5 (Architecture Principle), Section 13 (ChannelService) |
| R-BC-14.2 | SuiBridgeService MUST queue transactions during Sui outage | T-BC-14 | Section 22.X (proposed) |
| R-BC-14.3 | SuiService MUST have 3+ independent RPC endpoints | T-BC-14 | Section 22.X (proposed) |
| R-BC-15.1 | Governance changes MUST have minimum timelock | T-BC-15 | Section 20.12 (proposed) |
| R-BC-15.2 | Governance MUST require quorum | T-BC-15 | Section 20.12 (proposed) |
| R-BC-16.1 | Staking MUST use time-weighted average stake | T-BC-16 | Section 20.12.6 (proposed) |
| R-BC-16.2 | Unstaking MUST have cooldown period | T-BC-16 | Section 20.12.6 (proposed) |
| R-BC-17.1 | Organization activation MUST require minimum stake | T-BC-17 | Section 20.12.1 (proposed) |
| R-BC-17.2 | New organizations MUST start at NEWCOMER tier | T-BC-17 | Section 20.4.3 |
| R-BC-17.3 | Trust tier progression MUST require cross-tier interaction | T-BC-17 | Section 20.4.3 |
| R-BC-17.4 | Work order MUST enforce different buyer/seller addresses | T-BC-17 | Section 18.11.2 (proposed) |
| R-BC-19.1 | Key rotation MUST be supported without identity loss | T-BC-19 | Section 20.12.2 (proposed) |
| R-BC-19.2 | Dual-key architecture MUST be implemented | T-BC-19 | Section 19.6 |
| R-BC-19.3 | High-value escrow organizations MUST use multi-sig | T-BC-19 | Section 20.12.3 (proposed) |
| R-BC-19.4 | Platform MUST provide emergency key compromise response | T-BC-19 | Section 19.7.6 |

#### SHOULD Requirements

| Requirement | Description | Threat(s) Addressed | Cross-Reference |
|-------------|-------------|--------------------|-----------------|
| R-BC-1.4 | Escrow module SHOULD have time-locked upgrade policy | T-BC-1 | Section 20.12 (proposed) |
| R-BC-2.2 | Capability objects SHOULD be soulbound by default | T-BC-2 | Section 20.12.5 (proposed) |
| R-BC-3.1 | Move modules SHOULD use u64 for monetary amounts | T-BC-3 | Section 18.11.1 (proposed) |
| R-BC-3.2 | Fee calculations SHOULD multiply before divide | T-BC-3 | Section 18.11.4 (proposed) |
| R-BC-4.1 | Identity/capability/reputation objects SHOULD use OTW pattern | T-BC-4 | Section 20.12.1 (proposed) |
| R-BC-6.1 | Compliance-critical attestations SHOULD be independently verified | T-BC-6 | Section 18.12.7 (proposed) |
| R-BC-6.2 | Oracle attestation patterns SHOULD be monitored for anomalies | T-BC-6 | Section 23 (Monitoring, proposed) |
| R-BC-6.3 | Compliance-critical DONs SHOULD have minimum 7 independent operators | T-BC-6 | Section 18.12.7 (proposed) |
| R-BC-7.3 | SuiBridgeService SHOULD pre-fetch and verify oracle freshness | T-BC-7 | Section 22.X (proposed) |
| R-BC-8.2 | Platform SHOULD monitor Sui flash loan ecosystem growth | T-BC-8 | Section 23 (Monitoring, proposed) |
| R-BC-12.1 | Platform SHOULD monitor validator stake concentration | T-BC-12 | Section 23 (Monitoring, proposed) |
| R-BC-12.2 | Platform SHOULD prefer owned-object operations | T-BC-12 | Section 18.11 (proposed) |
| R-BC-13.1 | Sealed-bid operations SHOULD use commit-reveal | T-BC-13 | Section 18.6.5 (Marketplace) |
| R-BC-13.2 | Settlement SHOULD include max price deviation parameter | T-BC-13 | Section 18.11.2 (proposed) |
| R-BC-14.4 | Platform SHOULD expose Sui connectivity health indicator | T-BC-14 | Section 23 (Monitoring, proposed) |
| R-BC-15.3 | Governance SHOULD incorporate reputation-weighted voting | T-BC-15 | Section 20.12 (proposed) |
| R-BC-15.4 | Guardian multi-sig SHOULD have veto power | T-BC-15 | Section 20.12 (proposed) |
| R-BC-16.3 | Governance power SHOULD not depend solely on token holdings | T-BC-16 | Section 20.12 (proposed) |
| R-BC-17.3 | Self-referential trust building SHOULD trigger review | T-BC-17 | Section 20.5 (Reputation) |
| R-BC-17.4 | Same-entity work orders SHOULD be detectable | T-BC-17 | Section 20.5 (Reputation) |
| R-BC-18.1 | Organizations SHOULD use multi-sig wallets (2-of-3 minimum) | T-BC-18 | Section 20.12.3 (proposed) |
| R-BC-18.2 | Platform SHOULD provide key backup documentation/tooling | T-BC-18 | Section 19.6 |
| R-BC-18.4 | Escrow SHOULD have time-locked emergency recovery | T-BC-18 | Section 18.11.2 (proposed) |
| R-BC-19.5 | Platform SHOULD implement on-chain anomaly detection | T-BC-19 | Section 23 (Monitoring, proposed) |

#### MAY Requirements

| Requirement | Description | Threat(s) Addressed | Cross-Reference |
|-------------|-------------|--------------------|-----------------|
| R-BC-4.4 | Off-chain indexers MAY display unverified packages with warning | T-BC-4 | Section 22 (Developer Experience) |
| R-BC-18.3 | Platform MAY offer social recovery mechanism | T-BC-18 | Section 20.12 (proposed) |

---

### 19.3.5.10 Relationship to Existing Threat Model Sections

This blockchain-specific threat model extends the existing RFC-001 threat model (Sections 19.3.1--19.3.4) without modifying it. The relationship between sections is:

| Existing Section | Relationship to 19.3.5 |
|-----------------|------------------------|
| **19.3.1 Network Threats** | Sui network partition (T-BC-14) is a network-layer threat that complements NATS network threats. The mitigation (NATS independence from Sui) ensures that blockchain network threats do not cascade to existing NATS operations. |
| **19.3.2 Application Threats** | Smart contract threats (T-BC-1 through T-BC-4) are application-layer threats specific to the Move runtime. The bridge service threats (T-BC-9, T-BC-10) extend application threat analysis to the NATS-Sui integration seam. |
| **19.3.3 Data Threats** | Oracle threats (T-BC-5 through T-BC-8) are data integrity threats targeting the new data path (off-chain data to on-chain records). State divergence (T-BC-10) is a data consistency threat at the hot/cold path boundary. |
| **19.3.4 Operational Threats** | Key management threats (T-BC-18, T-BC-19) extend operational security to include blockchain key lifecycle. Governance threats (T-BC-15 through T-BC-17) introduce a new operational threat category specific to decentralized governance. |

---

### References

#### Sui Documentation
- [Sui Architecture](https://docs.sui.io/concepts/architecture) -- Object model, consensus
- [Mysticeti Consensus](https://docs.sui.io/concepts/sui-architecture/consensus) -- BFT properties
- [Mysticeti v2 Blog](https://blog.sui.io/mysticeti-v2-sui-consensus/) -- Latency improvements
- [Move Concepts](https://docs.sui.io/concepts/sui-move-concepts) -- Type system, abilities
- [Object Ownership](https://docs.sui.io/guides/developer/objects/object-ownership) -- Owned vs shared
- [Capability Pattern](https://move-book.com/programmability/capability/) -- Access control
- [Programmable Transaction Blocks](https://docs.sui.io/concepts/transactions/prog-txn-blocks) -- PTB atomicity
- [Sponsored Transactions](https://docs.sui.io/concepts/transactions/sponsored-transactions) -- Gas sponsorship
- [zkLogin](https://docs.sui.io/concepts/cryptography/zklogin) -- OAuth-based authentication
- [Gas Pricing](https://docs.sui.io/concepts/tokenomics/gas-pricing) -- Fee model

#### Chainlink Documentation
- [Chainlink Data Feeds](https://docs.chain.link/data-feeds) -- Push-based oracle
- [Chainlink Data Streams](https://docs.chain.link/data-streams) -- Pull-based oracle
- [Chainlink Functions](https://docs.chain.link/chainlink-functions) -- DON compute
- [CCIP Architecture](https://docs.chain.link/ccip/concepts/architecture) -- Cross-chain messaging
- [Chainlink Security](https://docs.chain.link/resources/developer-communications) -- Security model

#### Move Language Security
- [Move Book](https://move-book.com/) -- Language specification
- [Move Prover](https://github.com/move-language/move/tree/main/language/move-prover) -- Formal verification
- [Sui Security Advisories](https://github.com/MystenLabs/sui/security/advisories) -- Known vulnerabilities

#### Standards
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) -- Requirement keywords
- [IEC 62443-4-2](https://www.iec.ch/standards) -- Industrial cybersecurity component requirements
- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application) -- Electronic records

#### TMNL Internal References
- `research-sui-blockchain-integration.md` -- Sui architecture fundamentals
- `research-chainlink-ecosystem.md` -- Oracle security model
- `research-hybrid-architecture.md` (Section 7) -- Failure mode analysis (F-1 through F-7)
- `research-rfc-sui-chainlink-audit.md` (S-1 through S-10) -- Security integration points
- `research-sui-identity-auth.md` (Sections 6, 8, 11) -- Key management, multi-sig, threat delta
- `rfc-section-security-architecture.md` -- Existing threat model (19.3.1--19.3.4)
- `rfc-section-trust-model.md` -- Trust tiers, G-10 score, reputation

---

*This section was authored by Val (Vigilant Architecture Layer) on 2026-02-09. All Sui security claims are grounded in official Sui documentation and the Mysticeti consensus specification. Chainlink security claims are based on published Chainlink documentation as of February 2026. This threat model SHOULD be reviewed and updated quarterly, or upon significant changes to the Sui validator set, Chainlink DON configuration, or manufacturing commons Move module upgrades.*
