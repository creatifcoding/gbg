/**
 * @tmnl/db — Core types
 *
 * Types for the TanStack DB × STX integration layer.
 *
 * @module
 */

import type { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import type { StxCollection } from "@tmnl/stx"

// ─── Re-export TanStack DB types for convenience ─────────────

export type { Collection, ChangeMessage } from "@tanstack/db"

// ─── Collection Definition ───────────────────────────────────

/**
 * Schema for defining a managed collection.
 * Domain devs use this to declare their data shape — never touching STX or TanStack DB internals.
 */
export interface CollectionDef<
  T extends object,
  TKey extends string | number = string | number,
> {
  /** Unique collection name (used for debug, devtools, sync routing) */
  readonly name: string

  /** Extract the primary key from a row */
  readonly getKey: (item: T) => TKey

  /** Optional initial seed data */
  readonly initialData?: ReadonlyArray<T>

  /** Optional Electric sync config (omit for local-only) */
  readonly sync?: ElectricSyncConfig
}

// ─── Electric Sync Config ────────────────────────────────────

export interface ElectricSyncConfig {
  /** Electric service URL */
  readonly url: string

  /** Shape/table to sync */
  readonly shape: string

  /** Sync mode */
  readonly mode: 'eager' | 'onDemand' | 'progressive'

  /** Optional auth token */
  readonly token?: string

  /** Optional where clause for server-side filtering */
  readonly where?: string
}

// ─── Managed Collection ──────────────────────────────────────

/**
 * A fully managed collection — TanStack DB collection + STX bridge + mutations as Effects.
 *
 * This is what domain hooks consume. Domain devs never see Collection or Atom directly.
 */
export interface ManagedCollection<
  T extends object,
  TKey extends string | number = string | number,
> {
  /** Collection definition */
  readonly def: CollectionDef<T, TKey>

  /** STX bridge (items atom, derive, item family, dispose) */
  readonly bridge: StxCollection<T, TKey>

  /** Registry powering this collection's atoms */
  readonly registry: AtomRegistry.AtomRegistry

  /** Full items atom */
  readonly items: Atom.Writable<Array<T>, Array<T>>

  /** Per-item atom access */
  readonly item: (key: TKey) => Atom.Atom<T | undefined>

  /** Derive a computed atom from collection state */
  readonly derive: <R>(fn: (items: Array<T>) => R) => Atom.Atom<R>

  // ── Mutations (imperative, for use in Effects or event handlers) ──

  /** Insert a row */
  readonly insert: (item: T) => Promise<void>

  /** Update a row by key */
  readonly update: (key: TKey, fn: (draft: T) => void) => Promise<void>

  /** Delete a row by key */
  readonly remove: (key: TKey) => Promise<void>

  /** Dispose — unsubscribe from collection, unmount all atoms */
  readonly dispose: () => void
}
