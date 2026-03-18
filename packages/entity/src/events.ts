/**
 * @tmnl/entity — Event system
 *
 * Standard lifecycle events auto-generated for every entity.
 * Custom domain events declared via `events:` config.
 * All events use envelope pattern: { header, payload }.
 * Dot-namespaced tags: `Todo.Created`, `Order.Shipped`.
 *
 * @since 0.0.1
 */

import * as Schema from 'effect-v4/Schema'
import * as EventGroup from 'effect-v4/unstable/eventlog/EventGroup'

// ─── Event Envelope ──────────────────────────────────────────

/**
 * Standard event header — present on ALL entity events.
 *
 * - `entityId`: primary key value (string-coerced)
 * - `entityType`: entity tag (e.g. "Todo", "Order")
 * - `timestamp`: epoch ms
 * - `correlationId`: groups related events (e.g. saga, batch)
 */
export const EventHeader = Schema.Struct({
  entityId: Schema.String,
  entityType: Schema.String,
  timestamp: Schema.Number,
  correlationId: Schema.String,
})

/** Inferred type of the standard event header */
export type EventHeader = typeof EventHeader.Type

// ─── Lifecycle Event Names ───────────────────────────────────

/**
 * The 8 standard lifecycle events every entity emits.
 *
 * | Event        | Payload shape                              |
 * |--------------|--------------------------------------------|
 * | Created      | insert variant (full minus Generated)      |
 * | Updated      | { before, after } select snapshots         |
 * | Deleted      | { snapshot } final state                   |
 * | Restored     | { snapshot } after un-delete               |
 * | Archived     | { snapshot } soft lifecycle                |
 * | Patched      | partial field changes (lighter than Updated)|
 * | BulkCreated  | { items: insert[] }                        |
 * | BulkDeleted  | { ids: string[] }                          |
 */
export const LIFECYCLE_EVENTS = [
  'Created',
  'Updated',
  'Deleted',
  'Restored',
  'Archived',
  'Patched',
  'BulkCreated',
  'BulkDeleted',
] as const

export type LifecycleEventName = (typeof LIFECYCLE_EVENTS)[number]

// ─── Event Builder ───────────────────────────────────────────

/**
 * Custom event field definition.
 * Maps event name → struct fields (Schema types).
 *
 * @example
 * ```ts
 * const events: CustomEventDefs = {
 *   Completed:       { completedAt: Schema.Number },
 *   PriorityChanged: { from: Schema.String, to: Schema.String },
 * }
 * ```
 */
export type CustomEventDefs = Record<string, Record<string, Schema.Top>>

/**
 * Build a complete EventGroup for an entity.
 *
 * Produces:
 * - 8 standard lifecycle events (auto-generated)
 * - N custom domain events (from `customEvents` config)
 *
 * All events are dot-namespaced: `${entityTag}.${eventName}`
 * All events use envelope: `{ header: EventHeader, payload: variant }`
 *
 * @param entityTag - Entity name (e.g. "Todo")
 * @param entitySchema - The entity class (has .select, .insert variants)
 * @param customEvents - Optional custom domain events
 */
export function buildEntityEvents(
  entityTag: string,
  entitySchema: { select?: Schema.Top; insert?: Schema.Top },
  customEvents?: CustomEventDefs,
): EventGroup.EventGroup {
  const selectSchema = entitySchema.select ?? Schema.Unknown
  const insertSchema = entitySchema.insert ?? Schema.Unknown

  // Reusable primaryKey extractors
  const entityIdKey = (payload: any) =>
    payload.header?.entityId ?? 'unknown'
  const correlationIdKey = (payload: any) =>
    payload.header?.correlationId ?? 'unknown'

  // Reusable envelope with snapshot payload
  const snapshotEnvelope = Schema.Struct({
    header: EventHeader,
    payload: Schema.Struct({ snapshot: selectSchema }),
  })

  let group: EventGroup.EventGroup = EventGroup.empty

  // ── Created: insert payload ──
  group = group.add({
    tag: `${entityTag}.Created`,
    primaryKey: entityIdKey,
    payload: Schema.Struct({
      header: EventHeader,
      payload: insertSchema,
    }),
  })

  // ── Updated: before/after snapshots ──
  group = group.add({
    tag: `${entityTag}.Updated`,
    primaryKey: entityIdKey,
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        before: selectSchema,
        after: selectSchema,
      }),
    }),
  })

  // ── Deleted: final snapshot ──
  group = group.add({
    tag: `${entityTag}.Deleted`,
    primaryKey: entityIdKey,
    payload: snapshotEnvelope,
  })

  // ── Restored: un-delete snapshot ──
  group = group.add({
    tag: `${entityTag}.Restored`,
    primaryKey: entityIdKey,
    payload: snapshotEnvelope,
  })

  // ── Archived: soft lifecycle ──
  group = group.add({
    tag: `${entityTag}.Archived`,
    primaryKey: entityIdKey,
    payload: snapshotEnvelope,
  })

  // ── Patched: partial changes ──
  group = group.add({
    tag: `${entityTag}.Patched`,
    primaryKey: entityIdKey,
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Unknown, // Record<field, { from, to }>
    }),
  })

  // ── BulkCreated: batch inserts ──
  group = group.add({
    tag: `${entityTag}.BulkCreated`,
    primaryKey: correlationIdKey,
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        items: Schema.Array(insertSchema),
      }),
    }),
  })

  // ── BulkDeleted: batch deletes ──
  group = group.add({
    tag: `${entityTag}.BulkDeleted`,
    primaryKey: correlationIdKey,
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        ids: Schema.Array(Schema.String),
      }),
    }),
  })

  // ── Custom domain events ──
  if (customEvents) {
    for (const [eventName, fields] of Object.entries(customEvents)) {
      group = group.add({
        tag: `${entityTag}.${eventName}`,
        primaryKey: entityIdKey,
        payload: Schema.Struct({
          header: EventHeader,
          payload: Schema.Struct(fields as any),
        }),
      })
    }
  }

  return group
}

// ─── Event Utilities ─────────────────────────────────────────

/**
 * Check if an event tag matches a lifecycle event.
 *
 * @example
 * ```ts
 * isLifecycleEvent('Todo.Created')  // true
 * isLifecycleEvent('Todo.Shipped')  // false
 * ```
 */
export function isLifecycleEvent(tag: string): boolean {
  const suffix = tag.split('.')[1]
  return LIFECYCLE_EVENTS.includes(suffix as LifecycleEventName)
}

/**
 * Extract the entity name from a dot-namespaced event tag.
 *
 * @example
 * ```ts
 * entityNameFromTag('Todo.Created')  // 'Todo'
 * entityNameFromTag('Order.Shipped') // 'Order'
 * ```
 */
export function entityNameFromTag(tag: string): string {
  return tag.split('.')[0]
}

/**
 * Extract the event name from a dot-namespaced event tag.
 *
 * @example
 * ```ts
 * eventNameFromTag('Todo.Created')  // 'Created'
 * eventNameFromTag('Order.Shipped') // 'Shipped'
 * ```
 */
export function eventNameFromTag(tag: string): string {
  return tag.split('.').slice(1).join('.')
}

/**
 * Filter event tags by entity name.
 *
 * @example
 * ```ts
 * filterByEntity(['Todo.Created', 'Order.Created'], 'Todo')
 * // → ['Todo.Created']
 * ```
 */
export function filterByEntity(tags: string[], entityName: string): string[] {
  return tags.filter((t) => t.startsWith(`${entityName}.`))
}

/**
 * Filter event tags by event type suffix (cross-entity).
 *
 * @example
 * ```ts
 * filterByEventType(['Todo.Created', 'Order.Created', 'Todo.Deleted'], 'Created')
 * // → ['Todo.Created', 'Order.Created']
 * ```
 */
export function filterByEventType(tags: string[], eventType: string): string[] {
  return tags.filter((t) => t.endsWith(`.${eventType}`))
}
