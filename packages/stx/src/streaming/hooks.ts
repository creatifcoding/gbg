/**
 * @tmnl/stx — Streaming React hooks
 *
 * Each materializer carries its own registry. These hooks subscribe to atoms
 * via the materializer's registry directly — NOT via RegistryContext.
 *
 * This eliminates the registry mismatch bug where:
 *   - materializer writes to registry A
 *   - useAtomValue reads from RegistryContext (registry B)
 *   - no notifications cross the boundary
 *
 * Uses useSyncExternalStore for tear-free reads — same pattern as
 * @effect/atom-react's useAtomValue but with an explicit registry.
 *
 * @module
 */

import * as React from "react"
import type { Atom, AtomRegistry } from "effect/unstable/reactivity"
import type { StxReduce, StxFeed, StxLatest, StxPullV2, StxDuplex, StxShared } from "./types.js"

// ── Core: useSyncExternalStore bound to a specific registry ─────────────────

const storeCache = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<any>, any>>()

function useAtomFromRegistry<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
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

// ─── useStxReduce ─────────────────────────────────────────────────────────────

export function useStxReduce<S, E = never>(instance: StxReduce<S, unknown, E>) {
  const r = instance.registry
  const state   = useAtomFromRegistry(r, instance.state)
  const loading = useAtomFromRegistry(r, instance.loading)
  const error   = useAtomFromRegistry(r, instance.control.error)
  const done    = useAtomFromRegistry(r, instance.control.done)

  return {
    state,
    loading,
    error,
    done,
    reset:   instance.reset,
    control: instance.control,
    registry: r,
  }
}

// ─── useStxFeed ──────────────────────────────────────────────────────────────

export function useStxFeed<A, E = never>(instance: StxFeed<A, E>) {
  const r = instance.registry
  const items   = useAtomFromRegistry(r, instance.items)
  const count   = useAtomFromRegistry(r, instance.count)
  const loading = useAtomFromRegistry(r, instance.loading)
  const error   = useAtomFromRegistry(r, instance.control.error)
  const done    = useAtomFromRegistry(r, instance.control.done)

  return {
    items,
    count,
    loading,
    error,
    done,
    clear:   instance.clear,
    control: instance.control,
    registry: r,
  }
}

// ─── useStxLatest ────────────────────────────────────────────────────────────

export function useStxLatest<A, E = never>(instance: StxLatest<A, E>) {
  const r = instance.registry
  const value   = useAtomFromRegistry(r, instance.value)
  const loading = useAtomFromRegistry(r, instance.loading)
  const error   = useAtomFromRegistry(r, instance.control.error)
  const done    = useAtomFromRegistry(r, instance.control.done)

  return {
    value,
    loading,
    error,
    done,
    control: instance.control,
    registry: r,
  }
}

// ─── useStxPullV2 ────────────────────────────────────────────────────────────

export function useStxPullV2<A, E = never>(instance: StxPullV2<A, E>) {
  const r = instance.registry
  const items   = useAtomFromRegistry(r, instance.items)
  const cursor  = useAtomFromRegistry(r, instance.cursor)
  const loading = useAtomFromRegistry(r, instance.loading)
  const done    = useAtomFromRegistry(r, instance.done)
  const error   = useAtomFromRegistry(r, instance.error)

  return {
    items,
    cursor,
    loading,
    done,
    error,
    pull:    instance.pull,
    reset:   instance.reset,
    registry: r,
  }
}

// ─── useStxDuplex ────────────────────────────────────────────────────────────

export function useStxDuplex<In, Out, E = never>(instance: StxDuplex<In, Out, E>) {
  const r = instance.registry
  const inbound  = useAtomFromRegistry(r, instance.inbound)
  const outbound = useAtomFromRegistry(r, instance.outbound)
  const loading  = useAtomFromRegistry(r, instance.loading)

  return {
    inbound,
    outbound,
    loading,
    control: instance.control,
    registry: r,
  }
}

// ─── useStxShared ────────────────────────────────────────────────────────────

export function useStxShared<A, E = never>(instance: StxShared<A, E>) {
  return {
    subscribe: instance.subscribe,
    control:   instance.control,
    registry:  instance.registry,
  }
}
