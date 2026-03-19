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

const _NUM_CACHE: VMValue[] = []
for (let i = -1; i <= 100; i++) _NUM_CACHE[i + 1] = { _tag: "num", value: i }
export const num = (v: number): VMValue =>
  Number.isInteger(v) && v >= -1 && v <= 100 ? _NUM_CACHE[v + 1] : { _tag: "num", value: v }
export const str = (v: string): VMValue => ({ _tag: "str", value: v })
const _TRUE: VMValue = { _tag: "bool", value: true }
const _FALSE: VMValue = { _tag: "bool", value: false }
export const bool = (v: boolean): VMValue => v ? _TRUE : _FALSE

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
export const GTE = Schema.TaggedStruct("GTE", {})
export const LTE = Schema.TaggedStruct("LTE", {})
export const NEQ = Schema.TaggedStruct("NEQ", {})
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

/** IFERROR — if value is error, use fallback */
export const IFERROR = Schema.TaggedStruct("IFERROR", {})

/** LEN_OP — string length */
export const LEN_OP = Schema.TaggedStruct("LEN_OP", {})

/** LEFT_OP — left N chars of string (pops str, n) */
export const LEFT_OP = Schema.TaggedStruct("LEFT_OP", {})

/** RIGHT_OP — right N chars of string (pops str, n) */
export const RIGHT_OP = Schema.TaggedStruct("RIGHT_OP", {})

/** MID_OP — substring (pops str, start, length) */
export const MID_OP = Schema.TaggedStruct("MID_OP", {})

/** TRIM/UPPER/LOWER — text cleanup (unary) */
export const TRIM_OP = Schema.TaggedStruct("TRIM_OP", {})
export const UPPER_OP = Schema.TaggedStruct("UPPER_OP", {})
export const LOWER_OP = Schema.TaggedStruct("LOWER_OP", {})

/** SUBSTITUTE — find & replace: (text, old, new) → modified text */
export const SUBSTITUTE_OP = Schema.TaggedStruct("SUBSTITUTE_OP", {})

/** CHOOSE_N — pop index + N values, push value at index. =CHOOSE(2, "a", "b", "c") → "b" */
export const CHOOSE_N = Schema.TaggedStruct("CHOOSE_N", { n: Schema.Number })

/** AND_N / OR_N — logical N-ary: pop N booleans, push AND/OR */
export const AND_N = Schema.TaggedStruct("AND_N", { n: Schema.Number })
export const OR_N = Schema.TaggedStruct("OR_N", { n: Schema.Number })

/** PRODUCT_DYN — multiply all values (like SUM but multiplication) */
export const PRODUCT_DYN = Schema.TaggedStruct("PRODUCT_DYN", {})
export const PRODUCT_N = Schema.TaggedStruct("PRODUCT_N", { n: Schema.Number })

/** NOW — pushes current timestamp (ms since epoch) */
export const NOW_OP = Schema.TaggedStruct("NOW_OP", {})

/** RAND — pushes random number between 0 and 1 */
export const RAND_OP = Schema.TaggedStruct("RAND_OP", {})

/** PI_OP — pushes mathematical constant π */
export const PI_OP = Schema.TaggedStruct("PI_OP", {})

/** ROUND — round to N decimal places */
export const ROUND = Schema.TaggedStruct("ROUND", {})

/** FLOOR_OP / CEIL_OP — floor/ceil a number */
export const FLOOR_OP = Schema.TaggedStruct("FLOOR_OP", {})
export const CEIL_OP = Schema.TaggedStruct("CEIL_OP", {})

/** Math functions (unary) */
export const SQRT_OP = Schema.TaggedStruct("SQRT_OP", {})
export const SIGN_OP = Schema.TaggedStruct("SIGN_OP", {})
export const LOG_OP = Schema.TaggedStruct("LOG_OP", {})
export const LOG10_OP = Schema.TaggedStruct("LOG10_OP", {})

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
  EQ, LT, GT, GTE, LTE, NEQ, NOT, IF, IFERROR,
  AND_N, OR_N, CHOOSE_N,
  LEN_OP, LEFT_OP, RIGHT_OP, MID_OP, TRIM_OP, UPPER_OP, LOWER_OP, SUBSTITUTE_OP,
  PRODUCT_DYN, PRODUCT_N, NOW_OP, RAND_OP, PI_OP,
  SUM_N, MIN_N, MAX_N, AVG_N,
  SUM_DYN, MIN_DYN, MAX_DYN, AVG_DYN, COUNT_DYN, POWER,
  ROUND, FLOOR_OP, CEIL_OP, SQRT_OP, SIGN_OP, LOG_OP, LOG10_OP,
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
// ── Dispatch helpers ────────────────────────────────────

/** Binary operator: pop 2, apply fn, push result */
const binop = (
  s: VMValue[], fn: (a: VMValue, b: VMValue) => VMValue, name: string,
): VMValue | undefined => {
  if (s.length < 2) { const e = vmError("STACK_UNDERFLOW", `${name} requires 2 operands`); s.push(e); return e }
  const b = s.pop()!; const a = s.pop()!; const v = fn(a, b); s.push(v); return v
}

/** Unary operator: pop 1, apply fn, push result */
const unop = (
  s: VMValue[], fn: (a: VMValue) => VMValue, name: string,
): VMValue | undefined => {
  if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", `${name} requires 1 operand`); s.push(e); return e }
  const a = s.pop()!; const v = fn(a); s.push(v); return v
}

/** Pop N values, check errors, run reducer */
const aggregateN = (
  s: VMValue[], n: number, reduce: (vals: VMValue[]) => VMValue, name: string,
): VMValue | undefined => {
  if (s.length < n) { const e = vmError("STACK_UNDERFLOW", `${name} requires ${n} operands`); s.push(e); return e }
  const values: VMValue[] = []; for (let i = 0; i < n; i++) values.push(s.pop()!)
  const firstErr = values.find(isVMError)
  if (firstErr) { s.push(firstErr); return firstErr }
  const r = reduce(values); s.push(r); return r
}

/** Dynamic aggregate: pop count from stack, then aggregate */
const aggregateDyn = (
  s: VMValue[], reduce: (vals: VMValue[], n: number) => VMValue, name: string,
): VMValue | undefined => {
  if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", `${name} requires count on stack`); s.push(e); return e }
  const countVal = s.pop()!; const n = countVal._tag === "num" ? countVal.value : 0
  if (n <= 0 || s.length < n) { const e = vmError("STACK_UNDERFLOW", `${name} requires ${n} values`); s.push(e); return e }
  const values: VMValue[] = []; for (let i = 0; i < n; i++) values.push(s.pop()!)
  const firstErr = values.find(isVMError)
  if (firstErr) { s.push(firstErr); return firstErr }
  const r = reduce(values, n); s.push(r); return r
}

// ── Reducers ────────────────────────────────────────────

const sumReduce = (vals: VMValue[]) => { let t = 0; for (const v of vals) t += asNum(v); return num(t) }
const minReduce = (vals: VMValue[]) => { let m = asNum(vals[0]); for (let i = 1; i < vals.length; i++) { const v = asNum(vals[i]); if (v < m) m = v }; return num(m) }
const maxReduce = (vals: VMValue[]) => { let m = asNum(vals[0]); for (let i = 1; i < vals.length; i++) { const v = asNum(vals[i]); if (v > m) m = v }; return num(m) }
const avgReduce = (vals: VMValue[], n: number) => { let t = 0; for (const v of vals) t += asNum(v); return num(t / n) }

// ── Column index helpers (A=0, B=1, ..., Z=25, AA=26, AZ=51, ...) ──

/** Convert column letters to zero-based index: A→0, Z→25, AA→26, AZ→51 */
const colToIdx = (col: string): number => {
  let idx = 0
  for (let i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64)
  return idx - 1
}

/** Convert zero-based index to column letters: 0→A, 25→Z, 26→AA */
const idxToCol = (idx: number): string => {
  let s = ""
  let n = idx + 1
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}

// ── Flat dispatch table ────────────────────────────────
// Each entry: (op, stack, ctx) → { result?, halted? }

type ExecResult = { result?: VMValue; halted?: boolean }
type Executor = (op: Opcode, s: VMValue[], ctx: CellContext) => ExecResult

const EXEC: Record<string, Executor> = {
  // ── Push ──
  PUSH_NUM:  (o: any, s) => { const v = num(o.value); s.push(v); return { result: v } },
  PUSH_STR:  (o: any, s) => { const v = str(o.value); s.push(v); return { result: v } },
  PUSH_BOOL: (o: any, s) => { const v = bool(o.value); s.push(v); return { result: v } },

  // ── Arithmetic (binary) ──
  ADD:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? num(asNum(a) + asNum(b)) }, "ADD") }),
  SUB:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? num(asNum(a) - asNum(b)) }, "SUB") }),
  MUL:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? num(asNum(a) * asNum(b)) }, "MUL") }),
  DIV:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const bn = asNum(b); return bn === 0 ? vmError("DIV_ZERO", "Division by zero") : num(asNum(a) / bn) }, "DIV") }),
  MOD:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const bn = asNum(b); return bn === 0 ? vmError("DIV_ZERO", "Modulo by zero") : num(asNum(a) % bn) }, "MOD") }),
  POWER:(_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? num(Math.pow(asNum(a), asNum(b))) }, "POWER") }),
  ROUND:(_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const f = Math.pow(10, asNum(b)); return num(Math.round(asNum(a) * f) / f) }, "ROUND") }),

  // ── Comparison (binary) ──
  EQ:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(vmEq(a, b)) }, "EQ") }),
  LT:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(asNum(a) < asNum(b)) }, "LT") }),
  GT:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(asNum(a) > asNum(b)) }, "GT") }),
  GTE: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(asNum(a) >= asNum(b)) }, "GTE") }),
  LTE: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(asNum(a) <= asNum(b)) }, "LTE") }),
  NEQ: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? bool(!vmEq(a, b)) }, "NEQ") }),

  // ── String (binary) ──
  CONCAT: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); return pe ?? str(vmDisplay(a) + vmDisplay(b)) }, "CONCAT") }),

  // ── Unary ──
  NEG:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(-asNum(a)), "NEG") }),
  NOT:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(a._tag === "bool" ? !a.value : a._tag === "num" ? a.value === 0 : false), "NOT") }),
  ABS:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.abs(asNum(a))), "ABS") }),
  TO_NUM: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = toNumber(a); return n !== undefined ? num(n) : vmError("TYPE_MISMATCH", `Cannot convert ${a._tag} to number`) }, "TO_NUM") }),
  TO_STR: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a)), "TO_STR") }),
  FLOOR_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.floor(asNum(a))), "FLOOR") }),
  CEIL_OP:  (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.ceil(asNum(a))), "CEIL") }),
  SQRT_OP:  (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n < 0 ? vmError("TYPE_MISMATCH", "SQRT of negative") : num(Math.sqrt(n)) }, "SQRT") }),
  SIGN_OP:  (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.sign(asNum(a))), "SIGN") }),
  LOG_OP:   (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n <= 0 ? vmError("TYPE_MISMATCH", "LOG of non-positive") : num(Math.log(n)) }, "LOG") }),
  LOG10_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n <= 0 ? vmError("TYPE_MISMATCH", "LOG10 of non-positive") : num(Math.log10(n)) }, "LOG10") }),

  // ── Stack manipulation ──
  DUP: (_o, s) => {
    if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", "DUP requires 1 operand"); s.push(e); return { result: e } }
    const v = s[s.length - 1]; s.push(v); return { result: v }
  },
  SWAP: (_o, s) => {
    if (s.length < 2) { const e = vmError("STACK_UNDERFLOW", "SWAP requires 2 operands"); s.push(e); return { result: e } }
    const b = s.pop()!; const a = s.pop()!; s.push(b, a); return {}
  },
  DROP: (_o, s) => {
    if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", "DROP requires 1 operand"); s.push(e); return { result: e } }
    s.pop(); return {}
  },

  // ── Conditional ──
  IF: (_o, s) => {
    if (s.length < 3) { const e = vmError("STACK_UNDERFLOW", "IF requires 3 operands"); s.push(e); return { result: e } }
    const condition = s.pop()!; const trueVal = s.pop()!; const falseVal = s.pop()!
    const pe = propagateError(condition); if (pe) { s.push(pe); return { result: pe } }
    const isTruthy = condition._tag === "bool" ? condition.value : condition._tag === "num" ? condition.value !== 0 : true
    const v = isTruthy ? trueVal : falseVal; s.push(v); return { result: v }
  },
  IFERROR: (_o, s) => {
    if (s.length < 2) { const e = vmError("STACK_UNDERFLOW", "IFERROR requires 2 operands"); s.push(e); return { result: e } }
    const fallback = s.pop()!; const val = s.pop()!
    const v = isVMError(val) ? fallback : val; s.push(v); return { result: v }
  },
  // Function-call variants: args in infix order (cond, true_val, false_val from bottom to top)
  IF_FN: (_o, s) => {
    if (s.length < 3) { const e = vmError("STACK_UNDERFLOW", "IF requires 3 operands"); s.push(e); return { result: e } }
    const falseVal = s.pop()!; const trueVal = s.pop()!; const condition = s.pop()!
    const pe = propagateError(condition); if (pe) { s.push(pe); return { result: pe } }
    const isTruthy = condition._tag === "bool" ? condition.value : condition._tag === "num" ? condition.value !== 0 : true
    const v = isTruthy ? trueVal : falseVal; s.push(v); return { result: v }
  },
  IFERROR_FN: (_o, s) => {
    // Same as IFERROR — infix order is already correct (val, fallback)
    if (s.length < 2) { const e = vmError("STACK_UNDERFLOW", "IFERROR requires 2 operands"); s.push(e); return { result: e } }
    const fallback = s.pop()!; const val = s.pop()!
    const v = isVMError(val) ? fallback : val; s.push(v); return { result: v }
  },

  // ── Fixed-N aggregates ──
  SUM_N: (o: any, s) => ({ result: aggregateN(s, o.n, sumReduce, "SUM_N") }),
  MIN_N: (o: any, s) => ({ result: aggregateN(s, o.n, minReduce, "MIN_N") }),
  MAX_N: (o: any, s) => ({ result: aggregateN(s, o.n, maxReduce, "MAX_N") }),
  AVG_N: (o: any, s) => {
    if (o.n === 0) { const e = vmError("DIV_ZERO", "AVG_N with n=0"); s.push(e); return { result: e } }
    return { result: aggregateN(s, o.n, vals => avgReduce(vals, o.n), "AVG_N") }
  },

  // ── Dynamic aggregates (used with READ_RANGE) ──
  SUM_DYN:   (_o, s) => ({ result: aggregateDyn(s, (v) => sumReduce(v), "SUM_DYN") }),
  MIN_DYN:   (_o, s) => ({ result: aggregateDyn(s, (v) => minReduce(v), "MIN_DYN") }),
  MAX_DYN:   (_o, s) => ({ result: aggregateDyn(s, (v) => maxReduce(v), "MAX_DYN") }),
  AVG_DYN:   (_o, s) => ({ result: aggregateDyn(s, avgReduce, "AVG_DYN") }),
  COUNT_DYN: (_o, s) => {
    if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", "COUNT_DYN requires count on stack"); s.push(e); return { result: e } }
    const countVal = s.pop()!; const n = countVal._tag === "num" ? countVal.value : 0
    for (let i = 0; i < n && s.length > 0; i++) s.pop()
    const r = num(n); s.push(r); return { result: r }
  },

  // ── Cell I/O ──
  READ_CELL: (o: any, s, ctx) => { const v = ctx.readCell(o.addr); s.push(v); return { result: v } },
  WRITE_CELL: (o: any, s, ctx) => {
    if (s.length === 0) { const e = vmError("STACK_UNDERFLOW", "WRITE_CELL requires 1 operand"); s.push(e); return { result: e } }
    const v = s.pop()!; ctx.writeCell(o.addr, v); return { result: v }
  },
  READ_RANGE: (o: any, s, ctx) => {
    const { startCol, startRow, endCol, endRow } = o
    const loCol = Math.min(colToIdx(startCol), colToIdx(endCol))
    const hiCol = Math.max(colToIdx(startCol), colToIdx(endCol))
    const loRow = Math.min(startRow, endRow)
    const hiRow = Math.max(startRow, endRow)
    let count = 0
    for (let r = loRow; r <= hiRow; r++)
      for (let c = loCol; c <= hiCol; c++) { s.push(ctx.readCell(`${idxToCol(c)}${r}`)); count++ }
    const cv = num(count); s.push(cv); return { result: cv }
  },

  // ── String functions ──
  LEN_OP:   (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(vmDisplay(a).length), "LEN") }),
  LEFT_OP:  (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return str(vmDisplay(a).slice(0, asNum(b))) }, "LEFT") }),
  RIGHT_OP: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const s_ = vmDisplay(a); return str(s_.slice(Math.max(0, s_.length - asNum(b)))) }, "RIGHT") }),
  MID_OP:   (_o, s) => {
    if (s.length < 3) { const e = vmError("STACK_UNDERFLOW", "MID requires 3 operands"); s.push(e); return { result: e } }
    const len = s.pop()!; const start = s.pop()!; const val = s.pop()!
    const pe = propagateError(val, start, len); if (pe) { s.push(pe); return { result: pe } }
    const r = str(vmDisplay(val).substr(asNum(start) - 1, asNum(len))); s.push(r); return { result: r }
  },
  TRIM_OP:  (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).trim()), "TRIM") }),
  UPPER_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).toUpperCase()), "UPPER") }),
  LOWER_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).toLowerCase()), "LOWER") }),
  SUBSTITUTE_OP: (_o, s) => {
    if (s.length < 3) { const e = vmError("STACK_UNDERFLOW", "SUBSTITUTE requires 3 operands"); s.push(e); return { result: e } }
    const newStr = s.pop()!; const oldStr = s.pop()!; const text = s.pop()!
    const pe = propagateError(text, oldStr, newStr); if (pe) { s.push(pe); return { result: pe } }
    const r = str(vmDisplay(text).split(vmDisplay(oldStr)).join(vmDisplay(newStr))); s.push(r); return { result: r }
  },

  // ── Selection ──
  CHOOSE_N: (o: any, s) => {
    // Stack: [index, val1, val2, ..., valN] where N = o.n - 1 (first arg is index)
    const total = o.n // total args including index
    if (s.length < total) { const e = vmError("STACK_UNDERFLOW", `CHOOSE requires ${total} operands`); s.push(e); return { result: e } }
    const values: VMValue[] = []; for (let i = 0; i < total; i++) values.push(s.pop()!)
    values.reverse() // now [index, val1, val2, ...]
    const idx = values[0]; if (isVMError(idx)) { s.push(idx); return { result: idx } }
    const i = Math.round(asNum(idx))
    if (i < 1 || i >= total) {
      const e = vmError("TYPE_MISMATCH", `CHOOSE index ${i} out of range 1-${total - 1}`); s.push(e); return { result: e }
    }
    const v = values[i]; s.push(v); return { result: v }
  },

  // ── Logical N-ary ──
  AND_N: (o: any, s) => ({ result: aggregateN(s, o.n, vals => bool(vals.every(v => v._tag === "bool" ? v.value : v._tag === "num" ? v.value !== 0 : true)), "AND") }),
  OR_N:  (o: any, s) => ({ result: aggregateN(s, o.n, vals => bool(vals.some(v => v._tag === "bool" ? v.value : v._tag === "num" ? v.value !== 0 : true)), "OR") }),

  // ── Product aggregate ──
  PRODUCT_N: (o: any, s) => ({ result: aggregateN(s, o.n, vals => { let p = 1; for (const v of vals) p *= asNum(v); return num(p) }, "PRODUCT") }),
  PRODUCT_DYN: (_o, s) => ({ result: aggregateDyn(s, vals => { let p = 1; for (const v of vals) p *= asNum(v); return num(p) }, "PRODUCT") }),

  // ── Volatile / constants (zero-arg) ──
  NOW_OP:  (_o, s) => { const v = num(Date.now()); s.push(v); return { result: v } },
  RAND_OP: (_o, s) => { const v = num(Math.random()); s.push(v); return { result: v } },
  PI_OP:   (_o, s) => { const v = num(Math.PI); s.push(v); return { result: v } },

  // ── Control ──
  HALT: () => ({ halted: true }),
}

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
  const cellCtx = ctx ?? emptyCellContext

  // O(1) dispatch — single table lookup, no if-else chain
  const exec = EXEC[op._tag]
  const { result, halted } = exec ? exec(op as any, s, cellCtx) : {}

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
    halted: halted === true,
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

/**
 * Batched IR execution: read TxRef once, execute all opcodes on mutable copy, write back once.
 * This reduces TxRef get/set from 2N to 2 (N = number of opcodes).
 * Preserves transactional atomicity — entire batch succeeds or rolls back.
 */
export const runIRBatched = (
  ref: TxRef.TxRef<VMState>,
  ir: StackIR,
  ctx?: CellContext,
): Effect.Effect<VMState, never, Effect.Transaction> =>
  Effect.gen(function*() {
    const initial = yield* TxRef.get(ref)
    if (initial.halted) return initial

    const s = [...initial.stack]
    const trail = initial.trail as TrailEntry[]
    const cellCtx = ctx ?? emptyCellContext
    let step = initial.step
    let halted = false

    for (const op of ir) {
      if (halted) break
      if (step >= MAX_EVAL_STEPS) {
        s.push(vmError("EVAL_OVERFLOW", `Exceeded ${MAX_EVAL_STEPS} steps`))
        halted = true
        break
      }

      const depthBefore = s.length
      const exec = EXEC[op._tag]
      const r = exec ? exec(op as any, s, cellCtx) : {}

      trail.push({
        step,
        opcode: op._tag,
        stackDepthBefore: depthBefore,
        stackDepthAfter: s.length,
        result: r.result,
      })

      if (r.halted === true) halted = true
      step++
    }

    const finalState: VMState = {
      stack: s,
      registers: initial.registers,
      trail,
      step,
      halted,
    }
    yield* TxRef.set(ref, finalState)
    return finalState
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
// ── Interned opcode singletons (zero-alloc dispatch) ──
const _OP: Record<string, Opcode> = {
  ADD: { _tag: "ADD" }, SUB: { _tag: "SUB" }, MUL: { _tag: "MUL" },
  DIV: { _tag: "DIV" }, MOD: { _tag: "MOD" }, ABS: { _tag: "ABS" },
  CONCAT: { _tag: "CONCAT" }, TO_NUM: { _tag: "TO_NUM" }, TO_STR: { _tag: "TO_STR" },
  DUP: { _tag: "DUP" }, SWAP: { _tag: "SWAP" }, DROP: { _tag: "DROP" }, NEG: { _tag: "NEG" },
  EQ: { _tag: "EQ" }, LT: { _tag: "LT" }, GT: { _tag: "GT" },
  GTE: { _tag: "GTE" }, LTE: { _tag: "LTE" }, NEQ: { _tag: "NEQ" }, NOT: { _tag: "NOT" },
  IFERROR: { _tag: "IFERROR" }, IF: { _tag: "IF" },
  LEN_OP: { _tag: "LEN_OP" }, LEFT_OP: { _tag: "LEFT_OP" },
  RIGHT_OP: { _tag: "RIGHT_OP" }, MID_OP: { _tag: "MID_OP" },
  TRIM_OP: { _tag: "TRIM_OP" }, UPPER_OP: { _tag: "UPPER_OP" },
  LOWER_OP: { _tag: "LOWER_OP" }, SUBSTITUTE_OP: { _tag: "SUBSTITUTE_OP" },
  SQRT_OP: { _tag: "SQRT_OP" }, SIGN_OP: { _tag: "SIGN_OP" },
  LOG_OP: { _tag: "LOG_OP" }, LOG10_OP: { _tag: "LOG10_OP" },
  SUM_DYN: { _tag: "SUM_DYN" }, MIN_DYN: { _tag: "MIN_DYN" },
  MAX_DYN: { _tag: "MAX_DYN" }, AVG_DYN: { _tag: "AVG_DYN" },
  COUNT_DYN: { _tag: "COUNT_DYN" }, PRODUCT_DYN: { _tag: "PRODUCT_DYN" },
  POWER: { _tag: "POWER" }, ROUND: { _tag: "ROUND" },
  FLOOR_OP: { _tag: "FLOOR_OP" }, CEIL_OP: { _tag: "CEIL_OP" },
  NOW_OP: { _tag: "NOW_OP" }, RAND_OP: { _tag: "RAND_OP" }, PI_OP: { _tag: "PI_OP" },
  HALT: { _tag: "HALT" },
  IF_FN: { _tag: "IF_FN" } as any, IFERROR_FN: { _tag: "IFERROR_FN" } as any,
  PUSH_TRUE: { _tag: "PUSH_BOOL", value: true }, PUSH_FALSE: { _tag: "PUSH_BOOL", value: false },
} as any

function classifyToken(tok: string): Opcode | null {
  // 1. Numeric literal
  const n = Number(tok)
  if (!Number.isNaN(n)) return { _tag: "PUSH_NUM", value: n }

  // 2. Keywords — use interned singletons where possible
  switch (tok) {
    case "+": return _OP.ADD
    case "-": return _OP.SUB
    case "*": return _OP.MUL
    case "/": return _OP.DIV
    case "%": return _OP.MOD
    case "ABS": return _OP.ABS
    case "CONCAT": return _OP.CONCAT
    case "TO_NUM": return _OP.TO_NUM
    case "TO_STR": return _OP.TO_STR
    case "DUP": return _OP.DUP
    case "SWAP": return _OP.SWAP
    case "DROP": return _OP.DROP
    case "NEG": return _OP.NEG
    case "EQ": return _OP.EQ
    case "LT": return _OP.LT
    case "GT": return _OP.GT
    case "GTE": return _OP.GTE
    case "LTE": return _OP.LTE
    case "NEQ": return _OP.NEQ
    case "NOT": return _OP.NOT
    case "IFERROR": return _OP.IFERROR
    case "AND_N": return { _tag: "AND_N", n: 0 } as any
    case "OR_N": return { _tag: "OR_N", n: 0 } as any
    case "CHOOSE_N": return { _tag: "CHOOSE_N", n: 0 } as any
    case "LEN_OP": return _OP.LEN_OP
    case "LEFT_OP": return _OP.LEFT_OP
    case "RIGHT_OP": return _OP.RIGHT_OP
    case "MID_OP": return _OP.MID_OP
    case "TRIM_OP": return _OP.TRIM_OP
    case "UPPER_OP": return _OP.UPPER_OP
    case "LOWER_OP": return _OP.LOWER_OP
    case "SUBSTITUTE_OP": return _OP.SUBSTITUTE_OP
    case "SQRT_OP": return _OP.SQRT_OP
    case "SIGN_OP": return _OP.SIGN_OP
    case "LOG_OP": return _OP.LOG_OP
    case "LOG10_OP": return _OP.LOG10_OP
    case "PRODUCT_DYN": return _OP.PRODUCT_DYN
    case "PRODUCT_N": return { _tag: "PRODUCT_N", n: 0 } as any
    case "NOW_OP": return _OP.NOW_OP
    case "RAND_OP": return _OP.RAND_OP
    case "PI_OP": return _OP.PI_OP
    case "IF": return _OP.IF
    case "SUM_DYN": return _OP.SUM_DYN
    case "MIN_DYN": return _OP.MIN_DYN
    case "MAX_DYN": return _OP.MAX_DYN
    case "AVG_DYN": return _OP.AVG_DYN
    case "COUNT_DYN": return _OP.COUNT_DYN
    case "POWER": return _OP.POWER
    case "ROUND": return _OP.ROUND
    case "FLOOR": return _OP.FLOOR_OP
    case "CEIL": return _OP.CEIL_OP
    case "HALT": return _OP.HALT
    case "true": return _OP.PUSH_TRUE
    case "false": return _OP.PUSH_FALSE
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
      const loCol = Math.min(colToIdx(sc), colToIdx(ec))
      const hiCol = Math.max(colToIdx(sc), colToIdx(ec))
      const loRow = Math.min(parseInt(sr, 10), parseInt(er, 10))
      const hiRow = Math.max(parseInt(sr, 10), parseInt(er, 10))
      for (let r = loRow; r <= hiRow; r++)
        for (let c = loCol; c <= hiCol; c++) addDep(`${idxToCol(c)}${r}`)
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
  "<": 0, ">": 0, ">=": 0, "<=": 0, "!=": 0,  // comparison
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
  "<": "LT", ">": "GT", ">=": "GTE", "<=": "LTE", "!=": "NEQ", "^": "POWER",
}
const RIGHT_ASSOC = new Set<string>(["UNARY_NEG", "^"])
const ZERO_ARG_FNS = new Set(["NOW", "RAND", "PI"])
const ALWAYS_N_FNS = new Set(["AND_N", "OR_N", "CHOOSE_N"])
const N_VARIANTS: Record<string, string> = {
  SUM_DYN: "SUM_N", MIN_DYN: "MIN_N", MAX_DYN: "MAX_N", AVG_DYN: "AVG_N",
  PRODUCT_DYN: "PRODUCT_N",
  AND_N: "AND_N", OR_N: "OR_N", CHOOSE_N: "CHOOSE_N",
}
const FN_VARIANTS: Record<string, string> = { IF: "IF_FN", IFERROR: "IFERROR_FN" }

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
    // 2-char operators: >=, <=, !=, <>
    if (i + 1 < expr.length) {
      const two = ch + expr[i + 1]
      if (two === ">=" || two === "<=" || two === "!=" || two === "<>") {
        tokens.push(two === "<>" ? "!=" : two); i += 2; continue
      }
    }
    // Operators and parens
    if ("+-*/%(),:=<>&^!".includes(ch)) { tokens.push(ch); i++; continue }
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
  ROUND: "ROUND", FLOOR: "FLOOR", CEIL: "CEIL",
  SQRT: "SQRT_OP", SIGN: "SIGN_OP", LOG: "LOG_OP", LOG10: "LOG10_OP",
  ABS: "ABS", NEG: "NEG", IF: "IF", IFERROR: "IFERROR",
  AND: "AND_N", OR: "OR_N", CHOOSE: "CHOOSE_N",
  PRODUCT: "PRODUCT_DYN",
  NOW: "NOW_OP", RAND: "RAND_OP", PI: "PI_OP",
  CONCAT: "CONCAT", TO_NUM: "TO_NUM", TO_STR: "TO_STR",
  LEN: "LEN_OP", LEFT: "LEFT_OP", RIGHT: "RIGHT_OP", MID: "MID_OP",
  TRIM: "TRIM_OP", UPPER: "UPPER_OP", LOWER: "LOWER_OP", SUBSTITUTE: "SUBSTITUTE_OP",
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
    if (tok === "UNARY_NEG") { output.push(_OP.NEG); return }
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
    const tokUpper = tok.toUpperCase()
    if (tokUpper === "TRUE" || tokUpper === "FALSE") {
      output.push(tokUpper === "TRUE" ? _OP.PUSH_TRUE : _OP.PUSH_FALSE)
      prevWasOperand = true
      continue
    }

    // Unary minus: - at start, after operator, or after (
    if (tok === "-" && !prevWasOperand) {
      // Push as high-precedence unary: use sentinel
      opStack.push("UNARY_NEG")
      continue
    }

    // Zero-arg function: NOW(), RAND() — emit immediately and skip parens
    // ZERO_ARG_FNS hoisted to module level
    if (ZERO_ARG_FNS.has(tok) && i + 2 < tokens.length && tokens[i + 1] === "(" && tokens[i + 2] === ")") {
      const opcodeName = FUNC_MAP[tok]
      if (opcodeName) { const op = classifyToken(opcodeName); if (op) output.push(op) }
      i += 2 // skip ( and )
      prevWasOperand = true
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
        if (top === "UNARY_NEG") output.push(_OP.NEG)
        else pushOp(top)
      }
      if (opStack.length > 0 && opStack[opStack.length - 1] === "(") opStack.pop()
      // Check if top is a function
      if (opStack.length > 0 && opStack[opStack.length - 1].startsWith("FN:")) {
        const fnTok = opStack.pop()!
        const fnName = fnTok.slice(3)
        const nArgs = argCounts.pop() ?? 1
        const opcodeName = FUNC_MAP[fnName]
        if (opcodeName) {
          // For aggregate functions: if multiple args, use _N variant.
          // N_VARIANTS, FN_VARIANTS hoisted to module level
          const fnVariant = FN_VARIANTS[opcodeName]
          const nVariant = N_VARIANTS[opcodeName]
          // N-ary functions that always use _N variant regardless of arg count
          // ALWAYS_N_FNS hoisted to module level
          if (fnVariant) {
            output.push(_OP[fnVariant] ?? { _tag: fnVariant } as any)
          } else if (nVariant && (nArgs > 1 || ALWAYS_N_FNS.has(nVariant))) {
            output.push({ _tag: nVariant, n: nArgs } as any)
          } else {
            const op = classifyToken(opcodeName)
            if (op) output.push(op)
          }
        }
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
    if (top === "UNARY_NEG") { output.push(_OP.NEG); continue }
    pushOp(top)
  }

  return output
}

/**
 * Extract deps from an infix expression.
 * Handles both cell refs and ranges.
 */
/** Tags that mark a formula as volatile (must recalc every cycle) */
const VOLATILE_TAGS = new Set(["NOW_OP", "RAND_OP"])

/** Check if IR contains any volatile opcodes */
export const isVolatileIR = (ir: StackIR): boolean =>
  ir.some(op => VOLATILE_TAGS.has(op._tag))

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
      return yield* runIRBatched(ref, ir, ctx)
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
