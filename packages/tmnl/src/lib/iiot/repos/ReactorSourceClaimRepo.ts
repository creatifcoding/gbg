/**
 * ReactorSourceClaimRepo — pre-dispatch source-entry authority and recovery.
 *
 * This repository owns the persistence encoding for Reactor source claims. Raw
 * PostgreSQL TEXT statuses/phases are decoded through Effect Schema at this
 * boundary; callers should consume typed claim rows and tagged acquire results,
 * not hand-written status strings.
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult, Ref, Schema } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import {
  ReactorClaimAcquireInput,
  ReactorClaimBlockInput,
  ReactorClaimBusy,
  ReactorClaimCompleteInput,
  ReactorClaimCompleted,
  ReactorClaimDeferInput,
  ReactorClaimDeferred,
  ReactorClaimEpochConflict,
  ReactorClaimFindExpiredInput,
  ReactorClaimHeartbeatInput,
  ReactorClaimPhases,
  ReactorClaimReacquired,
  ReactorClaimRegistryDrift,
  ReactorClaimStatuses,
  ReactorClaimBlocked,
  ReactorClaimAcquired,
  ReactorClaimToken,
  ReactorSourceClaim,
  ReactorSourceClaimConfigDefaults,
  type ReactorClaimAcquireResult,
  type ReactorConsumerId,
  type ReactorSourceClaimConfig,
  type ReactorSourceEntryId,
} from '../schemas/reactor'

export type ReactorSourceClaimRepoError = SqlError.SqlError | ParseResult.ParseError

export interface ReactorSourceClaimRepository {
  readonly tryAcquire: (input: ReactorClaimAcquireInput) => Effect.Effect<ReactorClaimAcquireResult, ReactorSourceClaimRepoError>
  readonly heartbeat: (input: ReactorClaimHeartbeatInput) => Effect.Effect<boolean, ReactorSourceClaimRepoError>
  readonly complete: (input: ReactorClaimCompleteInput) => Effect.Effect<boolean, ReactorSourceClaimRepoError>
  readonly defer: (input: ReactorClaimDeferInput) => Effect.Effect<boolean, ReactorSourceClaimRepoError>
  readonly block: (input: ReactorClaimBlockInput) => Effect.Effect<boolean, ReactorSourceClaimRepoError>
  /**
   * Reacquire expired processing claims and ready deferred claims in a bounded
   * batch. Uses SKIP LOCKED in the live implementation.
   */
  readonly findExpired: (input: ReactorClaimFindExpiredInput) => Effect.Effect<readonly ReactorSourceClaim[], ReactorSourceClaimRepoError>
}

export class ReactorSourceClaimRepo extends Context.Tag('iiot/ReactorSourceClaimRepo')<
  ReactorSourceClaimRepo,
  ReactorSourceClaimRepository
>() {}

export class ReactorSourceClaimConfigTag extends Context.Tag('iiot/ReactorSourceClaimConfig')<
  ReactorSourceClaimConfigTag,
  ReactorSourceClaimConfig
>() {
  static readonly Default = Layer.succeed(this, ReactorSourceClaimConfigDefaults)
  static readonly Custom = (config: ReactorSourceClaimConfig) => Layer.succeed(this, config)
}

const decodeClaim = (row: unknown): Effect.Effect<ReactorSourceClaim, ParseResult.ParseError> =>
  Schema.decodeUnknown(ReactorSourceClaim)(normalizeClaimRow(row))

const decodeClaims = (rows: readonly unknown[]): Effect.Effect<readonly ReactorSourceClaim[], ParseResult.ParseError> =>
  Schema.decodeUnknown(Schema.Array(ReactorSourceClaim))(rows.map(normalizeClaimRow))

const normalizeClaimRow = (row: unknown): unknown => {
  if (typeof row !== 'object' || row === null) return row
  const record = row as Record<string, unknown>
  return {
    _tag: 'ReactorSourceClaim',
    ...record,
    nextRetryAt: record.nextRetryAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    blockedAt: record.blockedAt ?? undefined,
    outcome: record.outcome ?? undefined,
    conflictReason: record.conflictReason ?? undefined,
    lastError: record.lastError ?? undefined,
    metadata: record.metadata ?? {},
  }
}

const newClaimToken = (): ReactorClaimToken =>
  crypto.randomUUID() as ReactorClaimToken

const key = (consumerId: ReactorConsumerId, sourceEntryId: ReactorSourceEntryId): string =>
  `${consumerId}:${sourceEntryId}`

const isLeaseActive = (claim: ReactorSourceClaim): boolean =>
  claim.leaseExpiresAt.epochMillis > Date.now()

const isRetryDeferred = (claim: ReactorSourceClaim): boolean =>
  claim.nextRetryAt !== undefined && claim.nextRetryAt.epochMillis > Date.now()

const isSqlLockTimeout = (error: unknown): boolean => {
  const sqlError = error as { readonly message?: string; readonly cause?: unknown }
  const message = `${sqlError.message ?? ''} ${String(sqlError.cause ?? '')}`.toLowerCase()
  return message.includes('lock timeout') || message.includes('lock_not_available') || message.includes('55p03')
}

const acquired = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimAcquired',
  claim,
})
const reacquired = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimReacquired',
  claim,
})
const busy = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimBusy',
  claim,
})
const deferred = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimDeferred',
  claim,
})
const completed = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimCompleted',
  claim,
})
const blocked = (claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimBlocked',
  claim,
})
const epochConflict = (input: ReactorClaimAcquireInput, claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimEpochConflict',
  claim,
  requestedPolicyEpoch: input.policyEpoch,
})
const registryDrift = (input: ReactorClaimAcquireInput, claim: ReactorSourceClaim): ReactorClaimAcquireResult => ({
  _tag: 'ReactorClaimRegistryDrift',
  claim,
  requestedRegistryFingerprint: input.registryFingerprint,
})

const shouldReacquire = (input: ReactorClaimAcquireInput, claim: ReactorSourceClaim, config: ReactorSourceClaimConfig): boolean => {
  if (claim.policyEpoch !== input.policyEpoch) return false
  if (claim.registryFingerprint !== input.registryFingerprint) return false
  if (claim.attempt >= config.maxAttempts) return false
  if (claim.claimStatus === ReactorClaimStatuses.Processing) return !isLeaseActive(claim)
  if (claim.claimStatus === ReactorClaimStatuses.Deferred) return !isRetryDeferred(claim)
  return false
}

const classifyExisting = (
  input: ReactorClaimAcquireInput,
  claim: ReactorSourceClaim,
  config: ReactorSourceClaimConfig,
): ReactorClaimAcquireResult | 'reacquire' | 'block' => {
  if (claim.claimStatus === ReactorClaimStatuses.Completed) return completed(claim)
  if (claim.claimStatus === ReactorClaimStatuses.Blocked) return blocked(claim)

  if (claim.policyEpoch !== input.policyEpoch) return epochConflict(input, claim)
  if (claim.registryFingerprint !== input.registryFingerprint) return registryDrift(input, claim)

  if (claim.claimStatus === ReactorClaimStatuses.Deferred && isRetryDeferred(claim)) return deferred(claim)
  if (claim.claimStatus === ReactorClaimStatuses.Processing && isLeaseActive(claim)) return busy(claim)

  if (claim.attempt >= config.maxAttempts) return 'block'
  if (shouldReacquire(input, claim, config)) return 'reacquire'

  return busy(claim)
}

const withLockTimeout = (sql: SqlClient.SqlClient, config: ReactorSourceClaimConfig) =>
  sql`SELECT set_config('lock_timeout', ${`${config.lockTimeoutMs}ms`}, true)`

const selectClaimForUpdate = (
  sql: SqlClient.SqlClient,
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
) =>
  sql<unknown>`
    SELECT *
    FROM iiot.reactor_source_claims
    WHERE consumer_id = ${consumerId}
      AND source_entry_id = ${sourceEntryId}
    FOR UPDATE
  `

const selectClaim = (
  sql: SqlClient.SqlClient,
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
) =>
  sql<unknown>`
    SELECT *
    FROM iiot.reactor_source_claims
    WHERE consumer_id = ${consumerId}
      AND source_entry_id = ${sourceEntryId}
  `

export const ReactorSourceClaimRepoLive = Layer.effect(
  ReactorSourceClaimRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const config = yield* ReactorSourceClaimConfigTag

    const fallbackBusy: (input: ReactorClaimAcquireInput) => Effect.Effect<ReactorClaimAcquireResult, ReactorSourceClaimRepoError> = (input) =>
      Effect.gen(function* () {
        const rows = yield* selectClaim(sql, input.consumerId, input.sourceEntryId)
        if (rows.length === 0) return yield* Effect.fail(new SqlError.SqlError({ message: 'Claim lock timeout and row not visible' }))
        const claim = yield* decodeClaim(rows[0])
        return busy(claim)
      })

    const insertNew = (input: ReactorClaimAcquireInput, token: ReactorClaimToken) =>
      sql<unknown>`
        INSERT INTO iiot.reactor_source_claims (
          consumer_id,
          source_entry_id,
          source_event,
          primary_key,
          owner_key,
          policy_epoch,
          registry_fingerprint,
          claim_status,
          claim_token,
          claimed_by,
          attempt,
          phase,
          heartbeat_at,
          lease_expires_at,
          attempt_deadline_at,
          phase_started_at,
          metadata
        ) VALUES (
          ${input.consumerId},
          ${input.sourceEntryId},
          ${input.sourceEvent},
          ${input.primaryKey},
          ${input.ownerKey},
          ${input.policyEpoch},
          ${input.registryFingerprint},
          ${ReactorClaimStatuses.Processing},
          ${token},
          ${input.claimedBy},
          1,
          ${ReactorClaimPhases.Acquired},
          NOW(),
          NOW() + (${config.leaseDurationMs} * INTERVAL '1 millisecond'),
          NOW() + (${config.attemptDeadlineMs} * INTERVAL '1 millisecond'),
          NOW(),
          ${input.metadata}
        )
        ON CONFLICT (consumer_id, source_entry_id) DO NOTHING
        RETURNING *
      `

    const reacquireClaim = (input: ReactorClaimAcquireInput, token: ReactorClaimToken) =>
      sql<unknown>`
        UPDATE iiot.reactor_source_claims
        SET claim_status = ${ReactorClaimStatuses.Processing},
            claim_token = ${token},
            claimed_by = ${input.claimedBy},
            attempt = attempt + 1,
            phase = ${ReactorClaimPhases.Recovering},
            heartbeat_at = NOW(),
            lease_expires_at = NOW() + (${config.leaseDurationMs} * INTERVAL '1 millisecond'),
            attempt_deadline_at = NOW() + (${config.attemptDeadlineMs} * INTERVAL '1 millisecond'),
            phase_started_at = NOW(),
            next_retry_at = NULL,
            last_error = NULL,
            metadata = metadata || ${input.metadata}::jsonb
        WHERE consumer_id = ${input.consumerId}
          AND source_entry_id = ${input.sourceEntryId}
          AND claim_status IN (${ReactorClaimStatuses.Processing}, ${ReactorClaimStatuses.Deferred})
          AND policy_epoch = ${input.policyEpoch}
          AND registry_fingerprint = ${input.registryFingerprint}
          AND attempt < ${config.maxAttempts}
          AND (
            (claim_status = ${ReactorClaimStatuses.Processing} AND lease_expires_at < NOW())
            OR (claim_status = ${ReactorClaimStatuses.Deferred} AND next_retry_at <= NOW())
          )
        RETURNING *
      `

    const blockClaimByAcquire = (input: ReactorClaimAcquireInput, current: ReactorSourceClaim) =>
      sql<unknown>`
        UPDATE iiot.reactor_source_claims
        SET claim_status = ${ReactorClaimStatuses.Blocked},
            blocked_at = NOW(),
            conflict_reason = 'max_attempts_exhausted',
            last_error = ${`Claim attempt cap reached at attempt ${current.attempt}`},
            metadata = metadata || ${input.metadata}::jsonb
        WHERE consumer_id = ${input.consumerId}
          AND source_entry_id = ${input.sourceEntryId}
          AND claim_status IN (${ReactorClaimStatuses.Processing}, ${ReactorClaimStatuses.Deferred})
          AND policy_epoch = ${input.policyEpoch}
          AND registry_fingerprint = ${input.registryFingerprint}
        RETURNING *
      `

    const tryAcquire: ReactorSourceClaimRepository['tryAcquire'] = (input) => {
      const program = sql.withTransaction(
        Effect.gen(function* () {
          yield* withLockTimeout(sql, config)
          const token = input.claimToken ?? newClaimToken()

          const insertedRows = yield* insertNew(input, token)
          if (insertedRows.length > 0) {
            const claim = yield* decodeClaim(insertedRows[0])
            return acquired(claim)
          }

          const existingRows = yield* selectClaimForUpdate(sql, input.consumerId, input.sourceEntryId)
          if (existingRows.length === 0) return yield* Effect.fail(new SqlError.SqlError({ message: 'Claim insert lost race but row was not visible' }))

          const current = yield* decodeClaim(existingRows[0])
          const classification = classifyExisting(input, current, config)
          if (classification === 'reacquire') {
            const updatedRows = yield* reacquireClaim(input, token)
            const updated = yield* decodeClaim(updatedRows[0])
            return reacquired(updated)
          }
          if (classification === 'block') {
            const blockedRows = yield* blockClaimByAcquire(input, current)
            const updated = yield* decodeClaim(blockedRows[0])
            return blocked(updated)
          }
          return classification
        }),
      )

      return program.pipe(
        Effect.catchIf(isSqlLockTimeout, () => fallbackBusy(input)),
      )
    }

    const heartbeat: ReactorSourceClaimRepository['heartbeat'] = (input) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ updated: number }>`
          UPDATE iiot.reactor_source_claims
          SET heartbeat_at = NOW(),
              lease_expires_at = LEAST(NOW() + (${config.leaseDurationMs} * INTERVAL '1 millisecond'), attempt_deadline_at),
              phase = ${input.phase},
              phase_started_at = CASE WHEN phase <> ${input.phase} THEN NOW() ELSE phase_started_at END,
              metadata = metadata || ${input.metadata}::jsonb
          WHERE consumer_id = ${input.consumerId}
            AND source_entry_id = ${input.sourceEntryId}
            AND claim_token = ${input.claimToken}
            AND claim_status = ${ReactorClaimStatuses.Processing}
            AND NOW() < attempt_deadline_at
          RETURNING 1 AS updated
        `
        return rows.length > 0
      })

    const complete: ReactorSourceClaimRepository['complete'] = (input) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ updated: number }>`
          UPDATE iiot.reactor_source_claims
          SET claim_status = ${ReactorClaimStatuses.Completed},
              phase = ${ReactorClaimPhases.Completing},
              outcome = ${input.outcome},
              completed_at = NOW(),
              heartbeat_at = NOW(),
              metadata = metadata || ${input.metadata}::jsonb
          WHERE consumer_id = ${input.consumerId}
            AND source_entry_id = ${input.sourceEntryId}
            AND claim_token = ${input.claimToken}
            AND claim_status = ${ReactorClaimStatuses.Processing}
            AND NOW() <= attempt_deadline_at
          RETURNING 1 AS updated
        `
        return rows.length > 0
      })

    const defer: ReactorSourceClaimRepository['defer'] = (input) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ updated: number }>`
          UPDATE iiot.reactor_source_claims
          SET claim_status = ${ReactorClaimStatuses.Deferred},
              next_retry_at = ${input.nextRetryAt},
              last_error = ${input.lastError},
              heartbeat_at = NOW(),
              metadata = metadata || ${input.metadata}::jsonb
          WHERE consumer_id = ${input.consumerId}
            AND source_entry_id = ${input.sourceEntryId}
            AND claim_token = ${input.claimToken}
            AND claim_status = ${ReactorClaimStatuses.Processing}
          RETURNING 1 AS updated
        `
        return rows.length > 0
      })

    const block: ReactorSourceClaimRepository['block'] = (input) =>
      Effect.gen(function* () {
        const rows = input.claimToken === undefined
          ? yield* sql<{ updated: number }>`
              UPDATE iiot.reactor_source_claims
              SET claim_status = ${ReactorClaimStatuses.Blocked},
                  blocked_at = NOW(),
                  conflict_reason = ${input.conflictReason},
                  last_error = ${Option.getOrUndefined(Option.fromNullable(input.lastError))},
                  metadata = metadata || ${input.metadata}::jsonb
              WHERE consumer_id = ${input.consumerId}
                AND source_entry_id = ${input.sourceEntryId}
                AND claim_status <> ${ReactorClaimStatuses.Completed}
              RETURNING 1 AS updated
            `
          : yield* sql<{ updated: number }>`
              UPDATE iiot.reactor_source_claims
              SET claim_status = ${ReactorClaimStatuses.Blocked},
                  blocked_at = NOW(),
                  conflict_reason = ${input.conflictReason},
                  last_error = ${Option.getOrUndefined(Option.fromNullable(input.lastError))},
                  metadata = metadata || ${input.metadata}::jsonb
              WHERE consumer_id = ${input.consumerId}
                AND source_entry_id = ${input.sourceEntryId}
                AND claim_token = ${input.claimToken}
                AND claim_status <> ${ReactorClaimStatuses.Completed}
              RETURNING 1 AS updated
            `
        return rows.length > 0
      })

    const findExpired: ReactorSourceClaimRepository['findExpired'] = (input) =>
      sql.withTransaction(
        Effect.gen(function* () {
          yield* withLockTimeout(sql, config)

          yield* sql`
            WITH exhausted AS (
              SELECT consumer_id, source_entry_id
              FROM iiot.reactor_source_claims
              WHERE policy_epoch = ${input.policyEpoch}
                AND registry_fingerprint = ${input.registryFingerprint}
                AND claim_status IN (${ReactorClaimStatuses.Processing}, ${ReactorClaimStatuses.Deferred})
                AND attempt >= ${config.maxAttempts}
                AND (
                  (claim_status = ${ReactorClaimStatuses.Processing} AND lease_expires_at < NOW())
                  OR (claim_status = ${ReactorClaimStatuses.Deferred} AND next_retry_at <= NOW())
                )
              ORDER BY lease_expires_at ASC, consumer_id ASC, source_entry_id ASC
              FOR UPDATE SKIP LOCKED
              LIMIT ${input.batchSize}
            )
            UPDATE iiot.reactor_source_claims c
            SET claim_status = ${ReactorClaimStatuses.Blocked},
                blocked_at = NOW(),
                conflict_reason = 'max_attempts_exhausted',
                last_error = 'Claim attempt cap reached during sweeper recovery'
            FROM exhausted e
            WHERE c.consumer_id = e.consumer_id
              AND c.source_entry_id = e.source_entry_id
          `

          const pickedRows = yield* sql<unknown>`
            WITH picked AS (
              SELECT consumer_id, source_entry_id
              FROM iiot.reactor_source_claims
              WHERE policy_epoch = ${input.policyEpoch}
                AND registry_fingerprint = ${input.registryFingerprint}
                AND claim_status IN (${ReactorClaimStatuses.Processing}, ${ReactorClaimStatuses.Deferred})
                AND attempt < ${config.maxAttempts}
                AND (
                  (claim_status = ${ReactorClaimStatuses.Processing} AND lease_expires_at < NOW())
                  OR (claim_status = ${ReactorClaimStatuses.Deferred} AND next_retry_at <= NOW())
                )
              ORDER BY lease_expires_at ASC, consumer_id ASC, source_entry_id ASC
              FOR UPDATE SKIP LOCKED
              LIMIT ${input.batchSize}
            )
            SELECT c.*
            FROM iiot.reactor_source_claims c
            JOIN picked p USING (consumer_id, source_entry_id)
            ORDER BY c.lease_expires_at ASC, c.consumer_id ASC, c.source_entry_id ASC
            FOR UPDATE
          `

          const reacquiredClaims = yield* Effect.forEach(pickedRows, (row) =>
            Effect.gen(function* () {
              const current = yield* decodeClaim(row)
              const token = newClaimToken()
              const rows = yield* sql<unknown>`
                UPDATE iiot.reactor_source_claims
                SET claim_status = ${ReactorClaimStatuses.Processing},
                    claim_token = ${token},
                    claimed_by = ${input.claimedBy},
                    attempt = attempt + 1,
                    phase = ${ReactorClaimPhases.Recovering},
                    heartbeat_at = NOW(),
                    lease_expires_at = NOW() + (${config.leaseDurationMs} * INTERVAL '1 millisecond'),
                    attempt_deadline_at = NOW() + (${config.attemptDeadlineMs} * INTERVAL '1 millisecond'),
                    phase_started_at = NOW(),
                    next_retry_at = NULL,
                    last_error = NULL,
                    metadata = metadata || ${{
                      recoveredFromToken: current.claimToken,
                      recoveredBy: input.claimedBy,
                    }}::jsonb
                WHERE consumer_id = ${current.consumerId}
                  AND source_entry_id = ${current.sourceEntryId}
                  AND policy_epoch = ${input.policyEpoch}
                  AND registry_fingerprint = ${input.registryFingerprint}
                RETURNING *
              `
              return yield* decodeClaim(rows[0])
            }),
          )

          return reacquiredClaims
        }),
      )

    return ReactorSourceClaimRepo.of({
      tryAcquire,
      heartbeat,
      complete,
      defer,
      block,
      findExpired,
    })
  }),
)

export const ReactorSourceClaimRepoInMemory = Layer.effect(
  ReactorSourceClaimRepo,
  Effect.gen(function* () {
    const config = yield* ReactorSourceClaimConfigTag
    const store = yield* Ref.make(new Map<string, ReactorSourceClaim>())

    const nowDate = () => new Date()
    const future = (ms: number) => new Date(Date.now() + ms)

    const tryAcquire: ReactorSourceClaimRepository['tryAcquire'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const claimKey = key(input.consumerId, input.sourceEntryId)
          const existing = map.get(claimKey)
          const token = input.claimToken ?? newClaimToken()
          const next = new Map(map)

          if (!existing) {
            const claim = yield* decodeClaim({
              consumerId: input.consumerId,
              sourceEntryId: input.sourceEntryId,
              sourceEvent: input.sourceEvent,
              primaryKey: input.primaryKey,
              ownerKey: input.ownerKey,
              policyEpoch: input.policyEpoch,
              registryFingerprint: input.registryFingerprint,
              claimStatus: ReactorClaimStatuses.Processing,
              claimToken: token,
              claimedBy: input.claimedBy,
              attempt: 1,
              phase: ReactorClaimPhases.Acquired,
              claimedAt: nowDate(),
              heartbeatAt: nowDate(),
              leaseExpiresAt: future(config.leaseDurationMs),
              attemptDeadlineAt: future(config.attemptDeadlineMs),
              phaseStartedAt: nowDate(),
              metadata: input.metadata,
            })
            next.set(claimKey, claim)
            return [acquired(claim), next] as const
          }

          const classification = classifyExisting(input, existing, config)
          if (classification === 'reacquire') {
            const claim = yield* decodeClaim({
              ...existing,
              claimStatus: ReactorClaimStatuses.Processing,
              claimToken: token,
              claimedBy: input.claimedBy,
              attempt: existing.attempt + 1,
              phase: ReactorClaimPhases.Recovering,
              heartbeatAt: nowDate(),
              leaseExpiresAt: future(config.leaseDurationMs),
              attemptDeadlineAt: future(config.attemptDeadlineMs),
              phaseStartedAt: nowDate(),
              nextRetryAt: undefined,
              lastError: undefined,
              metadata: { ...existing.metadata, ...input.metadata },
            })
            next.set(claimKey, claim)
            return [reacquired(claim), next] as const
          }
          if (classification === 'block') {
            const claim = yield* decodeClaim({
              ...existing,
              claimStatus: ReactorClaimStatuses.Blocked,
              blockedAt: nowDate(),
              conflictReason: 'max_attempts_exhausted',
              lastError: `Claim attempt cap reached at attempt ${existing.attempt}`,
              metadata: { ...existing.metadata, ...input.metadata },
            })
            next.set(claimKey, claim)
            return [blocked(claim), next] as const
          }
          return [classification, map] as const
        }),
      )

    const heartbeat: ReactorSourceClaimRepository['heartbeat'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const claimKey = key(input.consumerId, input.sourceEntryId)
          const existing = map.get(claimKey)
          if (!existing || existing.claimToken !== input.claimToken || existing.claimStatus !== ReactorClaimStatuses.Processing) {
            return [false, map] as const
          }
          if (existing.attemptDeadlineAt.epochMillis <= Date.now()) return [false, map] as const

          const leaseMs = Math.min(Date.now() + config.leaseDurationMs, existing.attemptDeadlineAt.epochMillis)
          const next = new Map(map)
          const claim = yield* decodeClaim({
            ...existing,
            heartbeatAt: nowDate(),
            leaseExpiresAt: new Date(leaseMs),
            phaseStartedAt: existing.phase === input.phase ? existing.phaseStartedAt : nowDate(),
            phase: input.phase,
            metadata: { ...existing.metadata, ...input.metadata },
          })
          next.set(claimKey, claim)
          return [true, next] as const
        }),
      )

    const complete: ReactorSourceClaimRepository['complete'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const claimKey = key(input.consumerId, input.sourceEntryId)
          const existing = map.get(claimKey)
          if (!existing || existing.claimToken !== input.claimToken || existing.claimStatus !== ReactorClaimStatuses.Processing) {
            return [false, map] as const
          }
          if (existing.attemptDeadlineAt.epochMillis < Date.now()) return [false, map] as const

          const next = new Map(map)
          const claim = yield* decodeClaim({
            ...existing,
            claimStatus: ReactorClaimStatuses.Completed,
            phase: ReactorClaimPhases.Completing,
            outcome: input.outcome,
            completedAt: nowDate(),
            heartbeatAt: nowDate(),
            metadata: { ...existing.metadata, ...input.metadata },
          })
          next.set(claimKey, claim)
          return [true, next] as const
        }),
      )

    const defer: ReactorSourceClaimRepository['defer'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const claimKey = key(input.consumerId, input.sourceEntryId)
          const existing = map.get(claimKey)
          if (!existing || existing.claimToken !== input.claimToken || existing.claimStatus !== ReactorClaimStatuses.Processing) {
            return [false, map] as const
          }
          const next = new Map(map)
          const claim = yield* decodeClaim({
            ...existing,
            claimStatus: ReactorClaimStatuses.Deferred,
            nextRetryAt: input.nextRetryAt,
            lastError: input.lastError,
            heartbeatAt: nowDate(),
            metadata: { ...existing.metadata, ...input.metadata },
          })
          next.set(claimKey, claim)
          return [true, next] as const
        }),
      )

    const block: ReactorSourceClaimRepository['block'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const claimKey = key(input.consumerId, input.sourceEntryId)
          const existing = map.get(claimKey)
          if (!existing || existing.claimStatus === ReactorClaimStatuses.Completed) return [false, map] as const
          if (input.claimToken !== undefined && existing.claimToken !== input.claimToken) return [false, map] as const

          const next = new Map(map)
          const claim = yield* decodeClaim({
            ...existing,
            claimStatus: ReactorClaimStatuses.Blocked,
            blockedAt: nowDate(),
            conflictReason: input.conflictReason,
            lastError: input.lastError,
            metadata: { ...existing.metadata, ...input.metadata },
          })
          next.set(claimKey, claim)
          return [true, next] as const
        }),
      )

    const findExpired: ReactorSourceClaimRepository['findExpired'] = (input) =>
      Ref.modifyEffect(store, (map) =>
        Effect.gen(function* () {
          const next = new Map(map)
          const picked: ReactorSourceClaim[] = []
          const candidates = Array.from(map.values())
            .filter((claim) => claim.policyEpoch === input.policyEpoch && claim.registryFingerprint === input.registryFingerprint)
            .filter((claim) =>
              claim.claimStatus === ReactorClaimStatuses.Processing
                ? !isLeaseActive(claim)
                : claim.claimStatus === ReactorClaimStatuses.Deferred && !isRetryDeferred(claim),
            )
            .sort((a, b) => a.leaseExpiresAt.epochMillis - b.leaseExpiresAt.epochMillis)
            .slice(0, input.batchSize)

          for (const current of candidates) {
            const claimKey = key(current.consumerId, current.sourceEntryId)
            if (current.attempt >= config.maxAttempts) {
              const blockedClaim = yield* decodeClaim({
                ...current,
                claimStatus: ReactorClaimStatuses.Blocked,
                blockedAt: nowDate(),
                conflictReason: 'max_attempts_exhausted',
                lastError: 'Claim attempt cap reached during sweeper recovery',
              })
              next.set(claimKey, blockedClaim)
              continue
            }
            const claim = yield* decodeClaim({
              ...current,
              claimStatus: ReactorClaimStatuses.Processing,
              claimToken: newClaimToken(),
              claimedBy: input.claimedBy,
              attempt: current.attempt + 1,
              phase: ReactorClaimPhases.Recovering,
              heartbeatAt: nowDate(),
              leaseExpiresAt: future(config.leaseDurationMs),
              attemptDeadlineAt: future(config.attemptDeadlineMs),
              phaseStartedAt: nowDate(),
              nextRetryAt: undefined,
              lastError: undefined,
              metadata: { ...current.metadata, recoveredBy: input.claimedBy },
            })
            next.set(claimKey, claim)
            picked.push(claim)
          }

          return [picked, next] as const
        }),
      )

    return ReactorSourceClaimRepo.of({
      tryAcquire,
      heartbeat,
      complete,
      defer,
      block,
      findExpired,
    })
  }),
)
