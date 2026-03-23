/**
 * Cell Renderers for @tmnl/datagrid AG-Grid integration.
 * 
 * These are minimal, service-aware renderers that work with
 * the datagrid CellCache + FormulaEngine.
 * 
 * @module
 */

import type { ICellRendererParams } from "ag-grid-community"
import { COLORS, STATUS_COLORS, TYPOGRAPHY } from "../theme"

// ── Row Header (row number) ─────────────────────────

export function RowHeaderRenderer(params: ICellRendererParams) {
  return (
    <span
      style={{
        color: COLORS.textDisabled,
        fontFamily: TYPOGRAPHY.fontFamilyString,
        fontSize: TYPOGRAPHY.fontSizeXs,
        userSelect: "none",
      }}
    >
      {(params.node?.rowIndex ?? 0) + 1}
    </span>
  )
}

// ── Formula Cell ────────────────────────────────────

export function FormulaCellRenderer(params: ICellRendererParams) {
  const value = params.value
  const isFormula = typeof value === "string" && value.startsWith("=")
  const isError = typeof value === "string" && value.startsWith("#")

  return (
    <span
      style={{
        color: isError
          ? COLORS.accentRed
          : isFormula
            ? COLORS.accentCyan
            : COLORS.textSecondary,
        fontFamily: TYPOGRAPHY.fontFamilyString,
        fontSize: TYPOGRAPHY.fontSizeSm,
      }}
    >
      {value ?? ""}
    </span>
  )
}

// ── Status Indicator ────────────────────────────────

export function StatusCellRenderer(params: ICellRendererParams) {
  const status = params.value as string
  const color = (STATUS_COLORS as Record<string, string>)[status] ?? STATUS_COLORS.default

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: COLORS.textMuted,
          fontFamily: TYPOGRAPHY.fontFamilyString,
          fontSize: TYPOGRAPHY.fontSizeXs,
          textTransform: "uppercase",
        }}
      >
        {status}
      </span>
    </span>
  )
}
