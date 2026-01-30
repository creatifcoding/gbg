/**
 * Event Base Classes — Three Divergent Event Categories
 *
 * This module defines three SEPARATE base classes for events. They do NOT
 * inherit from a common root because their storage semantics, query patterns,
 * and lifecycle characteristics are fundamentally different.
 *
 * | Category       | Storage      | Query Pattern            | Retention          |
 * |----------------|--------------|--------------------------|--------------------|
 * | Structural     | EventLog     | Replay from origin       | Indefinite         |
 * | Operational    | EventLog     | Replay + time-travel     | Indefinite         |
 * | Temporal       | TimescaleDB  | Time-bucketed aggregation| Tiered (hot/warm)  |
 *
 * @module @gbg/tmnl/iiot/schemas/events/base
 * @see thoughts/shared/specs/entity-system/03-event-hierarchy.md
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { EventId, EquipmentLevel, AssetId } from '../identifiers'

// =============================================================================
// Structural Events — Entity Lifecycle & Configuration
// =============================================================================

/**
 * Base class for structural events (entity lifecycle, configuration).
 *
 * Structural events capture the "shape" of the system — what exists, where it
 * is in the hierarchy, and how it's configured.
 *
 * Characteristics:
 * - Stored in EventLog (JSONB journal)
 * - Replayed from origin to reconstruct state
 * - Never deleted (audit compliance)
 * - Includes full hierarchy path for cascade operations
 *
 * @example
 * ```typescript
 * export class PlantCreated extends BaseStructuralEvent.extend<PlantCreated>(
 *   'PlantCreated'
 * )({
 *   plantId: PlantId,
 *   name: Schema.NonEmptyString,
 *   timezone: Schema.String,
 * }) {}
 * ```
 *
 * @see ADR-0012 for EventLog boundaries
 */
export class BaseStructuralEvent extends Schema.TaggedClass<BaseStructuralEvent>()(
  'BaseStructuralEvent',
  {
    /** Unique event identifier (ULID for sortability) */
    eventId: EventId,

    /** When the event occurred (not when recorded) */
    occurredAt: Schema.DateTimeUtc,

    /** Principal/actor that caused this event (userId, systemId) */
    causedBy: Schema.String,

    /** Entity this event affects */
    entityId: AssetId,

    /** ISA-95 equipment level of the entity */
    entityType: EquipmentLevel,

    /**
     * Full hierarchy path from root to this entity.
     * Array of AssetIds enabling:
     * - Single-query child lookup: `WHERE hierarchyPath @> ARRAY['LINE-001']`
     * - Audit trail: Entity was under this parent at event time
     * - Cascade validation: Ensure parent exists before child creation
     */
    hierarchyPath: Schema.Array(AssetId),

    /** Correlation ID for multi-event transactions */
    correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Event version for schema evolution */
    schemaVersion: Schema.optionalWith(
      Schema.Number.pipe(Schema.int(), Schema.positive()),
      { default: () => 1 }
    ),
  }
) {}

export type BaseStructuralEventType = typeof BaseStructuralEvent.Type

// =============================================================================
// Operational Events — Runtime Business Events
// =============================================================================

/**
 * Base class for operational events (business actions, state changes).
 *
 * Operational events capture the "behavior" of the system — state changes,
 * alarms, maintenance actions. They describe what happened TO an entity.
 *
 * Characteristics:
 * - Stored in EventLog (JSONB journal)
 * - Supports time-travel queries ("state at time T")
 * - Never deleted (OEE calculation, RCA support)
 * - NO hierarchy path (avoids stale path data if asset relocated)
 *
 * @example
 * ```typescript
 * export class MachineStateChanged extends BaseOperationalEvent.extend<MachineStateChanged>(
 *   'MachineStateChanged'
 * )({
 *   previousState: MachineState,
 *   newState: MachineState,
 *   reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
 * }) {}
 * ```
 */
export class BaseOperationalEvent extends Schema.TaggedClass<BaseOperationalEvent>()(
  'BaseOperationalEvent',
  {
    /** Unique event identifier (ULID for sortability) */
    eventId: EventId,

    /** When the event occurred (not when recorded) */
    occurredAt: Schema.DateTimeUtc,

    /** Principal/actor that caused this event */
    causedBy: Schema.String,

    /** Entity this event affects */
    entityId: AssetId,

    /** ISA-95 equipment level (for polymorphic dispatch) */
    entityType: EquipmentLevel,

    /** Correlation ID for multi-event transactions */
    correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Event version for schema evolution */
    schemaVersion: Schema.optionalWith(
      Schema.Number.pipe(Schema.int(), Schema.positive()),
      { default: () => 1 }
    ),
  }
) {}

export type BaseOperationalEventType = typeof BaseOperationalEvent.Type

// =============================================================================
// Temporal Events — High-Frequency Measurements
// =============================================================================

/**
 * OPC-UA Quality codes for data trustworthiness.
 * Simplified from full OPC-UA Quality spec.
 */
export const OpcQuality = Schema.Literal(
  'good',           // Value is reliable
  'good_localOverride', // Value overridden locally
  'uncertain',      // Value may be inaccurate
  'uncertain_lastUsable', // Last known good value
  'bad',            // Value is unreliable
  'bad_sensorFailure',   // Sensor has failed
  'bad_commFailure'      // Communication lost
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/OpcQuality',
    description: 'OPC-UA quality code for measurement trustworthiness',
  })
)
export type OpcQuality = typeof OpcQuality.Type

/**
 * Base class for temporal events (time-series data).
 *
 * Temporal events are high-frequency measurements — sensor readings, metrics,
 * counters. They are NOT stored in the EventLog.
 *
 * Characteristics:
 * - Stored in TimescaleDB hypertable (NOT EventLog)
 * - Time-bucketed aggregation (1min, 1hour continuous aggregates)
 * - Tiered retention (raw: 7d, 1min: 90d, 1hour: indefinite)
 * - Linked to assets via entityId (foreign key)
 *
 * Note: NOT event sourced. These are measurements, not state transitions.
 * The EventLog handles structural/operational events; TimescaleDB handles data.
 *
 * @example
 * ```typescript
 * export class SensorReading extends BaseTemporalEvent.extend<SensorReading>(
 *   'SensorReading'
 * )({
 *   sensorId: SensorId,
 *   value: Schema.Number,
 *   unit: Schema.String,
 * }) {}
 * ```
 */
export class BaseTemporalEvent extends Schema.TaggedClass<BaseTemporalEvent>()(
  'BaseTemporalEvent',
  {
    /** Measurement timestamp (UTC) */
    time: Schema.DateTimeUtc,

    /** Entity this measurement relates to (sensor/device/machine) */
    entityId: AssetId,

    /**
     * Rounded bucket time for aggregate joins.
     * Pre-computing enables efficient aggregate joins and avoids
     * repeated time_bucket() calls in queries.
     */
    bucketTime: Schema.DateTimeUtc,

    /** OPC-UA quality code for data trustworthiness */
    quality: Schema.optionalWith(OpcQuality, { default: () => 'good' as const }),
  }
) {}

export type BaseTemporalEventType = typeof BaseTemporalEvent.Type

// =============================================================================
// Event Routing Helper
// =============================================================================

/**
 * Determine which storage backend an event should use.
 *
 * @example
 * ```typescript
 * const event = new SensorReading({ ... })
 * const storage = getEventStorage(event) // 'timescaledb'
 * ```
 */
export type EventStorage = 'eventlog' | 'timescaledb'

export const getEventStorage = (
  event: BaseStructuralEvent | BaseOperationalEvent | BaseTemporalEvent
): EventStorage => {
  if (event._tag === 'BaseTemporalEvent') {
    return 'timescaledb'
  }
  return 'eventlog'
}

// =============================================================================
// Event Category Type Guards
// =============================================================================

export const isStructuralEvent = (event: unknown): event is BaseStructuralEvent =>
  event !== null &&
  typeof event === 'object' &&
  '_tag' in event &&
  event._tag === 'BaseStructuralEvent'

export const isOperationalEvent = (event: unknown): event is BaseOperationalEvent =>
  event !== null &&
  typeof event === 'object' &&
  '_tag' in event &&
  event._tag === 'BaseOperationalEvent'

export const isTemporalEvent = (event: unknown): event is BaseTemporalEvent =>
  event !== null &&
  typeof event === 'object' &&
  '_tag' in event &&
  event._tag === 'BaseTemporalEvent'
