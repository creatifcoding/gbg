/**
 * TaskState Service
 *
 * Context.Tag service for Task state management.
 * In-memory impl for testing, SQL adapter for production.
 *
 * @module sios/state/TaskState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Task, CreateTaskParams, type TaskStatus, type TaskPriority } from '../schemas/task'
import type { TaskId, WorkPackageId, WorkerId } from '../schemas/identifiers'

// =============================================================================
// ID Generation
// =============================================================================

let taskCounter = 0
const generateTaskId = (): TaskId =>
  `TSK-${Date.now().toString(36)}-${++taskCounter}` as TaskId

// =============================================================================
// Filter Types
// =============================================================================

export interface TaskFilter {
  readonly workPackageId?: WorkPackageId
  readonly status?: TaskStatus
  readonly priority?: TaskPriority
  readonly assignedTo?: WorkerId
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Errors
// =============================================================================

export class TaskStateNotFoundError {
  readonly _tag = 'TaskStateNotFoundError'
  constructor(readonly taskId: TaskId) {}
}

// =============================================================================
// Service Shape
// =============================================================================

export interface TaskStateShape {
  readonly create: (params: CreateTaskParams) => Effect.Effect<Task>
  readonly get: (id: TaskId) => Effect.Effect<Task, TaskStateNotFoundError>
  readonly set: (task: Task) => Effect.Effect<void>
  readonly list: (filter: TaskFilter) => Effect.Effect<readonly Task[]>
  readonly delete: (id: TaskId) => Effect.Effect<boolean>
  readonly exists: (id: TaskId) => Effect.Effect<boolean>
  readonly count: (filter: TaskFilter) => Effect.Effect<number>
  /** List all tasks for a work package, ordered by sortOrder */
  readonly listByWorkPackage: (wpId: WorkPackageId) => Effect.Effect<readonly Task[]>
}

// =============================================================================
// Service Tag
// =============================================================================

export class TaskState extends Context.Tag('sios/TaskState')<
  TaskState,
  TaskStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

export const TaskStateInMemory: Layer.Layer<TaskState> = Layer.effect(
  TaskState,
  Ref.make(new Map<TaskId, Task>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (task: Task, filter: TaskFilter): boolean => {
        if (filter.workPackageId && task.workPackageId !== filter.workPackageId) return false
        if (filter.status && task.status !== filter.status) return false
        if (filter.priority && task.priority !== filter.priority) return false
        if (filter.assignedTo && !Option.contains(task.assignedTo, filter.assignedTo)) return false
        return true
      }

      return {
        create: (params: CreateTaskParams) =>
          Effect.gen(function* () {
            const id = generateTaskId()
            const now = yield* DateTime.now

            const task = new Task({
              id,
              workPackageId: params.workPackageId,
              title: params.title,
              description: params.description
                ? Option.some(params.description)
                : Option.none(),
              status: 'pending',
              priority: params.priority ?? 'normal',
              assignedTo: params.assignedTo
                ? Option.some(params.assignedTo)
                : Option.none(),
              plannedQty: params.plannedQty ?? 0,
              actualQty: 0,
              plannedHours: params.plannedHours ?? 0,
              actualHours: 0,
              evidence: [],
              requiresEvidence: params.requiresEvidence ?? false,
              startedAt: Option.none(),
              completedAt: Option.none(),
              suspendedAt: Option.none(),
              blockedReason: Option.none(),
              blockedSince: Option.none(),
              costCode: params.costCode
                ? Option.some(params.costCode)
                : Option.none(),
              sortOrder: params.sortOrder ?? 0,
              notes: Option.none(),
              createdAt: now,
              updatedAt: Option.none(),
              metadata: {},
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, task)
              return newMap
            })

            return task
          }),

        get: (id: TaskId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const task = map.get(id)
              if (!task) return Effect.fail(new TaskStateNotFoundError(id))
              return Effect.succeed(task)
            })
          ),

        set: (task: Task) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(task.id, task)
            return newMap
          }),

        list: (filter: TaskFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let results = Array.from(map.values()).filter((t) =>
                matchesFilter(t, filter)
              )
              results.sort((a, b) => a.sortOrder - b.sortOrder)
              if (filter.offset) results = results.slice(filter.offset)
              if (filter.limit) results = results.slice(0, filter.limit)
              return results
            })
          ),

        listByWorkPackage: (wpId: WorkPackageId) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              const results = Array.from(map.values())
                .filter((t) => t.workPackageId === wpId)
                .sort((a, b) => a.sortOrder - b.sortOrder)
              return results
            })
          ),

        delete: (id: TaskId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: TaskId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: TaskFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((t) => matchesFilter(t, filter)).length
            )
          ),
      } satisfies TaskStateShape
    })
  )
)
