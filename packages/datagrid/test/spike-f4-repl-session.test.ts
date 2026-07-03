/**
 * Spike F4 — REPL Session & Agent API Design
 *
 * Domain D: Three Agent API surfaces for the Formula DSL.
 *
 * Tests a minimal stack-based REPL session that agents interact with
 * programmatically — no human REPL UX, just a stateful compute context.
 *
 * Hypotheses:
 *   H1: Stack session supports push/pop/eval/show (basic REPL)
 *   H2: Multiple concurrent sessions maintain isolated state
 *   H3: Cell RPC operations work statelessly on a mock CellCache
 *   H4: DataFrame-style column ops compose naturally
 *   H5: The three APIs can compose (REPL uses Cell RPC under the hood)
 *   H6: Session state is serializable (for persistence/transfer)
 *
 * @module spike-f4-repl-session
 */

import { describe, it, expect, beforeEach } from "vitest"

// ─── Types ──────────────────────────────────────────

type StackValue = number | string | boolean | CellRef | RangeRef | ErrorValue

interface CellRef {
  readonly _tag: "CellRef"
  readonly addr: string // A1 notation
}

interface RangeRef {
  readonly _tag: "RangeRef"
  readonly range: string // "A1:C10"
}

interface ErrorValue {
  readonly _tag: "Error"
  readonly message: string
}

const cellRef = (addr: string): CellRef => ({ _tag: "CellRef", addr })
const rangeRef = (range: string): RangeRef => ({ _tag: "RangeRef", range })
const errorVal = (msg: string): ErrorValue => ({ _tag: "Error", message: msg })

// ─── REPL Session (H1, H2) ─────────────────────────

interface SessionSnapshot {
  readonly id: string
  readonly stack: readonly StackValue[]
  readonly trail: readonly string[]
  readonly registers: Record<string, StackValue>
}

class ReplSession {
  readonly id: string
  private stack: StackValue[] = []
  private trail: string[] = []
  private registers: Record<string, StackValue> = {}
  private cellResolver: CellRpc | null = null

  constructor(id: string, cellRpc?: CellRpc) {
    this.id = id
    this.cellResolver = cellRpc ?? null
  }

  // ─── Stack ops ──────────────────────────────────

  push(value: StackValue): this {
    this.stack.push(value)
    this.trail.push(`PUSH ${this.formatValue(value)}`)
    return this
  }

  pop(): StackValue {
    if (this.stack.length === 0) {
      const err = errorVal("Stack underflow")
      this.trail.push("POP → underflow")
      return err
    }
    const val = this.stack.pop()!
    this.trail.push(`POP → ${this.formatValue(val)}`)
    return val
  }

  peek(): StackValue | undefined {
    return this.stack[this.stack.length - 1]
  }

  // ─── Eval ops ───────────────────────────────────

  eval(op: string): this {
    const ops: Record<string, () => void> = {
      "+": () => this.binaryNumOp((a, b) => a + b, "+"),
      "-": () => this.binaryNumOp((a, b) => a - b, "-"),
      "*": () => this.binaryNumOp((a, b) => a * b, "*"),
      "/": () => this.binaryNumOp((a, b) => {
        if (b === 0) throw new Error("Division by zero")
        return a / b
      }, "/"),
      "DUP": () => {
        const top = this.peek()
        if (top === undefined) { this.push(errorVal("DUP on empty stack")); return }
        this.stack.push(top)
        this.trail.push(`DUP → ${this.formatValue(top)}`)
      },
      "SWAP": () => {
        if (this.stack.length < 2) { this.push(errorVal("SWAP: need 2")); return }
        const a = this.stack.pop()!
        const b = this.stack.pop()!
        this.stack.push(a, b)
        this.trail.push("SWAP")
      },
      "DROP": () => {
        if (this.stack.length === 0) { this.push(errorVal("DROP on empty stack")); return }
        this.stack.pop()
        this.trail.push("DROP")
      },
      "CLEAR": () => {
        this.stack = []
        this.trail.push("CLEAR")
      },
      "SUM": () => {
        const sum = this.stack.reduce((acc, v) => acc + this.toNumber(v), 0)
        this.stack = [sum]
        this.trail.push(`SUM → ${sum}`)
      },
      "STORE": () => {
        if (this.stack.length < 2) { this.push(errorVal("STORE: need name + value")); return }
        const name = this.pop()
        const value = this.pop()
        if (typeof name !== "string") { this.push(errorVal("STORE: name must be string")); return }
        this.registers[name] = value
        this.trail.push(`STORE ${name} ← ${this.formatValue(value)}`)
      },
      "LOAD": () => {
        const name = this.pop()
        if (typeof name !== "string") { this.push(errorVal("LOAD: name must be string")); return }
        const val = this.registers[name]
        if (val === undefined) { this.push(errorVal(`LOAD: unknown register '${name}'`)); return }
        this.push(val)
      },
      "READ_CELL": () => {
        const addr = this.pop()
        if (!this.cellResolver) { this.push(errorVal("No CellRpc attached")); return }
        if (typeof addr === "object" && addr._tag === "CellRef") {
          const val = this.cellResolver.readCell(addr.addr)
          this.push(val)
          this.trail.push(`READ_CELL ${addr.addr} → ${this.formatValue(val)}`)
        } else if (typeof addr === "string") {
          const val = this.cellResolver.readCell(addr)
          this.push(val)
          this.trail.push(`READ_CELL ${addr} → ${this.formatValue(val)}`)
        } else {
          this.push(errorVal("READ_CELL: invalid address"))
        }
      },
    }

    const handler = ops[op]
    if (!handler) {
      this.push(errorVal(`Unknown op: ${op}`))
      this.trail.push(`ERR: unknown op '${op}'`)
      return this
    }

    try {
      handler()
    } catch (e: any) {
      this.push(errorVal(e.message))
      this.trail.push(`ERR: ${e.message}`)
    }
    return this
  }

  // ─── Introspection ──────────────────────────────

  showStack(): readonly StackValue[] {
    return [...this.stack]
  }

  showTrail(): readonly string[] {
    return [...this.trail]
  }

  depth(): number {
    return this.stack.length
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      stack: [...this.stack],
      trail: [...this.trail],
      registers: { ...this.registers },
    }
  }

  static restore(snap: SessionSnapshot, cellRpc?: CellRpc): ReplSession {
    const session = new ReplSession(snap.id, cellRpc)
    session.stack = [...snap.stack]
    session.trail = [...snap.trail]
    session.registers = { ...snap.registers }
    return session
  }

  // ─── Helpers ────────────────────────────────────

  private binaryNumOp(fn: (a: number, b: number) => number, symbol: string) {
    if (this.stack.length < 2) { this.push(errorVal(`${symbol}: need 2 values`)); return }
    const b = this.toNumber(this.pop())
    const a = this.toNumber(this.pop())
    const result = fn(a, b)
    this.stack.push(result)
    this.trail.push(`${symbol} → ${result}`)
  }

  private toNumber(v: StackValue): number {
    if (typeof v === "number") return v
    if (typeof v === "boolean") return v ? 1 : 0
    if (typeof v === "string") return parseFloat(v) || 0
    return 0
  }

  private formatValue(v: StackValue): string {
    if (typeof v === "object" && "_tag" in v) return `[${v._tag}]`
    return String(v)
  }
}

// ─── Cell RPC (H3) ──────────────────────────────────

interface CellStore {
  [key: string]: StackValue
}

class CellRpc {
  private store: CellStore

  constructor(initial: CellStore = {}) {
    this.store = { ...initial }
  }

  readCell(addr: string): StackValue {
    return this.store[addr] ?? 0
  }

  writeCell(addr: string, value: StackValue): void {
    this.store[addr] = value
  }

  getRange(range: string): StackValue[] {
    // Simple mock: parse "A1:A3" → return [A1, A2, A3]
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    if (!match) return []
    const [, colStart, rowStart, colEnd, rowEnd] = match
    const results: StackValue[] = []
    const rs = parseInt(rowStart)
    const re = parseInt(rowEnd)
    // Single column for simplicity
    for (let r = rs; r <= re; r++) {
      results.push(this.readCell(`${colStart}${r}`))
    }
    return results
  }

  evalFormula(addr: string, formula: string, deps: string[]): StackValue {
    // Minimal: just evaluate simple arithmetic on deps
    const depVals = deps.map(d => this.toNumber(this.readCell(d)))
    if (formula === "SUM") return depVals.reduce((a, b) => a + b, 0)
    if (formula === "AVG") return depVals.reduce((a, b) => a + b, 0) / depVals.length
    return errorVal(`Unknown formula: ${formula}`)
  }

  snapshot(): CellStore {
    return { ...this.store }
  }

  private toNumber(v: StackValue): number {
    return typeof v === "number" ? v : 0
  }
}

// ─── DataFrame API (H4) ─────────────────────────────

type Column = StackValue[]

interface DataFrame {
  readonly columns: Record<string, Column>
  readonly length: number
}

const DataFrame = {
  from(data: Record<string, Column>): DataFrame {
    const lengths = Object.values(data).map(c => c.length)
    const length = lengths[0] ?? 0
    return { columns: data, length }
  },

  select(df: DataFrame, ...cols: string[]): DataFrame {
    const selected: Record<string, Column> = {}
    for (const col of cols) {
      if (df.columns[col]) selected[col] = df.columns[col]
    }
    return DataFrame.from(selected)
  },

  filter(df: DataFrame, predicate: (row: Record<string, StackValue>) => boolean): DataFrame {
    const result: Record<string, Column> = {}
    const colNames = Object.keys(df.columns)
    for (const name of colNames) result[name] = []

    for (let i = 0; i < df.length; i++) {
      const row: Record<string, StackValue> = {}
      for (const name of colNames) row[name] = df.columns[name][i]
      if (predicate(row)) {
        for (const name of colNames) result[name].push(df.columns[name][i])
      }
    }
    return DataFrame.from(result)
  },

  mutate(df: DataFrame, name: string, fn: (row: Record<string, StackValue>, i: number) => StackValue): DataFrame {
    const newCol: Column = []
    const colNames = Object.keys(df.columns)
    for (let i = 0; i < df.length; i++) {
      const row: Record<string, StackValue> = {}
      for (const n of colNames) row[n] = df.columns[n][i]
      newCol.push(fn(row, i))
    }
    return DataFrame.from({ ...df.columns, [name]: newCol })
  },

  summarize(df: DataFrame, col: string, agg: "sum" | "avg" | "min" | "max" | "count"): StackValue {
    const vals = (df.columns[col] ?? []).map(v => typeof v === "number" ? v : 0)
    switch (agg) {
      case "sum": return vals.reduce((a, b) => a + b, 0)
      case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length
      case "min": return Math.min(...vals)
      case "max": return Math.max(...vals)
      case "count": return vals.length
    }
  },

  toRecords(df: DataFrame): Record<string, StackValue>[] {
    const colNames = Object.keys(df.columns)
    const records: Record<string, StackValue>[] = []
    for (let i = 0; i < df.length; i++) {
      const row: Record<string, StackValue> = {}
      for (const name of colNames) row[name] = df.columns[name][i]
      records.push(row)
    }
    return records
  },
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe("Spike F4 — REPL Session & Agent API Design", () => {

  // ─── H1: Basic REPL ──────────────────────────────

  describe("H1: Stack session push/pop/eval/show", () => {
    let session: ReplSession

    beforeEach(() => {
      session = new ReplSession("test-1")
    })

    it("push → peek → pop round-trip", () => {
      session.push(42)
      expect(session.peek()).toBe(42)
      expect(session.depth()).toBe(1)
      expect(session.pop()).toBe(42)
      expect(session.depth()).toBe(0)
    })

    it("basic arithmetic: 3 4 + → 7", () => {
      session.push(3).push(4).eval("+")
      expect(session.showStack()).toEqual([7])
    })

    it("compound: 2 3 * 4 + → 10", () => {
      session.push(2).push(3).eval("*").push(4).eval("+")
      expect(session.showStack()).toEqual([10])
    })

    it("stack manipulation: DUP, SWAP, DROP", () => {
      session.push(10).push(20)
      session.eval("DUP")
      expect(session.showStack()).toEqual([10, 20, 20])

      session.eval("DROP")
      expect(session.showStack()).toEqual([10, 20])

      session.eval("SWAP")
      expect(session.showStack()).toEqual([20, 10])
    })

    it("division by zero pushes error", () => {
      session.push(10).push(0).eval("/")
      const top = session.peek()
      expect(typeof top).toBe("object")
      expect((top as ErrorValue)._tag).toBe("Error")
      expect((top as ErrorValue).message).toContain("Division by zero")
    })

    it("SUM aggregates entire stack", () => {
      session.push(1).push(2).push(3).push(4).eval("SUM")
      expect(session.showStack()).toEqual([10])
    })

    it("trail records all operations", () => {
      session.push(3).push(4).eval("+")
      const trail = session.showTrail()
      // push(3), push(4), pop→4, pop→3, + → 7
      expect(trail.length).toBe(5)
      expect(trail[0]).toContain("PUSH")
      expect(trail[4]).toContain("+")
    })

    it("registers: STORE and LOAD", () => {
      session.push(42).push("x").eval("STORE")
      expect(session.depth()).toBe(0)
      session.push("x").eval("LOAD")
      expect(session.showStack()).toEqual([42])
    })

    it("CLEAR empties stack", () => {
      session.push(1).push(2).push(3).eval("CLEAR")
      expect(session.depth()).toBe(0)
    })
  })

  // ─── H2: Concurrent session isolation ─────────────

  describe("H2: Multiple concurrent sessions are isolated", () => {
    it("two sessions maintain independent stacks", () => {
      const s1 = new ReplSession("agent-alpha")
      const s2 = new ReplSession("agent-beta")

      s1.push(100).push(200).eval("+")
      s2.push(1).push(2).push(3).eval("SUM")

      expect(s1.showStack()).toEqual([300])
      expect(s2.showStack()).toEqual([6])

      // Trails are independent (push×2 + pop×2 + op = 5; push×3 + SUM = 4)
      expect(s1.showTrail().length).toBe(5)
      expect(s2.showTrail().length).toBe(4)
    })

    it("session registers don't leak", () => {
      const s1 = new ReplSession("s1")
      const s2 = new ReplSession("s2")

      s1.push(42).push("shared-name").eval("STORE")
      s2.push("shared-name").eval("LOAD")

      const top = s2.peek()
      expect((top as ErrorValue)._tag).toBe("Error") // not found in s2
    })
  })

  // ─── H3: Cell RPC ────────────────────────────────

  describe("H3: Stateless Cell RPC operations", () => {
    let rpc: CellRpc

    beforeEach(() => {
      rpc = new CellRpc({
        A1: 10,
        A2: 20,
        A3: 30,
        B1: 100,
        B2: 200,
      })
    })

    it("readCell returns stored value", () => {
      expect(rpc.readCell("A1")).toBe(10)
      expect(rpc.readCell("Z99")).toBe(0) // default
    })

    it("writeCell + readCell round-trip", () => {
      rpc.writeCell("C1", 999)
      expect(rpc.readCell("C1")).toBe(999)
    })

    it("getRange returns column values", () => {
      const vals = rpc.getRange("A1:A3")
      expect(vals).toEqual([10, 20, 30])
    })

    it("evalFormula: SUM over deps", () => {
      const result = rpc.evalFormula("C1", "SUM", ["A1", "A2", "A3"])
      expect(result).toBe(60)
    })

    it("evalFormula: AVG over deps", () => {
      const result = rpc.evalFormula("C1", "AVG", ["A1", "A2", "A3"])
      expect(result).toBe(20)
    })
  })

  // ─── H4: DataFrame column ops ─────────────────────

  describe("H4: DataFrame-style column operations", () => {
    let df: DataFrame

    beforeEach(() => {
      df = DataFrame.from({
        name: ["Alice", "Bob", "Carol", "Dan"],
        age: [30, 25, 35, 28],
        score: [95, 87, 92, 78],
      })
    })

    it("select picks columns", () => {
      const selected = DataFrame.select(df, "name", "score")
      expect(Object.keys(selected.columns)).toEqual(["name", "score"])
      expect(selected.length).toBe(4)
    })

    it("filter rows by predicate", () => {
      const older = DataFrame.filter(df, row => (row.age as number) >= 30)
      expect(older.length).toBe(2)
      expect(older.columns.name).toEqual(["Alice", "Carol"])
    })

    it("mutate adds computed column", () => {
      const withGrade = DataFrame.mutate(df, "grade", row => {
        const s = row.score as number
        return s >= 90 ? "A" : s >= 80 ? "B" : "C"
      })
      expect(withGrade.columns.grade).toEqual(["A", "B", "A", "C"])
      expect(withGrade.length).toBe(4)
    })

    it("summarize aggregates column", () => {
      expect(DataFrame.summarize(df, "score", "sum")).toBe(352)
      expect(DataFrame.summarize(df, "score", "avg")).toBe(88)
      expect(DataFrame.summarize(df, "score", "min")).toBe(78)
      expect(DataFrame.summarize(df, "score", "max")).toBe(95)
      expect(DataFrame.summarize(df, "age", "count")).toBe(4)
    })

    it("operations compose: filter → mutate → summarize", () => {
      const result = DataFrame.summarize(
        DataFrame.mutate(
          DataFrame.filter(df, row => (row.age as number) >= 28),
          "bonus",
          row => (row.score as number) * 1.1,
        ),
        "bonus",
        "avg",
      )
      expect(result).toBeCloseTo(97.17, 1) // (95*1.1 + 92*1.1 + 78*1.1) / 3
    })
  })

  // ─── H5: API composition ──────────────────────────

  describe("H5: REPL + Cell RPC compose", () => {
    it("REPL session reads cells via Cell RPC", () => {
      const rpc = new CellRpc({ A1: 10, B1: 25 })
      const session = new ReplSession("composed-1", rpc)

      session.push(cellRef("A1")).eval("READ_CELL")
      session.push(cellRef("B1")).eval("READ_CELL")
      session.eval("+")

      expect(session.showStack()).toEqual([35])
    })

    it("REPL computes formula across cell values", () => {
      const rpc = new CellRpc({ A1: 100, A2: 200, A3: 300 })
      const session = new ReplSession("composed-2", rpc)

      // Read three cells and sum them
      session.push(cellRef("A1")).eval("READ_CELL")
      session.push(cellRef("A2")).eval("READ_CELL")
      session.push(cellRef("A3")).eval("READ_CELL")
      session.eval("SUM")

      expect(session.showStack()).toEqual([600])
    })
  })

  // ─── H6: Session serialization ────────────────────

  describe("H6: Session state is serializable", () => {
    it("snapshot → restore round-trip preserves state", () => {
      const original = new ReplSession("persistent-1")
      original.push(42).push(7).eval("+")
      original.push(100).push("myVar").eval("STORE")

      const snap = original.snapshot()
      const json = JSON.stringify(snap)
      const parsed = JSON.parse(json) as SessionSnapshot

      const restored = ReplSession.restore(parsed)
      expect(restored.showStack()).toEqual(original.showStack())
      expect(restored.showTrail()).toEqual(original.showTrail())
      expect(restored.id).toBe("persistent-1")
    })

    it("restored session can continue operations", () => {
      const s1 = new ReplSession("s1")
      s1.push(10).push(20)

      const snap = s1.snapshot()
      const s2 = ReplSession.restore(snap)
      s2.eval("+").push(5).eval("*")

      expect(s2.showStack()).toEqual([150])
      // Original unaffected
      expect(s1.showStack()).toEqual([10, 20])
    })
  })

  // ─── Performance ──────────────────────────────────

  describe("Performance baseline", () => {
    it("10K push+eval cycles under 50ms", () => {
      const session = new ReplSession("perf-1")
      const start = performance.now()

      for (let i = 0; i < 10_000; i++) {
        session.push(i).push(1).eval("+").pop()
      }

      const elapsed = performance.now() - start
      console.log(`  10K REPL cycles: ${elapsed.toFixed(2)}ms (${(10_000 / elapsed * 1000).toFixed(0)} ops/sec)`)
      expect(elapsed).toBeLessThan(50)
    })
  })
})
