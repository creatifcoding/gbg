/**
 * Atom Observability Schemas - Effect Schema definitions for atom tracing events
 *
 * These schemas enable:
 * - Structured logging of atom state transitions
 * - Type-safe event discrimination via _tag
 * - Integration with testbed logger atoms
 * - DevTools timeline integration
 *
 * @module primitives/atoms/observability/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Observability Event Schemas
// =============================================================================

/**
 * Emitted when an atom value is read via traced get()
 */
export class AtomRead extends Schema.TaggedClass<AtomRead>()('AtomRead', {
  /** Unique identifier for the atom group (e.g., "map:maptool-123") */
  groupId: Schema.String,
  /** Key within the atom group (e.g., "dimensionsAtom") */
  atomKey: Schema.String,
  /** The value that was read */
  value: Schema.Unknown,
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
}) {}

/**
 * Emitted when an atom value is written via traced set()
 */
export class AtomWrite extends Schema.TaggedClass<AtomWrite>()('AtomWrite', {
  /** Unique identifier for the atom group */
  groupId: Schema.String,
  /** Key within the atom group */
  atomKey: Schema.String,
  /** Previous value before the write */
  prevValue: Schema.Unknown,
  /** New value after the write */
  nextValue: Schema.Unknown,
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
  /** Optional source identifier (e.g., "ResizeObserver", "onLoad", "user-click") */
  source: Schema.optional(Schema.String),
}) {}

/**
 * Emitted when a subscriber attaches to an atom
 */
export class AtomSubscribe extends Schema.TaggedClass<AtomSubscribe>()('AtomSubscribe', {
  /** Unique identifier for the atom group */
  groupId: Schema.String,
  /** Key within the atom group */
  atomKey: Schema.String,
  /** Unique identifier for this subscription */
  subscriberId: Schema.String,
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
}) {}

/**
 * Emitted when a subscriber detaches from an atom
 */
export class AtomUnsubscribe extends Schema.TaggedClass<AtomUnsubscribe>()('AtomUnsubscribe', {
  /** Unique identifier for the atom group */
  groupId: Schema.String,
  /** Key within the atom group */
  atomKey: Schema.String,
  /** Unique identifier for the subscription being cancelled */
  subscriberId: Schema.String,
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
}) {}

/**
 * Emitted when an atom group is created
 */
export class AtomGroupCreated extends Schema.TaggedClass<AtomGroupCreated>()('AtomGroupCreated', {
  /** Unique identifier for the atom group */
  groupId: Schema.String,
  /** Keys of atoms in this group */
  atomKeys: Schema.Array(Schema.String),
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
}) {}

/**
 * Emitted when an atom group is disposed
 */
export class AtomGroupDisposed extends Schema.TaggedClass<AtomGroupDisposed>()('AtomGroupDisposed', {
  /** Unique identifier for the atom group */
  groupId: Schema.String,
  /** Unix timestamp in milliseconds */
  timestamp: Schema.Number,
}) {}

// =============================================================================
// Union Type
// =============================================================================

/**
 * Union of all atom observability events
 *
 * Use Match.tag() for type-safe discrimination:
 * ```typescript
 * Match.tag(event, {
 *   AtomRead: (e) => console.log('Read:', e.atomKey),
 *   AtomWrite: (e) => console.log('Write:', e.atomKey, e.prevValue, '→', e.nextValue),
 *   AtomSubscribe: (e) => console.log('Subscribe:', e.subscriberId),
 *   AtomUnsubscribe: (e) => console.log('Unsubscribe:', e.subscriberId),
 *   AtomGroupCreated: (e) => console.log('Group created:', e.groupId),
 *   AtomGroupDisposed: (e) => console.log('Group disposed:', e.groupId),
 * })
 * ```
 */
export const AtomObservabilityEvent = Schema.Union(
  AtomRead,
  AtomWrite,
  AtomSubscribe,
  AtomUnsubscribe,
  AtomGroupCreated,
  AtomGroupDisposed
)

export type AtomObservabilityEvent = Schema.Schema.Type<typeof AtomObservabilityEvent>

// =============================================================================
// Event Tag Type (for type guards)
// =============================================================================

export type AtomObservabilityEventTag = AtomObservabilityEvent['_tag']
