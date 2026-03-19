/**
 * Stack VM — Effect-native formula evaluation engine.
 *
 * Extracted from spike-f1b (25 hypotheses proven across 23 Effect v4 modules).
 *
 * ## Error Architecture
 *
 * Three error channels, each with distinct consumers and recovery semantics:
 *
 * ### 1. VMValue errors (inline, on the stack)
 * - `VMError { _tag: "error", message, code }` — lives ON the value stack
 * - Consumer: Cell UI (renders as #ERROR!, #DIV/0!, #REF!, etc.)
 * - Recovery: None needed — it IS the result. Downstream formulas propagate it.
 * - Examples: DIV/0, stack underflow, type mismatch, circular ref
 * - These are NOT failures — the VM succeeded, the result is an error value.
 *
 * ### 2. Effect E channel (typed, recoverable failures)
 * - Tagged error classes in the Effect<A, E, R> error channel
 * - Consumer: Service layer, formula bar UI, retry logic
 * - Recovery: `catchTag` / `catchTags` for structured handling
 * - `CompileError`  — malformed expression, unknown token (show in formula bar)
 * - `EvalError`     — runtime eval failure (corrupt state, assertion violation)
 * - `TimeoutError`  — formula exceeded deadline (cancel, show timeout in cell)
 * - `ResourceError` — sandbox/pool exhausted (backpressure, retry later)
 *
 * ### 3. Defects (unexpected, unrecoverable)
 * - `Effect.die` / thrown exceptions — bugs in the VM itself
 * - Consumer: Error log, crash reporter, developer
 * - Recovery: None — indicates a bug. Log and propagate.
 * - Examples: Match exhaustive miss (impossible), TxRef corruption
 *
 * ## Error Code Registry
 *
 * VMValue errors carry a `code` field for machine-readable categorization:
 * - `STACK_UNDERFLOW` — operation requires more values than available
 * - `DIV_ZERO`        — division by zero
 * - `TYPE_MISMATCH`   — operand type not compatible with operation
 * - `CIRCULAR_REF`    — formula dependency cycle detected
 * - `UNKNOWN_TOKEN`   — compiler encountered unrecognized token
 * - `EVAL_OVERFLOW`   — step limit exceeded (infinite loop guard)
 *
 * @module stack-vm
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import * as TxRef from "effect-v4/TxRef"
import * as Match from "effect-v4/Match"
import * as Data from "effect-v4/Data"
import * as ServiceMap from "effect-v4/ServiceMap"
import * as Layer from "effect-v4/Layer"
import * as Cache from "effect-v4/Cache"
import * as Duration from "effect-v4/Duration"
import * as Metric from "effect-v4/Metric"
import * as Semaphore from "effect-v4/Semaphore"
import * as Cause from "effect-v4/Cause"
import { pipe } from "effect-v4/Function"

// ═══════════════════════════════════════════════════════
// ERROR CODE REGISTRY
// ═══════════════════════════════════════════════════════

/**
 * Machine-readable error codes for VMValue errors.
 * These are the codes that appear in cells (e.g., #DIV/0!, #REF!)
 */
export const VMErrorCode = Schema.Literal(
  "STACK_UNDERFLOW",
  "DIV_ZERO",
  "TYPE_MISMATCH",
  "CIRCULAR_REF",
  "UNKNOWN_TOKEN",
  "EVAL_OVERFLOW",
  "GENERAL",
)
export type VMErrorCode = typeof VMErrorCode.Type

/**
 * Human-readable display labels for cell UI.
 * Maps error codes to spreadsheet-convention display strings.
 */
export const errorCodeDisplay: Record<VMErrorCode, string> = {
  STACK_UNDERFLOW: "#VALUE!",
  DIV_ZERO: "#DIV/0!",
  TYPE_MISMATCH: "#TYPE!",
  CIRCULAR_REF: "#REF!",
  UNKNOWN_TOKEN: "#NAME?",
  EVAL_OVERFLOW: "#CALC!",
  GENERAL: "#ERROR!",
}

// ═══════════════════════════════════════════════════════
// VMVALUE SCHEMAS (channel 1: inline on stack)
// ═══════════════════════════════════════════════════════

export const VMNum = Schema.TaggedStruct("num", { value: Schema.Number })
export const VMStr = Schema.TaggedStruct("str", { value: Schema.String })
export const VMBool = Schema.TaggedStruct("bool", { value: Schema.Boolean })
export const VMError = Schema.TaggedStruct("error", {
  message: Schema.String,
  code: VMErrorCode,
})

export const VMValue = Schema.Union([VMNum, VMStr, VMBool, VMError])
export type VMValue = typeof VMValue.Type

// ─── Constructors ───────────────────────────────────

export const num = (v: number): VMValue => ({ _tag: "num", value: v })
export const str = (v: string): VMValue => ({ _tag: "str", value: v })
export const bool = (v: boolean): VMValue => ({ _tag: "bool", value: v })

/** Create an inline error value with code + message */
export const vmError = (code: VMErrorCode, message: string): VMValue =>
  ({ _tag: "error", message, code })

/** Legacy shorthand — uses GENERAL code */
export const err = (msg: string): VMValue => vmError("GENERAL", msg)

// ─── VMValue utilities ──────────────────────────────

/** Check if a VMValue is an error */
export const isVMError = (v: VMValue): v is typeof VMError.Type =>
  v._tag === "error"

/** Check if a VMValue is numeric (num or bool-as-num) */
export const isNumeric = (v: VMValue): boolean =>
  v._tag === "num" || v._tag === "bool"

/** Extract numeric value, or return undefined if not numeric */
export const toNumber = (v: VMValue): number | undefined => {
  if (v._tag === "num") return v.value
  if (v._tag === "bool") return v.value ? 1 : 0
  return undefined
}

/** Extract numeric value, throwing on non-numeric (defect in caller) */
export function asNum(v: VMValue): number {
  if (v._tag === "num") return v.value
  if (v._tag === "bool") return v.value ? 1 : 0
  throw new Error(`Expected num, got ${v._tag}`)
}

/** Structural equality for VMValues */
export function vmEq(a: VMValue, b: VMValue): boolean {
  if (a._tag !== b._tag) return false
  if (a._tag === "num" && b._tag === "num") return a.value === b.value
  if (a._tag === "str" && b._tag === "str") return a.value === b.value
  if (a._tag === "bool" && b._tag === "bool") return a.value === b.value
  return false
}

/** Get display string for a VMValue (for cell rendering) */
export const vmDisplay = (v: VMValue): string => {
  switch (v._tag) {
    case "num": return String(v.value)
    case "str": return v.value
    case "bool": return v.value ? "TRUE" : "FALSE"
    case "error": return errorCodeDisplay[v.code] ?? `#ERROR!`
  }
}

/** Propagate error: if any input is error, return it (error propagation rule) */
export const propagateError = (...values: VMValue[]): VMValue | undefined =>
  values.find(isVMError)

// ═══════════════════════════════════════════════════════
// EFFECT ERROR TYPES (channel 2: typed E channel)
// ═══════════════════════════════════════════════════════

/**
 * Compile-time error — malformed expression or unknown token.
 *
 * **Consumer**: Formula bar UI (red underline, error tooltip)
 * **Recovery**: User fixes the expression. No retry.
 * **When**: compileExpr() encounters bad input
 */
export class CompileError extends Data.TaggedError("CompileError")<{
  readonly expr: string
  readonly token?: string
  readonly position?: number
  readonly reason: string
}> {}

/**
 * Runtime evaluation error — VM entered an unexpected state.
 *
 * **Consumer**: Error log, developer debugging
 * **Recovery**: Possible retry with fresh state. Usually indicates a bug.
 * **When**: Assertion failure inside eval loop, state corruption
 */
export class EvalError extends Data.TaggedError("EvalError")<{
  readonly step: number
  readonly opcode: string
  readonly reason: string
  readonly snapshot?: VMState
}> {}

/**
 * Resource exhaustion — sandbox pool empty, semaphore full.
 *
 * **Consumer**: Service layer retry logic, backpressure system
 * **Recovery**: Retry with exponential backoff, or queue for later eval
 * **When**: All WASM sandbox instances busy, concurrent eval limit hit
 */
export class ResourceError extends Data.TaggedError("ResourceError")<{
  readonly resource: string
  readonly reason: string
}> {}

/**
 * Union of all recoverable VM errors for the Effect E channel.
 *
 * Use with `Effect.catchTags` for exhaustive handling:
 * ```ts
 * pipe(
 *   vm.evalExpr("bad formula"),
 *   Effect.catchTags({
 *     CompileError: (e) => Effect.succeed(vmError("UNKNOWN_TOKEN", e.reason)),
 *     EvalError: (e) => Effect.succeed(vmError("GENERAL", e.reason)),
 *     ResourceError: (e) => Effect.retry(original, Schedule.exponential("100 millis")),
 *   })
 * )
 * ```
 *
 * TimeoutError is from Effect.timeout — Cause.TimeoutError, not in this union.
 */
export type VMFailure = CompileError | EvalError | ResourceError

// ─── Error utilities for Effect channel ─────────────

/** Convert an Effect channel error into an inline VMValue error for cell display */
export const failureToVMError = (failure: VMFailure): VMValue => {
  switch (failure._tag) {
    case "CompileError":
      return vmError("UNKNOWN_TOKEN", failure.reason)
    case "EvalError":
      return vmError("GENERAL", failure.reason)
    case "ResourceError":
      return vmError("GENERAL", `Resource unavailable: ${failure.resource}`)
  }
}

/** Convert a Cause.TimeoutError into an inline VMValue error */
export const timeoutToVMError = (): VMValue =>
  vmError("EVAL_OVERFLOW", "Formula evaluation timed out")

/**
 * Catch all VM failures and convert to inline error state.
 * Use at the service boundary to ensure cells always get a value.
 *
 * ```ts
 * const safeResult = pipe(
 *   vm.evalExpr(formula),
 *   StackVM.catchToErrorState,
 * )
 * ```
 */
export const catchToErrorState = <R>(
  self: Effect.Effect<VMState, VMFailure | Cause.TimeoutError, R>,
): Effect.Effect<VMState, never, R> =>
  self.pipe(
    Effect.catch((error) => {
      const errorValue = Cause.isTimeoutError(error)
        ? timeoutToVMError()
        : failureToVMError(error as VMFailure)
      return Effect.succeed({
        stack: [errorValue],
        registers: {},
        trail: [],
        step: 0,
        halted: true,
      })
    }),
  )

// ═══════════════════════════════════════════════════════
// OPCODES
// ═══════════════════════════════════════════════════════

export const PUSH_NUM = Schema.TaggedStruct("PUSH_NUM", { value: Schema.Number })
export const PUSH_STR = Schema.TaggedStruct("PUSH_STR", { value: Schema.String })
export const PUSH_BOOL = Schema.TaggedStruct("PUSH_BOOL", { value: Schema.Boolean })
export const ADD = Schema.TaggedStruct("ADD", {})
export const SUB = Schema.TaggedStruct("SUB", {})
export const MUL = Schema.TaggedStruct("MUL", {})
export const DIV = Schema.TaggedStruct("DIV", {})
export const DUP = Schema.TaggedStruct("DUP", {})
export const SWAP = Schema.TaggedStruct("SWAP", {})
export const DROP = Schema.TaggedStruct("DROP", {})
export const NEG = Schema.TaggedStruct("NEG", {})
export const EQ = Schema.TaggedStruct("EQ", {})
export const LT = Schema.TaggedStruct("LT", {})
export const GT = Schema.TaggedStruct("GT", {})
export const NOT = Schema.TaggedStruct("NOT", {})
export const SUM_N = Schema.TaggedStruct("SUM_N", { n: Schema.Number })
export const HALT = Schema.TaggedStruct("HALT", {})

/**
 * IF — conditional: pops (condition, true_val, false_val), pushes result.
 *
 * Stack: [false_val, true_val, condition] → [result]
 * If condition is truthy (bool true, or non-zero num), pushes true_val.
 * Otherwise pushes false_val. Error conditions propagate.
 */
export const IF = Schema.TaggedStruct("IF", {})

/**
 * MIN_N / MAX_N — aggregate N values from stack.
 */
export const MIN_N = Schema.TaggedStruct("MIN_N", { n: Schema.Number })
export const MAX_N = Schema.TaggedStruct("MAX_N", { n: Schema.Number })

/**
 * AVG_N — average N values from stack.
 */
export const AVG_N = Schema.TaggedStruct("AVG_N", { n: Schema.Number })

/**
 * Dynamic aggregates — pop count from stack, then aggregate that many values.
 * Used with READ_RANGE which pushes values + count.
 */
export const SUM_DYN = Schema.TaggedStruct("SUM_DYN", {})
export const MIN_DYN = Schema.TaggedStruct("MIN_DYN", {})
export const MAX_DYN = Schema.TaggedStruct("MAX_DYN", {})
export const AVG_DYN = Schema.TaggedStruct("AVG_DYN", {})
export const COUNT_DYN = Schema.TaggedStruct("COUNT_DYN", {})

/** POWER — raise base to exponent */
export const POWER = Schema.TaggedStruct("POWER", {})

/**
 * CONCAT — string concatenation: pops 2 values, coerces to string, pushes joined.
 */
export const CONCAT = Schema.TaggedStruct("CONCAT", {})

/**
 * TO_NUM — coerce top of stack to number: str→parseFloat, bool→0/1, num→noop.
 */
export const TO_NUM = Schema.TaggedStruct("TO_NUM", {})

/**
 * TO_STR — coerce top of stack to string: num→String, bool→"TRUE"/"FALSE".
 */
export const TO_STR = Schema.TaggedStruct("TO_STR", {})

/**
 * MOD — modulo: pops (a, b), pushes a % b.
 */
export const MOD = Schema.TaggedStruct("MOD", {})

/**
 * ABS — absolute value: pops top, pushes |top|.
 */
export const ABS = Schema.TaggedStruct("ABS", {})

/**
 * READ_RANGE — read a range of cells onto the stack.
 *
 * Pushes N values from cells startAddr..endAddr (inclusive) onto the stack,
 * then pushes the count N. Used with SUM_N, MIN_N, MAX_N, AVG_N.
 *
 * Range format: "A1" to "A10" → reads A1, A2, ..., A10.
 * Only supports single-column or single-row ranges.
 */
export const READ_RANGE = Schema.TaggedStruct("READ_RANGE", {
  startCol: Schema.String,
  startRow: Schema.Number,
  endCol: Schema.String,
  endRow: Schema.Number,
})

/**
 * READ_CELL — read a cell value onto the stack.
 *
 * Takes a cell address string. At eval time, resolves the address
 * via CellContext and pushes the VMValue.
 *
 * If no CellContext is provided, pushes vmError("GENERAL", "no cell context").
 * If the cell doesn't exist, pushes num(0) (empty = zero convention).
 */
export const READ_CELL = Schema.TaggedStruct("READ_CELL", { addr: Schema.String })

/**
 * WRITE_CELL — pop a value and write it to a cell.
 *
 * Takes a cell address string. At eval time, pops the top value
 * from the stack and writes it via CellContext.
 */
export const WRITE_CELL = Schema.TaggedStruct("WRITE_CELL", { addr: Schema.String })

export const Opcode = Schema.Union([
  PUSH_NUM, PUSH_STR, PUSH_BOOL,
  ADD, SUB, MUL, DIV, MOD, ABS,
  CONCAT, TO_NUM, TO_STR,
  DUP, SWAP, DROP, NEG,
  EQ, LT, GT, NOT, IF,
  SUM_N, MIN_N, MAX_N, AVG_N,
  SUM_DYN, MIN_DYN, MAX_DYN, AVG_DYN, COUNT_DYN, POWER,
  HALT,
  READ_CELL, WRITE_CELL, READ_RANGE,
])
export type Opcode = typeof Opcode.Type

export type StackIR = ReadonlyArray<Opcode>

// ═══════════════════════════════════════════════════════
// CELL CONTEXT (injected for READ_CELL / WRITE_CELL)
// ═══════════════════════════════════════════════════════

/**
 * CellContext — injected dependency for cell I/O opcodes.
 *
 * The VM itself doesn't know about the cell layer. CellContext
 * is a simple callback interface passed at eval time.
 *
 * In production, this is wired from CellCache + VMCellBridge.
 * In tests, it can be a plain Map.
 */
export interface CellContext {
  /** Read a cell value. Returns the VMValue for the cell, or num(0) for empty. */
  readonly readCell: (addr: string) => VMValue
  /** Write a value to a cell. */
  readonly writeCell: (addr: string, value: VMValue) => void
}

/** No-op CellContext — all reads return error, writes are dropped */
export const emptyCellContext: CellContext = {
  readCell: () => vmError("GENERAL", "No cell context available"),
  writeCell: () => {},
}

// ═══════════════════════════════════════════════════════
// TRAIL + VM STATE
// ═══════════════════════════════════════════════════════

export interface TrailEntry {
  readonly step: number
  readonly opcode: string
  readonly stackDepthBefore: number
  readonly stackDepthAfter: number
  readonly result?: VMValue
}

export interface VMState {
  readonly stack: VMValue[]
  readonly registers: Record<string, VMValue>
  readonly trail: TrailEntry[]
  readonly step: number
  readonly halted: boolean
}

export const emptyState = (): VMState => ({
  stack: [],
  registers: {},
  trail: [],
  step: 0,
  halted: false,
})

// ─── Schema-backed VMState for differ / serialization ─

export const TrailEntrySchema = Schema.Struct({
  step: Schema.Number,
  opcode: Schema.String,
  stackDepthBefore: Schema.Number,
  stackDepthAfter: Schema.Number,
  result: Schema.optional(VMValue),
})

export const VMStateSchema = Schema.Struct({
  stack: Schema.Array(VMValue),
  registers: Schema.Record(Schema.String, VMValue),
  trail: Schema.Array(TrailEntrySchema),
  step: Schema.Number,
  halted: Schema.Boolean,
})

export const vmStateDiffer = Schema.toDifferJsonPatch(VMStateSchema)

// ═══════════════════════════════════════════════════════
// DISPATCH (hoisted for performance)
// ═══════════════════════════════════════════════════════

/**
 * @internal Hoisted Match dispatch — created once, reused for all evals.
 *
 * Each handler returns a command descriptor. The execOpcode interpreter
 * reads the descriptor and mutates the stack. This two-phase design
 * keeps Match pure while allowing mutable stack ops.
 *
 * Error propagation rule: if any operand is a VMError, propagate it
 * instead of computing. This mirrors spreadsheet semantics.
 */
const opcodeDispatch = pipe(
  Match.type<Opcode>(),
  Match.tagsExhaustive({
    PUSH_NUM: (o) => ({ result: num(o.value), pushVal: num(o.value) }),
    PUSH_STR: (o) => ({ result: str(o.value), pushVal: str(o.value) }),
    PUSH_BOOL: (o) => ({ result: bool(o.value), pushVal: bool(o.value) }),
    ADD: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return num(asNum(a) + asNum(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "ADD requires 2 operands",
    }),
    SUB: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return num(asNum(a) - asNum(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "SUB requires 2 operands",
    }),
    MUL: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return num(asNum(a) * asNum(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "MUL requires 2 operands",
    }),
    DIV: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        const bn = asNum(b)
        return bn === 0 ? vmError("DIV_ZERO", "Division by zero") : num(asNum(a) / bn)
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "DIV requires 2 operands",
    }),
    DUP: () => ({ dup: true }),
    SWAP: () => ({ swap: true }),
    DROP: () => ({ drop: true }),
    NEG: () => ({
      unop: (a: VMValue) => {
        if (isVMError(a)) return a
        return num(-asNum(a))
      },
      errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "NEG requires 1 operand",
    }),
    EQ: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return bool(vmEq(a, b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "EQ requires 2 operands",
    }),
    LT: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return bool(asNum(a) < asNum(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "LT requires 2 operands",
    }),
    GT: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return bool(asNum(a) > asNum(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "GT requires 2 operands",
    }),
    NOT: () => ({
      unop: (a: VMValue) => {
        if (isVMError(a)) return a
        return bool(a._tag === "bool" ? !a.value : a._tag === "num" ? a.value === 0 : false)
      },
      errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "NOT requires 1 operand",
    }),
    MOD: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        const bn = asNum(b)
        return bn === 0 ? vmError("DIV_ZERO", "Modulo by zero") : num(asNum(a) % bn)
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "MOD requires 2 operands",
    }),
    CONCAT: () => ({
      binop: (a: VMValue, b: VMValue) => {
        const pe = propagateError(a, b); if (pe) return pe
        return str(vmDisplay(a) + vmDisplay(b))
      },
      need: 2, errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "CONCAT requires 2 operands",
    }),
    TO_NUM: () => ({
      unop: (a: VMValue) => {
        if (isVMError(a)) return a
        const n = toNumber(a)
        return n !== undefined ? num(n) : vmError("TYPE_MISMATCH", `Cannot convert ${a._tag} to number`)
      },
      errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "TO_NUM requires 1 operand",
    }),
    TO_STR: () => ({
      unop: (a: VMValue) => {
        if (isVMError(a)) return a
        return str(vmDisplay(a))
      },
      errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "TO_STR requires 1 operand",
    }),
    ABS: () => ({
      unop: (a: VMValue) => {
        if (isVMError(a)) return a
        return num(Math.abs(asNum(a)))
      },
      errCode: "STACK_UNDERFLOW" as VMErrorCode, errMsg: "ABS requires 1 operand",
    }),
    IF: () => ({ ifOp: true }),
    SUM_N: (o) => ({ sumN: o.n }),
    MIN_N: (o) => ({ minN: o.n }),
    MAX_N: (o) => ({ maxN: o.n }),
    AVG_N: (o) => ({ avgN: o.n }),
    SUM_DYN: () => ({ sumDyn: true }),
    MIN_DYN: () => ({ minDyn: true }),
    MAX_DYN: () => ({ maxDyn: true }),
    AVG_DYN: () => ({ avgDyn: true }),
    COUNT_DYN: () => ({ countDyn: true }),
    POWER: () => ({ power: true }),
    HALT: () => ({ halt: true }),
    READ_CELL: (o) => ({ readCell: o.addr }),
    WRITE_CELL: (o) => ({ writeCell: o.addr }),
    READ_RANGE: (o) => ({ readRange: o }),
  })
)

// ═══════════════════════════════════════════════════════
// OPCODE EXECUTION
// ═══════════════════════════════════════════════════════

/** Maximum steps per eval to prevent infinite loops */
export const MAX_EVAL_STEPS = 100_000

/**
 * Execute a single opcode against VMState, returning new state.
 *
 * Error handling:
 * - Stack underflow → pushes VMError with STACK_UNDERFLOW code
 * - DIV/0 → pushes VMError with DIV_ZERO code
 * - Error propagation → if operand is error, result is that error
 * - Step overflow → sets halted=true, pushes EVAL_OVERFLOW error
 *
 * These are all inline errors (channel 1) — the eval itself succeeds.
 *
 * @param ctx Optional CellContext for READ_CELL/WRITE_CELL opcodes
 */
export const execOpcode = (op: Opcode, state: VMState, ctx?: CellContext): VMState => {
  // Step overflow guard
  if (state.step >= MAX_EVAL_STEPS) {
    return {
      ...state,
      stack: [...state.stack, vmError("EVAL_OVERFLOW", `Exceeded ${MAX_EVAL_STEPS} steps`)],
      halted: true,
    }
  }

  const s = [...state.stack]
  const depthBefore = s.length
  const cmd = opcodeDispatch(op) as any
  let result: VMValue | undefined

  if (cmd.halt) {
    // noop — halted flag set below
  } else if (cmd.pushVal) {
    s.push(cmd.pushVal); result = cmd.result
  } else if (cmd.binop) {
    if (s.length < cmd.need) {
      const e = vmError(cmd.errCode, cmd.errMsg); s.push(e); result = e
    } else {
      const b = s.pop()!; const a = s.pop()!
      const v = cmd.binop(a, b); s.push(v); result = v
    }
  } else if (cmd.unop) {
    if (s.length === 0) {
      const e = vmError(cmd.errCode, cmd.errMsg); s.push(e); result = e
    } else {
      const a = s.pop()!; const v = cmd.unop(a); s.push(v); result = v
    }
  } else if (cmd.dup) {
    if (s.length === 0) {
      const e = vmError("STACK_UNDERFLOW", "DUP requires 1 operand"); s.push(e); result = e
    } else {
      const v = s[s.length - 1]; s.push(v); result = v
    }
  } else if (cmd.swap) {
    if (s.length < 2) {
      const e = vmError("STACK_UNDERFLOW", "SWAP requires 2 operands"); s.push(e); result = e
    } else {
      const b = s.pop()!; const a = s.pop()!; s.push(b, a)
    }
  } else if (cmd.drop) {
    if (s.length === 0) {
      const e = vmError("STACK_UNDERFLOW", "DROP requires 1 operand"); s.push(e); result = e
    } else {
      s.pop()
    }
  } else if (cmd.sumN !== undefined) {
    const n = cmd.sumN
    if (s.length < n) {
      const e = vmError("STACK_UNDERFLOW", `SUM_N requires ${n} operands`); s.push(e); result = e
    } else {
      // Error propagation: if any value is error, result is that error
      const values: VMValue[] = []
      for (let i = 0; i < n; i++) values.push(s.pop()!)
      const firstErr = values.find(isVMError)
      if (firstErr) {
        s.push(firstErr); result = firstErr
      } else {
        let t = 0
        for (const v of values) t += asNum(v)
        const r = num(t); s.push(r); result = r
      }
    }
  } else if (cmd.ifOp) {
    if (s.length < 3) {
      const e = vmError("STACK_UNDERFLOW", "IF requires 3 operands (false_val, true_val, condition)"); s.push(e); result = e
    } else {
      const condition = s.pop()!
      const trueVal = s.pop()!
      const falseVal = s.pop()!
      const pe = propagateError(condition); if (pe) { s.push(pe); result = pe }
      else {
        const isTruthy = condition._tag === "bool" ? condition.value
          : condition._tag === "num" ? condition.value !== 0
          : true // strings are truthy
        const v = isTruthy ? trueVal : falseVal
        s.push(v); result = v
      }
    }
  } else if (cmd.minN !== undefined) {
    const n = cmd.minN
    if (s.length < n) {
      const e = vmError("STACK_UNDERFLOW", `MIN_N requires ${n} operands`); s.push(e); result = e
    } else {
      const values: VMValue[] = []
      for (let i = 0; i < n; i++) values.push(s.pop()!)
      const firstErr = values.find(isVMError)
      if (firstErr) { s.push(firstErr); result = firstErr }
      else {
        let min = asNum(values[0])
        for (let i = 1; i < n; i++) { const v = asNum(values[i]); if (v < min) min = v }
        const r = num(min); s.push(r); result = r
      }
    }
  } else if (cmd.maxN !== undefined) {
    const n = cmd.maxN
    if (s.length < n) {
      const e = vmError("STACK_UNDERFLOW", `MAX_N requires ${n} operands`); s.push(e); result = e
    } else {
      const values: VMValue[] = []
      for (let i = 0; i < n; i++) values.push(s.pop()!)
      const firstErr = values.find(isVMError)
      if (firstErr) { s.push(firstErr); result = firstErr }
      else {
        let max = asNum(values[0])
        for (let i = 1; i < n; i++) { const v = asNum(values[i]); if (v > max) max = v }
        const r = num(max); s.push(r); result = r
      }
    }
  } else if (cmd.avgN !== undefined) {
    const n = cmd.avgN
    if (s.length < n) {
      const e = vmError("STACK_UNDERFLOW", `AVG_N requires ${n} operands`); s.push(e); result = e
    } else if (n === 0) {
      const e = vmError("DIV_ZERO", "AVG_N with n=0"); s.push(e); result = e
    } else {
      const values: VMValue[] = []
      for (let i = 0; i < n; i++) values.push(s.pop()!)
      const firstErr = values.find(isVMError)
      if (firstErr) { s.push(firstErr); result = firstErr }
      else {
        let sum = 0
        for (const v of values) sum += asNum(v)
        const r = num(sum / n); s.push(r); result = r
      }
    }
  } else if (cmd.power) {
    if (s.length < 2) {
      const e = vmError("STACK_UNDERFLOW", "POWER requires 2 operands"); s.push(e); result = e
    } else {
      const exp = s.pop()!; const base = s.pop()!
      const pe = propagateError(base, exp)
      if (pe) { s.push(pe); result = pe }
      else { const r = num(Math.pow(asNum(base), asNum(exp))); s.push(r); result = r }
    }
  } else if (cmd.countDyn) {
    // Pop count from stack — that IS the result (count of items in range)
    if (s.length === 0) {
      const e = vmError("STACK_UNDERFLOW", "COUNT_DYN requires count on stack"); s.push(e); result = e
    } else {
      const countVal = s.pop()!
      const n = countVal._tag === "num" ? countVal.value : 0
      // Pop the n values (discard them, we just want the count)
      for (let i = 0; i < n && s.length > 0; i++) s.pop()
      const r = num(n); s.push(r); result = r
    }
  } else if (cmd.sumDyn || cmd.minDyn || cmd.maxDyn || cmd.avgDyn) {
    // Pop count from stack, then aggregate that many values
    if (s.length === 0) {
      const e = vmError("STACK_UNDERFLOW", "Dynamic aggregate requires count on stack"); s.push(e); result = e
    } else {
      const countVal = s.pop()!
      const n = countVal._tag === "num" ? countVal.value : 0
      if (n <= 0 || s.length < n) {
        const e = vmError("STACK_UNDERFLOW", `Dynamic aggregate requires ${n} values`); s.push(e); result = e
      } else {
        const values: VMValue[] = []
        for (let i = 0; i < n; i++) values.push(s.pop()!)
        const firstErr = values.find(isVMError)
        if (firstErr) { s.push(firstErr); result = firstErr }
        else if (cmd.sumDyn) {
          let sum = 0; for (const v of values) sum += asNum(v)
          const r = num(sum); s.push(r); result = r
        } else if (cmd.minDyn) {
          let min = asNum(values[0]); for (let i = 1; i < n; i++) { const v = asNum(values[i]); if (v < min) min = v }
          const r = num(min); s.push(r); result = r
        } else if (cmd.maxDyn) {
          let max = asNum(values[0]); for (let i = 1; i < n; i++) { const v = asNum(values[i]); if (v > max) max = v }
          const r = num(max); s.push(r); result = r
        } else { // avgDyn
          let sum = 0; for (const v of values) sum += asNum(v)
          const r = num(sum / n); s.push(r); result = r
        }
      }
    }
  } else if (cmd.readCell !== undefined) {
    const cellCtx = ctx ?? emptyCellContext
    const v = cellCtx.readCell(cmd.readCell)
    s.push(v); result = v
  } else if (cmd.writeCell !== undefined) {
    const cellCtx = ctx ?? emptyCellContext
    if (s.length === 0) {
      const e = vmError("STACK_UNDERFLOW", "WRITE_CELL requires 1 operand"); s.push(e); result = e
    } else {
      const v = s.pop()!
      cellCtx.writeCell(cmd.writeCell, v)
      result = v
    }
  } else if (cmd.readRange !== undefined) {
    const cellCtx = ctx ?? emptyCellContext
    const { startCol, startRow, endCol, endRow } = cmd.readRange
    // Iterate range: single column (A1:A10) or single row (A1:D1)
    let count = 0
    if (startCol === endCol) {
      // Column range: A1:A10
      const lo = Math.min(startRow, endRow)
      const hi = Math.max(startRow, endRow)
      for (let r = lo; r <= hi; r++) {
        s.push(cellCtx.readCell(`${startCol}${r}`))
        count++
      }
    } else if (startRow === endRow) {
      // Row range: A1:D1 — iterate cols
      const lo = startCol.charCodeAt(0)
      const hi = endCol.charCodeAt(0)
      for (let c = Math.min(lo, hi); c <= Math.max(lo, hi); c++) {
        s.push(cellCtx.readCell(`${String.fromCharCode(c)}${startRow}`))
        count++
      }
    } else {
      // 2D range: push all cells row by row
      const loCol = Math.min(startCol.charCodeAt(0), endCol.charCodeAt(0))
      const hiCol = Math.max(startCol.charCodeAt(0), endCol.charCodeAt(0))
      const loRow = Math.min(startRow, endRow)
      const hiRow = Math.max(startRow, endRow)
      for (let r = loRow; r <= hiRow; r++) {
        for (let c = loCol; c <= hiCol; c++) {
          s.push(cellCtx.readCell(`${String.fromCharCode(c)}${r}`))
          count++
        }
      }
    }
    // Push count onto stack (for SUM_N, MIN_N, etc.)
    const countVal = num(count)
    s.push(countVal)
    result = countVal
  }

  const entry: TrailEntry = {
    step: state.step,
    opcode: op._tag,
    stackDepthBefore: depthBefore,
    stackDepthAfter: s.length,
    result,
  }

  const trail = state.trail as TrailEntry[]
  trail.push(entry)

  return {
    stack: s,
    registers: state.registers,
    trail,
    step: state.step + 1,
    halted: cmd.halt === true,
  }
}

// ═══════════════════════════════════════════════════════
// TRANSACTIONAL EVAL
// ═══════════════════════════════════════════════════════

/** Run StackIR transactionally against a TxRef<VMState> */
export const runIR = (
  ref: TxRef.TxRef<VMState>,
  ir: StackIR,
  ctx?: CellContext,
): Effect.Effect<VMState, never, Effect.Transaction> =>
  Effect.gen(function*() {
    for (const op of ir) {
      const current = yield* TxRef.get(ref)
      if (current.halted) break
      yield* TxRef.set(ref, execOpcode(op, current, ctx))
    }
    return yield* TxRef.get(ref)
  })

/** Run an Effect<VMValue> program, pushing result onto stack */
export const runEffect = (
  ref: TxRef.TxRef<VMState>,
  program: Effect.Effect<VMValue>,
): Effect.Effect<VMState, never, Effect.Transaction> =>
  Effect.gen(function*() {
    const value = yield* Effect.orDie(program)
    const state = yield* TxRef.get(ref)
    const newStack = [...state.stack, value]
    const entry: TrailEntry = {
      step: state.step,
      opcode: "EFFECT",
      stackDepthBefore: state.stack.length,
      stackDepthAfter: newStack.length,
      result: value,
    }
    const trail = state.trail as TrailEntry[]
    trail.push(entry)
    yield* TxRef.set(ref, { ...state, stack: newStack, trail, step: state.step + 1 })
    return yield* TxRef.get(ref)
  })

// ═══════════════════════════════════════════════════════
// COMPILER (Shunting-Yard, string → StackIR)
// ═══════════════════════════════════════════════════════

/** A1 notation pattern: one or more uppercase letters followed by one or more digits */
const A1_PATTERN = /^[A-Z]+\d+$/
/** Range pattern: A1:B10 */
const RANGE_PATTERN = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/

/**
 * Classify a token for compilation.
 *
 * Order of precedence:
 * 1. Numeric literal → PUSH_NUM
 * 2. Keyword (operator, stack op, bool) → corresponding opcode
 * 3. A1 cell reference → READ_CELL
 * 4. Unknown → CompileError
 */
function classifyToken(tok: string): Opcode | null {
  // 1. Numeric literal
  const n = Number(tok)
  if (!Number.isNaN(n)) return { _tag: "PUSH_NUM", value: n }

  // 2. Keywords
  switch (tok) {
    case "+": return { _tag: "ADD" }
    case "-": return { _tag: "SUB" }
    case "*": return { _tag: "MUL" }
    case "/": return { _tag: "DIV" }
    case "%": return { _tag: "MOD" }
    case "ABS": return { _tag: "ABS" }
    case "CONCAT": return { _tag: "CONCAT" }
    case "TO_NUM": return { _tag: "TO_NUM" }
    case "TO_STR": return { _tag: "TO_STR" }
    case "DUP": return { _tag: "DUP" }
    case "SWAP": return { _tag: "SWAP" }
    case "DROP": return { _tag: "DROP" }
    case "NEG": return { _tag: "NEG" }
    case "EQ": return { _tag: "EQ" }
    case "LT": return { _tag: "LT" }
    case "GT": return { _tag: "GT" }
    case "NOT": return { _tag: "NOT" }
    case "IF": return { _tag: "IF" }
    case "SUM_DYN": return { _tag: "SUM_DYN" }
    case "MIN_DYN": return { _tag: "MIN_DYN" }
    case "MAX_DYN": return { _tag: "MAX_DYN" }
    case "AVG_DYN": return { _tag: "AVG_DYN" }
    case "COUNT_DYN": return { _tag: "COUNT_DYN" }
    case "POWER": return { _tag: "POWER" }
    case "HALT": return { _tag: "HALT" }
    case "true": return { _tag: "PUSH_BOOL", value: true }
    case "false": return { _tag: "PUSH_BOOL", value: false }
  }

  // 3. Range reference (A1:A10)
  const rangeMatch = RANGE_PATTERN.exec(tok)
  if (rangeMatch) {
    return {
      _tag: "READ_RANGE",
      startCol: rangeMatch[1],
      startRow: parseInt(rangeMatch[2], 10),
      endCol: rangeMatch[3],
      endRow: parseInt(rangeMatch[4], 10),
    }
  }

  // 4. A1 cell reference
  if (A1_PATTERN.test(tok)) return { _tag: "READ_CELL", addr: tok }

  // 5. Unknown
  return null
}

/**
 * Compile RPN expression string to StackIR.
 *
 * Supports:
 * - Numeric literals: `3`, `3.14`, `-1`
 * - Operators: `+`, `-`, `*`, `/`
 * - Stack ops: `DUP`, `SWAP`, `DROP`, `NEG`, `HALT`
 * - Booleans: `true`, `false`
 * - Cell references: `A1`, `B2`, `AA100` (compiled to READ_CELL)
 *
 * Fails with CompileError (Effect E channel) on invalid tokens.
 */
export const compileExpr = (expr: string): Effect.Effect<StackIR, CompileError> => {
  const tokens = expr.trim().split(/\s+/)
  const ops: Opcode[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok === "") continue

    const op = classifyToken(tok)
    if (op) {
      ops.push(op)
    } else {
      return Effect.fail(new CompileError({
        expr,
        token: tok,
        position: i,
        reason: `Unknown token: "${tok}"`,
      }))
    }
  }

  return Effect.succeed(ops)
}

/**
 * Compile RPN expression synchronously.
 * Throws CompileError on failure (for use in hot paths where Effect overhead is unwanted).
 */
export const compileExprSync = (expr: string): StackIR => {
  const tokens = expr.trim().split(/\s+/)
  const ops: Opcode[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok === "") continue

    const op = classifyToken(tok)
    if (op) {
      ops.push(op)
    } else {
      throw new CompileError({ expr, token: tok, position: i, reason: `Unknown token: "${tok}"` })
    }
  }
  return ops
}

// ═══════════════════════════════════════════════════════
// DEPENDENCY EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Extract cell dependencies from an RPN expression string.
 *
 * Scans tokens for A1-notation cell references.
 * Used by DepGraph to register formula dependencies.
 *
 * ```ts
 * extractDeps("A1 B1 + C1 *") // → ["A1", "B1", "C1"]
 * extractDeps("3 4 +")         // → []
 * ```
 */
export const extractDeps = (expr: string): ReadonlyArray<string> => {
  const tokens = expr.trim().split(/\s+/)
  const deps: string[] = []
  const seen = new Set<string>()

  const addDep = (addr: string) => {
    if (!seen.has(addr)) { deps.push(addr); seen.add(addr) }
  }

  for (const tok of tokens) {
    // Check range first (A1:A10)
    const rangeMatch = RANGE_PATTERN.exec(tok)
    if (rangeMatch) {
      const [, sc, sr, ec, er] = rangeMatch
      const startRow = parseInt(sr, 10)
      const endRow = parseInt(er, 10)
      if (sc === ec) {
        // Column range
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
          addDep(`${sc}${r}`)
        }
      } else if (startRow === endRow) {
        // Row range
        for (let c = Math.min(sc.charCodeAt(0), ec.charCodeAt(0)); c <= Math.max(sc.charCodeAt(0), ec.charCodeAt(0)); c++) {
          addDep(`${String.fromCharCode(c)}${startRow}`)
        }
      } else {
        // 2D range
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
          for (let c = Math.min(sc.charCodeAt(0), ec.charCodeAt(0)); c <= Math.max(sc.charCodeAt(0), ec.charCodeAt(0)); c++) {
            addDep(`${String.fromCharCode(c)}${r}`)
          }
        }
      }
      continue
    }
    // Single cell ref
    if (A1_PATTERN.test(tok)) addDep(tok)
  }
  return deps
}

/**
 * Extract cell dependencies from compiled StackIR.
 *
 * Scans opcodes for READ_CELL operations.
 */
export const extractDepsFromIR = (ir: StackIR): ReadonlyArray<string> => {
  const deps: string[] = []
  const seen = new Set<string>()
  for (const op of ir) {
    if (op._tag === "READ_CELL" && !seen.has(op.addr)) {
      deps.push(op.addr)
      seen.add(op.addr)
    }
  }
  return deps
}

// ═══════════════════════════════════════════════════════
// INFIX PARSER (Shunting-Yard, =A1+B1*2 → StackIR)
// ═══════════════════════════════════════════════════════

/** Operator precedence for shunting-yard */
const PREC: Record<string, number> = {
  "<": 0, ">": 0,  // comparison
  "+": 1, "-": 1,
  "*": 2, "/": 2, "%": 2,
  "^": 3, // exponent: right-associative, high precedence
  "UNARY_NEG": 4, "CONCAT": 1, // unary neg highest; concat same as +
}

/**
 * Map infix operator tokens to RPN opcodes.
 * Needed because some infix operators differ from RPN tokens.
 */
const INFIX_OP_MAP: Record<string, string> = {
  "<": "LT", ">": "GT", "^": "POWER",
}
const RIGHT_ASSOC = new Set<string>(["UNARY_NEG", "^"])

/** Tokenize an infix expression */
function tokenizeInfix(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === " " || ch === "\t") { i++; continue }
    // String literal: "hello"
    if (ch === '"') {
      let s = ""; i++
      while (i < expr.length && expr[i] !== '"') { s += expr[i]; i++ }
      if (i < expr.length) i++ // skip closing "
      tokens.push(`"${s}"`)
      continue
    }
    // Operators and parens
    if ("+-*/%(),:=<>&^".includes(ch)) { tokens.push(ch); i++; continue }
    // Number (including decimals)
    if (ch >= "0" && ch <= "9" || (ch === "." && i + 1 < expr.length && expr[i + 1] >= "0" && expr[i + 1] <= "9")) {
      let num = ""
      while (i < expr.length && (expr[i] >= "0" && expr[i] <= "9" || expr[i] === ".")) { num += expr[i]; i++ }
      tokens.push(num)
      continue
    }
    // Identifiers (cell refs, function names, booleans)
    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
      let id = ""
      while (i < expr.length && ((expr[i] >= "A" && expr[i] <= "Z") || (expr[i] >= "a" && expr[i] <= "z") || (expr[i] >= "0" && expr[i] <= "9") || expr[i] === "_")) {
        id += expr[i]; i++
      }
      // Check for range: A1:B10
      if (i < expr.length && expr[i] === ":") {
        id += ":"
        i++
        while (i < expr.length && ((expr[i] >= "A" && expr[i] <= "Z") || (expr[i] >= "0" && expr[i] <= "9"))) {
          id += expr[i]; i++
        }
      }
      tokens.push(id)
      continue
    }
    // Unknown character — skip
    i++
  }
  return tokens
}

/** Known functions → opcode mapping */
const FUNC_MAP: Record<string, string> = {
  SUM: "SUM_DYN", MIN: "MIN_DYN", MAX: "MAX_DYN", AVG: "AVG_DYN",
  COUNT: "COUNT_DYN", POWER: "POWER",
  ABS: "ABS", NEG: "NEG", IF: "IF",
  CONCAT: "CONCAT", TO_NUM: "TO_NUM", TO_STR: "TO_STR",
}

/**
 * Compile an infix expression to StackIR.
 *
 * Supports:
 * - Arithmetic: `A1 + B1 * 2`
 * - Functions: `SUM(A1:A5)`, `IF(A1, B1, C1)`
 * - Cell refs: `A1`, `B2`
 * - Ranges: `A1:A10`
 * - Parentheses: `(A1 + B1) * 2`
 * - Booleans: `true`, `false`
 *
 * Strips leading `=` if present.
 */
export const compileInfix = (expr: string): Effect.Effect<StackIR, CompileError> => {
  try {
    return Effect.succeed(compileInfixSync(expr))
  } catch (e) {
    if (e instanceof CompileError) return Effect.fail(e)
    return Effect.fail(new CompileError({ expr, token: "", position: 0, reason: String(e) }))
  }
}

/**
 * Compile infix expression synchronously.
 */
export const compileInfixSync = (rawExpr: string): StackIR => {
  const expr = rawExpr.startsWith("=") ? rawExpr.slice(1) : rawExpr
  const tokens = tokenizeInfix(expr)
  const output: Opcode[] = []
  const opStack: string[] = []
  const argCounts: number[] = [] // for function call arity tracking

  const pushOp = (tok: string) => {
    if (tok === "UNARY_NEG") { output.push({ _tag: "NEG" }); return }
    // Map infix operators to RPN opcodes if needed
    const mapped = INFIX_OP_MAP[tok] ?? tok
    const op = classifyToken(mapped)
    if (!op) throw new CompileError({ expr: rawExpr, token: tok, position: 0, reason: `Unknown operator: ${tok}` })
    output.push(op)
  }

  /** Track whether the previous token was an operand (number, cell, close paren) */
  let prevWasOperand = false

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    // String literal: "hello"
    if (tok.startsWith('"') && tok.endsWith('"')) {
      output.push({ _tag: "PUSH_STR", value: tok.slice(1, -1) })
      prevWasOperand = true
      continue
    }

    // Number literal
    const n = Number(tok)
    if (!isNaN(n) && tok !== "") {
      output.push({ _tag: "PUSH_NUM", value: n })
      prevWasOperand = true
      continue
    }

    // Boolean
    if (tok === "true" || tok === "false") {
      output.push({ _tag: "PUSH_BOOL", value: tok === "true" })
      prevWasOperand = true
      continue
    }

    // Unary minus: - at start, after operator, or after (
    if (tok === "-" && !prevWasOperand) {
      // Push as high-precedence unary: use sentinel
      opStack.push("UNARY_NEG")
      continue
    }

    // Function call: next token is "("
    if (FUNC_MAP[tok] && i + 1 < tokens.length && tokens[i + 1] === "(") {
      opStack.push(`FN:${tok}`)
      argCounts.push(1) // at least 1 arg
      prevWasOperand = false
      continue
    }

    // Range ref (A1:A10) or cell ref (A1)
    const rangeMatch = RANGE_PATTERN.exec(tok)
    if (rangeMatch) {
      output.push({
        _tag: "READ_RANGE",
        startCol: rangeMatch[1],
        startRow: parseInt(rangeMatch[2], 10),
        endCol: rangeMatch[3],
        endRow: parseInt(rangeMatch[4], 10),
      })
      prevWasOperand = true
      continue
    }
    if (A1_PATTERN.test(tok)) {
      output.push({ _tag: "READ_CELL", addr: tok })
      prevWasOperand = true
      continue
    }

    // Comma (function arg separator)
    if (tok === ",") {
      prevWasOperand = false
      while (opStack.length > 0 && opStack[opStack.length - 1] !== "(" && !opStack[opStack.length - 1].startsWith("FN:")) {
        pushOp(opStack.pop()!)
      }
      if (argCounts.length > 0) argCounts[argCounts.length - 1]++
      continue
    }

    // Open paren
    if (tok === "(") {
      opStack.push("(")
      prevWasOperand = false
      continue
    }

    // Close paren
    if (tok === ")") {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== "(" && !opStack[opStack.length - 1].startsWith("FN:")) {
        const top = opStack.pop()!
        if (top === "UNARY_NEG") output.push({ _tag: "NEG" })
        else pushOp(top)
      }
      if (opStack.length > 0 && opStack[opStack.length - 1] === "(") opStack.pop()
      // Check if top is a function
      if (opStack.length > 0 && opStack[opStack.length - 1].startsWith("FN:")) {
        const fnTok = opStack.pop()!
        const fnName = fnTok.slice(3)
        const opcodeName = FUNC_MAP[fnName]
        if (opcodeName) {
          const op = classifyToken(opcodeName)
          if (op) output.push(op)
        }
        argCounts.pop()
      }
      prevWasOperand = true
      continue
    }

    // & operator → CONCAT
    if (tok === "&") {
      // Treat like a binary operator with precedence 1 (same as +)
      while (
        opStack.length > 0 &&
        PREC[opStack[opStack.length - 1]] !== undefined &&
        PREC[opStack[opStack.length - 1]] >= 1
      ) {
        pushOp(opStack.pop()!)
      }
      opStack.push("CONCAT")
      prevWasOperand = false
      continue
    }

    // Operator
    if (PREC[tok] !== undefined) {
      while (
        opStack.length > 0 &&
        PREC[opStack[opStack.length - 1]] !== undefined &&
        (PREC[opStack[opStack.length - 1]] > PREC[tok] ||
          (PREC[opStack[opStack.length - 1]] === PREC[tok] && !RIGHT_ASSOC.has(tok)))
      ) {
        pushOp(opStack.pop()!)
      }
      opStack.push(tok)
      prevWasOperand = false
      continue
    }

    throw new CompileError({ expr: rawExpr, token: tok, position: i, reason: `Unknown token: "${tok}"` })
  }

  // Flush remaining operators
  while (opStack.length > 0) {
    const top = opStack.pop()!
    if (top === "(") throw new CompileError({ expr: rawExpr, token: "(", position: 0, reason: "Mismatched parentheses" })
    if (top === "UNARY_NEG") { output.push({ _tag: "NEG" }); continue }
    pushOp(top)
  }

  return output
}

/**
 * Extract deps from an infix expression.
 * Handles both cell refs and ranges.
 */
export const extractDepsInfix = (rawExpr: string): ReadonlyArray<string> => {
  const expr = rawExpr.startsWith("=") ? rawExpr.slice(1) : rawExpr
  const tokens = tokenizeInfix(expr)
  return extractDeps(tokens.join(" "))
}

// ═══════════════════════════════════════════════════════
// DUAL EVAL
// ═══════════════════════════════════════════════════════

export type EvalInput =
  | { readonly _tag: "ir"; readonly program: StackIR }
  | { readonly _tag: "effect"; readonly program: Effect.Effect<VMValue> }
  | { readonly _tag: "string"; readonly expr: string }

/** Dual eval — StackIR | Effect<VMValue> | string */
export const dualEval = (
  ref: TxRef.TxRef<VMState>,
  input: EvalInput,
): Effect.Effect<VMState, CompileError, Effect.Transaction> => {
  switch (input._tag) {
    case "ir": return runIR(ref, input.program)
    case "effect": return runEffect(ref, input.program)
    case "string":
      return Effect.gen(function*() {
        const ir = yield* compileExpr(input.expr)
        return yield* runIR(ref, ir)
      })
  }
}

/** Run a StackIR program with fresh state */
export const evalProgram = (ir: StackIR, ctx?: CellContext): Effect.Effect<VMState> =>
  Effect.transaction(
    Effect.gen(function*() {
      const ref = yield* TxRef.make(emptyState())
      return yield* runIR(ref, ir, ctx)
    })
  )

/** Run an expression string with fresh state (can fail with CompileError) */
export const evalExpr = (expr: string): Effect.Effect<VMState, CompileError> =>
  Effect.gen(function*() {
    const ir = yield* compileExpr(expr)
    return yield* evalProgram(ir)
  })

// ═══════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════

/** StackVM service interface */
export class StackVM extends ServiceMap.Service<StackVM, {
  /** Evaluate compiled StackIR */
  readonly eval: (ir: StackIR) => Effect.Effect<VMState>
  /** Evaluate RPN expression string (may fail with CompileError) */
  readonly evalExpr: (expr: string) => Effect.Effect<VMState, CompileError | Cause.TimeoutError>
  /** Evaluate an Effect program that produces a VMValue */
  readonly evalEffect: (program: Effect.Effect<VMValue>) => Effect.Effect<VMState>
  /** Compile expression without evaluating (may fail with CompileError) */
  readonly compile: (expr: string) => Effect.Effect<StackIR, CompileError>
  /** Invalidate cached result for an expression */
  readonly invalidate: (expr: string) => Effect.Effect<void>
}>()("tmnl/datagrid/StackVM") {
  /**
   * Convenience: catch all failures and return error VMState.
   * Use at service boundaries to guarantee cells always get a displayable value.
   */
  static catchToErrorState = catchToErrorState
}

// ─── Metrics ────────────────────────────────────────

export const evalCounter = Metric.counter("tmnl.formula.eval_count")
export const evalErrorCounter = Metric.counter("tmnl.formula.eval_error_count")
export const compileErrorCounter = Metric.counter("tmnl.formula.compile_error_count")
export const evalLatency = Metric.histogram("tmnl.formula.eval_latency_ms", {
  boundaries: Metric.linearBoundaries({ start: 0, width: 10, count: 20 }),
})
export const cacheHitCounter = Metric.counter("tmnl.formula.cache_hit_count")

// ─── Service Configuration ──────────────────────────

export interface StackVMConfig {
  readonly cacheCapacity?: number
  readonly cacheTtlSeconds?: number
  readonly maxConcurrency?: number
  readonly evalTimeoutMs?: number
  readonly maxSteps?: number
}

const defaultConfig: Required<StackVMConfig> = {
  cacheCapacity: 256,
  cacheTtlSeconds: 60,
  maxConcurrency: 4,
  evalTimeoutMs: 5000,
  maxSteps: MAX_EVAL_STEPS,
}

// ─── Layer ──────────────────────────────────────────

/** Create StackVM Layer with full pipeline: Cache + Metric + Semaphore + Span + Timeout */
export const StackVMLive = (config?: StackVMConfig): Layer.Layer<StackVM> => {
  const c = { ...defaultConfig, ...config }

  return Layer.effect(StackVM, Effect.gen(function*() {
    const cache = yield* Cache.make({
      capacity: c.cacheCapacity,
      timeToLive: Duration.seconds(c.cacheTtlSeconds),
      lookup: (expr: string) =>
        Effect.gen(function*() {
          const ir = compileExprSync(expr)
          return yield* evalProgram(ir)
        }),
    })

    const sem = yield* Semaphore.make(c.maxConcurrency)

    return StackVM.of({
      eval: (ir) =>
        sem.withPermits(1)(
          Effect.gen(function*() {
            yield* Metric.update(evalCounter, 1)
            const state = yield* evalProgram(ir)
            // Track error values in metrics
            if (state.stack.some(isVMError)) {
              yield* Metric.update(evalErrorCounter, 1)
            }
            return state
          }).pipe(
            Effect.timeout(`${c.evalTimeoutMs} millis`),
            Effect.withSpan("formula.eval"),
          )
        ),

      evalExpr: (expr) =>
        sem.withPermits(1)(
          Effect.gen(function*() {
            yield* Metric.update(evalCounter, 1)
            const state = yield* Cache.get(cache, expr)
            if (state.stack.some(isVMError)) {
              yield* Metric.update(evalErrorCounter, 1)
            }
            return state
          }).pipe(
            Effect.timeout(`${c.evalTimeoutMs} millis`),
            Effect.withSpan("formula.evalExpr", { attributes: { formula: expr } }),
          )
        ),

      evalEffect: (program) =>
        sem.withPermits(1)(
          Effect.transaction(
            Effect.gen(function*() {
              yield* Metric.update(evalCounter, 1)
              const ref = yield* TxRef.make(emptyState())
              return yield* runEffect(ref, program)
            })
          ).pipe(
            Effect.timeout(`${c.evalTimeoutMs} millis`),
            Effect.withSpan("formula.evalEffect"),
          )
        ),

      compile: (expr) =>
        compileExpr(expr).pipe(
          Effect.tapError(() => Metric.update(compileErrorCounter, 1)),
          Effect.withSpan("formula.compile", { attributes: { formula: expr } }),
        ),

      invalidate: (expr) =>
        Cache.invalidate(cache, expr).pipe(
          Effect.withSpan("formula.invalidate", { attributes: { formula: expr } }),
        ),
    })
  }))
}
