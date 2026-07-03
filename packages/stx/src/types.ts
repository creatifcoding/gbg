/**
 * @tmnl/stx — Core types
 *
 * @module
 */

import type { Atom, AtomRegistry } from "effect/unstable/reactivity"
import type * as Result from "effect/Result"
import type { Predicate } from "effect/Predicate"
import type { AutoLens } from "./internal/auto-lens.js"

// ─── STX Errors ─────────────────────────────────────

/**
 * Validation failure — entity schema rejected the value.
 *
 * Wraps issues from Schema decode. Composable via Result pipeline:
 * `Result.flatMap`, `Result.gen`, `Result.filterOrFail`, etc.
 */
export class StxValidationError {
  readonly _tag = 'StxValidationError' as const
  constructor(
    /** Validation issue messages */
    readonly issues: readonly string[],
    /** Entity tag (if available) */
    readonly entityTag?: string,
  ) {}
  get message(): string {
    const prefix = this.entityTag ? `[${this.entityTag}] ` : ''
    return `${prefix}Validation failed: ${this.issues.join(', ')}`
  }
}

/**
 * Constraint violation — attempted mutation of a readonly/computed/generated field.
 */
export class StxConstraintError {
  readonly _tag = 'StxConstraintError' as const
  constructor(
    /** Field name that was targeted */
    readonly field: string,
    /** Field kind (readonly, computed, generated) */
    readonly kind: string,
    /** Entity tag */
    readonly entityTag: string,
  ) {}
  get message(): string {
    return `Cannot mutate ${this.kind} field '${this.field}' on Entity '${this.entityTag}'`
  }
}

/**
 * Union of all STX error types for Result channels.
 */
export type StxError = StxValidationError | StxConstraintError

// ─── Entity Metadata ────────────────────────────────

/**
 * Entity metadata detected by stx() via interface detection.
 * No hard dependency on @tmnl/entity — uses duck typing.
 *
 * Validators now return `Result<A, E>` (Effect v4 canonical).
 */
export interface EntityMeta {
  /** Entity tag name (e.g. 'Todo', 'Task') */
  readonly tag: string
  /** Field kind map — field name → kind (data, generated, readonly, computed, sensitive, timestamp) */
  readonly fieldMeta: Record<string, string>
  /** Variant validators (if available) — returns Result<A, SchemaError> */
  readonly validate?: {
    readonly select: (data: unknown) => Result.Result<unknown, { readonly issues: readonly string[] }>
    readonly insert?: (data: unknown) => Result.Result<unknown, { readonly issues: readonly string[] }>
    readonly update?: (data: unknown) => Result.Result<unknown, { readonly issues: readonly string[] }>
  }
}

// ─── Stx Instance ───────────────────────────────────

/**
 * A live stx instance — root atom + autoLens + focus factory.
 *
 * Works with ANY shape: plain objects, Schema.TaggedClass,
 * Schema.TaggedStruct, Schema.Class, or arbitrary classes.
 *
 * When created from an Entity instance, stx() auto-detects field metadata
 * and constrains behavior (readonly protection, validation, debug redaction).
 *
 * @typeParam S - Root state type
 */
export interface StxInstance<S> {
  /** Root state atom — single source of truth */
  readonly atom: Atom.Writable<S, S>

  /** AutoLens tree — property access builds optic chains */
  readonly lens: AutoLens<S>

  /**
   * Create a memoized focus atom for a specific lens path.
   * Focus atoms only notify when their targeted value changes.
   *
   * @example
   * ```ts
   * const nameAtom = store.focus(store.lens.user.name)
   * // Only fires when user.name changes
   * ```
   */
  readonly focus: <A>(lens: { get: (s: S) => A; _optic: object }) => Atom.Atom<A>

  // ─── Fire-and-forget mutations (throw on error) ─────

  /**
   * Set root state (full replace). Throws on Entity validation failure.
   */
  readonly set: (value: S) => void

  /**
   * Replace a value at a lens path (class-aware). Throws on readonly constraint.
   */
  readonly setAt: <A>(lens: { replace: (value: A, state: S) => S }, value: A) => void

  /**
   * Modify a value at a lens path with a function (class-aware). Throws on readonly constraint.
   */
  readonly modify: <A>(
    lens: { modify: (fn: (a: A) => A) => (state: S) => S },
    fn: (a: A) => A,
  ) => void

  // ─── Result-returning mutations (composable) ────────

  /**
   * Set root state, returning Result instead of throwing.
   *
   * For non-Entity stores, always succeeds.
   * For Entity stores, validates through the Entity's select schema.
   *
   * @example
   * ```ts
   * import { Result } from 'effect'
   *
   * const r = store.trySet(nextState)
   * Result.match(r, {
   *   onSuccess: (s) => toast('Saved'),
   *   onFailure: (e) => toast.error(e.message),
   * })
   * ```
   */
  readonly trySet: (value: S) => Result.Result<S, StxValidationError>

  /**
   * Replace a value at a lens path, returning Result.
   *
   * Fails with StxConstraintError for readonly/computed/generated fields.
   *
   * @example
   * ```ts
   * const r = store.trySetAt(store.lens.user.name, "Bob")
   * // Result<void, StxConstraintError>
   * ```
   */
  readonly trySetAt: <A>(
    lens: { replace: (value: A, state: S) => S },
    value: A,
  ) => Result.Result<void, StxConstraintError>

  /**
   * Modify a value at a lens path with a function, returning Result.
   *
   * Fails with StxConstraintError for readonly/computed/generated fields.
   *
   * @example
   * ```ts
   * const r = store.tryModify(store.lens.counter, n => n + 1)
   * // Result<void, StxConstraintError>
   * ```
   */
  readonly tryModify: <A>(
    lens: { modify: (fn: (a: A) => A) => (state: S) => S },
    fn: (a: A) => A,
  ) => Result.Result<void, StxConstraintError>

  // ─── Derived atoms (filter + when) ───────────────────

  /**
   * Create a derived atom that applies a projection/filter function to a focused value.
   *
   * Typically used with `Array.prototype.filter` + `Predicate.Struct` / `Predicate.and`.
   * Returns `Atom<B>` — always succeeds, may return empty arrays.
   *
   * @example
   * ```ts
   * import { Predicate } from 'effect'
   *
   * const isActive = Predicate.Struct({ completed: (c: boolean) => !c })
   * const activeItems = store.filter(store.lens.items, items => items.filter(isActive))
   * // Atom<Todo[]>
   * ```
   */
  readonly filter: <A, B>(
    lens: { get: (s: S) => A; _optic: object },
    project: (value: A) => B,
  ) => Atom.Atom<B>

  /**
   * Create a derived atom that gates a focused value with a predicate.
   *
   * Success when predicate passes, Failure when it doesn't.
   * Consumer decides how to handle rejection.
   *
   * Uses `Result.liftPredicate` internally — the canonical Effect v4 pattern.
   *
   * @example
   * ```ts
   * const validEmail = store.when(
   *   store.lens.user.email,
   *   (email) => email.includes('@'),
   *   (email) => `Invalid: ${email}`
   * )
   * // Atom<Result<string, string>>
   * ```
   */
  readonly when: <A, E>(
    lens: { get: (s: S) => A; _optic: object },
    predicate: Predicate<NoInfer<A>>,
    onFailure: (value: A) => E,
  ) => Atom.Atom<Result.Result<A, E>>

  // ─── Reads ──────────────────────────────────────────

  /**
   * Get current state snapshot.
   */
  readonly get: () => S

  /**
   * Get value at a lens path.
   */
  readonly getAt: <A>(lens: { get: (s: S) => A }) => A

  // ─── Infrastructure ─────────────────────────────────

  /**
   * The AtomRegistry powering this instance.
   * Use for direct mount/subscribe/get/set operations.
   */
  readonly registry: AtomRegistry.AtomRegistry

  /**
   * Entity metadata — present when stx() detects an Entity instance.
   * Contains field kinds, tag name, and validators.
   *
   * Undefined for plain objects / non-Entity classes.
   */
  readonly entityMeta?: EntityMeta

  /**
   * Debug snapshot — returns current state with sensitive fields redacted.
   * Only available when created from an Entity instance with sensitive fields.
   */
  readonly debugSnapshot?: () => Record<string, unknown>
}
