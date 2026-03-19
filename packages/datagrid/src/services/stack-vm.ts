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
export const PROPER_OP = Schema.TaggedStruct("PROPER_OP", {})
export const CLEAN_OP = Schema.TaggedStruct("CLEAN_OP", {})
export const CHAR_OP = Schema.TaggedStruct("CHAR_OP", {})
export const CODE_OP = Schema.TaggedStruct("CODE_OP", {})
export const T_OP = Schema.TaggedStruct("T_OP", {})
export const ERROR_TYPE_OP = Schema.TaggedStruct("ERROR_TYPE_OP", {})
export const ISEVEN_OP = Schema.TaggedStruct("ISEVEN_OP", {})
export const ISODD_OP = Schema.TaggedStruct("ISODD_OP", {})
export const INT_OP = Schema.TaggedStruct("INT_OP", {})
export const EVEN_OP = Schema.TaggedStruct("EVEN_OP", {})
export const ODD_OP = Schema.TaggedStruct("ODD_OP", {})
export const TRUNC_OP = Schema.TaggedStruct("TRUNC_OP", {})
export const EXP_OP = Schema.TaggedStruct("EXP_OP", {})
export const LN_OP = Schema.TaggedStruct("LN_OP", {})
export const LOG2_OP = Schema.TaggedStruct("LOG2_OP", {})
export const RAND_BETWEEN = Schema.TaggedStruct("RAND_BETWEEN", {})
export const FIXED_OP = Schema.TaggedStruct("FIXED_OP", {})
export const DOLLAR_OP = Schema.TaggedStruct("DOLLAR_OP", {})
export const SIN_OP = Schema.TaggedStruct("SIN_OP", {})
export const COS_OP = Schema.TaggedStruct("COS_OP", {})
export const TAN_OP = Schema.TaggedStruct("TAN_OP", {})
export const ASIN_OP = Schema.TaggedStruct("ASIN_OP", {})
export const ACOS_OP = Schema.TaggedStruct("ACOS_OP", {})
export const ATAN_OP = Schema.TaggedStruct("ATAN_OP", {})
export const ATAN2_OP = Schema.TaggedStruct("ATAN2_OP", {})
export const RADIANS_OP = Schema.TaggedStruct("RADIANS_OP", {})
export const DEGREES_OP = Schema.TaggedStruct("DEGREES_OP", {})
export const SINH_OP = Schema.TaggedStruct("SINH_OP", {})
export const COSH_OP = Schema.TaggedStruct("COSH_OP", {})
export const TANH_OP = Schema.TaggedStruct("TANH_OP", {})
export const FACT_OP = Schema.TaggedStruct("FACT_OP", {})
export const QUOTIENT_OP = Schema.TaggedStruct("QUOTIENT_OP", {})
export const GCD_OP = Schema.TaggedStruct("GCD_OP", {})
export const LCM_OP = Schema.TaggedStruct("LCM_OP", {})
export const COMBIN_OP = Schema.TaggedStruct("COMBIN_OP", {})

/** SUBSTITUTE — find & replace: (text, old, new) → modified text */
export const SUBSTITUTE_OP = Schema.TaggedStruct("SUBSTITUTE_OP", {})

/** CHOOSE_N — pop index + N values, push value at index. =CHOOSE(2, "a", "b", "c") → "b" */
export const CHOOSE_N = Schema.TaggedStruct("CHOOSE_N", { n: Schema.Number })

/** AND_N / OR_N — logical N-ary: pop N booleans, push AND/OR */
export const AND_N = Schema.TaggedStruct("AND_N", { n: Schema.Number })
export const OR_N = Schema.TaggedStruct("OR_N", { n: Schema.Number })

/** Type predicates: ISNUM, ISTEXT, ISERROR, ISBLANK */
export const ISNUM_OP = Schema.TaggedStruct("ISNUM_OP", {})
export const ISTEXT_OP = Schema.TaggedStruct("ISTEXT_OP", {})
export const ISERROR_OP = Schema.TaggedStruct("ISERROR_OP", {})
export const ISBLANK_OP = Schema.TaggedStruct("ISBLANK_OP", {})

/** More text functions */
export const REPT_OP = Schema.TaggedStruct("REPT_OP", {})
export const EXACT_OP = Schema.TaggedStruct("EXACT_OP", {})
export const FIND_OP = Schema.TaggedStruct("FIND_OP", {})
export const COUNTIF_N = Schema.TaggedStruct("COUNTIF_N", { n: Schema.Number })
export const SUMIF_N = Schema.TaggedStruct("SUMIF_N", { n: Schema.Number })
export const SUMPRODUCT_N = Schema.TaggedStruct("SUMPRODUCT_N", { n: Schema.Number })
export const AVERAGEIF_N = Schema.TaggedStruct("AVERAGEIF_N", { n: Schema.Number })
export const LARGE_N = Schema.TaggedStruct("LARGE_N", { n: Schema.Number })
export const SMALL_N = Schema.TaggedStruct("SMALL_N", { n: Schema.Number })
export const STDEV_N = Schema.TaggedStruct("STDEV_N", { n: Schema.Number })
export const MEDIAN_N = Schema.TaggedStruct("MEDIAN_N", { n: Schema.Number })
export const RANK_N = Schema.TaggedStruct("RANK_N", { n: Schema.Number })
export const CONCATENATE_N = Schema.TaggedStruct("CONCATENATE_N", { n: Schema.Number })
export const TEXTJOIN_N = Schema.TaggedStruct("TEXTJOIN_N", { n: Schema.Number })
export const REPLACE_OP = Schema.TaggedStruct("REPLACE_OP", {})
export const SEARCH_OP = Schema.TaggedStruct("SEARCH_OP", {})

/** IFS — multi-condition branching */
export const IFS_N = Schema.TaggedStruct("IFS_N", { n: Schema.Number })

/** SWITCH — multi-way branching */
export const SWITCH_N = Schema.TaggedStruct("SWITCH_N", { n: Schema.Number })

/** Coercion */
export const VALUE_OP = Schema.TaggedStruct("VALUE_OP", {})
export const TYPE_OP = Schema.TaggedStruct("TYPE_OP", {})
export const N_OP = Schema.TaggedStruct("N_OP", {})

/** Date/Time extraction */
export const YEAR_OP = Schema.TaggedStruct("YEAR_OP", {})
export const MONTH_OP = Schema.TaggedStruct("MONTH_OP", {})
export const DAY_OP = Schema.TaggedStruct("DAY_OP", {})
export const HOUR_OP = Schema.TaggedStruct("HOUR_OP", {})
export const MINUTE_OP = Schema.TaggedStruct("MINUTE_OP", {})
export const SECOND_OP = Schema.TaggedStruct("SECOND_OP", {})
export const TODAY_OP = Schema.TaggedStruct("TODAY_OP", {})

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
  LEN_OP, LEFT_OP, RIGHT_OP, MID_OP, TRIM_OP, UPPER_OP, LOWER_OP, PROPER_OP, CLEAN_OP, CHAR_OP, CODE_OP, T_OP, ERROR_TYPE_OP, ISEVEN_OP, ISODD_OP,
  INT_OP, EVEN_OP, ODD_OP, TRUNC_OP, EXP_OP, LN_OP, LOG2_OP, RAND_BETWEEN, FIXED_OP, DOLLAR_OP,
  SINH_OP, COSH_OP, TANH_OP, SIN_OP, COS_OP, TAN_OP, ASIN_OP, ACOS_OP, ATAN_OP, ATAN2_OP, RADIANS_OP, DEGREES_OP,
  FACT_OP, QUOTIENT_OP, GCD_OP, LCM_OP, COMBIN_OP, SUBSTITUTE_OP,
  PRODUCT_DYN, PRODUCT_N,
  ISNUM_OP, ISTEXT_OP, ISERROR_OP, ISBLANK_OP,
  SUMPRODUCT_N, COUNTIF_N, SUMIF_N, AVERAGEIF_N, LARGE_N, SMALL_N, STDEV_N, MEDIAN_N, RANK_N, CONCATENATE_N, TEXTJOIN_N, REPT_OP, EXACT_OP, FIND_OP, REPLACE_OP, SEARCH_OP,
  IFS_N, SWITCH_N, VALUE_OP, TYPE_OP, N_OP,
  YEAR_OP, MONTH_OP, DAY_OP, HOUR_OP, MINUTE_OP, SECOND_OP, TODAY_OP,
  NOW_OP, RAND_OP, PI_OP,
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

/** Shared empty registers object (reused, never mutated) */
const _EMPTY_REGS: Record<string, VMValue> = {}

export const emptyState = (): VMState => ({
  stack: [],
  registers: _EMPTY_REGS,
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

/** Parse Excel criteria string into a predicate: ">5", "<=10", "<>0", "abc", "abc*" */
const parseCriteria = (raw: string): (v: VMValue) => boolean => {
  // Operator prefixes
  if (raw.startsWith(">=")) { const n = Number(raw.slice(2)); return v => asNum(v) >= n }
  if (raw.startsWith("<=")) { const n = Number(raw.slice(2)); return v => asNum(v) <= n }
  if (raw.startsWith("<>")) { const s = raw.slice(2); const n = Number(s); return isNaN(n) ? v => (v._tag === "str" ? v.value : vmDisplay(v)) !== s : v => asNum(v) !== n }
  if (raw.startsWith(">"))  { const n = Number(raw.slice(1)); return v => asNum(v) > n }
  if (raw.startsWith("<"))  { const n = Number(raw.slice(1)); return v => asNum(v) < n }
  if (raw.startsWith("="))  { const s = raw.slice(1); const n = Number(s); return isNaN(n) ? v => (v._tag === "str" ? v.value : vmDisplay(v)) === s : v => asNum(v) === n }
  // Wildcard suffix
  if (raw.endsWith("*"))    { const prefix = raw.slice(0, -1).toLowerCase(); return v => (v._tag === "str" ? v.value : vmDisplay(v)).toLowerCase().startsWith(prefix) }
  // Plain number or exact match
  const n = Number(raw)
  if (!isNaN(n)) return v => asNum(v) === n
  return v => (v._tag === "str" ? v.value : vmDisplay(v)).toLowerCase() === raw.toLowerCase()
}

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

  // ── Type predicates ──
  ISNUM_OP:   (_o, s) => ({ result: unop(s, a => bool(a._tag === "num"), "ISNUM") }),
  ISTEXT_OP:  (_o, s) => ({ result: unop(s, a => bool(a._tag === "str"), "ISTEXT") }),
  ISERROR_OP: (_o, s) => ({ result: unop(s, a => bool(isVMError(a)), "ISERROR") }),
  ISBLANK_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && a.value === ""), "ISBLANK") }),

  // ── Date/Time ──
  YEAR_OP:  (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getFullYear()) }, "YEAR") }),
  MONTH_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getMonth() + 1) }, "MONTH") }),
  DAY_OP:   (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getDate()) }, "DAY") }),
  HOUR_OP:  (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getHours()) }, "HOUR") }),
  MINUTE_OP:(_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getMinutes()) }, "MINUTE") }),
  SECOND_OP:(_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(new Date(asNum(a)).getSeconds()) }, "SECOND") }),
  // TODAY_OP = millisecond timestamp at midnight today
  TODAY_OP: (_o, s) => { const d = new Date(); d.setHours(0,0,0,0); s.push(num(d.getTime())); return { result: s[s.length-1] } },

  // ── Coercion ──
  VALUE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    if (a._tag === "num") return a
    const n = parseFloat(a._tag === "str" ? a.value : String((a as any).value))
    return isNaN(n) ? vmError("TYPE_MISMATCH", `VALUE: cannot convert "${vmDisplay(a)}" to number`) : num(n)
  }, "VALUE") }),
  // TYPE: returns type name as string
  TYPE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return str("error")
    switch (a._tag) {
      case "num": return str("number")
      case "str": return str("text")
      case "bool": return str("boolean")
      default: return str("unknown")
    }
  }, "TYPE") }),
  // IFS_N: multi-condition branching. Stack: [..., cond1, val1, cond2, val2, ...]
  IFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "IFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    if (n % 2 !== 0) { const err = vmError("TYPE_MISMATCH", "IFS: need even arg count"); s.push(err); return { result: err } }
    for (let i = 0; i < n; i += 2) {
      const cond = args[i]
      const val = args[i + 1]
      if (isVMError(cond)) { s.push(cond); return { result: cond } }
      const truthy = cond._tag === "bool" ? cond.value : cond._tag === "num" ? cond.value !== 0 : false
      if (truthy) { s.push(val); return { result: val } }
    }
    const err = vmError("TYPE_MISMATCH", "IFS: no condition met"); s.push(err); return { result: err }
  },

  // SWITCH_N: multi-way branching. Stack: [..., value, match1, result1, match2, result2, ..., default?]
  // n = total arg count (including value). If odd, last is default.
  SWITCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SWITCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const value = args[0]
    const pairs = args.slice(1)
    const hasDefault = pairs.length % 2 === 1
    const pairCount = Math.floor(pairs.length / 2)
    for (let i = 0; i < pairCount; i++) {
      const match = pairs[i * 2]
      const result = pairs[i * 2 + 1]
      if (value._tag === match._tag && (value as any).value === (match as any).value) {
        s.push(result); return { result }
      }
    }
    if (hasDefault) { const d = pairs[pairs.length - 1]; s.push(d); return { result: d } }
    const err = vmError("TYPE_MISMATCH", "SWITCH: no match"); s.push(err); return { result: err }
  },

  // REPT: repeat string N times
  REPT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = a._tag === "str" ? a.value : vmDisplay(a)
    const n = Math.max(0, Math.floor(asNum(b)))
    return n > 10000 ? vmError("EVAL_OVERFLOW", "REPT: too many repetitions") : str(text.repeat(n))
  }, "REPT") }),
  // EXACT: case-sensitive string equality (different from EQ which coerces)
  EXACT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(vmDisplay(a) === vmDisplay(b))
  }, "EXACT") }),
  // FIND: find substring position (case-sensitive, 1-based)
  FIND_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const needle = a._tag === "str" ? a.value : vmDisplay(a)
    const haystack = b._tag === "str" ? b.value : vmDisplay(b)
    const pos = haystack.indexOf(needle)
    return pos === -1 ? vmError("TYPE_MISMATCH", "FIND: not found") : num(pos + 1)
  }, "FIND") }),

  // REPLACE: replace substring by position (1-based start)
  REPLACE_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "REPLACE")); return { result: s[s.length-1] } }
    const newText = s.pop()!
    const len = s.pop()!
    const start = s.pop()!
    const text = s.pop()!
    if (isVMError(text) || isVMError(start) || isVMError(len) || isVMError(newText)) {
      const err = propagateError(text, start) ?? propagateError(len, newText)!
      s.push(err); return { result: err }
    }
    const t = text._tag === "str" ? text.value : vmDisplay(text)
    const si = Math.max(0, asNum(start) - 1)
    const l = Math.max(0, Math.floor(asNum(len)))
    const nt = newText._tag === "str" ? newText.value : vmDisplay(newText)
    const result = str(t.substring(0, si) + nt + t.substring(si + l))
    s.push(result); return { result }
  },
  // --- Criteria parsing for COUNTIF/SUMIF ---
  // Criteria: ">5", "<=10", "<>0", "abc", "abc*" (wildcard suffix), "=5", plain number
  // Returns a predicate (VMValue) => boolean

  // COUNTIF_N: count values matching criteria. Stack: [criteria, v1, v2, ..., vN]
  COUNTIF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTIF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    const values = args.slice(1)
    let count = 0
    for (const v of values) { if (pred(v)) count++ }
    const result = num(count)
    s.push(result); return { result }
  },

  // SUMIF_N: sum values matching criteria. Stack: [criteria, v1, v2, ..., vN]
  SUMIF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SUMIF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    const values = args.slice(1)
    let total = 0
    for (const v of values) { if (pred(v)) total += asNum(v) }
    const result = num(total)
    s.push(result); return { result }
  },

  // SUMPRODUCT_N: pairwise multiply + sum. Stack: [N/2 pairs: a1,b1,a2,b2,...aN,bN]
  // n = total args, must be even. Pairs are (a_i * b_i) summed.
  SUMPRODUCT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SUMPRODUCT")); return { result: s[s.length-1] } }
    if (n % 2 !== 0) { const err = vmError("TYPE_MISMATCH", "SUMPRODUCT: need even # of args"); s.push(err); return { result: err } }
    const args = s.splice(s.length - n, n)
    let total = 0
    const half = n / 2
    for (let i = 0; i < half; i++) {
      total += asNum(args[i]) * asNum(args[half + i])
    }
    const result = num(total); s.push(result); return { result }
  },

  // AVERAGEIF_N: average values matching criteria. Stack: [criteria, v1, ..., vN]
  AVERAGEIF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AVERAGEIF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    const values = args.slice(1)
    let total = 0, count = 0
    for (const v of values) { if (pred(v)) { total += asNum(v); count++ } }
    if (count === 0) { const err = vmError("DIV_ZERO", "AVERAGEIF: no matches"); s.push(err); return { result: err } }
    const result = num(total / count)
    s.push(result); return { result }
  },

  // LARGE: k-th largest value. Stack: [k, v1, v2, ..., vN]
  LARGE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LARGE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = Math.round(asNum(args[0]))
    const nums = args.slice(1).filter(v => !isVMError(v)).map(asNum).sort((a, b) => b - a)
    if (k < 1 || k > nums.length) { const err = vmError("TYPE_MISMATCH", `LARGE: k=${k} out of range`); s.push(err); return { result: err } }
    const result = num(nums[k - 1])
    s.push(result); return { result }
  },

  // SMALL: k-th smallest value. Stack: [k, v1, v2, ..., vN]
  SMALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SMALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = Math.round(asNum(args[0]))
    const nums = args.slice(1).filter(v => !isVMError(v)).map(asNum).sort((a, b) => a - b)
    if (k < 1 || k > nums.length) { const err = vmError("TYPE_MISMATCH", `SMALL: k=${k} out of range`); s.push(err); return { result: err } }
    const result = num(nums[k - 1])
    s.push(result); return { result }
  },

  // STDEV_N: sample standard deviation of N values
  STDEV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "STDEV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.length < 2) { const err = vmError("TYPE_MISMATCH", "STDEV: need ≥2 values"); s.push(err); return { result: err } }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1)
    const result = num(Math.sqrt(variance))
    s.push(result); return { result }
  },

  // MEDIAN_N: median of N values
  MEDIAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MEDIAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum).sort((a, b) => a - b)
    if (nums.length === 0) { const err = vmError("TYPE_MISMATCH", "MEDIAN: empty"); s.push(err); return { result: err } }
    const mid = Math.floor(nums.length / 2)
    const result = nums.length % 2 !== 0 ? num(nums[mid]) : num((nums[mid - 1] + nums[mid]) / 2)
    s.push(result); return { result }
  },

  // RANK_N: rank a value within a set. Args: [value, v1, v2, ..., vN]
  // Returns 1-based rank (descending by default). Ties get same rank.
  RANK_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANK")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const value = args[0]
    if (isVMError(value)) { s.push(value); return { result: value } }
    const target = asNum(value)
    const values = args.slice(1).filter(v => !isVMError(v)).map(asNum)
    let rank = 1
    for (const v of values) { if (v > target) rank++ }
    const result = num(rank)
    s.push(result); return { result }
  },

  // CONCATENATE_N: join N strings (no delimiter — legacy Excel CONCATENATE)
  CONCATENATE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CONCATENATE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = str(args.map(v => v._tag === "str" ? v.value : vmDisplay(v)).join(""))
    s.push(result); return { result }
  },

  // TEXTJOIN_N: join N values with delimiter. Stack: [delim, ignoreEmpty, v1, v2, ..., vN]
  // n = total arg count (delim + ignoreEmpty + N values)
  TEXTJOIN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TEXTJOIN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const delim = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const ignoreEmpty = args[1]._tag === "bool" ? args[1].value : asNum(args[1]) !== 0
    const values = args.slice(2)
    const parts = values
      .map(v => v._tag === "str" ? v.value : vmDisplay(v))
      .filter(v => !ignoreEmpty || v !== "")
    const result = str(parts.join(delim))
    s.push(result); return { result }
  },

  // SEARCH: case-insensitive find (1-based)
  SEARCH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const needle = (a._tag === "str" ? a.value : vmDisplay(a)).toLowerCase()
    const haystack = (b._tag === "str" ? b.value : vmDisplay(b)).toLowerCase()
    const pos = haystack.indexOf(needle)
    return pos === -1 ? vmError("TYPE_MISMATCH", "SEARCH: not found") : num(pos + 1)
  }, "SEARCH") }),

  // N: converts any value to number (Excel N function)
  N_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    if (a._tag === "num") return a
    if (a._tag === "bool") return num(a.value ? 1 : 0)
    return num(0) // text → 0
  }, "N") }),

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
  PROPER_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())), "PROPER") }),
  CLEAN_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).replace(/[\x00-\x1F\x7F]/g, "")), "CLEAN") }),
  CHAR_OP:  (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = Math.round(asNum(a)); return n < 1 || n > 65535 ? vmError("TYPE_MISMATCH", `CHAR: ${n} out of range`) : str(String.fromCharCode(n)) }, "CHAR") }),
  CODE_OP:  (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const s2 = vmDisplay(a); return s2.length === 0 ? vmError("TYPE_MISMATCH", "CODE: empty string") : num(s2.charCodeAt(0)) }, "CODE") }),
  T_OP:     (_o, s) => ({ result: unop(s, a => a._tag === "str" ? a : str(""), "T") }),  // Excel T(): returns text or ""
  ERROR_TYPE_OP: (_o, s) => ({ result: unop(s, a => {
    if (a._tag !== "error") return vmError("TYPE_MISMATCH", "ERROR.TYPE: not an error")
    const code = (a as any).code as string
    const map: Record<string, number> = { TYPE_MISMATCH: 3, REF_ERROR: 4, NAME_ERROR: 5, STACK_UNDERFLOW: 3, DIV_ZERO: 2, CIRCULAR_REF: 4 }
    return num(map[code] ?? 1)
  }, "ERROR.TYPE") }),
  ISEVEN_OP:  (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(Math.round(asNum(a)) % 2 === 0), "ISEVEN") }),
  ISODD_OP:   (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(Math.round(asNum(a)) % 2 !== 0), "ISODD") }),
  // Financial: INT (truncate to integer toward 0), TRUNC (truncate decimal places)
  INT_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.floor(asNum(a))), "INT") }),
  TRUNC_OP:  (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.trunc(asNum(a))), "TRUNC") }),
  EXP_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.exp(asNum(a))), "EXP") }),
  LN_OP:     (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n <= 0 ? vmError("TYPE_MISMATCH", "LN: non-positive") : num(Math.log(n)) }, "LN") }),
  LOG2_OP:   (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n <= 0 ? vmError("TYPE_MISMATCH", "LOG2: non-positive") : num(Math.log2(n)) }, "LOG2") }),
  RAND_BETWEEN: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "RANDBETWEEN")); return { result: s[s.length-1] } }
    const hi = Math.round(asNum(s.pop()!)), lo = Math.round(asNum(s.pop()!))
    const result = num(lo + Math.floor(Math.random() * (hi - lo + 1))); s.push(result); return { result }
  },
  FIXED_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "FIXED")); return { result: s[s.length-1] } }
    const decimals = Math.round(asNum(s.pop()!)), value = asNum(s.pop()!)
    const result = str(value.toFixed(Math.max(0, Math.min(decimals, 20)))); s.push(result); return { result }
  },
  DOLLAR_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DOLLAR")); return { result: s[s.length-1] } }
    const decimals = Math.round(asNum(s.pop()!)), value = asNum(s.pop()!)
    const result = str("$" + value.toFixed(Math.max(0, Math.min(decimals, 20)))); s.push(result); return { result }
  },
  // Hyperbolic trig
  SINH_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.sinh(asNum(a))), "SINH") }),
  COSH_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.cosh(asNum(a))), "COSH") }),
  TANH_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.tanh(asNum(a))), "TANH") }),
  // Trigonometry
  SIN_OP:     (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.sin(asNum(a))), "SIN") }),
  COS_OP:     (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.cos(asNum(a))), "COS") }),
  TAN_OP:     (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.tan(asNum(a))), "TAN") }),
  ASIN_OP:    (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n < -1 || n > 1 ? vmError("TYPE_MISMATCH", "ASIN: out of [-1,1]") : num(Math.asin(n)) }, "ASIN") }),
  ACOS_OP:    (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n < -1 || n > 1 ? vmError("TYPE_MISMATCH", "ACOS: out of [-1,1]") : num(Math.acos(n)) }, "ACOS") }),
  ATAN_OP:    (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.atan(asNum(a))), "ATAN") }),
  RADIANS_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(asNum(a) * Math.PI / 180), "RADIANS") }),
  DEGREES_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(asNum(a) * 180 / Math.PI), "DEGREES") }),
  ATAN2_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "ATAN2")); return { result: s[s.length-1] } }
    const x = asNum(s.pop()!), y = asNum(s.pop()!)
    const result = num(Math.atan2(y, x)); s.push(result); return { result }
  },
  FACT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 0) return vmError("TYPE_MISMATCH", "FACT: negative")
    if (n > 170) return vmError("TYPE_MISMATCH", "FACT: overflow >170")
    let r = 1; for (let i = 2; i <= n; i++) r *= i
    return num(r)
  }, "FACT") }),
  QUOTIENT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "QUOTIENT")); return { result: s[s.length-1] } }
    const b = asNum(s.pop()!), a = asNum(s.pop()!)
    if (b === 0) { const err = vmError("DIV_ZERO", "QUOTIENT /0"); s.push(err); return { result: err } }
    const result = num(Math.trunc(a / b)); s.push(result); return { result }
  },
  GCD_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "GCD")); return { result: s[s.length-1] } }
    let b = Math.abs(Math.round(asNum(s.pop()!))), a = Math.abs(Math.round(asNum(s.pop()!)))
    while (b) { const t = b; b = a % b; a = t }
    const result = num(a); s.push(result); return { result }
  },
  LCM_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "LCM")); return { result: s[s.length-1] } }
    const bv = Math.abs(Math.round(asNum(s.pop()!))), av = Math.abs(Math.round(asNum(s.pop()!)))
    if (av === 0 || bv === 0) { const result = num(0); s.push(result); return { result } }
    let a2 = av, b2 = bv
    while (b2) { const t = b2; b2 = a2 % b2; a2 = t }
    const result = num(av / a2 * bv); s.push(result); return { result }
  },
  COMBIN_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "COMBIN")); return { result: s[s.length-1] } }
    const k = Math.round(asNum(s.pop()!)), n = Math.round(asNum(s.pop()!))
    if (n < 0 || k < 0 || k > n) { const err = vmError("TYPE_MISMATCH", `COMBIN: invalid n=${n},k=${k}`); s.push(err); return { result: err } }
    let result = 1
    for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1)
    const r = num(Math.round(result)); s.push(r); return { result: r }
  },
  EVEN_OP:   (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return num(n >= 0 ? Math.ceil(n / 2) * 2 : Math.floor(n / 2) * 2) }, "EVEN") }),
  ODD_OP:    (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); const sign = n >= 0 ? 1 : -1; const abs = Math.abs(n); const ceil = Math.ceil(abs); const r = ceil % 2 === 0 ? ceil + 1 : ceil; return num(sign * r) }, "ODD") }),
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
  LOWER_OP: { _tag: "LOWER_OP" }, PROPER_OP: { _tag: "PROPER_OP" }, CLEAN_OP: { _tag: "CLEAN_OP" },
  CHAR_OP: { _tag: "CHAR_OP" }, CODE_OP: { _tag: "CODE_OP" }, T_OP: { _tag: "T_OP" }, ERROR_TYPE_OP: { _tag: "ERROR_TYPE_OP" },
  ISEVEN_OP: { _tag: "ISEVEN_OP" }, ISODD_OP: { _tag: "ISODD_OP" },
  INT_OP: { _tag: "INT_OP" }, EVEN_OP: { _tag: "EVEN_OP" }, ODD_OP: { _tag: "ODD_OP" },
  TRUNC_OP: { _tag: "TRUNC_OP" }, EXP_OP: { _tag: "EXP_OP" }, LN_OP: { _tag: "LN_OP" }, LOG2_OP: { _tag: "LOG2_OP" },
  RAND_BETWEEN: { _tag: "RAND_BETWEEN" }, FIXED_OP: { _tag: "FIXED_OP" }, DOLLAR_OP: { _tag: "DOLLAR_OP" },
  SIN_OP: { _tag: "SIN_OP" }, COS_OP: { _tag: "COS_OP" }, TAN_OP: { _tag: "TAN_OP" },
  ASIN_OP: { _tag: "ASIN_OP" }, ACOS_OP: { _tag: "ACOS_OP" }, ATAN_OP: { _tag: "ATAN_OP" }, ATAN2_OP: { _tag: "ATAN2_OP" },
  RADIANS_OP: { _tag: "RADIANS_OP" }, DEGREES_OP: { _tag: "DEGREES_OP" },
  SINH_OP: { _tag: "SINH_OP" }, COSH_OP: { _tag: "COSH_OP" }, TANH_OP: { _tag: "TANH_OP" },
  FACT_OP: { _tag: "FACT_OP" }, QUOTIENT_OP: { _tag: "QUOTIENT_OP" },
  GCD_OP: { _tag: "GCD_OP" }, LCM_OP: { _tag: "LCM_OP" }, COMBIN_OP: { _tag: "COMBIN_OP" }, SUBSTITUTE_OP: { _tag: "SUBSTITUTE_OP" },
  SQRT_OP: { _tag: "SQRT_OP" }, SIGN_OP: { _tag: "SIGN_OP" },
  LOG_OP: { _tag: "LOG_OP" }, LOG10_OP: { _tag: "LOG10_OP" },
  SUM_DYN: { _tag: "SUM_DYN" }, MIN_DYN: { _tag: "MIN_DYN" },
  MAX_DYN: { _tag: "MAX_DYN" }, AVG_DYN: { _tag: "AVG_DYN" },
  COUNT_DYN: { _tag: "COUNT_DYN" }, PRODUCT_DYN: { _tag: "PRODUCT_DYN" },
  POWER: { _tag: "POWER" }, ROUND: { _tag: "ROUND" },
  FLOOR_OP: { _tag: "FLOOR_OP" }, CEIL_OP: { _tag: "CEIL_OP" },
  ISNUM_OP: { _tag: "ISNUM_OP" }, ISTEXT_OP: { _tag: "ISTEXT_OP" },
  ISERROR_OP: { _tag: "ISERROR_OP" }, ISBLANK_OP: { _tag: "ISBLANK_OP" },
  REPT_OP: { _tag: "REPT_OP" }, EXACT_OP: { _tag: "EXACT_OP" }, FIND_OP: { _tag: "FIND_OP" },
  REPLACE_OP: { _tag: "REPLACE_OP" }, SEARCH_OP: { _tag: "SEARCH_OP" },
  VALUE_OP: { _tag: "VALUE_OP" }, TYPE_OP: { _tag: "TYPE_OP" }, N_OP: { _tag: "N_OP" },
  YEAR_OP: { _tag: "YEAR_OP" }, MONTH_OP: { _tag: "MONTH_OP" }, DAY_OP: { _tag: "DAY_OP" },
  HOUR_OP: { _tag: "HOUR_OP" }, MINUTE_OP: { _tag: "MINUTE_OP" }, SECOND_OP: { _tag: "SECOND_OP" },
  TODAY_OP: { _tag: "TODAY_OP" },
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
    case "PROPER_OP": return _OP.PROPER_OP
    case "CLEAN_OP": return _OP.CLEAN_OP
    case "CHAR_OP": return _OP.CHAR_OP
    case "CODE_OP": return _OP.CODE_OP
    case "T_OP": return _OP.T_OP
    case "ERROR_TYPE_OP": return _OP.ERROR_TYPE_OP
    case "ISEVEN_OP": return _OP.ISEVEN_OP
    case "ISODD_OP": return _OP.ISODD_OP
    case "INT_OP": return _OP.INT_OP
    case "EVEN_OP": return _OP.EVEN_OP
    case "ODD_OP": return _OP.ODD_OP
    case "TRUNC_OP": return _OP.TRUNC_OP
    case "SIN_OP": return _OP.SIN_OP
    case "COS_OP": return _OP.COS_OP
    case "TAN_OP": return _OP.TAN_OP
    case "ASIN_OP": return _OP.ASIN_OP
    case "ACOS_OP": return _OP.ACOS_OP
    case "ATAN_OP": return _OP.ATAN_OP
    case "ATAN2_OP": return _OP.ATAN2_OP
    case "RADIANS_OP": return _OP.RADIANS_OP
    case "DEGREES_OP": return _OP.DEGREES_OP
    case "SINH_OP": return _OP.SINH_OP
    case "COSH_OP": return _OP.COSH_OP
    case "TANH_OP": return _OP.TANH_OP
    case "EXP_OP": return _OP.EXP_OP
    case "LN_OP": return _OP.LN_OP
    case "LOG2_OP": return _OP.LOG2_OP
    case "RAND_BETWEEN": return _OP.RAND_BETWEEN
    case "FIXED_OP": return _OP.FIXED_OP
    case "DOLLAR_OP": return _OP.DOLLAR_OP
    case "FACT_OP": return _OP.FACT_OP
    case "QUOTIENT_OP": return _OP.QUOTIENT_OP
    case "GCD_OP": return _OP.GCD_OP
    case "LCM_OP": return _OP.LCM_OP
    case "COMBIN_OP": return _OP.COMBIN_OP
    case "SUBSTITUTE_OP": return _OP.SUBSTITUTE_OP
    case "ISNUM_OP": return _OP.ISNUM_OP
    case "ISTEXT_OP": return _OP.ISTEXT_OP
    case "ISERROR_OP": return _OP.ISERROR_OP
    case "ISBLANK_OP": return _OP.ISBLANK_OP
    case "SUMPRODUCT_N": return { _tag: "SUMPRODUCT_N", n: 0 } as any
    case "COUNTIF_N": return { _tag: "COUNTIF_N", n: 0 } as any
    case "SUMIF_N": return { _tag: "SUMIF_N", n: 0 } as any
    case "AVERAGEIF_N": return { _tag: "AVERAGEIF_N", n: 0 } as any
    case "LARGE_N": return { _tag: "LARGE_N", n: 0 } as any
    case "SMALL_N": return { _tag: "SMALL_N", n: 0 } as any
    case "STDEV_N": return { _tag: "STDEV_N", n: 0 } as any
    case "MEDIAN_N": return { _tag: "MEDIAN_N", n: 0 } as any
    case "RANK_N": return { _tag: "RANK_N", n: 0 } as any
    case "CONCATENATE_N": return { _tag: "CONCATENATE_N", n: 0 } as any
    case "TEXTJOIN_N": return { _tag: "TEXTJOIN_N", n: 0 } as any
    case "REPT_OP": return _OP.REPT_OP
    case "EXACT_OP": return _OP.EXACT_OP
    case "FIND_OP": return _OP.FIND_OP
    case "REPLACE_OP": return _OP.REPLACE_OP
    case "SEARCH_OP": return _OP.SEARCH_OP
    case "IFS_N": return { _tag: "IFS_N", n: 0 } as any
    case "SWITCH_N": return { _tag: "SWITCH_N", n: 0 } as any
    case "VALUE_OP": return _OP.VALUE_OP
    case "TYPE_OP": return _OP.TYPE_OP
    case "N_OP": return _OP.N_OP
    case "YEAR_OP": return _OP.YEAR_OP
    case "MONTH_OP": return _OP.MONTH_OP
    case "DAY_OP": return _OP.DAY_OP
    case "HOUR_OP": return _OP.HOUR_OP
    case "MINUTE_OP": return _OP.MINUTE_OP
    case "SECOND_OP": return _OP.SECOND_OP
    case "TODAY_OP": return _OP.TODAY_OP
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
  "=": 0, "<": 0, ">": 0, ">=": 0, "<=": 0, "!=": 0,  // comparison
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
  "=": "EQ", "<": "LT", ">": "GT", ">=": "GTE", "<=": "LTE", "!=": "NEQ", "^": "POWER",
}
const RIGHT_ASSOC = new Set<string>(["UNARY_NEG", "^"])
const ZERO_ARG_FNS = new Set(["NOW", "RAND", "PI", "TODAY"])
const ALWAYS_N_FNS = new Set(["AND_N", "OR_N", "CHOOSE_N", "SWITCH_N", "IFS_N", "SUMPRODUCT_N", "COUNTIF_N", "SUMIF_N", "AVERAGEIF_N", "LARGE_N", "SMALL_N", "STDEV_N", "MEDIAN_N", "RANK_N", "CONCATENATE_N", "TEXTJOIN_N"])
const N_VARIANTS: Record<string, string> = {
  SUM_DYN: "SUM_N", MIN_DYN: "MIN_N", MAX_DYN: "MAX_N", AVG_DYN: "AVG_N",
  PRODUCT_DYN: "PRODUCT_N",
  AND_N: "AND_N", OR_N: "OR_N", CHOOSE_N: "CHOOSE_N", SWITCH_N: "SWITCH_N", IFS_N: "IFS_N",
  SUMPRODUCT_N: "SUMPRODUCT_N", COUNTIF_N: "COUNTIF_N", SUMIF_N: "SUMIF_N", AVERAGEIF_N: "AVERAGEIF_N", LARGE_N: "LARGE_N", SMALL_N: "SMALL_N",
  STDEV_N: "STDEV_N", MEDIAN_N: "MEDIAN_N", RANK_N: "RANK_N", CONCATENATE_N: "CONCATENATE_N", TEXTJOIN_N: "TEXTJOIN_N",
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
  NOW: "NOW_OP", RAND: "RAND_OP", PI: "PI_OP", TODAY: "TODAY_OP",
  CONCAT: "CONCAT", TO_NUM: "TO_NUM", TO_STR: "TO_STR",
  LEN: "LEN_OP", LEFT: "LEFT_OP", RIGHT: "RIGHT_OP", MID: "MID_OP",
  TRIM: "TRIM_OP", UPPER: "UPPER_OP", LOWER: "LOWER_OP", PROPER: "PROPER_OP", CLEAN: "CLEAN_OP", CHAR: "CHAR_OP", CODE: "CODE_OP", T: "T_OP", ERRORTYPE: "ERROR_TYPE_OP",
  ISEVEN: "ISEVEN_OP", ISODD: "ISODD_OP", ISNUMBER: "ISNUM_OP",
  INT: "INT_OP", EVEN: "EVEN_OP", ODD: "ODD_OP", TRUNC: "TRUNC_OP", EXP: "EXP_OP", LN: "LN_OP", LOG2: "LOG2_OP",
  RANDBETWEEN: "RAND_BETWEEN", FIXED: "FIXED_OP", DOLLAR: "DOLLAR_OP",
  SINH: "SINH_OP", COSH: "COSH_OP", TANH: "TANH_OP",
  SIN: "SIN_OP", COS: "COS_OP", TAN: "TAN_OP", ASIN: "ASIN_OP", ACOS: "ACOS_OP", ATAN: "ATAN_OP", ATAN2: "ATAN2_OP", RADIANS: "RADIANS_OP", DEGREES: "DEGREES_OP",
  FACT: "FACT_OP", QUOTIENT: "QUOTIENT_OP", GCD: "GCD_OP", LCM: "LCM_OP", COMBIN: "COMBIN_OP", SUBSTITUTE: "SUBSTITUTE_OP",
  ISNUM: "ISNUM_OP", ISTEXT: "ISTEXT_OP", ISERROR: "ISERROR_OP", ISBLANK: "ISBLANK_OP",
  SUMPRODUCT: "SUMPRODUCT_N", COUNTIF: "COUNTIF_N", SUMIF: "SUMIF_N", AVERAGEIF: "AVERAGEIF_N", LARGE: "LARGE_N", SMALL: "SMALL_N",
  STDEV: "STDEV_N", MEDIAN: "MEDIAN_N", RANK: "RANK_N", CONCATENATE: "CONCATENATE_N", TEXTJOIN: "TEXTJOIN_N",
  REPT: "REPT_OP", EXACT: "EXACT_OP", FIND: "FIND_OP", REPLACE: "REPLACE_OP", SEARCH: "SEARCH_OP",
  IFS: "IFS_N", SWITCH: "SWITCH_N", VALUE: "VALUE_OP", TYPE: "TYPE_OP", N: "N_OP",
  YEAR: "YEAR_OP", MONTH: "MONTH_OP", DAY: "DAY_OP",
  HOUR: "HOUR_OP", MINUTE: "MINUTE_OP", SECOND: "SECOND_OP",
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

  return optimizeIR(output)
}

/**
 * Peephole optimizer: constant folding for pure binary ops on adjacent PUSH_NUM pairs.
 * Example: [PUSH_NUM(2), PUSH_NUM(3), ADD] → [PUSH_NUM(5)]
 */
const FOLDABLE = new Set(["ADD", "SUB", "MUL", "DIV", "MOD", "POWER", "EQ", "LT", "GT", "GTE", "LTE", "NEQ"])
function optimizeIR(ir: StackIR): StackIR {
  if (ir.length < 2) return ir
  const out: Opcode[] = []
  for (let i = 0; i < ir.length; i++) {
    const op = ir[i]
    // Constant folding: PUSH_NUM(a), PUSH_NUM(b), BinOp → PUSH_NUM(result)
    if (FOLDABLE.has(op._tag) && out.length >= 2) {
      const b = out[out.length - 1]
      const a = out[out.length - 2]
      if (a._tag === "PUSH_NUM" && b._tag === "PUSH_NUM") {
        const va = (a as any).value as number
        const vb = (b as any).value as number
        let result: number | boolean | null = null
        switch (op._tag) {
          case "ADD": result = va + vb; break
          case "SUB": result = va - vb; break
          case "MUL": result = va * vb; break
          case "DIV": if (vb !== 0) result = va / vb; break
          case "MOD": if (vb !== 0) result = va % vb; break
          case "POWER": result = va ** vb; break
          case "EQ": result = va === vb; break
          case "LT": result = va < vb; break
          case "GT": result = va > vb; break
          case "GTE": result = va >= vb; break
          case "LTE": result = va <= vb; break
          case "NEQ": result = va !== vb; break
        }
        if (result !== null) {
          out.pop(); out.pop()
          if (typeof result === "boolean") out.push(result ? _OP.PUSH_TRUE : _OP.PUSH_FALSE)
          else out.push({ _tag: "PUSH_NUM", value: result })
          continue
        }
      }
    }
    // Unary constant folding: PUSH_NUM(a), NEG → PUSH_NUM(-a)
    if (op._tag === "NEG" && out.length >= 1 && out[out.length - 1]._tag === "PUSH_NUM") {
      const a = out[out.length - 1] as any
      out.pop()
      out.push({ _tag: "PUSH_NUM", value: -a.value })
      continue
    }
    // Unary constant folding: PUSH_NUM(a), ABS → PUSH_NUM(abs(a))
    if (op._tag === "ABS" && out.length >= 1 && out[out.length - 1]._tag === "PUSH_NUM") {
      const a = out[out.length - 1] as any
      out.pop()
      out.push({ _tag: "PUSH_NUM", value: Math.abs(a.value) })
      continue
    }
    // Dead code: truncate after HALT
    if (op._tag === "HALT") { out.push(op); break }
    out.push(op)
  }
  return out
}

/**
 * Extract deps from an infix expression.
 * Handles both cell refs and ranges.
 */
/** Tags that mark a formula as volatile (must recalc every cycle) */
const VOLATILE_TAGS = new Set(["NOW_OP", "RAND_OP", "TODAY_OP", "RAND_BETWEEN"])

/** Formula function catalog for autocomplete/validation UX */
export interface FunctionSignature {
  readonly name: string
  readonly args: string
  readonly description: string
  readonly category: "math" | "stat" | "text" | "logic" | "lookup" | "info" | "volatile"
}

export const FUNCTION_CATALOG: ReadonlyArray<FunctionSignature> = [
  // Math
  { name: "ABS", args: "value", description: "Absolute value", category: "math" },
  { name: "SQRT", args: "value", description: "Square root", category: "math" },
  { name: "SIGN", args: "value", description: "Sign (-1, 0, or 1)", category: "math" },
  { name: "LOG", args: "value", description: "Natural logarithm", category: "math" },
  { name: "LOG10", args: "value", description: "Base-10 logarithm", category: "math" },
  { name: "POWER", args: "base, exponent", description: "Raise to power", category: "math" },
  { name: "ROUND", args: "value, decimals", description: "Round to N decimals", category: "math" },
  { name: "FLOOR", args: "value", description: "Round down", category: "math" },
  { name: "CEIL", args: "value", description: "Round up", category: "math" },
  { name: "MOD", args: "a, b", description: "Modulo (remainder)", category: "math" },
  { name: "PI", args: "", description: "Mathematical constant π", category: "math" },
  // Statistics / Aggregation
  { name: "SUM", args: "range | values...", description: "Sum of values", category: "stat" },
  { name: "AVG", args: "range | values...", description: "Average of values", category: "stat" },
  { name: "MIN", args: "range | values...", description: "Minimum value", category: "stat" },
  { name: "MAX", args: "range | values...", description: "Maximum value", category: "stat" },
  { name: "COUNT", args: "range", description: "Count of values", category: "stat" },
  { name: "PRODUCT", args: "values...", description: "Product of values", category: "stat" },
  // Text
  { name: "LEN", args: "text", description: "Length of string", category: "text" },
  { name: "LEFT", args: "text, n", description: "First N characters", category: "text" },
  { name: "RIGHT", args: "text, n", description: "Last N characters", category: "text" },
  { name: "MID", args: "text, start, length", description: "Substring (1-based start)", category: "text" },
  { name: "TRIM", args: "text", description: "Remove leading/trailing spaces", category: "text" },
  { name: "UPPER", args: "text", description: "Convert to uppercase", category: "text" },
  { name: "LOWER", args: "text", description: "Convert to lowercase", category: "text" },
  { name: "PROPER", args: "text", description: "Title case (capitalize first letter of each word)", category: "text" },
  { name: "CLEAN", args: "text", description: "Remove non-printable characters", category: "text" },
  { name: "CHAR", args: "number", description: "Character from code point", category: "text" },
  { name: "CODE", args: "text", description: "Code point of first character", category: "text" },
  { name: "T", args: "value", description: "Return text or empty string", category: "text" },
  { name: "ERRORTYPE", args: "error_value", description: "Numeric error type code", category: "info" },
  { name: "ISEVEN", args: "number", description: "TRUE if even", category: "info" },
  { name: "ISODD", args: "number", description: "TRUE if odd", category: "info" },
  { name: "ISNUMBER", args: "value", description: "Alias for ISNUM", category: "info" },
  { name: "INT", args: "number", description: "Truncate to integer (toward negative infinity)", category: "math" },
  { name: "EVEN", args: "number", description: "Round up to nearest even integer", category: "math" },
  { name: "ODD", args: "number", description: "Round up to nearest odd integer", category: "math" },
  { name: "TRUNC", args: "number", description: "Truncate toward zero", category: "math" },
  { name: "EXP", args: "number", description: "e raised to power", category: "math" },
  { name: "LN", args: "number", description: "Natural logarithm", category: "math" },
  { name: "LOG2", args: "number", description: "Base-2 logarithm", category: "math" },
  { name: "RANDBETWEEN", args: "low, high", description: "Random integer between bounds", category: "volatile" },
  { name: "FIXED", args: "number, decimals", description: "Format number with fixed decimals", category: "text" },
  { name: "DOLLAR", args: "number, decimals", description: "Format as currency string", category: "text" },
  { name: "SINH", args: "number", description: "Hyperbolic sine", category: "math" },
  { name: "COSH", args: "number", description: "Hyperbolic cosine", category: "math" },
  { name: "TANH", args: "number", description: "Hyperbolic tangent", category: "math" },
  { name: "SIN", args: "angle_rad", description: "Sine", category: "math" },
  { name: "COS", args: "angle_rad", description: "Cosine", category: "math" },
  { name: "TAN", args: "angle_rad", description: "Tangent", category: "math" },
  { name: "ASIN", args: "value", description: "Arcsine (radians)", category: "math" },
  { name: "ACOS", args: "value", description: "Arccosine (radians)", category: "math" },
  { name: "ATAN", args: "value", description: "Arctangent (radians)", category: "math" },
  { name: "ATAN2", args: "y, x", description: "Arctangent of y/x (radians)", category: "math" },
  { name: "RADIANS", args: "degrees", description: "Convert degrees to radians", category: "math" },
  { name: "DEGREES", args: "radians", description: "Convert radians to degrees", category: "math" },
  { name: "FACT", args: "number", description: "Factorial (n!)", category: "math" },
  { name: "QUOTIENT", args: "numerator, denominator", description: "Integer part of division", category: "math" },
  { name: "GCD", args: "a, b", description: "Greatest common divisor", category: "math" },
  { name: "LCM", args: "a, b", description: "Least common multiple", category: "math" },
  { name: "COMBIN", args: "n, k", description: "Combinations (n choose k)", category: "math" },
  { name: "SUBSTITUTE", args: "text, old, new", description: "Replace all occurrences", category: "text" },
  { name: "REPT", args: "text, count", description: "Repeat text N times", category: "text" },
  { name: "EXACT", args: "text1, text2", description: "Case-sensitive equality", category: "text" },
  { name: "FIND", args: "find_text, within_text", description: "Position of substring (1-based, case-sensitive)", category: "text" },
  { name: "SEARCH", args: "find_text, within_text", description: "Position of substring (1-based, case-insensitive)", category: "text" },
  { name: "REPLACE", args: "text, start, length, new_text", description: "Replace by position (1-based)", category: "text" },
  { name: "TEXTJOIN", args: "delimiter, ignore_empty, text1, text2, ...", description: "Join texts with delimiter", category: "text" },
  { name: "CONCAT", args: "a, b", description: "Join two strings", category: "text" },
  { name: "CONCATENATE", args: "text1, text2, ...", description: "Join N strings (legacy)", category: "text" },
  // Logic
  { name: "IF", args: "condition, true_val, false_val", description: "Conditional value", category: "logic" },
  { name: "IFERROR", args: "value, fallback", description: "Fallback on error", category: "logic" },
  { name: "AND", args: "values...", description: "All conditions true", category: "logic" },
  { name: "OR", args: "values...", description: "Any condition true", category: "logic" },
  { name: "NOT", args: "value", description: "Logical negation", category: "logic" },
  // Lookup / Ranking
  { name: "SUMPRODUCT", args: "a1,...aN, b1,...bN", description: "Sum of pairwise products", category: "math" },
  { name: "COUNTIF", args: "criteria, values...", description: "Count values matching criteria", category: "stat" },
  { name: "SUMIF", args: "criteria, values...", description: "Sum values matching criteria", category: "stat" },
  { name: "AVERAGEIF", args: "criteria, values...", description: "Average values matching criteria", category: "stat" },
  { name: "LARGE", args: "k, values...", description: "K-th largest value", category: "stat" },
  { name: "SMALL", args: "k, values...", description: "K-th smallest value", category: "stat" },
  { name: "STDEV", args: "values...", description: "Sample standard deviation", category: "stat" },
  { name: "MEDIAN", args: "values...", description: "Middle value (sorted)", category: "stat" },
  { name: "RANK", args: "value, values...", description: "Rank value (1=highest)", category: "stat" },
  { name: "CHOOSE", args: "index, values...", description: "Pick by 1-based index", category: "lookup" },
  // Branching
  { name: "IFS", args: "cond1, val1, cond2, val2, ...", description: "First true condition wins", category: "logic" },
  { name: "SWITCH", args: "value, match1, result1, ..., [default]", description: "Multi-way match (like nested IF)", category: "logic" },
  // Coercion
  { name: "VALUE", args: "text", description: "Convert text to number", category: "info" },
  { name: "TYPE", args: "value", description: "Return type name as text", category: "info" },
  { name: "N", args: "value", description: "Convert to number (TRUE=1, text=0)", category: "info" },
  // Date/Time
  { name: "YEAR", args: "timestamp", description: "Extract year from timestamp", category: "info" },
  { name: "MONTH", args: "timestamp", description: "Extract month (1-12) from timestamp", category: "info" },
  { name: "DAY", args: "timestamp", description: "Extract day of month from timestamp", category: "info" },
  { name: "HOUR", args: "timestamp", description: "Extract hour (0-23) from timestamp", category: "info" },
  { name: "MINUTE", args: "timestamp", description: "Extract minute (0-59) from timestamp", category: "info" },
  { name: "SECOND", args: "timestamp", description: "Extract second (0-59) from timestamp", category: "info" },
  { name: "TODAY", args: "", description: "Midnight timestamp of today (volatile)", category: "volatile" },
  // Info / Type predicates
  { name: "ISNUM", args: "value", description: "True if value is a number", category: "info" },
  { name: "ISTEXT", args: "value", description: "True if value is text", category: "info" },
  { name: "ISERROR", args: "value", description: "True if value is an error", category: "info" },
  { name: "ISBLANK", args: "value", description: "True if value is empty text", category: "info" },
  // Volatile
  { name: "NOW", args: "", description: "Current timestamp (ms)", category: "volatile" },
  { name: "RAND", args: "", description: "Random number 0..1", category: "volatile" },
]

/** Get function names matching a prefix (for autocomplete) */
export const completeFunctions = (prefix: string): ReadonlyArray<FunctionSignature> => {
  const p = prefix.toUpperCase()
  return FUNCTION_CATALOG.filter(f => f.name.startsWith(p))
}

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

/**
 * Direct eval — zero Effect overhead.
 * Runs StackIR on a plain JS array stack. No TxRef, no transaction, no generator.
 * Use for production recalc loops where transactional guarantees are not needed
 * (single-threaded, no contention).
 */
export const evalProgramDirect = (ir: StackIR, ctx?: CellContext): VMState => {
  const s: VMValue[] = []
  const cellCtx = ctx ?? emptyCellContext
  let step = 0
  let halted = false

  for (const op of ir) {
    if (halted) break
    if (step >= MAX_EVAL_STEPS) {
      s.push(vmError("EVAL_OVERFLOW", `Exceeded ${MAX_EVAL_STEPS} steps`))
      halted = true
      break
    }

    const exec = EXEC[op._tag]
    if (exec) {
      const r = exec(op as any, s, cellCtx)
      if (r.halted === true) halted = true
    }
    step++
  }

  return { stack: s, registers: {}, trail: [], step, halted }
}

/**
 * Decompile StackIR back to a readable formula string.
 * Useful for formula bar display and debugging.
 */
export const decompileIR = (ir: StackIR): string => {
  const stack: string[] = []
  const BIN: Record<string, string> = {
    ADD: "+", SUB: "-", MUL: "*", DIV: "/", MOD: "%",
    EQ: "=", LT: "<", GT: ">", GTE: ">=", LTE: "<=", NEQ: "!=",
    POWER: "^", CONCAT: "&",
  }
  const UNARY_FN: Record<string, string> = {
    ABS: "ABS", NEG: "-", NOT: "NOT", SQRT_OP: "SQRT", SIGN_OP: "SIGN",
    LOG_OP: "LOG", LOG10_OP: "LOG10", FLOOR_OP: "FLOOR", CEIL_OP: "CEIL",
    LEN_OP: "LEN", TRIM_OP: "TRIM", UPPER_OP: "UPPER", LOWER_OP: "LOWER", PROPER_OP: "PROPER", CLEAN_OP: "CLEAN", CHAR_OP: "CHAR", CODE_OP: "CODE", T_OP: "T", ERROR_TYPE_OP: "ERRORTYPE", ISEVEN_OP: "ISEVEN", ISODD_OP: "ISODD",
    INT_OP: "INT", EVEN_OP: "EVEN", ODD_OP: "ODD", TRUNC_OP: "TRUNC", EXP_OP: "EXP", LN_OP: "LN", LOG2_OP: "LOG2", FACT_OP: "FACT",
    SINH_OP: "SINH", COSH_OP: "COSH", TANH_OP: "TANH",
    SIN_OP: "SIN", COS_OP: "COS", TAN_OP: "TAN", ASIN_OP: "ASIN", ACOS_OP: "ACOS", ATAN_OP: "ATAN", RADIANS_OP: "RADIANS", DEGREES_OP: "DEGREES",
    ISNUM_OP: "ISNUM", ISTEXT_OP: "ISTEXT", ISERROR_OP: "ISERROR", ISBLANK_OP: "ISBLANK",
    YEAR_OP: "YEAR", MONTH_OP: "MONTH", DAY_OP: "DAY",
    HOUR_OP: "HOUR", MINUTE_OP: "MINUTE", SECOND_OP: "SECOND",
    VALUE_OP: "VALUE", TYPE_OP: "TYPE", N_OP: "N",
  }
  const BINARY_FN: Record<string, string> = {
    ROUND: "ROUND", LEFT_OP: "LEFT", RIGHT_OP: "RIGHT", REPT_OP: "REPT",
    EXACT_OP: "EXACT", FIND_OP: "FIND",
  }

  for (const op of ir) {
    if (op._tag === "PUSH_NUM") { stack.push(String((op as any).value)); continue }
    if (op._tag === "PUSH_STR") { stack.push(`"${(op as any).value}"`); continue }
    if (op._tag === "PUSH_BOOL") { stack.push((op as any).value ? "TRUE" : "FALSE"); continue }
    if (op._tag === "READ_CELL") { stack.push((op as any).addr); continue }
    if (op._tag === "NOW_OP") { stack.push("NOW()"); continue }
    if (op._tag === "RAND_OP") { stack.push("RAND()"); continue }
    if (op._tag === "PI_OP") { stack.push("PI()"); continue }
    if (op._tag === "TODAY_OP") { stack.push("TODAY()"); continue }
    if (op._tag === "HALT") break

    const binOp = BIN[op._tag]
    if (binOp) {
      const b = stack.pop() ?? "?"
      const a = stack.pop() ?? "?"
      stack.push(`(${a}${binOp}${b})`)
      continue
    }
    const unaryFn = UNARY_FN[op._tag]
    if (unaryFn) {
      const a = stack.pop() ?? "?"
      if (unaryFn === "-") stack.push(`(-${a})`)
      else stack.push(`${unaryFn}(${a})`)
      continue
    }
    const binaryFn = BINARY_FN[op._tag]
    if (binaryFn) {
      const b = stack.pop() ?? "?"
      const a = stack.pop() ?? "?"
      stack.push(`${binaryFn}(${a},${b})`)
      continue
    }
    if (op._tag === "MID_OP") {
      const c = stack.pop() ?? "?"; const b = stack.pop() ?? "?"; const a = stack.pop() ?? "?"
      stack.push(`MID(${a},${b},${c})`)
      continue
    }
    if (op._tag === "SUBSTITUTE_OP") {
      const c = stack.pop() ?? "?"; const b = stack.pop() ?? "?"; const a = stack.pop() ?? "?"
      stack.push(`SUBSTITUTE(${a},${b},${c})`)
      continue
    }
    if (op._tag === "REPLACE_OP") {
      const d = stack.pop() ?? "?"; const c = stack.pop() ?? "?"; const b = stack.pop() ?? "?"; const a = stack.pop() ?? "?"
      stack.push(`REPLACE(${a},${b},${c},${d})`)
      continue
    }
    if (op._tag === "IF" || op._tag === "IF_FN") {
      const c = stack.pop() ?? "?"; const b = stack.pop() ?? "?"; const a = stack.pop() ?? "?"
      stack.push(`IF(${a},${b},${c})`)
      continue
    }
    if (op._tag === "IFERROR" || op._tag === "IFERROR_FN") {
      const b = stack.pop() ?? "?"; const a = stack.pop() ?? "?"
      stack.push(`IFERROR(${a},${b})`)
      continue
    }
    // N-ary: SUM_N, AND_N, etc.
    const nTag = op._tag
    if (nTag.endsWith("_N") || nTag.endsWith("_DYN")) {
      const n = (op as any).n ?? (op as any).count
      if (typeof n === "number" && n > 0) {
        const args = []
        for (let i = 0; i < n; i++) args.unshift(stack.pop() ?? "?")
        const name = nTag.replace(/_N$|_DYN$/, "")
        stack.push(`${name}(${args.join(",")})`)
        continue
      }
    }
    // Fallback: opcode name
    stack.push(`[${op._tag}]`)
  }
  return stack.length === 1 ? `=${stack[0]}` : `=${stack.join(", ")}`
}

/**
 * Bulk eval — run multiple IR programs in a single Effect.transaction.
 * Amortizes transaction overhead across N evaluations.
 * Returns array of VMStates in same order as input IR array.
 */
export const evalProgramBulk = (
  programs: ReadonlyArray<{ ir: StackIR; ctx?: CellContext }>,
): Effect.Effect<ReadonlyArray<VMState>> =>
  Effect.transaction(
    Effect.gen(function*() {
      const results: VMState[] = []
      for (const { ir, ctx } of programs) {
        const ref = yield* TxRef.make(emptyState())
        const state = yield* runIRBatched(ref, ir, ctx)
        results.push(state)
      }
      return results
    })
  )

/** Map VM error codes to Excel-style display strings */
const ERROR_DISPLAY: Record<string, string> = {
  DIV_ZERO: "#DIV/0!",
  TYPE_MISMATCH: "#VALUE!",
  STACK_UNDERFLOW: "#VALUE!",
  CIRCULAR_REF: "#REF!",
  REF_ERROR: "#REF!",
  NAME_ERROR: "#NAME?",
  COMPILE_ERROR: "#NAME?",
  TIMEOUT: "#CALC!",
}
export const formatVMError = (v: VMValue): string | null => {
  if (v._tag !== "error") return null
  const code = (v as any).code as string
  return ERROR_DISPLAY[code] ?? `#ERROR!`
}

/** Format any VMValue for cell display (numbers, strings, bools, errors) */
export const formatCellValue = (v: VMValue): string => {
  const err = formatVMError(v)
  if (err) return err
  if (v._tag === "num") return String((v as any).value)
  if (v._tag === "str") return (v as any).value
  if (v._tag === "bool") return (v as any).value ? "TRUE" : "FALSE"
  if (v._tag === "blank") return ""
  return vmDisplay(v)
}

/** Analyze IR complexity for optimization decisions */
export interface IRMetrics {
  readonly opcodeCount: number
  readonly cellRefs: number
  readonly rangeRefs: number
  readonly functionCalls: number
  readonly maxStackDepth: number
  readonly volatile: boolean
  readonly constantFolded: boolean
}
export const analyzeIR = (ir: StackIR): IRMetrics => {
  let cellRefs = 0, rangeRefs = 0, functionCalls = 0, maxDepth = 0, depth = 0
  const fns = new Set(Object.values(FUNC_MAP))
  for (const op of ir) {
    if (op._tag === "READ_CELL") { cellRefs++; depth++ }
    else if (op._tag === "READ_RANGE") { rangeRefs++; depth++ }
    else if (op._tag.startsWith("PUSH_")) depth++
    else if (fns.has(op._tag) || op._tag.endsWith("_OP") || op._tag.endsWith("_N") || op._tag.endsWith("_DYN") || op._tag.endsWith("_FN")) {
      functionCalls++
      depth = Math.max(1, depth - 1) // rough estimate
    }
    else depth = Math.max(1, depth - 1)
    if (depth > maxDepth) maxDepth = depth
  }
  return {
    opcodeCount: ir.length,
    cellRefs,
    rangeRefs,
    functionCalls,
    maxStackDepth: maxDepth,
    volatile: isVolatileIR(ir),
    constantFolded: ir.length === 1 && ir[0]._tag.startsWith("PUSH_"),
  }
}

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
