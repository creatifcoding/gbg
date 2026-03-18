/**
 * VM ↔ Cell Bridge — Tests for bidirectional conversion.
 *
 * Ensures VMValue and CellValue can round-trip cleanly for common types,
 * and that error propagation works correctly across the boundary.
 */

import { describe, it, expect } from "vitest"

import * as CV from "../src/schemas/cell-value"
import {
  num, str, bool, vmError, vmDisplay,
} from "../src/services/stack-vm"
import {
  cellToVM, vmToCell, cellsToVM, vmsToCell,
  cellDisplayVM, isLosslessRoundTrip,
} from "../src/services/vm-cell-bridge"

// ═══════════════════════════════════════════════════════
// CellValue → VMValue
// ═══════════════════════════════════════════════════════

describe("cellToVM", () => {
  it("Empty → num(0) (spreadsheet convention)", () => {
    expect(cellToVM(CV.empty())).toEqual(num(0))
  })

  it("Number → num", () => {
    expect(cellToVM(CV.num(42))).toEqual(num(42))
  })

  it("String → str", () => {
    expect(cellToVM(CV.str("hello"))).toEqual(str("hello"))
  })

  it("Boolean → bool", () => {
    expect(cellToVM(CV.bool(true))).toEqual(bool(true))
    expect(cellToVM(CV.bool(false))).toEqual(bool(false))
  })

  it("Date → str (ISO)", () => {
    const result = cellToVM(CV.date("2024-01-15T00:00:00.000Z"))
    expect(result._tag).toBe("str")
    if (result._tag === "str") {
      expect(result.value).toContain("2024")
    }
  })

  it("Json → str(JSON.stringify)", () => {
    const result = cellToVM(CV.json({ key: "val" }))
    expect(result._tag).toBe("str")
    if (result._tag === "str") {
      expect(result.value).toContain("key")
    }
  })

  it("Error → vmError(GENERAL)", () => {
    const result = cellToVM(CV.error("bad data"))
    expect(result).toEqual(vmError("GENERAL", "bad data"))
  })

  it("Formula with cached → uses cached value", () => {
    const result = cellToVM(CV.formula("=A1+B1", ["A1", "B1"], CV.num(42)))
    expect(result).toEqual(num(42))
  })

  it("Formula without cached → num(0)", () => {
    const result = cellToVM(CV.formula("=A1+B1", ["A1", "B1"]))
    expect(result).toEqual(num(0))
  })
})

// ═══════════════════════════════════════════════════════
// VMValue → CellValue
// ═══════════════════════════════════════════════════════

describe("vmToCell", () => {
  it("num → CellNumber", () => {
    expect(vmToCell(num(42))).toEqual(CV.num(42))
  })

  it("str → CellString", () => {
    expect(vmToCell(str("hello"))).toEqual(CV.str("hello"))
  })

  it("bool → CellBoolean", () => {
    expect(vmToCell(bool(true))).toEqual(CV.bool(true))
  })

  it("vmError → CellError with display string", () => {
    const result = vmToCell(vmError("DIV_ZERO", "Division by zero"))
    expect(result._tag).toBe("Error")
    if (result._tag === "Error") {
      expect(result.error).toBe("#DIV/0!")
    }
  })

  it("vmError STACK_UNDERFLOW → #VALUE!", () => {
    const result = vmToCell(vmError("STACK_UNDERFLOW", "oops"))
    if (result._tag === "Error") {
      expect(result.error).toBe("#VALUE!")
    }
  })
})

// ═══════════════════════════════════════════════════════
// ROUND-TRIP
// ═══════════════════════════════════════════════════════

describe("round-trip CellValue → VMValue → CellValue", () => {
  it("Number round-trips exactly", () => {
    const cell = CV.num(3.14)
    expect(vmToCell(cellToVM(cell))).toEqual(cell)
  })

  it("String round-trips exactly", () => {
    const cell = CV.str("hello world")
    expect(vmToCell(cellToVM(cell))).toEqual(cell)
  })

  it("Boolean round-trips exactly", () => {
    expect(vmToCell(cellToVM(CV.bool(true)))).toEqual(CV.bool(true))
    expect(vmToCell(cellToVM(CV.bool(false)))).toEqual(CV.bool(false))
  })

  it("Error round-trips (message changes to display)", () => {
    const cell = CV.error("test error")
    const result = vmToCell(cellToVM(cell))
    // Error gets GENERAL code → #ERROR! display
    expect(result._tag).toBe("Error")
  })

  it("Empty becomes Number(0), not Empty", () => {
    const result = vmToCell(cellToVM(CV.empty()))
    expect(result).toEqual(CV.num(0))
  })
})

// ═══════════════════════════════════════════════════════
// isLosslessRoundTrip
// ═══════════════════════════════════════════════════════

describe("isLosslessRoundTrip", () => {
  it("lossless: Number, String, Boolean, Error", () => {
    expect(isLosslessRoundTrip(CV.num(1))).toBe(true)
    expect(isLosslessRoundTrip(CV.str("a"))).toBe(true)
    expect(isLosslessRoundTrip(CV.bool(true))).toBe(true)
    expect(isLosslessRoundTrip(CV.error("x"))).toBe(true)
  })

  it("lossy: Empty, Date, Json, Formula", () => {
    expect(isLosslessRoundTrip(CV.empty())).toBe(false)
    expect(isLosslessRoundTrip(CV.date("2024-01-01"))).toBe(false)
    expect(isLosslessRoundTrip(CV.json({ a: 1 }))).toBe(false)
    expect(isLosslessRoundTrip(CV.formula("=A1"))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════
// BATCH
// ═══════════════════════════════════════════════════════

describe("batch conversion", () => {
  it("cellsToVM converts array", () => {
    const cells = [CV.num(1), CV.str("a"), CV.bool(true)]
    const vms = cellsToVM(cells)
    expect(vms).toEqual([num(1), str("a"), bool(true)])
  })

  it("vmsToCell converts array", () => {
    const vms = [num(1), str("a"), bool(true)]
    const cells = vmsToCell(vms)
    expect(cells).toEqual([CV.num(1), CV.str("a"), CV.bool(true)])
  })
})

// ═══════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════

describe("cellDisplayVM", () => {
  it("renders CellValue through VM display", () => {
    expect(cellDisplayVM(CV.num(42))).toBe("42")
    expect(cellDisplayVM(CV.bool(true))).toBe("TRUE")
    expect(cellDisplayVM(CV.empty())).toBe("0")
    expect(cellDisplayVM(CV.error("oops"))).toBe("#ERROR!")
  })
})
