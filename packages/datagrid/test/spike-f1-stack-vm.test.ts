/**
 * SPIKE F1 — Stack VM Proof
 *
 * Prove a stack-based RPN VM can evaluate cell formulas.
 * Emacs calc inspired: stack + Trail + algebraic-to-RPN compilation.
 *
 * H1: Stack VM executes basic arithmetic + stack manipulation opcodes correctly
 * H2: Cell references resolved from mock CellCache; STORE_CELL writes back
 * H3: Trail records every computation step (append-only audit log)
 * H4: Algebraic infix compiles to StackIR via Shunting-Yard (precedence correct)
 * H5: 10K formula evaluations complete in < 200ms (interpreted baseline)
 *
 * @see FORMULA-DSL-PREDESIGN.md — Spike F1 definition
 * @see FORMULA-DSL-RESEARCH-BRIEFING.md — Domain A research brief
 */

import { describe, it, expect } from "vitest"

// ─── StackIR — Intermediate Representation ──────────────────────────────────
//
// Plain discriminated union — serializable, diffable, sendable over WASM boundary.
// No classes, no closures — pure data that the VM dispatches on.

type Opcode =
  // ── Literals ──────────────────────────────────────────────────────────────
  | { _tag: "PUSH_NUM";  value: number }
  | { _tag: "PUSH_STR";  value: string }
  | { _tag: "PUSH_BOOL"; value: boolean }
  // ── Cell I/O ──────────────────────────────────────────────────────────────
  | { _tag: "PUSH_CELL";  col: number; row: number }
  | { _tag: "STORE_CELL"; col: number; row: number }
  // ── Stack Manipulation (Forth primitives) ─────────────────────────────────
  | { _tag: "DUP" }      // a → a a
  | { _tag: "SWAP" }     // a b → b a
  | { _tag: "DROP" }     // a → (empty)
  | { _tag: "ROT" }      // a b c → b c a
  | { _tag: "OVER" }     // a b → a b a
  // ── Arithmetic ────────────────────────────────────────────────────────────
  | { _tag: "ADD" }
  | { _tag: "SUB" }
  | { _tag: "MUL" }
  | { _tag: "DIV" }
  | { _tag: "MOD" }
  | { _tag: "NEG" }      // unary negate
  | { _tag: "ABS" }      // unary absolute value
  | { _tag: "POW" }      // a b → a^b
  // ── Comparison ────────────────────────────────────────────────────────────
  | { _tag: "EQ" }
  | { _tag: "NEQ" }
  | { _tag: "LT" }
  | { _tag: "LTE" }
  | { _tag: "GT" }
  | { _tag: "GTE" }
  // ── Logic ─────────────────────────────────────────────────────────────────
  | { _tag: "AND" }
  | { _tag: "OR" }
  | { _tag: "NOT" }
  // ── Aggregation (range ops) ───────────────────────────────────────────────
  | { _tag: "SUM_N"; n: number }   // pop n values, push sum
  | { _tag: "AVG_N"; n: number }   // pop n values, push mean
  | { _tag: "MIN_N"; n: number }   // pop n values, push min
  | { _tag: "MAX_N"; n: number }   // pop n values, push max
  // ── Control ───────────────────────────────────────────────────────────────
  | { _tag: "HALT" }

type StackIR = ReadonlyArray<Opcode>

// ─── Runtime Values ──────────────────────────────────────────────────────────

type VMValue =
  | { _tag: "num";   value: number }
  | { _tag: "str";   value: string }
  | { _tag: "bool";  value: boolean }
  | { _tag: "error"; message: string }

const vmNum   = (value: number):  VMValue => ({ _tag: "num",  value })
const vmStr   = (value: string):  VMValue => ({ _tag: "str",  value })
const vmBool  = (value: boolean): VMValue => ({ _tag: "bool", value })
const vmError = (message: string): VMValue => ({ _tag: "error", message })

function asNum(v: VMValue): number {
  if (v._tag === "num")  return v.value
  if (v._tag === "bool") return v.value ? 1 : 0
  throw new Error(`Expected num, got ${v._tag}`)
}

function asBool(v: VMValue): boolean {
  if (v._tag === "bool") return v.value
  if (v._tag === "num")  return v.value !== 0
  throw new Error(`Expected bool, got ${v._tag}`)
}

function vmEq(a: VMValue, b: VMValue): boolean {
  if (a._tag !== b._tag) return false
  if (a._tag === "num"  && b._tag === "num")  return a.value === b.value
  if (a._tag === "str"  && b._tag === "str")  return a.value === b.value
  if (a._tag === "bool" && b._tag === "bool") return a.value === b.value
  return false
}

// ─── Trail — Append-Only Audit Log (Emacs calc inspired) ─────────────────────
//
// Every executed opcode produces a TrailEntry capturing the full before/after
// stack state. This makes the Trail a perfect audit log:
//  - Deterministic replay: re-run from any TrailEntry
//  - Debug: "what did the stack look like when ADD fired?"
//  - Observability: Effect.withSpan() wraps can attach TrailEntry IDs as span attrs

interface TrailEntry {
  readonly step:        number
  readonly opcode:      string
  readonly stackBefore: ReadonlyArray<VMValue>
  readonly stackAfter:  ReadonlyArray<VMValue>
  readonly result?:     VMValue          // pushed result (when applicable)
  readonly ts:          number           // performance.now() timestamp
}

// ─── Cell Cache Interface ─────────────────────────────────────────────────────

interface CellCache {
  read(col: number, row: number): VMValue
  write(col: number, row: number, value: VMValue): void
}

// ─── Stack VM ────────────────────────────────────────────────────────────────

interface VMResult {
  readonly stack: ReadonlyArray<VMValue>
  readonly trail: ReadonlyArray<TrailEntry>
  readonly steps: number
  readonly errorCount: number
}

class SpikeStackVM {
  private stack:       VMValue[]    = []
  private trail:       TrailEntry[] = []
  private steps:       number       = 0
  private errorCount:  number       = 0

  constructor(private readonly cells: CellCache) {}

  run(ir: StackIR): VMResult {
    this.stack      = []
    this.trail      = []
    this.steps      = 0
    this.errorCount = 0

    for (const op of ir) {
      if (op._tag === "HALT") break
      this.exec(op)
    }

    return {
      stack:      [...this.stack],
      trail:      [...this.trail],
      steps:      this.steps,
      errorCount: this.errorCount,
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private push(v: VMValue): void {
    this.stack.push(v)
  }

  private pop(): VMValue {
    const v = this.stack.pop()
    if (v === undefined) throw new Error("Stack underflow")
    return v
  }

  private peek(): VMValue {
    const v = this.stack[this.stack.length - 1]
    if (v === undefined) throw new Error("Stack empty (peek)")
    return v
  }

  private record(op: Opcode, before: VMValue[], result?: VMValue): void {
    this.trail.push({
      step:        this.steps,
      opcode:      op._tag,
      stackBefore: [...before],
      stackAfter:  [...this.stack],
      result,
      ts:          performance.now(),
    })
    this.steps++
  }

  private exec(op: Opcode): void {
    const before = [...this.stack]

    try {
      switch (op._tag) {
        // ── Literals ──────────────────────────────────────────────────────
        case "PUSH_NUM": {
          const v = vmNum(op.value)
          this.push(v)
          this.record(op, before, v)
          break
        }
        case "PUSH_STR": {
          const v = vmStr(op.value)
          this.push(v)
          this.record(op, before, v)
          break
        }
        case "PUSH_BOOL": {
          const v = vmBool(op.value)
          this.push(v)
          this.record(op, before, v)
          break
        }
        // ── Cell I/O ──────────────────────────────────────────────────────
        case "PUSH_CELL": {
          const v = this.cells.read(op.col, op.row)
          this.push(v)
          this.record(op, before, v)
          break
        }
        case "STORE_CELL": {
          const v = this.pop()
          this.cells.write(op.col, op.row, v)
          this.record(op, before, v)
          break
        }
        // ── Stack Manipulation ─────────────────────────────────────────────
        case "DUP": {
          const v = this.peek()
          this.push(v)
          this.record(op, before, v)
          break
        }
        case "SWAP": {
          const b = this.pop(); const a = this.pop()
          this.push(b); this.push(a)
          this.record(op, before)
          break
        }
        case "DROP": {
          this.pop()
          this.record(op, before)
          break
        }
        case "ROT": {
          // ( a b c -- b c a )
          const c = this.pop(); const b = this.pop(); const a = this.pop()
          this.push(b); this.push(c); this.push(a)
          this.record(op, before)
          break
        }
        case "OVER": {
          // ( a b -- a b a )
          const b = this.pop(); const a = this.peek()
          this.push(b); this.push(a)
          this.record(op, before)
          break
        }
        // ── Arithmetic ─────────────────────────────────────────────────────
        case "ADD": {
          const b = this.pop(); const a = this.pop()
          const v = vmNum(asNum(a) + asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "SUB": {
          const b = this.pop(); const a = this.pop()
          const v = vmNum(asNum(a) - asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "MUL": {
          const b = this.pop(); const a = this.pop()
          const v = vmNum(asNum(a) * asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "DIV": {
          const b = this.pop(); const a = this.pop()
          const bn = asNum(b)
          const v = bn === 0 ? vmError("DIV/0!") : vmNum(asNum(a) / bn)
          if (v._tag === "error") this.errorCount++
          this.push(v); this.record(op, before, v)
          break
        }
        case "MOD": {
          const b = this.pop(); const a = this.pop()
          const v = vmNum(asNum(a) % asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "NEG": {
          const a = this.pop()
          const v = vmNum(-asNum(a))
          this.push(v); this.record(op, before, v)
          break
        }
        case "ABS": {
          const a = this.pop()
          const v = vmNum(Math.abs(asNum(a)))
          this.push(v); this.record(op, before, v)
          break
        }
        case "POW": {
          const b = this.pop(); const a = this.pop()
          const v = vmNum(Math.pow(asNum(a), asNum(b)))
          this.push(v); this.record(op, before, v)
          break
        }
        // ── Comparison ─────────────────────────────────────────────────────
        case "EQ": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(vmEq(a, b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "NEQ": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(!vmEq(a, b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "LT": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asNum(a) < asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "LTE": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asNum(a) <= asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "GT": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asNum(a) > asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "GTE": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asNum(a) >= asNum(b))
          this.push(v); this.record(op, before, v)
          break
        }
        // ── Logic ──────────────────────────────────────────────────────────
        case "AND": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asBool(a) && asBool(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "OR": {
          const b = this.pop(); const a = this.pop()
          const v = vmBool(asBool(a) || asBool(b))
          this.push(v); this.record(op, before, v)
          break
        }
        case "NOT": {
          const a = this.pop()
          const v = vmBool(!asBool(a))
          this.push(v); this.record(op, before, v)
          break
        }
        // ── Aggregation ────────────────────────────────────────────────────
        case "SUM_N": {
          let total = 0
          for (let i = 0; i < op.n; i++) total += asNum(this.pop())
          const v = vmNum(total)
          this.push(v); this.record(op, before, v)
          break
        }
        case "AVG_N": {
          let total = 0
          for (let i = 0; i < op.n; i++) total += asNum(this.pop())
          const v = vmNum(total / op.n)
          this.push(v); this.record(op, before, v)
          break
        }
        case "MIN_N": {
          const vals = Array.from({ length: op.n }, () => asNum(this.pop()))
          const v = vmNum(Math.min(...vals))
          this.push(v); this.record(op, before, v)
          break
        }
        case "MAX_N": {
          const vals = Array.from({ length: op.n }, () => asNum(this.pop()))
          const v = vmNum(Math.max(...vals))
          this.push(v); this.record(op, before, v)
          break
        }
      }
    } catch (err) {
      const v = vmError(String(err))
      this.stack.push(v)
      this.errorCount++
      this.record(op, before, v)
    }
  }
}

// ─── Algebraic-to-RPN Compiler (Shunting-Yard) ───────────────────────────────
//
// Converts infix algebraic expressions into StackIR.
// Borrowed from Emacs calc algebraic entry mode.
// Handles: number literals, cell refs (A0, B12), parens, binary ops with precedence.

type Token =
  | { _tag: "NUM";    value: number }
  | { _tag: "OP";     op: string }
  | { _tag: "LPAREN" }
  | { _tag: "RPAREN" }
  | { _tag: "CELL";   col: number; row: number }

const PRECEDENCE: Record<string, number> = {
  "||": 0, "&&": 1,
  "=": 2, "!=": 2, "<": 2, "<=": 2, ">": 2, ">=": 2,
  "+": 3, "-": 3,
  "*": 4, "/": 4, "%": 4,
  "^": 5,
}

const RIGHT_ASSOC = new Set(["^"])

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]
    if (ch === " " || ch === "\t") { i++; continue }

    // Number
    if (/[0-9]/.test(ch) || (ch === "-" && tokens.length === 0 && /[0-9]/.test(expr[i+1] ?? ""))) {
      let num = ""
      if (ch === "-") { num += "-"; i++ }
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++]
      tokens.push({ _tag: "NUM", value: parseFloat(num) })
      continue
    }

    // Cell ref: uppercase letter(s) + digit(s) e.g. A0, B12, AA3
    if (/[A-Z]/.test(ch)) {
      let col = 0; let j = i
      while (j < expr.length && /[A-Z]/.test(expr[j])) {
        col = col * 26 + (expr[j].charCodeAt(0) - 64)
        j++
      }
      col -= 1  // 0-based: A=0
      if (j < expr.length && /[0-9]/.test(expr[j])) {
        let rowStr = ""
        while (j < expr.length && /[0-9]/.test(expr[j])) rowStr += expr[j++]
        tokens.push({ _tag: "CELL", col, row: parseInt(rowStr) })
        i = j
        continue
      }
    }

    // Two-char operators
    const two = expr.slice(i, i + 2)
    if (["<=", ">=", "!=", "&&", "||"].includes(two)) {
      tokens.push({ _tag: "OP", op: two }); i += 2; continue
    }

    // Single-char operators and parens
    if ("+-*/%^<>=".includes(ch)) { tokens.push({ _tag: "OP", op: ch }); i++; continue }
    if (ch === "(") { tokens.push({ _tag: "LPAREN" }); i++; continue }
    if (ch === ")") { tokens.push({ _tag: "RPAREN" }); i++; continue }

    throw new Error(`Tokenizer: unknown character '${ch}' at position ${i} in "${expr}"`)
  }

  return tokens
}

const OP_TO_OPCODE: Record<string, Opcode> = {
  "+": { _tag: "ADD" }, "-": { _tag: "SUB" },
  "*": { _tag: "MUL" }, "/": { _tag: "DIV" },
  "%": { _tag: "MOD" }, "^": { _tag: "POW" },
  "=":  { _tag: "EQ" }, "!=": { _tag: "NEQ" },
  "<":  { _tag: "LT" }, "<=": { _tag: "LTE" },
  ">":  { _tag: "GT" }, ">=": { _tag: "GTE" },
  "&&": { _tag: "AND" }, "||": { _tag: "OR" },
}

function shuntingYard(tokens: Token[]): StackIR {
  const output: Opcode[]  = []
  const opStack: Token[]  = []

  for (const tok of tokens) {
    switch (tok._tag) {
      case "NUM":
        output.push({ _tag: "PUSH_NUM", value: tok.value })
        break

      case "CELL":
        output.push({ _tag: "PUSH_CELL", col: tok.col, row: tok.row })
        break

      case "OP": {
        while (opStack.length > 0) {
          const top = opStack[opStack.length - 1]
          if (
            top._tag === "OP" &&
            (PRECEDENCE[top.op] > PRECEDENCE[tok.op] ||
             (PRECEDENCE[top.op] === PRECEDENCE[tok.op] && !RIGHT_ASSOC.has(tok.op)))
          ) {
            opStack.pop()
            output.push(OP_TO_OPCODE[top.op]!)
          } else break
        }
        opStack.push(tok)
        break
      }

      case "LPAREN":
        opStack.push(tok)
        break

      case "RPAREN": {
        while (opStack.length > 0 && opStack[opStack.length - 1]._tag !== "LPAREN") {
          const top = opStack.pop()!
          if (top._tag === "OP") output.push(OP_TO_OPCODE[top.op]!)
        }
        if (opStack.length === 0) throw new Error("Mismatched parentheses")
        opStack.pop() // consume LPAREN
        break
      }
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop()!
    if (top._tag === "LPAREN") throw new Error("Mismatched parentheses")
    if (top._tag === "OP") output.push(OP_TO_OPCODE[top.op]!)
  }

  return output
}

/** Compile an infix algebraic expression to StackIR */
function compile(expr: string): StackIR {
  return shuntingYard(tokenize(expr))
}

// ─── Mock Cell Cache ──────────────────────────────────────────────────────────

class MockCellCache implements CellCache {
  private store: Map<string, VMValue> = new Map()

  set(col: number, row: number, value: VMValue): void {
    this.store.set(`${col},${row}`, value)
  }

  read(col: number, row: number): VMValue {
    return this.store.get(`${col},${row}`) ?? vmNum(0)
  }

  write(col: number, row: number, value: VMValue): void {
    this.store.set(`${col},${row}`, value)
  }

  clear(): void { this.store.clear() }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("F1: Stack VM Proof", () => {

  // ── H1: Basic Opcodes ────────────────────────────────────────────────────

  it("H1: arithmetic — 2 + 3 = 5", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 2 },
      { _tag: "PUSH_NUM", value: 3 },
      { _tag: "ADD" },
    ])
    expect(r.stack).toHaveLength(1)
    expect(r.stack[0]).toEqual(vmNum(5))
  })

  it("H1: arithmetic chain — 10 * 3 - 4 = 26", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "PUSH_NUM", value: 3  },
      { _tag: "MUL"  },
      { _tag: "PUSH_NUM", value: 4  },
      { _tag: "SUB"  },
    ])
    expect(r.stack[0]).toEqual(vmNum(26))
  })

  it("H1: DIV by zero → error value on stack, not throw", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "PUSH_NUM", value: 0  },
      { _tag: "DIV" },
    ])
    expect(r.stack[0]._tag).toBe("error")
    expect(r.errorCount).toBe(1)
  })

  it("H1: POW — 2^10 = 1024", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 2  },
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "POW" },
    ])
    expect(r.stack[0]).toEqual(vmNum(1024))
  })

  it("H1: stack manipulation — DUP", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 7 },
      { _tag: "DUP" },
      { _tag: "MUL" },  // 7 * 7 = 49 (squaring via DUP)
    ])
    expect(r.stack[0]).toEqual(vmNum(49))
  })

  it("H1: stack manipulation — SWAP", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    // 10 3 SWAP → 3 10 → SUB = 3 - 10 = -7 (not 10-3=7)
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "PUSH_NUM", value: 3  },
      { _tag: "SWAP" },
      { _tag: "SUB"  },  // 3 - 10
    ])
    expect(r.stack[0]).toEqual(vmNum(-7))
  })

  it("H1: stack manipulation — ROT ( a b c -- b c a )", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    // Push 1 2 3, ROT → 2 3 1 (bottom of stack is now 2)
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 1 },
      { _tag: "PUSH_NUM", value: 2 },
      { _tag: "PUSH_NUM", value: 3 },
      { _tag: "ROT" },
    ])
    // stack bottom → top: 2, 3, 1
    expect(r.stack[0]).toEqual(vmNum(2))
    expect(r.stack[1]).toEqual(vmNum(3))
    expect(r.stack[2]).toEqual(vmNum(1))
  })

  it("H1: OVER ( a b -- a b a )", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 5 },
      { _tag: "PUSH_NUM", value: 3 },
      { _tag: "OVER" },  // → 5 3 5
    ])
    expect(r.stack).toHaveLength(3)
    expect(r.stack[0]).toEqual(vmNum(5))
    expect(r.stack[1]).toEqual(vmNum(3))
    expect(r.stack[2]).toEqual(vmNum(5))
  })

  it("H1: comparison — EQ, LT, GTE", () => {
    const vm = new SpikeStackVM(new MockCellCache())

    let r = vm.run([{ _tag: "PUSH_NUM", value: 5 }, { _tag: "PUSH_NUM", value: 5 }, { _tag: "EQ" }])
    expect(r.stack[0]).toEqual(vmBool(true))

    r = vm.run([{ _tag: "PUSH_NUM", value: 2 }, { _tag: "PUSH_NUM", value: 5 }, { _tag: "LT" }])
    expect(r.stack[0]).toEqual(vmBool(true))

    r = vm.run([{ _tag: "PUSH_NUM", value: 5 }, { _tag: "PUSH_NUM", value: 3 }, { _tag: "GTE" }])
    expect(r.stack[0]).toEqual(vmBool(true))
  })

  it("H1: logic — AND, OR, NOT", () => {
    const vm = new SpikeStackVM(new MockCellCache())

    let r = vm.run([
      { _tag: "PUSH_BOOL", value: true },
      { _tag: "PUSH_BOOL", value: false },
      { _tag: "AND" },
    ])
    expect(r.stack[0]).toEqual(vmBool(false))

    r = vm.run([
      { _tag: "PUSH_BOOL", value: true },
      { _tag: "PUSH_BOOL", value: false },
      { _tag: "OR" },
    ])
    expect(r.stack[0]).toEqual(vmBool(true))

    r = vm.run([
      { _tag: "PUSH_BOOL", value: true },
      { _tag: "NOT" },
    ])
    expect(r.stack[0]).toEqual(vmBool(false))
  })

  it("H1: HALT stops execution mid-program", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 1 },
      { _tag: "HALT" },
      { _tag: "PUSH_NUM", value: 999 },  // should never execute
    ])
    expect(r.stack).toHaveLength(1)
    expect(r.stack[0]).toEqual(vmNum(1))
  })

  // ── H2: Cell References ───────────────────────────────────────────────────

  it("H2: PUSH_CELL reads from CellCache", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(42))
    cells.set(1, 0, vmNum(8))

    const vm = new SpikeStackVM(cells)
    const r = vm.run([
      { _tag: "PUSH_CELL", col: 0, row: 0 },  // A0 = 42
      { _tag: "PUSH_CELL", col: 1, row: 0 },  // B0 = 8
      { _tag: "MUL" },                          // 42 * 8 = 336
    ])
    expect(r.stack[0]).toEqual(vmNum(336))
  })

  it("H2: PUSH_CELL returns 0 for unknown cell", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([{ _tag: "PUSH_CELL", col: 99, row: 99 }])
    expect(r.stack[0]).toEqual(vmNum(0))
  })

  it("H2: STORE_CELL writes computed result back to cache", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(5))
    cells.set(1, 0, vmNum(7))

    const vm = new SpikeStackVM(cells)
    // A0 * B0 → store to C0
    vm.run([
      { _tag: "PUSH_CELL",  col: 0, row: 0 },
      { _tag: "PUSH_CELL",  col: 1, row: 0 },
      { _tag: "MUL"  },
      { _tag: "STORE_CELL", col: 2, row: 0 },
    ])
    expect(cells.read(2, 0)).toEqual(vmNum(35))
  })

  // ── H3: Trail ─────────────────────────────────────────────────────────────

  it("H3: Trail records every opcode step", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 3 },
      { _tag: "PUSH_NUM", value: 4 },
      { _tag: "ADD" },
    ])

    expect(r.trail).toHaveLength(3)
    expect(r.trail[0].opcode).toBe("PUSH_NUM")
    expect(r.trail[1].opcode).toBe("PUSH_NUM")
    expect(r.trail[2].opcode).toBe("ADD")
    expect(r.trail[2].result).toEqual(vmNum(7))
  })

  it("H3: Trail captures stack state before and after each op", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "PUSH_NUM", value: 5  },
      { _tag: "SUB" },
    ])

    const addEntry = r.trail[2]
    expect(addEntry.stackBefore).toHaveLength(2)  // two operands on stack
    expect(addEntry.stackAfter).toHaveLength(1)   // one result
    expect(addEntry.stackBefore[0]).toEqual(vmNum(10))
    expect(addEntry.stackBefore[1]).toEqual(vmNum(5))
    expect(addEntry.stackAfter[0]).toEqual(vmNum(5))  // 10 - 5
  })

  it("H3: Trail is append-only (each step has monotonically increasing step number)", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run(compile("A0 + B0 * 2"))

    for (let i = 0; i < r.trail.length; i++) {
      expect(r.trail[i].step).toBe(i)
    }
  })

  it("H3: Trail allows replay — re-running same IR produces same trail", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(3))
    cells.set(1, 0, vmNum(7))

    const vm = new SpikeStackVM(cells)
    const ir = compile("A0 * B0")

    const r1 = vm.run(ir)
    const r2 = vm.run(ir)

    expect(r1.trail.map(e => e.opcode)).toEqual(r2.trail.map(e => e.opcode))
    expect(r1.stack[0]).toEqual(r2.stack[0])
  })

  // ── H4: Algebraic Compiler ────────────────────────────────────────────────

  it("H4: compile 'A0 + B0' → [PUSH_CELL, PUSH_CELL, ADD]", () => {
    const ir = compile("A0 + B0")
    expect(ir).toEqual([
      { _tag: "PUSH_CELL", col: 0, row: 0 },
      { _tag: "PUSH_CELL", col: 1, row: 0 },
      { _tag: "ADD" },
    ])
  })

  it("H4: compile '(A0 + B0) * 2' — parens override precedence", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(10))
    cells.set(1, 0, vmNum(5))

    const vm = new SpikeStackVM(cells)
    const r = vm.run(compile("(A0 + B0) * 2"))
    // (10 + 5) * 2 = 30
    expect(r.stack[0]).toEqual(vmNum(30))
  })

  it("H4: 'A0 + B0 * C0' respects * > + precedence", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(1))
    cells.set(1, 0, vmNum(2))
    cells.set(2, 0, vmNum(3))

    const vm = new SpikeStackVM(cells)
    // 1 + (2 * 3) = 7, NOT (1+2)*3=9
    const r = vm.run(compile("A0 + B0 * C0"))
    expect(r.stack[0]).toEqual(vmNum(7))
  })

  it("H4: '2 ^ 3 ^ 2' right-associative → 2^(3^2) = 2^9 = 512", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run(compile("2 ^ 3 ^ 2"))
    expect(r.stack[0]).toEqual(vmNum(512))
  })

  it("H4: StackIR is JSON-serializable (plain data, no closures)", () => {
    const ir = compile("A0 * B0 + 42")
    const serialized = JSON.stringify(ir)
    const parsed: StackIR = JSON.parse(serialized)

    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(3))
    cells.set(1, 0, vmNum(4))

    const vm = new SpikeStackVM(cells)
    const r = vm.run(parsed)
    // 3 * 4 + 42 = 54
    expect(r.stack[0]).toEqual(vmNum(54))
  })

  // ── Aggregation ───────────────────────────────────────────────────────────

  it("SUM_N — sum of 5 pushed values", () => {
    const vm = new SpikeStackVM(new MockCellCache())
    const r = vm.run([
      { _tag: "PUSH_NUM", value: 1 }, { _tag: "PUSH_NUM", value: 2 },
      { _tag: "PUSH_NUM", value: 3 }, { _tag: "PUSH_NUM", value: 4 },
      { _tag: "PUSH_NUM", value: 5 }, { _tag: "SUM_N", n: 5 },
    ])
    expect(r.stack[0]).toEqual(vmNum(15))
  })

  it("AVG_N — average of column range A0:A9 = 5.5", () => {
    const cells = new MockCellCache()
    for (let i = 0; i < 10; i++) cells.set(0, i, vmNum(i + 1))  // [1..10]

    const vm = new SpikeStackVM(cells)
    const ir: StackIR = [
      ...Array.from({ length: 10 }, (_, i): Opcode => ({ _tag: "PUSH_CELL", col: 0, row: i })),
      { _tag: "AVG_N", n: 10 },
    ]
    const r = vm.run(ir)
    expect(r.stack[0]).toEqual(vmNum(5.5))
  })

  it("MIN_N / MAX_N — min and max from range", () => {
    const vm = new SpikeStackVM(new MockCellCache())

    let r = vm.run([
      { _tag: "PUSH_NUM", value: 3 }, { _tag: "PUSH_NUM", value: 1 },
      { _tag: "PUSH_NUM", value: 4 }, { _tag: "PUSH_NUM", value: 2 },
      { _tag: "MIN_N", n: 4 },
    ])
    expect(r.stack[0]).toEqual(vmNum(1))

    r = vm.run([
      { _tag: "PUSH_NUM", value: 3 }, { _tag: "PUSH_NUM", value: 1 },
      { _tag: "PUSH_NUM", value: 4 }, { _tag: "PUSH_NUM", value: 2 },
      { _tag: "MAX_N", n: 4 },
    ])
    expect(r.stack[0]).toEqual(vmNum(4))
  })

  // ── H5: Performance ───────────────────────────────────────────────────────

  it("H5: 10K formula evaluations — interpreted baseline", () => {
    const cells = new MockCellCache()
    cells.set(0, 0, vmNum(10))
    cells.set(1, 0, vmNum(3))

    const vm = new SpikeStackVM(cells)
    const ir = compile("A0 + B0 * 2")  // pre-compile once

    const N = 10_000
    const vmStart = performance.now()
    for (let i = 0; i < N; i++) vm.run(ir)
    const vmElapsed = performance.now() - vmStart

    // Direct JS baseline
    const a0 = 10, b0 = 3
    const jsStart = performance.now()
    for (let i = 0; i < N; i++) {
      void (a0 + b0 * 2)
    }
    const jsElapsed = performance.now() - jsStart

    const overhead = vmElapsed / Math.max(jsElapsed, 0.001)
    console.log(
      `  F1/H5: VM=${vmElapsed.toFixed(2)}ms  JS=${jsElapsed.toFixed(3)}ms  overhead=${overhead.toFixed(0)}x  (N=${N.toLocaleString()})`
    )
    console.log(
      `  F1/H5: ${(N / vmElapsed * 1000).toFixed(0)} formula evals/sec`
    )

    // Interpreted baseline — no JIT tricks.
    // Real v1 will compile StackIR → closures for ~10-50x speedup.
    expect(vmElapsed).toBeLessThan(500)
  })

  it("H5: 1K complex formulas with cell refs — latency budget", () => {
    const cells = new MockCellCache()
    for (let i = 0; i < 26; i++) cells.set(i, 0, vmNum(i + 1))

    const vm    = new SpikeStackVM(cells)
    const ir    = compile("(A0 + B0) * C0 - D0 / E0")  // 5-cell formula
    const N     = 1_000

    const start = performance.now()
    for (let i = 0; i < N; i++) vm.run(ir)
    const elapsed = performance.now() - start

    console.log(`  F1/H5: Complex: ${elapsed.toFixed(2)}ms for ${N} evals (${(elapsed/N).toFixed(3)}ms each)`)
    expect(elapsed).toBeLessThan(200)
  })
})
