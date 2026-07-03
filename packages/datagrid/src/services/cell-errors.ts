/**
 * CellErrors — Per-cell error atoms for validation feedback.
 *
 * Reads are always clean CellValue; write errors go to a parallel
 * error atom that React consumers can subscribe to independently.
 *
 * Error atoms are created lazily via stxFamily. Cells without
 * errors simply have no atom allocated (no overhead).
 *
 * @module
 */

import { Schema } from "effect"
import { AtomRegistry } from "effect/unstable/reactivity"
import { stxFamily, type StxFamily } from "@tmnl/stx"
import type { ColRow, CellKey } from "../schemas/addressing"
import { cellKey } from "../schemas/addressing"

// ─── Grid-level error (Schema.TaggedErrorClass) ─────

/**
 * Cell write rejected — validation or constraint failure.
 *
 * Yieldable in Effect.gen, catchable with Effect.catchTag("CellWriteError", ...).
 */
export class CellWriteError extends Schema.TaggedErrorClass<CellWriteError>(
  "@tmnl/datagrid/CellWriteError",
)("CellWriteError", {
  col: Schema.Number,
  row: Schema.Number,
  issues: Schema.Array(Schema.String),
  source: Schema.Literals(["validation", "constraint", "db", "conflict"] as const),
}) {
  override get message(): string {
    return `Cell (${this.col},${this.row}) write failed [${this.source}]: ${this.issues.join(", ")}`
  }
}

// ─── Error state per cell ───────────────────────────

/**
 * Per-cell error state. `null` means no error (clean).
 */
export interface CellErrorState {
  readonly _tag: "CellError"
  readonly source: "validation" | "constraint" | "db" | "conflict"
  readonly issues: ReadonlyArray<string>
  readonly timestamp: number
}

/** The "no error" state */
const CLEAN: CellErrorState | null = null

// ─── CellErrorStore ─────────────────────────────────

export interface CellErrorStoreShape {
  /** Get the current error state for a cell (null = clean) */
  readonly getError: (addr: ColRow) => CellErrorState | null
  /** Set an error on a cell */
  readonly setError: (addr: ColRow, error: CellErrorState) => void
  /** Clear error for a cell */
  readonly clearError: (addr: ColRow) => void
  /** Clear all errors */
  readonly clearAll: () => void
  /** Get the error atom for a cell (for React subscriptions) */
  readonly getErrorAtom: (addr: ColRow) => ReturnType<StxFamily<string, CellErrorState | null>>
  /** The error family */
  readonly family: StxFamily<string, CellErrorState | null>
  /** The registry (shared with CellCache) */
  readonly registry: AtomRegistry.AtomRegistry
}

/**
 * Create a CellErrorStore backed by stxFamily.
 *
 * Shares the same AtomRegistry as the CellCache so
 * subscribers can watch both data and errors in the
 * same notification cycle.
 */
export function makeCellErrorStore(registry: AtomRegistry.AtomRegistry, sheetId: string): CellErrorStoreShape {
  const family = stxFamily(
    (_key: string): CellErrorState | null => CLEAN,
    registry,
  )

  // Track keys with active errors (family is lazy — can't enumerate)
  const activeErrorKeys = new Set<string>()

  return {
    getError: (addr) => family.get(cellKey(sheetId, addr)),

    setError: (addr, error) => {
      const key = cellKey(sheetId, addr)
      family.set(key, error)
      activeErrorKeys.add(key)
    },

    clearError: (addr) => {
      const key = cellKey(sheetId, addr)
      family.set(key, CLEAN)
      activeErrorKeys.delete(key)
    },

    clearAll: () => {
      for (const key of activeErrorKeys) {
        family.set(key, CLEAN)
      }
      activeErrorKeys.clear()
    },

    getErrorAtom: (addr) => family(cellKey(sheetId, addr)),

    family,
    registry,
  }
}
