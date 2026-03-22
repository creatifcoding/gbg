/**
 * DayState Service
 *
 * Effect.Service for Day state management with swappable implementations.
 * Provides InMemory (testing) and LocalStorage (v1 production) layers.
 *
 * @module @chronicle/state/DayState
 * @see src/lib/iiot/state/AlarmState.ts — canonical pattern
 */

import { Effect, Context, Layer, Option, Ref, Schema } from 'effect'
import { KeyValueStore } from '@effect/platform'
import type { DayId } from '../schemas/identifiers'
import { Day, DaySummary, DayLifecycleState } from '../schemas/day'
import type { DayStateShape, DayFilter } from './StateShape'
import { DayStateNotFoundError } from './StateShape'

// =============================================================================
// LocalStorage Constants
// =============================================================================

/** Key prefix for chronicle days in localStorage */
const LS_PREFIX = 'chronicle:day:'

/** Index key listing all stored day IDs */
const LS_INDEX_KEY = 'chronicle:day-index'

// =============================================================================
// Service Definition
// =============================================================================

/**
 * DayState Service Tag
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const state = yield* DayState
 *   const day = yield* state.getOrCreate('2026-01-15' as DayId)
 * })
 * ```
 */
export class DayState extends Context.Tag('chronicle/DayState')<
  DayState,
  DayStateShape
>() {}

// =============================================================================
// Helpers
// =============================================================================

/** Create an empty Day for a given date key */
const makeEmptyDay = (dayId: DayId): Day => {
  const now = new Date()
  return new Day({
    dateKey: dayId,
    lifecycleState: 'empty' as DayLifecycleState,
    notes: [],
    cards: [],
    events: [],
    tasks: [],
    links: [],
    mood: Option.none(),
    media: [],
    documentId: Option.none(),
    createdAt: now,
    updatedAt: now,
  })
}

/** Create a DaySummary from a Day */
const toSummary = (day: Day): DaySummary =>
  new DaySummary({
    dateKey: day.dateKey,
    lifecycleState: day.lifecycleState,
    eventCount: day.events.length,
    taskCount: day.tasks.length,
    tasksDone: day.tasks.filter((t) => t.completed).length,
    noteCount: day.notes.length,
    linkCount: day.links.length,
    hasMood: Option.isSome(day.mood),
    hasMedia: day.media.length > 0,
  })

/** Check if a day matches a filter */
const matchesFilter = (day: Day, filter: DayFilter): boolean => {
  if (filter.from && day.dateKey < filter.from) return false
  if (filter.to && day.dateKey > filter.to) return false
  if (filter.lifecycleState && day.lifecycleState !== filter.lifecycleState) return false
  if (filter.hasContent === true && day.isEmpty) return false
  if (filter.hasContent === false && !day.isEmpty) return false
  return true
}

/** DateKey for a year/month's range */
const monthRange = (year: number, month: number) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month + 1)}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`
  return { from, to }
}

// =============================================================================
// In-Memory Implementation (Testing)
// =============================================================================

/**
 * In-memory Day state implementation for testing.
 *
 * Uses a Map for O(1) lookup. Not suitable for production due to:
 * - No persistence across reloads
 * - No cross-process sharing
 * - Memory limits
 */
export const DayStateInMemory: Layer.Layer<DayState> = Layer.effect(
  DayState,
  Ref.make(new Map<DayId, Day>()).pipe(
    Effect.map((store): DayStateShape => ({
      getOrCreate: (dayId) =>
        Ref.get(store).pipe(
          Effect.map((map) => {
            const existing = map.get(dayId)
            if (existing) return existing
            return makeEmptyDay(dayId)
          }),
        ),

      get: (dayId) =>
        Ref.get(store).pipe(
          Effect.flatMap((map) => {
            const day = map.get(dayId)
            if (!day) return Effect.fail(new DayStateNotFoundError(dayId))
            return Effect.succeed(day)
          }),
        ),

      set: (day) =>
        Ref.update(store, (map) => {
          const newMap = new Map(map)
          newMap.set(day.dateKey, day)
          return newMap
        }),

      list: (filter) =>
        Ref.get(store).pipe(
          Effect.map((map) => {
            let days = Array.from(map.values()).filter((d) =>
              matchesFilter(d, filter),
            )
            // Sort by dateKey ascending
            days.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
            if (filter.offset) days = days.slice(filter.offset)
            if (filter.limit) days = days.slice(0, filter.limit)
            return days
          }),
        ),

      listSummaries: (year, month) =>
        Ref.get(store).pipe(
          Effect.map((map) => {
            const { from, to } = monthRange(year, month)
            return Array.from(map.values())
              .filter((d) => d.dateKey >= from && d.dateKey <= to)
              .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
              .map(toSummary)
          }),
        ),

      delete: (dayId) =>
        Ref.modify(store, (map) => {
          const existed = map.has(dayId)
          if (existed) {
            const newMap = new Map(map)
            newMap.delete(dayId)
            return [true, newMap] as const
          }
          return [false, map] as const
        }),

      exists: (dayId) =>
        Ref.get(store).pipe(Effect.map((map) => map.has(dayId))),

      count: (filter) =>
        Ref.get(store).pipe(
          Effect.map(
            (map) =>
              Array.from(map.values()).filter((d) => matchesFilter(d, filter))
                .length,
          ),
        ),
    })),
  ),
)

// =============================================================================
// LocalStorage Implementation (v1 Production)
// =============================================================================

/**
 * LocalStorage-backed Day state using @effect/platform KeyValueStore.
 *
 * Uses `KeyValueStore.layerStorage(() => localStorage)` for the backing store,
 * with `kv.forSchema(Day)` for automatic Schema-validated encode/decode.
 *
 * Storage layout:
 * - `chronicle:day:<dateKey>` → JSON-encoded Day
 * - `chronicle:day-index` → JSON array of stored day IDs
 *
 * @example
 * ```typescript
 * // In production layer composition
 * const ProductionLayer = Layer.mergeAll(
 *   DayStateLocalStorage,
 *   ChronicleService.Default,
 * )
 * ```
 */
export const DayStateLocalStorage: Layer.Layer<DayState> = Layer.effect(
  DayState,
  Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore
    const schemaStore = kv.forSchema(Schema.parseJson(Day))

    // ── Index management ──────────────────────────────────────────────────

    const getIndex = (): Effect.Effect<readonly string[]> =>
      kv.get(LS_INDEX_KEY).pipe(
        Effect.map((opt) =>
          Option.isSome(opt)
            ? (JSON.parse(opt.value) as string[])
            : [],
        ),
        Effect.catchAll(() => Effect.succeed([] as string[])),
      )

    const addToIndex = (dayId: DayId) =>
      getIndex().pipe(
        Effect.flatMap((ids) => {
          if (ids.includes(dayId)) return Effect.void
          return kv.set(LS_INDEX_KEY, JSON.stringify([...ids, dayId]))
        }),
      )

    const removeFromIndex = (dayId: DayId) =>
      getIndex().pipe(
        Effect.flatMap((ids) =>
          kv.set(
            LS_INDEX_KEY,
            JSON.stringify(ids.filter((id) => id !== dayId)),
          ),
        ),
      )

    // ── Load all days from storage ────────────────────────────────────────

    const loadAll = (): Effect.Effect<readonly Day[]> =>
      getIndex().pipe(
        Effect.flatMap((ids) =>
          Effect.all(
            ids.map((id) =>
              schemaStore.get(`${LS_PREFIX}${id}`).pipe(
                Effect.map((opt) => (Option.isSome(opt) ? [opt.value] : [])),
                Effect.catchAll(() => Effect.succeed([] as Day[])),
              ),
            ),
          ),
        ),
        Effect.map((arrays) => arrays.flat()),
      )

    // ── Build the shape ───────────────────────────────────────────────────

    const shape: DayStateShape = {
      getOrCreate: (dayId) =>
        schemaStore.get(`${LS_PREFIX}${dayId}`).pipe(
          Effect.map((opt) =>
            Option.isSome(opt) ? opt.value : makeEmptyDay(dayId),
          ),
          Effect.catchAll(() => Effect.succeed(makeEmptyDay(dayId))),
        ),

      get: (dayId) =>
        schemaStore.get(`${LS_PREFIX}${dayId}`).pipe(
          Effect.flatMap((opt) =>
            Option.isSome(opt)
              ? Effect.succeed(opt.value)
              : Effect.fail(new DayStateNotFoundError(dayId)),
          ),
          Effect.catchAll(() => Effect.fail(new DayStateNotFoundError(dayId))),
        ),

      set: (day) =>
        schemaStore.set(`${LS_PREFIX}${day.dateKey}`, day).pipe(
          Effect.tap(() => addToIndex(day.dateKey)),
        ),

      list: (filter) =>
        loadAll().pipe(
          Effect.map((days) => {
            let filtered = days.filter((d) => matchesFilter(d, filter))
            filtered.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
            if (filter.offset) filtered = filtered.slice(filter.offset)
            if (filter.limit) filtered = filtered.slice(0, filter.limit)
            return filtered
          }),
        ),

      listSummaries: (year, month) =>
        loadAll().pipe(
          Effect.map((days) => {
            const { from, to } = monthRange(year, month)
            return days
              .filter((d) => d.dateKey >= from && d.dateKey <= to)
              .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
              .map(toSummary)
          }),
        ),

      delete: (dayId) =>
        schemaStore.get(`${LS_PREFIX}${dayId}`).pipe(
          Effect.flatMap((opt) => {
            if (Option.isNone(opt)) return Effect.succeed(false)
            return kv.remove(`${LS_PREFIX}${dayId}`).pipe(
              Effect.tap(() => removeFromIndex(dayId)),
              Effect.map(() => true),
            )
          }),
          Effect.catchAll(() => Effect.succeed(false)),
        ),

      exists: (dayId) =>
        kv.has(`${LS_PREFIX}${dayId}`).pipe(
          Effect.catchAll(() => Effect.succeed(false)),
        ),

      count: (filter) =>
        loadAll().pipe(
          Effect.map(
            (days) =>
              days.filter((d) => matchesFilter(d, filter)).length,
          ),
        ),
    }

    return shape
  }).pipe(
    Effect.provide(KeyValueStore.layerStorage(() => localStorage)),
  ),
)
