/**
 * GeniferSignalRepo — Repository for genifer.signals (append-only)
 *
 * @module
 */

import { Context, Effect, Layer, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { GeniferSignalModel } from '../models/GeniferSignalModel'
import type { SignalTargetType, SignalType } from '../models/_common'
import { decodeRows } from './_decode'

// =============================================================================
// Types
// =============================================================================

export type GeniferSignalRepoError = SqlError.SqlError | ParseResult.ParseError

export interface GeniferSignalRepository {
  /** Append a signal event */
  readonly emit: (signal: {
    targetType: SignalTargetType
    targetId: string
    signalType: SignalType
    value: number
    metadata?: unknown
  }) => Effect.Effect<void, SqlError.SqlError>
  /** Get signals for a target */
  readonly findByTarget: (targetType: SignalTargetType, targetId: string) => Effect.Effect<readonly GeniferSignalModel[], GeniferSignalRepoError>
  /** Get recent signals of a type */
  readonly findByType: (signalType: SignalType, limit?: number) => Effect.Effect<readonly GeniferSignalModel[], GeniferSignalRepoError>
}

// =============================================================================
// Tag
// =============================================================================

export class GeniferSignalRepo extends Context.Tag('genifer/SignalRepo')<
  GeniferSignalRepo,
  GeniferSignalRepository
>() {}

// =============================================================================
// Column select
// =============================================================================

const SIG_COLS = `
  id,
  target_type  AS "targetType",
  target_id    AS "targetId",
  signal_type  AS "signalType",
  value,
  metadata,
  created_at   AS "createdAt"
`

// =============================================================================
// Implementation
// =============================================================================

export const GeniferSignalRepoLive = Layer.effect(
  GeniferSignalRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const emit = (signal: {
      targetType: SignalTargetType
      targetId: string
      signalType: SignalType
      value: number
      metadata?: unknown
    }) =>
      sql.unsafe(
        `INSERT INTO genifer.signals (target_type, target_id, signal_type, value, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          signal.targetType, signal.targetId, signal.signalType,
          signal.value, signal.metadata ? JSON.stringify(signal.metadata) : null,
        ]
      ).pipe(Effect.asVoid)

    const findByTarget = (targetType: SignalTargetType, targetId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${SIG_COLS} FROM genifer.signals WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC`,
          [targetType, targetId]
        )
        return yield* decodeRows(GeniferSignalModel)(rows)
      })

    const findByType = (signalType: SignalType, limit = 100) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${SIG_COLS} FROM genifer.signals WHERE signal_type = $1 ORDER BY created_at DESC LIMIT $2`,
          [signalType, limit]
        )
        return yield* decodeRows(GeniferSignalModel)(rows)
      })

    return {
      emit,
      findByTarget,
      findByType,
    } satisfies GeniferSignalRepository
  })
)
