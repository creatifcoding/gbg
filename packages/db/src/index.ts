/**
 * @tmnl/db — Principled client-side data management
 *
 * TanStack DB × ElectricSQL × Entity × STX
 *
 * @since 0.0.1
 * @module
 */

// ── Entity Adapter ───────────────────────────────────────────
export {
  tanstackAdapter,
  type TanstackAdapterConfig,
  type AdaptedCollection,
} from './adapter.js'

// ── Hook Factory ─────────────────────────────────────────────
export {
  createEntityHooks,
  type EntityHooks,
  type EntityHookConfig,
} from './hooks.js'

// ── Reactive Bridge ──────────────────────────────────────────
export {
  reactive,
  type ReactiveCollection,
} from './reactive.js'

// ── Types ────────────────────────────────────────────────────
export {
  type CollectionDef,
  type ElectricSyncConfig,
  type ManagedCollection,
} from './types.js'

// ── Stream Bridge ────────────────────────────────────────────
export {
  collectionChanges,
  collectionStream,
  collectionItemChanges,
} from './stream-bridge.js'
