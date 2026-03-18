/**
 * @tmnl/entity — Entity factory
 *
 * One Schema definition → variant schemas, EventLog events,
 * TanStack DB collections, STX atoms, server repos.
 *
 * Consumer API:
 * ```ts
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
 * ```
 *
 * @since 0.0.1
 */

import * as Schema from 'effect-v4/Schema'
import * as Result from 'effect-v4/Result'
import type { Predicate as PredicateT, Refinement } from 'effect-v4/Predicate'
import { VariantSchema } from 'effect-v4/unstable/schema'
import type * as EventGroup from 'effect-v4/unstable/eventlog/EventGroup'
import type * as EventMod from 'effect-v4/unstable/eventlog/Event'
import { buildEntityEvents, type CustomEventDefs } from './events.js'
import { createReactive, type ReactiveConfig, type ReactiveEntity } from './reactive.js'
import { createEntityHooks, type EntityHooksConfig, type EntityHooks } from './hooks.js'
import type { AtomRegistry } from 'effect-v4/unstable/reactivity'

// ─── Field Metadata ──────────────────────────────────────────

/**
 * Field kind — semantic classification of an Entity field.
 *
 * STX reads this metadata to constrain focus/mutation behavior:
 * - `data`      → normal writable field
 * - `generated` → excluded from insert/mutation patches
 * - `timestamp` → auto-managed, optional on insert/update
 * - `sensitive` → redacted in debug/devtools, excluded from wire
 * - `readonly`  → no setter on focus atoms, excluded from mutations
 * - `computed`  → derived atom, never writable, never serialized
 * - `tracked`   → normal writable field WITH provenance tracking
 */
export type FieldKind = 'data' | 'generated' | 'timestamp' | 'sensitive' | 'readonly' | 'computed' | 'tracked'

/**
 * Symbol used to tag field wrapper results with their kind.
 * STX and other consumers read this to introspect field semantics.
 */
const FIELD_KIND = Symbol.for('@tmnl/entity/fieldKind')

/**
 * Tag a field wrapper result with its kind.
 * @internal
 */
function tagField<T>(field: T, kind: FieldKind): T & { [FIELD_KIND]: FieldKind } {
  ;(field as any)[FIELD_KIND] = kind
  return field as T & { [FIELD_KIND]: FieldKind }
}

/**
 * Read the field kind from a tagged wrapper result.
 * Returns 'data' for plain Schema fields (no wrapper).
 */
export function getFieldKind(field: unknown): FieldKind {
  if (field && typeof field === 'object' && FIELD_KIND in field) {
    return (field as any)[FIELD_KIND]
  }
  return 'data'
}

/**
 * Build a fieldMeta map from the raw field definitions.
 * Maps field name → FieldKind for every field in the entity.
 * @internal
 */
function buildFieldMeta(fields: Record<string, any>): Record<string, FieldKind> {
  const meta: Record<string, FieldKind> = {}
  for (const [name, field] of Object.entries(fields)) {
    meta[name] = getFieldKind(field)
  }
  return meta
}

// ─── Variant Configuration ───────────────────────────────────

/**
 * The 6 standard variants every entity produces.
 *
 * | Variant     | Purpose                                   |
 * |-------------|-------------------------------------------|
 * | select      | Full read shape (all fields)               |
 * | insert      | Write shape (Generated excluded)           |
 * | update      | Mutation shape (timestamps optional)       |
 * | json        | Wire format (sensitive excluded)           |
 * | jsonCreate  | API create payload (sensitive excluded)    |
 * | jsonUpdate  | API update payload (sensitive excluded)    |
 */
export const ENTITY_VARIANTS = [
  'select',
  'insert',
  'update',
  'json',
  'jsonCreate',
  'jsonUpdate',
] as const

export type EntityVariant = (typeof ENTITY_VARIANTS)[number]

// ─── Base VariantSchema Model ────────────────────────────────

/**
 * The shared VariantSchema instance backing all entities.
 * Provides `Class`, `Field`, `FieldOnly`, `FieldExcept`, `Struct`, etc.
 */
export const BaseModel = VariantSchema.make({
  variants: [...ENTITY_VARIANTS],
  defaultVariant: 'select',
})

// ─── Entity Config ───────────────────────────────────────────

/**
 * Optional second argument to Entity('Tag')(fields, config).
 */
export interface EntityConfig {
  /** Custom domain events beyond the 8 standard lifecycle events. */
  readonly events?: CustomEventDefs
}

// ─── Entity Class Type ───────────────────────────────────────

/**
 * Shape returned by Entity('Tag')(fields, config).
 * This is the class itself with all static properties attached.
 */
export interface EntityClass<Tag extends string = string> {
  /** The entity's name tag (e.g. 'Todo') */
  readonly entityTag: Tag

  /** EventGroup containing all lifecycle + custom events */
  readonly events: EventGroup.EventGroup

  /** Access a single event by short name (e.g. 'Created' → 'Todo.Created') */
  event(name: string): EventMod.Any | undefined

  /** Safe validators for each variant. Returns `{ _tag: 'Ok', value }` or `{ _tag: 'Err', issues }` */
  readonly validate: {
    readonly select: (data: unknown) => ValidateResult<any>
    readonly insert: (data: unknown) => ValidateResult<any>
    readonly update: (data: unknown) => ValidateResult<any>
    readonly json: (data: unknown) => ValidateResult<any>
    readonly jsonCreate: (data: unknown) => ValidateResult<any>
    readonly jsonUpdate: (data: unknown) => ValidateResult<any>
  }

  /** Field metadata — maps field name → FieldKind for STX/debug introspection */
  readonly fieldMeta: Record<string, FieldKind>

  /**
   * Create a reactive STX atom bridge for this entity.
   *
   * @example
   * ```ts
   * const registry = AtomRegistry.make()
   * const rx = Todo.reactive(registry, {
   *   getId: (t) => t.id,
   *   initialData: seedTodos,
   * })
   * // rx.items, rx.count, rx.byId, rx.item(key), rx.insert, rx.update, rx.remove
   * ```
   */
  reactive<T extends object, TKey extends string | number>(
    registry: AtomRegistry.AtomRegistry,
    config: ReactiveConfig<T, TKey>,
  ): ReactiveEntity<T, TKey>

  /**
   * Create React hooks for this entity — single import for domain devs.
   *
   * @example
   * ```ts
   * const todoHooks = Todo.createHooks({ getId: t => t.id })
   *
   * function TodoList() {
   *   const items = todoHooks.useItems()
   *   const insert = todoHooks.useInsert()
   *   // ...
   * }
   * ```
   */
  createHooks<T extends object, TKey extends string | number>(
    config: EntityHooksConfig<T, TKey>,
  ): EntityHooks<T, TKey>

  /** Wire codec — encode/decode through the json variant */
  readonly codec: {
    encode(item: unknown): unknown
    decode(wire: unknown): ValidateResult<unknown>
    decodeOrThrow(wire: unknown): unknown
    encodeArray(items: readonly unknown[]): unknown[]
    decodeArray(wires: readonly unknown[]): ValidateResult<unknown[]>
  }

  /** select variant schema — full read shape */
  readonly select: any
  /** insert variant schema — Generated fields excluded */
  readonly insert: any
  /** update variant schema — timestamps optional */
  readonly update: any
  /** json variant schema — sensitive fields excluded */
  readonly json: any
  /** jsonCreate variant schema — API create payload */
  readonly jsonCreate: any
  /** jsonUpdate variant schema — API update payload */
  readonly jsonUpdate: any

  /**
   * Build a composable `Predicate<T>` from a raw predicate function.
   *
   * Wraps any `(instance) => boolean` check into a typed `Predicate<T>` that
   * composes with `Predicate.and`, `Predicate.or`, `Predicate.not`,
   * `Result.liftPredicate`, `Result.filterOrFail`, and STX's `store.filter()`.
   *
   * @example
   * ```ts
   * import { Predicate } from 'effect-v4'
   *
   * const isActive = Todo.guard(
   *   Predicate.Struct({ completed: (c: boolean) => !c, deletedAt: Predicate.isNull })
   * )
   *
   * // Compose
   * const isUrgent = Predicate.and(isActive, Todo.guard(t => t.priority === 'high'))
   *
   * // Use everywhere
   * todos.filter(isUrgent)                         // Array
   * store.filter(store.lens.todos, ts => ts.filter(isUrgent))  // STX atom
   * Result.liftPredicate(todo, isActive, () => 'inactive')     // Result
   * ```
   */
  guard<T>(predicate: PredicateT<T>): PredicateT<T>

  /**
   * Build a type-narrowing `Refinement<T, U>` from a refinement function.
   *
   * The refinement narrows the entity type when the predicate passes,
   * enabling discriminated type narrowing in conditionals and pipes.
   *
   * @example
   * ```ts
   * interface ActiveTodo extends Todo { completed: false }
   *
   * const isActive = Todo.refine<Todo, ActiveTodo>(
   *   (t): t is ActiveTodo => t.completed === false
   * )
   *
   * if (isActive(todo)) {
   *   todo.completed // type: false
   * }
   *
   * // In Result pipeline
   * Result.liftPredicate(todo, isActive, () => 'not active')
   * // Result<ActiveTodo, string>
   * ```
   */
  refine<T, U extends T>(refinement: Refinement<T, U>): Refinement<T, U>

  /** Construct a new instance (validates through select schema) */
  new(props: any): any
}

// ─── Entity Factory ──────────────────────────────────────────

/**
 * Create an entity class with variant schemas and EventLog events.
 *
 * @param tag - Entity name (e.g. 'Todo'). Used for _tag discrimination
 *              and dot-namespaced event tags.
 *
 * @example
 * ```ts
 * class Todo extends Entity('Todo')({
 *   id:        Entity.generated(Schema.Number),
 *   text:      Schema.NonEmptyString,
 *   completed: Schema.Boolean,
 *   priority:  Schema.Literals(['low', 'medium', 'high'] as const),
 *   createdAt: Entity.timestamp(),
 *   updatedAt: Entity.timestamp(),
 * }, {
 *   events: {
 *     Completed:       { completedAt: Schema.Number },
 *     PriorityChanged: { from: Schema.String, to: Schema.String },
 *   }
 * }) {
 *   get isHighPriority() { return this.priority === 'high' }
 *   toggle() { return new Todo({ ...this, completed: !this.completed }) }
 * }
 *
 * // Variant schemas:
 * Todo.select      // all fields
 * Todo.insert      // no id, timestamps optional
 * Todo.update      // all fields, timestamps optional
 * Todo.json        // no sensitive fields
 *
 * // Events:
 * Todo.events      // EventGroup: Todo.Created, .Updated, .Deleted, ..., .Completed, .PriorityChanged
 * Todo.event('Completed')  // single Event accessor
 * ```
 */
export function Entity<Tag extends string>(tag: Tag) {
  return <Fields extends Record<string, any>>(
    fields: Fields,
    config?: EntityConfig,
  ) => {
    // Build field metadata BEFORE Model.Class (wrappers have tags)
    const fieldMeta = buildFieldMeta(fields)

    // Build the Model.Class from VariantSchema
    const ModelClass = class extends BaseModel.Class<any>(tag)(fields) {} as any

    // Build EventGroup from entity schema + custom events
    const events = buildEntityEvents(tag, ModelClass, config?.events)

    // Build validate + codec
    const validate = buildValidators(ModelClass)
    const codec = buildCodec(ModelClass)

    // Attach metadata
    ModelClass.entityTag = tag
    ModelClass.events = events
    ModelClass.validate = validate
    ModelClass.codec = codec
    ModelClass.fieldMeta = fieldMeta

    // Discover tracked fields — provenance-blessed fields only
    ModelClass.TRACKED_FIELDS = Object.entries(fieldMeta)
      .filter(([_, kind]) => kind === 'tracked')
      .map(([name]) => name)

    // Single-event accessor: Todo.event('Created') → Event<'Todo.Created'>
    ModelClass.event = (eventName: string): EventMod.Any | undefined => {
      const fullTag = `${tag}.${eventName}`
      return (events as any).events[fullTag]
    }

    // Reactive bridge: Entity → STX atoms
    ModelClass.reactive = (
      registry: AtomRegistry.AtomRegistry,
      config: ReactiveConfig<any, any>,
    ): ReactiveEntity<any, any> => {
      return createReactive(ModelClass, registry, config)
    }

    // Hook factory: Entity → React hooks (single import for domain devs)
    ModelClass.createHooks = (
      config: EntityHooksConfig<any, any>,
    ): EntityHooks<any, any> => {
      return createEntityHooks(ModelClass, config)
    }

    // Guard factory: Entity → composable Predicate<T>
    // Identity passthrough — the typing is what matters.
    // guard() accepts any Predicate<T> and returns it typed against the entity.
    ModelClass.guard = <T>(predicate: PredicateT<T>): PredicateT<T> => predicate

    // Refine factory: Entity → type-narrowing Refinement<T, U>
    // Identity passthrough — the refinement function IS the implementation.
    ModelClass.refine = <T, U extends T>(refinement: Refinement<T, U>): Refinement<T, U> => refinement

    return ModelClass as any
  }
}

// ─── Field Wrappers ──────────────────────────────────────────

/**
 * Generated field — present in select/update/json, EXCLUDED from insert.
 *
 * Use for auto-incremented IDs, server-generated UUIDs, database sequences.
 * The application or database provides the value — the client never sends it.
 *
 * | Variant     | Presence |
 * |-------------|----------|
 * | select      | ✓        |
 * | insert      | ✗        |
 * | update      | ✓        |
 * | json        | ✓        |
 * | jsonCreate  | ✗        |
 * | jsonUpdate  | ✓        |
 *
 * @example
 * ```ts
 * class User extends Entity('User')({
 *   id:   Entity.generated(Schema.Number),   // auto-increment
 *   uuid: Entity.generated(Schema.String),   // server UUID
 * }) {}
 * ```
 */
Entity.generated = <S extends Schema.Top>(schema: S) =>
  tagField(BaseModel.Field({ select: schema, update: schema, json: schema }), 'generated')

/**
 * Timestamp field — present everywhere, optional on insert/update.
 *
 * Infrastructure auto-sets these values. Consumers can override on insert
 * (e.g. import with historical timestamps) but it's not required.
 *
 * Defaults to `Schema.Number` (epoch milliseconds).
 *
 * | Variant     | Presence       |
 * |-------------|----------------|
 * | select      | ✓ required     |
 * | insert      | ✓ optional     |
 * | update      | ✓ optional     |
 * | json        | ✓ required     |
 *
 * @example
 * ```ts
 * class Post extends Entity('Post')({
 *   createdAt: Entity.timestamp(),
 *   updatedAt: Entity.timestamp(),
 *   publishedAt: Entity.timestamp(Schema.String),  // ISO string
 * }) {}
 * ```
 */
Entity.timestamp = (schema?: Schema.Top) => {
  const s = schema ?? Schema.Number
  return tagField(BaseModel.Field({
    select: s,
    insert: Schema.optionalKey(s),
    update: Schema.optionalKey(s),
    json: s,
  }), 'timestamp')
}

/**
 * Sensitive field — present in select/insert/update, EXCLUDED from all json variants.
 *
 * Use for passwords, tokens, PII, API keys — anything that should never
 * cross the wire boundary. Server can read/write, but sync/API never exposes it.
 *
 * | Variant     | Presence |
 * |-------------|----------|
 * | select      | ✓        |
 * | insert      | ✓        |
 * | update      | ✓        |
 * | json        | ✗        |
 * | jsonCreate  | ✗        |
 * | jsonUpdate  | ✗        |
 *
 * @example
 * ```ts
 * class User extends Entity('User')({
 *   password: Entity.sensitive(Schema.NonEmptyString),
 *   apiKey:   Entity.sensitive(Schema.String),
 * }) {}
 * ```
 */
Entity.sensitive = <S extends Schema.Top>(schema: S) =>
  tagField(BaseModel.Field({ select: schema, insert: schema, update: schema }), 'sensitive')

/**
 * Readonly field — present in select/json, EXCLUDED from insert/update.
 *
 * Use for server-computed values that clients can read but never write.
 * The server/database owns these values entirely.
 *
 * | Variant     | Presence |
 * |-------------|----------|
 * | select      | ✓        |
 * | insert      | ✗        |
 * | update      | ✗        |
 * | json        | ✓        |
 *
 * @example
 * ```ts
 * class Article extends Entity('Article')({
 *   viewCount: Entity.readonly(Schema.Number),
 *   score:     Entity.readonly(Schema.Number),
 * }) {}
 * ```
 */
Entity.readonly = <S extends Schema.Top>(schema: S) =>
  tagField(BaseModel.Field({ select: schema, json: schema }), 'readonly')

/**
 * Computed field — present in select ONLY.
 *
 * Server-only computed values. Never serialized, never writable, never synced.
 * Only visible when reading the full entity from the database.
 *
 * | Variant     | Presence |
 * |-------------|----------|
 * | select      | ✓        |
 * | insert      | ✗        |
 * | update      | ✗        |
 * | json        | ✗        |
 *
 * @example
 * ```ts
 * class Report extends Entity('Report')({
 *   wordCount:     Entity.computed(Schema.Number),
 *   readingTimeMs: Entity.computed(Schema.Number),
 * }) {}
 * ```
 */
Entity.computed = <S extends Schema.Top>(schema: S) =>
  tagField(BaseModel.FieldOnly(['select'])(schema), 'computed')

/**
 * Tracked field — normal data field WITH field-level provenance.
 *
 * Behaves identically to a data field in terms of variant presence
 * (present in all variants — select, insert, update, json).
 * The difference is purely semantic: **this field has provenance**.
 *
 * The entity system uses this marker to:
 *   1. Expose `TRACKED_FIELDS` on the entity class (discoverable)
 *   2. Signal that mutations to this field should generate provenance records
 *   3. Enable provenance dereferencing via `ProvenanceRef`
 *
 * Blessing a field with `tracked()` is a deliberate, meaningful ceremony.
 * Use for fields where:
 *   - Compliance requires attribution ("who set this classification?")
 *   - Operational access requires warm provenance ("where did this location come from?")
 *   - Multi-source convergence needs conflict resolution ("which sensor updated coverage?")
 *
 * | Variant     | Presence |
 * |-------------|----------|
 * | select      | ✓        |
 * | insert      | ✓        |
 * | update      | ✓        |
 * | json        | ✓        |
 * | jsonCreate  | ✓        |
 * | jsonUpdate  | ✓        |
 *
 * @example
 * ```ts
 * class AreaOfInterest extends Entity.withMeta('AreaOfInterest')({
 *   name:          Schema.NonEmptyString,
 *   polygonWkt:    Entity.tracked(Schema.String),      // ← provenance-tracked
 *   centroidLat:   Entity.tracked(Schema.Number),      // ← provenance-tracked
 *   centroidLon:   Entity.tracked(Schema.Number),      // ← provenance-tracked
 *   coverageScore: Entity.tracked(Schema.Number),      // ← provenance-tracked
 *   status:        Schema.Literals([...] as const),    // normal data
 *   notes:         Schema.String,                      // normal data
 * }) {}
 *
 * AreaOfInterest.TRACKED_FIELDS
 * // → ['polygonWkt', 'centroidLat', 'centroidLon', 'coverageScore']
 * ```
 */
Entity.tracked = <S extends Schema.Top>(schema: S) =>
  tagField(BaseModel.Field({
    select: schema,
    insert: schema,
    update: schema,
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  }), 'tracked')

// ─── Advanced Field Helpers ──────────────────────────────────

/**
 * Direct access to `BaseModel.Field` for custom variant maps.
 *
 * Use when the standard wrappers don't fit your exact variant needs.
 *
 * @example
 * ```ts
 * class Custom extends Entity('Custom')({
 *   special: Entity.field({
 *     select: Schema.Number,
 *     insert: Schema.optionalKey(Schema.Number),
 *     // omitted from update, json, etc.
 *   }),
 * }) {}
 * ```
 */
Entity.field = BaseModel.Field

/**
 * Direct access to `BaseModel.FieldOnly` — field present in specific variants only.
 *
 * @example
 * ```ts
 * class Queryable extends Entity('Queryable')({
 *   minPrice: Entity.fieldOnly(['filter'])(Schema.Number),
 * }) {}
 * ```
 */
Entity.fieldOnly = BaseModel.FieldOnly

/**
 * Direct access to `BaseModel.FieldExcept` — field present in all variants EXCEPT listed.
 *
 * @example
 * ```ts
 * class Partial extends Entity('Partial')({
 *   internal: Entity.fieldExcept(['json', 'jsonCreate', 'jsonUpdate'])(Schema.String),
 * }) {}
 * ```
 */
Entity.fieldExcept = BaseModel.FieldExcept

// withMeta, MetaFields, META_FIELD_NAMES are attached in index.ts
// to avoid circular imports (meta.ts imports Entity from entity.ts).
Entity.withMeta = undefined as any
Entity.MetaFields = undefined as any
Entity.META_FIELD_NAMES = undefined as any
// Entity.tracked is defined above (not deferred — no circular dep)

// ─── Schema Error ────────────────────────────────────────────

/**
 * Structured error from Schema decode/validate failures.
 *
 * Wraps the raw issue strings from Effect Schema into a typed error
 * with a `_tag` discriminant for pattern matching.
 *
 * @example
 * ```ts
 * const result = Todo.validate.insert(badData)
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.issues) // ["Expected NonEmptyString, got ''"]
 * }
 * ```
 */
export class SchemaError {
  readonly _tag = 'SchemaError' as const
  constructor(
    readonly issues: ReadonlyArray<string>,
    readonly raw?: unknown,
  ) {}
  get message(): string {
    return this.issues.join('; ')
  }
}

// ─── Validate Helpers ────────────────────────────────────────

/**
 * Validation result — `Result<A, SchemaError>`.
 *
 * Success holds the decoded value, Failure holds structured issues.
 * Composes with `Result.map`, `Result.flatMap`, `Result.gen`, etc.
 *
 * **Migration note**: Previously `{ _tag: 'Ok', value } | { _tag: 'Err', issues }`.
 * Now `Result.Success<A> | Result.Failure<SchemaError>`.
 * Access value via `result.success`, error via `result.failure.issues`.
 *
 * @deprecated Use `Result.Result<A, SchemaError>` directly. This alias exists for migration.
 */
export type ValidateResult<A> = Result.Result<A, SchemaError>

/**
 * Create a safe validator from a schema.
 * Returns `Result<A, SchemaError>`.
 *
 * @internal — used by the entity to build `.validate.*`
 */
function makeValidator<A>(schema: Schema.Top): (data: unknown) => Result.Result<A, SchemaError> {
  return (data: unknown): Result.Result<A, SchemaError> => {
    try {
      const value = Schema.decodeUnknownSync(schema)(data) as A
      return Result.succeed(value)
    } catch (e: any) {
      const message = e?.message ?? String(e)
      const issues = message
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
      return Result.fail(new SchemaError(issues, data))
    }
  }
}

/**
 * Build a validate record for an entity class.
 * Provides safe validators for each variant schema.
 *
 * @example
 * ```ts
 * const result = Todo.validate.insert({ text: '', completed: false })
 * if (result._tag === 'Err') console.log(result.issues)
 * ```
 */
export function buildValidators(entityClass: any) {
  return {
    select: makeValidator(entityClass.select),
    insert: makeValidator(entityClass.insert),
    update: makeValidator(entityClass.update),
    json: makeValidator(entityClass.json),
    jsonCreate: makeValidator(entityClass.jsonCreate),
    jsonUpdate: makeValidator(entityClass.jsonUpdate),
  }
}

// ─── Codec (Wire Encode/Decode) ──────────────────────────────

/**
 * Build an encode/decode codec pair for the json wire variant.
 *
 * All decode methods return `Result<A, SchemaError>` — composable with
 * `Result.map`, `Result.flatMap`, `Result.gen`, `Result.filterOrFail`, etc.
 *
 * - `encode(item)` → plain object safe for JSON.stringify / sync wire
 * - `decode(wire)` → `Result<A, SchemaError>` — safe decode
 * - `decodeOrThrow(wire)` → `A` — throws on failure
 * - `encodeArray(items)` → array of wire objects
 * - `decodeArray(wires)` → `Result<A[], SchemaError>` — short-circuits on first error
 *
 * @example
 * ```ts
 * import { Result } from 'effect-v4'
 *
 * const wire = Todo.codec.encode(todo)
 * const back = Todo.codec.decode(wire)
 *
 * // Pattern match
 * Result.match(back, {
 *   onSuccess: (todo) => console.log(todo.text),
 *   onFailure: (err) => console.error(err.issues),
 * })
 *
 * // Compose in a pipeline
 * const validated = Result.gen(function*() {
 *   const todo = yield* Todo.codec.decode(wire)
 *   return todo
 * })
 * ```
 */
export function buildCodec(entityClass: any) {
  const jsonSchema = entityClass.json

  return {
    /** Encode a domain object → wire-safe plain object */
    encode(item: unknown): unknown {
      return Schema.encodeSync(jsonSchema)(item)
    },

    /** Decode wire data → Result<A, SchemaError> */
    decode(wire: unknown): Result.Result<unknown, SchemaError> {
      try {
        const value = Schema.decodeUnknownSync(jsonSchema)(wire)
        return Result.succeed(value)
      } catch (e: any) {
        const message = e?.message ?? String(e)
        const issues = message.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        return Result.fail(new SchemaError(issues, wire))
      }
    },

    /** Decode wire data → domain object (throws SchemaError on failure) */
    decodeOrThrow(wire: unknown): unknown {
      return Schema.decodeUnknownSync(jsonSchema)(wire)
    },

    /** Encode an array of domain objects → wire-safe array */
    encodeArray(items: readonly unknown[]): unknown[] {
      return items.map(item => Schema.encodeSync(jsonSchema)(item))
    },

    /** Decode an array of wire objects → Result<A[], SchemaError>. Short-circuits on first error. */
    decodeArray(wires: readonly unknown[]): Result.Result<unknown[], SchemaError> {
      try {
        const values = wires.map(w => Schema.decodeUnknownSync(jsonSchema)(w))
        return Result.succeed(values)
      } catch (e: any) {
        const message = e?.message ?? String(e)
        const issues = message.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        return Result.fail(new SchemaError(issues))
      }
    },
  }
}
