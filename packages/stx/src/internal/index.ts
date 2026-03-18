/**
 * @tmnl/stx — Internal modules
 *
 * Not part of the public API. Consumers use stx(), autoLens(), useStx().
 *
 * @module
 * @internal
 */

export { isClassInstance, classAwareReplace, classAwareModify } from "./class-patch.js"
export { autoLens, type AutoLens } from "./auto-lens.js"
export { createFocusAtom } from "./focus.js"
export { createFilterAtom, createWhenAtom } from "./filter.js"
export { fromEffect, fromStream, fromPull, type StxAsync, type StxPull } from "./async.js"
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
} from "./transaction.js"
