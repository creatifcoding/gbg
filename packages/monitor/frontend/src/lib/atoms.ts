/**
 * UI state atoms for getbymonitor.
 *
 * Effect v4 ships Atom/AtomRegistry in effect/unstable/reactivity. React uses a
 * tiny useSyncExternalStore bridge here; no legacy atom packages.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { Atom, AtomRegistry } from 'effect/unstable/reactivity'

export const atomRegistry = AtomRegistry.make()

type WritableAtom<T> = Atom.Writable<T, T>
type AtomSetter<T> = (next: T | ((prev: T) => T)) => void

export function useAtomValue<T>(atom: Atom.Atom<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => atomRegistry.subscribe(atom, onStoreChange),
    [atom],
  )
  const getSnapshot = useCallback(() => atomRegistry.get(atom), [atom])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useAtomSet<T>(atom: WritableAtom<T>): AtomSetter<T> {
  return useCallback(
    (next) => {
      const value = typeof next === 'function'
        ? (next as (prev: T) => T)(atomRegistry.get(atom))
        : next
      atomRegistry.set(atom, value)
    },
    [atom],
  )
}

export function useAtom<T>(atom: WritableAtom<T>): readonly [T, AtomSetter<T>] {
  return [useAtomValue(atom), useAtomSet(atom)]
}
// ── Session selection ──────────────────────────────────────────────────────

/** The currently selected session ID, or null if none. */
export const selectedSessionIdAtom = Atom.make<string | null>(null)

// ── Node selection (within the graph) ─────────────────────────────────────

/** The currently selected node ID in the causal graph. */
export const selectedNodeIdAtom = Atom.make<string | null>(null)

// ── Right-panel mode ───────────────────────────────────────────────────────

export type DetailPanelMode = 'data' | 'information' | 'intelligence' | 'knowledge' | 'wisdom'

/** Which DIIKW layer is active in the right detail panel. */
export const detailPanelModeAtom = Atom.make<DetailPanelMode>('information')

// ── Graph layout toggles ───────────────────────────────────────────────────

/** Show node labels in the graph. */
export const showNodeLabelsAtom = Atom.make(true)

/** Show edge labels in the graph. */
export const showEdgeLabelsAtom = Atom.make(false)

/** Keep selected RCA branches readable by dimming unrelated graph context. */
export const focusNeighboursAtom = Atom.make(true)

// ── Evidence filter ────────────────────────────────────────────────────────

/** Filter evidence to only show items linked to the selected node. */
export const evidenceFilterNodeAtom = Atom.make(true)

// ── Derived: whether a session is active ──────────────────────────────────

export const hasActiveSessionAtom = Atom.make(
  (get) => get(selectedSessionIdAtom) !== null,
)

// ── Derived: whether a node is selected ───────────────────────────────────

export const hasSelectedNodeAtom = Atom.make(
  (get) => get(selectedNodeIdAtom) !== null,
)

// ── Harness panel ──────────────────────────────────────────────────────────

/** Whether the bottom harness prompt panel is expanded. */
export const harnessExpandedAtom = Atom.make(false)
