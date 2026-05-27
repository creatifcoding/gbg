/**
 * ReactorSourceClaimRepo integration tests.
 *
 * These tests formalize the PostgreSQL spikes for source-entry claim authority,
 * zombie fencing, progress deadlines, deferred retry, epoch/fingerprint fences,
 * and bounded sweeper recovery.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  ReactorSourceClaimConfigTag,
  ReactorSourceClaimRepo,
  ReactorSourceClaimRepoLive,
} from '../../repos/ReactorSourceClaimRepo'
import {
  ReactorClaimPhases,
  ReactorSourceClaimConfig,
  type ReactorClaimToken,
  type ReactorConsumerId,
  type ReactorOwnerKey,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
  type ReactorSourceEntryId,
} from '../../schemas/reactor'
import {
  TestPgClientWithMigrations,
  isDatabaseAvailable,
} from './layer'

const TEST_CONSUMER = 'TEST-REACTOR-SOURCE-CLAIMS' as ReactorConsumerId
const TEST_EPOCH = 'epoch-test-A' as ReactorPolicyEpoch
const OTHER_EPOCH = 'epoch-test-B' as ReactorPolicyEpoch
const TEST_FINGERPRINT = 'fingerprint-test-A' as ReactorRegistryFingerprint
const OTHER_FINGERPRINT = 'fingerprint-test-B' as ReactorRegistryFingerprint
const TEST_OWNER = 'relationship-reactor:machine:M-CLAIM-TEST' as ReactorOwnerKey
const CLAIMED_BY_A = 'source-claim-test-worker-A'
const CLAIMED_BY_B = 'source-claim-test-worker-B'

const testConfig = new ReactorSourceClaimConfig({
  leaseDurationMs: 250,
  heartbeatIntervalMs: 50,
  attemptDeadlineMs: 600,
  maxAttempts: 2,
  deferRetryMs: 250,
  lockTimeoutMs: 250,
  sweeperBatchSize: 10,
})

const ReactorSourceClaimIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  ReactorSourceClaimRepoLive.pipe(
    Layer.provide(Layer.merge(
      TestPgClientWithMigrations,
      ReactorSourceClaimConfigTag.Custom(testConfig),
    )),
  ),
)

const cleanup = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_source_claims
    WHERE consumer_id = ${TEST_CONSUMER}
  `
})

const entryId = (suffix: string): ReactorSourceEntryId =>
  `ENTRY-SOURCE-CLAIM-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}` as ReactorSourceEntryId

const acquireInput = (sourceEntryId: ReactorSourceEntryId, overrides?: {
  readonly policyEpoch?: ReactorPolicyEpoch
  readonly registryFingerprint?: ReactorRegistryFingerprint
  readonly claimedBy?: string
  readonly claimToken?: ReactorClaimToken
}) => ({
  consumerId: TEST_CONSUMER,
  sourceEntryId,
  sourceEvent: 'EquipmentStateChanged',
  primaryKey: 'MCH-CLAIM-TEST',
  ownerKey: TEST_OWNER,
  policyEpoch: overrides?.policyEpoch ?? TEST_EPOCH,
  registryFingerprint: overrides?.registryFingerprint ?? TEST_FINGERPRINT,
  claimedBy: overrides?.claimedBy ?? CLAIMED_BY_A,
  claimToken: overrides?.claimToken,
  metadata: { source: 'reactor-source-claim.integration' },
})

const sleep = (ms: number) => Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)))
const futureUtc = (ms: number) => DateTime.unsafeFromDate(new Date(Date.now() + ms))
const pastUtc = (ms: number) => DateTime.unsafeFromDate(new Date(Date.now() - ms))

const setLeaseExpired = (sourceEntryId: ReactorSourceEntryId) => Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    UPDATE iiot.reactor_source_claims
    SET lease_expires_at = NOW() - INTERVAL '1 second'
    WHERE consumer_id = ${TEST_CONSUMER}
      AND source_entry_id = ${sourceEntryId}
  `
})

const setAttempt = (sourceEntryId: ReactorSourceEntryId, attempt: number) => Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    UPDATE iiot.reactor_source_claims
    SET attempt = ${attempt},
        lease_expires_at = NOW() - INTERVAL '1 second'
    WHERE consumer_id = ${TEST_CONSUMER}
      AND source_entry_id = ${sourceEntryId}
  `
})

const countClaims = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM iiot.reactor_source_claims
    WHERE consumer_id = ${TEST_CONSUMER}
  `
  return Number(rows[0]?.count ?? '0')
})

describe('ReactorSourceClaimRepo integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(ReactorSourceClaimIntegrationLayer)),
    )
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
    }
  })

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(cleanup.pipe(Effect.provide(ReactorSourceClaimIntegrationLayer)))
  })

  it('acquires one source entry once and classifies duplicate delivery as busy', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('ACQUIRE')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo

      const first = yield* repo.tryAcquire(acquireInput(sourceEntryId))
      const second = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_B }))

      expect(first._tag).toBe('ReactorClaimAcquired')
      expect(second._tag).toBe('ReactorClaimBusy')
      expect(second.claim.claimToken).toBe(first.claim.claimToken)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('reacquires expired claims with a fresh token and fences stale completion', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('ZOMBIE')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo

      const first = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_A }))
      expect(first._tag).toBe('ReactorClaimAcquired')
      const staleToken = first.claim.claimToken

      yield* setLeaseExpired(sourceEntryId)

      const second = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_B }))
      expect(second._tag).toBe('ReactorClaimReacquired')
      expect(second.claim.claimToken).not.toBe(staleToken)
      expect(second.claim.attempt).toBe(2)

      const staleComplete = yield* repo.complete({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: staleToken,
        outcome: 'processed',
        metadata: {},
      })
      expect(staleComplete).toBe(false)

      const freshComplete = yield* repo.complete({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: second.claim.claimToken,
        outcome: 'processed',
        metadata: {},
      })
      expect(freshComplete).toBe(true)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('rejects expired claim processing under a different policy epoch or registry fingerprint', async () => {
    if (!dbAvailable) return
    const epochEntry = entryId('EPOCH')
    const fingerprintEntry = entryId('FINGERPRINT')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo

      yield* repo.tryAcquire(acquireInput(epochEntry))
      yield* setLeaseExpired(epochEntry)
      const epochConflict = yield* repo.tryAcquire(acquireInput(epochEntry, { policyEpoch: OTHER_EPOCH }))
      expect(epochConflict._tag).toBe('ReactorClaimEpochConflict')

      yield* repo.tryAcquire(acquireInput(fingerprintEntry))
      yield* setLeaseExpired(fingerprintEntry)
      const registryDrift = yield* repo.tryAcquire(acquireInput(fingerprintEntry, { registryFingerprint: OTHER_FINGERPRINT }))
      expect(registryDrift._tag).toBe('ReactorClaimRegistryDrift')
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('keeps completed claims terminal across later lane fingerprint changes', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('COMPLETED-DRIFT')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo
      const acquired = yield* repo.tryAcquire(acquireInput(sourceEntryId))
      expect(acquired._tag).toBe('ReactorClaimAcquired')

      const completed = yield* repo.complete({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: acquired.claim.claimToken,
        outcome: 'processed',
        metadata: { lane: 'baseline' },
      })
      expect(completed).toBe(true)

      const replayUnderNewFingerprint = yield* repo.tryAcquire(acquireInput(sourceEntryId, {
        registryFingerprint: OTHER_FINGERPRINT,
        claimedBy: CLAIMED_BY_B,
      }))
      expect(replayUnderNewFingerprint._tag).toBe('ReactorClaimCompleted')
      expect(replayUnderNewFingerprint.claim.registryFingerprint).toBe(TEST_FINGERPRINT)
      expect(replayUnderNewFingerprint.claim.metadata).toMatchObject({ lane: 'baseline' })
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('caps heartbeat at attempt deadline and rejects heartbeats after deadline', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('DEADLINE')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo
      const acquired = yield* repo.tryAcquire(acquireInput(sourceEntryId))
      expect(acquired._tag).toBe('ReactorClaimAcquired')

      const firstHeartbeat = yield* repo.heartbeat({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: acquired.claim.claimToken,
        phase: ReactorClaimPhases.Dispatching,
        metadata: {},
      })
      expect(firstHeartbeat).toBe(true)

      yield* sleep(testConfig.attemptDeadlineMs + 100)

      const lateHeartbeat = yield* repo.heartbeat({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: acquired.claim.claimToken,
        phase: ReactorClaimPhases.Dispatching,
        metadata: {},
      })
      expect(lateHeartbeat).toBe(false)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('defers unavailable targets and reacquires only after nextRetryAt', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('DEFER')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo
      const acquired = yield* repo.tryAcquire(acquireInput(sourceEntryId))
      expect(acquired._tag).toBe('ReactorClaimAcquired')

      const didDefer = yield* repo.defer({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        claimToken: acquired.claim.claimToken,
        nextRetryAt: futureUtc(testConfig.deferRetryMs),
        lastError: 'target entity unavailable',
        metadata: {},
      })
      expect(didDefer).toBe(true)

      const immediate = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_B }))
      expect(immediate._tag).toBe('ReactorClaimDeferred')

      yield* sleep(testConfig.deferRetryMs + 100)

      const retried = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_B }))
      expect(retried._tag).toBe('ReactorClaimReacquired')
      expect(retried.claim.claimedBy).toBe(CLAIMED_BY_B)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('moves exhausted expired claims to blocked instead of immortal retry', async () => {
    if (!dbAvailable) return
    const sourceEntryId = entryId('BLOCK')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo
      yield* repo.tryAcquire(acquireInput(sourceEntryId))
      yield* setAttempt(sourceEntryId, testConfig.maxAttempts)

      const blocked = yield* repo.tryAcquire(acquireInput(sourceEntryId, { claimedBy: CLAIMED_BY_B }))
      expect(blocked._tag).toBe('ReactorClaimBlocked')
      expect(blocked.claim.claimStatus).toBe('blocked')
      expect(blocked.claim.conflictReason).toBe('max_attempts_exhausted')
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('sweeper only recovers claims for the requested lane fingerprint', async () => {
    if (!dbAvailable) return
    const baselineEntry = entryId('SWEEP-FP-BASELINE')
    const candidateEntry = entryId('SWEEP-FP-CANDIDATE')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo

      yield* repo.tryAcquire(acquireInput(baselineEntry))
      yield* repo.tryAcquire(acquireInput(candidateEntry, { registryFingerprint: OTHER_FINGERPRINT }))
      yield* setLeaseExpired(baselineEntry)
      yield* setLeaseExpired(candidateEntry)

      const recovered = yield* repo.findExpired({
        policyEpoch: TEST_EPOCH,
        registryFingerprint: TEST_FINGERPRINT,
        claimedBy: 'source-claim-sweeper-baseline',
        batchSize: 10,
      })

      expect(recovered.map((claim) => claim.sourceEntryId)).toEqual([baselineEntry])
      expect(recovered[0]?.registryFingerprint).toBe(TEST_FINGERPRINT)

      const candidateRecovered = yield* repo.findExpired({
        policyEpoch: TEST_EPOCH,
        registryFingerprint: OTHER_FINGERPRINT,
        claimedBy: 'source-claim-sweeper-candidate',
        batchSize: 10,
      })

      expect(candidateRecovered.map((claim) => claim.sourceEntryId)).toEqual([candidateEntry])
      expect(candidateRecovered[0]?.registryFingerprint).toBe(OTHER_FINGERPRINT)
      expect(candidateRecovered[0]?.phase).toBe(ReactorClaimPhases.Recovering)
      expect(yield* countClaims).toBe(2)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })

  it('sweeper reacquires expired and ready deferred claims without duplicating rows', async () => {
    if (!dbAvailable) return
    const expiredEntry = entryId('SWEEP-EXPIRED')
    const deferredEntry = entryId('SWEEP-DEFERRED')

    const program = Effect.gen(function* () {
      const repo = yield* ReactorSourceClaimRepo

      const expired = yield* repo.tryAcquire(acquireInput(expiredEntry))
      expect(expired._tag).toBe('ReactorClaimAcquired')
      yield* setLeaseExpired(expiredEntry)

      const deferredClaim = yield* repo.tryAcquire(acquireInput(deferredEntry))
      expect(deferredClaim._tag).toBe('ReactorClaimAcquired')
      yield* repo.defer({
        consumerId: TEST_CONSUMER,
        sourceEntryId: deferredEntry,
        claimToken: deferredClaim.claim.claimToken,
        nextRetryAt: pastUtc(100),
        lastError: 'target entity unavailable',
        metadata: {},
      })

      const recovered = yield* repo.findExpired({
        policyEpoch: TEST_EPOCH,
        registryFingerprint: TEST_FINGERPRINT,
        claimedBy: 'source-claim-sweeper',
        batchSize: 10,
      })

      expect(recovered).toHaveLength(2)
      expect(recovered.map((claim) => claim.sourceEntryId).sort()).toEqual([deferredEntry, expiredEntry].sort())
      expect(recovered.every((claim) => claim.phase === ReactorClaimPhases.Recovering)).toBe(true)
      expect(recovered.every((claim) => claim.attempt === 2)).toBe(true)
      expect(yield* countClaims).toBe(2)
    }).pipe(Effect.provide(ReactorSourceClaimIntegrationLayer))

    await Effect.runPromise(program)
  })
})
