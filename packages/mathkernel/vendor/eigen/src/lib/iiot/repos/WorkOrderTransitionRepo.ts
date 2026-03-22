/**
 * WorkOrderTransitionRepo - Repository for Work Order State Transitions
 *
 * Provides INSERT-only operations for FDA 21 CFR Part 11 compliant audit trail.
 * No UPDATE or DELETE operations - transitions are immutable once recorded.
 *
 * Query patterns:
 * - getByWorkOrderId: Full history for a work order
 * - getLatest: Most recent transition (current state context)
 * - getAuditTrail: Time-range queries for compliance reporting
 * - count: Transition count for a work order
 *
 * @module
 */

import { Schema, Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { WorkOrderId } from '../schemas/identifiers'
import { WorkOrderTransitionModel } from '../models/work-orders/WorkOrderTransitionModel'
import { decodeOptional, decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type WorkOrderTransitionRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface WorkOrderTransitionRepository {
  /**
   * Insert a new state transition record.
   * This is the only write operation - transitions are immutable.
   */
  readonly insert: (
    transition: typeof WorkOrderTransitionModel.insert.Type
  ) => Effect.Effect<WorkOrderTransitionModel, WorkOrderTransitionRepoError>

  /**
   * Get all transitions for a work order, ordered chronologically (oldest first).
   * Returns empty array if work order has no transitions.
   */
  readonly getByWorkOrderId: (
    workOrderId: WorkOrderId
  ) => Effect.Effect<readonly WorkOrderTransitionModel[], WorkOrderTransitionRepoError>

  /**
   * Get the most recent transition for a work order.
   * Returns None if work order has no transitions.
   */
  readonly getLatest: (
    workOrderId: WorkOrderId
  ) => Effect.Effect<Option.Option<WorkOrderTransitionModel>, WorkOrderTransitionRepoError>

  /**
   * Count transitions for a work order.
   */
  readonly count: (
    workOrderId: WorkOrderId
  ) => Effect.Effect<number, SqlError.SqlError>

  /**
   * Get transitions in a date range for FDA compliance audit trail.
   * Used for regulatory reporting.
   */
  readonly getAuditTrail: (params: {
    workOrderId?: WorkOrderId
    startDate: Date
    endDate: Date
    userId?: string
  }) => Effect.Effect<readonly WorkOrderTransitionModel[], WorkOrderTransitionRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class WorkOrderTransitionRepo extends Context.Tag('iiot/WorkOrderTransitionRepo')<
  WorkOrderTransitionRepo,
  WorkOrderTransitionRepository
>() {}

// =============================================================================
// Column Mapping Helper
// =============================================================================

const SELECT_COLUMNS = `
  id,
  work_order_id AS "workOrderId",
  from_state AS "fromState",
  to_state AS "toState",
  transitioned_at AS "transitionedAt",
  transitioned_by AS "transitionedBy",
  reason
`

// =============================================================================
// Repository Implementation
// =============================================================================

export const WorkOrderTransitionRepoLive = Layer.effect(
  WorkOrderTransitionRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const insert = (transition: typeof WorkOrderTransitionModel.insert.Type) =>
      Effect.gen(function* () {
        // Convert Option fields to null/value for insert
        const transitionedBy = Option.getOrNull(transition.transitionedBy)
        const reason = Option.getOrNull(transition.reason)

        const rows = yield* sql`
          INSERT INTO iiot.work_order_transitions (
            work_order_id,
            from_state,
            to_state,
            transitioned_by,
            reason
          )
          VALUES (
            ${transition.workOrderId},
            ${transition.fromState},
            ${transition.toState},
            ${transitionedBy},
            ${reason}
          )
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(WorkOrderTransitionModel)(rows)
      })

    const getByWorkOrderId = (workOrderId: WorkOrderId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_order_transitions
          WHERE work_order_id = ${workOrderId}
          ORDER BY transitioned_at ASC
        `
        return yield* decodeRows(WorkOrderTransitionModel)(rows)
      })

    const getLatest = (workOrderId: WorkOrderId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_order_transitions
          WHERE work_order_id = ${workOrderId}
          ORDER BY transitioned_at DESC
          LIMIT 1
        `
        return yield* decodeOptional(WorkOrderTransitionModel)(rows)
      })

    const count = (workOrderId: WorkOrderId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT COUNT(*)::integer AS count
          FROM iiot.work_order_transitions
          WHERE work_order_id = ${workOrderId}
        `
        return (rows[0] as { count: number }).count
      })

    const getAuditTrail = (params: {
      workOrderId?: WorkOrderId
      startDate: Date
      endDate: Date
      userId?: string
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_order_transitions
          WHERE transitioned_at >= ${params.startDate}
            AND transitioned_at <= ${params.endDate}
            AND (${params.workOrderId ?? null}::text IS NULL OR work_order_id = ${params.workOrderId ?? null})
            AND (${params.userId ?? null}::text IS NULL OR transitioned_by = ${params.userId ?? null})
          ORDER BY transitioned_at ASC
        `
        return yield* decodeRows(WorkOrderTransitionModel)(rows)
      })

    return {
      insert,
      getByWorkOrderId,
      getLatest,
      count,
      getAuditTrail,
    } satisfies WorkOrderTransitionRepository
  })
)
