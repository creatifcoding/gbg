/**
 * @tmnl/stx — Core factory
 *
 * `stx(initial)` creates a reactive state container with:
 * - Root `Atom<S>` (single source of truth)
 * - `autoLens<S>()` tree (class-aware optic composition)
 * - `focus()` factory (memoized derived atoms)
 * - `set()`, `setAt()`, `modify()` (registry-backed mutations)
 *
 * Works with ANY shape: plain objects, Schema.TaggedClass,
 * Schema.TaggedStruct, Schema.Class, or arbitrary classes.
 *
 * **Entity-aware**: When created from an Entity instance, stx()
 * auto-detects field metadata and constrains behavior:
 * - readonly/computed fields → setAt/modify throws
 * - generated fields → setAt/modify throws
 * - sensitive fields → redacted in debugSnapshot
 * - set() validates through the Entity's select schema
 *
 * @example
 * ```ts
 * import { stx } from "@tmnl/stx"
 * import { Schema } from "effect"
 *
 * class AppState extends Schema.TaggedClass<AppState>()("AppState", {
 *   count: Schema.Number,
 *   user: Schema.Struct({ name: Schema.String }),
 * }) {
 *   get doubled() { return this.count * 2 }
 * }
 *
 * const store = stx(new AppState({ count: 0, user: { name: "Alice" } }))
 *
 * // Optic access — builds lazily
 * store.lens.user.name.get(store.get())  // "Alice"
 *
 * // Surgical update — only name-subscribers fire
 * store.setAt(store.lens.user.name, "Bob")
 *
 * // Focus atom — surgical subscription
 * const nameAtom = store.focus(store.lens.user.name)
 *
 * // Class preserved
 * store.get() instanceof AppState  // true
 * store.get().doubled              // 0
 * ```
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as Result from "effect/Result"
import { autoLens } from "./internal/auto-lens.js"
import { createFocusAtom } from "./internal/focus.js"
import { createFilterAtom, createWhenAtom } from "./internal/filter.js"
import type { StxInstance, EntityMeta, StxError } from "./types.js"
import { StxValidationError, StxConstraintError } from "./types.js"

// ─── Entity Detection ────────────────────────────────────────

/**
 * Symbol for reading the lens path (first property access).
 * Attached to autoLens children by the Proxy.
 * @internal
 */
export const LENS_PATH = Symbol.for('@tmnl/stx/lensPath')

/**
 * Kinds that forbid mutations via setAt/modify.
 */
const READONLY_KINDS = new Set(['readonly', 'computed', 'generated'])

/**
 * Detect Entity-like class instances by checking constructor.fieldMeta.
 * Returns EntityMeta if detected, undefined otherwise.
 *
 * This is interface detection — STX never imports @tmnl/entity.
 * @internal
 */
function detectEntity(value: unknown): EntityMeta | undefined {
  if (!value || typeof value !== 'object') return undefined
  const ctor = (value as any).constructor
  if (!ctor) return undefined
  const fieldMeta = ctor.fieldMeta
  const entityTag = ctor.entityTag
  if (!fieldMeta || typeof fieldMeta !== 'object' || !entityTag) return undefined
  // It's an Entity instance
  return {
    tag: entityTag as string,
    fieldMeta: fieldMeta as Record<string, string>,
    validate: ctor.validate,
  }
}

/**
 * Extract the top-level field name from a lens (if annotated).
 * Returns undefined for the root lens or unannotated lenses.
 * @internal
 */
function getLensFieldName(lens: any): string | undefined {
  return lens?.[LENS_PATH]
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create an stx instance.
 *
 * @param initial - Initial state value (any shape — plain object, class instance, etc.)
 * @param registry - Optional AtomRegistry (creates one if not provided)
 * @returns StxInstance with atom, lens, focus, set, setAt, modify, get, getAt
 */
export function stx<S>(
  initial: S,
  registry?: AtomRegistry.AtomRegistry,
): StxInstance<S> {
  const reg = registry ?? AtomRegistry.make()
  const atom = Atom.make<S>(initial)

  // Mount the root atom
  reg.mount(atom)

  // Entity detection
  const entityMeta = detectEntity(initial)

  // Shared lens tree (memoized internally) — annotated with path for Entity constraint checks
  const baseLens = autoLens<S>()
  const lens = entityMeta ? annotatedLens<S>(baseLens) : baseLens

  // Focus factory
  const focus = <A>(l: { get: (s: S) => A; _optic: object }): Atom.Atom<A> => {
    const fa = createFocusAtom<S, A>(atom, l)
    reg.mount(fa)
    return fa
  }

  // State reads
  const get = (): S => reg.get(atom)
  const getAt = <A>(l: { get: (s: S) => A }): A => l.get(reg.get(atom))

  // ─── Derived atoms (filter + when) ─────────────────

  const filter = <A, B>(
    l: { get: (s: S) => A; _optic: object },
    project: (value: A) => B,
  ): Atom.Atom<B> => {
    const fa = createFilterAtom<S, A, B>(atom, l, project)
    reg.mount(fa)
    return fa
  }

  const when = <A, E>(
    l: { get: (s: S) => A; _optic: object },
    predicate: (a: A) => boolean,
    onFailure: (value: A) => E,
  ): Atom.Atom<Result.Result<A, E>> => {
    const wa = createWhenAtom<S, A, E>(atom, l, predicate, onFailure)
    reg.mount(wa)
    return wa
  }

  // State writes — with Entity constraint enforcement
  // ─── Constraint check (shared by throw + Result variants) ───

  const checkConstraint = (l: any): StxConstraintError | null => {
    if (!entityMeta) return null
    const fieldName = getLensFieldName(l)
    if (!fieldName) return null
    const kind = entityMeta.fieldMeta[fieldName]
    if (kind && READONLY_KINDS.has(kind)) {
      return new StxConstraintError(fieldName, kind, entityMeta.tag)
    }
    return null
  }

  // ─── Fire-and-forget mutations (throw on error) ────

  const set = (value: S): void => {
    if (entityMeta?.validate) {
      const result = entityMeta.validate.select(value)
      if (Result.isFailure(result)) {
        throw new Error(`[STX] Entity validation failed: ${result.failure.issues.join(', ')}`)
      }
    }
    reg.set(atom, value)
  }

  const setAt = <A>(
    l: { replace: (value: A, state: S) => S },
    value: A,
  ): void => {
    const err = checkConstraint(l)
    if (err) throw new Error(`[STX] ${err.message}`)
    reg.set(atom, l.replace(value, reg.get(atom)))
  }

  const modify = <A>(
    l: { modify: (fn: (a: A) => A) => (state: S) => S },
    fn: (a: A) => A,
  ): void => {
    const err = checkConstraint(l)
    if (err) throw new Error(`[STX] ${err.message}`)
    reg.set(atom, l.modify(fn)(reg.get(atom)))
  }

  // ─── Result-returning mutations (composable) ───────

  const trySet = (value: S): Result.Result<S, StxValidationError> => {
    if (entityMeta?.validate) {
      const result = entityMeta.validate.select(value)
      if (Result.isFailure(result)) {
        return Result.fail(
          new StxValidationError(result.failure.issues, entityMeta.tag)
        )
      }
    }
    reg.set(atom, value)
    return Result.succeed(value)
  }

  const trySetAt = <A>(
    l: { replace: (value: A, state: S) => S },
    value: A,
  ): Result.Result<void, StxConstraintError> => {
    const err = checkConstraint(l)
    if (err) return Result.fail(err)
    reg.set(atom, l.replace(value, reg.get(atom)))
    return Result.succeed(undefined as void)
  }

  const tryModify = <A>(
    l: { modify: (fn: (a: A) => A) => (state: S) => S },
    fn: (a: A) => A,
  ): Result.Result<void, StxConstraintError> => {
    const err = checkConstraint(l)
    if (err) return Result.fail(err)
    reg.set(atom, l.modify(fn)(reg.get(atom)))
    return Result.succeed(undefined as void)
  }

  // Debug snapshot — redacts sensitive fields
  const debugSnapshot = entityMeta
    ? () => {
        const state = reg.get(atom) as any
        const snapshot: Record<string, any> = {}
        for (const [key, value] of Object.entries(state)) {
          if (entityMeta.fieldMeta[key] === 'sensitive') {
            snapshot[key] = '[REDACTED]'
          } else {
            snapshot[key] = value
          }
        }
        return snapshot
      }
    : undefined

  return {
    atom, lens, focus,
    set, setAt, modify,
    trySet, trySetAt, tryModify,
    filter, when,
    get, getAt,
    registry: reg,
    entityMeta,
    debugSnapshot,
  }
}

// ─── Annotated Lens ──────────────────────────────────────────

/**
 * Wrap an autoLens proxy to annotate top-level children with their path.
 * `store.lens.score[LENS_PATH]` → 'score'
 *
 * Only annotates the first level — deeper paths carry the root field name.
 * @internal
 */
function annotatedLens<S>(baseLens: any): any {
  const cache = new Map<string | symbol, any>()

  return new Proxy(baseLens, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        // Pass through LENS_PATH for root (undefined) and other symbols
        return target[prop]
      }

      if (!cache.has(prop)) {
        const child = target[prop]
        // Wrap child to carry the field name
        const annotated = new Proxy(child, {
          get(childTarget: any, childProp: string | symbol) {
            if (childProp === LENS_PATH) return prop
            return childTarget[childProp]
          },
        })
        cache.set(prop, annotated)
      }
      return cache.get(prop)
    },
  })
}
