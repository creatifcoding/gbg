/**
 * @tmnl/stx — React hooks
 *
 * useAtomValue uses useSyncExternalStore bound to an explicit registry —
 * NO dependency on RegistryContext. The materializer's registry is the
 * single source of truth.
 *
 * This eliminates the class of bugs where RegistryContext resolves to a
 * different registry than the one the materializer writes to (module
 * identity mismatch in Vite, missing Provider, etc.).
 *
 * API: useAtomValue(registry, atom) → value
 *
 * @module
 */

import * as React from "react"
import { AtomRegistry as AR } from "effect-v4/unstable/reactivity"
import type { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import type { StxInstance } from "./types.js"
import type { StxAsync, StxPull } from "./internal/async.js"
import type { StxFamily, StxFamilyMember } from "./internal/family.js"

// ─── Core: useSyncExternalStore bound to explicit registry ──────────────────

const storeCache = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<any>, any>>()

/**
 * Global default registry for one-arg useAtomValue(atom) calls.
 * registry.get auto-mounts atoms on first access.
 */
const globalDefaultRegistry = AR.make()

/**
 * Subscribe to an atom's value via useSyncExternalStore.
 *
 * Two-arg form: useAtomValue(registry, atom) — explicit registry, recommended.
 * One-arg form:  useAtomValue(atom) — uses the atom's own registry via
 *   globalDefaultRegistry. Works for atoms created by stx() / stxFamily()
 *   where the registry is known at atom creation time.
 *
 * @returns Current value (re-renders on change)
 */
export function useAtomValue<A>(atom: Atom.Atom<A>): A
export function useAtomValue<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A
export function useAtomValue<A>(registryOrAtom: AtomRegistry.AtomRegistry | Atom.Atom<A>, maybeAtom?: Atom.Atom<A>): A {
  const [registry, atom] = maybeAtom !== undefined
    ? [registryOrAtom as AtomRegistry.AtomRegistry, maybeAtom]
    : [globalDefaultRegistry, registryOrAtom as Atom.Atom<A>]
  const store = React.useMemo(() => {
    let stores = storeCache.get(registry)
    if (!stores) {
      stores = new WeakMap()
      storeCache.set(registry, stores)
    }
    const existing = stores.get(atom)
    if (existing) return existing
    const s = {
      subscribe: (f: () => void) => registry.subscribe(atom, f),
      snapshot: () => registry.get(atom),
    }
    stores.set(atom, s)
    return s
  }, [registry, atom])

  return React.useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

// ─── useStx: full instance hook ─────────────────────

export function useStx<S>(instance: StxInstance<S>) {
  const value = useAtomValue(instance.registry, instance.atom)

  return {
    value,
    lens: instance.lens,
    focus: instance.focus,
    setAt: instance.setAt,
    modify: instance.modify,
    set: instance.set,
    getAt: instance.getAt,
    registry: instance.registry,
  }
}

// ─── useFocus: surgical subscription ────────────────

export function useFocus<S, A>(
  instance: StxInstance<S>,
  lens: { get: (s: S) => A; _optic: object },
): A {
  const focusAtom = React.useMemo(
    () => instance.focus(lens),
    [instance, lens],
  )
  return useAtomValue(instance.registry, focusAtom)
}

// ─── useStxSet: write-only hook ─────────────────────

export function useStxSet<S>(instance: StxInstance<S>) {
  return {
    set: instance.set,
    setAt: instance.setAt,
    modify: instance.modify,
    lens: instance.lens,
  }
}

// ─── useStxAsync: streaming subscription ────────────

export function useStxAsync<A, E>(instance: StxAsync<A, E>) {
  const r = instance.registry
  const value = useAtomValue(r, instance.value)
  const loading = useAtomValue(r, instance.loading)
  const error = useAtomValue(r, instance.error)

  return {
    value,
    loading,
    error,
    lens: instance.lens,
    focus: instance.focus,
    refresh: instance.refresh,
    registry: r,
  }
}

// ─── useFocusAsync: surgical async subscription ─────

export function useFocusAsync<A, E, B>(
  instance: StxAsync<A, E>,
  lens: { get: (s: A) => B; _optic: object },
): B | undefined {
  const focusAtom = React.useMemo(
    () => instance.focus(lens),
    [instance, lens],
  )
  return useAtomValue(instance.registry, focusAtom)
}

// ─── useStxPull: pull-based streaming ───────────────

export function useStxPull<A, E>(instance: StxPull<A, E>) {
  const r = instance.registry
  const items = useAtomValue(r, instance.items)
  const done = useAtomValue(r, instance.done)
  const loading = useAtomValue(r, instance.loading)
  const error = useAtomValue(r, instance.error)

  return {
    items,
    done,
    loading,
    error,
    pull: instance.pull,
    registry: r,
  }
}

// ─── useFamily: keyed atom subscription ─────────────

export function useFamily<K, V>(
  family: StxFamily<K, V>,
  key: K,
) {
  const atom = React.useMemo(() => family(key), [family, key])
  const value = useAtomValue(family.registry, atom)
  const memberRef = React.useRef<StxFamilyMember<K, V> | null>(null)

  if (memberRef.current === null || memberRef.current.key !== key) {
    memberRef.current = family.member(key)
  }
  const member = memberRef.current

  return {
    value,
    set: member.set,
    setAt: member.setAt,
    modify: member.modify,
    getAt: member.getAt,
    lens: family.lens,
    member,
    atom,
    registry: family.registry,
  }
}

// ─── useFamilyFocus: surgical family subscription ───

export function useFamilyFocus<K, V, A>(
  family: StxFamily<K, V>,
  key: K,
  lens: { get: (s: V) => A; _optic: object },
): A {
  const focusAtom = React.useMemo(
    () => family.focus(key, lens),
    [family, key, lens],
  )
  return useAtomValue(family.registry, focusAtom)
}
