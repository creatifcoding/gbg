/**
 * @tmnl/stx — Focus atoms: surgical derived atoms from autoLens paths
 *
 * A focus atom reads a specific path from a root atom via an autoLens.
 * It only notifies subscribers when that specific value changes (Object.is).
 *
 * Focus atoms are memoized: the same lens path on the same root atom
 * always returns the same derived Atom instance.
 *
 * @example
 * ```ts
 * const root = Atom.make({ user: { name: "Alice", level: 42 }, count: 0 })
 * const lens = autoLens<typeof root>()
 *
 * const nameAtom = createFocusAtom(root, lens.user.name)
 * // nameAtom only fires when user.name changes
 * // Changing count → no notification to nameAtom
 * ```
 *
 * @module
 * @internal
 */

import { Atom } from "effect-v4/unstable/reactivity"

// ─── Memoization ────────────────────────────────────

/**
 * Focus atom cache: keyed by root atom → WeakMap of raw optic → derived Atom.
 *
 * WeakMap on the raw optic object prevents memory leaks:
 * when the optic is GC'd, so is the derived atom.
 *
 * Outer Map keyed by root atom identity (stable — created once).
 */
const focusCache = new WeakMap<
  Atom.Atom<any>,
  WeakMap<object, Atom.Atom<any>>
>()

// ─── Factory ────────────────────────────────────────

/**
 * Create or retrieve a memoized focus atom.
 *
 * The focus atom is a derived `Atom.make((get) => lens.get(get(root)))`.
 * AtomRegistry's Object.is comparison ensures it only fires on actual changes.
 *
 * @param root - Root state atom
 * @param lens - An autoLens path (must have `.get()` and `._optic`)
 * @returns Derived Atom that tracks the focused value
 */
export function createFocusAtom<S, A>(
  root: Atom.Atom<S>,
  lens: { get: (state: S) => A; _optic: object },
): Atom.Atom<A> {
  // Get or create the per-root cache
  let opticMap = focusCache.get(root)
  if (!opticMap) {
    opticMap = new WeakMap()
    focusCache.set(root, opticMap)
  }

  // Check for existing focus atom
  const rawOptic = lens._optic
  const existing = opticMap.get(rawOptic)
  if (existing) return existing as Atom.Atom<A>

  // Create new derived atom
  const focusAtom = Atom.make<A>((get) => lens.get(get(root)))

  // Cache it
  opticMap.set(rawOptic, focusAtom)

  return focusAtom
}
