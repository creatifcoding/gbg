/**
 * @tmnl/stx — Transactional state management
 *
 * Integrates Effect STM (TxRef, Effect.transaction) with
 * the Atom reactive surface. All errors are Schema.TaggedErrorClass.
 * All operations are Effect programs — no try/catch, no throw, no `as any`.
 *
 * Architecture: TxRef<S> as transactional truth, Atom<S> as reactive
 * projection. On Effect.tx() commit → Atom.batch() syncs all
 * changed values to the Atom layer in a single notification pass.
 *
 * Error handling: consumers use Effect.catchTag / Effect.catchTags directly.
 * The error classes carry `_tag` discriminants that compose natively.
 *
 * @module
 * @internal
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Result from "effect/Result"
import * as TxRef from "effect/TxRef"
import type { EntityMeta } from "../types.js"

// ─── Field Kind (Schema.Literals) ───────────────────

/**
 * Field kinds that block mutation.
 * Schema.Literals — not a `new Set(["readonly", ...])`.
 */
export const ReadonlyFieldKind = Schema.Literals(["readonly", "computed", "generated"] as const)
export type ReadonlyFieldKind = typeof ReadonlyFieldKind.Type

/**
 * All known field kinds.
 */
export const FieldKind = Schema.Literals([
  "data", "readonly", "computed", "generated", "sensitive", "timestamp",
] as const)
export type FieldKind = typeof FieldKind.Type

// ─── Errors (Schema.TaggedErrorClass) ───────────────
//
// These are YieldableError instances: you can `yield*` them
// directly inside Effect.gen to fail the Effect, and catch
// them with Effect.catchTag("StxTxValidationError", ...).

/**
 * Validation failure — Entity schema rejected the value.
 */
export class StxTxValidationError
  extends Schema.TaggedErrorClass<StxTxValidationError>(
    "@tmnl/stx/StxTxValidationError",
  )("StxTxValidationError", {
    issues: Schema.Array(Schema.String),
    entityTag: Schema.optional(Schema.String),
  }) {
  override get message(): string {
    const prefix = this.entityTag ? `[${this.entityTag}] ` : ""
    return `${prefix}Validation failed: ${this.issues.join(", ")}`
  }
}

/**
 * Constraint violation — mutation of a readonly/computed/generated field.
 */
export class StxTxConstraintError
  extends Schema.TaggedErrorClass<StxTxConstraintError>(
    "@tmnl/stx/StxTxConstraintError",
  )("StxTxConstraintError", {
    field: Schema.String,
    kind: Schema.String,
    entityTag: Schema.String,
  }) {
  override get message(): string {
    return `Cannot mutate ${this.kind} field '${this.field}' on Entity '${this.entityTag}'`
  }
}

/**
 * Transaction conflict — committed values changed during execution.
 * Effect STM retries automatically, but if retries exhaust,
 * this surfaces as an explicit failure.
 */
export class StxTxConflictError
  extends Schema.TaggedErrorClass<StxTxConflictError>(
    "@tmnl/stx/StxTxConflictError",
  )("StxTxConflictError", {
    storeIds: Schema.Array(Schema.String),
    retries: Schema.Number,
  }) {
  override get message(): string {
    return `Transaction conflict after ${this.retries} retries on stores: ${this.storeIds.join(", ")}`
  }
}

/**
 * Union of all transactional STX errors.
 */
export type StxTxError = StxTxValidationError | StxTxConstraintError | StxTxConflictError

// ─── Lens Path Symbol ───────────────────────────────

const LENS_PATH = Symbol.for("@tmnl/stx/lensPath")

interface WithLensPath {
  readonly [LENS_PATH]?: string
}

function getLensFieldName(lens: unknown): string | undefined {
  if (typeof lens === "object" && lens !== null && LENS_PATH in lens) {
    return (lens as WithLensPath)[LENS_PATH]
  }
  return undefined
}

// ─── Constraint Check (Effect program) ──────────────

/**
 * Check whether a lens targets a readonly field.
 *
 * Returns `Effect<void, StxTxConstraintError>` — succeeds silently
 * if mutation is allowed, fails with StxTxConstraintError if not.
 */
const checkConstraint = (
  lens: unknown,
  entityMeta: EntityMeta | undefined,
): Effect.Effect<void, StxTxConstraintError> => {
  if (!entityMeta) return Effect.void
  const fieldName = getLensFieldName(lens)
  if (!fieldName) return Effect.void
  const kind = entityMeta.fieldMeta[fieldName]
  if (kind && (kind === "readonly" || kind === "computed" || kind === "generated")) {
    return Effect.fail(new StxTxConstraintError({
      field: fieldName,
      kind,
      entityTag: entityMeta.tag,
    }))
  }
  return Effect.void
}

/**
 * Validate a value against an Entity schema.
 *
 * Returns `Effect<S, StxTxValidationError>` — succeeds with the
 * validated value, fails with StxTxValidationError if invalid.
 */
const validateEntity = <S>(
  value: S,
  entityMeta: EntityMeta | undefined,
): Effect.Effect<S, StxTxValidationError> => {
  if (!entityMeta?.validate) return Effect.succeed(value)
  const result = entityMeta.validate.select(value)
  if (Result.isFailure(result)) {
    return Effect.fail(new StxTxValidationError({
      issues: [...result.failure.issues],
      entityTag: entityMeta.tag,
    }))
  }
  return Effect.succeed(value)
}

// ─── Store Descriptor ───────────────────────────────

/**
 * A transactional store descriptor — pairs a TxRef (truth)
 * with an Atom (reactive surface) and optional Entity metadata.
 */
export interface TxStoreDescriptor<S> {
  /** Unique store identifier */
  readonly id: string
  /** Transactional reference — source of truth within transactions */
  readonly txRef: TxRef.TxRef<S>
  /** Reactive atom — projection for React consumers */
  readonly atom: Atom.Writable<S, S>
  /** AtomRegistry for the reactive layer */
  readonly registry: AtomRegistry.AtomRegistry
  /** Entity metadata (if detected) */
  readonly entityMeta: EntityMeta | undefined
}

// ─── Single-Store Transaction ───────────────────────

/**
 * Execute an atomic transaction on a single store.
 *
 * The transaction body is an Effect program that reads/writes
 * via TxRef. On successful commit, all changes are flushed to
 * the Atom layer via Atom.batch() in a single notification pass.
 *
 * On failure (validation, constraint, or user-raised error),
 * the TxRef journal is discarded — Atom state unchanged.
 *
 * @example
 * ```ts
 * const result = Effect.runSync(
 *   storeTransaction(descriptor, (ref) =>
 *     Effect.gen(function*() {
 *       const current = yield* TxRef.get(ref)
 *       yield* TxRef.set(ref, { ...current, name: "Alice", score: 100 })
 *     })
 *   )
 * )
 * ```
 *
 * Error handling via Effect.catchTag:
 * ```ts
 * storeTransaction(store, body).pipe(
 *   Effect.catchTag("StxTxValidationError", (e) =>
 *     Effect.log(`Validation: ${e.message}`)
 *   ),
 * )
 * ```
 */
export const storeTransaction = <S, A, E>(
  store: TxStoreDescriptor<S>,
  body: (ref: TxRef.TxRef<S>) => Effect.Effect<A, E>,
): Effect.Effect<A, E | StxTxValidationError> =>
  Effect.tx(
    Effect.gen(function*() {
      const result = yield* body(store.txRef)
      const committed = yield* TxRef.get(store.txRef)
      yield* validateEntity(committed, store.entityMeta)
      return result
    }),
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        Atom.batch(() => {
          store.registry.set(store.atom, store.txRef.value)
        })
      })
    ),
  )

// ─── Multi-Store Transaction ────────────────────────

/**
 * Execute an atomic transaction across multiple stores.
 *
 * On commit, ALL stores flush to their respective Atom layers
 * in a single Atom.batch() pass — one notification cycle.
 *
 * @example
 * ```ts
 * multiStoreTransaction(
 *   [accountStore, inventoryStore],
 *   (stores) => Effect.gen(function*() {
 *     const account = yield* TxRef.get(stores.get("account")!)
 *     const inventory = yield* TxRef.get(stores.get("inventory")!)
 *     yield* TxRef.set(stores.get("account")!, { ...account, balance: account.balance - 100 })
 *     yield* TxRef.set(stores.get("inventory")!, { ...inventory, items: inventory.items + 1 })
 *   })
 * )
 * ```
 */
export const multiStoreTransaction = <A, E>(
  stores: ReadonlyArray<TxStoreDescriptor<unknown>>,
  body: (
    refs: ReadonlyMap<string, TxRef.TxRef<unknown>>,
  ) => Effect.Effect<A, E>,
): Effect.Effect<A, E | StxTxValidationError> => {
  const refMap: ReadonlyMap<string, TxRef.TxRef<unknown>> = new Map(
    stores.map((s) => [s.id, s.txRef]),
  )

  return Effect.tx(
    Effect.gen(function*() {
      const result = yield* body(refMap)
      for (const store of stores) {
        const committed = yield* TxRef.get(store.txRef)
        yield* validateEntity(committed, store.entityMeta)
      }
      return result
    }),
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        Atom.batch(() => {
          for (const store of stores) {
            store.registry.set(store.atom, store.txRef.value)
          }
        })
      })
    ),
  )
}

// ─── Convenience: Lens-aware transaction ops ────────

/**
 * Set a field at a lens path within a transaction.
 *
 * Validates readonly constraints via Effect error channel.
 * Composes with other Tx operations inside Effect.gen.
 */
export const txSetAt = <S, A>(
  ref: TxRef.TxRef<S>,
  entityMeta: EntityMeta | undefined,
  lens: { replace: (value: A, state: S) => S },
  value: A,
): Effect.Effect<void, StxTxConstraintError> =>
  Effect.gen(function*() {
    yield* checkConstraint(lens, entityMeta)
    const current = yield* TxRef.get(ref)
    yield* TxRef.set(ref, lens.replace(value, current))
  })

/**
 * Modify a field at a lens path within a transaction.
 */
export const txModify = <S, A>(
  ref: TxRef.TxRef<S>,
  entityMeta: EntityMeta | undefined,
  lens: { modify: (fn: (a: A) => A) => (state: S) => S },
  fn: (a: A) => A,
): Effect.Effect<void, StxTxConstraintError> =>
  Effect.gen(function*() {
    yield* checkConstraint(lens, entityMeta)
    const current = yield* TxRef.get(ref)
    yield* TxRef.set(ref, lens.modify(fn)(current))
  })

/**
 * Set root state within a transaction, with Entity validation.
 */
export const txSet = <S>(
  ref: TxRef.TxRef<S>,
  entityMeta: EntityMeta | undefined,
  value: S,
): Effect.Effect<void, StxTxValidationError> =>
  Effect.gen(function*() {
    yield* validateEntity(value, entityMeta)
    yield* TxRef.set(ref, value)
  })

/**
 * Read current transactional state (sees uncommitted writes within this tx).
 */
export const txGet = <S>(
  ref: TxRef.TxRef<S>,
): Effect.Effect<S, never> =>
  TxRef.get(ref)

/**
 * Read at a lens path within a transaction.
 */
export const txGetAt = <S, A>(
  ref: TxRef.TxRef<S>,
  lens: { get: (s: S) => A },
): Effect.Effect<A, never> =>
  Effect.map(TxRef.get(ref), (s) => lens.get(s))

// ─── Conflict Detection ─────────────────────────────

/**
 * Version snapshot — records TxRef versions before a transaction.
 */
export interface VersionSnapshot {
  readonly versions: ReadonlyMap<string, number>
  readonly timestamp: number
}

/**
 * Snapshot current TxRef versions for a set of stores.
 */
export const snapshotVersions = (
  stores: ReadonlyArray<TxStoreDescriptor<unknown>>,
): VersionSnapshot => ({
  versions: new Map(stores.map((s) => [s.id, s.txRef.version])),
  timestamp: Date.now(),
})

/**
 * Check if any TxRef versions diverged beyond what our own
 * transaction would cause.
 *
 * After a successful `Effect.tx()` commit, each written
 * TxRef's version increments by 1. So the expected post-commit
 * version is `snapshot + 1`. If the version jumped by more than 1,
 * an external write occurred concurrently.
 *
 * @param expectedBump - Version increment our commit causes (default: 1)
 * @returns IDs of stores whose versions diverged beyond expected
 */
export const detectConflicts = (
  stores: ReadonlyArray<TxStoreDescriptor<unknown>>,
  snapshot: VersionSnapshot,
  expectedBump: number = 1,
): ReadonlyArray<string> => {
  const conflicted: string[] = []
  for (const store of stores) {
    const snapshotVersion = snapshot.versions.get(store.id)
    if (snapshotVersion !== undefined) {
      const actualBump = store.txRef.version - snapshotVersion
      // Our transaction bumps by `expectedBump`.
      // Anything beyond that is an external write.
      if (actualBump > expectedBump) {
        conflicted.push(store.id)
      }
    }
  }
  return conflicted
}

/**
 * Configuration for conflict-aware transactions.
 */
export interface ConflictPolicy {
  /** Maximum retry attempts before surfacing StxTxConflictError (default: 3) */
  readonly maxRetries?: number
  /** Callback when a conflict is detected (for logging/telemetry) */
  readonly onConflict?: (conflictedIds: ReadonlyArray<string>, attempt: number) => void
}

/**
 * Execute a multi-store transaction with explicit conflict detection.
 *
 * Snapshots TxRef versions before entering the transaction body.
 * After the STM layer commits, checks if versions advanced as
 * expected. If an external write mutated a TxRef between snapshot
 * and commit, retries up to `maxRetries` times.
 *
 * On retry exhaustion, surfaces `StxTxConflictError` with the IDs
 * of conflicting stores and the number of retries attempted.
 *
 * This is layered ON TOP of the STM's native conflict detection —
 * the STM handles intra-transaction conflicts (two transactions
 * racing on the same TxRef), while this catches external writes
 * (non-transactional `family.set()`, CRDT ops, etc.) that bypass
 * the STM journal entirely.
 *
 * @example
 * ```ts
 * conflictAwareTransaction(
 *   [cellDescA, cellDescB],
 *   (refs) => Effect.gen(function*() {
 *     yield* TxRef.set(refs.get("a")!, num(42))
 *     yield* TxRef.set(refs.get("b")!, num(99))
 *   }),
 *   { maxRetries: 3, onConflict: (ids, n) => console.log(`Conflict #${n}: ${ids}`) },
 * )
 * ```
 */
export const conflictAwareTransaction = <A, E>(
  stores: ReadonlyArray<TxStoreDescriptor<unknown>>,
  body: (
    refs: ReadonlyMap<string, TxRef.TxRef<unknown>>,
  ) => Effect.Effect<A, E>,
  policy?: ConflictPolicy,
): Effect.Effect<A, E | StxTxValidationError | StxTxConflictError> => {
  const maxRetries = policy?.maxRetries ?? 3

  const attempt = (retries: number): Effect.Effect<A, E | StxTxValidationError | StxTxConflictError> =>
    Effect.gen(function*() {
      // Snapshot versions before transaction
      const snapshot = snapshotVersions(stores)

      // Execute the real transaction
      const result = yield* multiStoreTransaction(stores, body)

      // Post-commit: check for external conflicts
      const conflicted = detectConflicts(stores, snapshot)

      if (conflicted.length > 0) {
        // Versions diverged — an external write happened
        if (policy?.onConflict) policy.onConflict(conflicted, retries + 1)

        if (retries < maxRetries) {
          // Re-sync atoms from TxRef values (they may have been overwritten)
          Atom.batch(() => {
            for (const store of stores) {
              store.registry.set(store.atom, store.txRef.value)
            }
          })
          // Retry
          return yield* attempt(retries + 1)
        }

        // Exhausted retries
        return yield* Effect.fail(new StxTxConflictError({
          storeIds: [...conflicted],
          retries: retries + 1,
        }))
      }

      return result
    })

  return attempt(0)
}

/**
 * Single-store variant of conflictAwareTransaction.
 */
export const conflictAwareStoreTransaction = <S, A, E>(
  store: TxStoreDescriptor<S>,
  body: (ref: TxRef.TxRef<S>) => Effect.Effect<A, E>,
  policy?: ConflictPolicy,
): Effect.Effect<A, E | StxTxValidationError | StxTxConflictError> =>
  conflictAwareTransaction(
    [store as TxStoreDescriptor<unknown>],
    (refs) => body(refs.get(store.id)! as TxRef.TxRef<S>),
    policy,
  )

/**
 * Get the current TxRef version for a store descriptor.
 * Useful for consumers that want to implement their own
 * optimistic concurrency control.
 */
export const getVersion = (store: TxStoreDescriptor<unknown>): number =>
  store.txRef.version
