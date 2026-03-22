/**
 * AlarmState Service
 *
 * Effect.Service for alarm state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import type { AlarmId } from '../schemas/identifiers'
import { Alarm, AlarmState as AlarmStateEnum, CreateAlarmParams } from '../schemas/alarms'
import {
  AlarmStateShape,
  AlarmFilter,
  AlarmStateNotFoundError,
} from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let alarmCounter = 0

/** Generate a unique alarm ID for in-memory testing */
const generateAlarmId = (): AlarmId =>
  `ALM-${Date.now()}-${++alarmCounter}` as AlarmId

// =============================================================================
// Service Definition
// =============================================================================

/**
 * AlarmState Service Tag
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* AlarmState
 *   const alarm = yield* state.get(alarmId)
 * })
 * ```
 */
export class AlarmState extends Context.Tag('iiot/AlarmState')<
  AlarmState,
  AlarmStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory alarm state implementation for testing.
 *
 * Uses a Map for O(1) lookup. Not suitable for production due to:
 * - No persistence
 * - No cross-process sharing
 * - Memory limits
 */
export const AlarmStateInMemory: Layer.Layer<AlarmState> = Layer.effect(
  AlarmState,
  Ref.make(new Map<AlarmId, Alarm>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (alarm: Alarm, filter: AlarmFilter): boolean => {
        if (filter.deviceId && alarm.deviceId !== filter.deviceId) return false
        if (filter.severity && alarm.severity !== filter.severity) return false
        if (filter.state && alarm.state !== filter.state) return false
        if (filter.onlyActive && !alarm.isActive()) return false
        if (filter.onlyRequiresAttention && !alarm.requiresAttention()) return false
        if (filter.since) {
          const sinceMs = filter.since.getTime()
          const alarmMs = Number(alarm.triggeredAt.epochMillis)
          if (alarmMs < sinceMs) return false
        }
        if (filter.until) {
          const untilMs = filter.until.getTime()
          const alarmMs = Number(alarm.triggeredAt.epochMillis)
          if (alarmMs > untilMs) return false
        }
        return true
      }

      return {
        create: (params: CreateAlarmParams) =>
          Effect.gen(function* () {
            const id = generateAlarmId()
            const now = yield* DateTime.now
            const alarm = new Alarm({
              id,
              deviceId: params.deviceId,
              assetId: params.assetId,
              alarmType: params.alarmType,
              severity: params.severity,
              state: 'unacknowledged' as AlarmStateEnum,
              message: params.message,
              triggeredAt: now,
              metadata: params.metadata,
            })
            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, alarm)
              return newMap
            })
            return alarm
          }),

        get: (id: AlarmId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const alarm = map.get(id)
              if (!alarm) {
                return Effect.fail(new AlarmStateNotFoundError(id))
              }
              return Effect.succeed(alarm)
            })
          ),

        set: (alarm: Alarm) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(alarm.id, alarm)
            return newMap
          }),

        list: (filter: AlarmFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let alarms = Array.from(map.values()).filter((a) =>
                matchesFilter(a, filter)
              )

              // Sort by triggeredAt descending
              alarms.sort((a, b) =>
                Number(b.triggeredAt.epochMillis) - Number(a.triggeredAt.epochMillis)
              )

              // Apply pagination
              if (filter.offset) {
                alarms = alarms.slice(filter.offset)
              }
              if (filter.limit) {
                alarms = alarms.slice(0, filter.limit)
              }

              return alarms
            })
          ),

        delete: (id: AlarmId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: AlarmId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: AlarmFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((a) => matchesFilter(a, filter)).length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Implementation
// =============================================================================

/**
 * SQL-backed alarm state implementation for production.
 *
 * Uses the existing AlarmRepo for actual SQL operations.
 * This layer bridges the state interface to the repository pattern.
 *
 * For the full SQL implementation, see AlarmRepo.
 */
export const makeAlarmStateSql = (repo: {
  findById: (id: AlarmId) => Effect.Effect<Option.Option<Alarm>, unknown>
  findAll: (filter: AlarmFilter) => Effect.Effect<readonly Alarm[], unknown>
  insert: (alarm: Alarm) => Effect.Effect<Alarm, unknown>
  update: (alarm: Partial<Alarm> & { id: AlarmId }) => Effect.Effect<Alarm, unknown>
  delete: (id: AlarmId) => Effect.Effect<boolean, unknown>
  /** Insert with DB-generated ID. If not provided, falls back to insert() */
  insertWithGeneratedId?: (params: CreateAlarmParams) => Effect.Effect<Alarm, unknown>
}): AlarmStateShape => ({
  create: (params: CreateAlarmParams) =>
    repo.insertWithGeneratedId
      ? repo.insertWithGeneratedId(params).pipe(
          Effect.orDie // SQL failures are defects
        )
      : Effect.gen(function* () {
          // Fallback: generate ID client-side if repo doesn't support generated IDs
          const id = generateAlarmId()
          const now = yield* DateTime.now
          const alarm = new Alarm({
            id,
            deviceId: params.deviceId,
            assetId: params.assetId,
            alarmType: params.alarmType,
            severity: params.severity,
            state: 'unacknowledged' as AlarmStateEnum,
            message: params.message,
            triggeredAt: now,
            metadata: params.metadata,
          })
          return yield* repo.insert(alarm).pipe(Effect.orDie)
        }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new AlarmStateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new AlarmStateNotFoundError(id)))
    ),

  set: (alarm) =>
    repo.findById(alarm.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(alarm as Partial<Alarm> & { id: AlarmId })
          : repo.insert(alarm)
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
      Effect.map((alarms) => alarms.length),
      Effect.catchAll(() => Effect.succeed(0))
    ),
})
