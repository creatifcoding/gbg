/**
 * @tmnl/stx — Surgical State (v2)
 *
 * Optic-based reactive state with class-aware structural sharing.
 *
 * autoLens (Proxy optic tree) × Atom (reactive primitives) × useSyncExternalStore (React 19)
 *
 * Supports arbitrary shapes: plain objects, Schema.TaggedClass,
 * Schema.TaggedStruct, Schema.Class, or any class instance.
 *
 * @module
 */

// Core factory
export { stx } from "./stx.js"
export type { StxInstance, EntityMeta, StxError } from "./types.js"
export { StxValidationError, StxConstraintError } from "./types.js"

// Internals (exposed for advanced use / composition)
export { autoLens, type AutoLens } from "./internal/auto-lens.js"
export { createFocusAtom } from "./internal/focus.js"
export {
  isClassInstance,
  classAwareReplace,
  classAwareModify,
} from "./internal/class-patch.js"

// Async / Streaming (legacy — single effect/stream)
export { fromEffect, fromStream, fromPull, type StxAsync, type StxPull } from "./internal/async.js"

// Family (keyed atom collections)
export { stxFamily, type StxFamily, type StxFamilyMember, type StxFamilyView, type StxFamilyConfig } from "./internal/family.js"

// Streaming materializers (v2 — full control plane + typed error propagation)
export {
  stxReduce, stxFeed, stxLatest, stxPull, stxDuplex, stxShared,
  watchFiberExit, StxDefect, makeStatsAtoms, makeControlAtoms,
} from "./streaming/index.js"
export type {
  ReduceConfig, FeedConfig, PullConfig, DuplexConfig, SharedConfig,
  StxReduce, StxFeed, StxLatest, StxPullV2, StxDuplex, StxShared,
  StxSharedSubscription, StxStreamControl, StxStreamStats, StxFiberAtoms,
} from "./streaming/index.js"

// React hooks — explicit registry, no RegistryContext dependency
export { useStx, useFocus, useStxSet, useStxAsync, useFocusAsync, useStxPull, useFamily, useFamilyFocus } from "./hooks.js"
export { useAtomValue } from "./hooks.js"

// React hooks — streaming materializers
export { useStxReduce, useStxFeed, useStxLatest, useStxPullV2, useStxDuplex, useStxShared } from "./streaming/hooks.js"

// Collection → Atom bridge (TanStack DB integration, Schema-backed)
export { stxCollection } from "./collection.js"
export type {
  StxCollection, CollectionLike, ChangeMessageLike,
} from "./collection.js"

// Transactional STM integration
export {
  StxTxValidationError,
  StxTxConstraintError,
  StxTxConflictError,
  type StxTxError,
  storeTransaction,
  multiStoreTransaction,
  conflictAwareTransaction,
  conflictAwareStoreTransaction,
  snapshotVersions,
  detectConflicts,
  getVersion,
  txSet, txSetAt, txModify, txGet, txGetAt,
  type TxStoreDescriptor,
  type VersionSnapshot,
  type ConflictPolicy,
  ReadonlyFieldKind, FieldKind,
} from "./internal/transaction.js"

// Re-exports for convenience
export { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
export { Optic } from "effect-v4"
