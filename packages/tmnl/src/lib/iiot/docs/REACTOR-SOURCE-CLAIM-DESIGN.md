# Reactor Source-Entry Claim Design

Status: **Draft — immediate design work**
Date: 2026-05-18
Related task: `#3836`
Related artifact: `/home/getbygenius/.agent/diagrams/reactor-source-claim-design.html`

## 1. Problem

The generalized Reactor currently dedupes after dispatch by writing
`iiot.reactor_checkpoints` once a source journal entry has been classified and
executed.

That is not enough for production ownership.

Two Reactor processes can both observe the same durable EventJournal entry, both
see no checkpoint, then both plan and dispatch before either writes the final
checkpoint. This creates three hazards:

1. **Duplicate dispatch race** — two delivery paths race the same source entry.
2. **Policy epoch split-brain** — two deployed Reactor registries interpret the
   same source entry with different policy epochs.
3. **Crash gap** — a Reactor can crash after dispatch but before checkpoint;
   replay must recover without double-transitioning the target.

The fix is a durable, atomic claim acquired **before planning and before target
command dispatch**.

## 2. Design intent

The source-entry claim is an operational mutex and recovery record. It is not a
new domain fact and not a second event stream.

Domain events remain canonical. The claim only answers:

- who is currently allowed to process this source entry for this logical Reactor
  consumer;
- which owner key and policy epoch were chosen;
- whether an in-flight attempt is still alive;
- whether final processing completed.

## 3. Non-negotiable invariants

1. **One source entry, one logical Reactor claim.**
   The primary key is `(consumer_id, source_entry_id)`. Policy epoch is not part
   of the key.

2. **Policy epoch is frozen by the claim.**
   Once a row exists, later attempts must either use the same epoch/fingerprint
   or return an epoch conflict. They must not silently process the same source
   entry under a different local registry.

3. **Claim token protects stale owners.**
   Every acquisition/reacquisition receives a fresh `claim_token`. Heartbeat and
   completion require the matching token so an old fiber cannot complete a claim
   after its lease was lost.

4. **Final checkpoint remains after dispatch attempt outcomes are known.**
   `reactor_checkpoints` remains the compatibility/read model for completed
   source entries. The claim table owns in-flight state.

5. **Target idempotency remains mandatory.**
   Crash after dispatch but before claim completion can cause a retry after lease
   expiry. The target entity must still enforce idempotency with
   `caused_by_propagation_id` / request id uniqueness.

## 4. Recommended table

```sql
CREATE TABLE IF NOT EXISTS iiot.reactor_source_claims (
  consumer_id          TEXT NOT NULL,
  source_entry_id      TEXT NOT NULL,
  source_event         TEXT NOT NULL,
  primary_key          TEXT NOT NULL,

  owner_key            TEXT NOT NULL,
  policy_epoch         TEXT NOT NULL,
  registry_fingerprint TEXT NOT NULL,

  claim_status         TEXT NOT NULL CHECK (claim_status IN ('processing', 'completed', 'blocked', 'deferred')),
  claim_token          TEXT NOT NULL,
  claimed_by           TEXT NOT NULL,
  attempt              INTEGER NOT NULL DEFAULT 1,
  phase                TEXT NOT NULL DEFAULT 'acquired' CHECK (phase IN ('acquired', 'planning', 'dispatching', 'completing', 'recovering')),

  claimed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at     TIMESTAMPTZ NOT NULL,
  attempt_deadline_at  TIMESTAMPTZ NOT NULL,
  phase_started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_retry_at        TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  blocked_at           TIMESTAMPTZ,

  outcome              TEXT CHECK (outcome IN ('processed', 'skipped', 'failed')),
  conflict_reason      TEXT,
  last_error           TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,

  PRIMARY KEY (consumer_id, source_entry_id),
  CHECK ((claim_status = 'completed') = (completed_at IS NOT NULL)),
  CHECK ((claim_status = 'blocked') = (blocked_at IS NOT NULL)),
  CHECK ((claim_status = 'deferred') = (next_retry_at IS NOT NULL)),
  CHECK (lease_expires_at <= attempt_deadline_at OR claim_status IN ('completed', 'blocked', 'deferred'))
);

CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_owner_status
ON iiot.reactor_source_claims (owner_key, claim_status, claimed_at);

CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_lease
ON iiot.reactor_source_claims (claim_status, lease_expires_at)
WHERE claim_status = 'processing';

CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_epoch
ON iiot.reactor_source_claims (policy_epoch, registry_fingerprint, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reactor_source_claims_deferred
ON iiot.reactor_source_claims (next_retry_at)
WHERE claim_status = 'deferred';
```

### Why a new table instead of expanding checkpoints?

`reactor_checkpoints` currently means "this source entry has reached a final
classification outcome." Reusing it for in-flight rows would make
`hasProcessed()` lie unless every caller changed at once.

A separate `reactor_source_claims` table keeps the migration safe:

- claim table = in-flight ownership, lease, epoch, recovery;
- checkpoint table = final dedupe/read model.

Later, once all callers are migrated, the checkpoint table can become a view or
be folded into claims. Not first. Prime, no Rube Goldberg schema surgery before
breakfast.

## 5. Schema contracts

Implementation should extend `src/lib/iiot/schemas/reactor.ts` with Schema-backed
contracts:

```ts
export const ReactorPolicyEpoch = Schema.String.pipe(Schema.brand('ReactorPolicyEpoch'))
export const ReactorRegistryFingerprint = Schema.String.pipe(Schema.brand('ReactorRegistryFingerprint'))
export const ReactorOwnerKey = Schema.String.pipe(Schema.brand('ReactorOwnerKey'))
export const ReactorClaimToken = Schema.String.pipe(Schema.brand('ReactorClaimToken'))

export const ReactorSourceClaimStatus = Schema.Literal('processing', 'completed', 'blocked', 'deferred')
export const ReactorClaimPhase = Schema.Literal('acquired', 'planning', 'dispatching', 'completing', 'recovering')
export const ReactorClaimAcquireTag = Schema.Literal(
  'acquired',
  'reacquired',
  'busy',
  'deferred',
  'completed',
  'epoch_conflict',
  'registry_drift'
)
```

These literals are the persistence codec, not decorative documentation. They are
consumed at the `ReactorSourceClaimRepo` boundary:

- decode raw SQL rows into `ReactorSourceClaim`;
- validate repo inputs before writing rows;
- reject unknown persisted statuses/phases during tests and migrations;
- derive TypeScript union types for exhaustive switching.

Application code should not hand-type these strings outside the schema/repo
boundary. Export named constants if needed, and prefer tagged acquire result
variants for Reactor control flow.

Recommended result shape:

```ts
export class ReactorSourceClaim extends Schema.TaggedClass<ReactorSourceClaim>()('ReactorSourceClaim', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  ownerKey: ReactorOwnerKey,
  policyEpoch: ReactorPolicyEpoch,
  registryFingerprint: ReactorRegistryFingerprint,
  claimStatus: ReactorSourceClaimStatus,
  claimToken: ReactorClaimToken,
  claimedBy: Schema.String,
  attempt: Schema.Number,
  phase: ReactorClaimPhase,
  claimedAt: Schema.DateTimeUtc,
  heartbeatAt: Schema.DateTimeUtc,
  leaseExpiresAt: Schema.DateTimeUtc,
  attemptDeadlineAt: Schema.DateTimeUtc,
  phaseStartedAt: Schema.DateTimeUtc,
  nextRetryAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  blockedAt: Schema.optional(Schema.DateTimeUtc),
  outcome: Schema.optional(ReactorCheckpointOutcome),
  conflictReason: Schema.optional(Schema.String),
  lastError: Schema.optional(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}
```

## 6. Repository contract

Add `ReactorSourceClaimRepo` beside `ReactorCheckpointRepo`.

```ts
export interface ReactorSourceClaimRepository {
  readonly tryAcquire: (input: ReactorClaimAcquireInput) => Effect.Effect<ReactorClaimAcquireResult, ReactorClaimRepoError>
  readonly heartbeat: (input: ReactorClaimHeartbeatInput) => Effect.Effect<boolean, ReactorClaimRepoError>
  readonly complete: (input: ReactorClaimCompleteInput) => Effect.Effect<boolean, ReactorClaimRepoError>
  readonly defer: (input: ReactorClaimDeferInput) => Effect.Effect<boolean, ReactorClaimRepoError>
  readonly block: (input: ReactorClaimBlockInput) => Effect.Effect<boolean, ReactorClaimRepoError>
  readonly findExpired: (input: ReactorClaimFindExpiredInput) => Effect.Effect<readonly ReactorSourceClaim[], ReactorClaimRepoError>
}
```

### `tryAcquire` classification

| Existing row | Condition | Result |
|---|---|---|
| none | insert succeeds | `acquired` |
| `completed` | any | `completed` |
| `processing` | lease active | `busy` |
| `processing` | lease expired + same epoch/fingerprint + below attempt cap | update token, attempt++, lease/deadline | `reacquired` |
| `processing` | lease expired + attempt cap reached | move to `blocked` | `busy`/blocked result |
| `processing` | lease expired + different policy epoch | no processing | `epoch_conflict` |
| `processing` | lease expired + same epoch but different fingerprint | no processing | `registry_drift` |
| `deferred` | `next_retry_at` in future | no processing | `deferred` |
| `deferred` | `next_retry_at` elapsed + same epoch/fingerprint | update token, attempt++, lease/deadline, status=`processing` | `reacquired` |
| `deferred` | `next_retry_at` elapsed + different epoch/fingerprint | no processing | `epoch_conflict` / `registry_drift` |

`tryAcquire` should run in a SQL transaction and lock the row when present:

```sql
SELECT *
FROM iiot.reactor_source_claims
WHERE consumer_id = $1 AND source_entry_id = $2
FOR UPDATE;
```

If no row exists, insert with `ON CONFLICT DO NOTHING`, then re-select if the
insert lost a race.

### `complete`

Completion must be token-guarded:

```sql
UPDATE iiot.reactor_source_claims
SET claim_status = 'completed',
    outcome = $outcome,
    completed_at = NOW(),
    metadata = metadata || $metadata::jsonb
WHERE consumer_id = $consumerId
  AND source_entry_id = $sourceEntryId
  AND claim_token = $claimToken
  AND claim_status = 'processing'
RETURNING 1;
```

If zero rows are returned, the owner lost the claim and must not mark the final
checkpoint.

### `heartbeat`

Heartbeat is token-guarded and **deadline-capped**. A live process must not be
able to keep a dead target dependency alive forever by blindly extending the
lease.

```sql
UPDATE iiot.reactor_source_claims
SET heartbeat_at = NOW(),
    lease_expires_at = LEAST(NOW() + $leaseDuration::interval, attempt_deadline_at),
    phase = $phase,
    phase_started_at = CASE WHEN phase <> $phase THEN NOW() ELSE phase_started_at END
WHERE consumer_id = $consumerId
  AND source_entry_id = $sourceEntryId
  AND claim_token = $claimToken
  AND claim_status = 'processing'
  AND NOW() < attempt_deadline_at
RETURNING 1;
```

If zero rows are returned, the worker must stop processing. It either lost the
token, the claim is no longer processing, or the attempt exceeded its hard
progress deadline.

### `defer`

If the target entity/dependency is unavailable but the source entry should be
retried automatically, the active owner should release active ownership into a
bounded retry state instead of heartbeating forever:

```sql
UPDATE iiot.reactor_source_claims
SET claim_status = 'deferred',
    next_retry_at = NOW() + $retryAfter::interval,
    last_error = $lastError,
    metadata = metadata || $metadata::jsonb
WHERE consumer_id = $consumerId
  AND source_entry_id = $sourceEntryId
  AND claim_token = $claimToken
  AND claim_status = 'processing'
RETURNING 1;
```

Deferred claims are not owned by a live worker. They are cooling down until
`next_retry_at`, then they can be reacquired with a fresh token.

## 7. Contention and deadlock analysis

PostgreSQL row-level locks block only writers and lockers for the same row, not
plain readers. A deadlock requires a cycle: transaction A holds one lock and
waits for another while transaction B holds the second lock and waits for the
first. A single-row claim transaction cannot deadlock by itself; it can only make
other contenders wait for that same row.

Therefore the claim design must keep `tryAcquire`, `heartbeat`, `complete`, and
`block` as **short, single-purpose transactions**. No graph traversal, no target
RPC dispatch, no EventJournal replay loop, and no WorkOrder transition mutation
may run while holding the source-claim row lock.

### 7.1 Scenarios

| Scenario | What locks | Contention risk | Deadlock risk | Design response |
|---|---|---:|---:|---|
| Duplicate warm+cold delivery of the same source entry | Same `(consumer_id, source_entry_id)` claim row | Low, localized | Very low | One inserter/acquirer wins; others see `busy` or `completed` after the short transaction. |
| Many source entries for the same hot machine | Different claim rows, same `owner_key` | Low in DB, higher in ReactorWorker mailbox | Very low | DB claim does not serialize the subject; ReactorWorkerEntity serializes per subject after claims. |
| Two policy epochs race the same source entry | Same claim row | Low, localized | Very low | First claim freezes epoch/fingerprint; later epoch returns `epoch_conflict` and does not dispatch. |
| Expired claim recovery | Same claim row | Medium only for that stuck entry | Very low | Reacquirer rotates token only after lease expiry and only with same epoch/fingerprint. |
| Crash after dispatch before complete | Claim row later reacquired; target transition row may be touched again | Medium operationally | Low if transactions stay separate | Target idempotency via `caused_by_propagation_id` prevents duplicate local mutation. |
| Completion plus checkpoint write | Claim row, then checkpoint unique row | Low | Medium if some code writes checkpoint first then claim | Use one canonical order: claim completion before checkpoint, or a combined repo method with claim -> checkpoint order only. |
| Sweeper scans expired claims | Multiple claim rows | Medium if many stuck entries | Low with ordered scan | Use deterministic `ORDER BY`, bounded batches, and `FOR UPDATE SKIP LOCKED`. |

### 7.2 Guardrails

1. Keep claim transactions short: single row read/update/insert, then commit.
2. Never dispatch target RPC while a claim transaction is open.
3. Use canonical lock order if a transaction must touch more than one table:
   `reactor_source_claims` -> `reactor_checkpoints`; never the reverse.
4. Prefer token-guarded `complete` followed by checkpoint insert. If checkpoint
   insert fails after claim completion, the completed claim can be used to repair
   the checkpoint during replay.
5. Use small `lock_timeout`/statement timeout around claim acquisition and treat
   timeout as `busy`, not as fatal corruption.
6. Use `FOR UPDATE SKIP LOCKED` only for batch sweepers, not for single
   source-entry acquisition where the exact row matters.
7. Monitor `pg_locks`, claim attempt counts, `busy` rate, and expired-claim
   reacquisitions.

With these guardrails, the database is not a global bottleneck. The only hot row
is a duplicate delivery of the same source entry, which is exactly the row we
want to serialize.

## 8. Policy epoch resolution

Immediate implementation can start with an explicit epoch/fingerprint on the
runtime registry:

```ts
export interface ReactorRegistryConfig {
  readonly policyEpoch: ReactorPolicyEpoch
  readonly registryFingerprint: ReactorRegistryFingerprint
  readonly observations: readonly EventObservationSpec[]
  readonly propagationPolicies: readonly RelationshipPropagationPolicy[]
  readonly entities: readonly EntityReactionContract[]
}
```

The fingerprint should be deterministic from declaration IDs and versions:

```text
hash(
  observation ids + event tags +
  propagation policy ids + policy versions +
  entity type + capability ids
)
```

Later, introduce a durable `ReactorPolicyEpochRepo` where policy epochs have
valid-time ranges. The source-entry claim design does not depend on that table,
but it is compatible with it.

## 9. Runtime flow

### 9.1 Immediate sidecar flow

```text
EventJournal entry
  -> observe durable event into ReactorObservation
  -> derive ownerKey = relationship-reactor:<subject.type>:<subject.id>
  -> tryAcquire(source_entry_id, ownerKey, policyEpoch, fingerprint)
  -> heartbeat phase=planning with observation/subject metadata
  -> if acquired/reacquired: plan observation
  -> heartbeat phase=dispatching with policyIds + targetIds
  -> dispatch target-owned EntityReactionRequest(s)
  -> heartbeat phase=completing with result counters
  -> complete claim with audit metadata
  -> write reactor checkpoint with the same completion metadata
```

### 9.2 Cluster-worker flow after ReactorWorkerEntity exists

```text
Event adapter / Singleton
  -> observe enough to derive stable ownerKey
  -> send ProcessEntry(entry) to ReactorWorkerEntity(ownerKey)

ReactorWorkerEntity(ownerKey)
  -> delegates to Reactor.reactToJournalEntry inside the entity mailbox
  -> Reactor.tryAcquire before planning
  -> phase heartbeat through planning / dispatching / completing
  -> plan + dispatch sequentially for that ownerKey
  -> complete claim + checkpoint
```

This keeps source-entry ownership durable while `Entity` gives per-subject
serialization.

## 10. Zombie claim protection

A zombie claim is a `processing` row whose owner is no longer making progress:
the process crashed, the fiber was interrupted, the host was partitioned, or the
worker lost its Effect Cluster shard but still has an old in-memory command path.

The design protects against zombies with four layers:

1. **Lease expiry** — every claim has `lease_expires_at`. Active attempts must
   heartbeat before expiry. Expired claims are recoverable.
2. **Token rotation** — every reacquire creates a fresh `claim_token`. Any old
   zombie fiber can continue running in memory, but it cannot heartbeat,
   complete, or block the claim after the token changes.
3. **Bounded attempts** — repeated expiry increments `attempt`. After a
   configured threshold, the repo should move the row to `blocked` with
   `blocked_at`, `conflict_reason`, and `last_error` instead of retrying
   forever.
4. **Sweeper recovery** — a cold recovery process may scan expired processing
   rows in bounded batches using deterministic ordering and `FOR UPDATE SKIP
   LOCKED`. The sweeper reacquires only rows it locked and skips rows already
   being recovered by another worker.

### 10.1 Reacquire algorithm

An expired row can be reacquired only when all of these are true:

- `claim_status = 'processing'`;
- `lease_expires_at < now()`;
- `policy_epoch` matches the local registry epoch;
- `registry_fingerprint` matches the local registry fingerprint;
- `attempt < max_attempts`.

On success, the repo atomically updates:

```sql
UPDATE iiot.reactor_source_claims
SET claim_token = $newToken,
    claimed_by = $claimedBy,
    attempt = attempt + 1,
    heartbeat_at = NOW(),
    lease_expires_at = NOW() + $leaseDuration::interval,
    last_error = NULL,
    metadata = metadata || $reacquireMetadata::jsonb
WHERE consumer_id = $consumerId
  AND source_entry_id = $sourceEntryId
  AND claim_status = 'processing'
  AND lease_expires_at < NOW()
  AND policy_epoch = $policyEpoch
  AND registry_fingerprint = $registryFingerprint
  AND attempt < $maxAttempts
RETURNING *;
```

If `attempt >= max_attempts`, the row should be moved to `blocked`, not silently
retried. That gives operations a deterministic intervention point instead of an
immortal zombie.

### 10.2 Sweeper query shape

Batch recovery should not scan-and-lock the world. Use a small batch with stable
ordering:

```sql
WITH expired AS (
  SELECT consumer_id, source_entry_id
  FROM iiot.reactor_source_claims
  WHERE claim_status = 'processing'
    AND lease_expires_at < NOW()
    AND policy_epoch = $policyEpoch
    AND registry_fingerprint = $registryFingerprint
  ORDER BY lease_expires_at ASC, consumer_id ASC, source_entry_id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT $batchSize
)
UPDATE iiot.reactor_source_claims c
SET claim_token = $tokenPrefix || ':' || gen_random_uuid(),
    claimed_by = $claimedBy,
    attempt = attempt + 1,
    heartbeat_at = NOW(),
    lease_expires_at = NOW() + $leaseDuration::interval,
    phase = 'recovering',
    metadata = metadata || $recoveryMetadata::jsonb
FROM expired e
WHERE c.consumer_id = e.consumer_id
  AND c.source_entry_id = e.source_entry_id
RETURNING c.*;
```

### 10.3 Spike results

A disposable PostgreSQL spike against `iiot._reactor_source_claim_spike` verified:

- expired zombie claim reacquired with a fresh token;
- stale owner completion using the old token returned zero rows;
- fresh owner completion using the new token succeeded;
- active non-expired claim remained `busy`;
- `FOR UPDATE SKIP LOCKED` skipped a row held by another recovery worker;
- exact-row lock timeout surfaced as a retryable lock timeout, not a deadlock.

Spike script: `tmp/reactor-source-claim-zombie-spike.sh`.

## 11. Failure semantics

### Crash before dispatch

- Claim row remains `processing`.
- Lease expires.
- Replayer reacquires with same epoch/fingerprint.
- Dispatch occurs once.

### Crash after dispatch before complete

- Claim row remains `processing`.
- Lease expires.
- Replayer reacquires and may dispatch again.
- Target entity idempotency (`caused_by_propagation_id`, request id) prevents a
  second transition.
- Replayer completes claim and writes checkpoint.

### Epoch conflict

- Existing claim freezes epoch A.
- A later process using epoch B receives `epoch_conflict`.
- It does not plan or dispatch.
- Operator sees the conflicting claim row and can either restore epoch A support,
  unblock manually, or perform an explicit migration.

### Registry drift

- Same logical policy epoch but different fingerprint is a deployment defect.
- The row is not processed by the drifting worker.
- Completed rows remain terminal even if a later bundle has a different
  fingerprint; drift fences only apply to processing/deferred recovery.
- This should page loudly in production.

## 12. Test plan

### Unit tests

1. `tryAcquire` inserts when no row exists.
2. Concurrent `tryAcquire` calls return exactly one `acquired` and N `busy`.
3. Final completed row returns `completed`.
4. Expired row with same epoch/fingerprint returns `reacquired` and rotates token.
5. Expired row with different epoch returns `epoch_conflict`.
6. Expired row with same epoch and different fingerprint returns `registry_drift`.
7. `complete` fails with a stale token.
8. `heartbeat` extends lease only for the active token.
9. Active non-expired row classifies as `busy` and is not reacquired.
10. Expired row over `maxAttempts` transitions to `blocked`.
11. Sweeper uses bounded `FOR UPDATE SKIP LOCKED` and does not pick locked rows.

### Integration tests

1. Two Reactor fibers race the same EventJournal entry: one dispatch occurs.
2. Two Reactor registries with different epochs race the same EventJournal entry:
   one claim wins and the other returns epoch conflict/busy; never two dispatches.
3. Crash-after-dispatch simulation: first attempt dispatches then does not
   complete; second attempt reacquires after lease expiry; target transition
   uniqueness prevents duplicate local state mutation; claim completes.
4. Zombie owner simulation: old owner sleeps past lease expiry, new owner
   reacquires, old owner attempts stale completion and receives zero-row update.
5. Sweeper concurrency simulation: two sweepers process expired rows with
   `SKIP LOCKED`; no row is reacquired by both.
6. Multi-lane recovery simulation: baseline and candidate fingerprints recover
   only their own expired rows; completed rows are terminal across later
   fingerprint changes.

### Production E2E prerequisite

The full Machine unavailable -> WorkOrder suspended E2E should include:

- real SQL EventJournal;
- real `reactor_source_claims`;
- real SQL WorkOrder state;
- real WorkOrderEntity RPC/machine transition;
- real `work_order_transitions.caused_by_propagation_id` uniqueness;
- real `reactor_checkpoints` final row;
- claim/checkpoint metadata containing subject, signal axes, policy IDs,
  target IDs, and dispatched/failed counters.

## 13. Migration path

1. Add schemas and DDL for `reactor_source_claims`.
2. Add `ReactorSourceClaimRepo` live + in-memory implementations.
3. Add `policyEpoch` and deterministic `registryFingerprint` to
   `ReactorRegistryConfig`.
4. Update `Reactor.reactToJournalEntry` to acquire before planning/dispatch.
5. Keep `ReactorCheckpointRepo` as final completion record.
6. Add source-claim tests.
7. Only then implement `ReactorWorkerEntity` keyed by stable subject owner key.

## 14. Decision

Make atomic source-entry claim an immediate prerequisite for Reactor singleton
productionization.

The cluster entity gives us per-subject serialization. The source-entry claim
gives us durable, epoch-aware, crash-recoverable processing authority.

We need both. Separately. Cleanly.
