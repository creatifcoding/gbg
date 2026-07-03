/**
 * CellRenderer — Phase-aware visual treatment metadata (G12).
 *
 * Reads Cell.interaction, Cell.freshness, Cell.permission, Cell.computation
 * to produce a CellVisual descriptor that AG-Grid cellStyle/cellClass
 * callbacks can consume.
 *
 * This is NOT a React component — it's a pure function that maps
 * 4-axis cell state → visual treatment. The actual rendering lives
 * in AG-Grid's cellStyle/cellClassRules/cellRenderer callbacks,
 * which call getCellVisual() per cell.
 *
 * Visual treatments:
 *   dirty      → amber border (editing in progress)
 *   error      → red border + tooltip with issues
 *   stale      → dimmed + refresh icon
 *   locked     → grayed out, cursor: not-allowed
 *   committed  → flash animation (brief green pulse)
 *   computing  → spinner/pulse indicator
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import { stxFamily, type StxFamily } from "@tmnl/stx"
import type { ColRow } from "../schemas/addressing"
import { cellKey } from "../schemas/addressing"
import type { InteractionPhase, Freshness, Computation, Permission } from "../schemas/cell"
import type { CellErrorState, CellErrorStoreShape } from "./cell-errors"

// ─── Visual descriptor ──────────────────────────────

export interface CellVisual {
  /** CSS classes to apply */
  readonly classes: ReadonlyArray<string>
  /** Inline style overrides */
  readonly style: Readonly<Record<string, string>>
  /** Tooltip text (errors, status) */
  readonly tooltip: string | null
  /** Whether to show a spinner/pulse */
  readonly showSpinner: boolean
  /** Whether to trigger commit flash */
  readonly flashCommit: boolean
  /** Whether the cell is interactive */
  readonly interactive: boolean
}

/** Default visual — clean idle cell */
const IDLE_VISUAL: CellVisual = {
  classes: [],
  style: {},
  tooltip: null,
  showSpinner: false,
  flashCommit: false,
  interactive: true,
}

// ─── Phase input (what the renderer reads) ──────────

export interface CellPhaseInput {
  readonly interaction: InteractionPhase
  readonly freshness: Freshness
  readonly computation: Computation
  readonly permission: Permission
  readonly errors: ReadonlyArray<string>
}

// ─── Config ─────────────────────────────────────────

export interface CellRendererConfigShape {
  readonly registry: AtomRegistry.AtomRegistry
  readonly sheetId: string
  readonly errorStore?: CellErrorStoreShape
  /** CSS class prefix (default: "tmnl-cell") */
  readonly classPrefix?: string
}

export class CellRendererConfig extends Context.Service<CellRendererConfig, CellRendererConfigShape>()(
  "@tmnl/datagrid/CellRendererConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface CellRendererShape {
  /**
   * Compute the visual descriptor for a cell given its phase state.
   * Pure function — no side effects.
   */
  readonly getCellVisual: (phase: CellPhaseInput) => CellVisual

  /**
   * Compute visual from stored phase atom + error store.
   * Reads from the phase family and error store for a given address.
   */
  readonly getVisualForCell: (addr: ColRow) => CellVisual

  /**
   * Set the phase state for a cell (called by interaction handlers).
   */
  readonly setPhase: (addr: ColRow, phase: CellPhaseInput) => void

  /**
   * Get the phase atom for a cell (for React subscriptions).
   */
  readonly getPhaseAtom: (addr: ColRow) => ReturnType<StxFamily<string, CellPhaseInput>>

  /**
   * AG-Grid cellStyle callback — plug directly into colDef.
   */
  readonly cellStyleCallback: (params: { data?: { _rowIndex: number }; colDef?: { field?: string } }) => Record<string, string>

  /**
   * AG-Grid cellClass callback — plug directly into colDef.
   */
  readonly cellClassCallback: (params: { data?: { _rowIndex: number }; colDef?: { field?: string } }) => string

  /**
   * AG-Grid tooltipValueGetter — plug directly into colDef.
   */
  readonly tooltipCallback: (params: { data?: { _rowIndex: number }; colDef?: { field?: string } }) => string | null

  /** The phase family */
  readonly family: StxFamily<string, CellPhaseInput>
}

// ─── Service tag ────────────────────────────────────

export class CellRenderer extends Context.Service<CellRenderer, CellRendererShape>()(
  "@tmnl/datagrid/CellRenderer",
) {}

// ─── Pure visual computation ────────────────────────

const PHASE_STYLES: Record<string, Readonly<Record<string, string>>> = {
  dirty: { borderColor: "#f59e0b", borderWidth: "2px", borderStyle: "solid" },
  error: { borderColor: "#ef4444", borderWidth: "2px", borderStyle: "solid", backgroundColor: "rgba(239,68,68,0.08)" },
  stale: { opacity: "0.5" },
  locked: { backgroundColor: "rgba(107,114,128,0.15)", cursor: "not-allowed" },
  committed: { borderColor: "#10b981", borderWidth: "2px", borderStyle: "solid" },
  computing: { borderColor: "#8b5cf6", borderWidth: "1px", borderStyle: "dashed" },
}

function computeVisual(phase: CellPhaseInput, prefix: string, errorState?: CellErrorState | null): CellVisual {
  const classes: string[] = []
  let style: Record<string, string> = {}
  let tooltip: string | null = null
  let showSpinner = false
  let flashCommit = false
  let interactive = true

  // Permission axis
  if (phase.permission === "locked") {
    classes.push(`${prefix}--locked`)
    style = { ...style, ...PHASE_STYLES.locked }
    interactive = false
  }

  // Computation axis
  if (phase.computation === "computing") {
    classes.push(`${prefix}--computing`)
    style = { ...style, ...PHASE_STYLES.computing }
    showSpinner = true
  }

  // Freshness axis
  if (phase.freshness === "stale") {
    classes.push(`${prefix}--stale`)
    style = { ...style, ...PHASE_STYLES.stale }
    tooltip = "Stale — click to refresh"
  }

  // Interaction axis (highest priority — overwrites border)
  switch (phase.interaction) {
    case "editing":
    case "dirty":
      classes.push(`${prefix}--dirty`)
      style = { ...style, ...PHASE_STYLES.dirty }
      break

    case "error": {
      classes.push(`${prefix}--error`)
      style = { ...style, ...PHASE_STYLES.error }
      const issues = errorState?.issues ?? phase.errors
      tooltip = issues.length > 0 ? issues.join("; ") : "Cell error"
      break
    }

    case "committing":
      classes.push(`${prefix}--committing`)
      showSpinner = true
      break

    case "committed":
      classes.push(`${prefix}--committed`)
      style = { ...style, ...PHASE_STYLES.committed }
      flashCommit = true
      break

    case "selected":
      classes.push(`${prefix}--selected`)
      break

    case "idle":
    default:
      break
  }

  return { classes, style, tooltip, showSpinner, flashCommit, interactive }
}

// ─── Layer ──────────────────────────────────────────

const DEFAULT_PHASE: CellPhaseInput = {
  interaction: "idle",
  freshness: "current",
  computation: "ready",
  permission: "unlocked",
  errors: [],
}

export const CellRendererLive = Layer.effect(
  CellRenderer,
  Effect.gen(function*() {
    const config = yield* CellRendererConfig
    const { registry, sheetId, errorStore } = config
    const prefix = config.classPrefix ?? "tmnl-cell"

    const family = stxFamily(
      (_key: string): CellPhaseInput => DEFAULT_PHASE,
      registry,
    )

    function extractAddr(params: { data?: { _rowIndex: number }; colDef?: { field?: string } }): ColRow | null {
      const field = params.colDef?.field ?? ""
      const colMatch = field.match(/^col_(\d+)$/)
      if (!colMatch) return null
      return { col: parseInt(colMatch[1]!, 10), row: params.data?._rowIndex ?? 0 }
    }

    function getVisualForCell(addr: ColRow): CellVisual {
      const key = cellKey(sheetId, addr)
      const phase = family.get(key)
      const err = errorStore?.getError(addr) ?? null
      return computeVisual(phase, prefix, err)
    }

    return CellRenderer.of({
      getCellVisual: (phase) => computeVisual(phase, prefix),

      getVisualForCell,

      setPhase: (addr, phase) => {
        family.set(cellKey(sheetId, addr), phase)
      },

      getPhaseAtom: (addr) => family(cellKey(sheetId, addr)),

      cellStyleCallback: (params) => {
        const addr = extractAddr(params)
        if (!addr) return {}
        return getVisualForCell(addr).style
      },

      cellClassCallback: (params) => {
        const addr = extractAddr(params)
        if (!addr) return ""
        return getVisualForCell(addr).classes.join(" ")
      },

      tooltipCallback: (params) => {
        const addr = extractAddr(params)
        if (!addr) return null
        return getVisualForCell(addr).tooltip
      },

      family,
    })
  }),
)
