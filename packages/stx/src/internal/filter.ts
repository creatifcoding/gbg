/**
 * @tmnl/stx — Predicate-filtered and Result-gated derived atoms
 *
 * Two complementary primitives:
 *
 * - `createFilterAtom(root, lens, fn)` — projects a subset using a mapping function.
 *   The mapping function typically uses `Array.prototype.filter` with a `Predicate`.
 *   Returns `Atom<B>` — always succeeds, may return empty arrays.
 *
 * - `createWhenAtom(root, lens, predicate, onFailure)` — gates a single value.
 *   Returns `Atom<Result<A, E>>` — Success when predicate passes, Failure when it doesn't.
 *
 * Both use `Atom.readable((get) => ...)` for derived computation with automatic
 * dependency tracking. The AtomRegistry's built-in Object.is comparison prevents
 * unnecessary subscriber notifications.
 *
 * @example
 * ```ts
 * import { Predicate } from 'effect-v4'
 *
 * // filter — projects a subset
 * const activeItems = createFilterAtom(root, lens.items, items =>
 *   items.filter(Predicate.Struct({ completed: (c: boolean) => !c }))
 * )
 *
 * // when — gates a value with Result
 * const validEmail = createWhenAtom(
 *   root, lens.email,
 *   (e) => e.includes('@'),
 *   (e) => `Invalid: ${e}`
 * )
 * ```
 *
 * @module
 * @internal
 */

import { Atom } from "effect-v4/unstable/reactivity"
import * as Result from "effect-v4/Result"
import type { Predicate } from "effect-v4/Predicate"

// ─── Memoization ────────────────────────────────────

/**
 * Two-level cache: root atom → optic object → Map<function, atom>.
 *
 * Level 1: WeakMap<rootAtom, WeakMap<optic, Map<fn, atom>>>
 * Level 2: WeakMap<optic, Map<fn, atom>> (optic is object, safe for WeakMap)
 * Level 3: Map<fn, atom> (function identity for project/predicate)
 *
 * For `when()` atoms we composite-key on `predicate + onFailure` identities.
 */
const filterCache = new WeakMap<
  Atom.Atom<any>,
  WeakMap<object, Map<Function, Atom.Atom<any>>>
>()

/**
 * Get or create a memoized derived atom keyed by (root, optic, fn).
 * `fn` is the function identity (project for filter, predicate for when).
 */
function getCachedOrCreate<A>(
  root: Atom.Atom<any>,
  optic: object,
  fn: Function,
  factory: () => Atom.Atom<A>,
): Atom.Atom<A> {
  let opticMap = filterCache.get(root)
  if (!opticMap) {
    opticMap = new WeakMap()
    filterCache.set(root, opticMap)
  }
  let fnMap = opticMap.get(optic)
  if (!fnMap) {
    fnMap = new Map()
    opticMap.set(optic, fnMap)
  }
  const existing = fnMap.get(fn)
  if (existing) return existing as Atom.Atom<A>
  const atom = factory()
  fnMap.set(fn, atom)
  return atom
}

// ─── createFilterAtom ───────────────────────────────

/**
 * Create a derived atom that applies a mapping/filter function to a focused value.
 *
 * The `project` function receives the focused value and returns a transformed value.
 * Typically used with `Array.prototype.filter` + `Predicate.Struct`/`Predicate.and`.
 *
 * The atom re-derives when the root atom changes. AtomRegistry's Object.is comparison
 * on the output prevents unnecessary subscriber notifications (but note: `Array.filter`
 * always creates a new array reference — use `stableFilter` for reference-stable filtering).
 *
 * @param root - Root state atom
 * @param lens - autoLens path to the source value
 * @param project - Mapping function (e.g. `items => items.filter(pred)`)
 * @returns Read-only derived Atom<B>
 */
export function createFilterAtom<S, A, B>(
  root: Atom.Atom<S>,
  lens: { get: (state: S) => A; _optic: object },
  project: (value: A) => B,
): Atom.Atom<B> {
  return getCachedOrCreate(root, lens._optic, project, () =>
    Atom.readable<B>((get) => project(lens.get(get(root))))
  )
}

// ─── createWhenAtom ─────────────────────────────────

/**
 * Create a derived atom that gates a focused value with a predicate.
 *
 * - Predicate passes → `Result.succeed(value)`
 * - Predicate fails → `Result.fail(onFailure(value))`
 *
 * Consumer decides how to handle rejection — display error, show stale, fallback.
 *
 * Uses `Result.liftPredicate` internally — the canonical Effect v4 pattern for
 * converting a predicate check into a `Result`.
 *
 * @param root - Root state atom
 * @param lens - autoLens path to the value to gate
 * @param predicate - Guard function (value) => boolean
 * @param onFailure - Error factory (value) => E, called when predicate rejects
 * @returns Read-only derived Atom<Result<A, E>>
 */
export function createWhenAtom<S, A, E>(
  root: Atom.Atom<S>,
  lens: { get: (state: S) => A; _optic: object },
  predicate: Predicate<NoInfer<A>>,
  onFailure: (value: A) => E,
): Atom.Atom<Result.Result<A, E>> {
  // Composite key: predicate identity drives memoization.
  // Same predicate + same optic = same derived atom.
  return getCachedOrCreate(root, lens._optic, predicate, () =>
    Atom.readable<Result.Result<A, E>>((get) => {
      const value = lens.get(get(root))
      return Result.liftPredicate(value, predicate, onFailure)
    })
  )
}
