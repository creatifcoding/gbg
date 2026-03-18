/**
 * VM ↔ Cell Bridge — Bidirectional conversion between VMValue and CellValue.
 *
 * ## Why a Bridge
 *
 * The Stack VM operates on its own type system (`VMValue`: num, str, bool, error)
 * while the datagrid cell layer uses `CellValue` (8 variants including Date, Json,
 * Formula, Empty). The bridge provides:
 *
 * 1. **CellValue → VMValue**: Cells feed their values into VM operands
 * 2. **VMValue → CellValue**: VM results write back to cells
 * 3. **VMError → CellError**: VM inline errors become cell error display
 * 4. **Cell reference opcodes**: READ_CELL opcode resolves cell addresses at eval time
 *
 * ## Error Flow
 *
 * ```
 * CellValue("Error") ──→ VMValue("error", GENERAL) ──→ propagates through VM
 * CellValue("Empty")  ──→ VMValue("num", 0)         ──→ empty = zero (spreadsheet convention)
 * VMValue("error")    ──→ CellValue("Error")         ──→ renders as #DIV/0! etc.
 * ```
 *
 * ## Design Decision: Lossless for Common Types
 *
 * - Number, String, Boolean round-trip exactly
 * - Date, Json, Formula → VMValue uses best-effort coercion (Date→str, Json→str, Formula→cached)
 * - Empty → 0 (follows Excel convention: empty cells are zero in arithmetic)
 * - Conversion failures produce VMError with TYPE_MISMATCH code
 *
 * @module vm-cell-bridge
 */

import type { CellValue } from "../schemas/cell-value"
import * as CV from "../schemas/cell-value"
import type { VMValue, VMErrorCode } from "./stack-vm"
import {
  num, str, bool, vmError, isVMError, vmDisplay,
  errorCodeDisplay,
} from "./stack-vm"

// ═══════════════════════════════════════════════════════
// CellValue → VMValue
// ═══════════════════════════════════════════════════════

/**
 * Convert a CellValue into a VMValue for stack consumption.
 *
 * **Convention**: Empty cells become `num(0)` (Excel arithmetic convention).
 * Formula cells use their cached result. Date cells become str.
 * Json cells become str(JSON.stringify). Error cells become VMError.
 *
 * This is the **read path** — cells feed into the VM.
 */
export function cellToVM(cell: CellValue): VMValue {
  switch (cell._tag) {
    case "Empty":
      return num(0)
    case "Number":
      return num(cell.value)
    case "String":
      return str(cell.value)
    case "Boolean":
      return bool(cell.value)
    case "Date":
      return str(cell.value)
    case "Json":
      return str(typeof cell.value === "string" ? cell.value : JSON.stringify(cell.value))
    case "Error":
      return vmError("GENERAL", cell.error)
    case "Formula":
      // Use cached value if available; otherwise return 0 (not yet computed)
      if (cell.cached !== null && cell.cached !== undefined) {
        return cellToVM(cell.cached as CellValue)
      }
      return num(0)
  }
}

// ═══════════════════════════════════════════════════════
// VMValue → CellValue
// ═══════════════════════════════════════════════════════

/**
 * Convert a VMValue back into a CellValue for cell storage.
 *
 * This is the **write path** — VM results go back into cells.
 * VMError values become CellError with the display string (e.g. "#DIV/0!").
 */
export function vmToCell(vm: VMValue): CellValue {
  switch (vm._tag) {
    case "num":
      return CV.num(vm.value)
    case "str":
      return CV.str(vm.value)
    case "bool":
      return CV.bool(vm.value)
    case "error":
      return CV.error(errorCodeDisplay[vm.code] ?? vm.message)
  }
}

// ═══════════════════════════════════════════════════════
// BATCH CONVERSION
// ═══════════════════════════════════════════════════════

/** Convert multiple CellValues to VMValues (e.g., for SUM_N operands) */
export function cellsToVM(cells: ReadonlyArray<CellValue>): VMValue[] {
  return cells.map(cellToVM)
}

/** Convert multiple VMValues back to CellValues */
export function vmsToCell(vms: ReadonlyArray<VMValue>): CellValue[] {
  return vms.map(vmToCell)
}

// ═══════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════

/**
 * Get the display string for a CellValue through the VM lens.
 *
 * Converts to VMValue first, then uses vmDisplay.
 * Useful when you want VM-style display (TRUE/FALSE, #DIV/0!) for all cells.
 */
export function cellDisplayVM(cell: CellValue): string {
  return vmDisplay(cellToVM(cell))
}

// ═══════════════════════════════════════════════════════
// ROUND-TRIP CHECKS
// ═══════════════════════════════════════════════════════

/**
 * Check if a CellValue → VMValue → CellValue round-trip is lossless.
 *
 * Returns true for Number, String, Boolean.
 * Returns false for Date (loses type), Json (loses structure),
 * Formula (loses src/deps), Empty (becomes Number 0).
 */
export function isLosslessRoundTrip(cell: CellValue): boolean {
  switch (cell._tag) {
    case "Number":
    case "String":
    case "Boolean":
    case "Error":
      return true
    case "Empty":
    case "Date":
    case "Json":
    case "Formula":
      return false
  }
}
