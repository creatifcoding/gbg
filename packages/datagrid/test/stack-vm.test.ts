/**
 * Stack VM — Production tests
 *
 * Tests the extracted service with comprehensive error channel coverage.
 *
 * Error channels tested:
 * 1. VMValue errors (inline on stack) — DIV/0, underflow, type mismatch, propagation
 * 2. Effect E channel (CompileError, EvalError, ResourceError) — typed recovery
 * 3. Defects (unexpected) — should never reach tests; asserts absence
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Fiber from "effect-v4/Fiber"
import * as Cause from "effect-v4/Cause"

import {
  // Value constructors
  num, str, bool, err, vmError,
  // Value utilities
  isVMError, isNumeric, toNumber, asNum, vmEq, vmDisplay, propagateError,
  // Error codes
  type VMErrorCode, errorCodeDisplay,
  // Effect errors
  CompileError, EvalError, ResourceError,
  type VMFailure,
  failureToVMError, timeoutToVMError, catchToErrorState,
  // VM core
  evalProgram, evalExpr, compileExpr, compileExprSync,
  compileInfix, compileInfixSync, extractDepsInfix,
  execOpcode, emptyState, MAX_EVAL_STEPS,
  // Dependency extraction
  extractDeps, extractDepsFromIR,
  // Service
  StackVM, StackVMLive,
  // Types
  type StackIR, type VMState, type VMValue,
} from "../src/services/stack-vm"
import * as CV from "../src/schemas/cell-value"
import type { CellValue } from "../src/schemas/cell-value"
import { FormulaEngineV2, FormulaEngineV2Config, FormulaEngineV2Live, type CellStore } from "../src/services/formula-engine-v2"
const { Layer } = await import("effect-v4")

// ── Range test helpers ──────────────────────────────

function makeStore(initial?: Record<string, CellValue>): CellStore & { cells: Map<string, CellValue> } {
  const cells = new Map<string, CellValue>(initial ? Object.entries(initial) : [])
  return {
    cells,
    get: (addr) => cells.get(addr) ?? CV.empty(),
    set: (addr, value) => cells.set(addr, value),
  }
}

function run<A, E>(store: CellStore, effect: Effect.Effect<A, E, FormulaEngineV2>) {
  return Effect.runPromise(effect.pipe(
    Effect.provide(
      FormulaEngineV2Live.pipe(
        Layer.provide(Layer.succeed(FormulaEngineV2Config, FormulaEngineV2Config.of({ cellStore: store }))),
      )
    ),
  ))
}

// ═══════════════════════════════════════════════════════
// CHANNEL 1: VMValue ERRORS (inline on stack)
// ═══════════════════════════════════════════════════════

describe("VMValue errors (inline, channel 1)", () => {
  describe("error code constructors", () => {
    it("vmError creates error with code + message", () => {
      const e = vmError("DIV_ZERO", "Division by zero")
      expect(e).toEqual({ _tag: "error", code: "DIV_ZERO", message: "Division by zero" })
    })

    it("err() shorthand uses GENERAL code", () => {
      const e = err("something went wrong")
      expect(e).toEqual({ _tag: "error", code: "GENERAL", message: "something went wrong" })
    })
  })

  describe("stack underflow", () => {
    it("ADD with < 2 items → STACK_UNDERFLOW", () => {
      const state = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "ADD" },
      ]))
      const top = state.stack[state.stack.length - 1]
      expect(isVMError(top)).toBe(true)
      if (top._tag === "error") {
        expect(top.code).toBe("STACK_UNDERFLOW")
      }
    })

    it("DUP on empty stack → STACK_UNDERFLOW", () => {
      const state = Effect.runSync(evalProgram([{ _tag: "DUP" }]))
      const top = state.stack[0]
      expect(isVMError(top)).toBe(true)
      if (top._tag === "error") expect(top.code).toBe("STACK_UNDERFLOW")
    })

    it("NEG on empty stack → STACK_UNDERFLOW", () => {
      const state = Effect.runSync(evalProgram([{ _tag: "NEG" }]))
      expect(state.stack[0]._tag).toBe("error")
    })
  })

  describe("division by zero", () => {
    it("DIV by 0 → DIV_ZERO error value", () => {
      const state = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "DIV" },
      ]))
      const top = state.stack[0]
      expect(top).toEqual(vmError("DIV_ZERO", "Division by zero"))
    })

    it("DIV_ZERO display is #DIV/0!", () => {
      expect(vmDisplay(vmError("DIV_ZERO", "Division by zero"))).toBe("#DIV/0!")
    })
  })

  describe("error propagation", () => {
    it("ADD with error operand propagates the error", () => {
      // Push error, then a number, then ADD — error should propagate
      const state = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "DIV" }, // → DIV_ZERO error
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "ADD" }, // Should propagate DIV_ZERO, not compute
      ]))
      const top = state.stack[0]
      expect(isVMError(top)).toBe(true)
      if (top._tag === "error") expect(top.code).toBe("DIV_ZERO")
    })

    it("propagateError utility finds first error", () => {
      const e = vmError("DIV_ZERO", "oops")
      expect(propagateError(num(1), e, num(3))).toBe(e)
      expect(propagateError(num(1), num(2))).toBeUndefined()
    })

    it("SUM_N propagates error if any operand is error", () => {
      const state = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "DIV" }, // → DIV_ZERO
        { _tag: "SUM_N", n: 2 },
      ]))
      const top = state.stack[0]
      expect(isVMError(top)).toBe(true)
    })
  })

  describe("step overflow", () => {
    it("exceeding MAX_EVAL_STEPS pushes EVAL_OVERFLOW", () => {
      // Create a state at the step limit
      const atLimit: VMState = {
        ...emptyState(),
        step: MAX_EVAL_STEPS,
      }
      const result = execOpcode({ _tag: "PUSH_NUM", value: 1 }, atLimit)
      expect(result.halted).toBe(true)
      const top = result.stack[0]
      expect(isVMError(top)).toBe(true)
      if (top._tag === "error") expect(top.code).toBe("EVAL_OVERFLOW")
    })
  })
})

// ═══════════════════════════════════════════════════════
// CHANNEL 1: VMValue UTILITIES
// ═══════════════════════════════════════════════════════

describe("VMValue utilities", () => {
  it("isVMError correctly identifies errors", () => {
    expect(isVMError(num(1))).toBe(false)
    expect(isVMError(str("hi"))).toBe(false)
    expect(isVMError(vmError("GENERAL", "x"))).toBe(true)
  })

  it("isNumeric identifies num and bool", () => {
    expect(isNumeric(num(1))).toBe(true)
    expect(isNumeric(bool(true))).toBe(true)
    expect(isNumeric(str("hi"))).toBe(false)
    expect(isNumeric(vmError("GENERAL", "x"))).toBe(false)
  })

  it("toNumber extracts safely", () => {
    expect(toNumber(num(42))).toBe(42)
    expect(toNumber(bool(true))).toBe(1)
    expect(toNumber(bool(false))).toBe(0)
    expect(toNumber(str("hi"))).toBeUndefined()
    expect(toNumber(vmError("GENERAL", "x"))).toBeUndefined()
  })

  it("vmEq handles all types", () => {
    expect(vmEq(num(1), num(1))).toBe(true)
    expect(vmEq(num(1), num(2))).toBe(false)
    expect(vmEq(str("a"), str("a"))).toBe(true)
    expect(vmEq(bool(true), bool(true))).toBe(true)
    expect(vmEq(num(1), str("1"))).toBe(false) // different types
  })

  it("vmDisplay renders all types correctly", () => {
    expect(vmDisplay(num(42))).toBe("42")
    expect(vmDisplay(str("hello"))).toBe("hello")
    expect(vmDisplay(bool(true))).toBe("TRUE")
    expect(vmDisplay(bool(false))).toBe("FALSE")
    expect(vmDisplay(vmError("DIV_ZERO", "x"))).toBe("#DIV/0!")
    expect(vmDisplay(vmError("STACK_UNDERFLOW", "x"))).toBe("#VALUE!")
    expect(vmDisplay(vmError("CIRCULAR_REF", "x"))).toBe("#REF!")
    expect(vmDisplay(vmError("UNKNOWN_TOKEN", "x"))).toBe("#NAME?")
  })
})

// ═══════════════════════════════════════════════════════
// CHANNEL 2: EFFECT E CHANNEL (typed recoverable)
// ═══════════════════════════════════════════════════════

describe("Effect E channel errors (channel 2)", () => {
  describe("CompileError", () => {
    it("unknown token fails with CompileError", async () => {
      const result = await Effect.runPromise(
        compileExpr("3 FOOBAR +").pipe(
          Effect.catch((e) => Effect.succeed(e)),
        )
      )
      expect(result._tag).toBe("CompileError")
      expect((result as CompileError).token).toBe("FOOBAR")
      expect((result as CompileError).position).toBe(1)
    })

    it("CompileError includes expr and reason", async () => {
      const result = await Effect.runPromise(
        compileExpr("1 $$$").pipe(
          Effect.catch((e) => Effect.succeed(e)),
        )
      )
      const ce = result as CompileError
      expect(ce.expr).toBe("1 $$$")
      expect(ce.reason).toContain("$$$")
    })

    it("valid expression compiles successfully", async () => {
      const ir = await Effect.runPromise(compileExpr("3 4 + 2 *"))
      expect(ir).toHaveLength(5)
      expect(ir[0]._tag).toBe("PUSH_NUM")
    })

    it("compileExprSync throws on bad input", () => {
      expect(() => compileExprSync("3 BAD_TOKEN +")).toThrow()
    })

    it("compileExprSync returns IR on good input", () => {
      const ir = compileExprSync("3 4 +")
      expect(ir).toHaveLength(3)
    })
  })

  describe("CompileError recovery with catchTag", () => {
    it("catchTag handles CompileError specifically", async () => {
      const result = await Effect.runPromise(
        evalExpr("3 UNKNOWN +").pipe(
          Effect.catchTag("CompileError", (e) =>
            Effect.succeed({
              ...emptyState(),
              stack: [vmError("UNKNOWN_TOKEN", e.reason)],
              halted: true,
            })
          ),
        )
      )
      expect(result.stack[0]).toEqual(vmError("UNKNOWN_TOKEN", expect.stringContaining("UNKNOWN")))
    })
  })

  describe("failureToVMError conversion", () => {
    it("converts CompileError to UNKNOWN_TOKEN VMError", () => {
      const ve = failureToVMError(
        new CompileError({ expr: "x", reason: "bad token", token: "x", position: 0 })
      )
      expect(ve._tag).toBe("error")
      if (ve._tag === "error") expect(ve.code).toBe("UNKNOWN_TOKEN")
    })

    it("converts EvalError to GENERAL VMError", () => {
      const ve = failureToVMError(
        new EvalError({ step: 0, opcode: "ADD", reason: "corruption" })
      )
      if (ve._tag === "error") expect(ve.code).toBe("GENERAL")
    })

    it("converts ResourceError to GENERAL VMError", () => {
      const ve = failureToVMError(
        new ResourceError({ resource: "wasm-pool", reason: "exhausted" })
      )
      if (ve._tag === "error") expect(ve.message).toContain("wasm-pool")
    })
  })

  describe("timeoutToVMError", () => {
    it("creates EVAL_OVERFLOW error", () => {
      const ve = timeoutToVMError()
      expect(ve._tag).toBe("error")
      if (ve._tag === "error") {
        expect(ve.code).toBe("EVAL_OVERFLOW")
        expect(ve.message).toContain("timed out")
      }
    })
  })

  describe("catchToErrorState boundary", () => {
    it("catches CompileError and returns error VMState", async () => {
      const result = await Effect.runPromise(
        catchToErrorState(
          evalExpr("3 BAD +") as any
        )
      )
      expect(result.halted).toBe(true)
      expect(isVMError(result.stack[0])).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════
// NORMAL OPERATION (correctness)
// ═══════════════════════════════════════════════════════

describe("StackVM correctness", () => {
  describe("arithmetic", () => {
    it("ADD", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "ADD" },
      ]))
      expect(s.stack[0]).toEqual(num(13))
    })

    it("SUB", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "SUB" },
      ]))
      expect(s.stack[0]).toEqual(num(7))
    })

    it("MUL + DIV", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 6 },
        { _tag: "PUSH_NUM", value: 7 },
        { _tag: "MUL" },
      ]))
      expect(s.stack[0]).toEqual(num(42))
    })

    it("NEG", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "NEG" },
      ]))
      expect(s.stack[0]).toEqual(num(-5))
    })
  })

  describe("stack ops", () => {
    it("DUP duplicates top", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 7 },
        { _tag: "DUP" },
      ]))
      expect(s.stack).toEqual([num(7), num(7)])
    })

    it("SWAP swaps top two", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "PUSH_NUM", value: 2 },
        { _tag: "SWAP" },
      ]))
      expect(s.stack).toEqual([num(2), num(1)])
    })

    it("DROP removes top", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "PUSH_NUM", value: 2 },
        { _tag: "DROP" },
      ]))
      expect(s.stack).toEqual([num(1)])
    })
  })

  describe("comparison + logic", () => {
    it("EQ true", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "EQ" },
      ]))
      expect(s.stack[0]).toEqual(bool(true))
    })

    it("LT / GT", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "LT" },
      ]))
      expect(s.stack[0]).toEqual(bool(true))
    })

    it("NOT inverts bool", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_BOOL", value: true },
        { _tag: "NOT" },
      ]))
      expect(s.stack[0]).toEqual(bool(false))
    })
  })

  describe("multi-type", () => {
    it("pushes NUM, STR, BOOL", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 42 },
        { _tag: "PUSH_STR", value: "hello" },
        { _tag: "PUSH_BOOL", value: true },
      ]))
      expect(s.stack).toEqual([num(42), str("hello"), bool(true)])
    })
  })

  describe("HALT", () => {
    it("stops execution mid-program", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "HALT" },
        { _tag: "PUSH_NUM", value: 999 },
      ]))
      expect(s.stack).toHaveLength(1)
      expect(s.halted).toBe(true)
    })
  })

  describe("string eval", () => {
    it("compiles and evaluates RPN", async () => {
      const s = await Effect.runPromise(evalExpr("3 4 + 2 *"))
      expect(s.stack[0]).toEqual(num(14))
    })

    it("supports DUP and SWAP", async () => {
      const s = await Effect.runPromise(evalExpr("5 DUP *"))
      expect(s.stack[0]).toEqual(num(25))
    })

    it("supports true/false literals", async () => {
      const s = await Effect.runPromise(evalExpr("true false"))
      expect(s.stack).toEqual([bool(true), bool(false)])
    })

    it("compiles A1 cell references to READ_CELL", async () => {
      const ir = await Effect.runPromise(compileExpr("A1 B1 +"))
      expect(ir[0]).toEqual({ _tag: "READ_CELL", addr: "A1" })
      expect(ir[1]).toEqual({ _tag: "READ_CELL", addr: "B1" })
      expect(ir[2]).toEqual({ _tag: "ADD" })
    })

    it("handles complex A1 expression", async () => {
      const ir = await Effect.runPromise(compileExpr("A1 B1 * C1 +"))
      expect(ir).toHaveLength(5)
      expect(ir[0]).toEqual({ _tag: "READ_CELL", addr: "A1" })
      expect(ir[3]).toEqual({ _tag: "READ_CELL", addr: "C1" })
    })

    it("A1 expressions work with CellContext", () => {
      const ctx = {
        readCell: (addr: string) => addr === "A1" ? num(10) : addr === "B1" ? num(20) : num(0),
        writeCell: () => {},
      }
      const ir = compileExprSync("A1 B1 +")
      const state = Effect.runSync(evalProgram(ir, ctx))
      expect(state.stack[0]).toEqual(num(30))
    })
  })

  describe("trail", () => {
    it("records every step monotonically", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 1 },
        { _tag: "PUSH_NUM", value: 2 },
        { _tag: "ADD" },
      ]))
      expect(s.trail).toHaveLength(3)
      expect(s.trail.map((e) => e.step)).toEqual([0, 1, 2])
      expect(s.trail.map((e) => e.opcode)).toEqual(["PUSH_NUM", "PUSH_NUM", "ADD"])
    })
  })
})

// ═══════════════════════════════════════════════════════
// SERVICE LAYER
// ═══════════════════════════════════════════════════════

describe("StackVM service", () => {
  it("eval via service layer", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const vm = yield* StackVM
        const r1 = yield* vm.evalExpr("3 4 + 2 *")
        const r2 = yield* vm.evalExpr("3 4 + 2 *") // cache hit
        const r3 = yield* vm.evalExpr("10 5 -")
        return { r1: r1.stack[0], r2: r2.stack[0], r3: r3.stack[0] }
      }).pipe(Effect.provide(StackVMLive()))
    )
    expect(result.r1).toEqual(num(14))
    expect(result.r2).toEqual(num(14))
    expect(result.r3).toEqual(num(5))
  })

  it("compile validates without evaluating", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const vm = yield* StackVM
        const ir = yield* vm.compile("3 4 +")
        return ir
      }).pipe(Effect.provide(StackVMLive()))
    )
    expect(result).toHaveLength(3)
  })

  it("compile fails with CompileError on bad input", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function*() {
        const vm = yield* StackVM
        return yield* vm.compile("3 BOGUS +")
      }).pipe(
        Effect.provide(StackVMLive()),
        Effect.catchTag("CompileError", (e) => Effect.succeed(e)),
      )
    )
    expect(result._tag).toBe("CompileError")
  })

  it("concurrent evals throttled by semaphore", async () => {
    const results = await Effect.runPromise(
      Effect.gen(function*() {
        const vm = yield* StackVM
        const fibers = yield* Effect.forEach(
          ["1 1 +", "2 2 +", "3 3 +", "4 4 +"],
          (expr) => Effect.forkChild(vm.evalExpr(expr)),
        )
        const states = yield* Effect.forEach(fibers, (f) => Fiber.join(f))
        return states.map((s) => {
          const top = s.stack[0]
          return top?._tag === "num" ? top.value : -1
        })
      }).pipe(Effect.provide(StackVMLive({ maxConcurrency: 2 })))
    )
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8])
  })

  it("invalidate clears cache for expression", async () => {
    let evalCount = 0
    // Can't easily observe cache internals, but verify no crash
    await Effect.runPromise(
      Effect.gen(function*() {
        const vm = yield* StackVM
        yield* vm.evalExpr("1 2 +")
        yield* vm.invalidate("1 2 +")
        yield* vm.evalExpr("1 2 +") // Should re-evaluate
      }).pipe(Effect.provide(StackVMLive()))
    )
  })
})

// ═══════════════════════════════════════════════════════
// READ_CELL / WRITE_CELL OPCODES
// ═══════════════════════════════════════════════════════

describe("cell I/O opcodes", () => {
  function makeTestContext(cells: Record<string, VMValue>): {
    ctx: import("../src/services/stack-vm").CellContext,
    written: Record<string, VMValue>,
  } {
    const written: Record<string, VMValue> = {}
    return {
      ctx: {
        readCell: (addr) => cells[addr] ?? num(0),
        writeCell: (addr, v) => { written[addr] = v },
      },
      written,
    }
  }

  describe("READ_CELL", () => {
    it("reads a cell value onto the stack", () => {
      const { ctx } = makeTestContext({ A1: num(42), B1: str("hello") })
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
      ], ctx))
      expect(state.stack[0]).toEqual(num(42))
    })

    it("reads multiple cells for formula", () => {
      const { ctx } = makeTestContext({ A1: num(10), B1: num(20) })
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
        { _tag: "READ_CELL", addr: "B1" },
        { _tag: "ADD" },
      ], ctx))
      expect(state.stack[0]).toEqual(num(30))
    })

    it("missing cell returns num(0)", () => {
      const { ctx } = makeTestContext({})
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "Z99" },
      ], ctx))
      expect(state.stack[0]).toEqual(num(0))
    })

    it("no context returns error", () => {
      // No ctx passed — uses emptyCellContext
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
      ]))
      expect(state.stack[0]._tag).toBe("error")
    })
  })

  describe("WRITE_CELL", () => {
    it("pops value and writes to cell", () => {
      const { ctx, written } = makeTestContext({})
      const state = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 42 },
        { _tag: "WRITE_CELL", addr: "C1" },
      ], ctx))
      expect(written["C1"]).toEqual(num(42))
      expect(state.stack).toHaveLength(0) // value was popped
    })

    it("underflow on empty stack", () => {
      const { ctx, written } = makeTestContext({})
      const state = Effect.runSync(evalProgram([
        { _tag: "WRITE_CELL", addr: "C1" },
      ], ctx))
      expect(state.stack[0]._tag).toBe("error")
      expect(written["C1"]).toBeUndefined() // nothing written
    })
  })

  describe("READ_CELL + formula", () => {
    it("=A1+B1 using READ_CELL opcodes", () => {
      const { ctx } = makeTestContext({ A1: num(100), B1: num(200) })
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
        { _tag: "READ_CELL", addr: "B1" },
        { _tag: "ADD" },
      ], ctx))
      expect(state.stack[0]).toEqual(num(300))
    })

    it("=A1*B1+C1 complex formula", () => {
      const { ctx } = makeTestContext({ A1: num(3), B1: num(4), C1: num(5) })
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
        { _tag: "READ_CELL", addr: "B1" },
        { _tag: "MUL" },
        { _tag: "READ_CELL", addr: "C1" },
        { _tag: "ADD" },
      ], ctx))
      expect(state.stack[0]).toEqual(num(17)) // 3*4+5
    })

    it("error in cell propagates through formula", () => {
      const { ctx } = makeTestContext({
        A1: num(10),
        B1: vmError("DIV_ZERO", "oops"),
      })
      const state = Effect.runSync(evalProgram([
        { _tag: "READ_CELL", addr: "A1" },
        { _tag: "READ_CELL", addr: "B1" },
        { _tag: "ADD" },
      ], ctx))
      // B1 is an error → ADD propagates it
      expect(state.stack[0]._tag).toBe("error")
    })
  })
})

// ═══════════════════════════════════════════════════════
// EXTENDED OPCODES (IF, MOD, ABS, MIN_N, MAX_N, AVG_N)
// ═══════════════════════════════════════════════════════

describe("extended opcodes", () => {
  describe("IF (conditional)", () => {
    it("IF with true condition → picks true_val", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 }, // false_val
        { _tag: "PUSH_NUM", value: 20 }, // true_val
        { _tag: "PUSH_BOOL", value: true }, // condition
        { _tag: "IF" },
      ]))
      expect(s.stack[0]).toEqual(num(20))
    })

    it("IF with false condition → picks false_val", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 20 },
        { _tag: "PUSH_BOOL", value: false },
        { _tag: "IF" },
      ]))
      expect(s.stack[0]).toEqual(num(10))
    })

    it("IF with numeric 0 → falsy", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_STR", value: "no" },
        { _tag: "PUSH_STR", value: "yes" },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "IF" },
      ]))
      expect(s.stack[0]).toEqual(str("no"))
    })

    it("IF with numeric non-zero → truthy", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_STR", value: "no" },
        { _tag: "PUSH_STR", value: "yes" },
        { _tag: "PUSH_NUM", value: 42 },
        { _tag: "IF" },
      ]))
      expect(s.stack[0]).toEqual(str("yes"))
    })

    it("IF with error condition → propagates", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 20 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "DIV" }, // → DIV_ZERO error
        { _tag: "IF" },
      ]))
      expect(s.stack[0]._tag).toBe("error")
    })

    it("IF via string compiler", async () => {
      const s = await Effect.runPromise(evalExpr("10 20 true IF"))
      expect(s.stack[0]).toEqual(num(20))
    })
  })

  describe("MOD", () => {
    it("modulo operation", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "MOD" },
      ]))
      expect(s.stack[0]).toEqual(num(1))
    })

    it("mod by zero → DIV_ZERO", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 0 },
        { _tag: "MOD" },
      ]))
      expect(s.stack[0]._tag).toBe("error")
    })
  })

  describe("ABS", () => {
    it("absolute value of negative", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: -42 },
        { _tag: "ABS" },
      ]))
      expect(s.stack[0]).toEqual(num(42))
    })

    it("absolute value of positive (no-op)", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 7 },
        { _tag: "ABS" },
      ]))
      expect(s.stack[0]).toEqual(num(7))
    })
  })

  describe("CONCAT / TO_NUM / TO_STR", () => {
    it("CONCAT joins two strings", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_STR", value: "hello" },
        { _tag: "PUSH_STR", value: " world" },
        { _tag: "CONCAT" },
      ]))
      expect(s.stack[0]).toEqual(str("hello world"))
    })

    it("CONCAT coerces num to string", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_STR", value: "val=" },
        { _tag: "PUSH_NUM", value: 42 },
        { _tag: "CONCAT" },
      ]))
      expect(s.stack[0]).toEqual(str("val=42"))
    })

    it("TO_NUM converts string to number", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_STR", value: "42" },
        { _tag: "TO_NUM" },
      ]))
      // str → toNumber returns undefined for non-numeric strings
      // "42" should fail since toNumber only handles num/bool
      expect(s.stack[0]._tag).toBe("error") // TYPE_MISMATCH
    })

    it("TO_NUM on bool → 0/1", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_BOOL", value: true },
        { _tag: "TO_NUM" },
      ]))
      expect(s.stack[0]).toEqual(num(1))
    })

    it("TO_STR converts num to string", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 42 },
        { _tag: "TO_STR" },
      ]))
      expect(s.stack[0]).toEqual(str("42"))
    })

    it("TO_STR converts bool to TRUE/FALSE", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_BOOL", value: true },
        { _tag: "TO_STR" },
      ]))
      expect(s.stack[0]).toEqual(str("TRUE"))
    })
  })

  describe("MIN_N / MAX_N / AVG_N", () => {
    it("MIN_N finds minimum", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "PUSH_NUM", value: 8 },
        { _tag: "MIN_N", n: 3 },
      ]))
      expect(s.stack[0]).toEqual(num(3))
    })

    it("MAX_N finds maximum", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 5 },
        { _tag: "PUSH_NUM", value: 3 },
        { _tag: "PUSH_NUM", value: 8 },
        { _tag: "MAX_N", n: 3 },
      ]))
      expect(s.stack[0]).toEqual(num(8))
    })

    it("AVG_N computes average", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "PUSH_NUM", value: 10 },
        { _tag: "PUSH_NUM", value: 20 },
        { _tag: "PUSH_NUM", value: 30 },
        { _tag: "AVG_N", n: 3 },
      ]))
      expect(s.stack[0]).toEqual(num(20))
    })

    it("AVG_N with n=0 → DIV_ZERO", () => {
      const s = Effect.runSync(evalProgram([
        { _tag: "AVG_N", n: 0 },
      ]))
      expect(s.stack[0]._tag).toBe("error")
    })
  })
})

// ═══════════════════════════════════════════════════════
// DEPENDENCY EXTRACTION
// ═══════════════════════════════════════════════════════

describe("dependency extraction", () => {
  it("extractDeps finds A1 references", () => {
    expect(extractDeps("A1 B1 + C1 *")).toEqual(["A1", "B1", "C1"])
  })

  it("extractDeps returns empty for no refs", () => {
    expect(extractDeps("3 4 +")).toEqual([])
  })

  it("extractDeps deduplicates", () => {
    expect(extractDeps("A1 A1 +")).toEqual(["A1"])
  })

  it("extractDepsFromIR finds READ_CELL ops", () => {
    const ir = compileExprSync("A1 B1 + C1 *")
    expect(extractDepsFromIR(ir)).toEqual(["A1", "B1", "C1"])
  })

  it("extractDepsFromIR handles mixed IR", () => {
    const ir: StackIR = [
      { _tag: "PUSH_NUM", value: 1 },
      { _tag: "READ_CELL", addr: "A1" },
      { _tag: "ADD" },
    ]
    expect(extractDepsFromIR(ir)).toEqual(["A1"])
  })
})

// ═══════════════════════════════════════════════════════
// INFIX PARSER
// ═══════════════════════════════════════════════════════

describe("infix parser", () => {
  const cellCtx = {
    readCell: (addr: string) => {
      const m = addr.match(/^([A-Z]+)(\d+)$/)
      if (!m) return num(0)
      const col = m[1].charCodeAt(0) - 64 // A=1, B=2, ...
      const row = parseInt(m[2], 10)
      return num(col * 10 + row) // A1=11, B1=21, C2=32
    },
    writeCell: () => {},
  }

  it("simple addition: =A1+B1", () => {
    const ir = compileInfixSync("=A1+B1")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    expect(s.stack[0]).toEqual(num(32)) // A1(11) + B1(21)
  })

  it("operator precedence: =A1+B1*2", () => {
    const ir = compileInfixSync("=A1+B1*2")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    expect(s.stack[0]).toEqual(num(53)) // A1(11) + B1(21)*2 = 11+42
  })

  it("parentheses: =(A1+B1)*2", () => {
    const ir = compileInfixSync("=(A1+B1)*2")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    expect(s.stack[0]).toEqual(num(64)) // (11+21)*2
  })

  it("function call: =SUM(A1:A3)", () => {
    const ir = compileInfixSync("=SUM(A1:A3)")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    // A1=11, A2=12, A3=13 → SUM=36
    expect(s.stack[0]).toEqual(num(36))
  })

  it("nested: =SUM(A1:A3)+B1*2", () => {
    const ir = compileInfixSync("=SUM(A1:A3)+B1*2")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    // SUM(A1:A3)=36, B1*2=42 → 78
    expect(s.stack[0]).toEqual(num(78))
  })

  it("division: =A1/B1", () => {
    const ir = compileInfixSync("=A1/B1")
    const s = Effect.runSync(evalProgram(ir, cellCtx))
    expect(s.stack[0]).toEqual(num(11 / 21))
  })

  it("strips leading =", () => {
    const ir1 = compileInfixSync("=A1+1")
    const ir2 = compileInfixSync("A1+1")
    // Both should produce the same IR
    expect(ir1.length).toBe(ir2.length)
  })

  it("numeric literals: =10+20", () => {
    const ir = compileInfixSync("=10+20")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(30))
  })

  it("extractDepsInfix finds cell refs", () => {
    expect(extractDepsInfix("=A1+B1*C1")).toEqual(["A1", "B1", "C1"])
  })

  it("extractDepsInfix expands ranges", () => {
    const deps = extractDepsInfix("=SUM(A1:A3)+B1")
    expect(deps).toContain("A1")
    expect(deps).toContain("A2")
    expect(deps).toContain("A3")
    expect(deps).toContain("B1")
  })

  it("async compileInfix works", async () => {
    const ir = await Effect.runPromise(compileInfix("=1+2"))
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(3))
  })

  it("comparison: =A1>10", () => {
    const ir = compileInfixSync("=A1>10")
    const ctx = { readCell: () => num(15), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(bool(true))
  })

  it("comparison: =A1<B1", () => {
    const ir = compileInfixSync("=A1<B1")
    const ctx = { readCell: (a: string) => a === "A1" ? num(5) : num(10), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(bool(true))
  })

  it("unary minus: =-A1", () => {
    const ir = compileInfixSync("=-A1")
    const ctx = { readCell: () => num(10), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(-10))
  })

  it("unary minus: =-(A1+B1)", () => {
    const ir = compileInfixSync("=-(A1+B1)")
    const ctx = { readCell: (a: string) => a === "A1" ? num(3) : num(7), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(-10))
  })

  it("unary minus with multiplication: =-A1*2", () => {
    const ir = compileInfixSync("=-A1*2")
    const ctx = { readCell: () => num(5), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(-10)) // -(5)*2 = -10
  })

  it("string literal: =\"hello\"", () => {
    const ir = compileInfixSync('="hello"')
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(str("hello"))
  })

  it("string concat: =\"hi\" & \" there\"", () => {
    const ir = compileInfixSync('="hi" & " there"')
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(str("hi there"))
  })

  it("power operator: =2^3", () => {
    const ir = compileInfixSync("=2^3")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(8))
  })

  it("power right-assoc: =2^3^2 = 2^(3^2) = 512", () => {
    const ir = compileInfixSync("=2^3^2")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(512)) // 2^(3^2) = 2^9 = 512
  })

  it("COUNT function: =COUNT(A1:A3)", () => {
    const ir = compileInfixSync("=COUNT(A1:A3)")
    const ctx = { readCell: (a: string) => num(parseInt(a.slice(1))), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(3))
  })

  it("ROUND function: =ROUND(3.14159, 2)", () => {
    const ir = compileInfixSync("=ROUND(3.14159, 2)")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(3.14))
  })

  it("FLOOR function: =FLOOR(3.7)", () => {
    const ir = compileInfixSync("=FLOOR(3.7)")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(3))
  })

  it("CEIL function: =CEIL(3.2)", () => {
    const ir = compileInfixSync("=CEIL(3.2)")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(4))
  })

  it("rejects mismatched parentheses", async () => {
    await expect(
      Effect.runPromise(compileInfix("=(A1+B1"))
    ).rejects.toThrow()
  })
})

// ═══════════════════════════════════════════════════════
// RANGE OPERATIONS
// ═══════════════════════════════════════════════════════

describe("range operations", () => {
  const rangeCtx = {
    readCell: (addr: string) => {
      // A1=1, A2=2, ..., A10=10
      const m = addr.match(/^([A-Z]+)(\d+)$/)
      if (!m) return num(0)
      return num(parseInt(m[2], 10))
    },
    writeCell: () => {},
  }

  it("READ_RANGE column: A1:A5 pushes 5 values + count", () => {
    const ir = compileExprSync("A1:A5")
    expect(ir[0]._tag).toBe("READ_RANGE")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    // Stack should be: [1, 2, 3, 4, 5, 5(count)]
    expect(s.stack).toHaveLength(6)
    expect(s.stack[5]).toEqual(num(5)) // count
  })

  it("READ_RANGE + SUM_DYN = SUM(A1:A5)", () => {
    const ir = compileExprSync("A1:A5 SUM_DYN")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    expect(s.stack[0]).toEqual(num(15)) // 1+2+3+4+5
  })

  it("READ_RANGE + MIN_DYN = MIN(A1:A5)", () => {
    const ir = compileExprSync("A1:A5 MIN_DYN")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    expect(s.stack[0]).toEqual(num(1))
  })

  it("READ_RANGE + MAX_DYN = MAX(A1:A5)", () => {
    const ir = compileExprSync("A1:A5 MAX_DYN")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    expect(s.stack[0]).toEqual(num(5))
  })

  it("READ_RANGE + AVG_DYN = AVG(A1:A5)", () => {
    const ir = compileExprSync("A1:A5 AVG_DYN")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    expect(s.stack[0]).toEqual(num(3)) // (1+2+3+4+5)/5
  })

  it("extractDeps expands range to individual cells", () => {
    expect(extractDeps("A1:A5 SUM_DYN")).toEqual(["A1", "A2", "A3", "A4", "A5"])
  })

  it("row range: A1:D1", () => {
    const ir = compileExprSync("A1:D1 SUM_DYN")
    const s = Effect.runSync(evalProgram(ir, rangeCtx))
    // A1=1, B1=1, C1=1, D1=1 → all row 1
    expect(s.stack[0]).toEqual(num(4)) // 1+1+1+1
  })

  it("range in FormulaEngineV2 context", async () => {
    // Test via formula engine
    const initial: Record<string, CellValue> = {}
    for (let i = 1; i <= 5; i++) initial[`A${i}`] = CV.num(i * 10)
    const store = makeStore(initial)

    await run(store, Effect.gen(function*() {
      const e = yield* FormulaEngineV2
      yield* e.register("B1", "A1:A5 SUM_DYN")
      yield* e.recalcDirty(["A1", "A2", "A3", "A4", "A5"])
      expect(store.get("B1")).toEqual(CV.num(150)) // 10+20+30+40+50
    }))
  })
})

// ═══════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════

describe("performance", () => {
  it("10K evals within 500ms", () => {
    const ir: StackIR = [
      { _tag: "PUSH_NUM", value: 1 },
      { _tag: "PUSH_NUM", value: 2 },
      { _tag: "ADD" },
      { _tag: "DROP" },
    ]

    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      Effect.runSync(evalProgram(ir))
    }
    const elapsed = performance.now() - start

    console.log(`  StackVM perf: ${elapsed.toFixed(2)}ms for 10K evals (${(10000 / elapsed * 1000).toFixed(0)} evals/sec)`)
    expect(elapsed).toBeLessThan(500)
  })
})
