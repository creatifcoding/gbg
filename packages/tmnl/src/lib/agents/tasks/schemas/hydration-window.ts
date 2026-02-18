/**
 * Agent Task Log Hydration Window Schemas
 *
 * Contracts for window planning and hydrated slices.
 *
 * @module agent-task/schemas/hydration-window
 */

import { Schema } from 'effect'
import { AgentTaskLogEntrySchema } from './log-entry'

export const HydrationAnchor = Schema.Literal('newest-first')
export type HydrationAnchor = typeof HydrationAnchor.Type

export const HydrationWindowFields = {
  taskId: Schema.String,
  anchor: HydrationAnchor,
  centerOffset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  beforeCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  afterCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  fromOffset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  toOffset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  cacheTtlMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  requestedAt: Schema.DateTimeUtc,
}

export class HydrationWindow extends Schema.TaggedClass<HydrationWindow>()(
  'HydrationWindow',
  HydrationWindowFields,
) {}

export const HydrationWindowSchema = HydrationWindow

export const HydrationSliceSource = Schema.Literal('cache', 'archive', 'nats')
export type HydrationSliceSource = typeof HydrationSliceSource.Type

export const HydrationSliceFields = {
  taskId: Schema.String,
  window: HydrationWindowSchema,
  source: HydrationSliceSource,
  mergedEntries: Schema.Array(AgentTaskLogEntrySchema),
  mergedEntryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  hasOlder: Schema.Boolean,
  hasNewer: Schema.Boolean,
  hydratedAt: Schema.DateTimeUtc,
}

export class HydrationSlice extends Schema.TaggedClass<HydrationSlice>()(
  'HydrationSlice',
  HydrationSliceFields,
) {}

export const HydrationSliceSchema = HydrationSlice
