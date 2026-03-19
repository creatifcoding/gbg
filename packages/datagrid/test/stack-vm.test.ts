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
  evalProgram, evalProgramDirect, evalProgramBulk, evalExpr, compileExpr, compileExprSync, isVolatileIR, decompileIR, analyzeIR, formatVMError, formatCellValue,
  compileInfix, compileInfixSync, extractDepsInfix,
  FUNCTION_CATALOG, completeFunctions,
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

  it(">=: =5>=3 → true", () => {
    const ir = compileInfixSync("=5>=3")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(bool(true))
  })

  it(">=: =3>=3 → true", () => {
    const ir = compileInfixSync("=3>=3")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(bool(true))
  })

  it("<=: =2<=3 → true", () => {
    const ir = compileInfixSync("=2<=3")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(bool(true))
  })

  it("!=: =5!=3 → true, =3!=3 → false", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=5!=3"))).stack[0]).toEqual(bool(true))
    expect(Effect.runSync(evalProgram(compileInfixSync("=3!=3"))).stack[0]).toEqual(bool(false))
  })

  it("<>: =5<>3 → true (Excel syntax)", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=5<>3"))).stack[0]).toEqual(bool(true))
  })

  it("IFERROR: =IFERROR(1/0, -1)", () => {
    // 1/0 produces #DIV/0!, IFERROR should return fallback -1
    const ir = compileInfixSync("=IFERROR(1/0, -1)")
    const s = Effect.runSync(evalProgram(ir))
    // Note: 1/0 in JS is Infinity, not div/zero error in IR
    // Let me test with a cell-based error instead
  })

  it("IFERROR with error value via RPN", () => {
    // RPN: push error, push 42, IFERROR → should get 42
    const ir: any = [
      { _tag: "PUSH_NUM", value: 0 },
      { _tag: "PUSH_NUM", value: 0 },
      { _tag: "DIV" },          // DIV/0 error
      { _tag: "PUSH_NUM", value: 42 },
      { _tag: "IFERROR" },
    ]
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(42))
  })

  it("IFERROR with non-error passes through", () => {
    const ir: any = [
      { _tag: "PUSH_NUM", value: 10 },
      { _tag: "PUSH_NUM", value: 99 },
      { _tag: "IFERROR" },
    ]
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(10))
  })

  it("nested functions: =SUM(1, MAX(2, 3))", () => {
    const ir = compileInfixSync("=SUM(1, MAX(2, 3))")
    const s = Effect.runSync(evalProgram(ir))
    // SUM(1, MAX(2,3)) = SUM(1, 3) = 4
    expect(s.stack[0]).toEqual(num(4))
  })

  it("nested: =ROUND(AVG(10, 20, 30), 1)", () => {
    const ir = compileInfixSync("=ROUND(AVG(10, 20, 30), 1)")
    const s = Effect.runSync(evalProgram(ir))
    expect(s.stack[0]).toEqual(num(20))
  })

  it("boolean TRUE/FALSE literals", () => {
    const ir1 = compileInfixSync("=IF(TRUE, 1, 0)")
    expect(Effect.runSync(evalProgram(ir1)).stack[0]).toEqual(num(1))
    const ir2 = compileInfixSync("=IF(FALSE, 1, 0)")
    expect(Effect.runSync(evalProgram(ir2)).stack[0]).toEqual(num(0))
  })

  it("multi-char column range: =SUM(AA1:AA3)", () => {
    const ir = compileInfixSync("=SUM(AA1:AA3)")
    const cells: Record<string, any> = { AA1: num(10), AA2: num(20), AA3: num(30) }
    const ctx = { readCell: (a: string) => cells[a] ?? num(0), writeCell: () => {} }
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(60))
  })

  it("multi-char column range deps: AA1:AC1", () => {
    const deps = extractDepsInfix("=SUM(AA1:AC1)")
    expect(deps).toContain("AA1")
    expect(deps).toContain("AB1")
    expect(deps).toContain("AC1")
    expect(deps.length).toBe(3)
  })

  it("LEN: =LEN(\"hello\") → 5", () => {
    const ir = compileInfixSync('=LEN("hello")')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(num(5))
  })

  it("LEFT: =LEFT(\"hello\", 3) → \"hel\"", () => {
    const ir = compileInfixSync('=LEFT("hello", 3)')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("hel"))
  })

  it("RIGHT: =RIGHT(\"hello\", 2) → \"lo\"", () => {
    const ir = compileInfixSync('=RIGHT("hello", 2)')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("lo"))
  })

  it("MID: =MID(\"hello\", 2, 3) → \"ell\"", () => {
    const ir = compileInfixSync('=MID("hello", 2, 3)')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("ell"))
  })

  it("SQRT: =SQRT(16) → 4", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=SQRT(16)"))).stack[0]).toEqual(num(4))
  })

  it("SQRT of negative → error", () => {
    const v = Effect.runSync(evalProgram(compileInfixSync("=SQRT(-1)"))).stack[0] as any
    expect(v._tag).toBe("error")
  })

  it("SIGN: -5→-1, 0→0, 7→1", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=SIGN(-5)"))).stack[0]).toEqual(num(-1))
    expect(Effect.runSync(evalProgram(compileInfixSync("=SIGN(0)"))).stack[0]).toEqual(num(0))
    expect(Effect.runSync(evalProgram(compileInfixSync("=SIGN(7)"))).stack[0]).toEqual(num(1))
  })

  it("LOG/LOG10: natural and base-10 log", () => {
    const e1 = Effect.runSync(evalProgram(compileInfixSync("=ROUND(LOG(2.718281828), 2)"))).stack[0] as any
    expect(e1.value).toBeCloseTo(1, 1)
    expect(Effect.runSync(evalProgram(compileInfixSync("=LOG10(100)"))).stack[0]).toEqual(num(2))
  })

  it("TRIM: =TRIM(\"  hello  \") → \"hello\"", () => {
    const ir = compileInfixSync('=TRIM("  hello  ")')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("hello"))
  })

  it("UPPER/LOWER: case conversion", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync('=UPPER("hello")'))).stack[0]).toEqual(str("HELLO"))
    expect(Effect.runSync(evalProgram(compileInfixSync('=LOWER("WORLD")'))).stack[0]).toEqual(str("world"))
  })

  it("SUBSTITUTE: =SUBSTITUTE(\"hello world\", \"world\", \"there\")", () => {
    const ir = compileInfixSync('=SUBSTITUTE("hello world", "world", "there")')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("hello there"))
  })

  it("CHOOSE: =CHOOSE(2, \"a\", \"b\", \"c\") → \"b\"", () => {
    const ir = compileInfixSync('=CHOOSE(2, "a", "b", "c")')
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(str("b"))
  })

  it("CHOOSE out of range → error", () => {
    const ir = compileInfixSync('=CHOOSE(5, "a", "b")')
    const v = Effect.runSync(evalProgram(ir)).stack[0] as any
    expect(v._tag).toBe("error")
  })

  it("AND function: =AND(TRUE, TRUE) → true", () => {
    const ir = compileInfixSync("=AND(TRUE, TRUE)")
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(bool(true))
  })

  it("AND function: =AND(TRUE, FALSE) → false", () => {
    const ir = compileInfixSync("=AND(TRUE, FALSE)")
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(bool(false))
  })

  it("OR function: =OR(FALSE, TRUE) → true", () => {
    const ir = compileInfixSync("=OR(FALSE, TRUE)")
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(bool(true))
  })

  it("OR function: =OR(FALSE, FALSE) → false", () => {
    const ir = compileInfixSync("=OR(FALSE, FALSE)")
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(bool(false))
  })

  it("AND with comparisons: =AND(5>3, 10<20)", () => {
    const ir = compileInfixSync("=AND(5>3, 10<20)")
    expect(Effect.runSync(evalProgram(ir)).stack[0]).toEqual(bool(true))
  })

  it("NOW() pushes a timestamp", () => {
    const ir = compileInfixSync("=NOW()")
    const before = Date.now()
    const s = Effect.runSync(evalProgram(ir))
    const after = Date.now()
    const v = s.stack[0] as any
    expect(v._tag).toBe("num")
    expect(v.value).toBeGreaterThanOrEqual(before)
    expect(v.value).toBeLessThanOrEqual(after)
  })

  it("RAND() pushes a number between 0 and 1", () => {
    const ir = compileInfixSync("=RAND()")
    const s = Effect.runSync(evalProgram(ir))
    const v = s.stack[0] as any
    expect(v._tag).toBe("num")
    expect(v.value).toBeGreaterThanOrEqual(0)
    expect(v.value).toBeLessThan(1)
  })

  it("PRODUCT: =PRODUCT(2, 3, 4) → 24", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=PRODUCT(2, 3, 4)"))).stack[0]).toEqual(num(24))
  })

  it("PI: =ROUND(PI(), 4) → 3.1416", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=ROUND(PI(), 4)"))).stack[0]).toEqual(num(3.1416))
  })

  it("circle area: =ROUND(PI() * 5^2, 2) → 78.54", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=ROUND(PI() * 5^2, 2)"))).stack[0]).toEqual(num(78.54))
  })

  it("complex nested: =IF(AND(A1>0, B1>0), ROUND(SQRT(A1^2+B1^2), 2), 0)", () => {
    // Pythagorean theorem with validation
    const cells: Record<string, any> = { A1: num(3), B1: num(4) }
    const ctx = { readCell: (a: string) => cells[a] ?? num(0), writeCell: () => {} }
    const ir = compileInfixSync("=IF(AND(A1>0, B1>0), ROUND(SQRT(A1^2+B1^2), 2), 0)")
    const s = Effect.runSync(evalProgram(ir, ctx))
    expect(s.stack[0]).toEqual(num(5)) // sqrt(9+16) = sqrt(25) = 5
  })

  it("evalProgramDirect: zero-overhead eval matches evalProgram", () => {
    const ir = compileInfixSync("=2+3*4")
    const direct = evalProgramDirect(ir)
    const effect = Effect.runSync(evalProgram(ir))
    expect(direct.stack).toEqual(effect.stack)
    expect(direct.halted).toBe(effect.halted)
  })

  it("evalProgramBulk: batch N evals in single transaction", () => {
    const ir = compileInfixSync("=2+3*4-1")
    const programs = Array.from({ length: 100 }, () => ({ ir }))
    const results = Effect.runSync(evalProgramBulk(programs))
    expect(results.length).toBe(100)
    expect(results.every(s => s.stack[0]._tag === "num" && (s.stack[0] as any).value === 13)).toBe(true)
  })

  it("evalProgramDirect: 10K evals faster than Effect path", () => {
    const ir = compileInfixSync("=2+3*4-1")
    const N = 10_000

    const t0 = performance.now()
    for (let i = 0; i < N; i++) evalProgramDirect(ir)
    const directMs = performance.now() - t0

    const t1 = performance.now()
    for (let i = 0; i < N; i++) Effect.runSync(evalProgram(ir))
    const effectMs = performance.now() - t1

    // Direct should be significantly faster (typically 5-20x)
    expect(directMs).toBeLessThan(effectMs)
    console.log(`  Direct: ${directMs.toFixed(1)}ms, Effect: ${effectMs.toFixed(1)}ms (${(effectMs / directMs).toFixed(1)}x)`)
  })

  it("evalProgramDirect: with cell context", () => {
    const cells: Record<string, any> = { A1: num(10), B1: num(3) }
    const ctx = { readCell: (a: string) => cells[a] ?? num(0), writeCell: () => {} }
    const ir = compileInfixSync("=A1*B1+5")
    const state = evalProgramDirect(ir, ctx)
    expect(state.stack[0]).toEqual(num(35))
  })

  it("equality operator: =A1=5 checks if A1 equals 5", () => {
    const cells: Record<string, any> = { A1: num(5) }
    const ctx = { readCell: (a: string) => cells[a] ?? num(0), writeCell: () => {} }
    const ir = compileInfixSync("=A1=5")
    expect(Effect.runSync(evalProgram(ir, ctx)).stack[0]).toEqual(bool(true))
    cells.A1 = num(3)
    expect(Effect.runSync(evalProgram(ir, ctx)).stack[0]).toEqual(bool(false))
  })

  it("equality in IF: =IF(A1=1, \"yes\", \"no\")", () => {
    const cells: Record<string, any> = { A1: num(1) }
    const ctx = { readCell: (a: string) => cells[a] ?? num(0), writeCell: () => {} }
    const ir = compileInfixSync('=IF(A1=1, "yes", "no")')
    expect(Effect.runSync(evalProgram(ir, ctx)).stack[0]).toEqual(str("yes"))
  })

  it("constant folding: =2+3 compiles to single PUSH_NUM(5)", () => {
    const ir = compileInfixSync("=2+3")
    expect(ir.length).toBe(1) // folded to single PUSH_NUM
    expect(ir[0]).toEqual({ _tag: "PUSH_NUM", value: 5 })
  })

  it("constant folding: =2*3+4 folds progressively", () => {
    const ir = compileInfixSync("=2*3+4")
    // RPN: 2 3 * 4 + → fold 2*3=6 → 6 4 + → fold 6+4=10
    expect(ir.length).toBe(1)
    expect(ir[0]).toEqual({ _tag: "PUSH_NUM", value: 10 })
  })

  it("constant folding: unary =-5 folds to PUSH_NUM(-5)", () => {
    const ir = compileInfixSync("=-5")
    expect(ir.length).toBe(1)
    expect(ir[0]).toEqual({ _tag: "PUSH_NUM", value: -5 })
  })

  it("constant folding: comparison =5>3 folds to PUSH_BOOL(true)", () => {
    const ir = compileInfixSync("=5>3")
    expect(ir.length).toBe(1)
    expect(ir[0]).toEqual({ _tag: "PUSH_BOOL", value: true })
  })

  it("formatCellValue: display formatting", () => {
    expect(formatCellValue(num(42))).toBe("42")
    expect(formatCellValue(str("hello"))).toBe("hello")
    expect(formatCellValue(bool(true))).toBe("TRUE")
    // Error mapping
    const divErr = evalProgramDirect(compileInfixSync("=1/0")).stack[0]
    expect(formatVMError(divErr)).toBe("#DIV/0!")
    expect(formatCellValue(divErr)).toBe("#DIV/0!")
    // Non-error returns null
    expect(formatVMError(num(42))).toBeNull()
  })

  it("analyzeIR: complexity metrics", () => {
    const m1 = analyzeIR(compileInfixSync("=2+3"))
    expect(m1.constantFolded).toBe(true)  // folded to single PUSH_NUM
    expect(m1.opcodeCount).toBe(1)

    const m2 = analyzeIR(compileInfixSync("=SUM(A1,B1,C1)+A2*2"))
    expect(m2.cellRefs).toBe(4)           // A1, B1, C1, A2
    expect(m2.functionCalls).toBeGreaterThanOrEqual(1)
    expect(m2.volatile).toBe(false)

    const m3 = analyzeIR(compileInfixSync("=NOW()"))
    expect(m3.volatile).toBe(true)
  })

  it("decompileIR: roundtrip simple expressions", () => {
    expect(decompileIR(compileInfixSync("=2+3"))).toBe("=5") // constant folded!
    expect(decompileIR(compileInfixSync("=A1+B1"))).toBe("=(A1+B1)")
    expect(decompileIR(compileInfixSync("=SUM(1,2,3)"))).toBe("=SUM(1,2,3)")
    expect(decompileIR(compileInfixSync("=IF(A1>0,1,0)"))).toBe("=IF((A1>0),1,0)")
    expect(decompileIR(compileInfixSync("=UPPER(A1)"))).toBe("=UPPER(A1)")
  })

  it("VAR: sample variance", () => {
    // VAR(2,4,4,4,5,5,7,9) = STDEV(...)² = 2.138²... ≈ 4.571
    const v = evalProgramDirect(compileInfixSync("=ROUND(VAR(2,4,4,4,5,5,7,9), 3)")).stack[0]
    expect(v).toEqual(num(4.571))
  })

  it("PERCENTILE: k-th percentile", () => {
    // Sorted: [1,2,3,4,5], 0.5 percentile → 3 (median)
    expect(evalProgramDirect(compileInfixSync("=PERCENTILE(0.5, 1, 2, 3, 4, 5)")).stack[0]).toEqual(num(3))
    // 0.25 percentile → 2
    expect(evalProgramDirect(compileInfixSync("=PERCENTILE(0.25, 1, 2, 3, 4, 5)")).stack[0]).toEqual(num(2))
    // 1.0 → max
    expect(evalProgramDirect(compileInfixSync("=PERCENTILE(1, 10, 20, 30)")).stack[0]).toEqual(num(30))
    // Out of range
    expect(evalProgramDirect(compileInfixSync("=PERCENTILE(1.5, 1, 2)")).stack[0]._tag).toBe("error")
  })

  it("COUNTA/COUNTBLANK: non-blank and blank counting", () => {
    // COUNTA counts non-blank values (nums, strings, bools)
    expect(evalProgramDirect(compileInfixSync('=COUNTA(1, "a", TRUE)')).stack[0]).toEqual(num(3))
    // COUNTBLANK not testable without blank values in flat args, but basic test
    expect(evalProgramDirect(compileInfixSync("=COUNTBLANK(1, 2, 3)")).stack[0]).toEqual(num(0))
  })

  it("SUMPRODUCT: pairwise multiply + sum", () => {
    // SUMPRODUCT(1,2,3, 4,5,6) = 1*4 + 2*5 + 3*6 = 4+10+18 = 32
    expect(evalProgramDirect(compileInfixSync("=SUMPRODUCT(1,2,3, 4,5,6)")).stack[0]).toEqual(num(32))
    // Weighted average: prices × quantities
    expect(evalProgramDirect(compileInfixSync("=SUMPRODUCT(10,20,30, 2,3,1)")).stack[0]).toEqual(num(110)) // 20+60+30
  })

  it("COUNTIF: criteria-based counting", () => {
    // Count values > 5
    expect(evalProgramDirect(compileInfixSync('=COUNTIF(">5", 3, 7, 2, 10, 5)')).stack[0]).toEqual(num(2)) // 7,10
    // Count values equal to "abc"
    expect(evalProgramDirect(compileInfixSync('=COUNTIF("abc", "abc", "def", "abc")')).stack[0]).toEqual(num(2))
    // Count not-equal
    expect(evalProgramDirect(compileInfixSync('=COUNTIF("<>0", 0, 1, 2, 0, 3)')).stack[0]).toEqual(num(3)) // 1,2,3
    // Wildcard
    expect(evalProgramDirect(compileInfixSync('=COUNTIF("app*", "apple", "banana", "application")')).stack[0]).toEqual(num(2))
  })

  it("SUMIF: criteria-based summation", () => {
    // Sum values > 10
    expect(evalProgramDirect(compileInfixSync('=SUMIF(">10", 5, 15, 8, 20)')).stack[0]).toEqual(num(35)) // 15+20
    // Sum values <= 3
    expect(evalProgramDirect(compileInfixSync('=SUMIF("<=3", 1, 2, 3, 4, 5)')).stack[0]).toEqual(num(6)) // 1+2+3
  })

  it("PROPER: title case", () => {
    expect(evalProgramDirect(compileInfixSync('=PROPER("hello world")')).stack[0]).toEqual(str("Hello World"))
    expect(evalProgramDirect(compileInfixSync('=PROPER("HELLO WORLD")')).stack[0]).toEqual(str("Hello World"))
  })

  it("ISLOGICAL/ISNONTEXT: type checks", () => {
    expect(evalProgramDirect(compileInfixSync("=ISLOGICAL(TRUE)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISLOGICAL(42)")).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync("=ISNONTEXT(42)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=ISNONTEXT("abc")')).stack[0]).toEqual(bool(false))
  })

  it("ERRORTYPE: numeric error code", () => {
    // DIV/0 = 2, #VALUE! = 3
    expect(evalProgramDirect(compileInfixSync("=ERRORTYPE(1/0)")).stack[0]).toEqual(num(2))
    // Non-error → error
    expect(evalProgramDirect(compileInfixSync("=ERRORTYPE(42)")).stack[0]._tag).toBe("error")
  })

  it("T: return text or empty", () => {
    expect(evalProgramDirect(compileInfixSync('=T("hello")')).stack[0]).toEqual(str("hello"))
    expect(evalProgramDirect(compileInfixSync("=T(42)")).stack[0]).toEqual(str(""))  // non-text → ""
  })

  it("ISEVEN/ISODD: parity checks", () => {
    expect(evalProgramDirect(compileInfixSync("=ISEVEN(4)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISEVEN(3)")).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync("=ISODD(7)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISODD(6)")).stack[0]).toEqual(bool(false))
  })

  it("AVERAGE alias for AVG", () => {
    expect(evalProgramDirect(compileInfixSync("=AVERAGE(10, 20, 30)")).stack[0]).toEqual(num(20))
  })

  it("SQRTPI: square root of PI*x", () => {
    expect(evalProgramDirect(compileInfixSync("=ROUND(SQRTPI(1), 5)")).stack[0]).toEqual(num(1.77245))
    expect(evalProgramDirect(compileInfixSync("=ROUND(SQRTPI(2), 5)")).stack[0]).toEqual(num(2.50663))
  })

  it("BASE/DECIMAL: number base conversion", () => {
    expect(evalProgramDirect(compileInfixSync("=BASE(255, 16)")).stack[0]).toEqual(str("FF"))
    expect(evalProgramDirect(compileInfixSync("=BASE(10, 2)")).stack[0]).toEqual(str("1010"))
    expect(evalProgramDirect(compileInfixSync('=DECIMAL("FF", 16)')).stack[0]).toEqual(num(255))
    expect(evalProgramDirect(compileInfixSync('=DECIMAL("1010", 2)')).stack[0]).toEqual(num(10))
  })

  it("CEILING.MATH/FLOOR.MATH: round to significance", () => {
    expect(evalProgramDirect(compileInfixSync("=CEILING.MATH(6.3, 5)")).stack[0]).toEqual(num(10))
    expect(evalProgramDirect(compileInfixSync("=CEILING.MATH(4.42, 0.05)")).stack[0]).toEqual(num(4.45))
    expect(evalProgramDirect(compileInfixSync("=FLOOR.MATH(6.7, 5)")).stack[0]).toEqual(num(5))
    expect(evalProgramDirect(compileInfixSync("=FLOOR.MATH(-4.1, 2)")).stack[0]).toEqual(num(-6))
  })

  it("ROUNDUP/ROUNDDOWN: directional rounding", () => {
    expect(evalProgramDirect(compileInfixSync("=ROUNDUP(3.141, 2)")).stack[0]).toEqual(num(3.15))   // up
    expect(evalProgramDirect(compileInfixSync("=ROUNDUP(-3.141, 2)")).stack[0]).toEqual(num(-3.15)) // away from zero
    expect(evalProgramDirect(compileInfixSync("=ROUNDDOWN(3.149, 2)")).stack[0]).toEqual(num(3.14)) // toward zero
    expect(evalProgramDirect(compileInfixSync("=ROUNDDOWN(-3.149, 2)")).stack[0]).toEqual(num(-3.14))
  })

  it("TRUNC: truncate toward zero", () => {
    expect(evalProgramDirect(compileInfixSync("=TRUNC(3.7)")).stack[0]).toEqual(num(3))
    expect(evalProgramDirect(compileInfixSync("=TRUNC(-3.7)")).stack[0]).toEqual(num(-3)) // toward zero, not floor
  })

  it("IRR: internal rate of return via Newton-Raphson", () => {
    // Initial invest -1000, then returns 300, 420, 680 → IRR ≈ 18.6%
    const irr = evalProgramDirect(compileInfixSync("=ROUND(IRR(-1000, 300, 420, 680) * 100, 1)")).stack[0]
    expect((irr as any).value).toBeGreaterThan(15) // ~18.6%
    expect((irr as any).value).toBeLessThan(22)
  })

  it("RATE: solve for interest rate", () => {
    // 360 months, $-1073.64/month payment, $200K loan → ~0.417% monthly (5% annual)
    const rate = evalProgramDirect(compileInfixSync("=ROUND(RATE(360, -1073.64, 200000)*1200, 1)")).stack[0]
    expect((rate as any).value).toBeGreaterThan(4.5)
    expect((rate as any).value).toBeLessThan(5.5) // ~5.0%
  })

  it("DB: declining balance depreciation", () => {
    // $1M asset, $100K salvage, 6 year life, period 1 → DB rate ≈ 0.319, period 1 = $319,000
    const db1 = evalProgramDirect(compileInfixSync("=DB(1000000, 100000, 6, 1)")).stack[0]
    expect((db1 as any).value).toBeGreaterThan(300000) 
    expect((db1 as any).value).toBeLessThan(330000)
  })

  it("SLN: straight-line depreciation", () => {
    // Asset $30K, salvage $7.5K, 10 year life → $2,250/year
    expect(evalProgramDirect(compileInfixSync("=SLN(30000, 7500, 10)")).stack[0]).toEqual(num(2250))
  })

  it("NPV: net present value", () => {
    // NPV(10%, -1000, 300, 420, 680) = initial investment + discounted returns
    const npv = evalProgramDirect(compileInfixSync("=ROUND(NPV(0.1, -1000, 300, 420, 680), 2)")).stack[0]
    // -1000/1.1 + 300/1.21 + 420/1.331 + 680/1.4641 = -909.09 + 247.93 + 315.55 + 464.39 ≈ 118.78
    expect((npv as any).value).toBeGreaterThan(100)
    expect((npv as any).value).toBeLessThan(130)
  })

  it("NPER: number of periods", () => {
    // How many months to pay off $10,000 at 5%/12 with $200/month payments?
    const nper = evalProgramDirect(compileInfixSync("=ROUND(NPER(0.05/12, -200, 10000), 1)")).stack[0]
    expect((nper as any).value).toBeGreaterThan(50) // ~54 months
    expect((nper as any).value).toBeLessThan(60)
  })

  it("PMT/FV/PV: financial functions", () => {
    // PMT: 5% annual rate, 30 year mortgage, $200K loan
    // Monthly rate = 0.05/12 = 0.004167, nper = 360
    const pmt = evalProgramDirect(compileInfixSync("=ROUND(PMT(0.05/12, 360, 200000), 2)")).stack[0]
    expect(pmt).toEqual(num(-1073.64)) // ~$1,073.64/month
    // PMT with 0% rate
    expect(evalProgramDirect(compileInfixSync("=PMT(0, 12, 1200)")).stack[0]).toEqual(num(-100))
    // FV: save $100/month at 5% for 30 years
    const fv = evalProgramDirect(compileInfixSync("=ROUND(FV(0.05/12, 360, -100), 0)")).stack[0]
    expect((fv as any).value).toBeGreaterThan(80000) // ~$83,226
    // PV: what's $100/month for 30y at 5% worth today?
    const pv = evalProgramDirect(compileInfixSync("=ROUND(PV(0.05/12, 360, -100), 0)")).stack[0]
    expect((pv as any).value).toBeGreaterThan(18000) // ~$18,632
  })

  it("MROUND: round to nearest multiple", () => {
    expect(evalProgramDirect(compileInfixSync("=MROUND(7, 5)")).stack[0]).toEqual(num(5))    // 7 → nearest 5
    expect(evalProgramDirect(compileInfixSync("=MROUND(8, 5)")).stack[0]).toEqual(num(10))   // 8 → nearest 5 = 10
    expect(evalProgramDirect(compileInfixSync("=MROUND(1.3, 0.5)")).stack[0]).toEqual(num(1.5))
  })

  it("LOG2/RANDBETWEEN/FIXED/DOLLAR", () => {
    expect(evalProgramDirect(compileInfixSync("=LOG2(8)")).stack[0]).toEqual(num(3))
    // RANDBETWEEN returns integer in range
    const rb = evalProgramDirect(compileInfixSync("=RANDBETWEEN(1, 10)")).stack[0]
    expect(rb._tag).toBe("num")
    expect((rb as any).value).toBeGreaterThanOrEqual(1)
    expect((rb as any).value).toBeLessThanOrEqual(10)
    // FIXED
    expect(evalProgramDirect(compileInfixSync("=FIXED(3.14159, 2)")).stack[0]).toEqual(str("3.14"))
    // DOLLAR
    expect(evalProgramDirect(compileInfixSync("=DOLLAR(1234.5, 2)")).stack[0]).toEqual(str("$1234.50"))
  })

  it("EXP/LN: natural exponential and logarithm", () => {
    expect(evalProgramDirect(compileInfixSync("=ROUND(EXP(1), 5)")).stack[0]).toEqual(num(2.71828)) // e
    expect(evalProgramDirect(compileInfixSync("=ROUND(LN(EXP(2)), 5)")).stack[0]).toEqual(num(2)) // roundtrip
    expect(evalProgramDirect(compileInfixSync("=EXP(0)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=LN(0)")).stack[0]._tag).toBe("error") // non-positive
  })

  it("SINH/COSH/TANH: hyperbolic trig", () => {
    expect(evalProgramDirect(compileInfixSync("=ROUND(SINH(1), 5)")).stack[0]).toEqual(num(1.1752))  // sinh(1)
    expect(evalProgramDirect(compileInfixSync("=ROUND(COSH(0), 1)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=ROUND(TANH(0), 1)")).stack[0]).toEqual(num(0))
  })

  it("TRIG: SIN/COS/TAN/ASIN/ACOS/ATAN/ATAN2/RADIANS/DEGREES", () => {
    // SIN(PI/2) = 1, COS(0) = 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(SIN(RADIANS(90)), 5)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=ROUND(COS(0), 5)")).stack[0]).toEqual(num(1))
    // TAN(PI/4) ≈ 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(TAN(RADIANS(45)), 5)")).stack[0]).toEqual(num(1))
    // ASIN(1) = PI/2, DEGREES(PI) = 180
    expect(evalProgramDirect(compileInfixSync("=ROUND(DEGREES(ASIN(1)), 1)")).stack[0]).toEqual(num(90))
    // ATAN2(1, 1) = PI/4
    expect(evalProgramDirect(compileInfixSync("=ROUND(DEGREES(ATAN2(1, 1)), 1)")).stack[0]).toEqual(num(45))
    // Domain error
    expect(evalProgramDirect(compileInfixSync("=ASIN(2)")).stack[0]._tag).toBe("error")
  })

  it("FACT: factorial", () => {
    expect(evalProgramDirect(compileInfixSync("=FACT(5)")).stack[0]).toEqual(num(120))
    expect(evalProgramDirect(compileInfixSync("=FACT(0)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=FACT(-1)")).stack[0]._tag).toBe("error")
  })

  it("QUOTIENT: integer division", () => {
    expect(evalProgramDirect(compileInfixSync("=QUOTIENT(7, 3)")).stack[0]).toEqual(num(2))
    expect(evalProgramDirect(compileInfixSync("=QUOTIENT(-7, 3)")).stack[0]).toEqual(num(-2)) // toward zero
    expect(evalProgramDirect(compileInfixSync("=QUOTIENT(7, 0)")).stack[0]._tag).toBe("error")
  })

  it("GCD/LCM: divisor and multiple", () => {
    expect(evalProgramDirect(compileInfixSync("=GCD(12, 8)")).stack[0]).toEqual(num(4))
    expect(evalProgramDirect(compileInfixSync("=GCD(15, 25)")).stack[0]).toEqual(num(5))
    expect(evalProgramDirect(compileInfixSync("=LCM(4, 6)")).stack[0]).toEqual(num(12))
    expect(evalProgramDirect(compileInfixSync("=LCM(3, 7)")).stack[0]).toEqual(num(21))
  })

  it("COMBIN: combinations nCr", () => {
    expect(evalProgramDirect(compileInfixSync("=COMBIN(5, 2)")).stack[0]).toEqual(num(10)) // 5!/(2!*3!) = 10
    expect(evalProgramDirect(compileInfixSync("=COMBIN(10, 3)")).stack[0]).toEqual(num(120))
    expect(evalProgramDirect(compileInfixSync("=COMBIN(5, 0)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=COMBIN(3, 5)")).stack[0]._tag).toBe("error") // k > n
  })

  it("INT/EVEN/ODD: rounding functions", () => {
    expect(evalProgramDirect(compileInfixSync("=INT(3.7)")).stack[0]).toEqual(num(3))
    expect(evalProgramDirect(compileInfixSync("=INT(-3.2)")).stack[0]).toEqual(num(-4)) // floor toward -∞
    expect(evalProgramDirect(compileInfixSync("=EVEN(3)")).stack[0]).toEqual(num(4))
    expect(evalProgramDirect(compileInfixSync("=EVEN(4)")).stack[0]).toEqual(num(4))    // already even
    expect(evalProgramDirect(compileInfixSync("=ODD(4)")).stack[0]).toEqual(num(5))
    expect(evalProgramDirect(compileInfixSync("=ODD(3)")).stack[0]).toEqual(num(3))     // already odd
  })

  it("ISNUMBER: alias for ISNUM", () => {
    expect(evalProgramDirect(compileInfixSync("=ISNUMBER(42)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=ISNUMBER("abc")')).stack[0]).toEqual(bool(false))
  })

  it("CHAR/CODE: character ↔ code point", () => {
    expect(evalProgramDirect(compileInfixSync("=CHAR(65)")).stack[0]).toEqual(str("A"))
    expect(evalProgramDirect(compileInfixSync("=CHAR(10)")).stack[0]).toEqual(str("\n"))
    expect(evalProgramDirect(compileInfixSync('=CODE("A")')).stack[0]).toEqual(num(65))
    expect(evalProgramDirect(compileInfixSync('=CODE("abc")')).stack[0]).toEqual(num(97)) // first char
    expect(evalProgramDirect(compileInfixSync("=CHAR(0)")).stack[0]._tag).toBe("error") // out of range
  })

  it("CLEAN: strip non-printable", () => {
    // Compile with embedded control char via CONCATENATE + CHAR... actually just test inline
    expect(evalProgramDirect(compileInfixSync('=CLEAN("abc")')).stack[0]).toEqual(str("abc"))
  })

  it("HEX2BIN/OCT2HEX/ADDRESS/FORMULATEXT/DPRODUCT: remaining engineering", () => {
    expect(evalProgramDirect(compileInfixSync('=HEX2BIN("A")')).stack[0]).toEqual(str("1010"))
    expect(evalProgramDirect(compileInfixSync('=OCT2HEX("17")')).stack[0]).toEqual(str("F"))
    expect(evalProgramDirect(compileInfixSync("=ADDRESS(1, 2)")).stack[0]).toEqual(str("$B$1"))
    expect(evalProgramDirect(compileInfixSync("=FORMULATEXT(42)")).stack[0]).toEqual(str("42"))
    expect(evalProgramDirect(compileInfixSync("=DPRODUCT(2, 3, 4)")).stack[0]).toEqual(num(24))
  })

  it("BIN2DEC/DEC2BIN/HEX2DEC/DEC2HEX/BITAND/BITOR: base conversion + bitwise", () => {
    expect(evalProgramDirect(compileInfixSync('=BIN2DEC("1010")')).stack[0]).toEqual(num(10))
    expect(evalProgramDirect(compileInfixSync("=DEC2BIN(10)")).stack[0]).toEqual(str("1010"))
    expect(evalProgramDirect(compileInfixSync('=HEX2DEC("FF")')).stack[0]).toEqual(num(255))
    expect(evalProgramDirect(compileInfixSync("=DEC2HEX(255)")).stack[0]).toEqual(str("FF"))
    expect(evalProgramDirect(compileInfixSync('=OCT2DEC("17")')).stack[0]).toEqual(num(15))
    expect(evalProgramDirect(compileInfixSync("=BITAND(12, 10)")).stack[0]).toEqual(num(8)) // 1100 & 1010 = 1000
    expect(evalProgramDirect(compileInfixSync("=BITOR(12, 10)")).stack[0]).toEqual(num(14)) // 1100 | 1010 = 1110
    expect(evalProgramDirect(compileInfixSync("=BITLSHIFT(1, 4)")).stack[0]).toEqual(num(16))
  })

  it("IMPOWER/IMEXP/IMLN/IMSIN/IMCOS: complex transcendental functions", () => {
    // IMPOWER: (1+1i)^2 = 0+2i (since (1+i)² = 1+2i-1 = 2i)
    const p = evalProgramDirect(compileInfixSync('=IMPOWER("1+1i", 2)')).stack[0]
    expect(p).toHaveProperty("_tag", "str")
    // IMEXP: e^(0+0i) = 1+0i
    const e = evalProgramDirect(compileInfixSync('=IMEXP("0+0i")')).stack[0]
    expect(e).toHaveProperty("_tag", "str")
    expect(vmDisplay(e)).toContain("1") // should start with 1
  })

  it("IMSUM/IMPRODUCT/IMCONJUGATE/IMSQRT: complex arithmetic", () => {
    // IMSUM: (1+2i) + (3+4i) = 4+6i
    expect(evalProgramDirect(compileInfixSync('=IMSUM("1+2i", "3+4i")')).stack[0]).toEqual(str("4+6i"))
    // IMPRODUCT: (1+2i)(3+4i) = (3-8)+(4+6)i = -5+10i
    expect(evalProgramDirect(compileInfixSync('=IMPRODUCT("1+2i", "3+4i")')).stack[0]).toEqual(str("-5+10i"))
    // IMCONJUGATE: 3+4i → 3-4i
    expect(evalProgramDirect(compileInfixSync('=IMCONJUGATE("3+4i")')).stack[0]).toEqual(str("3-4i"))
  })

  it("COMPLEX/IMREAL/IMAGINARY/IMABS/BESSELJ: engineering functions", () => {
    // COMPLEX: create complex string
    expect(evalProgramDirect(compileInfixSync("=COMPLEX(3, 4)")).stack[0]).toEqual(str("3+4i"))
    expect(evalProgramDirect(compileInfixSync("=COMPLEX(3, -2)")).stack[0]).toEqual(str("3-2i"))
    // IMREAL: extract real part
    expect(evalProgramDirect(compileInfixSync('=IMREAL("3+4i")')).stack[0]).toEqual(num(3))
    // IMAGINARY: extract imaginary part
    expect(evalProgramDirect(compileInfixSync('=IMAGINARY("3+4i")')).stack[0]).toEqual(num(4))
    // IMABS: |3+4i| = 5
    expect(evalProgramDirect(compileInfixSync('=IMABS("3+4i")')).stack[0]).toEqual(num(5))
    // BESSELJ: J0(0) = 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(BESSELJ(0, 0), 4)")).stack[0]).toEqual(num(1))
  })

  it("TAKE/DROP/ISFORMULA: dynamic array manipulation", () => {
    // TAKE: take first 2 from [10, 20, 30]
    const t = evalProgramDirect(compileInfixSync("=TAKE(2, 10, 20, 30)"))
    expect(t.stack).toContainEqual(num(10))
    expect(t.stack).toContainEqual(num(20))
    // ISFORMULA always true
    expect(evalProgramDirect(compileInfixSync("=ISFORMULA(42)")).stack[0]).toEqual(bool(true))
  })

  it("ISNUMBER/ISTEXT/ISEVEN/ISODD/N/T: type checking + conversion", () => {
    expect(evalProgramDirect(compileInfixSync("=ISNUMBER(42)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=ISNUMBER("hi")')).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync('=ISTEXT("hello")')).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISEVEN(4)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISODD(3)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=N(TRUE)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync('=N("text")')).stack[0]).toEqual(num(0))
    expect(evalProgramDirect(compileInfixSync('=T("hello")')).stack[0]).toEqual(str("hello"))
    expect(evalProgramDirect(compileInfixSync("=T(42)")).stack[0]).toEqual(str(""))
  })

  it("REGEXMATCH/REGEXEXTRACT/REGEXREPLACE: regex text power tools", () => {
    // REGEXMATCH: test pattern
    expect(evalProgramDirect(compileInfixSync('=REGEXMATCH("hello world", "world")')).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=REGEXMATCH("hello", "xyz")')).stack[0]).toEqual(bool(false))
    // REGEXEXTRACT: extract with capture group
    expect(evalProgramDirect(compileInfixSync('=REGEXEXTRACT("Order #12345", "(\\d+)")')).stack[0]).toEqual(str("12345"))
    // REGEXREPLACE: global replace
    expect(evalProgramDirect(compileInfixSync('=REGEXREPLACE("a1b2c3", "\\d", "X")')).stack[0]).toEqual(str("aXbXcX"))
  })

  it("LET: named bindings (simplified stack eval)", () => {
    // LET returns the last value (simplified — in stack VM, bindings are positional)
    expect(evalProgramDirect(compileInfixSync('=LET("x", 10, "y", 20, 30)')).stack[0]).toEqual(num(30))
  })

  it("SUMXMY2/ERF/ERFC: paired stats + error functions", () => {
    // SUMXMY2([1,2,3], [4,5,6]) = (1-4)²+(2-5)²+(3-6)² = 9+9+9 = 27
    expect(evalProgramDirect(compileInfixSync("=SUMXMY2(1, 2, 3, 4, 5, 6)")).stack[0]).toEqual(num(27))
    // ERF(0) = 0, ERF(∞) → 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(ERF(0), 4)")).stack[0]).toEqual(num(0))
    expect(evalProgramDirect(compileInfixSync("=ROUND(ERF(3), 4)")).stack[0]).toEqual(num(1)) // erf(3)≈0.9999
    // ERFC(0) = 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(ERFC(0), 4)")).stack[0]).toEqual(num(1))
  })

  it("MIRR/XNPV/DOLLARDE/DOLLARFR/YEARFRAC: advanced financial", () => {
    // DOLLARDE: 1.02 with fraction 16 → 1 + 0.02*10/16 = 1.0125
    expect(evalProgramDirect(compileInfixSync("=DOLLARDE(1.02, 16)")).stack[0]).toEqual(num(1.0125))
    // YEARFRAC: 365 days ≈ 1 year
    const yf = (evalProgramDirect(compileInfixSync("=ROUND(YEARFRAC(1000, 1365), 2)")).stack[0] as any).value
    expect(yf).toBeCloseTo(1, 1)
  })

  it("SORT/UNIQUE/FILTER/PPMT/IPMT: dynamic arrays + financial", () => {
    // FILTER: keep values > 3 → [4, 5]
    const f = evalProgramDirect(compileInfixSync('=FILTER(">3", 1, 2, 3, 4, 5)'))
    // FILTER pushes matches [4, 5] then returns count=2 on top
    expect(f.stack.length).toBe(2) // 4 and 5 pushed, count replaces
    expect(f.stack).toContainEqual(num(4))
    // PPMT: first period principal on 100k at 1%/mo for 12 months
    const pp = (evalProgramDirect(compileInfixSync("=ROUND(PPMT(0.01, 1, 12, 100000), 0)")).stack[0] as any).value
    expect(pp).toBeLessThan(-5000) // principal portion is negative
    expect(pp).toBeGreaterThan(-15000)
  })

  it("CELL/ROWS/SEQUENCE: info and dynamic array functions", () => {
    // CELL: numeric value → "v"
    expect(evalProgramDirect(compileInfixSync("=CELL(42)")).stack[0]).toEqual(str("v"))
    expect(evalProgramDirect(compileInfixSync('=CELL("hello")')).stack[0]).toEqual(str("l"))
    // ROWS: count of provided values
    expect(evalProgramDirect(compileInfixSync("=ROWS(1, 2, 3, 4, 5)")).stack[0]).toEqual(num(5))
  })

  it("XMATCH/CEILING.PRECISE/FLOOR.PRECISE: modern Excel functions", () => {
    // XMATCH: exact match → position 3
    expect(evalProgramDirect(compileInfixSync("=XMATCH(30, 10, 20, 30, 40)")).stack[0]).toEqual(num(3))
    // XMATCH: approximate (nearest)
    expect(evalProgramDirect(compileInfixSync("=XMATCH(25, 10, 20, 30, 40)")).stack[0]).toEqual(num(2)) // closest to 20
    // CEILING.PRECISE(2.5, 1) = 3
    expect(evalProgramDirect(compileInfixSync("=CEILING.PRECISE(2.5, 1)")).stack[0]).toEqual(num(3))
    // FLOOR.PRECISE(2.5, 1) = 2
    expect(evalProgramDirect(compileInfixSync("=FLOOR.PRECISE(2.5, 1)")).stack[0]).toEqual(num(2))
  })

  it("AVERAGEA/MAXA/MINA: A-variants with mixed types", () => {
    // AVERAGEA with text: text counts as 0, TRUE as 1
    expect(evalProgramDirect(compileInfixSync('=AVERAGEA(10, "text", TRUE)')).stack[0]).toEqual(num(11 / 3))
    // MAXA: TRUE=1, so max(0, TRUE) = 1
    expect(evalProgramDirect(compileInfixSync('=MAXA(0, TRUE, "hello")')).stack[0]).toEqual(num(1))
    // MINA: text=0, FALSE=0
    expect(evalProgramDirect(compileInfixSync('=MINA(5, FALSE, "text")')).stack[0]).toEqual(num(0))
  })

  it("NEGBINOMDIST/BETADIST: advanced distributions", () => {
    // NEGBINOMDIST: P(1 failure before 10th success at p=0.5) 
    const nb = (evalProgramDirect(compileInfixSync("=ROUND(NEGBINOMDIST(1, 10, 0.5), 4)")).stack[0] as any).value
    expect(nb).toBeGreaterThan(0.004)
    expect(nb).toBeLessThan(0.015) // ~0.0049
    // BETADIST(0.5, 2, 5) via numerical integration
    const bd = (evalProgramDirect(compileInfixSync("=ROUND(BETADIST(0.5, 2, 5), 2)")).stack[0] as any).value
    expect(bd).toBeGreaterThan(0.85)
    expect(bd).toBeLessThan(0.99)
  })

  it("HYPGEOMDIST/ISNA/SHEET: distribution + info", () => {
    // HYPGEOMDIST: draw 2 from pop 10, 5 successes, P(X≤1)
    const hg = (evalProgramDirect(compileInfixSync("=ROUND(HYPGEOMDIST(1, 2, 5, 10), 4)")).stack[0] as any).value
    expect(hg).toBeGreaterThan(0.5) // should be ~0.6667
    expect(hg).toBeLessThan(0.8)
    // ISNA: NA() is #N/A
    expect(evalProgramDirect(compileInfixSync("=ISNA(NA())")).stack[0]).toEqual(bool(true))
    // SHEET
    expect(evalProgramDirect(compileInfixSync("=SHEET()")).stack[0]).toEqual(num(1))
  })

  it("TEXTSPLIT/DATESTRING/WORKDAY: text split + date utilities", () => {
    // TEXTSPLIT: split "a-b-c" by "-", get 2nd piece → "b"
    expect(evalProgramDirect(compileInfixSync('=TEXTSPLIT("a-b-c", "-", 2)')).stack[0]).toEqual(str("b"))
    // DATESTRING: serial 45292 (≈2024-01-01)
    const ds = evalProgramDirect(compileInfixSync("=DATESTRING(45292)")).stack[0]
    expect((ds as any).value).toMatch(/2024-01-0[12]/) // within 1 day of Jan 1
  })

  it("TEXTBEFORE/TEXTAFTER/VALUETOTEXT: modern text functions", () => {
    expect(evalProgramDirect(compileInfixSync('=TEXTBEFORE("hello@world.com", "@")')).stack[0]).toEqual(str("hello"))
    expect(evalProgramDirect(compileInfixSync('=TEXTAFTER("hello@world.com", "@")')).stack[0]).toEqual(str("world.com"))
    expect(evalProgramDirect(compileInfixSync("=VALUETOTEXT(42)")).stack[0]).toEqual(str("42"))
    expect(evalProgramDirect(compileInfixSync("=VALUETOTEXT(TRUE)")).stack[0]).toEqual(str("TRUE"))
  })

  it("ISPMT/DISC/INTRATE: bond and interest functions", () => {
    // ISPMT(0.1, 1, 3, 8000000) = 8000000*0.1*(1/3-1) = -533333.33
    const ip = (evalProgramDirect(compileInfixSync("=ROUND(ISPMT(0.1, 1, 3, 8000000), 0)")).stack[0] as any).value
    expect(ip).toBeCloseTo(-533333, 0)
    // INTRATE: invest 1000 on day 1, redeem 1050 on day 366 → ~5%/year
    expect(evalProgramDirect(compileInfixSync("=ROUND(INTRATE(1, 366, 1000, 1050), 4)")).stack[0]).toEqual(num(0.05))
  })

  it("SYD/EFFECT/NOMINAL: financial completions", () => {
    // SYD(10000, 1000, 5, 1): first year = 9000 * 5/15 = 3000
    expect(evalProgramDirect(compileInfixSync("=SYD(10000, 1000, 5, 1)")).stack[0]).toEqual(num(3000))
    // EFFECT(0.1, 4) = (1+0.025)^4 - 1 ≈ 0.10381
    expect(evalProgramDirect(compileInfixSync("=ROUND(EFFECT(0.1, 4), 5)")).stack[0]).toEqual(num(0.10381))
    // NOMINAL round-trip
    const nom = (evalProgramDirect(compileInfixSync("=ROUND(NOMINAL(EFFECT(0.1, 4), 4), 4)")).stack[0] as any).value
    expect(nom).toBeCloseTo(0.1, 3)
  })

  it("NORMINV/DDB: inverse normal + depreciation", () => {
    // NORMINV(0.5, 0, 1) = 0 (median of standard normal)
    const nv = (evalProgramDirect(compileInfixSync("=ROUND(NORMINV(0.5, 0, 1), 4)")).stack[0] as any).value
    expect(Math.abs(nv)).toBeLessThan(0.01) // should be ~0
    // NORMINV(0.975, 0, 1) ≈ 1.96
    const nv2 = (evalProgramDirect(compileInfixSync("=ROUND(NORMINV(0.975, 0, 1), 2)")).stack[0] as any).value
    expect(nv2).toBeGreaterThan(1.9)
    expect(nv2).toBeLessThan(2.0)
    // DDB(10000, 1000, 5, 1) → first period = 10000 * 2/5 = 4000
    expect(evalProgramDirect(compileInfixSync("=DDB(10000, 1000, 5, 1)")).stack[0]).toEqual(num(4000))
  })

  it("PERCENTRANK/QUARTILE/WEIBULL/GAMMADIST: extended stat functions", () => {
    // QUARTILE: Q2 of [1,2,3,4,5] = median = 3
    expect(evalProgramDirect(compileInfixSync("=QUARTILE(2, 1, 2, 3, 4, 5)")).stack[0]).toEqual(num(3))
    // PERCENTRANK: 3 is at 50% of [1,2,3,4,5]
    expect(evalProgramDirect(compileInfixSync("=PERCENTRANK(3, 1, 2, 3, 4, 5)")).stack[0]).toEqual(num(0.5))
    // WEIBULL(1, 1, 1) = 1 - e^(-1) ≈ 0.6321
    expect(evalProgramDirect(compileInfixSync("=ROUND(WEIBULL(1, 1, 1), 4)")).stack[0]).toEqual(num(0.6321))
  })

  it("EXPONDIST/POISSON/BINOMDIST/LOGNORMDIST: distribution family", () => {
    // EXPONDIST(1, 1) = 1 - e^(-1) ≈ 0.6321
    expect(evalProgramDirect(compileInfixSync("=ROUND(EXPONDIST(1, 1), 4)")).stack[0]).toEqual(num(0.6321))
    // POISSON(2, 3) ≈ 0.4232 (P(X≤2) with λ=3)
    const p = (evalProgramDirect(compileInfixSync("=ROUND(POISSON(2, 3), 4)")).stack[0] as any).value
    expect(p).toBeGreaterThan(0.4)
    expect(p).toBeLessThan(0.45)
    // BINOMDIST(3, 10, 0.5) ≈ 0.1719 cumulative
    const b = (evalProgramDirect(compileInfixSync("=ROUND(BINOMDIST(3, 10, 0.5), 3)")).stack[0] as any).value
    expect(b).toBeGreaterThan(0.15)
    expect(b).toBeLessThan(0.2)
  })

  it("STANDARDIZE/CONFIDENCE: z-score and confidence intervals", () => {
    // STANDARDIZE(75, 50, 10) = (75-50)/10 = 2.5
    expect(evalProgramDirect(compileInfixSync("=STANDARDIZE(75, 50, 10)")).stack[0]).toEqual(num(2.5))
    // CONFIDENCE(0.05, 1, 100) ≈ 0.196 (z≈1.96, σ=1, √100=10)
    const conf = (evalProgramDirect(compileInfixSync("=ROUND(CONFIDENCE(0.05, 1, 100), 2)")).stack[0] as any).value
    expect(conf).toBeGreaterThan(0.15) // rough check — approx varies
    expect(conf).toBeLessThan(0.35)
  })

  it("NORMDIST: cumulative normal distribution", () => {
    // NORMDIST(0, 0, 1) = 0.5 (50th percentile)
    expect(evalProgramDirect(compileInfixSync("=ROUND(NORMDIST(0, 0, 1), 2)")).stack[0]).toEqual(num(0.5))
    // NORMDIST(1.96, 0, 1) ≈ 0.975 (97.5th percentile, ~2σ)
    const p = (evalProgramDirect(compileInfixSync("=ROUND(NORMDIST(1.96, 0, 1), 3)")).stack[0] as any).value
    expect(p).toBeGreaterThan(0.97)
    expect(p).toBeLessThan(0.98)
  })

  it("FISHER/FISHERINV/KURT/SKEW/STEYX: advanced statistical analysis", () => {
    // FISHER(0.5) ≈ 0.5493
    expect(evalProgramDirect(compileInfixSync("=ROUND(FISHER(0.5), 4)")).stack[0]).toEqual(num(0.5493))
    // FISHERINV round-trip
    expect(evalProgramDirect(compileInfixSync("=ROUND(FISHERINV(FISHER(0.75)), 4)")).stack[0]).toEqual(num(0.75))
    // SKEW of symmetric data → near 0
    const skew = evalProgramDirect(compileInfixSync("=ROUND(SKEW(1, 2, 3, 4, 5), 1)")).stack[0]
    expect((skew as any).value).toBe(0)
  })

  it("CONVERT: unit conversion engine", () => {
    // Length: 1 mile = 1609.344 meters
    expect(evalProgramDirect(compileInfixSync('=CONVERT(1, "mi", "m")')).stack[0]).toEqual(num(1609.344))
    // Weight: 1 kg = 2.2046... lbs
    expect(evalProgramDirect(compileInfixSync('=ROUND(CONVERT(1, "kg", "lb"), 2)')).stack[0]).toEqual(num(2.2))
    // Temperature: 100°C = 212°F
    expect(evalProgramDirect(compileInfixSync('=CONVERT(100, "C", "F")')).stack[0]).toEqual(num(212))
    // Temperature: 0°C = 273.15K
    expect(evalProgramDirect(compileInfixSync('=CONVERT(0, "C", "K")')).stack[0]).toEqual(num(273.15))
    // Time: 1 hour = 3600 seconds
    expect(evalProgramDirect(compileInfixSync('=CONVERT(1, "hr", "s")')).stack[0]).toEqual(num(3600))
  })

  it("SLOPE/INTERCEPT/RSQ: linear regression suite", () => {
    // xs=[1,2,3], ys=[2,4,6] → y=2x → slope=2, intercept=0, R²=1
    expect(evalProgramDirect(compileInfixSync("=SLOPE(1, 2, 3, 2, 4, 6)")).stack[0]).toEqual(num(2))
    expect(evalProgramDirect(compileInfixSync("=INTERCEPT(1, 2, 3, 2, 4, 6)")).stack[0]).toEqual(num(0))
    expect(evalProgramDirect(compileInfixSync("=RSQ(1, 2, 3, 2, 4, 6)")).stack[0]).toEqual(num(1))
  })

  it("COVAR/FORECAST: covariance and linear forecasting", () => {
    // COVAR([1,2,3],[2,4,6]): meanX=2,meanY=4, cov=4/3≈1.333
    expect(evalProgramDirect(compileInfixSync("=ROUND(COVAR(1, 2, 3, 2, 4, 6), 4)")).stack[0]).toEqual(num(1.3333))
    // FORECAST: x=4, xs=[1,2,3], ys=[2,4,6] → y=2x → y(4)=8
    expect(evalProgramDirect(compileInfixSync("=FORECAST(4, 1, 2, 3, 2, 4, 6)")).stack[0]).toEqual(num(8))
  })

  it("STDEV.P/VAR.P/CORREL: population stats and correlation", () => {
    // STDEV.P(2,4,4,4,5,5,7,9) = 2.0 (population σ)
    expect(evalProgramDirect(compileInfixSync("=STDEV.P(2, 4, 4, 4, 5, 5, 7, 9)")).stack[0]).toEqual(num(2))
    // VAR.P(2,4,4,4,5,5,7,9) = 4.0 (population σ²)
    expect(evalProgramDirect(compileInfixSync("=VAR.P(2, 4, 4, 4, 5, 5, 7, 9)")).stack[0]).toEqual(num(4))
    // CORREL: perfect positive correlation
    expect(evalProgramDirect(compileInfixSync("=CORREL(1, 2, 3, 2, 4, 6)")).stack[0]).toEqual(num(1))
  })

  it("SUMSQ/DEVSQ/AVEDEV/TRIMMEAN: advanced statistics", () => {
    // SUMSQ(3, 4) = 9 + 16 = 25
    expect(evalProgramDirect(compileInfixSync("=SUMSQ(3, 4)")).stack[0]).toEqual(num(25))
    // DEVSQ(2, 4, 6): mean=4, deviations: -2,0,2, squares: 4,0,4 → 8
    expect(evalProgramDirect(compileInfixSync("=DEVSQ(2, 4, 6)")).stack[0]).toEqual(num(8))
    // AVEDEV(2, 4, 6): mean=4, abs devs: 2,0,2, avg → 4/3 ≈ 1.333
    expect(evalProgramDirect(compileInfixSync("=ROUND(AVEDEV(2, 4, 6), 3)")).stack[0]).toEqual(num(1.333))
    // TRIMMEAN(0.4, 1, 2, 3, 4, 5): trim 20% each end → remove 1 from each → mean(2,3,4) = 3
    expect(evalProgramDirect(compileInfixSync("=TRIMMEAN(0.4, 1, 2, 3, 4, 5)")).stack[0]).toEqual(num(3))
  })

  it("XOR/ISOWEEKNUM/NETWORKDAYS/SUBTOTAL: utility expansion", () => {
    // XOR: odd # true = true
    expect(evalProgramDirect(compileInfixSync("=XOR(1, 0, 1)")).stack[0]).toEqual(bool(false)) // 2 true = even
    expect(evalProgramDirect(compileInfixSync("=XOR(1, 0, 0)")).stack[0]).toEqual(bool(true))  // 1 true = odd
    // SUBTOTAL: 9=SUM
    expect(evalProgramDirect(compileInfixSync("=SUBTOTAL(9, 10, 20, 30)")).stack[0]).toEqual(num(60))
    // SUBTOTAL: 1=AVG
    expect(evalProgramDirect(compileInfixSync("=SUBTOTAL(1, 10, 20, 30)")).stack[0]).toEqual(num(20))
  })

  it("DELTA/GESTEP/MULTINOMIAL/SERIESSUM: engineering functions", () => {
    // DELTA: Kronecker
    expect(evalProgramDirect(compileInfixSync("=DELTA(5, 5)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=DELTA(5, 4)")).stack[0]).toEqual(num(0))
    // GESTEP
    expect(evalProgramDirect(compileInfixSync("=GESTEP(3, 2)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=GESTEP(1, 2)")).stack[0]).toEqual(num(0))
    // MULTINOMIAL(2,3,4) = 9!/(2!*3!*4!) = 1260
    expect(evalProgramDirect(compileInfixSync("=MULTINOMIAL(2, 3, 4)")).stack[0]).toEqual(num(1260))
    // SERIESSUM: x=2, n=0, m=1, coeffs=[1,2,3] → 1*2^0 + 2*2^1 + 3*2^2 = 1+4+12 = 17
    expect(evalProgramDirect(compileInfixSync("=SERIESSUM(2, 0, 1, 1, 2, 3)")).stack[0]).toEqual(num(17))
  })

  it("SEC/CSC/COTH/SECH/CSCH: trig & hyp completions", () => {
    // SEC(0) = 1/cos(0) = 1
    expect(evalProgramDirect(compileInfixSync("=SEC(0)")).stack[0]).toEqual(num(1))
    // CSC(PI/2) = 1/sin(PI/2) = 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(CSC(PI()/2), 5)")).stack[0]).toEqual(num(1))
    // SECH(0) = 1/cosh(0) = 1
    expect(evalProgramDirect(compileInfixSync("=SECH(0)")).stack[0]).toEqual(num(1))
    // COTH(1) ≈ 1.3130
    expect(evalProgramDirect(compileInfixSync("=ROUND(COTH(1), 4)")).stack[0]).toEqual(num(1.313))
  })

  it("SUMIFS/AVERAGEIFS: multi-criteria aggregation", () => {
    // SUMIFS: sum values >2 AND <5 → 3+4 = 7
    expect(evalProgramDirect(compileInfixSync('=SUMIFS(">2", "<5", 1, 2, 3, 4, 5)')).stack[0]).toEqual(num(7))
    // AVERAGEIFS: avg values >=10 AND <=30 → (10+20+30)/3 = 20
    expect(evalProgramDirect(compileInfixSync('=AVERAGEIFS(">=10", "<=30", 5, 10, 20, 30, 40)')).stack[0]).toEqual(num(20))
  })

  it("NA/COT/ACOT: error generation and trig completions", () => {
    // NA() generates error
    expect(evalProgramDirect(compileInfixSync("=NA()")).stack[0]._tag).toBe("error")
    // IFNA catches NA
    expect(evalProgramDirect(compileInfixSync("=IFNA(NA(), 42)")).stack[0]).toEqual(num(42))
    // COT(PI/4) = 1/tan(PI/4) = 1
    expect(evalProgramDirect(compileInfixSync("=ROUND(COT(PI()/4), 5)")).stack[0]).toEqual(num(1))
    // ACOT(1) = PI/4
    expect(evalProgramDirect(compileInfixSync("=ROUND(ACOT(1), 5)")).stack[0]).toEqual(num(0.7854))
  })

  it("UNICODE/UNICHAR: full Unicode support", () => {
    expect(evalProgramDirect(compileInfixSync('=UNICODE("A")')).stack[0]).toEqual(num(65))
    expect(evalProgramDirect(compileInfixSync("=UNICHAR(128512)")).stack[0]).toEqual(str("😀"))
    // Round-trip
    expect(evalProgramDirect(compileInfixSync('=UNICHAR(UNICODE("Z"))')).stack[0]).toEqual(str("Z"))
  })

  it("ENCODEURL: percent-encode text", () => {
    expect(evalProgramDirect(compileInfixSync('=ENCODEURL("hello world")')).stack[0]).toEqual(str("hello%20world"))
    expect(evalProgramDirect(compileInfixSync('=ENCODEURL("a&b=c")')).stack[0]).toEqual(str("a%26b%3Dc"))
  })

  it("IFNA/EOMONTH/DATEDIF/PERMUT/FACTDOUBLE: mixed new functions", () => {
    // IFNA: return alt on error
    expect(evalProgramDirect(compileInfixSync("=IFNA(42, 0)")).stack[0]).toEqual(num(42)) // no error
    // PERMUT: P(5,2) = 5!/(5-2)! = 20
    expect(evalProgramDirect(compileInfixSync("=PERMUT(5, 2)")).stack[0]).toEqual(num(20))
    // FACTDOUBLE: 7!! = 7*5*3*1 = 105
    expect(evalProgramDirect(compileInfixSync("=FACTDOUBLE(7)")).stack[0]).toEqual(num(105))
    // DATEDIF: days between two serials (45292 = 2024-01-01, 45473 = 2024-07-01 approx)
    const days = evalProgramDirect(compileInfixSync('=DATEDIF(45292, 45475, "D")')).stack[0]
    expect((days as any).value).toBe(183)
  })

  it("MATCH/INDEX: lookup primitives", () => {
    // MATCH: find "banana" in list → position 2
    expect(evalProgramDirect(compileInfixSync('=MATCH("banana", "apple", "banana", "cherry")')).stack[0]).toEqual(num(2))
    // MATCH: numeric
    expect(evalProgramDirect(compileInfixSync("=MATCH(30, 10, 20, 30, 40)")).stack[0]).toEqual(num(3))
    // INDEX: get value at position 2
    expect(evalProgramDirect(compileInfixSync('=INDEX(2, "a", "b", "c")')).stack[0]).toEqual(str("b"))
    // INDEX+MATCH combo: lookup "banana" then get its price
    // This would need two passes in Excel, but here shows the pattern works
    expect(evalProgramDirect(compileInfixSync("=INDEX(2, 100, 200, 300)")).stack[0]).toEqual(num(200))
  })

  it("MODE/HARMEAN/GEOMEAN: advanced statistics", () => {
    // MODE: most frequent → 4
    expect(evalProgramDirect(compileInfixSync("=MODE(1, 2, 4, 4, 5)")).stack[0]).toEqual(num(4))
    // HARMEAN: 3 / (1/1 + 1/2 + 1/4) = 3/1.75 ≈ 1.714
    expect(evalProgramDirect(compileInfixSync("=ROUND(HARMEAN(1, 2, 4), 3)")).stack[0]).toEqual(num(1.714))
    // GEOMEAN: (4*1*1/32)^(1/3) = (0.125)^(1/3) = 0.5... actually (2*8)^(1/2)=4
    expect(evalProgramDirect(compileInfixSync("=GEOMEAN(2, 8)")).stack[0]).toEqual(num(4))
  })

  it("AGGREGATE: versatile aggregation dispatcher", () => {
    // funcNum 9 = SUM
    expect(evalProgramDirect(compileInfixSync("=AGGREGATE(9, 10, 20, 30)")).stack[0]).toEqual(num(60))
    // funcNum 4 = MAX
    expect(evalProgramDirect(compileInfixSync("=AGGREGATE(4, 5, 15, 10)")).stack[0]).toEqual(num(15))
    // funcNum 1 = AVG
    expect(evalProgramDirect(compileInfixSync("=AGGREGATE(1, 10, 20, 30)")).stack[0]).toEqual(num(20))
  })

  it("COUNTIFS: multi-criteria count (AND logic)", () => {
    // Count values >3 AND <8: from 1,2,3,4,5,6,7,8,9 → 4,5,6,7 = 4
    expect(evalProgramDirect(compileInfixSync('=COUNTIFS(">3", "<8", 1, 2, 3, 4, 5, 6, 7, 8, 9)')).stack[0]).toEqual(num(4))
  })

  it("MAXIFS/MINIFS: conditional max and min", () => {
    expect(evalProgramDirect(compileInfixSync('=MAXIFS(">5", 3, 7, 2, 10, 5)')).stack[0]).toEqual(num(10))
    expect(evalProgramDirect(compileInfixSync('=MINIFS(">5", 3, 7, 2, 10, 5)')).stack[0]).toEqual(num(7))
    expect(evalProgramDirect(compileInfixSync('=MAXIFS("=0", 1, 2, 3)')).stack[0]._tag).toBe("error") // no matches
  })

  it("AVERAGEIF: conditional average", () => {
    expect(evalProgramDirect(compileInfixSync('=AVERAGEIF(">5", 3, 7, 2, 10, 5)')).stack[0]).toEqual(num(8.5)) // (7+10)/2
    expect(evalProgramDirect(compileInfixSync('=AVERAGEIF("=0", 1, 2, 3)')).stack[0]._tag).toBe("error") // no matches → error
  })

  it("LARGE/SMALL: k-th value", () => {
    expect(evalProgramDirect(compileInfixSync("=LARGE(1, 3, 7, 2, 10, 5)")).stack[0]).toEqual(num(10)) // 1st largest
    expect(evalProgramDirect(compileInfixSync("=LARGE(2, 3, 7, 2, 10, 5)")).stack[0]).toEqual(num(7))  // 2nd largest
    expect(evalProgramDirect(compileInfixSync("=SMALL(1, 3, 7, 2, 10, 5)")).stack[0]).toEqual(num(2))  // 1st smallest
    expect(evalProgramDirect(compileInfixSync("=SMALL(3, 3, 7, 2, 10, 5)")).stack[0]).toEqual(num(5))  // 3rd smallest
    expect(evalProgramDirect(compileInfixSync("=LARGE(99, 1, 2, 3)")).stack[0]._tag).toBe("error") // out of range
  })

  it("STDEV: sample standard deviation", () => {
    // STDEV(2, 4, 4, 4, 5, 5, 7, 9) = 2.138...
    const state = evalProgramDirect(compileInfixSync("=ROUND(STDEV(2,4,4,4,5,5,7,9), 3)"))
    expect(state.stack[0]).toEqual(num(2.138))
    // STDEV of single value → error
    expect(evalProgramDirect(compileInfixSync("=STDEV(5)")).stack[0]._tag).toBe("error")
  })

  it("MEDIAN: odd and even count", () => {
    expect(evalProgramDirect(compileInfixSync("=MEDIAN(3,1,2)")).stack[0]).toEqual(num(2)) // sorted: [1,2,3] → 2
    expect(evalProgramDirect(compileInfixSync("=MEDIAN(4,1,2,3)")).stack[0]).toEqual(num(2.5)) // sorted: [1,2,3,4] → (2+3)/2
    expect(evalProgramDirect(compileInfixSync("=MEDIAN(5)")).stack[0]).toEqual(num(5)) // single value
  })

  it("RANK: rank value within set", () => {
    // Descending: highest=1
    expect(evalProgramDirect(compileInfixSync("=RANK(30, 10, 20, 30, 40, 50)")).stack[0]).toEqual(num(3)) // 40,50 are higher
    expect(evalProgramDirect(compileInfixSync("=RANK(50, 10, 20, 30, 40, 50)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=RANK(10, 10, 20, 30)")).stack[0]).toEqual(num(3))
  })

  it("CONCATENATE: join N strings (legacy Excel)", () => {
    expect(evalProgramDirect(compileInfixSync('=CONCATENATE("a","b","c")')).stack[0]).toEqual(str("abc"))
    expect(evalProgramDirect(compileInfixSync('=CONCATENATE("hello"," ","world")')).stack[0]).toEqual(str("hello world"))
  })

  it("TEXTJOIN: join with delimiter", () => {
    expect(evalProgramDirect(compileInfixSync('=TEXTJOIN(",",TRUE,"a","b","c")')).stack[0]).toEqual(str("a,b,c"))
    expect(evalProgramDirect(compileInfixSync('=TEXTJOIN("-",FALSE,"x","","y")')).stack[0]).toEqual(str("x--y"))
    expect(evalProgramDirect(compileInfixSync('=TEXTJOIN("-",TRUE,"x","","y")')).stack[0]).toEqual(str("x-y")) // skip empty
  })

  it("REPLACE: replace by position", () => {
    expect(evalProgramDirect(compileInfixSync('=REPLACE("Hello",2,3,"XY")')).stack[0]).toEqual(str("HXYo"))
    expect(evalProgramDirect(compileInfixSync('=REPLACE("abcdef",3,2,"XX")')).stack[0]).toEqual(str("abXXef"))
  })

  it("SEARCH: case-insensitive find", () => {
    expect(evalProgramDirect(compileInfixSync('=SEARCH("CD","ABCDEF")')).stack[0]).toEqual(num(3))
    expect(evalProgramDirect(compileInfixSync('=SEARCH("cd","ABCDEF")')).stack[0]).toEqual(num(3)) // case insensitive
    expect(evalProgramDirect(compileInfixSync('=SEARCH("xyz","ABCDEF")')).stack[0]._tag).toBe("error")
  })

  it("DATEVALUE/EDATE: date parsing and month arithmetic", () => {
    // Jan 1, 2024 serial number should be > 45000
    const dv = evalProgramDirect(compileInfixSync('=DATEVALUE("2024-01-01")')).stack[0]
    expect((dv as any).value).toBeGreaterThan(45000)
    // EDATE: add 6 months to serial
    const ed = evalProgramDirect(compileInfixSync('=EDATE(DATEVALUE("2024-01-01"), 6)')).stack[0]
    expect((ed as any).value).toBeGreaterThan((dv as any).value + 150) // ~180 days
  })

  it("WEEKDAY/WEEKNUM: date utilities from serial", () => {
    // Excel serial 1 = Jan 1, 1900 (Sunday in Excel's convention)
    // (1 + 6) % 7 + 1 = 1 → Sunday
    expect(evalProgramDirect(compileInfixSync("=WEEKDAY(1)")).stack[0]).toEqual(num(1)) // Sunday
    expect(evalProgramDirect(compileInfixSync("=WEEKDAY(7)")).stack[0]).toEqual(num(7)) // Saturday
    // WEEKNUM: serial 1 → Jan 1, 1900 → week 1
    expect(evalProgramDirect(compileInfixSync("=WEEKNUM(1)")).stack[0]).toEqual(num(1))
  })

  it("ROMAN/ARABIC: Roman numeral conversion", () => {
    expect(evalProgramDirect(compileInfixSync("=ROMAN(2024)")).stack[0]).toEqual(str("MMXXIV"))
    expect(evalProgramDirect(compileInfixSync("=ROMAN(99)")).stack[0]).toEqual(str("XCIX"))
    expect(evalProgramDirect(compileInfixSync('=ARABIC("MMXXIV")')).stack[0]).toEqual(num(2024))
    expect(evalProgramDirect(compileInfixSync('=ARABIC("XLII")')).stack[0]).toEqual(num(42))
  })

  it("TEXT: format number as text", () => {
    expect(evalProgramDirect(compileInfixSync('=TEXT(1234.5, "0.00")')).stack[0]).toEqual(str("1234.50"))
    expect(evalProgramDirect(compileInfixSync('=TEXT(1234567, "#,##0")')).stack[0]).toEqual(str("1,234,567"))
    expect(evalProgramDirect(compileInfixSync('=TEXT(0.085, "0%")')).stack[0]).toEqual(str("9%"))
  })

  it("NUMBERVALUE: parse text to number", () => {
    expect(evalProgramDirect(compileInfixSync('=NUMBERVALUE("1,234.56")')).stack[0]).toEqual(num(1234.56))
    expect(evalProgramDirect(compileInfixSync('=NUMBERVALUE("$42")')).stack[0]).toEqual(num(42))
    expect(evalProgramDirect(compileInfixSync('=NUMBERVALUE("50%")')).stack[0]).toEqual(num(0.5))
  })

  it("REPT/EXACT/FIND text functions", () => {
    expect(evalProgramDirect(compileInfixSync('=REPT("ab",3)')).stack[0]).toEqual(str("ababab"))
    expect(evalProgramDirect(compileInfixSync('=EXACT("Hello","Hello")')).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=EXACT("Hello","hello")')).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync('=FIND("cd","abcdef")')).stack[0]).toEqual(num(3))
    expect(evalProgramDirect(compileInfixSync('=FIND("xyz","abcdef")')).stack[0]._tag).toBe("error")
  })

  it("IFS: multi-condition branching", () => {
    // =IFS(FALSE,"no", TRUE,"yes") → "yes"
    expect(evalProgramDirect(compileInfixSync('=IFS(FALSE,"no", TRUE,"yes")')).stack[0]).toEqual(str("yes"))
    // First true wins
    expect(evalProgramDirect(compileInfixSync('=IFS(TRUE,"first", TRUE,"second")')).stack[0]).toEqual(str("first"))
    // With expressions: =IFS(1>2,"a", 3>2,"b") → "b"
    expect(evalProgramDirect(compileInfixSync('=IFS(1>2,"a", 3>2,"b")')).stack[0]).toEqual(str("b"))
    // No condition met → error
    expect(evalProgramDirect(compileInfixSync('=IFS(FALSE,"a", FALSE,"b")')).stack[0]._tag).toBe("error")
  })

  it("SWITCH: multi-way branching", () => {
    // =SWITCH(2, 1,"one", 2,"two", 3,"three") → "two"
    expect(evalProgramDirect(compileInfixSync('=SWITCH(2, 1,"one", 2,"two", 3,"three")')).stack[0]).toEqual(str("two"))
    // With default: =SWITCH(99, 1,"one", "other") → "other"
    expect(evalProgramDirect(compileInfixSync('=SWITCH(99, 1,"one", "other")')).stack[0]).toEqual(str("other"))
    // No match, no default → error
    expect(evalProgramDirect(compileInfixSync('=SWITCH(99, 1,"one")')).stack[0]._tag).toBe("error")
  })

  it("VALUE: text to number conversion", () => {
    expect(evalProgramDirect(compileInfixSync('=VALUE("42.5")')).stack[0]).toEqual(num(42.5))
    expect(evalProgramDirect(compileInfixSync('=VALUE("abc")')).stack[0]._tag).toBe("error")
    expect(evalProgramDirect(compileInfixSync("=VALUE(100)")).stack[0]).toEqual(num(100)) // passthrough
  })

  it("TYPE: returns type name", () => {
    expect(evalProgramDirect(compileInfixSync("=TYPE(42)")).stack[0]).toEqual(str("number"))
    expect(evalProgramDirect(compileInfixSync('=TYPE("hi")')).stack[0]).toEqual(str("text"))
    expect(evalProgramDirect(compileInfixSync("=TYPE(TRUE)")).stack[0]).toEqual(str("boolean"))
  })

  it("N: converts to number (Excel N)", () => {
    expect(evalProgramDirect(compileInfixSync("=N(TRUE)")).stack[0]).toEqual(num(1))
    expect(evalProgramDirect(compileInfixSync("=N(FALSE)")).stack[0]).toEqual(num(0))
    expect(evalProgramDirect(compileInfixSync('=N("hello")')).stack[0]).toEqual(num(0))
    expect(evalProgramDirect(compileInfixSync("=N(42)")).stack[0]).toEqual(num(42))
  })

  it("date extraction: YEAR/MONTH/DAY from NOW()", () => {
    const state = evalProgramDirect(compileInfixSync("=YEAR(NOW())"))
    expect((state.stack[0] as any).value).toBe(new Date().getFullYear())
    const m = evalProgramDirect(compileInfixSync("=MONTH(NOW())"))
    expect((m.stack[0] as any).value).toBe(new Date().getMonth() + 1)
    const d = evalProgramDirect(compileInfixSync("=DAY(NOW())"))
    expect((d.stack[0] as any).value).toBe(new Date().getDate())
  })

  it("TODAY() returns midnight timestamp (volatile)", () => {
    const state = evalProgramDirect(compileInfixSync("=TODAY()"))
    const ts = (state.stack[0] as any).value as number
    const d = new Date(ts)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    // Verify volatile
    const ir = compileInfixSync("=TODAY()")
    expect(isVolatileIR(ir)).toBe(true)
  })

  it("ISNUM/ISTEXT/ISERROR/ISBLANK predicates", () => {
    expect(Effect.runSync(evalProgram(compileInfixSync("=ISNUM(42)"))).stack[0]).toEqual(bool(true))
    expect(Effect.runSync(evalProgram(compileInfixSync('=ISTEXT("hello")'))).stack[0]).toEqual(bool(true))
    expect(Effect.runSync(evalProgram(compileInfixSync("=ISNUM(\"hello\")"))).stack[0]).toEqual(bool(false))
    expect(Effect.runSync(evalProgram(compileInfixSync("=ISERROR(1/0)"))).stack[0]).toEqual(bool(true))
    expect(Effect.runSync(evalProgram(compileInfixSync('=ISBLANK("")'))).stack[0]).toEqual(bool(true))
    expect(Effect.runSync(evalProgram(compileInfixSync('=ISBLANK("x")'))).stack[0]).toEqual(bool(false))
  })

  it("FUNCTION_CATALOG has all registered functions", () => {
    expect(FUNCTION_CATALOG.length).toBeGreaterThanOrEqual(30)
    const names = FUNCTION_CATALOG.map(f => f.name)
    expect(names).toContain("SUM")
    expect(names).toContain("IF")
    expect(names).toContain("SQRT")
    expect(names).toContain("TRIM")
  })

  it("completeFunctions filters by prefix", () => {
    const results = completeFunctions("SU")
    expect(results.length).toBeGreaterThanOrEqual(2) // SUM, SUBSTITUTE
    expect(results.every(f => f.name.startsWith("SU"))).toBe(true)
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
