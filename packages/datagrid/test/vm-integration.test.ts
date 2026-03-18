/**
 * VM Integration — End-to-end formula evaluation pipeline.
 *
 * Tests the full flow: DepGraph (dependency tracking) + StackVM (evaluation)
 * + VMCellBridge (CellValue ↔ VMValue) working in concert.
 *
 * Scenario: A mini spreadsheet where:
 * - A1, B1 = data cells
 * - C1 = =A1+B1 (formula referencing two cells)
 * - D1 = =C1*2 (chained formula)
 * - When A1 changes, C1 and D1 recalculate in topo order
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"

import { num, str, bool, vmError, isVMError, evalProgram, compileExprSync, type StackIR, type VMValue, type VMState, type CellContext } from "../src/services/stack-vm"
import { cellToVM, vmToCell } from "../src/services/vm-cell-bridge"
import { makeDepGraph, CircularDepError } from "../src/services/dep-graph"
import * as CV from "../src/schemas/cell-value"

// ═══════════════════════════════════════════════════════
// MINI SPREADSHEET SIMULATION
// ═══════════════════════════════════════════════════════

/**
 * Mini spreadsheet: cell address → CellValue.
 *
 * Simulates the CellCache layer. In production, this is
 * backed by stxFamily atoms + AtomRegistry.
 */
function makeSheet() {
  const cells = new Map<string, CV.CellValue>()

  return {
    get: (addr: string): CV.CellValue => cells.get(addr) ?? CV.empty(),
    set: (addr: string, value: CV.CellValue) => cells.set(addr, value),
    getVM: (addr: string): VMValue => cellToVM(cells.get(addr) ?? CV.empty()),
    dump: () => Object.fromEntries(cells.entries()),
  }
}

/**
 * Formula registry: maps cell addresses to their RPN source expressions.
 *
 * In production, this is stored in FormulaEngine. Here we simulate
 * it with a plain map for clarity.
 */
interface FormulaEntry {
  readonly src: string
  readonly deps: ReadonlyArray<string>
  readonly ir: StackIR
}

// ═══════════════════════════════════════════════════════
// EVAL PIPELINE
// ═══════════════════════════════════════════════════════

/**
 * Evaluate a formula using READ_CELL opcodes and CellContext.
 *
 * The IR uses READ_CELL to resolve deps at eval time. CellContext
 * is wired from the sheet, so the VM reads live cell values.
 */
function evalFormula(
  sheet: ReturnType<typeof makeSheet>,
  addr: string,
  entry: FormulaEntry,
): void {
  // Build CellContext from sheet
  const ctx = {
    readCell: (a: string) => sheet.getVM(a),
    writeCell: (a: string, v: VMValue) => sheet.set(a, vmToCell(v)),
  }

  // Build IR: READ_CELL for each dep, then expression ops
  const ir: StackIR = [
    ...entry.deps.map((dep): StackIR[number] => ({ _tag: "READ_CELL", addr: dep })),
    ...entry.ir,
  ]

  const state = Effect.runSync(evalProgram(ir, ctx))
  const result = state.stack[state.stack.length - 1] ?? num(0)
  sheet.set(addr, vmToCell(result))
}

/**
 * Recalculate all affected formulas after dirty cells change.
 *
 * Uses DepGraph.evalOrder to get topo-sorted formula addresses,
 * then evaluates each in order.
 */
function recalc(
  sheet: ReturnType<typeof makeSheet>,
  graph: ReturnType<typeof makeDepGraph>,
  formulas: Map<string, FormulaEntry>,
  dirty: string[],
): string[] {
  const order = graph.evalOrder(dirty)
  for (const addr of order) {
    const entry = formulas.get(addr)
    if (entry) {
      evalFormula(sheet, addr, entry)
    }
  }
  return order as string[]
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe("VM Integration — full pipeline", () => {
  it("single formula: C1 = A1 + B1", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    // Data cells
    sheet.set("A1", CV.num(10))
    sheet.set("B1", CV.num(20))

    // Register formula: C1 = deps[0] + deps[1] (ADD pops two, pushes sum)
    // The deps are pushed first, then ADD operates on them
    const ir = compileExprSync("+") // just the ADD opcode
    await Effect.runPromise(graph.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
    formulas.set("C1", { src: "=A1+B1", deps: ["A1", "B1"], ir })

    // Initial eval
    recalc(sheet, graph, formulas, ["A1", "B1"])
    expect(sheet.get("C1")).toEqual(CV.num(30))
  })

  it("chained formulas: C1 = A1+B1, D1 = C1*2", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(5))
    sheet.set("B1", CV.num(3))

    // C1 = A1 + B1
    await Effect.runPromise(graph.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
    formulas.set("C1", { src: "=A1+B1", deps: ["A1", "B1"], ir: compileExprSync("+") })

    // D1 = C1 * 2 (push dep C1, push 2, multiply)
    await Effect.runPromise(graph.registerFormula("D1", "=C1*2", ["C1"]))
    formulas.set("D1", { src: "=C1*2", deps: ["C1"], ir: compileExprSync("2 *") })

    // Initial eval
    recalc(sheet, graph, formulas, ["A1", "B1"])
    expect(sheet.get("C1")).toEqual(CV.num(8))
    expect(sheet.get("D1")).toEqual(CV.num(16))
  })

  it("data change triggers cascading recalc", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(10))
    sheet.set("B1", CV.num(5))

    await Effect.runPromise(graph.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
    formulas.set("C1", { src: "=A1+B1", deps: ["A1", "B1"], ir: compileExprSync("+") })

    await Effect.runPromise(graph.registerFormula("D1", "=C1*2", ["C1"]))
    formulas.set("D1", { src: "=C1*2", deps: ["C1"], ir: compileExprSync("2 *") })

    // Initial
    recalc(sheet, graph, formulas, ["A1", "B1"])
    expect(sheet.get("C1")).toEqual(CV.num(15))
    expect(sheet.get("D1")).toEqual(CV.num(30))

    // Change A1 from 10 → 100
    sheet.set("A1", CV.num(100))
    const affected = recalc(sheet, graph, formulas, ["A1"])

    // C1 = 100 + 5 = 105
    expect(sheet.get("C1")).toEqual(CV.num(105))
    // D1 = 105 * 2 = 210
    expect(sheet.get("D1")).toEqual(CV.num(210))
    // Both formulas were recalculated
    expect(affected).toContain("C1")
    expect(affected).toContain("D1")
  })

  it("error propagation through formula chain", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(10))
    sheet.set("B1", CV.num(0))

    // C1 = A1 / B1 (will be DIV/0)
    await Effect.runPromise(graph.registerFormula("C1", "=A1/B1", ["A1", "B1"]))
    formulas.set("C1", { src: "=A1/B1", deps: ["A1", "B1"], ir: compileExprSync("/") })

    // D1 = C1 + 1 (should propagate the error)
    await Effect.runPromise(graph.registerFormula("D1", "=C1+1", ["C1"]))
    formulas.set("D1", { src: "=C1+1", deps: ["C1"], ir: compileExprSync("1 +") })

    recalc(sheet, graph, formulas, ["A1", "B1"])

    // C1 should be an error
    const c1 = sheet.get("C1")
    expect(c1._tag).toBe("Error")

    // D1 should also be an error (propagated from C1)
    // READ_CELL reads C1's CellError → cellToVM converts to vmError("GENERAL") →
    // ADD propagates the error (error propagation rule in dispatch)
    const d1 = sheet.get("D1")
    expect(d1._tag).toBe("Error") // Error propagated from C1 through ADD
  })

  it("circular dependency rejected", async () => {
    const graph = makeDepGraph()
    await Effect.runPromise(graph.registerFormula("B1", "=A1", ["A1"]))

    const result = await Effect.runPromise(
      graph.registerFormula("A1", "=B1", ["B1"]).pipe(
        Effect.catch((e) => Effect.succeed(e)),
      )
    )
    expect(result._tag).toBe("CircularDepError")
  })

  it("diamond dependency evaluates correctly", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(10))

    // B1 = A1 + 1
    await Effect.runPromise(graph.registerFormula("B1", "=A1+1", ["A1"]))
    formulas.set("B1", { src: "=A1+1", deps: ["A1"], ir: compileExprSync("1 +") })

    // C1 = A1 * 2
    await Effect.runPromise(graph.registerFormula("C1", "=A1*2", ["A1"]))
    formulas.set("C1", { src: "=A1*2", deps: ["A1"], ir: compileExprSync("2 *") })

    // D1 = B1 + C1 (diamond: both B1 and C1 depend on A1)
    await Effect.runPromise(graph.registerFormula("D1", "=B1+C1", ["B1", "C1"]))
    formulas.set("D1", { src: "=B1+C1", deps: ["B1", "C1"], ir: compileExprSync("+") })

    recalc(sheet, graph, formulas, ["A1"])

    expect(sheet.get("B1")).toEqual(CV.num(11))  // 10 + 1
    expect(sheet.get("C1")).toEqual(CV.num(20))  // 10 * 2
    expect(sheet.get("D1")).toEqual(CV.num(31))  // 11 + 20
  })

  it("multiple data changes in single recalc", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(1))
    sheet.set("B1", CV.num(2))
    sheet.set("C1", CV.num(3))

    // D1 = SUM(A1, B1, C1) — push 3 deps, SUM_N 3
    await Effect.runPromise(graph.registerFormula("D1", "=SUM(A1:C1)", ["A1", "B1", "C1"]))
    formulas.set("D1", { src: "=SUM(A1:C1)", deps: ["A1", "B1", "C1"], ir: [{ _tag: "SUM_N", n: 3 }] as StackIR })

    recalc(sheet, graph, formulas, ["A1", "B1", "C1"])
    expect(sheet.get("D1")).toEqual(CV.num(6))

    // Change A1 and C1 simultaneously
    sheet.set("A1", CV.num(10))
    sheet.set("C1", CV.num(30))
    recalc(sheet, graph, formulas, ["A1", "C1"])

    expect(sheet.get("D1")).toEqual(CV.num(42)) // 10 + 2 + 30
  })

  it("unregister removes formula from recalc", async () => {
    const sheet = makeSheet()
    const graph = makeDepGraph()
    const formulas = new Map<string, FormulaEntry>()

    sheet.set("A1", CV.num(10))

    await Effect.runPromise(graph.registerFormula("B1", "=A1*2", ["A1"]))
    formulas.set("B1", { src: "=A1*2", deps: ["A1"], ir: compileExprSync("2 *") })

    recalc(sheet, graph, formulas, ["A1"])
    expect(sheet.get("B1")).toEqual(CV.num(20))

    // Unregister B1
    graph.unregister("B1")
    formulas.delete("B1")

    // Change A1
    sheet.set("A1", CV.num(100))
    const affected = recalc(sheet, graph, formulas, ["A1"])
    expect(affected).toEqual([]) // Nothing to recalc

    // B1 still has old value (20) — it's now a data cell
    expect(sheet.get("B1")).toEqual(CV.num(20))
  })
})
