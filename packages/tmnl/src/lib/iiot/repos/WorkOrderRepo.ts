/**
 * WorkOrderRepo - Repository for WorkOrder Entity
 *
 * Separated from WorkOrderModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * ISA-95 Level 3 work order lifecycle management.
 *
 * @module
 */

import { Schema, Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import {
  WorkOrderId,
  AssetId,
} from '../schemas/identifiers'
import {
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../schemas/work-orders'
import { WorkOrderModel } from '../models/work-orders/WorkOrderModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type WorkOrderRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface WorkOrderRepository {
  readonly findById: (id: WorkOrderId) => Effect.Effect<Option.Option<WorkOrderModel>, WorkOrderRepoError>
  readonly findByStatus: (status: Schema.Schema.Type<typeof WorkOrderStatus>) => Effect.Effect<readonly WorkOrderModel[], WorkOrderRepoError>
  readonly findByAsset: (assetId: AssetId) => Effect.Effect<readonly WorkOrderModel[], WorkOrderRepoError>
  readonly findOpen: () => Effect.Effect<readonly WorkOrderModel[], WorkOrderRepoError>
  readonly findAll: () => Effect.Effect<readonly WorkOrderModel[], WorkOrderRepoError>
  readonly query: (params: {
    status?: Schema.Schema.Type<typeof WorkOrderStatus>
    type?: Schema.Schema.Type<typeof WorkOrderType>
    priority?: Schema.Schema.Type<typeof WorkOrderPriority>
    assignedTo?: string
    primaryAssetId?: AssetId
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly WorkOrderModel[], WorkOrderRepoError>
  readonly insert: (workOrder: typeof WorkOrderModel.insert.Type) => Effect.Effect<WorkOrderModel, WorkOrderRepoError>
  readonly update: (workOrder: Partial<typeof WorkOrderModel.update.Type> & { id: typeof WorkOrderModel.update.Type['id'] }) => Effect.Effect<WorkOrderModel, WorkOrderRepoError>
  readonly start: (id: WorkOrderId) => Effect.Effect<WorkOrderModel, WorkOrderRepoError>
  readonly complete: (id: WorkOrderId, summary: string) => Effect.Effect<WorkOrderModel, WorkOrderRepoError>
  readonly cancel: (id: WorkOrderId, reason: string) => Effect.Effect<WorkOrderModel, WorkOrderRepoError>
  readonly delete: (id: WorkOrderId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class WorkOrderRepo extends Context.Tag('iiot/WorkOrderRepo')<
  WorkOrderRepo,
  WorkOrderRepository
>() {}

// =============================================================================
// Column Mapping Helper
// =============================================================================

const SELECT_COLUMNS = `
  id,
  workflow_definition_id AS "workflowDefinitionId",
  workflow_version AS "workflowVersion",
  title,
  description,
  type,
  priority,
  status,
  created_by AS "createdBy",
  created_at AS "createdAt",
  scheduled_start AS "scheduledStart",
  due_date AS "dueDate",
  actual_start AS "actualStart",
  actual_end AS "actualEnd",
  expected_resume AS "expectedResume",
  parent_work_order_id AS "parentWorkOrderId",
  primary_asset_id AS "primaryAssetId",
  failed_task_id AS "failedTaskId",
  assigned_to AS "assignedTo",
  summary,
  failure_reason AS "failureReason",
  cancellation_reason AS "cancellationReason",
  outcome,
  suspension_reason AS "suspensionReason",
  final_status AS "finalStatus",
  compensation_required AS "compensationRequired",
  metadata
`

// =============================================================================
// Repository Implementation
// =============================================================================

export const WorkOrderRepoLive = Layer.effect(
  WorkOrderRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: WorkOrderId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(WorkOrderModel)(rows)
      })

    const findByStatus = (status: Schema.Schema.Type<typeof WorkOrderStatus>) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          WHERE status = ${status}
          ORDER BY created_at DESC
        `
        return yield* decodeRows(WorkOrderModel)(rows)
      })

    const findByAsset = (assetId: AssetId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          WHERE primary_asset_id = ${assetId}
          ORDER BY created_at DESC
        `
        return yield* decodeRows(WorkOrderModel)(rows)
      })

    const findOpen = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          WHERE status NOT IN ('closed', 'rejected', 'cancelled')
          ORDER BY
            CASE priority
              WHEN 'emergency' THEN 1
              WHEN 'urgent' THEN 2
              WHEN 'high' THEN 3
              WHEN 'normal' THEN 4
              WHEN 'low' THEN 5
            END,
            created_at ASC
        `
        return yield* decodeRows(WorkOrderModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          ORDER BY created_at DESC
        `
        return yield* decodeRows(WorkOrderModel)(rows)
      })

    const query = (params: {
      status?: Schema.Schema.Type<typeof WorkOrderStatus>
      type?: Schema.Schema.Type<typeof WorkOrderType>
      priority?: Schema.Schema.Type<typeof WorkOrderPriority>
      assignedTo?: string
      primaryAssetId?: AssetId
      since?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.work_orders
          WHERE 1=1
            AND (${params.status ?? null}::text IS NULL OR status = ${params.status ?? null})
            AND (${params.type ?? null}::text IS NULL OR type = ${params.type ?? null})
            AND (${params.priority ?? null}::text IS NULL OR priority = ${params.priority ?? null})
            AND (${params.assignedTo ?? null}::text IS NULL OR assigned_to = ${params.assignedTo ?? null})
            AND (${params.primaryAssetId ?? null}::text IS NULL OR primary_asset_id = ${params.primaryAssetId ?? null})
            AND (${params.since ?? null}::timestamp IS NULL OR created_at >= ${params.since ?? null})
          ORDER BY created_at DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(WorkOrderModel)(rows)
      })

    const insert = (workOrder: typeof WorkOrderModel.insert.Type) =>
      Effect.gen(function* () {
        // Convert Option fields to null/value for insert
        const scheduledStart = Option.getOrNull(workOrder.scheduledStart)
        const dueDate = Option.getOrNull(workOrder.dueDate)
        const parentWorkOrderId = Option.getOrNull(workOrder.parentWorkOrderId)
        const primaryAssetId = Option.getOrNull(workOrder.primaryAssetId)
        const assignedTo = Option.getOrNull(workOrder.assignedTo)
        const metadata = Option.getOrNull(workOrder.metadata)

        const rows = yield* sql`
          INSERT INTO iiot.work_orders (
            workflow_definition_id, workflow_version, title, description,
            type, priority, status, created_by,
            scheduled_start, due_date, parent_work_order_id,
            primary_asset_id, assigned_to, metadata
          )
          VALUES (
            ${workOrder.workflowDefinitionId},
            ${workOrder.workflowVersion},
            ${workOrder.title},
            ${workOrder.description},
            ${workOrder.type},
            ${workOrder.priority},
            ${workOrder.status},
            ${workOrder.createdBy},
            ${scheduledStart},
            ${dueDate},
            ${parentWorkOrderId},
            ${primaryAssetId},
            ${assignedTo},
            ${metadata}
          )
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(WorkOrderModel)(rows)
      })

    const update = (workOrder: Partial<typeof WorkOrderModel.update.Type> & { id: typeof WorkOrderModel.update.Type['id'] }) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(workOrder)

        const rows = yield* sql`
          UPDATE iiot.work_orders
          SET ${sql.update(changes, ['id'])}
          WHERE id = ${workOrder.id}
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(WorkOrderModel)(rows)
      })

    const start = (id: WorkOrderId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.work_orders
          SET
            status = 'started',
            actual_start = NOW()
          WHERE id = ${id}
            AND status IN ('created', 'submitted', 'approved')
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        if (rows.length > 0) {
          return yield* decodeFirst(WorkOrderModel)(rows)
        }
        // Idempotent: already started - return existing
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `WorkOrder not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const complete = (id: WorkOrderId, summary: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.work_orders
          SET
            status = 'completed',
            actual_end = NOW(),
            summary = ${summary},
            outcome = 'success'
          WHERE id = ${id}
            AND status IN ('started', 'resumed')
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        if (rows.length > 0) {
          return yield* decodeFirst(WorkOrderModel)(rows)
        }
        // Idempotent: already completed - return existing
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `WorkOrder not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const cancel = (id: WorkOrderId, reason: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.work_orders
          SET
            status = 'cancelled',
            actual_end = NOW(),
            cancellation_reason = ${reason},
            final_status = CASE
              WHEN actual_start IS NULL THEN 'cancelled_before_start'
              ELSE 'cancelled_during_execution'
            END
          WHERE id = ${id}
            AND status NOT IN ('completed', 'failed', 'cancelled', 'closed')
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        if (rows.length > 0) {
          return yield* decodeFirst(WorkOrderModel)(rows)
        }
        // Idempotent: already cancelled - return existing
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `WorkOrder not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const del = (id: WorkOrderId) =>
      sql`DELETE FROM iiot.work_orders WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByStatus,
      findByAsset,
      findOpen,
      findAll,
      query,
      insert,
      update,
      start,
      complete,
      cancel,
      delete: del,
    } satisfies WorkOrderRepository
  })
)
