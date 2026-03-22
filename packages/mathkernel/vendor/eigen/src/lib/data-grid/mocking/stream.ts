/**
 * Data Grid Mock Stream
 *
 * Effect-based streaming mock data generator for testbed demos.
 * Uses faker.js for realistic data generation.
 * Uses Stream.asyncPush for proper resource management.
 */

import { faker } from '@faker-js/faker'
import { Effect, Stream, Schema, Scope } from 'effect'
import type { Emit } from 'effect/StreamEmit'

// =============================================================================
// ROW SCHEMA
// =============================================================================

export const MockRowStatus = Schema.Literal('active', 'pending', 'inactive', 'alert')
export type MockRowStatus = typeof MockRowStatus.Type

export const MockRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  value: Schema.Number,
  delta: Schema.Number,
  status: MockRowStatus,
  timestamp: Schema.DateFromSelf,
})
export type MockRow = typeof MockRow.Type

// =============================================================================
// UPDATE EVENT SCHEMA
// =============================================================================

export const RowUpdate = Schema.Struct({
  id: Schema.String,
  field: Schema.Literal('value', 'status'),
  oldValue: Schema.Union(Schema.Number, MockRowStatus),
  newValue: Schema.Union(Schema.Number, MockRowStatus),
  delta: Schema.optional(Schema.Number),
})
export type RowUpdate = typeof RowUpdate.Type

export const StreamEvent = Schema.TaggedStruct('StreamEvent', {
  rows: Schema.Array(MockRow),
  updates: Schema.Array(RowUpdate),
  tick: Schema.Number,
})
export type StreamEvent = typeof StreamEvent.Type

// =============================================================================
// STREAM CONFIG
// =============================================================================

export const StreamConfig = Schema.Struct({
  /** Number of initial rows */
  initialCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Interval between updates (ms) */
  updateIntervalMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Probability of value change per row per tick [0-1] */
  changeProbability: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
  /** Maximum delta per update */
  maxDelta: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Probability of status change per row per tick [0-1] */
  statusChangeProbability: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
})
export type StreamConfig = typeof StreamConfig.Type

export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  initialCount: 12,
  updateIntervalMs: 1000,
  changeProbability: 0.3,
  maxDelta: 15,
  statusChangeProbability: 0.05,
}

// =============================================================================
// MOCK ROW GENERATOR
// =============================================================================

const PREFIXES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL']
const SUFFIXES = ['PRIME', 'CORE', 'NODE', 'LINK', 'RELAY', 'PULSE', 'WAVE', 'FLUX']

function generateName(): string {
  const prefix = faker.helpers.arrayElement(PREFIXES)
  const suffix = faker.helpers.arrayElement(SUFFIXES)
  const num = faker.number.int({ min: 1, max: 99 }).toString().padStart(2, '0')
  return `${prefix}-${suffix}-${num}`
}

function generateStatus(): MockRowStatus {
  return faker.helpers.weightedArrayElement([
    { value: 'active', weight: 50 },
    { value: 'pending', weight: 25 },
    { value: 'inactive', weight: 20 },
    { value: 'alert', weight: 5 },
  ])
}

export function generateMockRow(id?: string): MockRow {
  return {
    id: id ?? faker.string.nanoid(8),
    name: generateName(),
    value: faker.number.int({ min: 0, max: 100 }),
    delta: 0,
    status: generateStatus(),
    timestamp: new Date(),
  }
}

export function generateMockRows(count: number): readonly MockRow[] {
  return Array.from({ length: count }, (_, i) =>
    generateMockRow(String(i + 1).padStart(3, '0'))
  )
}

// =============================================================================
// STREAM UPDATE LOGIC
// =============================================================================

/**
 * Apply random updates to rows based on config.
 * Pure function — returns updated rows and list of changes.
 */
export function applyRandomUpdates(
  rows: readonly MockRow[],
  config: StreamConfig
): { rows: readonly MockRow[]; updates: readonly RowUpdate[] } {
  const updates: RowUpdate[] = []

  const newRows = rows.map((row) => {
    let updated = { ...row, timestamp: new Date() }

    // Value change
    if (Math.random() < config.changeProbability) {
      const delta = faker.number.int({ min: -config.maxDelta, max: config.maxDelta })
      const oldValue = row.value
      const newValue = Math.max(0, Math.min(100, oldValue + delta))

      if (newValue !== oldValue) {
        updates.push({
          id: row.id,
          field: 'value',
          oldValue,
          newValue,
          delta: newValue - oldValue,
        })
        updated = { ...updated, value: newValue, delta: newValue - oldValue }
      }
    }

    // Status change
    if (Math.random() < config.statusChangeProbability) {
      const oldStatus = row.status
      const newStatus = generateStatus()

      if (newStatus !== oldStatus) {
        updates.push({
          id: row.id,
          field: 'status',
          oldValue: oldStatus,
          newValue: newStatus,
        })
        updated = { ...updated, status: newStatus }
      }
    }

    return updated
  })

  return { rows: newRows, updates }
}

// =============================================================================
// EFFECT STREAM
// =============================================================================

/**
 * Create a streaming mock data source using Effect Stream.
 *
 * Uses Stream.asyncPush with acquireRelease for proper resource management.
 * The interval is cleaned up when the stream is finalized.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from 'effect'
 * import { createMockDataStream } from '@/lib/data-grid/mocking'
 *
 * const program = Effect.gen(function*() {
 *   const stream = createMockDataStream({ initialCount: 10, updateIntervalMs: 500 })
 *
 *   yield* Stream.runForEach(stream, (event) =>
 *     Effect.log(`Tick ${event.tick}: ${event.updates.length} updates`)
 *   )
 * })
 * ```
 */
export function createMockDataStream(
  config: Partial<StreamConfig> = {}
): Stream.Stream<StreamEvent, never, never> {
  const fullConfig: StreamConfig = { ...DEFAULT_STREAM_CONFIG, ...config }

  return Stream.asyncPush<StreamEvent>(
    (emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let rows = generateMockRows(fullConfig.initialCount)
          let tick = 0

          // Emit initial state
          emit.single({
            _tag: 'StreamEvent',
            rows: [...rows],
            updates: [],
            tick,
          })

          // Start interval for updates
          const handle = setInterval(() => {
            tick++
            const result = applyRandomUpdates(rows, fullConfig)
            rows = result.rows

            emit.single({
              _tag: 'StreamEvent',
              rows: [...rows],
              updates: [...result.updates],
              tick,
            })
          }, fullConfig.updateIntervalMs)

          return handle
        }),
        (handle) =>
          Effect.sync(() => {
            clearInterval(handle)
          })
      ),
    { bufferSize: 16, strategy: 'dropping' }
  )
}

// =============================================================================
// FINITE STREAM (for testing)
// =============================================================================

/**
 * Create a finite stream that emits a specific number of events.
 * Useful for testing without infinite streams.
 */
export function createFiniteMockStream(
  config: Partial<StreamConfig> & { maxTicks: number }
): Stream.Stream<StreamEvent, never, never> {
  const { maxTicks, ...streamConfig } = config
  const fullConfig: StreamConfig = { ...DEFAULT_STREAM_CONFIG, ...streamConfig }

  return Stream.asyncPush<StreamEvent>(
    (emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let rows = generateMockRows(fullConfig.initialCount)
          let tick = 0

          // Emit initial state
          emit.single({
            _tag: 'StreamEvent',
            rows: [...rows],
            updates: [],
            tick,
          })

          const handle = setInterval(() => {
            tick++

            if (tick > maxTicks) {
              emit.end()
              return
            }

            const result = applyRandomUpdates(rows, fullConfig)
            rows = result.rows

            emit.single({
              _tag: 'StreamEvent',
              rows: [...rows],
              updates: [...result.updates],
              tick,
            })
          }, fullConfig.updateIntervalMs)

          return handle
        }),
        (handle) =>
          Effect.sync(() => {
            clearInterval(handle)
          })
      ),
    { bufferSize: 16, strategy: 'dropping' }
  )
}

// =============================================================================
// STREAM OPERATORS
// =============================================================================

/**
 * Filter stream events to only those with updates.
 */
export const filterUpdatesOnly: <E, R>(
  stream: Stream.Stream<StreamEvent, E, R>
) => Stream.Stream<StreamEvent, E, R> = Stream.filter(
  (event) => event.updates.length > 0
)

/**
 * Map stream events to just the rows (for simpler consumption).
 */
export const mapToRows: <E, R>(
  stream: Stream.Stream<StreamEvent, E, R>
) => Stream.Stream<readonly MockRow[], E, R> = Stream.map((event) => event.rows)

/**
 * Throttle stream to a maximum rate.
 */
export function throttleStream(
  minIntervalMs: number
): <E, R>(stream: Stream.Stream<StreamEvent, E, R>) => Stream.Stream<StreamEvent, E, R> {
  return Stream.throttle({
    cost: () => 1,
    duration: `${minIntervalMs} millis`,
    units: 1,
  })
}
