/**
 * Cell — the monolithic entity backing every grid cell.
 *
 * 4-axis parallel state machine:
 *   Interaction: idle → selected → editing → dirty → committing → committed/error
 *   Freshness:   current ↔ stale
 *   Computation:  ready ↔ computing
 *   Permission:   unlocked ↔ locked
 *
 * Identity is `cellKey` — a Schema-branded `${sheetId}:${col}:${row}` string.
 * Value is optional: empty cells and mid-computation formula cells have `null`.
 *
 * @module
 */

import { Schema } from "effect-v4"
import { CellKeySchema, type CellKey } from "./addressing"
import { CellValue } from "./cell-value"

// ─── Axis schemas ───────────────────────────────────

export const InteractionPhase = Schema.Literals(["idle", "selected", "editing", "dirty", "committing", "committed", "error"])
export type InteractionPhase = typeof InteractionPhase.Type

export const Freshness = Schema.Literals(["current", "stale"])
export type Freshness = typeof Freshness.Type

export const Computation = Schema.Literals(["ready", "computing"])
export type Computation = typeof Computation.Type

export const Permission = Schema.Literals(["unlocked", "locked"])
export type Permission = typeof Permission.Type

export const ErrorSource = Schema.Literals(["validation", "constraint", "conflict", "formula", "network"])
export type ErrorSource = typeof ErrorSource.Type

// ─── Cell TaggedClass ───────────────────────────────

export class Cell extends Schema.TaggedClass<Cell>()("Cell", {
  // ── identity ──
  cellKey: CellKeySchema,

  // ── value ──
  value: Schema.NullOr(CellValue),
  version: Schema.Number,

  // ── 4-axis state ──
  interaction: InteractionPhase,
  freshness: Freshness,
  computation: Computation,
  permission: Permission,

  // ── draft ──
  lastDraft: Schema.NullOr(CellValue),

  // ── errors ──
  errors: Schema.Array(Schema.String),
  errorSource: Schema.NullOr(ErrorSource),

  // ── formula ──
  formula: Schema.NullOr(Schema.String),

  // ── schema override ──
  schemaOverride: Schema.NullOr(Schema.String),
}) {

  // ── Derived getters ─────────────────────────────

  get isEditable(): boolean {
    return this.permission === "unlocked"
      && this.interaction !== "committing"
      && this.interaction !== "committed"
  }

  get hasError(): boolean {
    return this.interaction === "error"
  }

  get isDirty(): boolean {
    return this.interaction === "dirty" || this.interaction === "editing"
  }

  get hasValue(): boolean {
    return this.value !== null
  }

  get needsAttention(): boolean {
    return this.freshness === "stale" || this.interaction === "error"
  }

  get canUndo(): boolean {
    return this.lastDraft !== null
      && (this.interaction === "idle" || this.interaction === "selected")
  }

  // ── Transition methods ──────────────────────────
  // Each returns a new Cell (immutable).
  // Cross-axis guards are enforced here.

  select(): Cell {
    if (this.interaction !== "idle") return this
    return new Cell({ ...this, interaction: "selected" })
  }

  deselect(): Cell {
    if (this.interaction !== "selected") return this
    return new Cell({ ...this, interaction: "idle" })
  }

  /** Enter edit mode. Blocked if locked. */
  enterEdit(): Cell {
    if (this.permission === "locked") return this
    if (this.interaction !== "selected" && this.interaction !== "idle") return this
    return new Cell({ ...this, interaction: "editing" })
  }

  /** First keystroke marks cell dirty. */
  markDirty(): Cell {
    if (this.interaction !== "editing") return this
    return new Cell({ ...this, interaction: "dirty" })
  }

  /** Escape editing — pushes current value to lastDraft for undo. */
  cancelEdit(): Cell {
    if (this.interaction !== "editing" && this.interaction !== "dirty") return this
    return new Cell({ ...this, interaction: "idle", lastDraft: this.value })
  }

  /** Submit value for commit. Editing+stale = conflict territory. */
  submit(): Cell {
    if (this.interaction !== "editing" && this.interaction !== "dirty") return this
    return new Cell({ ...this, interaction: "committing" })
  }

  commitOk(value: CellValue, nextVersion: number): Cell {
    if (this.interaction !== "committing") return this
    return new Cell({
      ...this,
      interaction: "committed",
      value,
      version: nextVersion,
      lastDraft: null,
      errors: [],
      errorSource: null,
    })
  }

  commitFail(errors: ReadonlyArray<string>, source: ErrorSource): Cell {
    if (this.interaction !== "committing") return this
    return new Cell({
      ...this,
      interaction: "error",
      errors: [...errors],
      errorSource: source,
    })
  }

  /** Auto-settle from committed → idle (after flash). */
  settle(): Cell {
    if (this.interaction !== "committed") return this
    return new Cell({ ...this, interaction: "idle" })
  }

  /** Retry from error → editing. */
  retry(): Cell {
    if (this.interaction !== "error") return this
    return new Cell({ ...this, interaction: "editing", errors: [], errorSource: null })
  }

  // ── Freshness ──

  markStale(): Cell {
    return new Cell({ ...this, freshness: "stale" })
  }

  refresh(remoteValue: CellValue, nextVersion: number): Cell {
    return new Cell({
      ...this,
      freshness: "current",
      value: remoteValue,
      version: nextVersion,
    })
  }

  // ── Computation ──

  startComputing(): Cell {
    return new Cell({ ...this, computation: "computing" })
  }

  finishComputing(result: CellValue): Cell {
    return new Cell({ ...this, computation: "ready", value: result })
  }

  // ── Permission ──

  lock(): Cell {
    return new Cell({ ...this, permission: "locked" })
  }

  unlock(): Cell {
    return new Cell({ ...this, permission: "unlocked" })
  }

  // ── Undo ──

  /** Restore lastDraft (cell-scoped undo). */
  restoreDraft(): Cell {
    if (!this.canUndo) return this
    return new Cell({
      ...this,
      interaction: "editing",
      value: this.lastDraft,
      lastDraft: null,
    })
  }

  // ── Schema override ──

  withSchemaOverride(key: string | null): Cell {
    return new Cell({ ...this, schemaOverride: key })
  }

  // ── Formula ──

  withFormula(src: string | null): Cell {
    return new Cell({ ...this, formula: src })
  }
}

// ─── Factory ────────────────────────────────────────

/** Create a fresh idle cell at the given key. */
export function makeCell(key: CellKey, value?: CellValue | null): Cell {
  return new Cell({
    cellKey: key,
    value: value ?? null,
    version: 0,
    interaction: "idle",
    freshness: "current",
    computation: "ready",
    permission: "unlocked",
    lastDraft: null,
    errors: [],
    errorSource: null,
    formula: null,
    schemaOverride: null,
  })
}
