/**
 * @tmnl/entity — One Schema Rules All
 *
 * Define an entity once. Get variant schemas, EventLog events,
 * validation, wire codecs, and reactive state — all derived.
 *
 * ```ts
 * import { Entity } from '@tmnl/entity'
 * import * as Schema from 'effect-v4/Schema'
 *
 * class Todo extends Entity('Todo')({
 *   id:        Entity.generated(Schema.Number),
 *   text:      Schema.NonEmptyString,
 *   completed: Schema.Boolean,
 *   createdAt: Entity.timestamp(),
 * }, {
 *   events: { Completed: { completedAt: Schema.Number } }
 * }) {
 *   get isHighPriority() { return this.priority === 'high' }
 * }
 *
 * // Variants:  Todo.select, .insert, .update, .json
 * // Events:    Todo.events (EventGroup), Todo.event('Created')
 * // Instances: new Todo({ id: 1, text: 'Buy milk', ... })
 * ```
 *
 * @since 0.0.1
 * @module
 */

// ── Entity Factory ───────────────────────────────────────────
export {
  Entity,
  BaseModel,
  ENTITY_VARIANTS,
  getFieldKind,
  SchemaError,
  type FieldKind,
  type EntityVariant,
  type EntityConfig,
  type EntityClass,
  type ValidateResult,
  buildValidators,
  buildCodec,
} from './entity.js'

// ── Metadata Envelope ────────────────────────────────────────
export {
  withMeta,
  EntityMetaFields,
  META_FIELD_NAMES,
  META_FIELD_COUNT,
  Classification,
  type Classification as ClassificationType,
  EntityId,
  type EntityId as EntityIdType,
  SourceId,
  ProvenanceRef,
  type ProvenanceRef as ProvenanceRefType,
  ProvenanceSummary,
  type ProvenanceSummary as ProvenanceSummaryType,
  ProvenanceRecord,
  type ProvenanceRecord as ProvenanceRecordType,
  buildProvenanceRefs,
} from './meta.js'

// ── Entity Context ───────────────────────────────────────────
export {
  EntityContext,
  type EntityContextShape,
} from './context.js'

// Attach withMeta to Entity namespace for ergonomic API:
//   Entity.withMeta('Tag')(domainFields)
import { Entity } from './entity.js'
import { withMeta, EntityMetaFields, META_FIELD_NAMES } from './meta.js'
Entity.withMeta = withMeta
Entity.MetaFields = EntityMetaFields
Entity.META_FIELD_NAMES = META_FIELD_NAMES

// ── Reactive Bridge ──────────────────────────────────────────
export {
  createReactive,
  type ReactiveConfig,
  type ReactiveEntity,
} from './reactive.js'

// ── Hook Factory ─────────────────────────────────────────────
export {
  createEntityHooks,
  type EntityHooksConfig,
  type EntityHooks,
} from './hooks.js'

// ── Event System ─────────────────────────────────────────────
export {
  EventHeader,
  type EventHeader as EventHeaderType,
  LIFECYCLE_EVENTS,
  type LifecycleEventName,
  type CustomEventDefs,
  buildEntityEvents,
  isLifecycleEvent,
  entityNameFromTag,
  eventNameFromTag,
  filterByEntity,
  filterByEventType,
} from './events.js'
