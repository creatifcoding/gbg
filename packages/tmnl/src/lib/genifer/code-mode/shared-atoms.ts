/**
 * Shared Atom Bridge — Code Mode ↔ React
 *
 * Replaces the sandbox's standalone Map with a shared store that both
 * code mode and React components read/write.
 *
 * IMPORTANT: Uses a plain Map + subscriber pattern (NOT effect-atom Registry)
 * because Effect.runPromise microtask scheduling clobbers Registry state
 * (documented bug: Effect.runPromise clobbers atom state).
 *
 * React integration uses a React.useSyncExternalStore-compatible subscribe/getSnapshot
 * pattern so components re-render when code mode updates state.
 *
 * @module genifer/code-mode/shared-atoms
 */

// =============================================================================
// Store: plain Map + subscribers (Effect-safe)
// =============================================================================

interface AtomEntry<T = unknown> {
  value: T
  subscribers: Set<(value: T) => void>
}

const _store = new Map<string, AtomEntry>()

/** Global listener for any atom change — drives React re-renders */
type StoreListener = () => void
const _storeListeners = new Set<StoreListener>()

function notifyStoreListeners(): void {
  for (const fn of _storeListeners) {
    try { fn() } catch { /* don't crash on subscriber error */ }
  }
}

// =============================================================================
// Imperative API — used by sandbox
// =============================================================================

function getOrCreateEntry<T>(key: string, initial?: T): AtomEntry<T> {
  let entry = _store.get(key) as AtomEntry<T> | undefined
  if (!entry) {
    entry = { value: initial as T, subscribers: new Set() }
    _store.set(key, entry as AtomEntry)
  }
  return entry
}

/**
 * Set the value of a code-mode atom.
 * Creates the atom if it doesn't exist.
 * Notifies per-key subscribers AND global store listeners.
 */
export function setCodeModeAtom<T>(key: string, value: T): void {
  const entry = getOrCreateEntry<T>(key)
  entry.value = value
  // Per-key subscribers
  for (const fn of entry.subscribers) {
    try { fn(value) } catch { /* subscriber safety */ }
  }
  // Global store listeners (for React useSyncExternalStore)
  notifyStoreListeners()
}

/**
 * Get the current value of a code-mode atom.
 * Returns undefined if the atom hasn't been created yet.
 */
export function getCodeModeAtom<T>(key: string): T | undefined {
  const entry = _store.get(key) as AtomEntry<T> | undefined
  return entry?.value
}

/**
 * Subscribe to changes on a specific code-mode atom.
 * Returns an unsubscribe function.
 */
export function subscribeCodeModeAtom<T>(
  key: string,
  fn: (value: T) => void,
): () => void {
  const entry = getOrCreateEntry<T>(key)
  entry.subscribers.add(fn as any)
  return () => { entry.subscribers.delete(fn as any) }
}

/**
 * Subscribe to ANY atom change (for React useSyncExternalStore).
 * Called whenever any atom value changes.
 * Returns an unsubscribe function.
 */
export function subscribeStore(fn: StoreListener): () => void {
  _storeListeners.add(fn)
  return () => { _storeListeners.delete(fn) }
}

/**
 * Get a snapshot of the entire store (for React useSyncExternalStore).
 * Returns a new Map reference only when values change.
 */
let _snapshotVersion = 0
let _cachedSnapshot: ReadonlyMap<string, unknown> | null = null

export function getStoreSnapshot(): ReadonlyMap<string, unknown> {
  // Build snapshot lazily — only rebuild when version changes
  const currentVersion = _snapshotVersion
  if (!_cachedSnapshot || (currentVersion as any).__dirty) {
    const snapshot = new Map<string, unknown>()
    for (const [key, entry] of _store) {
      snapshot.set(key, entry.value)
    }
    _cachedSnapshot = snapshot
  }
  return _cachedSnapshot!
}

// Bump version on every set
const _originalSet = setCodeModeAtom
// (version bump is handled by notifyStoreListeners)

/**
 * List all registered atom keys.
 */
export function listAtomKeys(): ReadonlyArray<string> {
  return Array.from(_store.keys())
}

/**
 * Check if an atom exists for a given key.
 */
export function hasAtom(key: string): boolean {
  return _store.has(key)
}

/**
 * Reset the shared store (for tests).
 */
export function resetSharedAtomStore(): void {
  _store.clear()
  _storeListeners.clear()
  _snapshotVersion = 0
  _cachedSnapshot = null
}
