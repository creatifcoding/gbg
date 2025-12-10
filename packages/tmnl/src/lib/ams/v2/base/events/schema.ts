/**
 * AMS v2 EventLog Schema
 *
 * Combines all event groups into a single EventLog schema.
 *
 * @module @gbg/tmnl/ams/v2/base/events/schema
 */

import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents } from './asset'

// ─────────────────────────────────────────────────────────────────────────────
// EventLog Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AMS EventLog Schema
 *
 * Combines all AMS event groups for event sourcing.
 * Used with EventLog.group(), groupCompaction(), groupReactivity().
 */
export const AmsEventLogSchema = EventLog.schema(AssetEvents)

/**
 * Type helper
 */
export type AmsEventLogSchema = typeof AmsEventLogSchema
