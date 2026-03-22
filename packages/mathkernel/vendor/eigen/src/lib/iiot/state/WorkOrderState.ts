/**
 * WorkOrderState Service
 *
 * Effect.Service for work order state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import type { WorkOrderId, WorkflowDefinitionId } from '../schemas/identifiers'
import { WorkOrder, WorkOrderType, WorkOrderPriority } from '../schemas/work-orders'
import {
  WorkOrderStateShape,
  WorkOrderFilter,
  WorkOrderStateNotFoundError,
  CreateWorkOrderInput,
} from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let workOrderCounter = 0

/** Generate a unique work order ID for in-memory testing */
const generateWorkOrderId = (): WorkOrderId =>
  `WO-${Date.now()}-${++workOrderCounter}` as WorkOrderId

// =============================================================================
// Service Definition
// =============================================================================

/**
 * WorkOrderState Service Tag
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* WorkOrderState
 *   const wo = yield* state.get(workOrderId)
 * })
 * ```
 */
export class WorkOrderState extends Context.Tag('iiot/WorkOrderState')<
  WorkOrderState,
  WorkOrderStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory work order state implementation for testing.
 */
export const WorkOrderStateInMemory: Layer.Layer<WorkOrderState> = Layer.effect(
  WorkOrderState,
  Ref.make(new Map<WorkOrderId, WorkOrder>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (wo: WorkOrder, filter: WorkOrderFilter): boolean => {
        if (filter.status && filter.status.length > 0) {
          if (!filter.status.includes(wo.status)) return false
        }
        if (filter.type && filter.type.length > 0) {
          if (!filter.type.includes(wo.type)) return false
        }
        if (filter.priority && filter.priority.length > 0) {
          if (!filter.priority.includes(wo.priority)) return false
        }
        if (filter.assignedTo) {
          const assigned = Option.getOrNull(wo.assignedTo)
          if (assigned !== filter.assignedTo) return false
        }
        if (filter.primaryAssetId) {
          const asset = Option.getOrNull(wo.primaryAssetId)
          if (asset !== filter.primaryAssetId) return false
        }
        if (filter.since) {
          const sinceMs = filter.since.getTime()
          const woMs = Number(wo.createdAt.epochMillis)
          if (woMs < sinceMs) return false
        }
        if (filter.until) {
          const untilMs = filter.until.getTime()
          const woMs = Number(wo.createdAt.epochMillis)
          if (woMs > untilMs) return false
        }
        if (filter.includeOverdue && !wo.isOverdue()) return false
        return true
      }

      return {
        create: (input: CreateWorkOrderInput) =>
          Effect.gen(function* () {
            const id = generateWorkOrderId()
            const now = yield* DateTime.now
            const workOrder = new WorkOrder({
              id,
              workflowDefinitionId: input.workflowDefinitionId as WorkflowDefinitionId,
              workflowVersion: input.workflowVersion,
              title: input.title,
              description: input.description,
              type: input.type as typeof WorkOrderType.Type,
              priority: input.priority as typeof WorkOrderPriority.Type,
              status: 'created',
              createdBy: input.createdBy,
              createdAt: now,
              scheduledStart: Option.map(input.scheduledStart, DateTime.unsafeFromDate),
              dueDate: Option.map(input.dueDate, DateTime.unsafeFromDate),
              parentWorkOrderId: input.parentWorkOrderId as Option.Option<import('../schemas/identifiers').WorkOrderId>,
              primaryAssetId: input.primaryAssetId as Option.Option<import('../schemas/identifiers').AssetId>,
              assignedTo: input.assignedTo,
              actualStart: Option.none(),
              actualEnd: Option.none(),
              outcome: Option.none(),
              summary: Option.none(),
              failedTaskId: Option.none(),
              failureReason: Option.none(),
              suspensionReason: Option.none(),
              expectedResume: Option.none(),
              cancellationReason: Option.none(),
              finalStatus: Option.none(),
              metadata: input.metadata ?? {},
            })
            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, workOrder)
              return newMap
            })
            return workOrder
          }),

        get: (id: WorkOrderId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const wo = map.get(id)
              if (!wo) {
                return Effect.fail(new WorkOrderStateNotFoundError(id))
              }
              return Effect.succeed(wo)
            })
          ),

        set: (workOrder: WorkOrder) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(workOrder.id, workOrder)
            return newMap
          }),

        list: (filter: WorkOrderFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let orders = Array.from(map.values()).filter((wo) =>
                matchesFilter(wo, filter)
              )

              // Sort by createdAt descending
              orders.sort((a, b) =>
                Number(b.createdAt.epochMillis) - Number(a.createdAt.epochMillis)
              )

              // Apply pagination
              if (filter.offset) {
                orders = orders.slice(filter.offset)
              }
              if (filter.limit) {
                orders = orders.slice(0, filter.limit)
              }

              return orders
            })
          ),

        delete: (id: WorkOrderId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: WorkOrderId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: WorkOrderFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((wo) => matchesFilter(wo, filter)).length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Factory
// =============================================================================

/**
 * Factory to create SQL-backed work order state from a repository.
 *
 * Bridges the state interface to the repository pattern.
 */
export const makeWorkOrderStateSql = (repo: {
  findById: (id: WorkOrderId) => Effect.Effect<Option.Option<WorkOrder>, unknown>
  findAll: (filter: WorkOrderFilter) => Effect.Effect<readonly WorkOrder[], unknown>
  insert: (wo: WorkOrder) => Effect.Effect<WorkOrder, unknown>
  update: (wo: Partial<WorkOrder> & { id: WorkOrderId }) => Effect.Effect<WorkOrder, unknown>
  delete: (id: WorkOrderId) => Effect.Effect<boolean, unknown>
  /** Insert with DB-generated ID. If not provided, falls back to insert() */
  insertWithGeneratedId?: (input: CreateWorkOrderInput) => Effect.Effect<WorkOrder, unknown>
}): WorkOrderStateShape => ({
  create: (input: CreateWorkOrderInput) =>
    repo.insertWithGeneratedId
      ? repo.insertWithGeneratedId(input).pipe(Effect.orDie)
      : Effect.gen(function* () {
          // Fallback: generate ID client-side if repo doesn't support generated IDs
          const id = generateWorkOrderId()
          const now = yield* DateTime.now
          const workOrder = new WorkOrder({
            id,
            workflowDefinitionId: input.workflowDefinitionId as WorkflowDefinitionId,
            workflowVersion: input.workflowVersion,
            title: input.title,
            description: input.description,
            type: input.type as typeof WorkOrderType.Type,
            priority: input.priority as typeof WorkOrderPriority.Type,
            status: 'created',
            createdBy: input.createdBy,
            createdAt: now,
            scheduledStart: Option.map(input.scheduledStart, DateTime.unsafeFromDate),
            dueDate: Option.map(input.dueDate, DateTime.unsafeFromDate),
            parentWorkOrderId: input.parentWorkOrderId as Option.Option<import('../schemas/identifiers').WorkOrderId>,
            primaryAssetId: input.primaryAssetId as Option.Option<import('../schemas/identifiers').AssetId>,
            assignedTo: input.assignedTo,
            actualStart: Option.none(),
            actualEnd: Option.none(),
            outcome: Option.none(),
            summary: Option.none(),
            failedTaskId: Option.none(),
            failureReason: Option.none(),
            suspensionReason: Option.none(),
            expectedResume: Option.none(),
            cancellationReason: Option.none(),
            finalStatus: Option.none(),
            metadata: input.metadata ?? {},
          })
          return yield* repo.insert(workOrder).pipe(Effect.orDie)
        }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new WorkOrderStateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new WorkOrderStateNotFoundError(id)))
    ),

  set: (workOrder) =>
    repo.findById(workOrder.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(workOrder as Partial<WorkOrder> & { id: WorkOrderId })
          : repo.insert(workOrder)
      ),
      Effect.asVoid,
      Effect.catchAll(() => Effect.void)
    ),

  list: (filter) =>
    repo.findAll(filter).pipe(
      Effect.catchAll(() => Effect.succeed([]))
    ),

  delete: (id) =>
    repo.delete(id).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    ),

  exists: (id) =>
    repo.findById(id).pipe(
      Effect.map(Option.isSome),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  count: (filter) =>
    repo.findAll({ ...filter, limit: undefined, offset: undefined }).pipe(
      Effect.map((orders) => orders.length),
      Effect.catchAll(() => Effect.succeed(0))
    ),
})
