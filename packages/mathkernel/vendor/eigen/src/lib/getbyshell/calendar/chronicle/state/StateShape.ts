/**
 * Chronicle State Service Shape
 *
 * Contract for Day state storage. Implementations must provide
 * consistent behavior for all operations. Swappable between
 * InMemory (testing), LocalStorage (v1 prod), and SQL (future).
 *
 * @module @chronicle/state/StateShape
 * @see src/lib/iiot/state/StateShape.ts — canonical pattern
 */

import { Effect } from 'effect'
import type { DayId } from '../schemas/identifiers'
import type { Day, DaySummary, DayLifecycleState } from '../schemas/day'

// =============================================================================
// Error Types
// =============================================================================

/** Day not found in state service */
export class DayStateNotFoundError {
  readonly _tag = 'DayStateNotFoundError' as const
  constructor(readonly dayId: DayId) {}
}

// =============================================================================
// Filter Types
// =============================================================================

export interface DayFilter {
  readonly from?: string
  readonly to?: string
  readonly lifecycleState?: DayLifecycleState
  readonly hasContent?: boolean
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// State Service Shape
// =============================================================================

/**
 * DayStateShape — contract for Day persistence.
 *
 * Key difference from IIoT: `getOrCreate` always succeeds.
 * A day for any date can be materialized on demand (starts as empty).
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const state = yield* DayState
 *   const day = yield* state.getOrCreate('2026-01-15' as DayId)
 *   // Always returns — creates empty Day if not found
 * })
 * ```
 */
export interface DayStateShape {
  /**
   * Get or create a day. Always succeeds.
   * If the day doesn't exist, creates an empty one.
   */
  readonly getOrCreate: (dayId: DayId) => Effect.Effect<Day>

  /** Get day by ID. Fails if not found. */
  readonly get: (dayId: DayId) => Effect.Effect<Day, DayStateNotFoundError>

  /** Set/update day state (upsert). */
  readonly set: (day: Day) => Effect.Effect<void>

  /** List days matching filter. */
  readonly list: (filter: DayFilter) => Effect.Effect<readonly Day[]>

  /** List day summaries for a month (lightweight projection). */
  readonly listSummaries: (
    year: number,
    month: number,
  ) => Effect.Effect<readonly DaySummary[]>

  /** Delete day by ID. Returns true if existed. */
  readonly delete: (dayId: DayId) => Effect.Effect<boolean>

  /** Check if day has been created (not just empty). */
  readonly exists: (dayId: DayId) => Effect.Effect<boolean>

  /** Count days matching filter. */
  readonly count: (filter: DayFilter) => Effect.Effect<number>
}
