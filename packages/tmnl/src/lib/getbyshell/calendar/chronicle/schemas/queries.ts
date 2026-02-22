/**
 * Chronicle Query Schemas
 *
 * Typed parameter schemas for Day queries and filters.
 * Follows the IIoT AlarmQueryParams pattern.
 *
 * @module @chronicle/schemas/queries
 * @see src/lib/iiot/schemas/alarms.ts — AlarmQueryParams pattern
 */

import { Schema } from 'effect'
import { DayId } from './identifiers'
import { DayLifecycleState } from './day'

// =============================================================================
// Day Query Parameters
// =============================================================================

export const DayQueryParams = Schema.Struct({
  /** Start date (inclusive) */
  from: Schema.optional(DayId),
  /** End date (inclusive) */
  to: Schema.optional(DayId),
  /** Filter by lifecycle state */
  lifecycleState: Schema.optional(DayLifecycleState),
  /** Only days with notes */
  hasNotes: Schema.optional(Schema.Boolean),
  /** Only days with tasks */
  hasTasks: Schema.optional(Schema.Boolean),
  /** Only days with events */
  hasEvents: Schema.optional(Schema.Boolean),
  /** Only days with any content */
  hasContent: Schema.optional(Schema.Boolean),
  /** Pagination limit */
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  /** Pagination offset */
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
export type DayQueryParams = typeof DayQueryParams.Type

// =============================================================================
// Month Query (for grid rendering)
// =============================================================================

export const MonthQueryParams = Schema.Struct({
  year: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1970)),
  month: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(11)),
})
export type MonthQueryParams = typeof MonthQueryParams.Type
