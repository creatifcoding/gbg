/**
 * @tmnl/stx — Family support
 *
 * Wraps Atom.family with STX's autoLens, focus atoms, streaming,
 * and React integration. Each family member gets the full StxInstance
 * treatment — optic lenses, surgical subscriptions, stream-backed reads.
 *
 * The family function is the backbone of any indexed collection:
 * - Datagrid cells: family(cellKey) → Atom<CellValue>
 * - Entity cache: family(entityId) → Atom<Entity>
 * - Channel subscriptions: family(channelId) → Atom<AsyncResult<Message>>
 *
 * Upstream Atom.family provides:
 * - WeakRef cache: same key → same atom (referential equality)
 * - FinalizationRegistry: atom GC'd when no subscribers hold a ref
 * - MutableHashMap: hash-based key lookup
 *
 * STX adds:
 * - autoLens per member (shared across all members of same type)
 * - Focus atom factory per member (memoized per lens path × member key)
 * - Stream access: registry.stream(member(key)) → Stream<A>
 * - Full mutation API: set, setAt, modify per member
 *
 * @module
 * @internal
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as TxRef from "effect/TxRef"
import type { Predicate } from "effect/Predicate"
import { autoLens, type AutoLens } from "./auto-lens.js"
import { createFocusAtom } from "./focus.js"
import type { TxStoreDescriptor } from "./transaction.js"
import type { EntityMeta } from "../types.js"

// ─── Types ──────────────────────────────────────────

/**
 * A family member — an stx-enabled atom for a specific key.
 * Carries all stx ops (lens, focus, set, get) scoped to that member.
 */
export interface StxFamilyMember<K, V> {
  /** The key that identifies this member */
  readonly key: K

  /** The underlying atom */
  readonly atom: Atom.Writable<V, V>

  /** Get current value */
  readonly get: () => V

  /** Set value */
  readonly set: (value: V) => void

  /** Set at a lens path */
  readonly setAt: <A>(lens: { replace: (value: A, state: V) => V }, value: A) => void

  /** Modify at a lens path */
  readonly modify: <A>(
    lens: { modify: (fn: (a: A) => A) => (state: V) => V },
    fn: (a: A) => A,
  ) => void

  /** Get value at a lens path */
  readonly getAt: <A>(lens: { get: (s: V) => A }) => A

  /**
   * Create a memoized focus atom for a lens path on this member.
   * Focus atoms only notify when their targeted value changes.
   */
  readonly focus: <A>(lens: { get: (s: V) => A; _optic: object }) => Atom.Atom<A>

  /**
   * TxStoreDescriptor for this member.
   * Only present when family was created with `{ transactional: true }`.
   * Pass to `storeTransaction()` or `multiStoreTransaction()`.
   */
  readonly descriptor: TxStoreDescriptor<V> | undefined
}

/**
 * An stx family — keyed collection of atoms with shared autoLens.
 *
 * Call with a key to get (or create) the member atom.
 * Same key always returns the same atom reference.
 * Atoms are GC'd when no subscribers hold a reference.
 */
export interface StxFamily<K, V> {
  /**
   * Get (or create) the atom for the given key.
   * Returns the raw atom — use for useAtomValue, registry.stream, etc.
   */
  (key: K): Atom.Writable<V, V>

  /** Shared autoLens tree for all members */
  readonly lens: AutoLens<V>

  /** Registry backing all family members */
  readonly registry: AtomRegistry.AtomRegistry

  /**
   * Get a full StxFamilyMember for a key — with set, setAt, modify, focus.
   * The member is memoized: same key → same member object.
   */
  readonly member: (key: K) => StxFamilyMember<K, V>

  /**
   * Create a focus atom scoped to a specific key + lens path.
   * Shorthand for member(key).focus(lens).
   */
  readonly focus: <A>(key: K, lens: { get: (s: V) => A; _optic: object }) => Atom.Atom<A>

  /**
   * Get current value for a key.
   */
  readonly get: (key: K) => V

  /**
   * Set value for a key.
   */
  readonly set: (key: K, value: V) => void

  /**
   * Modify value for a key at a lens path.
   */
  readonly setAt: <A>(
    key: K,
    lens: { replace: (value: A, state: V) => V },
    value: A,
  ) => void

  /**
   * Whether this family was created with `{ transactional: true }`.
   */
  readonly transactional: boolean

  /**
   * Get the TxStoreDescriptor for a key. Only available when transactional.
   * Returns undefined if not transactional or key not yet materialized.
   */
  readonly descriptor: (key: K) => TxStoreDescriptor<V> | undefined

  /**
   * Get TxStoreDescriptors for multiple keys. For multiStoreTransaction.
   * Only available when transactional.
   */
  readonly descriptors: (keys: readonly K[]) => ReadonlyArray<TxStoreDescriptor<V>>

  /**
   * Create a predicate-filtered view of this family.
   *
   * The view tests each member's current value against the predicate.
   * Use `matches(key)` for single checks, or `filterKeys(keys)` to
   * filter a known set of keys.
   *
   * Works with `Predicate.Struct`, `Predicate.and`, `Predicate.or`, etc.
   *
   * @example
   * ```ts
   * import { Predicate } from 'effect'
   *
   * const activeView = family.where(
   *   Predicate.Struct({ completed: (c: boolean) => !c })
   * )
   *
   * activeView.matches("todo-1")           // boolean
   * activeView.filterKeys(allKeys)          // K[]
   * activeView.getMatching(allKeys)         // V[]
   * ```
   */
  readonly where: (predicate: Predicate<V>) => StxFamilyView<K, V>
}

/**
 * A predicate-filtered view of a family.
 *
 * Does not enumerate keys independently (family is lazy/WeakRef-backed).
 * Accepts a known key set and filters it — consumer provides the key source.
 */
export interface StxFamilyView<K, V> {
  /** The predicate this view applies */
  readonly predicate: Predicate<V>

  /** The underlying family */
  readonly family: StxFamily<K, V>

  /** Check if a single member matches the predicate */
  readonly matches: (key: K) => boolean

  /** Filter a set of keys to only those whose values match the predicate */
  readonly filterKeys: (keys: readonly K[]) => K[]

  /** Get values for all matching keys from a known set */
  readonly getMatching: (keys: readonly K[]) => V[]

  /**
   * Create a derived atom that reactively filters a keys atom.
   * When the keys atom or any member's value changes, the filtered set updates.
   *
   * @example
   * ```ts
   * const allKeysAtom = Atom.make(["k1", "k2", "k3"])
   * const activeKeysAtom = view.filteredKeysAtom(allKeysAtom)
   * // Atom<K[]> — re-derives when keys or member values change
   * ```
   */
  readonly filteredKeysAtom: (keysAtom: Atom.Atom<readonly K[]>) => Atom.Atom<K[]>

  /**
   * Create a derived atom of matching values from a keys atom.
   *
   * @example
   * ```ts
   * const activeItemsAtom = view.matchingAtom(allKeysAtom)
   * // Atom<V[]> — all values from keysAtom that pass the predicate
   * ```
   */
  readonly matchingAtom: (keysAtom: Atom.Atom<readonly K[]>) => Atom.Atom<V[]>
}

// ─── Config ─────────────────────────────────────────

/**
 * Configuration for stxFamily.
 */
export interface StxFamilyConfig {
  /** AtomRegistry to mount atoms into */
  readonly registry?: AtomRegistry.AtomRegistry
  /**
   * When true, each member is backed by a TxRef+Atom pair.
   * Enables `storeTransaction` / `multiStoreTransaction` usage.
   *
   * The immediate API (`set`, `setAt`, `modify`) still goes through
   * the Atom layer for React reactivity. TxRef is the transactional
   * truth used inside `Effect.transaction()` blocks.
   */
  readonly transactional?: boolean
  /**
   * Optional Entity metadata for validation/constraint enforcement
   * inside transactions. Only meaningful when `transactional: true`.
   */
  readonly entityMeta?: EntityMeta
}

// ─── Factory ────────────────────────────────────────

/**
 * Create an stx family — keyed atom collection with autoLens + focus.
 *
 * @param factory - Function that creates the initial value for a new key
 * @param registryOrConfig - AtomRegistry or StxFamilyConfig
 * @returns StxFamily with call signature, lens, focus, member, get, set
 *
 * @example
 * ```ts
 * import { stxFamily } from "@tmnl/stx"
 *
 * // Cell family: cellKey → CellValue atom
 * const cells = stxFamily(
 *   (key: string) => ({ _tag: "Empty" } as CellValue),
 *   registry,
 * )
 *
 * // Transactional family: each member backed by TxRef
 * const txCells = stxFamily(
 *   (key: string) => ({ _tag: "Empty" } as CellValue),
 *   { registry, transactional: true },
 * )
 *
 * // Use in transactions:
 * storeTransaction(txCells.descriptor("0:3")!, body)
 * multiStoreTransaction(txCells.descriptors(["0:3", "1:3"]), body)
 * ```
 */
export function stxFamily<K, V>(
  factory: (key: K) => V,
  registryOrConfig?: AtomRegistry.AtomRegistry | StxFamilyConfig,
): StxFamily<K, V> {
  // Detect: AtomRegistry has `mount`, StxFamilyConfig does not
  const config: StxFamilyConfig = registryOrConfig != null && "mount" in registryOrConfig
    ? { registry: registryOrConfig as AtomRegistry.AtomRegistry }
    : (registryOrConfig as StxFamilyConfig | undefined) ?? {}

  const reg = config.registry ?? AtomRegistry.make()
  const isTx = config.transactional === true
  const entityMeta = config.entityMeta

  // ── TxRef cache (only used when transactional) ─────
  // Keyed by atom identity (stable per Atom.family contract).
  const txRefCache = isTx ? new WeakMap<Atom.Atom<V>, TxRef.TxRef<V>>() : undefined
  const descriptorCache = isTx ? new WeakMap<Atom.Atom<V>, TxStoreDescriptor<V>>() : undefined

  // Upstream Atom.family — WeakRef cache + FinalizationRegistry GC
  const atomFamily = Atom.family((key: K) => {
    const initial = factory(key)
    const atom = Atom.make<V>(initial)
    reg.mount(atom)
    // If transactional, create a paired TxRef
    if (isTx && txRefCache) {
      txRefCache.set(atom, TxRef.makeUnsafe(initial))
    }
    return atom as Atom.Writable<V, V>
  })

  // Shared autoLens — same type V for all members
  const lens = autoLens<V>()

  // Per-member focus atom cache: WeakMap<atom, WeakMap<optic, focusAtom>>
  const focusCaches = new WeakMap<Atom.Atom<V>, WeakMap<object, Atom.Atom<any>>>()

  function getFocusAtom<A>(atom: Atom.Atom<V>, l: { get: (s: V) => A; _optic: object }): Atom.Atom<A> {
    let cache = focusCaches.get(atom)
    if (!cache) {
      cache = new WeakMap()
      focusCaches.set(atom, cache)
    }
    const existing = cache.get(l._optic)
    if (existing) return existing

    const fa = createFocusAtom<V, A>(atom as Atom.Writable<V, V>, l)
    reg.mount(fa)
    cache.set(l._optic, fa)
    return fa
  }

  // ── Descriptor builder ─────────────────────────────

  function getDescriptor(key: K, atom: Atom.Writable<V, V>): TxStoreDescriptor<V> | undefined {
    if (!isTx || !txRefCache || !descriptorCache) return undefined
    const existing = descriptorCache.get(atom)
    if (existing) return existing
    const txRef = txRefCache.get(atom)
    if (!txRef) return undefined
    const desc: TxStoreDescriptor<V> = {
      id: String(key),
      txRef,
      atom,
      registry: reg,
      entityMeta,
    }
    descriptorCache.set(atom, desc)
    return desc
  }

  // Member memoization — piggyback on atom identity
  const memberCache = new WeakMap<Atom.Atom<V>, StxFamilyMember<K, V>>()

  function makeMember(key: K): StxFamilyMember<K, V> {
    const atom = atomFamily(key)
    const existing = memberCache.get(atom)
    if (existing) return existing

    const m: StxFamilyMember<K, V> = {
      key,
      atom,
      get: () => reg.get(atom),
      set: (value) => reg.set(atom, value),
      setAt: (l, value) => reg.set(atom, l.replace(value, reg.get(atom))),
      modify: (l, fn) => reg.set(atom, l.modify(fn)(reg.get(atom))),
      getAt: (l) => l.get(reg.get(atom)),
      focus: (l) => getFocusAtom(atom, l),
      descriptor: getDescriptor(key, atom),
    }

    memberCache.set(atom, m)
    return m
  }

  // Build the family function with attached properties
  const family = ((key: K) => atomFamily(key)) as StxFamily<K, V>

  // ─── where() — predicate-filtered view ──────────────

  function where(predicate: Predicate<V>): StxFamilyView<K, V> {
    const matches = (key: K): boolean => predicate(reg.get(atomFamily(key)))

    const filterKeys = (keys: readonly K[]): K[] =>
      keys.filter((k) => predicate(reg.get(atomFamily(k))))

    const getMatching = (keys: readonly K[]): V[] =>
      keys.reduce<V[]>((acc, k) => {
        const v = reg.get(atomFamily(k))
        if (predicate(v)) acc.push(v)
        return acc
      }, [])

    const filteredKeysAtom = (keysAtom: Atom.Atom<readonly K[]>): Atom.Atom<K[]> => {
      const derived = Atom.readable<K[]>((get) => {
        const keys = get(keysAtom)
        return keys.filter((k) => {
          const v = get(atomFamily(k))
          return predicate(v)
        })
      })
      reg.mount(derived)
      return derived
    }

    const matchingAtom = (keysAtom: Atom.Atom<readonly K[]>): Atom.Atom<V[]> => {
      const derived = Atom.readable<V[]>((get) => {
        const keys = get(keysAtom)
        const result: V[] = []
        for (const k of keys) {
          const v = get(atomFamily(k))
          if (predicate(v)) result.push(v)
        }
        return result
      })
      reg.mount(derived)
      return derived
    }

    return {
      predicate,
      family: family as StxFamily<K, V>,
      matches,
      filterKeys,
      getMatching,
      filteredKeysAtom,
      matchingAtom,
    }
  }

  Object.defineProperties(family, {
    lens: { value: lens, enumerable: true },
    registry: { value: reg, enumerable: true },
    transactional: { value: isTx, enumerable: true },
    member: { value: makeMember, enumerable: true },
    focus: {
      value: <A>(key: K, l: { get: (s: V) => A; _optic: object }) => getFocusAtom(atomFamily(key), l),
      enumerable: true,
    },
    get: { value: (key: K) => reg.get(atomFamily(key)), enumerable: true },
    set: { value: (key: K, value: V) => reg.set(atomFamily(key), value), enumerable: true },
    setAt: {
      value: <A>(key: K, l: { replace: (value: A, state: V) => V }, value: A) => {
        const atom = atomFamily(key)
        reg.set(atom, l.replace(value, reg.get(atom)))
      },
      enumerable: true,
    },
    descriptor: {
      value: (key: K) => getDescriptor(key, atomFamily(key)),
      enumerable: true,
    },
    descriptors: {
      value: (keys: readonly K[]): ReadonlyArray<TxStoreDescriptor<V>> => {
        if (!isTx) return []
        const result: TxStoreDescriptor<V>[] = []
        for (const key of keys) {
          const desc = getDescriptor(key, atomFamily(key))
          if (desc) result.push(desc)
        }
        return result
      },
      enumerable: true,
    },
    where: { value: where, enumerable: true },
  })

  return family
}
