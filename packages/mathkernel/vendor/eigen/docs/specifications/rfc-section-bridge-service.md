# RFC Section: NATS-to-Sui Bridge Service Architecture

```
Section:       NATS-to-Sui Bridge Service Architecture (Amendment 6)
RFC:           001 (Entity Lifecycle Event Distribution)
Number:        22.X
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-09
Research Base: docs/specifications/research-hybrid-architecture.md (Section 4)
               docs/specifications/research-sui-effect-integration.md (Section 9)
               docs/specifications/research-rfc-sui-chainlink-audit.md (Appendix B)
               docs/specifications/research-sui-compliance-anchoring.md
Dependencies:  Section 18.11 (Sui Settlement Architecture)
               Section 18.12 (Oracle Integration Architecture)
               Section 13 (ChannelService / EventDistribution)
```

---

## 22.X NATS-to-Sui Bridge Service Architecture

### 22.X.1 Scope and Purpose

This section specifies the **SuiBridgeService** -- the Effect-TS service that
bridges NATS real-time event operations to Sui blockchain settlement and
compliance anchoring. The bridge is the most critical integration seam in the
manufacturing commons: it connects the hot path (NATS, <1 second latency,
2M+ events/sec) to the cold path (Sui, ~400ms finality, immutable records).

The bridge service is NOT a generic event relay. It is a carefully controlled
gate that determines which NATS events trigger on-chain transactions, how
those events are batched for cost efficiency, and how failures are handled
without data loss.

**Architecture principle**: *NATS is the operational truth. Sui is the
settlement truth. The bridge ensures eventual consistency between them, with
bounded convergence time.*

### 22.X.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

### 22.X.3 Service Definition

#### 22.X.3.1 Effect-TS Service Interface

```typescript
import { Context, Effect, Layer, Schema, Stream, Schedule, Queue } from 'effect'

// ─── Branded Types ───────────────────────────────────────────────

const SuiTransactionDigest = Schema.String.pipe(
  Schema.brand('SuiTransactionDigest')
)
const SuiObjectId = Schema.String.pipe(Schema.brand('SuiObjectId'))
const MerkleRoot = Schema.String.pipe(Schema.brand('MerkleRoot'))
const OrganizationId = Schema.String.pipe(Schema.brand('OrganizationId'))

// ─── Error Types ─────────────────────────────────────────────────

class SuiBridgeError extends Schema.TaggedError<SuiBridgeError>()(
  'SuiBridgeError',
  {
    code: Schema.Literal(
      'SUI_UNAVAILABLE',
      'TRANSACTION_REJECTED',
      'GAS_EXHAUSTED',
      'NONCE_GAP',
      'TIMEOUT',
      'SERIALIZATION_ERROR',
      'BUDGET_EXCEEDED'
    ),
    message: Schema.String,
    retryable: Schema.Boolean,
    transactionDigest: Schema.optional(SuiTransactionDigest),
  }
) {}

// ─── Domain Schemas ──────────────────────────────────────────────

const EventLogBatch = Schema.TaggedStruct('EventLogBatch', {
  batchId: Schema.String,
  orgId: OrganizationId,
  merkleRoot: MerkleRoot,
  eventCount: Schema.Number,
  timeStart: Schema.Number,
  timeEnd: Schema.Number,
  eventType: Schema.Literal('readings', 'alarms', 'equipment', 'entity'),
  leafHashes: Schema.Array(Schema.String),
})

const AnchorResult = Schema.TaggedStruct('AnchorResult', {
  suiTxDigest: SuiTransactionDigest,
  merkleRoot: MerkleRoot,
  batchId: Schema.String,
  attestationId: Schema.optional(Schema.String),
  anchoredAt: Schema.Number,
  gasUsed: Schema.Number,
})

const EscrowParams = Schema.TaggedStruct('EscrowParams', {
  workOrderId: Schema.String,
  buyerAddress: Schema.String,
  sellerAddress: Schema.String,
  amountMist: Schema.BigIntFromSelf,
  timeoutMs: Schema.Number,
  networkFeeBps: Schema.Number,
})

const EscrowObject = Schema.TaggedStruct('EscrowObject', {
  objectId: SuiObjectId,
  workOrderId: Schema.String,
  buyer: Schema.String,
  seller: Schema.String,
  amount: Schema.BigIntFromSelf,
  state: Schema.Literal('funded', 'released', 'frozen', 'settled', 'disputed'),
  createdAt: Schema.Number,
})

const SettlementTrigger = Schema.Union(
  Schema.TaggedStruct('AllPartyConfirm', {
    confirmations: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('QCPassAutoRelease', {
    qcReportId: Schema.String,
    attestationId: Schema.String,
  }),
  Schema.TaggedStruct('TimeoutRelease', {
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('DisputeResolution', {
    ruling: Schema.Literal('buyer', 'seller', 'split'),
    splitRatio: Schema.optional(Schema.Number),
    arbitratorAddress: Schema.String,
  }),
)

const SettlementResult = Schema.TaggedStruct('SettlementResult', {
  suiTxDigest: SuiTransactionDigest,
  escrowId: SuiObjectId,
  trigger: Schema.String,
  sellerReceived: Schema.BigIntFromSelf,
  networkFee: Schema.BigIntFromSelf,
  settledAt: Schema.Number,
})

const G10Score = Schema.TaggedStruct('G10Score', {
  signalConsistency: Schema.Number,
  clockAccuracy: Schema.Number,
  uptime: Schema.Number,
  peerValidation: Schema.Number,
  composite: Schema.Number,
  computedAt: Schema.Number,
})

const VerificationResult = Schema.TaggedStruct('VerificationResult', {
  verified: Schema.Boolean,
  capabilityId: Schema.String,
  attestationSource: Schema.Literal('chainlink', 'nautilus', 'self_reported'),
  verifiedAt: Schema.Number,
})

// ─── Service Interface ───────────────────────────────────────────

interface SuiBridgeService {
  /** Anchor a Merkle root of an EventLog batch to Sui.
   *  Optionally requests Chainlink Functions attestation first. */
  readonly anchorMerkleRoot: (
    batch: Schema.Schema.Type<typeof EventLogBatch>
  ) => Effect.Effect<
    Schema.Schema.Type<typeof AnchorResult>,
    SuiBridgeError
  >

  /** Create an escrow object on Sui with locked funds. */
  readonly createEscrow: (
    params: Schema.Schema.Type<typeof EscrowParams>
  ) => Effect.Effect<
    Schema.Schema.Type<typeof EscrowObject>,
    SuiBridgeError
  >

  /** Settle an escrow based on a trigger event. */
  readonly settleEscrow: (
    escrowId: Schema.Schema.Type<typeof SuiObjectId>,
    trigger: Schema.Schema.Type<typeof SettlementTrigger>
  ) => Effect.Effect<
    Schema.Schema.Type<typeof SettlementResult>,
    SuiBridgeError
  >

  /** Publish or update an organization's reputation score on-chain. */
  readonly publishReputation: (
    orgId: Schema.Schema.Type<typeof OrganizationId>,
    score: Schema.Schema.Type<typeof G10Score>
  ) => Effect.Effect<void, SuiBridgeError>

  /** Verify an organization's capability claim on-chain. */
  readonly verifyCapability: (
    orgId: Schema.Schema.Type<typeof OrganizationId>,
    capabilityId: string
  ) => Effect.Effect<
    Schema.Schema.Type<typeof VerificationResult>,
    SuiBridgeError
  >
}

const SuiBridgeService = Context.GenericTag<SuiBridgeService>(
  'SuiBridgeService'
)
```

#### 22.X.3.2 Layer Composition

The SuiBridgeService depends on three lower-level services:

```typescript
// ─── Layer Hierarchy ─────────────────────────────────────────────
//
//  SuiBridgeService
//    ├── SuiClient           (wraps @mysten/sui SDK)
//    ├── ChainlinkOracle     (wraps Chainlink Functions, VRF)
//    ├── NATSHolonet         (existing NATS JetStream client)
//    └── BridgeConfig        (batching intervals, gas limits, budgets)

const SuiBridgeServiceLive = Layer.effect(
  SuiBridgeService,
  Effect.gen(function* () {
    const sui = yield* SuiClient
    const chainlink = yield* ChainlinkOracleService
    const nats = yield* NATSHolonet
    const config = yield* BridgeConfig

    return SuiBridgeService.of({
      anchorMerkleRoot: (batch) =>
        anchorMerkleRootImpl(sui, chainlink, config, batch),
      createEscrow: (params) =>
        createEscrowImpl(sui, config, params),
      settleEscrow: (escrowId, trigger) =>
        settleEscrowImpl(sui, config, escrowId, trigger),
      publishReputation: (orgId, score) =>
        publishReputationImpl(sui, config, orgId, score),
      verifyCapability: (orgId, capabilityId) =>
        verifyCapabilityImpl(sui, chainlink, config, orgId, capabilityId),
    })
  })
)

// Full bridge layer with all dependencies provided
const SuiBridgeLayer = SuiBridgeServiceLive.pipe(
  Layer.provide(SuiClientLive),
  Layer.provide(ChainlinkOracleServiceLive),
  Layer.provide(NATSHolonetLive),
  Layer.provide(BridgeConfigLive),
)
```

#### 22.X.3.3 Normative Requirements

- R-BRG-1: The SuiBridgeService MUST be an Effect Service with a Layer.
  Business logic MUST NOT call the Sui SDK directly.
- R-BRG-2: The SuiBridgeService Layer MUST be replaceable with a mock Layer
  for testing. All integration tests MUST pass with both mock and live Layers.
- R-BRG-3: The SuiBridgeService MUST be a singleton within a process.
  Implementations MUST use `Layer.memoize` or equivalent to prevent multiple
  Sui client instances.

---

### 22.X.4 Event Routing Rules

#### 22.X.4.1 Overview

NOT every NATS event triggers an on-chain transaction. The bridge applies
routing rules to determine which events require blockchain anchoring and which
remain purely within the hot path.

#### 22.X.4.2 Routing Table

| NATS Event Category | On-Chain Action | Routing Strategy | Latency Target |
|--------------------|----------------|-----------------|----------------|
| **Sensor readings** (`iiot.readings.>`) | Merkle root anchoring | BATCHED (hourly default, 5-min for compliance) | <5 minutes after batch close |
| **Alarm events** (`iiot.alarms.>`) | Merkle root anchoring | BATCHED (hourly) | <5 minutes after batch close |
| **Equipment state** (`iiot.equipment.>`) | Merkle root anchoring | BATCHED (hourly) | <5 minutes after batch close |
| **Entity state** (`iiot.entity.>`) | Merkle root anchoring | BATCHED (hourly) | <5 minutes after batch close |
| **Escrow state changes** | Immediate on-chain TX | IMMEDIATE | <30 seconds |
| **Work order state transitions** | Immediate on-chain TX | IMMEDIATE | <30 seconds |
| **Reputation updates** | Periodic on-chain TX | PERIODIC (daily roll-up) | <24 hours |
| **Capacity status changes** | On-change on-chain TX | ON-CHANGE | <60 seconds |
| **Organization identity changes** | Immediate on-chain TX | IMMEDIATE | <30 seconds |
| **Certification events** | Immediate on-chain TX | IMMEDIATE | <30 seconds |

#### 22.X.4.3 Routing Strategies

**BATCHED**: Events are accumulated into Merkle trees and the root is anchored
on-chain at configurable intervals. This is the cost-optimized path for high-
frequency events.

**IMMEDIATE**: Events trigger an on-chain transaction within seconds. This is
reserved for settlement-critical state changes where the on-chain state must
reflect the NATS state with minimal delay.

**PERIODIC**: Events are aggregated and published on-chain at fixed intervals
(daily). This is for derived metrics that change gradually.

**ON-CHANGE**: Events trigger an on-chain transaction only when the aggregate
state actually changes (e.g., organization capacity status transitions from
"available" to "full"). This avoids redundant transactions when the underlying
state remains constant.

#### 22.X.4.4 Normative Requirements

- R-BRG-4: Sensor readings, alarm events, equipment state, and entity state
  events MUST be batched via Merkle tree anchoring. Per-event on-chain
  transactions for these categories are PROHIBITED due to cost.
- R-BRG-5: Escrow state changes and work order state transitions MUST be
  routed IMMEDIATELY. Implementations MUST NOT batch settlement-critical events.
- R-BRG-6: The routing table MUST be configurable per organization. Compliance-
  critical organizations (pharmaceutical, aerospace) MUST be able to configure
  shorter batching intervals (5-minute minimum) for their sensor reading
  batches.

---

### 22.X.5 Batching Strategy

#### 22.X.5.1 Merkle Root Anchoring

The primary cost optimization for the bridge is Merkle tree batching. Instead
of anchoring every event individually (which would cost ~$20M/month at 2M
events/sec), the bridge computes Merkle roots of event batches and anchors
only the roots.

```
              MERKLE BATCH ANCHORING FLOW

  ┌──────────────────┐
  │ NATS JetStream   │
  │ Event stream     │
  └────────┬─────────┘
           │ Continuous events
           v
  ┌──────────────────┐
  │ MerkleAccumulator│
  │                  │
  │ Window: 1 hour   │
  │ (configurable)   │
  │                  │
  │ Collects events  │
  │ Hashes each leaf │
  │ Builds tree      │
  └────────┬─────────┘
           │ On window close
           v
  ┌──────────────────┐     ┌──────────────────┐
  │ Merkle Root      │────>│ Chainlink        │
  │ + Batch Metadata │     │ Functions        │
  │                  │     │ (optional verify)│
  └────────┬─────────┘     └────────┬─────────┘
           │                        │ Attestation
           └──────────┬─────────────┘
                      v
              ┌──────────────────┐
              │ Sui Transaction  │
              │                  │
              │ ComplianceAnchor │
              │ object created   │
              │ (owned by org)   │
              └──────────────────┘
```

#### 22.X.5.2 Tiered Batching Intervals

Implementations MUST support configurable batching intervals per organization
and per event type. The following tiers are RECOMMENDED:

| Tier | Batch Interval | Attestations/Machine/Month | Cost/Machine/Month | Use Case |
|------|---------------|---------------------------|-------------------|----------|
| **L0: Real-time** | 5 minutes | 8,640 | ~$864 | FDA-regulated pharmaceutical lines |
| **L1: Near-real-time** | 15 minutes | 2,880 | ~$288 | Aerospace (AS9100) production |
| **L2: Standard** | 1 hour | 720 | ~$72 | Standard manufacturing (DEFAULT) |
| **L3: Economical** | 4 hours | 180 | ~$18 | Low-compliance general fabrication |
| **L4: Minimal** | 24 hours | 30 | ~$3 | Non-regulated, cost-sensitive |

Implementations MUST default to Tier L2 (hourly). Organizations MAY upgrade
to L0 or L1 for specific production lines that require tighter compliance
intervals. Organizations MAY downgrade to L3 or L4 for non-regulated work.

#### 22.X.5.3 Implementation: Effect.Schedule-Based Accumulator

```typescript
// MerkleAccumulator: batches NATS events into Merkle trees
// on a configurable schedule

const createMerkleAccumulator = (config: {
  orgId: string
  eventType: 'readings' | 'alarms' | 'equipment' | 'entity'
  batchIntervalMs: number
}) => Effect.gen(function* () {
  const nats = yield* NATSHolonet
  const bridge = yield* SuiBridgeService

  // Subscribe to the relevant NATS subject
  const subject = `iiot.${config.eventType}.${config.orgId}.>`
  const eventStream = yield* nats.subscribe(subject)

  // Accumulate events into batches using Effect.Schedule
  const batchSchedule = Schedule.fixed(`${config.batchIntervalMs} millis`)

  // Process batches
  return Stream.fromEffect(eventStream).pipe(
    Stream.groupedWithin(
      100_000,                          // Max events per batch
      `${config.batchIntervalMs} millis` // Batch window
    ),
    Stream.mapEffect((events) =>
      Effect.gen(function* () {
        if (events.length === 0) return // Skip empty batches

        // Hash each event as a Merkle leaf
        const leafHashes = events.map((event) =>
          computeKeccak256(
            Schema.encode(EventPayload)(event)
          )
        )

        // Build Merkle tree and extract root
        const merkleRoot = computeMerkleRoot(leafHashes)

        // Create batch metadata
        const batch = {
          _tag: 'EventLogBatch' as const,
          batchId: generateBatchId(config.orgId, Date.now()),
          orgId: config.orgId,
          merkleRoot,
          eventCount: events.length,
          timeStart: events[0].timestamp,
          timeEnd: events[events.length - 1].timestamp,
          eventType: config.eventType,
          leafHashes,
        }

        // Store leaf data in NATS KV for future proof generation
        const kv = yield* nats.getKeyValue('merkle-batches')
        yield* kv.put(batch.batchId, JSON.stringify({
          leafHashes,
          eventCount: events.length,
          timeRange: { start: batch.timeStart, end: batch.timeEnd },
        }))

        // Anchor to Sui via bridge
        const result = yield* bridge.anchorMerkleRoot(batch)

        return result
      })
    ),
  )
})
```

#### 22.X.5.4 Normative Requirements

- R-BRG-7: The default batch interval MUST be 1 hour (L2 tier). Implementations
  MUST allow per-organization, per-event-type override.
- R-BRG-8: Batch intervals MUST NOT be shorter than 5 minutes (L0 tier).
  Shorter intervals create excessive oracle costs and on-chain storage.
- R-BRG-9: The MerkleAccumulator MUST store leaf data in NATS KV before
  anchoring the root. If anchoring fails, the leaf data MUST be preserved for
  re-anchoring.
- R-BRG-10: Empty batches (no events in the batch window) MUST NOT be anchored.
  Implementations MUST NOT create on-chain records for empty time windows.

---

### 22.X.6 Transaction Building

#### 22.X.6.1 Sui SDK Integration Pattern

All Sui transactions are built using the `@mysten/sui` TypeScript SDK,
wrapped in `Effect.tryPromise` for error handling and composability:

```typescript
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'

// ─── SuiClient Effect Service ────────────────────────────────────

interface SuiClientService {
  readonly executePTB: (
    tx: Transaction
  ) => Effect.Effect<SuiTransactionBlockResponse, SuiBridgeError>

  readonly dryRun: (
    tx: Transaction
  ) => Effect.Effect<DryRunTransactionBlockResponse, SuiBridgeError>

  readonly getObject: (
    id: string
  ) => Effect.Effect<SuiObjectResponse, SuiBridgeError>

  readonly getGasPrice: () => Effect.Effect<bigint, SuiBridgeError>
}

const SuiClientService = Context.GenericTag<SuiClientService>(
  'SuiClientService'
)

const SuiClientServiceLive = Layer.effect(
  SuiClientService,
  Effect.gen(function* () {
    const config = yield* BridgeConfig
    const client = new SuiClient({ url: config.suiRpcUrl })
    const keypair = Ed25519Keypair.fromSecretKey(config.signerSecretKey)

    return SuiClientService.of({
      executePTB: (tx) =>
        Effect.tryPromise({
          try: () => client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
            options: {
              showEffects: true,
              showEvents: true,
            },
          }),
          catch: (cause) =>
            new SuiBridgeError({
              code: classifySuiError(cause),
              message: String(cause),
              retryable: isRetryable(cause),
            }),
        }),

      dryRun: (tx) =>
        Effect.tryPromise({
          try: () => client.dryRunTransactionBlock({
            transactionBlock: tx,
          }),
          catch: (cause) =>
            new SuiBridgeError({
              code: 'TRANSACTION_REJECTED',
              message: String(cause),
              retryable: false,
            }),
        }),

      getObject: (id) =>
        Effect.tryPromise({
          try: () => client.getObject({
            id,
            options: { showContent: true },
          }),
          catch: (cause) =>
            new SuiBridgeError({
              code: 'SUI_UNAVAILABLE',
              message: String(cause),
              retryable: true,
            }),
        }),

      getGasPrice: () =>
        Effect.tryPromise({
          try: () => client.getReferenceGasPrice(),
          catch: (cause) =>
            new SuiBridgeError({
              code: 'SUI_UNAVAILABLE',
              message: String(cause),
              retryable: true,
            }),
        }),
    })
  })
)
```

#### 22.X.6.2 Programmable Transaction Blocks (PTBs)

PTBs are Sui's atomic transaction primitive. A single PTB can execute up to
1,024 commands. The bridge uses PTBs for atomic multi-step operations:

```typescript
// Example: Anchor Merkle root with compliance metadata
const buildAnchorPTB = (params: {
  orgObjectId: string
  merkleRoot: string
  batchId: string
  eventCount: number
  timeStart: number
  timeEnd: number
  attestationId: string
  packageId: string
}) => {
  const tx = new Transaction()

  tx.moveCall({
    target: `${params.packageId}::compliance_anchor::record_batch`,
    arguments: [
      tx.object(params.orgObjectId),        // Organization owned object
      tx.pure.vector('u8', hexToBytes(params.merkleRoot)),
      tx.pure.vector('u8', stringToBytes(params.batchId)),
      tx.pure.u64(params.eventCount),
      tx.pure.u64(params.timeStart),
      tx.pure.u64(params.timeEnd),
      tx.pure.vector('u8', stringToBytes(params.attestationId)),
    ],
  })

  return tx
}

// Example: Settlement PTB (atomic multi-step)
const buildSettlementPTB = (params: {
  escrowObjectId: string
  sellerAddress: string
  treasuryAddress: string
  attestationProof: Uint8Array
  packageId: string
}) => {
  const tx = new Transaction()

  // Step 1: Release escrow (verify attestation + change state)
  tx.moveCall({
    target: `${params.packageId}::escrow::release`,
    arguments: [
      tx.object(params.escrowObjectId),
      tx.pure.vector('u8', params.attestationProof),
    ],
  })

  // Step 2: Settle (distribute funds)
  tx.moveCall({
    target: `${params.packageId}::escrow::settle`,
    arguments: [
      tx.object(params.escrowObjectId),
      tx.pure.address(params.treasuryAddress),
    ],
  })

  // Step 3: Record reputation evidence
  tx.moveCall({
    target: `${params.packageId}::reputation::record_completion`,
    arguments: [
      tx.object(params.escrowObjectId),
    ],
  })

  // All 3 steps execute atomically
  return tx
}
```

#### 22.X.6.3 Gas Estimation and Budgeting

Implementations MUST dry-run transactions before execution to estimate gas:

```typescript
const executeWithGasCheck = (tx: Transaction) =>
  Effect.gen(function* () {
    const sui = yield* SuiClientService
    const config = yield* BridgeConfig

    // Step 1: Dry run to estimate gas
    const dryRunResult = yield* sui.dryRun(tx)

    if (dryRunResult.effects.status.status !== 'success') {
      return yield* Effect.fail(new SuiBridgeError({
        code: 'TRANSACTION_REJECTED',
        message: `Dry run failed: ${dryRunResult.effects.status.error}`,
        retryable: false,
      }))
    }

    const estimatedGas = BigInt(
      dryRunResult.effects.gasUsed.computationCost
    ) + BigInt(
      dryRunResult.effects.gasUsed.storageCost
    )

    // Step 2: Check against budget
    if (estimatedGas > config.maxGasPerTransaction) {
      return yield* Effect.fail(new SuiBridgeError({
        code: 'GAS_EXHAUSTED',
        message: `Estimated gas ${estimatedGas} exceeds budget ${config.maxGasPerTransaction}`,
        retryable: false,
      }))
    }

    // Step 3: Set gas budget with 20% buffer
    tx.setGasBudget(estimatedGas * 120n / 100n)

    // Step 4: Execute
    return yield* sui.executePTB(tx)
  })
```

#### 22.X.6.4 Sponsored Transactions

For new organizations during onboarding, the platform SHOULD sponsor gas costs.
Sui supports sponsored transactions where the platform pays gas on behalf of
the organization:

```typescript
const executeSponsoredTransaction = (
  tx: Transaction,
  orgKeypair: Ed25519Keypair
) =>
  Effect.gen(function* () {
    const config = yield* BridgeConfig

    // Platform sponsor sets gas payment
    tx.setSender(orgKeypair.toSuiAddress())
    tx.setGasOwner(config.sponsorAddress)

    // Org signs the transaction
    // Platform signs the gas payment
    // Both signatures required for execution
  })
```

#### 22.X.6.5 Normative Requirements

- R-BRG-11: All Sui transactions MUST be dry-run before execution. If the
  dry run fails, the transaction MUST NOT be submitted.
- R-BRG-12: Gas budgets MUST include a 20% buffer above the dry-run estimate
  to account for state changes between dry run and execution.
- R-BRG-13: Implementations MUST support sponsored transactions for
  organizations below the "Basic" trust tier (see Section 20.12).
- R-BRG-14: The platform MUST maintain a gas budget pool for sponsored
  transactions. When the pool drops below 20% capacity, platform operators
  MUST be alerted.

---

### 22.X.7 Failure Modes

#### 22.X.7.1 Failure Mode Analysis

```
                FAILURE MODE DECISION TREE

  Transaction submitted
  │
  ├─ Sui RPC unreachable?
  │  └─ YES → QUEUE locally, retry with exponential backoff
  │           Alert if unreachable > 5 minutes
  │           NATS operations continue unaffected
  │
  ├─ Transaction rejected by validators?
  │  ├─ InsufficientGas → Increase gas budget, retry once
  │  ├─ ObjectNotFound → Object deleted or version mismatch
  │  │                   → Re-fetch object, rebuild PTB, retry
  │  ├─ SharedObjectCongestion → Exponential backoff, retry
  │  ├─ MoveAbort → Logic error, DO NOT RETRY
  │  │              → Route to dead-letter queue
  │  └─ Other → Log, route to dead-letter queue
  │
  ├─ Transaction executed but effects show failure?
  │  └─ Check effects.status.error
  │     → Route to dead-letter queue with full diagnostic context
  │
  └─ Transaction succeeded
     └─ Extract digest, object IDs, events
        Publish confirmation to NATS
```

#### 22.X.7.2 Retry Strategy

```typescript
// Standard retry schedule for Sui transactions
const suiRetrySchedule = Schedule.exponential('1 second').pipe(
  Schedule.compose(Schedule.recurs(5)),       // Max 5 retries
  Schedule.jittered,                           // Add jitter to prevent thundering herd
  Schedule.whileInput<SuiBridgeError>((error) => error.retryable),
)

// Enhanced retry for settlement-critical operations
const settlementRetrySchedule = Schedule.exponential('500 millis').pipe(
  Schedule.compose(Schedule.recurs(10)),      // More retries for settlement
  Schedule.jittered,
  Schedule.whileInput<SuiBridgeError>((error) => error.retryable),
)
```

#### 22.X.7.3 Dead-Letter Queue

Transactions that fail after all retries MUST be routed to a dead-letter queue
for manual intervention:

```typescript
const DeadLetterQueue = Schema.TaggedStruct('DeadLetterEntry', {
  transactionData: Schema.String,           // Serialized PTB
  error: Schema.String,                     // Last error message
  errorCode: Schema.String,                 // SuiBridgeError code
  attemptCount: Schema.Number,              // Total attempts
  firstAttemptAt: Schema.Number,            // Timestamp
  lastAttemptAt: Schema.Number,             // Timestamp
  orgId: OrganizationId,                    // Affected organization
  operationType: Schema.Literal(
    'anchor', 'escrow_create', 'escrow_settle',
    'reputation', 'capability', 'identity'
  ),
})
```

#### 22.X.7.4 Specific Failure Scenarios

| Failure | Impact | Detection | Recovery |
|---------|--------|-----------|----------|
| **Sui completely unavailable** | All on-chain operations halt; NATS continues | Health check fails (30s interval) | Queue all transactions; replay on recovery in chronological order |
| **Gas exhaustion** | Transactions rejected | Gas balance check before TX | Alert operators; pause non-critical anchoring; maintain settlement operations with reserve |
| **Nonce gap** | Transactions rejected due to sequence mismatch | TX rejection with nonce error | Re-fetch current nonce; rebuild and resubmit |
| **Shared object congestion** | Marketplace/escrow transactions delayed | `ExecutionCancelledDueToSharedObjectCongestion` error | Exponential backoff; use Sui local fee markets to bid higher gas |
| **Bridge relay failure** | Chainlink attestation cannot reach Sui | Bridge health check | Queue attestation; retry bridge relay; fall back to alternate bridge |
| **Split-brain** | Multiple bridge instances submit duplicate TXs | Nonce management | SuiBridgeService runs single-leader via @effect/cluster (see 22.X.7.5) |

#### 22.X.7.5 Leader Election for Single-Writer

The SuiBridgeService MUST run as a single-writer to prevent duplicate
transactions and nonce conflicts. Implementations MUST use leader election:

```typescript
// Single-leader bridge via @effect/cluster
const SuiBridgeServiceCluster = Effect.gen(function* () {
  const cluster = yield* Cluster

  // Only one instance per cluster runs the bridge
  const isLeader = yield* cluster.acquireLease('sui-bridge-leader', {
    ttlMs: 30_000,
    renewIntervalMs: 10_000,
  })

  if (!isLeader) {
    // Standby: monitor leader health, ready to take over
    return yield* cluster.watchLease('sui-bridge-leader')
  }

  // Leader: run the bridge
  return yield* runSuiBridge()
})
```

#### 22.X.7.6 Normative Requirements

- R-BRG-15: Transactions that fail after exhausting retry attempts MUST be
  routed to a dead-letter queue. Implementations MUST NOT silently discard
  failed transactions.
- R-BRG-16: The dead-letter queue MUST be monitored. Alert MUST trigger if
  any entry is older than 1 hour for settlement operations or 24 hours for
  anchoring operations.
- R-BRG-17: The SuiBridgeService MUST operate as a single leader within a
  cluster. Leader election MUST use @effect/cluster lease primitives.
- R-BRG-18: Sui unavailability MUST NOT affect NATS real-time operations.
  The hot path MUST continue independently of the cold path.

---

### 22.X.8 Consistency Model

#### 22.X.8.1 Dual-Truth Architecture

The manufacturing commons maintains two sources of truth:

```
  ┌──────────────────────────────────────────────────────────────┐
  │ NATS = Operational Truth                                     │
  │                                                              │
  │ - Authoritative for: real-time sensor data, entity state,    │
  │   alarm lifecycle, equipment state, work-in-progress         │
  │ - Latency: <1 second                                        │
  │ - Ordering: per-subject sequential, cross-subject causal     │
  │ - Durability: JetStream file-backed, R=3 replication         │
  │ - Trust: platform-mediated (NATS account isolation)          │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │ Sui = Settlement Truth                                       │
  │                                                              │
  │ - Authoritative for: escrow state, reputation scores,        │
  │   compliance proofs, organization identity, work order       │
  │   settlement, capability attestations                        │
  │ - Latency: ~400ms (consensus) to ~100ms (owned objects)      │
  │ - Ordering: per-object sequential, PTB atomic                │
  │ - Durability: blockchain permanent (immutable)               │
  │ - Trust: cryptographic (validator consensus, object ownership)│
  └──────────────────────────────────────────────────────────────┘
```

#### 22.X.8.2 Eventual Consistency Between Layers

The bridge provides eventual consistency between NATS and Sui with bounded
convergence time:

| Operation Category | Max Convergence Delay | Conflict Resolution |
|-------------------|----------------------|---------------------|
| **Merkle anchoring** | Batch interval + 5 minutes | Sui is append-only; no conflict possible |
| **Escrow state** | 30 seconds | Sui is authoritative; NATS reflects Sui state |
| **Reputation** | 24 hours (daily roll-up) | Sui is authoritative; NATS caches for UI |
| **Capacity status** | 60 seconds | NATS is authoritative; Sui is eventually consistent |
| **Work order state** | 30 seconds | Sui is authoritative for settlement state; NATS is authoritative for operational state |

#### 22.X.8.3 Divergence Detection

Implementations MUST run a periodic reconciliation daemon that detects
divergence between NATS state and Sui state:

```typescript
const reconciliationDaemon = Effect.gen(function* () {
  const sui = yield* SuiClientService
  const nats = yield* NATSHolonet

  // Run every 5 minutes
  return yield* Effect.repeat(
    Effect.gen(function* () {
      // 1. Check all active escrows
      const natsEscrows = yield* nats.getKeyValue('active-escrows')
      const suiEscrows = yield* fetchAllEscrowObjects(sui)

      for (const [id, natsState] of natsEscrows) {
        const suiState = suiEscrows.get(id)
        if (!suiState) {
          yield* alertDivergence('escrow_missing_on_sui', id)
        } else if (natsState.state !== suiState.state) {
          yield* alertDivergence('escrow_state_mismatch', id, {
            nats: natsState.state,
            sui: suiState.state,
          })
          // Sui is authoritative for escrow: update NATS
          yield* nats.getKeyValue('active-escrows').then(
            kv => kv.put(id, JSON.stringify(suiState))
          )
        }
      }

      // 2. Check anchoring completeness
      const pendingAnchors = yield* nats.getKeyValue('pending-anchors')
      for (const [batchId, anchor] of pendingAnchors) {
        if (Date.now() - anchor.submittedAt > 300_000) { // >5 min
          yield* alertDivergence('anchor_stale', batchId)
        }
      }
    }),
    Schedule.fixed('5 minutes')
  )
})
```

#### 22.X.8.4 Convergence SLA

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Settlement event convergence** | <5 minutes from NATS event to Sui anchor | P99 of settlement bridge latency |
| **Anchoring convergence** | <batch_interval + 5 minutes | Time from batch close to Sui confirmation |
| **Divergence detection** | <10 minutes to detect | Reconciliation daemon cycle time |
| **Divergence resolution** | <30 minutes for automated | Time from detection to resolution |
| **Divergence resolution (manual)** | <4 hours for dead-letter | Time from dead-letter alert to operator action |

#### 22.X.8.5 Normative Requirements

- R-BRG-19: Escrow state on Sui MUST be treated as authoritative. When
  divergence is detected between NATS and Sui escrow state, the NATS state
  MUST be updated to reflect Sui.
- R-BRG-20: Capacity status on NATS MUST be treated as authoritative. Sui
  capacity objects are eventually consistent reflections, not the source of
  truth.
- R-BRG-21: A reconciliation daemon MUST run at intervals no longer than 5
  minutes. Divergence MUST be detected within two reconciliation cycles.
- R-BRG-22: Settlement events MUST converge to Sui within 5 minutes of the
  triggering NATS event. Violations of this SLA MUST generate alerts.

---

### 22.X.9 Cost Optimization

#### 22.X.9.1 Cost Model by Operation

| Operation | Sui Gas Cost | Chainlink Cost | Total Cost | Frequency |
|-----------|-------------|---------------|------------|-----------|
| **Merkle root anchor** (owned object) | ~$0.003 | $0.10 (Functions) | ~$0.103 | Per batch |
| **Escrow creation** (shared object) | ~$0.01 | -- | ~$0.01 | Per work order |
| **Escrow settlement** (shared object + PTB) | ~$0.015 | -- | ~$0.015 | Per work order |
| **Reputation update** (owned object) | ~$0.003 | -- | ~$0.003 | Daily per org |
| **Capacity status sync** (shared object) | ~$0.01 | -- | ~$0.01 | Per status change |
| **Certification anchor** (owned object) | ~$0.003 | $0.10 (verify) | ~$0.103 | Per cert event |

#### 22.X.9.2 Cost by Organization Size

| Org Size | Machines | Anchoring (L2) | Escrow | Reputation | Capacity | Total/month |
|----------|----------|---------------|--------|-----------|----------|-------------|
| **Earl** (Solo) | 2 | $7.50 | $0.03 | $0.09 | $0.30 | **~$8** |
| **Mid Shop** | 20 | $75 | $0.38 | $0.09 | $3 | **~$78** |
| **Enterprise** | 200 | $750 | $2.50 | $0.09 | $30 | **~$783** |

*Note: These are Sui gas costs only. Add Chainlink attestation costs from
Section 18.12.11 for total oracle + bridge cost.*

#### 22.X.9.3 Optimization Strategies

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| **Batch anchoring** (already applied) | 99.99% vs per-event | Increased convergence latency |
| **PTB batching** | 30-50% gas reduction | Multiple operations in single TX; atomic failure |
| **Owned objects for anchoring** | ~70% gas reduction vs shared | No marketplace access for anchor objects |
| **Tier-based intervals** | Proportional to interval | Compliance orgs pay more |
| **Nautilus over Chainlink** | ~97% cost reduction per attestation | Weaker decentralization (single TEE vs DON) |
| **Skip empty batches** | Eliminates wasted gas | Must detect batch emptiness before TX |

#### 22.X.9.4 Monthly Cost Caps

| Cost Component | Soft Cap (alert) | Hard Cap (throttle) |
|---------------|-----------------|---------------------|
| Sui gas per org | 80% of tier budget | 120% of tier budget |
| Chainlink per org | 80% of tier budget | 120% of tier budget |
| Platform-wide Sui gas | $2M/month | $3M/month |
| Platform-wide Chainlink | $3M/month | $4.5M/month |

#### 22.X.9.5 Normative Requirements

- R-BRG-23: Implementations MUST use owned objects (not shared objects) for
  compliance anchoring. Shared objects incur higher gas and consensus latency.
- R-BRG-24: Implementations MUST batch multiple operations within a single
  PTB where atomicity requirements allow.
- R-BRG-25: Per-organization cost caps MUST be enforced at the bridge layer.
  When the soft cap is reached, non-critical operations MUST be throttled.
  Settlement operations MUST NOT be throttled until the hard cap.
- R-BRG-26: The bridge MUST track cumulative gas expenditure per organization
  per billing period and expose this via the monitoring infrastructure
  (Section 23).

---

### 22.X.10 Effect-TS Implementation Patterns

#### 22.X.10.1 Full Bridge Implementation Sketch

```typescript
// ─── anchorMerkleRoot Implementation ─────────────────────────────

const anchorMerkleRootImpl = (
  sui: SuiClientService,
  chainlink: ChainlinkOracleService,
  config: BridgeConfig,
  batch: Schema.Schema.Type<typeof EventLogBatch>
) =>
  Effect.gen(function* () {
    // Step 1: Optionally request Chainlink attestation
    let attestationId = 'self-attested'

    if (config.requireChainlinkAttestation) {
      const attestation = yield* chainlink.requestFunction({
        source: MERKLE_VERIFY_SOURCE,
        args: [batch.merkleRoot, batch.batchId, batch.orgId],
      }).pipe(
        Effect.retry(suiRetrySchedule),
        Effect.catchTag('OracleError', (e) =>
          e.code === 'UNAVAILABLE'
            ? Effect.succeed({ requestId: 'deferred', result: 'DEFERRED', timestamp: Date.now(), gasUsed: 0 })
            : Effect.fail(new SuiBridgeError({
                code: 'TRANSACTION_REJECTED',
                message: `Oracle attestation failed: ${e.message}`,
                retryable: false,
              }))
        ),
      )
      attestationId = attestation.requestId
    }

    // Step 2: Build Sui PTB
    const tx = buildAnchorPTB({
      orgObjectId: yield* resolveOrgObject(sui, batch.orgId),
      merkleRoot: batch.merkleRoot,
      batchId: batch.batchId,
      eventCount: batch.eventCount,
      timeStart: batch.timeStart,
      timeEnd: batch.timeEnd,
      attestationId,
      packageId: config.packageId,
    })

    // Step 3: Execute with gas check and retry
    const result = yield* executeWithGasCheck(tx).pipe(
      Effect.retry(suiRetrySchedule),
    )

    return {
      _tag: 'AnchorResult' as const,
      suiTxDigest: result.digest,
      merkleRoot: batch.merkleRoot,
      batchId: batch.batchId,
      attestationId,
      anchoredAt: Date.now(),
      gasUsed: Number(result.effects?.gasUsed?.computationCost ?? 0),
    }
  })
```

#### 22.X.10.2 Error Type Classification

```typescript
// Classify Sui SDK errors into SuiBridgeError codes
const classifySuiError = (cause: unknown): SuiBridgeError['code'] => {
  const msg = String(cause)

  if (msg.includes('InsufficientGas') || msg.includes('gas'))
    return 'GAS_EXHAUSTED'
  if (msg.includes('ObjectNotFound') || msg.includes('version'))
    return 'TRANSACTION_REJECTED'
  if (msg.includes('Congestion') || msg.includes('congestion'))
    return 'TRANSACTION_REJECTED'  // Retryable
  if (msg.includes('timeout') || msg.includes('TIMEOUT'))
    return 'TIMEOUT'
  if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed'))
    return 'SUI_UNAVAILABLE'

  return 'TRANSACTION_REJECTED'
}

const isRetryable = (cause: unknown): boolean => {
  const msg = String(cause)
  return (
    msg.includes('InsufficientGas') ||
    msg.includes('Congestion') ||
    msg.includes('timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed')
  )
}
```

---

### 22.X.11 Integration with Existing Architecture

#### 22.X.11.1 Layer Composition with RFC-001 Systems

```typescript
// The SuiBridgeLayer plugs into the existing ManufacturingCommonsLayer

const ManufacturingCommonsLayer = Layer.mergeAll(
  // ─── Existing NATS Layers (RFC-001) ────────────────────────
  EntityHandlersLayer,           // ISA-95 entity lifecycle
  EventDistributionLayer,        // ChannelService broadcast
  SparkplugPipelineLayer,        // Sensor ingestion
  WebSocketServerLayer,          // Client subscriptions (Phase 5)
  ReactivityBridgeLayer,         // Entity→UI reactivity

  // ─── Blockchain Integration (NEW) ──────────────────────────
  SuiBridgeLayer,                // This section (22.X)
  OracleLayer,                   // Section 18.12
).pipe(
  Layer.provide(NATSHolonetLive),
  Layer.provide(SuiClientServiceLive),
  Layer.provide(ChainlinkOracleServiceLive),
  Layer.provide(BridgeConfigLive),
)
```

#### 22.X.11.2 Event Flow Integration

```
              EVENT FLOW WITH BRIDGE INTEGRATION

  Sensor → NATS → ReadingProcessor → EventDistribution
                                          │
                            ┌─────────────┼──────────────┐
                            │             │              │
                            v             v              v
                    WebSocket         Entity          MerkleAccumulator
                    (to UI)           Handlers         (bridge layer)
                                      │                     │
                                      v                     │ Batch close
                                   NATS KV                  v
                                   (state)           SuiBridgeService
                                                          │
                                                ┌─────────┼─────────┐
                                                │                   │
                                                v                   v
                                        ChainlinkOracle      SuiClient
                                        (attestation)        (anchor TX)
```

---

### 22.X.12 Monitoring and Observability

#### 22.X.12.1 Bridge Metrics

Implementations MUST expose the following metrics for the bridge service:

| Metric | Type | Labels | Alert Threshold |
|--------|------|--------|----------------|
| `sui_bridge_tx_total` | Counter | `operation`, `status` | N/A |
| `sui_bridge_tx_latency_ms` | Histogram | `operation` | P99 > 5000ms |
| `sui_bridge_tx_gas_used` | Histogram | `operation` | -- |
| `sui_bridge_retry_total` | Counter | `operation`, `attempt` | >3 retries/min |
| `sui_bridge_dead_letter_size` | Gauge | `operation` | >0 for >1 hour |
| `sui_bridge_batch_size` | Histogram | `event_type`, `org_tier` | -- |
| `sui_bridge_convergence_delay_ms` | Histogram | `operation` | P99 > 300000ms (5 min) |
| `sui_bridge_oracle_budget_used_pct` | Gauge | `org_id` | >80% |
| `sui_bridge_leader_status` | Gauge | `instance_id` | Leader lost for >30s |

#### 22.X.12.2 Normative Requirements

- R-BRG-27: All metrics in section 22.X.12.1 MUST be exposed via the
  monitoring infrastructure (Section 23).
- R-BRG-28: Alert rules MUST be configured for all metrics with defined
  thresholds.
- R-BRG-29: The bridge MUST log every Sui transaction attempt with: operation
  type, organization ID, gas estimate, actual gas used, success/failure status,
  and transaction digest.

---

### 22.X.13 References

| Tag | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", RFC 2119, March 1997 |
| [SUI-SDK] | Sui TypeScript SDK, https://sdk.mystenlabs.com/sui |
| [SUI-PTB] | Programmable Transaction Blocks, https://docs.sui.io/concepts/transactions/prog-txn-blocks |
| [SUI-GAS] | Sui Gas Pricing, https://docs.sui.io/concepts/tokenomics/gas-pricing |
| [SUI-OBJECTS] | Sui Object Ownership, https://docs.sui.io/guides/developer/objects/object-ownership |
| [SUI-CONGESTION] | Shared Object Congestion Control, https://blog.sui.io/shared-object-congestion-control/ |
| [EFFECT-CLUSTER] | @effect/cluster, https://github.com/Effect-TS/effect/tree/main/packages/cluster |
| [CL-FUNCTIONS] | Chainlink Functions, https://docs.chain.link/chainlink-functions |
| [MERKLE-ANCHOR] | Tamper-Proof Event Logging with Merkle Trees, https://medium.com/@vanabharathiraja/building-a-tamper-proof-event-logging-system-e71dfbc3c58a |

---

*This section was authored by Val (Vigilant Architecture Layer) on 2026-02-09.
The SuiBridgeService specification is designed to be implemented incrementally:
Phase 1 (compliance anchoring only), Phase 2 (add escrow/settlement), Phase 3
(add reputation/capability verification). Each phase can be deployed
independently without disrupting NATS real-time operations.*
