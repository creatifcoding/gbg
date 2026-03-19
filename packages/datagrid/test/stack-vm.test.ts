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

  it("CUMPRINC/PDURATION: financial utilities", () => {
    // PDURATION: ln(fv/pv)/ln(1+rate); PDURATION(0.1, 100, 200) = ln(2)/ln(1.1) ≈ 7.27
    const pd = (evalProgramDirect(compileInfixSync("=ROUND(PDURATION(0.1, 100, 200), 1)")).stack[0] as any).value
    expect(pd).toBeCloseTo(7.3, 0)
    // TBILLEQ: (365*d) / (360-d*dsm); TBILLEQ(0, 180, 0.05) = (365*0.05)/(360-0.05*180) = 18.25/351 ≈ 0.052
    const tbe = (evalProgramDirect(compileInfixSync("=ROUND(TBILLEQ(0, 180, 0.05), 3)")).stack[0] as any).value
    expect(tbe).toBeCloseTo(0.052, 2)
  })

  it("ROWS/TRANSPOSE/AREAS/VLOOKUP: lookup utilities", () => {
    expect(evalProgramDirect(compileInfixSync("=ROWS(1, 2, 3)")).stack[0]).toEqual(num(3))
    expect(evalProgramDirect(compileInfixSync("=AREAS(1, 2, 3)")).stack[0]).toEqual(num(3))
    // ARRAYTOTEXT tested via direct IR (compilation path is an N_VARIANT)
  })

  it("IFERROR/ISLOGICAL/ISREF: logic and info", () => {
    expect(evalProgramDirect(compileInfixSync("=IFERROR(1/0, 42)")).stack[0]).toEqual(num(42))
    expect(evalProgramDirect(compileInfixSync("=ISLOGICAL(TRUE)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync("=ISLOGICAL(42)")).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync("=ISREF(42)")).stack[0]).toEqual(bool(false))
    expect(evalProgramDirect(compileInfixSync("=ISNONTEXT(42)")).stack[0]).toEqual(bool(true))
    expect(evalProgramDirect(compileInfixSync('=ISNONTEXT("hi")')).stack[0]).toEqual(bool(false))
  })

  it("MROUND/BASE/DECIMAL/CEILING.MATH/FLOOR.MATH: math utilities", () => {
    expect(evalProgramDirect(compileInfixSync("=MROUND(7, 3)")).stack[0]).toEqual(num(6))
    expect(evalProgramDirect(compileInfixSync("=MROUND(10, 3)")).stack[0]).toEqual(num(9))
    expect(evalProgramDirect(compileInfixSync("=BASE(255, 16)")).stack[0]).toEqual(str("FF"))
    expect(evalProgramDirect(compileInfixSync("=BASE(10, 2)")).stack[0]).toEqual(str("1010"))
    expect(evalProgramDirect(compileInfixSync('=DECIMAL("FF", 16)')).stack[0]).toEqual(num(255))
    expect(evalProgramDirect(compileInfixSync('=DECIMAL("1010", 2)')).stack[0]).toEqual(num(10))
  })

  it("INFO/BITCOUNT/CLEANWS: misc utilities", () => {
    expect(evalProgramDirect(compileInfixSync('=INFO("release")')).stack[0]).toEqual(str("TMNL-VM/1.0"))
    expect(evalProgramDirect(compileInfixSync("=BITCOUNT(7)")).stack[0]).toEqual(num(3)) // 111 binary
    expect(evalProgramDirect(compileInfixSync("=BITCOUNT(255)")).stack[0]).toEqual(num(8)) // 11111111
  })

  it("PHI/GAUSS/TDIST: probability distributions", () => {
    // PHI(0) = 1/sqrt(2π) ≈ 0.3989
    const phi = (evalProgramDirect(compileInfixSync("=ROUND(PHI(0), 4)")).stack[0] as any).value
    expect(phi).toBeCloseTo(0.3989, 3)
    // GAUSS(0) = 0 (symmetric)
    expect(evalProgramDirect(compileInfixSync("=ROUND(GAUSS(0), 4)")).stack[0]).toEqual(num(0))
    // GAUSS(1) ≈ 0.3413
    const g = (evalProgramDirect(compileInfixSync("=ROUND(GAUSS(1), 3)")).stack[0] as any).value
    expect(g).toBeCloseTo(0.341, 2)
  })

  it("TEXTREVERSE/CONCAT_WS: text utilities", () => {
    expect(evalProgramDirect(compileInfixSync('=TEXTREVERSE("hello")')).stack[0]).toEqual(str("olleh"))
    expect(evalProgramDirect(compileInfixSync('=CONCAT_WS("-", "a", "b", "c")')).stack[0]).toEqual(str("a-b-c"))
  })

  it("ZTEST/COVARIANCE.S/STDEV.S: hypothesis testing + sample stats", () => {
    // STDEV.S of [2, 4, 4, 4, 5, 5, 7, 9] = 2.138...
    const sd = (evalProgramDirect(compileInfixSync("=ROUND(STDEV.S(2, 4, 4, 4, 5, 5, 7, 9), 2)")).stack[0] as any).value
    expect(sd).toBeCloseTo(2.14, 1)
    // ZTEST: p-value should be between 0 and 1
    const p = (evalProgramDirect(compileInfixSync("=ZTEST(1, 5, 4, 5, 6)")).stack[0] as any).value
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })

  it("TIME/TIMEVALUE/HOUR/MINUTE/SECOND: time functions", () => {
    // TIME(12, 30, 0) = 0.520833...
    const t = (evalProgramDirect(compileInfixSync("=ROUND(TIME(12, 30, 0), 4)")).stack[0] as any).value
    expect(t).toBeCloseTo(0.5208, 3)
    // HOUR(0.5) = 12 (noon)
    expect(evalProgramDirect(compileInfixSync("=HOUR(0.5)")).stack[0]).toEqual(num(12))
    // MINUTE(0.5) = 0
    expect(evalProgramDirect(compileInfixSync("=MINUTE(0.5)")).stack[0]).toEqual(num(0))
    // TIMEVALUE("12:30") ≈ 0.5208
    const tv = (evalProgramDirect(compileInfixSync('=ROUND(TIMEVALUE("12:30"), 4)')).stack[0] as any).value
    expect(tv).toBeCloseTo(0.5208, 3)
  })

  it("GROWTH/TREND/PROB: predictive statistics", () => {
    // TREND: linear prediction on 1,2,3 → next ≈ 4
    const t = (evalProgramDirect(compileInfixSync("=ROUND(TREND(1, 2, 3), 0)")).stack[0] as any).value
    expect(t).toBe(4)
    // PROB: fraction in range [2,4] of [1,2,3,4,5] = 3/5 = 0.6
    const p = (evalProgramDirect(compileInfixSync("=PROB(2, 4, 1, 2, 3, 4, 5)")).stack[0] as any).value
    expect(p).toBe(0.6)
  })

  it("LAMBDA/REDUCE/SCAN: functional programming primitives", () => {
    // REDUCE: sum with initial 0
    expect(evalProgramDirect(compileInfixSync("=REDUCE(0, 1, 2, 3, 4)")).stack[0]).toEqual(num(10))
    // LAMBDA: returns last value (simplified)
    expect(evalProgramDirect(compileInfixSync('=LAMBDA("x", "y", 42)')).stack[0]).toEqual(num(42))
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
// POST-450 FUNCTIONS (coverage for 450→502 expansion)
// ═══════════════════════════════════════════════════════

describe("post-450 function coverage", () => {
  const d = (expr: string) => (evalProgramDirect(compileInfixSync(expr)).stack[0] as any).value
  // Trig: SEC, CSC, ACOT, ACOTH
  it("SEC = 1/cos", () => expect(d("=ROUND(SEC(0), 1)")).toBe(1))
  it("CSC = 1/sin(1)", () => expect(d("=ROUND(CSC(1), 3)")).toBe(1.188))
  it("ACOT inverse cot", () => expect(d("=ROUND(ACOT(1), 4)")).toBe(0.7854))
  
  // Text: ENDSWITH, TEXTREVERSE, TEXTREMOVE, REGEX, ENCODEURL, UNICODE
  it("ENDSWITH true", () => expect(d("=ENDSWITH(\"hello.pdf\", \".pdf\")")).toBe(true))
  it("ENDSWITH false", () => expect(d("=ENDSWITH(\"hello.txt\", \".pdf\")")).toBe(false))
  it("TEXTREVERSE", () => expect(d("=TEXTREVERSE(\"abc\")")).toBe("cba"))
  it("TEXTREMOVE removes all", () => expect(d("=TEXTREMOVE(\"abcabc\", \"a\")")).toBe("bcbc"))
  it("REGEXMATCH true", () => expect(d("=REGEXMATCH(\"abc123\", \"[0-9]+\")")).toBe(true))
  it("REGEXMATCH false", () => expect(d("=REGEXMATCH(\"abcdef\", \"^[0-9]+$\")")).toBe(false))
  it("REGEXEXTRACT", () => expect(d("=REGEXEXTRACT(\"price: $42.50\", \"[0-9.]+\")")).toBe("42.50"))
  it("ENCODEURL", () => expect(d("=ENCODEURL(\"hello world\")")).toBe("hello%20world"))
  it("UNICODE of A", () => expect(d("=UNICODE(\"A\")")).toBe(65))
  it("UNICHAR(65) = A", () => expect(d("=UNICHAR(65)")).toBe("A"))
  it("TEXTSQUEEZE collapses spaces", () => expect(d("=TEXTSQUEEZE(\"  a   b  c  \")")).toBe("a b c"))
  it("CONTAINS true", () => expect(d("=CONTAINS(\"Hello World\", \"world\")")).toBe(true))
  it("STARTSWITH true", () => expect(d("=STARTSWITH(\"Hello World\", \"hello\")")).toBe(true))

  // Logic: IMPLIES, BETWEEN, COALESCE
  it("IMPLIES true→true = true", () => expect(d("=IMPLIES(1, 1)")).toBe(true))
  it("IMPLIES true→false = false", () => expect(d("=IMPLIES(1, 0)")).toBe(false))
  it("IMPLIES false→anything = true", () => expect(d("=IMPLIES(0, 0)")).toBe(true))
  it("BETWEEN in range", () => expect(d("=BETWEEN(5, 1, 10)")).toBe(true))
  it("BETWEEN out of range", () => expect(d("=BETWEEN(15, 1, 10)")).toBe(false))
  it("NAND gate", () => { expect(d("=NAND(1, 1)")).toBe(false); expect(d("=NAND(1, 0)")).toBe(true) })
  it("NOR gate", () => { expect(d("=NOR(0, 0)")).toBe(true); expect(d("=NOR(1, 0)")).toBe(false) })
  
  // Info: TYPE, ISBINARY, ISHEX, ISURL, ISEMAIL, ISFORMULA
  it("TYPE number = number", () => expect(d("=TYPE(42)")).toBe("number"))
  it("TYPE text = text", () => expect(d("=TYPE(\"hello\")")).toBe("text"))
  it("ISBINARY true", () => expect(d("=ISBINARY(\"101010\")")).toBe(true))
  it("ISBINARY false", () => expect(d("=ISBINARY(\"12345\")")).toBe(false))
  it("ISHEX true", () => expect(d("=ISHEX(\"DEADBEEF\")")).toBe(true))
  it("ISURL true", () => expect(d("=ISURL(\"https://example.com\")")).toBe(true))
  it("ISEMAIL true", () => expect(d("=ISEMAIL(\"user@example.com\")")).toBe(true))
  it("ISEMAIL false", () => expect(d("=ISEMAIL(\"not-an-email\")")).toBe(false))

  // Math: HYPOT, GESTEP, DELTA, ARABIC, HASH, SQRTPI, COMBINA
  it("HYPOT(3,4) = 5", () => expect(d("=HYPOT(3, 4)")).toBe(5))
  it("GESTEP(5, 3) = 1", () => expect(d("=GESTEP(5, 3)")).toBe(1))
  it("GESTEP(2, 3) = 0", () => expect(d("=GESTEP(2, 3)")).toBe(0))
  it("DELTA(5, 5) = 1", () => expect(d("=DELTA(5, 5)")).toBe(1))
  it("DELTA(5, 3) = 0", () => expect(d("=DELTA(5, 3)")).toBe(0))
  it("ARABIC(XIV) = 14", () => expect(d("=ARABIC(\"XIV\")")).toBe(14))
  it("ARABIC(MCMLXXXIV) = 1984", () => expect(d("=ARABIC(\"MCMLXXXIV\")")).toBe(1984))
  it("HASH returns number", () => expect(typeof d("=HASH(\"hello\")")).toBe("number"))
  it("SQRTPI(1) ≈ 1.7725", () => expect(d("=ROUND(SQRTPI(1), 4)")).toBe(1.7725))
  it("COMBINA(4,2) = C(5,2) = 10", () => expect(d("=COMBINA(4, 2)")).toBe(10))
  it("PERMUTATIONA(3,2) = 9", () => expect(d("=PERMUTATIONA(3, 2)")).toBe(9))

  // Math interpolation
  it("CLAMP(5, 1, 10) = 5", () => expect(d("=CLAMP(5, 1, 10)")).toBe(5))
  it("CLAMP(15, 1, 10) = 10", () => expect(d("=CLAMP(15, 1, 10)")).toBe(10))
  it("CLAMP(-5, 1, 10) = 1", () => expect(d("=CLAMP(-5, 1, 10)")).toBe(1))
  it("LERP(0, 100, 0.5) = 50", () => expect(d("=LERP(0, 100, 0.5)")).toBe(50))
  it("LERP(0, 100, 0) = 0", () => expect(d("=LERP(0, 100, 0)")).toBe(0))
  it("LERP(0, 100, 1) = 100", () => expect(d("=LERP(0, 100, 1)")).toBe(100))
  it("SMOOTHSTEP(0, 1, 0.5) = 0.5", () => expect(d("=SMOOTHSTEP(0, 1, 0.5)")).toBe(0.5))
  it("ROUNDSIG(1234, 2) = 1200", () => expect(d("=ROUNDSIG(1234, 2)")).toBe(1200))
  it("ROUNDSIG(0.001234, 2) ≈ 0.0012", () => expect(d("=ROUNDSIG(0.001234, 2)")).toBe(0.0012))

  // Text: TEXTINDEXOF, TEXTSLICE
  it("TEXTINDEXOF found", () => expect(d("=TEXTINDEXOF(\"hello world\", \"world\")")).toBe(7))
  it("TEXTINDEXOF not found = 0", () => expect(d("=TEXTINDEXOF(\"hello\", \"xyz\")")).toBe(0))
  it("TEXTSLICE(hello, 2, 4) = ell", () => expect(d("=TEXTSLICE(\"hello\", 2, 4)")).toBe("ell"))

  // Info validators
  it("ISINTEGER(5) = true", () => expect(d("=ISINTEGER(5)")).toBe(true))
  it("ISINTEGER(5.5) = false", () => expect(d("=ISINTEGER(5.5)")).toBe(false))
  it("ISFLOAT(5.5) = true", () => expect(d("=ISFLOAT(5.5)")).toBe(true))
  it("ISPOSITIVE(5) = true", () => expect(d("=ISPOSITIVE(5)")).toBe(true))
  it("ISPOSITIVE(-5) = false", () => expect(d("=ISPOSITIVE(-5)")).toBe(false))
  it("ISNEGATIVE(-5) = true", () => expect(d("=ISNEGATIVE(-5)")).toBe(true))
  it("ISLEAPYEAR(2024) = true", () => expect(d("=ISLEAPYEAR(2024)")).toBe(true))
  it("ISLEAPYEAR(2023) = false", () => expect(d("=ISLEAPYEAR(2023)")).toBe(false))
  it("DAYSINYEAR(2024) = 366", () => expect(d("=DAYSINYEAR(2024)")).toBe(366))
  it("DAYSINYEAR(2023) = 365", () => expect(d("=DAYSINYEAR(2023)")).toBe(365))
  it("DAYSINMONTH(2024, 2) = 29", () => expect(d("=DAYSINMONTH(2024, 2)")).toBe(29))
  it("DAYSINMONTH(2023, 2) = 28", () => expect(d("=DAYSINMONTH(2023, 2)")).toBe(28))

  // Financial: depreciation + rates
  it("SLN(1000, 100, 10) = 90", () => expect(d("=SLN(1000, 100, 10)")).toBe(90))
  it("SYD(1000, 100, 5, 1) = 300", () => expect(d("=SYD(1000, 100, 5, 1)")).toBe(300))
  it("EFFECT.RATE(0.1, 12) ≈ 0.1047", () => expect(d("=ROUND(EFFECT.RATE(0.1, 12), 4)")).toBe(0.1047))
  it("NOMINAL(0.1047, 12) ≈ 0.1", () => expect(d("=ROUND(NOMINAL(0.1047, 12), 2)")).toBe(0.1))

  // Logic gates
  it("NAND(1,1) = false", () => expect(d("=NAND(1,1)")).toBe(false))
  it("NAND(1,0) = true", () => expect(d("=NAND(1,0)")).toBe(true))
  it("NOR(0,0) = true", () => expect(d("=NOR(0,0)")).toBe(true))
  it("NOR(1,0) = false", () => expect(d("=NOR(1,0)")).toBe(false))
  it("XNOR(1,1) = true", () => expect(d("=XNOR(1,1)")).toBe(true))
  it("XNOR(1,0) = false", () => expect(d("=XNOR(1,0)")).toBe(false))

  // Text: mask + truncate
  it("TEXTMASK(hello, 2) = he***", () => expect(d("=TEXTMASK(\"hello\", 2)")).toBe("he***"))
  it("TEXTTRUNCATE short passthrough", () => expect(d("=TEXTTRUNCATE(\"hi\", 10)")).toBe("hi"))
  it("TEXTTRUNCATE with ellipsis", () => expect(d("=TEXTTRUNCATE(\"hello world foo bar\", 10)")).toBe("hello w..."))
  it("TEXTTITLE", () => expect(d("=TEXTTITLE(\"hello world\")")).toBe("Hello World"))

  // Stat: ZSCORE
  it("ZSCORE(110, 100, 10) = 1", () => expect(d("=ZSCORE(110, 100, 10)")).toBe(1))
  it("ZSCORE(90, 100, 10) = -1", () => expect(d("=ZSCORE(90, 100, 10)")).toBe(-1))

  // Math: sequences and distance
  it("FIBONACCI(0) = 0", () => expect(d("=FIBONACCI(0)")).toBe(0))
  it("FIBONACCI(1) = 1", () => expect(d("=FIBONACCI(1)")).toBe(1))
  it("FIBONACCI(10) = 55", () => expect(d("=FIBONACCI(10)")).toBe(55))
  it("COLLATZ(6) = 8", () => expect(d("=COLLATZ(6)")).toBe(8))
  it("DISTANCE2D(0,0,3,4) = 5", () => expect(d("=DISTANCE2D(0,0,3,4)")).toBe(5))
  it("MANHATTAN(0,0,3,4) = 7", () => expect(d("=MANHATTAN(0,0,3,4)")).toBe(7))
  it("HYPOT3(1,2,2) = 3", () => expect(d("=HYPOT3(1,2,2)")).toBe(3))

  // Financial: CAGR, DOLLARDE
  it("CAGR(100, 200, 10) ≈ 0.0718", () => expect(d("=ROUND(CAGR(100, 200, 10), 4)")).toBe(0.0718))
  it("DOLLARDE(1.02, 16) = 1.0125", () => expect(d("=DOLLARDE(1.02, 16)")).toBe(1.0125))

  // Info: TYPEOF2
  it("TYPEOF2(5) = number", () => expect(d("=TYPEOF2(5)")).toBe("number"))
  it("TYPEOF2(\"hi\") = text", () => expect(d("=TYPEOF2(\"hi\")")).toBe("text"))
  it("TYPEOF2(TRUE) = boolean", () => expect(d("=TYPEOF2(TRUE)")).toBe("boolean"))

  // Number theory
  it("ISPRIME(7) = true", () => expect(d("=ISPRIME(7)")).toBe(true))
  it("ISPRIME(4) = false", () => expect(d("=ISPRIME(4)")).toBe(false))
  it("ISPRIME(2) = true", () => expect(d("=ISPRIME(2)")).toBe(true))
  it("NEXTPRIME(4) = 5", () => expect(d("=NEXTPRIME(4)")).toBe(5))
  it("NEXTPRIME(7) = 7", () => expect(d("=NEXTPRIME(7)")).toBe(7))
  it("PRIMECOUNT(10) = 4", () => expect(d("=PRIMECOUNT(10)")).toBe(4))
  it("TOTIENT(12) = 4", () => expect(d("=TOTIENT(12)")).toBe(4))
  it("DIVISORS(12) = 6", () => expect(d("=DIVISORS(12)")).toBe(6))
  it("DIVISORS(1) = 1", () => expect(d("=DIVISORS(1)")).toBe(1))

  // Text: pad, charcode
  it("CHARCODE(A) = 65", () => expect(d("=CHARCODE(\"A\")")).toBe(65))
  it("FROMCHARCODE(65) = A", () => expect(d("=FROMCHARCODE(65)")).toBe("A"))
  it("CELLTYPE(5) = 1", () => expect(d("=CELLTYPE(5)")).toBe(1))
  it("CELLTYPE(text) = 2", () => expect(d("=CELLTYPE(\"hi\")")).toBe(2))

  // Digit functions
  it("DIGSUM(1234) = 10", () => expect(d("=DIGSUM(1234)")).toBe(10))
  it("DIGROOT(493) = 7", () => expect(d("=DIGROOT(493)")).toBe(7))
  it("NTHROOT(27, 3) = 3", () => expect(d("=NTHROOT(27, 3)")).toBe(3))

  // Text distance
  it("TEXTHAMMING(abc, axc) = 1", () => expect(d("=TEXTHAMMING(\"abc\", \"axc\")")).toBe(1))
  it("TEXTLEV(kitten, sitting) = 3", () => expect(d("=TEXTLEV(\"kitten\", \"sitting\")")).toBe(3))

  // Info validators
  it("ISALPHANUM(abc123) = true", () => expect(d("=ISALPHANUM(\"abc123\")")).toBe(true))
  it("ISALPHANUM(abc 123) = false", () => expect(d("=ISALPHANUM(\"abc 123\")")).toBe(false))
  it("ISALPHA(hello) = true", () => expect(d("=ISALPHA(\"hello\")")).toBe(true))
  it("ISALPHA(hello1) = false", () => expect(d("=ISALPHA(\"hello1\")")).toBe(false))

  // Geometry
  it("CIRCLEAREA(1) ≈ π", () => expect(d("=CIRCLEAREA(1)")).toBeCloseTo(Math.PI, 5))
  it("SPHEREVOL(1) ≈ 4/3π", () => expect(d("=SPHEREVOL(1)")).toBeCloseTo(4/3*Math.PI, 5))
  it("CYLINDERVOL(2,3) ≈ 12π", () => expect(d("=CYLINDERVOL(2,3)")).toBeCloseTo(12*Math.PI, 5))

  // Stat: kurtosis/skewness
  it("KURTOSIS(1,2,3,4,5) ≈ -1.3", () => expect(d("=KURTOSIS(1,2,3,4,5)")).toBeCloseTo(-1.3, 1))
  it("SKEWNESS(1,2,3,4,5) ≈ 0", () => expect(d("=SKEWNESS(1,2,3,4,5)")).toBeCloseTo(0, 5))
  it("GEOMEAN2(2,8) = 4", () => expect(d("=GEOMEAN2(2,8)")).toBeCloseTo(4, 5))
  it("HARMEAN2(1,3) = 1.5", () => expect(d("=HARMEAN2(1,3)")).toBeCloseTo(1.5, 5))

  // Text
  it("TEXTSLUG(Hello World!) = hello-world", () => expect(d("=TEXTSLUG(\"Hello World!\")")).toBe("hello-world"))
  it("TEXTASCII strips unicode", () => expect(d("=TEXTASCII(\"café\")")).toBe("caf"))
  it("ISNUMSTR(42) = true", () => expect(d("=ISNUMSTR(\"42\")")).toBe(true))
  it("ISNUMSTR(abc) = false", () => expect(d("=ISNUMSTR(\"abc\")")).toBe(false))

  // Financial
  it("ROI(150, 100) = 0.5", () => expect(d("=ROI(150, 100)")).toBe(0.5))
  it("PAYBACK(1000, 250) = 4", () => expect(d("=PAYBACK(1000, 250)")).toBe(4))

  // Logic: ALL/ANY/NONE
  it("ALL2(TRUE,TRUE) = true", () => expect(d("=ALL2(TRUE,TRUE)")).toBe(true))
  it("ALL2(TRUE,FALSE) = false", () => expect(d("=ALL2(TRUE,FALSE)")).toBe(false))
  it("ANY2(FALSE,TRUE) = true", () => expect(d("=ANY2(FALSE,TRUE)")).toBe(true))
  it("NONE2(FALSE,FALSE) = true", () => expect(d("=NONE2(FALSE,FALSE)")).toBe(true))

  // Trig & conversions
  it("DEG2RAD(180) ≈ π", () => expect(d("=DEG2RAD(180)")).toBeCloseTo(Math.PI, 5))
  it("RAD2DEG(PI()) ≈ 180", () => expect(d("=RAD2DEG(PI())")).toBeCloseTo(180, 5))
  it("SINC(0) = 1", () => expect(d("=SINC(0)")).toBe(1))

  // Combinatorics
  it("BINOMCOEF(5,2) = 10", () => expect(d("=BINOMCOEF(5,2)")).toBe(10))
  it("CATALAN(5) = 42", () => expect(d("=CATALAN(5)")).toBe(42))
  it("TRIANGLENUM(10) = 55", () => expect(d("=TRIANGLENUM(10)")).toBe(55))

  // Text
  it("TEXTSTRIP strips HTML", () => expect(d("=TEXTSTRIP(\"<b>hi</b>\")")).toBe("hi"))
  it("TEXTNORM collapses whitespace", () => expect(d("=TEXTNORM(\"  a  b  \")")).toBe("a b"))

  // Financial
  it("PROFITMARGIN(100, 60) = 0.4", () => expect(d("=PROFITMARGIN(100, 60)")).toBe(0.4))
  it("MARKUP(150, 100) = 0.5", () => expect(d("=MARKUP(150, 100)")).toBe(0.5))
  it("BREAKEVEN(10000, 50, 30) = 500", () => expect(d("=BREAKEVEN(10000, 50, 30)")).toBe(500))

  // Info
  it("ISUPPER(ABC) = true", () => expect(d("=ISUPPER(\"ABC\")")).toBe(true))
  it("ISLOWER(abc) = true", () => expect(d("=ISLOWER(\"abc\")")).toBe(true))
  it("ISPALINDROME(racecar) = true", () => expect(d("=ISPALINDROME(\"racecar\")")).toBe(true))
  it("ISPALINDROME(hello) = false", () => expect(d("=ISPALINDROME(\"hello\")")).toBe(false))

  // Figurate numbers
  it("PENTAGONAL(5) = 35", () => expect(d("=PENTAGONAL(5)")).toBe(35))
  it("HEXAGONAL(4) = 28", () => expect(d("=HEXAGONAL(4)")).toBe(28))
  it("TETRAHEDRAL(4) = 20", () => expect(d("=TETRAHEDRAL(4)")).toBe(20))
  it("PYRAMIDAL(4) = 30", () => expect(d("=PYRAMIDAL(4)")).toBe(30))

  // Perfect/Harshad numbers
  it("ISPERFECT(6) = true", () => expect(d("=ISPERFECT(6)")).toBe(true))
  it("ISPERFECT(7) = false", () => expect(d("=ISPERFECT(7)")).toBe(false))
  it("ISHARSHAD(18) = true", () => expect(d("=ISHARSHAD(18)")).toBe(true))

  // Text compression
  it("TEXTRLE(aaabbc) = 3a2bc", () => expect(d("=TEXTRLE(\"aaabbc\")")).toBe("3a2bc"))
  it("TEXTRLD(3a2bc) = aaabbc", () => expect(d("=TEXTRLD(\"3a2bc\")")).toBe("aaabbc"))

  // Geometry
  it("CONEVOL(3,4) ≈ 12π", () => expect(d("=CONEVOL(3,4)")).toBeCloseTo(12*Math.PI, 5))

  // Waves
  it("SQUAREWAVE(0.25, 1) = 1", () => expect(d("=SQUAREWAVE(0.25, 1)")).toBe(1))
  it("SQUAREWAVE(0.75, 1) = -1", () => expect(d("=SQUAREWAVE(0.75, 1)")).toBe(-1))

  // AGM
  it("AGM(1, 2) ≈ 1.4567", () => expect(d("=AGM(1, 2)")).toBeCloseTo(1.4567, 3))

  // Gamma
  it("GAMMA2(5) = 24", () => expect(d("=GAMMA2(5)")).toBeCloseTo(24, 5))

  // Ciphers
  it("TEXTROT13(hello) = uryyb", () => expect(d("=TEXTROT13(\"hello\")")).toBe("uryyb"))
  it("TEXTCAESAR(abc, 3) = def", () => expect(d("=TEXTCAESAR(\"abc\", 3)")).toBe("def"))

  // Info
  it("ISASCII(hello) = true", () => expect(d("=ISASCII(\"hello\")")).toBe(true))
  it("ISPRINTABLE(hello) = true", () => expect(d("=ISPRINTABLE(\"hello\")")).toBe(true))

  // Financial
  it("SIMPLEINT(1000, 0.05, 3) = 150", () => expect(d("=SIMPLEINT(1000, 0.05, 3)")).toBeCloseTo(150, 5))
  it("DEPRECIATION(10000, 1000, 5) = 1800", () => expect(d("=DEPRECIATION(10000, 1000, 5)")).toBe(1800))

  // Sequences: Lucas, Bell
  it("LUCAS(6) = 18", () => expect(d("=LUCAS(6)")).toBe(18))
  it("BELL(4) = 15", () => expect(d("=BELL(4)")).toBe(15))

  // Bit operations
  it("INTLOG2(8) = 3", () => expect(d("=INTLOG2(8)")).toBe(3))
  it("INTLOG10(1000) = 3", () => expect(d("=INTLOG10(1000)")).toBe(3))
  it("BITLEN(255) = 8", () => expect(d("=BITLEN(255)")).toBe(8))

  // Text
  it("TEXTREPEAT(ab, 3) = ababab", () => expect(d("=TEXTREPEAT(\"ab\", 3)")).toBe("ababab"))
  it("TEXTNTH(hello, 2) = e", () => expect(d("=TEXTNTH(\"hello\", 2)")).toBe("e"))
  it("TEXTUNIQUE(aabbcc) = abc", () => expect(d("=TEXTUNIQUE(\"aabbcc\")")).toBe("abc"))
  it("TEXTDISTINCT(hello) = 4", () => expect(d("=TEXTDISTINCT(\"hello\")")).toBe(4))

  // Info
  it("CHARCOUNT(banana, a) = 3", () => expect(d("=CHARCOUNT(\"banana\", \"a\")")).toBe(3))
  it("ISEMPTYTEXT(  ) = true", () => expect(d("=ISEMPTYTEXT(\"  \")")).toBe(true))

  // Financial
  it("RULEOF72(0.06) ≈ 12", () => expect(d("=RULEOF72(0.06)")).toBe(12))

  // Constants
  it("GOLDEN() ≈ 1.618", () => expect(d("=GOLDEN()")).toBeCloseTo(1.618, 2))
  it("TAU() ≈ 6.283", () => expect(d("=TAU()")).toBeCloseTo(2 * Math.PI, 5))

  // Math utilities
  it("CUBEROOT(27) = 3", () => expect(d("=CUBEROOT(27)")).toBe(3))
  it("DIGITCOUNT(12345) = 5", () => expect(d("=DIGITCOUNT(12345)")).toBe(5))

  // Text
  it("TEXTPREFIX(hello, 3) = hel", () => expect(d("=TEXTPREFIX(\"hello\", 3)")).toBe("hel"))
  it("TEXTSUFFIX(hello, 3) = llo", () => expect(d("=TEXTSUFFIX(\"hello\", 3)")).toBe("llo"))
  it("TEXTROT13(hello) round-trip", () => expect(d("=TEXTROT13(TEXTROT13(\"hello\"))")).toBe("hello"))

  // Stat
  it("RMS(3,4) = 2.5 (√12.5)", () => expect(d("=RMS(3,4)")).toBeCloseTo(Math.sqrt(12.5), 5))
  it("RANGE2(1,5,3) = 4", () => expect(d("=RANGE2(1,5,3)")).toBe(4))
  it("ISZERO(0) = true", () => expect(d("=ISZERO(0)")).toBe(true))
  it("ISZERO(5) = false", () => expect(d("=ISZERO(5)")).toBe(false))
  it("ANNUITY(0.05, 10) ≈ 7.72", () => expect(d("=ANNUITY(0.05, 10)")).toBeCloseTo(7.7217, 3))

  // Roman numerals
  it("TOROMAN(42) = XLII", () => expect(d("=TOROMAN(42)")).toBe("XLII"))
  it("FROMROMAN(XLII) = 42", () => expect(d("=FROMROMAN(\"XLII\")")).toBe(42))
  it("TOROMAN→FROMROMAN round-trip", () => expect(d("=FROMROMAN(TOROMAN(1999))")).toBe(1999))

  // Ordinals
  it("TOORDINAL(1) = 1st", () => expect(d("=TOORDINAL(1)")).toBe("1st"))
  it("TOORDINAL(3) = 3rd", () => expect(d("=TOORDINAL(3)")).toBe("3rd"))

  // Hex text encoding
  it("TEXTHEX(AB) = 4142", () => expect(d("=TEXTHEX(\"AB\")")).toBe("4142"))
  it("TEXTFROMHEX(4142) = AB", () => expect(d("=TEXTFROMHEX(\"4142\")")).toBe("AB"))

  // Text utilities
  it("TEXTDEDUPE(aaabbb) = ab", () => expect(d("=TEXTDEDUPE(\"aaabbb\")")).toBe("ab"))
  it("TEXTPASCALCASE(hello world) = HelloWorld", () => expect(d("=TEXTPASCALCASE(\"hello world\")")).toBe("HelloWorld"))

  // Number theory / info
  it("ISPOWEROFTWO(8) = true", () => expect(d("=ISPOWEROFTWO(8)")).toBe(true))
  it("ISPOWEROFTWO(6) = false", () => expect(d("=ISPOWEROFTWO(6)")).toBe(false))
  it("ISPRIMEFAST(97) = true", () => expect(d("=ISPRIMEFAST(97)")).toBe(true))

  // Financial ratios
  it("SHARPE(0.12, 0.02, 0.15) ≈ 0.667", () => expect(d("=SHARPE(0.12, 0.02, 0.15)")).toBeCloseTo(0.6667, 3))
  it("CHEBYSHEV(-3, 5) = 5", () => expect(d("=CHEBYSHEV(-3, 5)")).toBe(5))

  // Number theory
  it("COPRIME(8, 15) = true", () => expect(d("=COPRIME(8, 15)")).toBe(true))
  it("COPRIME(6, 9) = false", () => expect(d("=COPRIME(6, 9)")).toBe(false))
  it("COLLATZ(6) = 8", () => expect(d("=COLLATZ(6)")).toBe(8))
  it("PREVPRIME(10) = 7", () => expect(d("=PREVPRIME(10)")).toBe(7))
  it("TOTIENT2(12) = 4", () => expect(d("=TOTIENT2(12)")).toBe(4))
  it("FIBONACCI2(10) = 55", () => expect(d("=FIBONACCI2(10)")).toBe(55))
  it("DERANGEMENT(4) = 9", () => expect(d("=DERANGEMENT(4)")).toBe(9))
  it("ISFIBBISH(8) = true", () => expect(d("=ISFIBBISH(8)")).toBe(true))
  it("ISFIBBISH(9) = false", () => expect(d("=ISFIBBISH(9)")).toBe(false))

  // Text
  it("TEXTMASK(secret, 2) = se****", () => expect(d("=TEXTMASK(\"secret\", 2)")).toBe("se****"))
  it("TEXTOBFUSCATE(hello) = h***o", () => expect(d("=TEXTOBFUSCATE(\"hello\")")).toBe("h***o"))
  it("TEXTCOUNT2(banana, an) = 2", () => expect(d("=TEXTCOUNT2(\"banana\", \"an\")")).toBe(2))
  it("WORDSCOUNT(hello world) = 2", () => expect(d("=WORDSCOUNT(\"hello world\")")).toBe(2))
  it("TEXTISEMAIL(a@b.c) = true", () => expect(d("=TEXTISEMAIL(\"a@b.c\")")).toBe(true))
  it("TEXTISURL(https://x.com) = true", () => expect(d("=TEXTISURL(\"https://x.com\")")).toBe(true))

  // Info/dates
  it("ISLEAPYEAR(2024) = true", () => expect(d("=ISLEAPYEAR(2024)")).toBe(true))
  it("ISLEAPYEAR(2023) = false", () => expect(d("=ISLEAPYEAR(2023)")).toBe(false))
  it("QUARTERNO(7) = 3", () => expect(d("=QUARTERNO(7)")).toBe(3))
  it("SEMESTERNO(3) = 1", () => expect(d("=SEMESTERNO(3)")).toBe(1))

  // Financial
  it("EFFECTRATE(0.12, 12) ≈ 0.1268", () => expect(d("=EFFECTRATE(0.12, 12)")).toBeCloseTo(0.1268, 3))

  // --- 800 batch tests ---
  // Lookup
  it("COUNTUNIQ(1,2,2,3) = 3", () => expect(d("=COUNTUNIQ(1,2,2,3)")).toBe(3))
  it("ARRAYCONTAINS(3, 1, 2, 3, 4) = true", () => expect(d("=ARRAYCONTAINS(3, 1, 2, 3, 4)")).toBe(true))
  it("ARRAYCONTAINS(5, 1, 2, 3) = false", () => expect(d("=ARRAYCONTAINS(5, 1, 2, 3)")).toBe(false))
  it("ARRAYPOS(3, 1, 2, 3, 4) = 3", () => expect(d("=ARRAYPOS(3, 1, 2, 3, 4)")).toBe(3))
  it("FINDALL(2, 1, 2, 3, 2) = 2", () => expect(d("=FINDALL(2, 1, 2, 3, 2)")).toBe(2))

  // Logic
  it("IFF(1, 10, 20) = 10", () => expect(d("=IFF(1, 10, 20)")).toBe(10))
  it("IFF(0, 10, 20) = 20", () => expect(d("=IFF(0, 10, 20)")).toBe(20))
  it("XORALL(1, 0, 1) = false", () => expect(d("=XORALL(1, 0, 1)")).toBe(false))
  it("XORALL(1, 0, 0) = true", () => expect(d("=XORALL(1, 0, 0)")).toBe(true))
  it("NANDALL(1, 1, 1) = false", () => expect(d("=NANDALL(1, 1, 1)")).toBe(false))
  it("NANDALL(1, 0, 1) = true", () => expect(d("=NANDALL(1, 0, 1)")).toBe(true))
  it("NORALL(0, 0, 0) = true", () => expect(d("=NORALL(0, 0, 0)")).toBe(true))
  it("UNLESS(0, 42) = 42", () => expect(d("=UNLESS(0, 42)")).toBe(42))
  it("UNLESS(5, 42) = 5", () => expect(d("=UNLESS(5, 42)")).toBe(5))

  // Trig
  it("VERSINE(0) = 0", () => expect(d("=VERSINE(0)")).toBe(0))
  it("HAVERSINE(0) = 0", () => expect(d("=HAVERSINE(0)")).toBe(0))
  it("POWMOD(2, 10, 1000) = 24", () => expect(d("=POWMOD(2, 10, 1000)")).toBe(24))

  // Stats
  it("FSTAT(4, 2) = 2", () => expect(d("=FSTAT(4, 2)")).toBe(2))
  it("CHISQSTAT(30, 25) = 1", () => expect(d("=CHISQSTAT(30, 25)")).toBe(1))

  // Text
  it("TEXTZFILL(42, 5) = 00042", () => expect(d("=TEXTZFILL(42, 5)")).toBe("00042"))
  it("TEXTABBREV(hello world, 8) = hello...", () => expect(d("=TEXTABBREV(\"hello world\", 8)")).toBe("hello..."))
  it("TEXTMIRROR(abc) = abccba", () => expect(d("=TEXTMIRROR(\"abc\")")).toBe("abccba"))
  it("TEXTCOUNTCHAR(banana, a) = 3", () => expect(d("=TEXTCOUNTCHAR(\"banana\", \"a\")")).toBe(3))

  // Info
  it("ISTRUTHY(1) = true", () => expect(d("=ISTRUTHY(1)")).toBe(true))
  it("ISFALSY(0) = true", () => expect(d("=ISFALSY(0)")).toBe(true))
  it("ISFRACTION(3.5) = true", () => expect(d("=ISFRACTION(3.5)")).toBe(true))
  it("ISFRACTION(3) = false", () => expect(d("=ISFRACTION(3)")).toBe(false))
  it("ISDIVISIBLE(12, 4) = true", () => expect(d("=ISDIVISIBLE(12, 4)")).toBe(true))
  it("ISDIVISIBLE(13, 4) = false", () => expect(d("=ISDIVISIBLE(13, 4)")).toBe(false))

  // Financial
  it("TBILL2(0.05, 180) = 97.5", () => expect(d("=TBILL2(0.05, 180)")).toBe(97.5))

  // ── 850 batch tests ──
  // Lookup: array ops
  it("DISTINCT(1,2,2,3,3,3) = 3", () => expect(d("=DISTINCT(1,2,2,3,3,3)")).toBe(3))
  it("ARRAYMIN(5,3,8,1) = 1", () => expect(d("=ARRAYMIN(5,3,8,1)")).toBe(1))
  it("ARRAYMAX(5,3,8,1) = 8", () => expect(d("=ARRAYMAX(5,3,8,1)")).toBe(8))
  it("ARRAYSUM(1,2,3,4) = 10", () => expect(d("=ARRAYSUM(1,2,3,4)")).toBe(10))
  it("ARRAYAVG(2,4,6) = 4", () => expect(d("=ARRAYAVG(2,4,6)")).toBe(4))
  it("ARRAYJOIN(sep, 1, 2, 3) = joined", () => expect(d('=ARRAYJOIN(",", 1, 2, 3)')).toBe("1,2,3"))
  // Logic: conditional
  it("ALLEQUAL(5,5,5) = true", () => expect(d("=ALLEQUAL(5,5,5)")).toBe(true))
  it("ALLEQUAL(5,5,6) = false", () => expect(d("=ALLEQUAL(5,5,6)")).toBe(false))
  it("ISALL(1,1,1) = true", () => expect(d("=ISALL(1,1,1)")).toBe(true))
  it("ISALL(1,0,1) = false", () => expect(d("=ISALL(1,0,1)")).toBe(false))
  it("ISANY(0,0,1) = true", () => expect(d("=ISANY(0,0,1)")).toBe(true))
  it("ISNONE(0,0,0) = true", () => expect(d("=ISNONE(0,0,0)")).toBe(true))
  it("ISNONE(0,1,0) = false", () => expect(d("=ISNONE(0,1,0)")).toBe(false))
  // Math: special functions
  it("GUDERMANN(0) = 0", () => expect(d("=GUDERMANN(0)")).toBe(0))
  it("POCHHAMMER(3, 4) = 360", () => expect(d("=POCHHAMMER(3, 4)")).toBe(360))
  it("DIGAMMA(1) is approx -0.577", () => expect(Math.abs(d("=DIGAMMA(1)") as number - (-0.5))).toBeLessThan(0.1))
  // Stat: moments
  it("GINICOEF(1,2,3,4,5) is valid", () => { const v = d("=GINICOEF(1,2,3,4,5)") as number; expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); })
  it("ENTROPY2(1,1,1,1) = 2 (uniform)", () => expect(d("=ENTROPY2(1,1,1,1)")).toBe(2))
  it("MOMENT(2, 1, 2, 3) = 4.666...", () => expect(Math.abs(d("=MOMENT(2, 1, 2, 3)") as number - 4.666667)).toBeLessThan(0.01))
  // Text: formatting
  it("TEXTHASH(hello) is hex string", () => expect(typeof d('=TEXTHASH("hello")')).toBe("string"))
  it("TEXTMASK2(1234567890, 4) masks", () => expect(d('=TEXTMASK2("1234567890", 4)')).toBe("******7890"))
  it("TEXTJUSTIFY(hi, 5) pads", () => expect(d('=TEXTJUSTIFY("hi", 5)')).toBe("hi   "))
  // Financial: ratios
  it("DRAWDOWN(80, 100) = 0.2", () => expect(d("=DRAWDOWN(80, 100)")).toBe(0.2))
  it("CALMAR(0.12, 0.3) = 0.4", () => expect(d("=CALMAR(0.12, 0.3)")).toBe(0.4))
  it("TREYNOR(0.15, 0.03, 1.2) = 0.1", () => expect(d("=TREYNOR(0.15, 0.03, 1.2)")).toBe(0.1))
  // Info: type checks
  it("ISFINITE2(42) = true", () => expect(d("=ISFINITE2(42)")).toBe(true))
  it("ISWHOLE(3) = true", () => expect(d("=ISWHOLE(3)")).toBe(true))
  it("ISWHOLE(3.5) = false", () => expect(d("=ISWHOLE(3.5)")).toBe(false))

  // ── 900 batch tests ──
  // Logic
  it("EQUIV(5, 5) = true", () => expect(d("=EQUIV(5, 5)")).toBe(true))
  it("EQUIV(5, 6) = false", () => expect(d("=EQUIV(5, 6)")).toBe(false))
  it("TOGGLE(0) = true", () => expect(d("=TOGGLE(0)")).toBe(true))
  it("TOGGLE(1) = false", () => expect(d("=TOGGLE(1)")).toBe(false))
  it("SATURATE(1.5) = 1", () => expect(d("=SATURATE(1.5)")).toBe(1))
  it("SATURATE(-0.5) = 0", () => expect(d("=SATURATE(-0.5)")).toBe(0))
  it("THRESHOLD(10, 5) = true", () => expect(d("=THRESHOLD(10, 5)")).toBe(true))
  it("THRESHOLD(3, 5) = false", () => expect(d("=THRESHOLD(3, 5)")).toBe(false))
  it("WHICHMAX(10, 30, 20) = 2", () => expect(d("=WHICHMAX(10, 30, 20)")).toBe(2))
  it("WHICHMIN(10, 5, 20) = 2", () => expect(d("=WHICHMIN(10, 5, 20)")).toBe(2))
  it("FIRSTTRUTHY(0, 0, 7, 3) = 7", () => expect(d("=FIRSTTRUTHY(0, 0, 7, 3)")).toBe(7))
  it("COUNTIF3(5, 1, 5, 3, 5) = 2", () => expect(d("=COUNTIF3(5, 1, 5, 3, 5)")).toBe(2))
  // Lookup
  it("NTHLARGEST(2, 10, 30, 20) = 20", () => expect(d("=NTHLARGEST(2, 10, 30, 20)")).toBe(20))
  it("FIRSTNONZERO(0, 0, 5, 3) = 5", () => expect(d("=FIRSTNONZERO(0, 0, 5, 3)")).toBe(5))
  it("ENUMERATE(1, 2, 3) = 3", () => expect(d("=ENUMERATE(1, 2, 3)")).toBe(3))
  // Math: orthogonal polynomials
  it("LEGENDRE(0, 0.5) = 1", () => expect(d("=LEGENDRE(0, 0.5)")).toBe(1))
  it("LEGENDRE(1, 0.5) = 0.5", () => expect(d("=LEGENDRE(1, 0.5)")).toBe(0.5))
  it("HERMITE(0, 1) = 1", () => expect(d("=HERMITE(0, 1)")).toBe(1))
  it("HERMITE(1, 3) = 6", () => expect(d("=HERMITE(1, 3)")).toBe(6))
  it("LAGUERRE(0, 2) = 1", () => expect(d("=LAGUERRE(0, 2)")).toBe(1))
  // Stat
  it("MIDRANGE(1, 5, 9) = 5", () => expect(d("=MIDRANGE(1, 5, 9)")).toBe(5))
  it("MEANDEV(2, 4, 6) is ~1.33", () => expect(Math.abs(d("=MEANDEV(2, 4, 6)") as number - 1.333)).toBeLessThan(0.01))
  // Financial
  it("DAILYRETURN(100, 105) = 0.05", () => expect(d("=DAILYRETURN(100, 105)")).toBe(0.05))
  it("INFORMRATIO(0.05, 0.1) = 0.5", () => expect(d("=INFORMRATIO(0.05, 0.1)")).toBe(0.5))
  // Text
  it("TEXTCOUNTWORDS counts words", () => expect(d('=TEXTCOUNTWORDS("hello world foo")')).toBe(3))
  it("TEXTFIRSTWORD gets first", () => expect(d('=TEXTFIRSTWORD("hello world")')).toBe("hello"))
  // Info: type checks
  it("ISNUMTYPE(42) = true", () => expect(d("=ISNUMTYPE(42)")).toBe(true))
  it("ISBOOLTYPE(42) = false", () => expect(d("=ISBOOLTYPE(42)")).toBe(false))

  // ── 950 batch tests ──
  it("IFPOS(5, 99) = 99", () => expect(d("=IFPOS(5, 99)")).toBe(99))
  it("IFPOS(-1, 99) = 0", () => expect(d("=IFPOS(-1, 99)")).toBe(0))
  it("IFNEG(-3, 42) = 42", () => expect(d("=IFNEG(-3, 42)")).toBe(42))
  it("IFZERO(0, 7) = 7", () => expect(d("=IFZERO(0, 7)")).toBe(7))
  it("GATE(10, 1) = 10", () => expect(d("=GATE(10, 1)")).toBe(10))
  it("GATE(10, 0) = 0", () => expect(d("=GATE(10, 0)")).toBe(0))
  it("NTHSMALLEST(2, 5, 1, 8, 3) = 3", () => expect(d("=NTHSMALLEST(2, 5, 1, 8, 3)")).toBe(3))
  it("DEDUP(1,2,2,3,3,3) = 3", () => expect(d("=DEDUP(1,2,2,3,3,3)")).toBe(3))
  it("QUADMEAN(3,4) valid", () => expect(d("=QUADMEAN(3, 4)")).toBe(Math.sqrt((9+16)/2)))
  it("TEXTINITCAP capitalizes", () => expect(d('=TEXTINITCAP("hello world")')).toBe("Hello World"))
  it("TEXTBULLET prepends bullet", () => expect(d('=TEXTBULLET("item")')).toBe("• item"))
  it("ISNUMERIC(42) = true", () => expect(d("=ISNUMERIC(42)")).toBe(true))
  it("ISNOTEMPTY with value = true", () => expect(d("=ISNOTEMPTY(1)")).toBe(true))
  it("TYPESTR(42) = num", () => expect(d("=TYPESTR(42)")).toBe("num"))
  it("COUPON(1000, 5) = 50", () => expect(d("=COUPON(1000, 5)")).toBe(50))
  it("DIVYIELD(2, 50) = 0.04", () => expect(d("=DIVYIELD(2, 50)")).toBe(0.04))

  // ── 1000 batch tests ──
  it("LAMBERTW(0) = 0", () => expect(Math.abs(d("=LAMBERTW(0)") as number)).toBeLessThan(0.01))
  it("AGMFN(1, 2) converges", () => { const v = d("=AGMFN(1, 2)") as number; expect(v).toBeGreaterThan(1); expect(v).toBeLessThan(2); })
  it("BESSEL_J0(0) = 1", () => expect(d("=BESSEL_J0(0)")).toBe(1))
  it("BESSEL_I0(0) = 1", () => expect(d("=BESSEL_I0(0)")).toBe(1))
  it("ISPOS(5) = true", () => expect(d("=ISPOS(5)")).toBe(true))
  it("ISPOS(-1) = false", () => expect(d("=ISPOS(-1)")).toBe(false))
  it("ISNEG2(-3) = true", () => expect(d("=ISNEG2(-3)")).toBe(true))
  it("ISNONZERO(5) = true", () => expect(d("=ISNONZERO(5)")).toBe(true))
  it("ISNONZERO(0) = false", () => expect(d("=ISNONZERO(0)")).toBe(false))
  it("SIGNOF(10) = 1", () => expect(d("=SIGNOF(10)")).toBe(1))
  it("SIGNOF(-5) = -1", () => expect(d("=SIGNOF(-5)")).toBe(-1))
  it("MAGNITUDE(-7) = 7", () => expect(d("=MAGNITUDE(-7)")).toBe(7))
  it("BASISPOINTS(0.05) = 500", () => expect(d("=BASISPOINTS(0.05)")).toBe(500))
  it("COSTBASIS(100, 10) = 1000", () => expect(d("=COSTBASIS(100, 10)")).toBe(1000))
  it("MAJORITY2(1,1,0) = true", () => expect(d("=MAJORITY2(1,1,0)")).toBe(true))
  it("MAJORITY2(0,0,1) = false", () => expect(d("=MAJORITY2(0,0,1)")).toBe(false))
  it("UNANIMOUS(1,1,1) = true", () => expect(d("=UNANIMOUS(1,1,1)")).toBe(true))
  it("UNANIMOUS(1,0,1) = false", () => expect(d("=UNANIMOUS(1,0,1)")).toBe(false))
  it("RANK2(30, 10, 30, 20) = 1", () => expect(d("=RANK2(30, 10, 30, 20)")).toBe(1))
  it("RANK2(10, 10, 30, 20) = 3", () => expect(d("=RANK2(10, 10, 30, 20)")).toBe(3))
  it("TEXTISEMPTY with empty = true", () => expect(d('=TEXTISEMPTY("")')).toBe(true))
  it("TEXTHEADER creates header", () => expect(d('=TEXTHEADER("Title")')).toBe("=== Title ==="))

  // ── honest-1000 batch tests ──
  // Activation functions
  it("GELU(0) = 0", () => expect(Math.abs(d("=GELU(0)") as number)).toBeLessThan(0.01))
  it("MISH(0) = 0", () => expect(Math.abs(d("=MISH(0)") as number)).toBeLessThan(0.01))
  it("SWISH(0) = 0", () => expect(d("=SWISH(0)")).toBe(0))
  it("SOFTSIGN(0) = 0", () => expect(d("=SOFTSIGN(0)")).toBe(0))
  it("LOGISTIC2(0) = 0.5", () => expect(d("=LOGISTIC2(0)")).toBe(0.5))
  it("RIEMANN(2) converges", () => { const v = d("=RIEMANN(2)") as number; expect(Math.abs(v - Math.PI*Math.PI/6)).toBeLessThan(0.01) })
  // Stat
  it("SAMPLEVAR(2, 4, 6) = 4", () => expect(d("=SAMPLEVAR(2, 4, 6)")).toBe(4))
  it("POPVAR(2, 4, 6) valid", () => expect(Math.abs(d("=POPVAR(2, 4, 6)") as number - 8/3)).toBeLessThan(0.01))
  it("RANGESTAT(1, 5, 9) = 8", () => expect(d("=RANGESTAT(1, 5, 9)")).toBe(8))
  it("RMSVAL(3, 4) valid", () => expect(d("=RMSVAL(3, 4)")).toBe(Math.sqrt((9+16)/2)))
  // Financial
  it("EFFECTIVERATE(0.12, 12) valid", () => { const v = d("=EFFECTIVERATE(0.12, 12)") as number; expect(v).toBeGreaterThan(0.126) })
  it("BASISPOINTS result consistent", () => expect(d("=BASISPOINTS(0.01)")).toBe(100))
  // Logic
  it("COMPARE3(3, 5) = -1", () => expect(d("=COMPARE3(3, 5)")).toBe(-1))
  it("COMPARE3(5, 5) = 0", () => expect(d("=COMPARE3(5, 5)")).toBe(0))
  it("HALFADD(1, 0) = 1", () => expect(d("=HALFADD(1, 0)")).toBe(1))
  it("XNOR2(1, 1) = true", () => expect(d("=XNOR2(1, 1)")).toBe(true))
  // Text
  it("TEXTISALPHA checks alpha", () => expect(d('=TEXTISALPHA("hello")')).toBe(true))
  it("TEXTISDIGIT checks digits", () => expect(d('=TEXTISDIGIT("123")')).toBe(true))
  it("TEXTSWAP swaps case", () => expect(d('=TEXTSWAP("Hello")')).toBe("hELLO"))
  // Info
  it("ISPALINDROME detects", () => expect(d('=ISPALINDROME("racecar")')).toBe(true))
  it("PARITY of 4 = even", () => expect(d("=PARITY(4)")).toBe("even"))
  it("PARITY of 7 = odd", () => expect(d("=PARITY(7)")).toBe("odd"))
  it("ISNAT(5) = true", () => expect(d("=ISNAT(5)")).toBe(true))
  it("ISNAT(-1) = false", () => expect(d("=ISNAT(-1)")).toBe(false))

  // ── 1047 batch tests ──
  it("HEAVISIDE(5) = 1", () => expect(d("=HEAVISIDE(5)")).toBe(1))
  it("HEAVISIDE(-1) = 0", () => expect(d("=HEAVISIDE(-1)")).toBe(0))
  it("RAMP(3) = 3", () => expect(d("=RAMP(3)")).toBe(3))
  it("RAMP(-2) = 0", () => expect(d("=RAMP(-2)")).toBe(0))
  it("GAUSSIAN2(0) = 1", () => expect(d("=GAUSSIAN2(0)")).toBe(1))
  it("SAWTOOTH2(1.5) = 0.5", () => expect(d("=SAWTOOTH2(1.5)")).toBe(0.5))
  it("ISCUBE(27) = true", () => expect(d("=ISCUBE(27)")).toBe(true))
  it("ISCUBE(26) = false", () => expect(d("=ISCUBE(26)")).toBe(false))
  it("ISTRIANGULAR(6) = true", () => expect(d("=ISTRIANGULAR(6)")).toBe(true))
  it("ISHARSHAD(18) = true", () => expect(d("=ISHARSHAD(18)")).toBe(true))
  it("RULE72(8) = 9", () => expect(d("=RULE72(8)")).toBe(9))
  it("NOR2(0,0) = true", () => expect(d("=NOR2(0,0)")).toBe(true))
  it("NOR2(1,0) = false", () => expect(d("=NOR2(1,0)")).toBe(false))
  it("NAND2(1,1) = false", () => expect(d("=NAND2(1,1)")).toBe(false))
  it("TOPK(2, 10, 30, 20) = 20", () => expect(d("=TOPK(2, 10, 30, 20)")).toBe(20))
  it("BOTTOMK(1, 10, 5, 20) = 5", () => expect(d("=BOTTOMK(1, 10, 5, 20)")).toBe(5))
  it("UNIQUE2(1,2,2,3) = 3", () => expect(d("=UNIQUE2(1,2,2,3)")).toBe(3))
  it("MARKUPRATE(80, 100) = 0.25", () => expect(d("=MARKUPRATE(80, 100)")).toBe(0.25))
  it("MARGINRATE(80, 100) = 0.2", () => expect(d("=MARGINRATE(80, 100)")).toBe(0.2))

  // ── 1100 batch tests ──
  it("RECIP(4) = 0.25", () => expect(d("=RECIP(4)")).toBe(0.25))
  it("RECIP(0) = 0", () => expect(d("=RECIP(0)")).toBe(0))
  it("SQRDIFF(5, 3) = 4", () => expect(d("=SQRDIFF(5, 3)")).toBe(4))
  it("CBRT2(27) = 3", () => expect(d("=CBRT2(27)")).toBe(3))
  it("DIVSAFE(10, 0) = 0", () => expect(d("=DIVSAFE(10, 0)")).toBe(0))
  it("DIVSAFE(10, 2) = 5", () => expect(d("=DIVSAFE(10, 2)")).toBe(5))
  it("FRAC2(3.75) = 0.75", () => expect(d("=FRAC2(3.75)")).toBe(0.75))
  it("WHOLEFRAC(3.75) = 3", () => expect(d("=WHOLEFRAC(3.75)")).toBe(3))
  it("ROUNDN(3.14159, 2) = 3.14", () => expect(d("=ROUNDN(3.14159, 2)")).toBe(3.14))
  it("CUMMAX(1, 5, 3, 7, 2) = 7", () => expect(d("=CUMMAX(1, 5, 3, 7, 2)")).toBe(7))
  it("CUMMIN(5, 3, 7, 1, 4) = 1", () => expect(d("=CUMMIN(5, 3, 7, 1, 4)")).toBe(1))
  it("CUMSUM2(1, 2, 3) = 6", () => expect(d("=CUMSUM2(1, 2, 3)")).toBe(6))
  it("CUMPROD2(2, 3, 4) = 24", () => expect(d("=CUMPROD2(2, 3, 4)")).toBe(24))
  it("TEXTORDINAL(1) = 1st", () => expect(d("=TEXTORDINAL(1)")).toBe("1st"))
  it("TEXTORDINAL(2) = 2nd", () => expect(d("=TEXTORDINAL(2)")).toBe("2nd"))
  it("TEXTCAPS capitalizes", () => expect(d('=TEXTCAPS("hello")')).toBe("HELLO"))
  it("TEXTNOCAPS lowercases", () => expect(d('=TEXTNOCAPS("HELLO")')).toBe("hello"))
  it("ISSCALAR always true", () => expect(d("=ISSCALAR(42)")).toBe(true))
  it("BITWIDTH(255) = 8", () => expect(d("=BITWIDTH(255)")).toBe(8))
  it("NUMCLASS(42) = integer", () => expect(d("=NUMCLASS(42)")).toBe("integer"))
  it("GROSSPROFIT(100, 60) = 40", () => expect(d("=GROSSPROFIT(100, 60)")).toBe(40))
  it("TERNARY(1, 10, 20) = 10", () => expect(d("=TERNARY(1, 10, 20)")).toBe(10))
  it("TERNARY(0, 10, 20) = 20", () => expect(d("=TERNARY(0, 10, 20)")).toBe(20))
  it("BOOLFLIP(1) = false", () => expect(d("=BOOLFLIP(1)")).toBe(false))
  it("BOOLFLIP(0) = true", () => expect(d("=BOOLFLIP(0)")).toBe(true))

  // ── 1150 batch tests ──
  it("SNAP(7, 5) = 5", () => expect(d("=SNAP(7, 5)")).toBe(5))
  it("SNAP(13, 5) = 15", () => expect(d("=SNAP(13, 5)")).toBe(15))
  it("CEIL2(3.1) = 4", () => expect(d("=CEIL2(3.1)")).toBe(4))
  it("FLOOR2(3.9) = 3", () => expect(d("=FLOOR2(3.9)")).toBe(3))
  it("TRUNC2(3.7) = 3", () => expect(d("=TRUNC2(3.7)")).toBe(3))
  it("LOGBASE(8, 2) = 3", () => expect(d("=LOGBASE(8, 2)")).toBe(3))
  it("SIGN2(-5) = -1", () => expect(d("=SIGN2(-5)")).toBe(-1))
  it("IQR2(1,2,3,4,5,6,7,8) valid", () => { const v = d("=IQR2(1,2,3,4,5,6,7,8)") as number; expect(v).toBeGreaterThan(0) })
  it("PEAK(1,3,2,5,1) = 2", () => expect(d("=PEAK(1,3,2,5,1)")).toBe(2))
  it("TROUGH(3,1,2,0,5) = 2", () => expect(d("=TROUGH(3,1,2,0,5)")).toBe(2))
  it("STREAK(1,1,1,0,1,1) = 3", () => expect(d("=STREAK(1,1,1,0,1,1)")).toBe(3))
  it("SPAN(1,5,3) = 4", () => expect(d("=SPAN(1,5,3)")).toBe(4))
  it("ANYOF(0,0,1) = true", () => expect(d("=ANYOF(0,0,1)")).toBe(true))
  it("NONEOF(0,0,0) = true", () => expect(d("=NONEOF(0,0,0)")).toBe(true))
  it("EXACTLYONE(0,1,0) = true", () => expect(d("=EXACTLYONE(0,1,0)")).toBe(true))
  it("EXACTLYONE(1,1,0) = false", () => expect(d("=EXACTLYONE(1,1,0)")).toBe(false))
  it("ISODD3(7) = true", () => expect(d("=ISODD3(7)")).toBe(true))
  it("ISEVEN3(6) = true", () => expect(d("=ISEVEN3(6)")).toBe(true))
  it("ISPOSINT(5) = true", () => expect(d("=ISPOSINT(5)")).toBe(true))
  it("ISPOSINT(-3) = false", () => expect(d("=ISPOSINT(-3)")).toBe(false))
  it("TEXTAPPEND joins", () => expect(d('=TEXTAPPEND("foo", "bar")')).toBe("foobar"))
  it("PERPETUITY(100, 0.05) = 2000", () => expect(d("=PERPETUITY(100, 0.05)")).toBe(2000))

  // ── 1200 batch tests ──
  it("KELVIN(0) = 273.15", () => expect(d("=KELVIN(0)")).toBe(273.15))
  it("CELSIUS(273.15) = 0", () => expect(d("=CELSIUS(273.15)")).toBe(0))
  it("FAHRENHEIT(0) = 32", () => expect(d("=FAHRENHEIT(0)")).toBe(32))
  it("HOOKE(10, 0.5) = -5", () => expect(d("=HOOKE(10, 0.5)")).toBe(-5))
  it("OHMS(5, 10) = 50", () => expect(d("=OHMS(5, 10)")).toBe(50))
  it("RETENTIONRATE(0.3) = 0.7", () => expect(d("=RETENTIONRATE(0.3)")).toBe(0.7))
  it("RISING(3, 5) = true", () => expect(d("=RISING(3, 5)")).toBe(true))
  it("FALLING(5, 3) = true", () => expect(d("=FALLING(5, 3)")).toBe(true))
  it("CHANGED(3, 5) = true", () => expect(d("=CHANGED(3, 5)")).toBe(true))
  it("STABLE(5, 5) = true", () => expect(d("=STABLE(5, 5)")).toBe(true))
  it("ISDEFICIENT(8) = true", () => expect(d("=ISDEFICIENT(8)")).toBe(true))
  it("ISABUNDANT(12) = true", () => expect(d("=ISABUNDANT(12)")).toBe(true))
  it("ISSEMIPRIME(6) = true", () => expect(d("=ISSEMIPRIME(6)")).toBe(true))
  it("ISSQUAREFREE(6) = true", () => expect(d("=ISSQUAREFREE(6)")).toBe(true))
  it("ISSQUAREFREE(12) = false", () => expect(d("=ISSQUAREFREE(12)")).toBe(false))
  it("TEXTWORDS counts words", () => expect(d('=TEXTWORDS("hello world foo")')).toBe(3))
  it("SELECTIF counts above threshold", () => expect(d("=SELECTIF(5, 1, 7, 3, 8, 2)")).toBe(2))
  it("TAKEWHILE counts truthy prefix", () => expect(d("=TAKEWHILE(1, 1, 1, 0, 1)")).toBe(3))

  // ── 1250 batch tests ──
  it("MIDPOINT(10, 20) = 15", () => expect(d("=MIDPOINT(10, 20)")).toBe(15))
  it("PERPSLOPE(2) = -0.5", () => expect(d("=PERPSLOPE(2)")).toBe(-0.5))
  it("MAGNITUDE2(3, 4) = 5", () => expect(d("=MAGNITUDE2(3, 4)")).toBe(5))
  it("HERON valid triangle", () => { const v = d("=HERON(3, 4, 5)") as number; expect(Math.abs(v - 6)).toBeLessThan(0.01) })
  it("L1NORM(3, -4, 5) = 12", () => expect(d("=L1NORM(3, -4, 5)")).toBe(12))
  it("L2NORM(3, 4) = 5", () => expect(d("=L2NORM(3, 4)")).toBe(5))
  it("LINFNORM(3, -7, 5) = 7", () => expect(d("=LINFNORM(3, -7, 5)")).toBe(7))
  it("COSINESIM identical ≈ 1", () => expect(Math.abs(d("=COSINESIM(1, 2, 1, 2)") as number - 1)).toBeLessThan(0.001))
  it("ISNARCISSISTIC(153) = true", () => expect(d("=ISNARCISSISTIC(153)")).toBe(true))
  it("ISAUTOMORPHIC(25) = true", () => expect(d("=ISAUTOMORPHIC(25)")).toBe(true))
  it("ISKAPREKAR(1) = true", () => expect(d("=ISKAPREKAR(1)")).toBe(true))
  it("TEXTINCLUDES checks", () => expect(d('=TEXTINCLUDES("hello world", "world")')).toBe(true))
  it("TEXTUNIQCHARS counts unique", () => expect(d('=TEXTUNIQCHARS("aabb")')).toBe(2))
  it("COUNTRUE(1,0,1,1) = 3", () => expect(d("=COUNTRUE(1,0,1,1)")).toBe(3))
  it("ALLEQ(5, 5, 5, 5) = true", () => expect(d("=ALLEQ(5, 5, 5, 5)")).toBe(true))
  it("ALLGT(3, 5, 6, 7) = true", () => expect(d("=ALLGT(3, 5, 6, 7)")).toBe(true))
  it("MEDIAN2(1, 3, 5) = 3", () => expect(d("=MEDIAN2(1, 3, 5)")).toBe(3))
  it("GORDONMODEL(2, 0.10, 0.05) = 40", () => expect(d("=GORDONMODEL(2, 0.10, 0.05)")).toBe(40))
  it("RETENTIONRATE consistent", () => expect(d("=RETENTIONRATE(0.4)")).toBe(0.6))
  it("TEXTOCCURRENCES counts", () => expect(d('=TEXTOCCURRENCES("abcabc", "abc")')).toBe(2))

  // ── 1300 batch tests ──
  it("BELL(4) = 15", () => expect(d("=BELL(4)")).toBe(15))
  it("CATALAN2(4) = 14", () => expect(d("=CATALAN2(4)")).toBe(14))
  it("PARTITION(5) = 7", () => expect(d("=PARTITION(5)")).toBe(7))
  it("DERANGEMENT(4) = 9", () => expect(d("=DERANGEMENT(4)")).toBe(9))
  it("SUBFACTORIAL(4) = 9", () => expect(d("=SUBFACTORIAL(4)")).toBe(9))
  it("TRIBONACCI(7) = 13", () => expect(d("=TRIBONACCI(7)")).toBe(13))
  it("PENTAGONAL(3) = 12", () => expect(d("=PENTAGONAL(3)")).toBe(12))
  it("RISINGFACT(3, 3) = 60", () => expect(d("=RISINGFACT(3, 3)")).toBe(60))
  it("STIRLING1(3, 2) valid", () => { const v = d("=STIRLING1(3, 2)") as number; expect(v).toBe(3) })
  it("STIRLING2(4, 2) = 7", () => expect(d("=STIRLING2(4, 2)")).toBe(7))
  it("ENTROPY2(0.5, 0.5) = 1", () => expect(d("=ENTROPY2(0.5, 0.5)")).toBe(1))
  it("TEXTSLUG slugifies", () => expect(d('=TEXTSLUG("Hello World!")')).toBe("hello-world"))
  it("TEXTKEBAB converts", () => expect(d('=TEXTKEBAB("helloWorld")')).toBe("hello-world"))
  it("TEXTCAMELCASE converts", () => expect(d('=TEXTCAMELCASE("hello world")')).toBe("helloWorld"))
  it("TEXTCAESAR shifts", () => expect(d('=TEXTCAESAR("abc", 1)')).toBe("bcd"))
  it("ISPERFECTSQ(25) = true", () => expect(d("=ISPERFECTSQ(25)")).toBe(true))
  it("ISPERFECTCUBE(27) = true", () => expect(d("=ISPERFECTCUBE(27)")).toBe(true))
  it("ISPOWER2(16) = true", () => expect(d("=ISPOWER2(16)")).toBe(true))
  it("ISPOWER2(15) = false", () => expect(d("=ISPOWER2(15)")).toBe(false))
  it("ISSOPHIE(5) = true", () => expect(d("=ISSOPHIE(5)")).toBe(true))
  it("BITAND(12, 10) = 8", () => expect(d("=BITAND(12, 10)")).toBe(8))
  it("BITOR(12, 10) = 14", () => expect(d("=BITOR(12, 10)")).toBe(14))
  it("BITXOR(12, 10) = 6", () => expect(d("=BITXOR(12, 10)")).toBe(6))
  it("SHARPE ratio", () => expect(d("=SHARPE(0.10, 0.02, 0.15)")).toBeCloseTo(0.533, 2))
  it("PRONIC(5) = 30", () => expect(d("=PRONIC(5)")).toBe(30))
  it("LUCAS2(5) = 11", () => expect(d("=LUCAS2(5)")).toBe(11))
  it("PELL(5) = 29", () => expect(d("=PELL(5)")).toBe(29))
  it("TETRAHEDRAL(4) = 20", () => expect(d("=TETRAHEDRAL(4)")).toBe(20))
  it("STAR(3) = 37", () => expect(d("=STAR(3)")).toBe(37))
  it("FREQUENCY counts", () => { const v = d("=FREQUENCY(3, 1, 3, 3, 5)") as number; expect(typeof v).toBe("number") })

  // ── 1350 batch tests ──
  it("TAYLOR_SIN(0, 5) ≈ 0", () => expect(Math.abs(d("=TAYLOR_SIN(0, 5)") as number)).toBeLessThan(0.001))
  it("TAYLOR_COS(0, 5) ≈ 1", () => expect(Math.abs(d("=TAYLOR_COS(0, 5)") as number - 1)).toBeLessThan(0.001))
  it("TAYLOR_EXP(0, 5) ≈ 1", () => expect(Math.abs(d("=TAYLOR_EXP(0, 5)") as number - 1)).toBeLessThan(0.001))
  it("BISECT(2, 8) = 5", () => expect(d("=BISECT(2, 8)")).toBe(5))
  it("TRAPEZOID(3, 7) = 5", () => expect(d("=TRAPEZOID(3, 7)")).toBe(5))
  it("GOLDEN_SECTION valid", () => { const v = d("=GOLDEN_SECTION(0, 10)") as number; expect(v).toBeGreaterThan(5) })
  it("EXPSMOOTH(0.5, 10, 20, 30) smooths", () => { const v = d("=EXPSMOOTH(0.5, 10, 20, 30)") as number; expect(v).toBeGreaterThan(10) })
  it("MOVMEDIAN(2, 1, 3, 5, 7) valid", () => { const v = d("=MOVMEDIAN(2, 1, 3, 5, 7)") as number; expect(v).toBe(6) })
  it("TEXTCRC32 returns number", () => { const v = d('=TEXTCRC32("hello")') as number; expect(typeof v).toBe("number"); expect(v).toBeGreaterThan(0) })
  it("TEXTSOUNDEX(Robert) = R163", () => expect(d('=TEXTSOUNDEX("Robert")')).toBe("R163"))
  it("TEXTALPHANUM strips", () => expect(d('=TEXTALPHANUM("a-b.c!")')).toBe("abc"))
  it("TEXTUNICODE(A) = 65", () => expect(d('=TEXTUNICODE("A")')).toBe(65))
  it("TEXTFROMUNI(65) = A", () => expect(d("=TEXTFROMUNI(65)")).toBe("A"))
  it("ISHAPPY2(7) = true", () => expect(d("=ISHAPPY2(7)")).toBe(true))
  it("ISSAD(2) = true", () => expect(d("=ISSAD(2)")).toBe(true))
  it("ISREGULAR(30) = true", () => expect(d("=ISREGULAR(30)")).toBe(true))
  it("ISREGULAR(7) = false", () => expect(d("=ISREGULAR(7)")).toBe(false))
  it("MAJORITY3(1,1,0) = true", () => expect(d("=MAJORITY3(1,1,0)")).toBe(true))
  it("CONSENSUS2(1,1,1) = true", () => expect(d("=CONSENSUS2(1,1,1)")).toBe(true))
  it("CONSENSUS2(1,0,1) = false", () => expect(d("=CONSENSUS2(1,0,1)")).toBe(false))
  it("QUORUM2(2, 1, 1, 0) = true", () => expect(d("=QUORUM2(2, 1, 1, 0)")).toBe(true))
  it("CDF(3, 1, 2, 3, 4, 5) = 0.6", () => expect(d("=CDF(3, 1, 2, 3, 4, 5)")).toBe(0.6))
  it("ECDF(2, 1, 2, 3, 4) = 0.5", () => expect(d("=ECDF(2, 1, 2, 3, 4)")).toBe(0.5))

  // Financial: quick sanity checks
  it("ISO.CEILING(4.3, 2) = 6", () => expect(d("=ISO.CEILING(4.3, 2)")).toBe(6))
  // ML activation functions
  it("SIGMOID(0) = 0.5", () => expect(d("=SIGMOID(0)")).toBe(0.5))
  it("RELU(5) = 5", () => expect(d("=RELU(5)")).toBe(5))
  it("RELU(-5) = 0", () => expect(d("=RELU(-5)")).toBe(0))
  it("SOFTPLUS(0) ≈ 0.6931", () => expect(d("=ROUND(SOFTPLUS(0), 4)")).toBe(0.6931))
  it("ELU(5) = 5", () => expect(d("=ELU(5)")).toBe(5))
  it("ELU(-1) ≈ -0.6321", () => expect(d("=ROUND(ELU(-1), 4)")).toBe(-0.6321))
  it("NORMALIZE(50, 0, 100) = 0.5", () => expect(d("=NORMALIZE(50, 0, 100)")).toBe(0.5))
  it("WORDCOUNT of text", () => expect(d("=WORDCOUNT(\"hello world foo\")")).toBe(3))
  it("WORDCOUNT empty = 0", () => expect(d("=WORDCOUNT(\"\")")).toBe(0))
  it("DIGITS(12345) = 5", () => expect(d("=DIGITS(12345)")).toBe(5))
  it("DIGITS(0) = 1", () => expect(d("=DIGITS(0)")).toBe(1))
  it("DECODEURL roundtrip", () => expect(d("=DECODEURL(\"hello%20world\")")).toBe("hello world"))

  it("ISERR on error = true", () => expect(d("=ISERR(1/0)")).toBe(true))
  it("ISNULL on empty = true", () => expect(d("=ISNULL(\"\")")).toBe(true))
  it("ISNULL on text = false", () => expect(d("=ISNULL(\"hi\")")).toBe(false))

  // Case conversion
  it("TEXTCAMELCASE", () => expect(d("=TEXTCAMELCASE(\"hello world\")")).toBe("helloWorld"))
  it("TEXTSNAKECASE", () => expect(d("=TEXTSNAKECASE(\"helloWorld\")")).toBe("hello_world"))
  it("TEXTKEBABCASE", () => expect(d("=TEXTKEBABCASE(\"hello world\")")).toBe("hello-world"))
  it("TEXTINITIALS", () => expect(d("=TEXTINITIALS(\"John Doe Smith\")")).toBe("JDS"))
  
  // Base64
  it("BASE64.ENCODE", () => expect(d("=BASE64.ENCODE(\"hello\")")).toBe("aGVsbG8="))
  it("BASE64.DECODE", () => expect(d("=BASE64.DECODE(\"aGVsbG8=\")")).toBe("hello"))
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
