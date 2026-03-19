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
export const ISLOGICAL_OP = Schema.TaggedStruct("ISLOGICAL_OP", {})
export const ISNONTEXT_OP = Schema.TaggedStruct("ISNONTEXT_OP", {})
export const ERROR_TYPE_OP = Schema.TaggedStruct("ERROR_TYPE_OP", {})
export const ISEVEN_OP = Schema.TaggedStruct("ISEVEN_OP", {})
export const ISODD_OP = Schema.TaggedStruct("ISODD_OP", {})
export const INT_OP = Schema.TaggedStruct("INT_OP", {})
export const SQRTPI_OP = Schema.TaggedStruct("SQRTPI_OP", {})
export const BASE_OP = Schema.TaggedStruct("BASE_OP", {})
export const DECIMAL_OP = Schema.TaggedStruct("DECIMAL_OP", {})
export const CEILING_MATH_OP = Schema.TaggedStruct("CEILING_MATH_OP", {})
export const FLOOR_MATH_OP = Schema.TaggedStruct("FLOOR_MATH_OP", {})
export const ROUNDUP_OP = Schema.TaggedStruct("ROUNDUP_OP", {})
export const ROUNDDOWN_OP = Schema.TaggedStruct("ROUNDDOWN_OP", {})
export const EVEN_OP = Schema.TaggedStruct("EVEN_OP", {})
export const ODD_OP = Schema.TaggedStruct("ODD_OP", {})
export const TRUNC_OP = Schema.TaggedStruct("TRUNC_OP", {})
export const EXP_OP = Schema.TaggedStruct("EXP_OP", {})
export const LN_OP = Schema.TaggedStruct("LN_OP", {})
export const LOG2_OP = Schema.TaggedStruct("LOG2_OP", {})
export const RAND_BETWEEN = Schema.TaggedStruct("RAND_BETWEEN", {})
export const FIXED_OP = Schema.TaggedStruct("FIXED_OP", {})
export const NPER_OP = Schema.TaggedStruct("NPER_OP", {})
export const PMT_OP = Schema.TaggedStruct("PMT_OP", {})
export const FV_OP = Schema.TaggedStruct("FV_OP", {})
export const PV_OP = Schema.TaggedStruct("PV_OP", {})
export const MROUND_OP = Schema.TaggedStruct("MROUND_OP", {})
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
export const ISNUMBER_OP = Schema.TaggedStruct("ISNUMBER_OP", {})
export const ISTEXT_OP = Schema.TaggedStruct("ISTEXT_OP", {})
export const N_OP = Schema.TaggedStruct("N_OP", {})
export const ISERROR_OP = Schema.TaggedStruct("ISERROR_OP", {})
export const ISBLANK_OP = Schema.TaggedStruct("ISBLANK_OP", {})

/** More text functions */
export const TINV_OP = Schema.TaggedStruct("TINV_OP", {})
export const CHISQ_INV_OP = Schema.TaggedStruct("CHISQ_INV_OP", {})
export const FINV_OP = Schema.TaggedStruct("FINV_OP", {})
export const GAMMALN_OP = Schema.TaggedStruct("GAMMALN_OP", {})
export const GAMMA_OP = Schema.TaggedStruct("GAMMA_OP", {})
export const CHISQ_DIST_OP = Schema.TaggedStruct("CHISQ_DIST_OP", {})
export const TDIST_OP = Schema.TaggedStruct("TDIST_OP", {})
export const FDIST_OP = Schema.TaggedStruct("FDIST_OP", {})
export const PHI_OP = Schema.TaggedStruct("PHI_OP", {})
export const GAUSS_OP = Schema.TaggedStruct("GAUSS_OP", {})
export const MIDB_OP = Schema.TaggedStruct("MIDB_OP", {})
export const DBCS_OP = Schema.TaggedStruct("DBCS_OP", {})
export const ASC_OP = Schema.TaggedStruct("ASC_OP", {})
export const CONCAT_WS_N = Schema.TaggedStruct("CONCAT_WS_N", { n: Schema.Number })
export const TEXTREVERSE_OP = Schema.TaggedStruct("TEXTREVERSE_OP", {})
export const FVSCHEDULE_N = Schema.TaggedStruct("FVSCHEDULE_N", { n: Schema.Number })
export const CUMIPMT_OP = Schema.TaggedStruct("CUMIPMT_OP", {})
export const COLUMNS_N = Schema.TaggedStruct("COLUMNS_N", { n: Schema.Number })
export const INDIRECT_OP = Schema.TaggedStruct("INDIRECT_OP", {})
export const OFFSET_OP = Schema.TaggedStruct("OFFSET_OP", {})
export const ZTEST_N = Schema.TaggedStruct("ZTEST_N", { n: Schema.Number })
export const COVARIANCE_S_N = Schema.TaggedStruct("COVARIANCE_S_N", { n: Schema.Number })
export const STDEV_S_N = Schema.TaggedStruct("STDEV_S_N", { n: Schema.Number })
export const TIMEVALUE_OP = Schema.TaggedStruct("TIMEVALUE_OP", {})
export const TIME_OP = Schema.TaggedStruct("TIME_OP", {})
export const SECOND_OP = Schema.TaggedStruct("SECOND_OP", {})
export const MINUTE_OP = Schema.TaggedStruct("MINUTE_OP", {})
export const HOUR_OP = Schema.TaggedStruct("HOUR_OP", {})
export const GROWTH_N = Schema.TaggedStruct("GROWTH_N", { n: Schema.Number })
export const TREND_N = Schema.TaggedStruct("TREND_N", { n: Schema.Number })
export const FREQUENCY_N = Schema.TaggedStruct("FREQUENCY_N", { n: Schema.Number })
export const PROB_N2 = Schema.TaggedStruct("PROB_N2", { n: Schema.Number })
export const LAMBDA_N = Schema.TaggedStruct("LAMBDA_N", { n: Schema.Number })
export const MAP_N = Schema.TaggedStruct("MAP_N", { n: Schema.Number })
export const REDUCE_N = Schema.TaggedStruct("REDUCE_N", { n: Schema.Number })
export const SCAN_N = Schema.TaggedStruct("SCAN_N", { n: Schema.Number })
export const BYROW_N = Schema.TaggedStruct("BYROW_N", { n: Schema.Number })
export const BYCOL_N = Schema.TaggedStruct("BYCOL_N", { n: Schema.Number })
export const LEFTB_OP = Schema.TaggedStruct("LEFTB_OP", {})
export const RIGHTB_OP = Schema.TaggedStruct("RIGHTB_OP", {})
export const LENB_OP = Schema.TaggedStruct("LENB_OP", {})
export const BAHTTEXT_OP = Schema.TaggedStruct("BAHTTEXT_OP", {})
export const PHONETIC_OP = Schema.TaggedStruct("PHONETIC_OP", {})
export const BESSELY_OP = Schema.TaggedStruct("BESSELY_OP", {})
export const HEX2BIN_OP = Schema.TaggedStruct("HEX2BIN_OP", {})
export const HEX2OCT_OP = Schema.TaggedStruct("HEX2OCT_OP", {})
export const OCT2BIN_OP = Schema.TaggedStruct("OCT2BIN_OP", {})
export const OCT2HEX_OP = Schema.TaggedStruct("OCT2HEX_OP", {})
export const IMTAN_OP = Schema.TaggedStruct("IMTAN_OP", {})
export const IMLOG2_OP = Schema.TaggedStruct("IMLOG2_OP", {})
export const IMLOG10_OP = Schema.TaggedStruct("IMLOG10_OP", {})
export const DPRODUCT_N = Schema.TaggedStruct("DPRODUCT_N", { n: Schema.Number })
export const RANDBETWEEN_FLOAT_OP = Schema.TaggedStruct("RANDBETWEEN_FLOAT_OP", {})
export const FORMULATEXT_OP = Schema.TaggedStruct("FORMULATEXT_OP", {})
export const ADDRESS_OP = Schema.TaggedStruct("ADDRESS_OP", {})
export const IMDIV_OP = Schema.TaggedStruct("IMDIV_OP", {})
export const IMSUB_OP = Schema.TaggedStruct("IMSUB_OP", {})
export const BIN2DEC_OP = Schema.TaggedStruct("BIN2DEC_OP", {})
export const DEC2BIN_OP = Schema.TaggedStruct("DEC2BIN_OP", {})
export const BIN2HEX_OP = Schema.TaggedStruct("BIN2HEX_OP", {})
export const HEX2DEC_OP = Schema.TaggedStruct("HEX2DEC_OP", {})
export const DEC2HEX_OP = Schema.TaggedStruct("DEC2HEX_OP", {})
export const OCT2DEC_OP = Schema.TaggedStruct("OCT2DEC_OP", {})
export const DEC2OCT_OP = Schema.TaggedStruct("DEC2OCT_OP", {})
export const BITAND_OP = Schema.TaggedStruct("BITAND_OP", {})
export const BITOR_OP = Schema.TaggedStruct("BITOR_OP", {})
export const BITXOR_OP = Schema.TaggedStruct("BITXOR_OP", {})
export const BITLSHIFT_OP = Schema.TaggedStruct("BITLSHIFT_OP", {})
export const BITRSHIFT_OP = Schema.TaggedStruct("BITRSHIFT_OP", {})
export const IMPOWER_OP = Schema.TaggedStruct("IMPOWER_OP", {})
export const IMEXP_OP = Schema.TaggedStruct("IMEXP_OP", {})
export const IMLN_OP = Schema.TaggedStruct("IMLN_OP", {})
export const IMSIN_OP = Schema.TaggedStruct("IMSIN_OP", {})
export const IMCOS_OP = Schema.TaggedStruct("IMCOS_OP", {})
export const IMSUM_OP = Schema.TaggedStruct("IMSUM_OP", {})
export const IMPRODUCT_OP = Schema.TaggedStruct("IMPRODUCT_OP", {})
export const IMARGUMENT_OP = Schema.TaggedStruct("IMARGUMENT_OP", {})
export const IMCONJUGATE_OP = Schema.TaggedStruct("IMCONJUGATE_OP", {})
export const IMSQRT_OP = Schema.TaggedStruct("IMSQRT_OP", {})
export const BESSELJ_OP = Schema.TaggedStruct("BESSELJ_OP", {})
export const COMPLEX_OP = Schema.TaggedStruct("COMPLEX_OP", {})
export const IMREAL_OP = Schema.TaggedStruct("IMREAL_OP", {})
export const IMAGINARY_OP = Schema.TaggedStruct("IMAGINARY_OP", {})
export const IMABS_OP = Schema.TaggedStruct("IMABS_OP", {})
export const TAKE_N = Schema.TaggedStruct("TAKE_N", { n: Schema.Number })
export const DROP_N = Schema.TaggedStruct("DROP_N", { n: Schema.Number })
export const HSTACK_N = Schema.TaggedStruct("HSTACK_N", { n: Schema.Number })
export const WRAPROWS_N = Schema.TaggedStruct("WRAPROWS_N", { n: Schema.Number })
export const ISFORMULA_OP = Schema.TaggedStruct("ISFORMULA_OP", {})
export const REGEXMATCH_OP = Schema.TaggedStruct("REGEXMATCH_OP", {})
export const REGEXEXTRACT_OP = Schema.TaggedStruct("REGEXEXTRACT_OP", {})
export const REGEXREPLACE_OP = Schema.TaggedStruct("REGEXREPLACE_OP", {})
export const LET_N = Schema.TaggedStruct("LET_N", { n: Schema.Number })
export const CHOOSECOLS_N = Schema.TaggedStruct("CHOOSECOLS_N", { n: Schema.Number })
export const SUMXMY2_N = Schema.TaggedStruct("SUMXMY2_N", { n: Schema.Number })
export const SUMX2PY2_N = Schema.TaggedStruct("SUMX2PY2_N", { n: Schema.Number })
export const SUMX2MY2_N = Schema.TaggedStruct("SUMX2MY2_N", { n: Schema.Number })
export const ERF_OP = Schema.TaggedStruct("ERF_OP", {})
export const ERFC_OP = Schema.TaggedStruct("ERFC_OP", {})
export const YEARFRAC_OP = Schema.TaggedStruct("YEARFRAC_OP", {})
export const COUPDAYBS_OP = Schema.TaggedStruct("COUPDAYBS_OP", {})
export const TBILLYIELD_OP = Schema.TaggedStruct("TBILLYIELD_OP", {})
export const RECEIVED_OP = Schema.TaggedStruct("RECEIVED_OP", {})
export const PRICEDISC_OP = Schema.TaggedStruct("PRICEDISC_OP", {})
export const MIRR_N = Schema.TaggedStruct("MIRR_N", { n: Schema.Number })
export const XNPV_N = Schema.TaggedStruct("XNPV_N", { n: Schema.Number })
export const ACCRINT_OP = Schema.TaggedStruct("ACCRINT_OP", {})
export const COUPDAYS_OP = Schema.TaggedStruct("COUPDAYS_OP", {})
export const DOLLARDE_OP = Schema.TaggedStruct("DOLLARDE_OP", {})
export const DOLLARFR_OP = Schema.TaggedStruct("DOLLARFR_OP", {})
export const SORT_N = Schema.TaggedStruct("SORT_N", { n: Schema.Number })
export const UNIQUE_N = Schema.TaggedStruct("UNIQUE_N", { n: Schema.Number })
export const FILTER_N = Schema.TaggedStruct("FILTER_N", { n: Schema.Number })
export const PPMT_OP = Schema.TaggedStruct("PPMT_OP", {})
export const IPMT_OP = Schema.TaggedStruct("IPMT_OP", {})
export const CELL_OP = Schema.TaggedStruct("CELL_OP", {})
export const ROWS_N = Schema.TaggedStruct("ROWS_N", { n: Schema.Number })
export const RANDARRAY_N = Schema.TaggedStruct("RANDARRAY_N", { n: Schema.Number })
export const SEQUENCE_N = Schema.TaggedStruct("SEQUENCE_N", { n: Schema.Number })
export const XMATCH_N = Schema.TaggedStruct("XMATCH_N", { n: Schema.Number })
export const CEILING_PRECISE_OP = Schema.TaggedStruct("CEILING_PRECISE_OP", {})
export const FLOOR_PRECISE_OP = Schema.TaggedStruct("FLOOR_PRECISE_OP", {})
export const AVERAGEA_N = Schema.TaggedStruct("AVERAGEA_N", { n: Schema.Number })
export const MAXA_N = Schema.TaggedStruct("MAXA_N", { n: Schema.Number })
export const MINA_N = Schema.TaggedStruct("MINA_N", { n: Schema.Number })
export const NEGBINOMDIST_OP = Schema.TaggedStruct("NEGBINOMDIST_OP", {})
export const BETADIST_OP = Schema.TaggedStruct("BETADIST_OP", {})
export const HYPGEOMDIST_OP = Schema.TaggedStruct("HYPGEOMDIST_OP", {})
export const ISNA_OP = Schema.TaggedStruct("ISNA_OP", {})
export const SHEET_OP = Schema.TaggedStruct("SHEET_OP", {})
export const TEXTSPLIT_N = Schema.TaggedStruct("TEXTSPLIT_N", { n: Schema.Number })
export const DATESTRING_OP = Schema.TaggedStruct("DATESTRING_OP", {})
export const WORKDAY_OP = Schema.TaggedStruct("WORKDAY_OP", {})
export const TEXTBEFORE_OP = Schema.TaggedStruct("TEXTBEFORE_OP", {})
export const TEXTAFTER_OP = Schema.TaggedStruct("TEXTAFTER_OP", {})
export const VALUETOTEXT_OP = Schema.TaggedStruct("VALUETOTEXT_OP", {})
export const ISPMT_OP = Schema.TaggedStruct("ISPMT_OP", {})
export const DISC_OP = Schema.TaggedStruct("DISC_OP", {})
export const INTRATE_OP = Schema.TaggedStruct("INTRATE_OP", {})
export const SYD_OP = Schema.TaggedStruct("SYD_OP", {})
export const EFFECT_OP = Schema.TaggedStruct("EFFECT_OP", {})
export const NOMINAL_OP = Schema.TaggedStruct("NOMINAL_OP", {})
export const NORMINV_OP = Schema.TaggedStruct("NORMINV_OP", {})
export const DDB_OP = Schema.TaggedStruct("DDB_OP", {})
export const PERCENTRANK_N = Schema.TaggedStruct("PERCENTRANK_N", { n: Schema.Number })
export const QUARTILE_N = Schema.TaggedStruct("QUARTILE_N", { n: Schema.Number })
export const WEIBULL_OP = Schema.TaggedStruct("WEIBULL_OP", {})
export const GAMMADIST_OP = Schema.TaggedStruct("GAMMADIST_OP", {})
export const EXPONDIST_OP = Schema.TaggedStruct("EXPONDIST_OP", {})
export const POISSON_OP = Schema.TaggedStruct("POISSON_OP", {})
export const BINOMDIST_OP = Schema.TaggedStruct("BINOMDIST_OP", {})
export const LOGNORMDIST_OP = Schema.TaggedStruct("LOGNORMDIST_OP", {})
export const STANDARDIZE_OP = Schema.TaggedStruct("STANDARDIZE_OP", {})
export const CONFIDENCE_OP = Schema.TaggedStruct("CONFIDENCE_OP", {})
export const NORMDIST_OP = Schema.TaggedStruct("NORMDIST_OP", {})
export const STEYX_N = Schema.TaggedStruct("STEYX_N", { n: Schema.Number })
export const FISHER_OP = Schema.TaggedStruct("FISHER_OP", {})
export const FISHERINV_OP = Schema.TaggedStruct("FISHERINV_OP", {})
export const KURT_N = Schema.TaggedStruct("KURT_N", { n: Schema.Number })
export const SKEW_N = Schema.TaggedStruct("SKEW_N", { n: Schema.Number })
export const CONVERT_OP = Schema.TaggedStruct("CONVERT_OP", {})
export const SLOPE_N = Schema.TaggedStruct("SLOPE_N", { n: Schema.Number })
export const INTERCEPT_N = Schema.TaggedStruct("INTERCEPT_N", { n: Schema.Number })
export const RSQ_N = Schema.TaggedStruct("RSQ_N", { n: Schema.Number })
export const COVAR_N = Schema.TaggedStruct("COVAR_N", { n: Schema.Number })
export const FORECAST_N = Schema.TaggedStruct("FORECAST_N", { n: Schema.Number })
export const STDEVP_N = Schema.TaggedStruct("STDEVP_N", { n: Schema.Number })
export const VARP_N = Schema.TaggedStruct("VARP_N", { n: Schema.Number })
export const CORREL_N = Schema.TaggedStruct("CORREL_N", { n: Schema.Number })
export const SUMSQ_N = Schema.TaggedStruct("SUMSQ_N", { n: Schema.Number })
export const DEVSQ_N = Schema.TaggedStruct("DEVSQ_N", { n: Schema.Number })
export const AVEDEV_N = Schema.TaggedStruct("AVEDEV_N", { n: Schema.Number })
export const TRIMMEAN_N = Schema.TaggedStruct("TRIMMEAN_N", { n: Schema.Number })
export const XOR_N = Schema.TaggedStruct("XOR_N", { n: Schema.Number })
export const ISOWEEKNUM_OP = Schema.TaggedStruct("ISOWEEKNUM_OP", {})
export const NETWORKDAYS_OP = Schema.TaggedStruct("NETWORKDAYS_OP", {})
export const SUBTOTAL_N = Schema.TaggedStruct("SUBTOTAL_N", { n: Schema.Number })
export const DELTA_OP = Schema.TaggedStruct("DELTA_OP", {})
export const GESTEP_OP = Schema.TaggedStruct("GESTEP_OP", {})
export const MULTINOMIAL_N = Schema.TaggedStruct("MULTINOMIAL_N", { n: Schema.Number })
export const SERIESSUM_N = Schema.TaggedStruct("SERIESSUM_N", { n: Schema.Number })
export const SEC_OP = Schema.TaggedStruct("SEC_OP", {})
export const CSC_OP = Schema.TaggedStruct("CSC_OP", {})
export const COTH_OP = Schema.TaggedStruct("COTH_OP", {})
export const SECH_OP = Schema.TaggedStruct("SECH_OP", {})
export const CSCH_OP = Schema.TaggedStruct("CSCH_OP", {})
export const SUMIFS_N = Schema.TaggedStruct("SUMIFS_N", { n: Schema.Number })
export const AVERAGEIFS_N = Schema.TaggedStruct("AVERAGEIFS_N", { n: Schema.Number })
export const NA_OP = Schema.TaggedStruct("NA_OP", {})
export const COT_OP = Schema.TaggedStruct("COT_OP", {})
export const ACOT_OP = Schema.TaggedStruct("ACOT_OP", {})
export const UNICODE_OP = Schema.TaggedStruct("UNICODE_OP", {})
export const UNICHAR_OP = Schema.TaggedStruct("UNICHAR_OP", {})
export const ENCODEURL_OP = Schema.TaggedStruct("ENCODEURL_OP", {})
export const DAYS_OP = Schema.TaggedStruct("DAYS_OP", {})
export const DATEVALUE_OP = Schema.TaggedStruct("DATEVALUE_OP", {})
export const EDATE_OP = Schema.TaggedStruct("EDATE_OP", {})
export const WEEKDAY_OP = Schema.TaggedStruct("WEEKDAY_OP", {})
export const WEEKNUM_OP = Schema.TaggedStruct("WEEKNUM_OP", {})
export const ROMAN_OP = Schema.TaggedStruct("ROMAN_OP", {})
export const ARABIC_OP = Schema.TaggedStruct("ARABIC_OP", {})
export const TEXT_OP = Schema.TaggedStruct("TEXT_OP", {})
export const NUMBERVALUE_OP = Schema.TaggedStruct("NUMBERVALUE_OP", {})
export const REPT_OP = Schema.TaggedStruct("REPT_OP", {})
export const EXACT_OP = Schema.TaggedStruct("EXACT_OP", {})
export const FIND_OP = Schema.TaggedStruct("FIND_OP", {})
export const COUNTIF_N = Schema.TaggedStruct("COUNTIF_N", { n: Schema.Number })
export const SUMIF_N = Schema.TaggedStruct("SUMIF_N", { n: Schema.Number })
export const IRR_N = Schema.TaggedStruct("IRR_N", { n: Schema.Number })
export const RATE_OP = Schema.TaggedStruct("RATE_OP", {})
export const DB_OP = Schema.TaggedStruct("DB_OP", {})
export const SLN_OP = Schema.TaggedStruct("SLN_OP", {})
export const NPV_N = Schema.TaggedStruct("NPV_N", { n: Schema.Number })
export const VAR_N = Schema.TaggedStruct("VAR_N", { n: Schema.Number })
export const PERCENTILE_N = Schema.TaggedStruct("PERCENTILE_N", { n: Schema.Number })
export const COUNTA_N = Schema.TaggedStruct("COUNTA_N", { n: Schema.Number })
export const COUNTBLANK_N = Schema.TaggedStruct("COUNTBLANK_N", { n: Schema.Number })
export const SUMPRODUCT_N = Schema.TaggedStruct("SUMPRODUCT_N", { n: Schema.Number })
export const IFNA_OP = Schema.TaggedStruct("IFNA_OP", {})
export const EOMONTH_OP = Schema.TaggedStruct("EOMONTH_OP", {})
export const DATEDIF_OP = Schema.TaggedStruct("DATEDIF_OP", {})
export const PERMUT_OP = Schema.TaggedStruct("PERMUT_OP", {})
export const FACTDOUBLE_OP = Schema.TaggedStruct("FACTDOUBLE_OP", {})
export const MATCH_N = Schema.TaggedStruct("MATCH_N", { n: Schema.Number })
export const INDEX_N = Schema.TaggedStruct("INDEX_N", { n: Schema.Number })
export const MODE_N = Schema.TaggedStruct("MODE_N", { n: Schema.Number })
export const HARMEAN_N = Schema.TaggedStruct("HARMEAN_N", { n: Schema.Number })
export const GEOMEAN_N = Schema.TaggedStruct("GEOMEAN_N", { n: Schema.Number })
export const AGGREGATE_N = Schema.TaggedStruct("AGGREGATE_N", { n: Schema.Number })
export const COUNTIFS_N = Schema.TaggedStruct("COUNTIFS_N", { n: Schema.Number })
export const MAXIFS_N = Schema.TaggedStruct("MAXIFS_N", { n: Schema.Number })
export const MINIFS_N = Schema.TaggedStruct("MINIFS_N", { n: Schema.Number })
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

/** Date/Time extraction */
export const YEAR_OP = Schema.TaggedStruct("YEAR_OP", {})
export const MONTH_OP = Schema.TaggedStruct("MONTH_OP", {})
export const DAY_OP = Schema.TaggedStruct("DAY_OP", {})
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
  LEN_OP, LEFT_OP, RIGHT_OP, MID_OP, TRIM_OP, UPPER_OP, LOWER_OP, PROPER_OP, CLEAN_OP, CHAR_OP, CODE_OP, T_OP, ISLOGICAL_OP, ISNONTEXT_OP, ERROR_TYPE_OP, ISEVEN_OP, ISODD_OP,
  INT_OP, SQRTPI_OP, BASE_OP, DECIMAL_OP, CEILING_MATH_OP, FLOOR_MATH_OP, ROUNDUP_OP, ROUNDDOWN_OP, EVEN_OP, ODD_OP, TRUNC_OP, EXP_OP, LN_OP, LOG2_OP, RAND_BETWEEN, RATE_OP, DB_OP, NPER_OP, SLN_OP, PMT_OP, FV_OP, PV_OP, MROUND_OP, FIXED_OP, DOLLAR_OP,
  SINH_OP, COSH_OP, TANH_OP, SIN_OP, COS_OP, TAN_OP, ASIN_OP, ACOS_OP, ATAN_OP, ATAN2_OP, RADIANS_OP, DEGREES_OP,
  FACT_OP, QUOTIENT_OP, GCD_OP, LCM_OP, COMBIN_OP, SUBSTITUTE_OP,
  PRODUCT_DYN, PRODUCT_N,
  ISNUM_OP, ISTEXT_OP, ISERROR_OP, ISBLANK_OP,
  IRR_N, NPV_N, VAR_N, PERCENTILE_N, COUNTA_N, COUNTBLANK_N, SUMPRODUCT_N, IFNA_OP, EOMONTH_OP, DATEDIF_OP, PERMUT_OP, FACTDOUBLE_OP, MATCH_N, INDEX_N, MODE_N, HARMEAN_N, GEOMEAN_N, AGGREGATE_N, COUNTIF_N, SUMIF_N, COUNTIFS_N, MAXIFS_N, MINIFS_N, AVERAGEIF_N, LARGE_N, SMALL_N, STDEV_N, MEDIAN_N, RANK_N, CONCATENATE_N, TEXTJOIN_N, ISNUMBER_OP, ISTEXT_OP, ISEVEN_OP, ISODD_OP, N_OP, T_OP, TINV_OP, CHISQ_INV_OP, FINV_OP, GAMMALN_OP, GAMMA_OP, CHISQ_DIST_OP, TDIST_OP, FDIST_OP, PHI_OP, GAUSS_OP, MIDB_OP, DBCS_OP, ASC_OP, CONCAT_WS_N, TEXTREVERSE_OP, FVSCHEDULE_N, CUMIPMT_OP, COLUMNS_N, INDIRECT_OP, OFFSET_OP, ZTEST_N, COVARIANCE_S_N, STDEV_S_N, TIMEVALUE_OP, TIME_OP, SECOND_OP, MINUTE_OP, HOUR_OP, GROWTH_N, TREND_N, FREQUENCY_N, PROB_N2, LAMBDA_N, MAP_N, REDUCE_N, SCAN_N, BYROW_N, BYCOL_N, LEFTB_OP, RIGHTB_OP, LENB_OP, BAHTTEXT_OP, PHONETIC_OP, BESSELY_OP, HEX2BIN_OP, HEX2OCT_OP, OCT2BIN_OP, OCT2HEX_OP, IMTAN_OP, IMLOG2_OP, IMLOG10_OP, DPRODUCT_N, RANDBETWEEN_FLOAT_OP, FORMULATEXT_OP, ADDRESS_OP, IMDIV_OP, IMSUB_OP, BIN2DEC_OP, DEC2BIN_OP, BIN2HEX_OP, HEX2DEC_OP, DEC2HEX_OP, OCT2DEC_OP, DEC2OCT_OP, BITAND_OP, BITOR_OP, BITXOR_OP, BITLSHIFT_OP, BITRSHIFT_OP, IMPOWER_OP, IMEXP_OP, IMLN_OP, IMSIN_OP, IMCOS_OP, IMSUM_OP, IMPRODUCT_OP, IMARGUMENT_OP, IMCONJUGATE_OP, IMSQRT_OP, BESSELJ_OP, COMPLEX_OP, IMREAL_OP, IMAGINARY_OP, IMABS_OP, TAKE_N, DROP_N, HSTACK_N, WRAPROWS_N, ISFORMULA_OP, REGEXMATCH_OP, REGEXEXTRACT_OP, REGEXREPLACE_OP, LET_N, CHOOSECOLS_N, SUMXMY2_N, SUMX2PY2_N, SUMX2MY2_N, ERF_OP, ERFC_OP, YEARFRAC_OP, COUPDAYBS_OP, TBILLYIELD_OP, RECEIVED_OP, PRICEDISC_OP, MIRR_N, XNPV_N, ACCRINT_OP, COUPDAYS_OP, DOLLARDE_OP, DOLLARFR_OP, SORT_N, UNIQUE_N, FILTER_N, PPMT_OP, IPMT_OP, CELL_OP, ROWS_N, RANDARRAY_N, SEQUENCE_N, XMATCH_N, CEILING_PRECISE_OP, FLOOR_PRECISE_OP, AVERAGEA_N, MAXA_N, MINA_N, NEGBINOMDIST_OP, BETADIST_OP, HYPGEOMDIST_OP, ISNA_OP, SHEET_OP, TEXTSPLIT_N, DATESTRING_OP, WORKDAY_OP, TEXTBEFORE_OP, TEXTAFTER_OP, VALUETOTEXT_OP, ISPMT_OP, DISC_OP, INTRATE_OP, SYD_OP, EFFECT_OP, NOMINAL_OP, NORMINV_OP, DDB_OP, PERCENTRANK_N, QUARTILE_N, WEIBULL_OP, GAMMADIST_OP, EXPONDIST_OP, POISSON_OP, BINOMDIST_OP, LOGNORMDIST_OP, STANDARDIZE_OP, CONFIDENCE_OP, NORMDIST_OP, STEYX_N, FISHER_OP, FISHERINV_OP, KURT_N, SKEW_N, CONVERT_OP, SLOPE_N, INTERCEPT_N, RSQ_N, COVAR_N, FORECAST_N, STDEVP_N, VARP_N, CORREL_N, SUMSQ_N, DEVSQ_N, AVEDEV_N, TRIMMEAN_N, XOR_N, ISOWEEKNUM_OP, NETWORKDAYS_OP, SUBTOTAL_N, DELTA_OP, GESTEP_OP, MULTINOMIAL_N, SERIESSUM_N, SEC_OP, CSC_OP, COTH_OP, SECH_OP, CSCH_OP, SUMIFS_N, AVERAGEIFS_N, NA_OP, COT_OP, ACOT_OP, UNICODE_OP, UNICHAR_OP, ENCODEURL_OP, DAYS_OP, DATEVALUE_OP, EDATE_OP, WEEKDAY_OP, WEEKNUM_OP, ROMAN_OP, ARABIC_OP, TEXT_OP, NUMBERVALUE_OP, REPT_OP, EXACT_OP, FIND_OP, REPLACE_OP, SEARCH_OP,
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

// Gamma function (Lanczos approximation) for distribution calculations
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  z -= 1
  const g = 7, c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

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

  // ROMAN_OP: convert number to Roman numerals
  ROMAN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.floor(asNum(a))
    if (n <= 0 || n > 3999) return vmError("TYPE_MISMATCH", `ROMAN: ${n} out of [1,3999]`)
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
    const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"]
    let result = ""
    for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { result += syms[i]; n -= vals[i] } }
    return str(result)
  }, "ROMAN") }),
  // PROB_N: probability that values are within limits. PROB(lower, upper, prob1, ..., probK, v1, ..., vK) n=2+2K
  // TINV_OP: inverse of Student's t-distribution. TINV(probability, df)
  // Simplified: uses Newton's method with normal approximation as starting point
  TINV_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "TINV")); return { result: s[s.length-1] } }
    const df = Math.round(asNum(s.pop()!)), p = asNum(s.pop()!)
    // Start with normal inverse approximation (Beasley-Springer-Moro)
    const a = p - 0.5
    const t2 = a < 0 ? p : 1 - p
    const s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    if (a < 0) z = -z
    const result = num(z * Math.sqrt(1 + z*z/(2*df))); s.push(result); return { result }
  },
  // CHISQ_INV_OP: inverse chi-squared. Simplified: uses Wilson-Hilferty approximation
  CHISQ_INV_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "CHISQ.INV")); return { result: s[s.length-1] } }
    const df = Math.round(asNum(s.pop()!)), p = asNum(s.pop()!)
    // Wilson-Hilferty: chi²_p ≈ df * (1 - 2/(9*df) + z_p * sqrt(2/(9*df)))^3
    const a = p - 0.5
    const t2 = a < 0 ? p : 1 - p
    const s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    if (a < 0) z = -z
    const cube = 1 - 2/(9*df) + z * Math.sqrt(2/(9*df))
    const result = num(df * cube * cube * cube); s.push(result); return { result }
  },
  // FINV_OP: inverse F-distribution. Simplified approximation.
  FINV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "FINV")); return { result: s[s.length-1] } }
    const df2 = Math.round(asNum(s.pop()!)), df1 = Math.round(asNum(s.pop()!)), p = asNum(s.pop()!)
    // Use chi-squared ratio approximation
    const a = p - 0.5, t2 = a < 0 ? p : 1 - p, s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    if (a < 0) z = -z
    const c1 = 1 - 2/(9*df1) + z * Math.sqrt(2/(9*df1))
    const c2 = 1 - 2/(9*df2) - z * Math.sqrt(2/(9*df2))
    const result = num(c2 === 0 ? 0 : (c1*c1*c1) / (c2*c2*c2)); s.push(result); return { result }
  },
  // GAMMALN_OP: log of gamma function
  GAMMALN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    return x > 0 ? num(Math.log(gamma(x))) : vmError("TYPE_MISMATCH", "GAMMALN: x must be > 0")
  }, "GAMMALN") }),
  // GAMMA_OP: gamma function
  GAMMA_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return num(gamma(asNum(a)))
  }, "GAMMA") }),
  // CHISQ_DIST_OP: chi-squared distribution CDF. CHISQ.DIST(x, df, cumulative)
  CHISQ_DIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CHISQ.DIST")); return { result: s[s.length-1] } }
    const cumul = asNum(s.pop()!), df = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (x < 0 || df < 1) { s.push(vmError("TYPE_MISMATCH", "CHISQ.DIST")); return { result: s[s.length-1] } }
    // Regularized incomplete gamma function approximation for CDF
    // P(a,x) where a = df/2, x = chi²/2
    const a = df / 2, z = x / 2
    let sum = 0, term = Math.exp(-z) * Math.pow(z, a) / gamma(a + 1)
    sum = term
    for (let k = 1; k <= 100; k++) { term *= z / (a + k); sum += term; if (Math.abs(term) < 1e-12) break }
    const cdf = Math.min(1, Math.max(0, sum * z === 0 ? 0 : sum))
    const result = cumul ? num(cdf) : num(x > 0 ? Math.pow(x, df/2 - 1) * Math.exp(-x/2) / (Math.pow(2, df/2) * gamma(df/2)) : 0)
    s.push(result); return { result }
  },
  // TDIST_OP: Student's t-distribution CDF. TDIST(x, df)
  // Simplified: uses normal approximation for df > 30
  TDIST_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "TDIST")); return { result: s[s.length-1] } }
    const df = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    // For large df, approximate with normal
    const z = df > 30 ? x : x * (1 - 1/(4*df)) / Math.sqrt(1 + x*x/(2*df))
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989422802 * Math.exp(-z*z/2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    const result = num(z >= 0 ? 1 - p : p); s.push(result); return { result }
  },
  // FDIST_OP: F-distribution CDF. FDIST(x, df1, df2) — simplified approximation
  FDIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "FDIST")); return { result: s[s.length-1] } }
    const df2 = Math.round(asNum(s.pop()!)), df1 = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (x < 0) { const result = num(0); s.push(result); return { result } }
    // Approximation: use normal approximation of F via Wilson-Hilferty
    const z = ((x * df1 / df2) ** (1/3) - (1 - 2/(9*df2))) / Math.sqrt(2/(9*df2))
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989422802 * Math.exp(-z*z/2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    const result = num(z >= 0 ? 1 - p : p); s.push(result); return { result }
  },
  // PHI_OP: standard normal PDF φ(x) = (1/√(2π)) * e^(-x²/2)
  PHI_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    return num(Math.exp(-x*x/2) / Math.sqrt(2 * Math.PI))
  }, "PHI") }),
  // GAUSS_OP: area under standard normal from 0 to x. GAUSS(x) = Φ(x) - 0.5
  GAUSS_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989422802 * Math.exp(-x*x/2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return num(x >= 0 ? 0.5 - p : -(0.5 - p))
  }, "GAUSS") }),
  // MIDB_OP: MID for bytes. MIDB(text, start, num_bytes)
  MIDB_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "MIDB")); return { result: s[s.length-1] } }
    const n3 = Math.round(asNum(s.pop()!)), start = Math.round(asNum(s.pop()!)) - 1, text = vmDisplay(s.pop()!)
    const result = str(text.slice(start, start + n3)); s.push(result); return { result }
  },
  // DBCS_OP: half-width to full-width (simplified — no-op for non-CJK)
  DBCS_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a)), "DBCS") }),
  // ASC_OP: full-width to half-width (simplified — no-op)
  ASC_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a)), "ASC") }),
  // CONCAT_WS_N: concat with separator. CONCAT_WS(sep, v1, ..., vN)
  CONCAT_WS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CONCAT_WS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const sep = vmDisplay(args[0])
    const result = str(args.slice(1).map(vmDisplay).join(sep)); s.push(result); return { result }
  },
  // NUMBERVALUE_OP2: parse number with locale. NUMBERVALUE(text, dec_sep, group_sep) — already exists but this handles 3 args
  // Let's add TEXTREVERSE_OP instead: reverse a string
  TEXTREVERSE_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str([...vmDisplay(a)].reverse().join("")), "TEXTREVERSE") }),
  // FVSCHEDULE_N: future value with variable rate schedule. FVSCHEDULE(pv, rate1, rate2, ...)
  FVSCHEDULE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "FVSCHEDULE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let fv = asNum(args[0])
    for (let i = 1; i < args.length; i++) fv *= (1 + asNum(args[i]))
    const result = num(fv); s.push(result); return { result }
  },
  // CUMIPMT_OP: cumulative interest paid. CUMIPMT(rate, nper, pv, start_period, end_period, type)
  // Simplified: CUMIPMT(rate, nper, pv, start, end)
  CUMIPMT_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "CUMIPMT")); return { result: s[s.length-1] } }
    const endPer = Math.round(asNum(s.pop()!)), startPer = Math.round(asNum(s.pop()!))
    const pv = asNum(s.pop()!), nper = Math.round(asNum(s.pop()!)), rate = asNum(s.pop()!)
    const pmt = rate === 0 ? -pv / nper : -pv * rate / (1 - Math.pow(1 + rate, -nper))
    let cumInt = 0
    for (let per = startPer; per <= endPer; per++) {
      const fvBefore = pv * Math.pow(1 + rate, per - 1) + pmt * (Math.pow(1 + rate, per - 1) - 1) / (rate || 1)
      cumInt += fvBefore * rate
    }
    const result = num(cumInt); s.push(result); return { result }
  },
  // COLUMNS_N: count of values (like ROWS but for columns — in 1D same thing)
  COLUMNS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COLUMNS")); return { result: s[s.length-1] } }
    s.splice(s.length - n, n)
    const result = num(n); s.push(result); return { result }
  },
  // INDIRECT_OP: return value as-is (simplified — no cell ref resolution in stack VM)
  INDIRECT_OP: (_o, s) => ({ result: unop(s, a => a, "INDIRECT") }),
  // OFFSET_OP: simplified — return value as-is
  OFFSET_OP: (_o, s) => ({ result: unop(s, a => a, "OFFSET") }),
  // ZTEST_N: one-sample z-test. ZTEST(sigma, hypothesized_mean, x1, ..., xN)
  ZTEST_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "ZTEST")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const sigma = asNum(args[0]), mu0 = asNum(args[1])
    const values = args.slice(2).map(asNum)
    const n2 = values.length
    const mean = values.reduce((a, b) => a + b, 0) / n2
    const z = (mean - mu0) / (sigma / Math.sqrt(n2))
    // P-value from z (one-tail using normal CDF approx)
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989422802 * Math.exp(-z * z / 2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    const result = num(z >= 0 ? p : 1 - p); s.push(result); return { result }
  },
  // COVARIANCE_S_N: sample covariance (n-1 denominator)
  COVARIANCE_S_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0 || n < 4) { s.push(vmError("STACK_UNDERFLOW", "COVARIANCE.S")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const mx = xs.reduce((a, b) => a + b, 0) / half
    const my = ys.reduce((a, b) => a + b, 0) / half
    let cov = 0
    for (let i = 0; i < half; i++) cov += (xs[i] - mx) * (ys[i] - my)
    const result = num(cov / (half - 1)); s.push(result); return { result }
  },
  // STDEV_S_N: sample standard deviation (already STDEV_N but this is explicit naming)
  STDEV_S_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "STDEV.S")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const variance = args.reduce((a, b) => a + (b - mean) ** 2, 0) / (args.length - 1)
    const result = num(Math.sqrt(variance)); s.push(result); return { result }
  },
  // TIMEVALUE_OP: convert time string to serial number. "12:30" → 0.520833...
  TIMEVALUE_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const m = s2.match(/(\d+):(\d+)(?::(\d+))?/)
    if (!m) return vmError("TYPE_MISMATCH", "TIMEVALUE: invalid time")
    const h = parseInt(m[1]), min = parseInt(m[2]), sec = m[3] ? parseInt(m[3]) : 0
    return num((h * 3600 + min * 60 + sec) / 86400)
  }, "TIMEVALUE") }),
  // TIME_OP: construct time serial from h, m, s. TIME(12, 30, 0) → 0.520833...
  TIME_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TIME")); return { result: s[s.length-1] } }
    const sec = asNum(s.pop()!), min = asNum(s.pop()!), h = asNum(s.pop()!)
    const result = num((h * 3600 + min * 60 + sec) / 86400); s.push(result); return { result }
  },
  // SECOND_OP: extract second from time serial. SECOND(0.5) → 0 (noon)
  SECOND_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const totalSec = Math.round(asNum(a) * 86400)
    return num(totalSec % 60)
  }, "SECOND") }),
  // MINUTE_OP: extract minute from time serial
  MINUTE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const totalSec = Math.round(asNum(a) * 86400)
    return num(Math.floor(totalSec / 60) % 60)
  }, "MINUTE") }),
  // HOUR_OP: extract hour from time serial
  HOUR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const totalSec = Math.round(asNum(a) * 86400)
    return num(Math.floor(totalSec / 3600))
  }, "HOUR") }),
  // GROWTH_N: exponential growth prediction. GROWTH(known_y1,...,known_yN) → next predicted y
  GROWTH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "GROWTH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    // Exponential regression: fit y = a*b^x, predict next
    const logY = args.map(y => y > 0 ? Math.log(y) : 0)
    const n2 = logY.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n2; i++) { sumX += i; sumY += logY[i]; sumXY += i * logY[i]; sumX2 += i * i }
    const slope = (n2 * sumXY - sumX * sumY) / (n2 * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n2
    const nextX = n2
    const result = num(Math.exp(intercept + slope * nextX)); s.push(result); return { result }
  },
  // TREND_N: linear trend prediction. TREND(y1,...,yN) → next predicted y
  TREND_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "TREND")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const n2 = args.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n2; i++) { sumX += i; sumY += args[i]; sumXY += i * args[i]; sumX2 += i * i }
    const slope = (n2 * sumXY - sumX * sumY) / (n2 * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n2
    const result = num(intercept + slope * n2); s.push(result); return { result }
  },
  // FREQUENCY_N: frequency distribution. FREQUENCY(v1,...,vN, bin1,...,binK) — simplified: count per bin
  FREQUENCY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FREQUENCY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    // Simple: return count of values (total frequency)
    const result = num(args.length); s.push(result); return { result }
  },
  // PROB_N: probability. PROB(lower, upper, prob_range) → sum of probs where value in range
  // Simplified: PROB(lower, upper, v1, v2, ...) returns fraction of values in [lower, upper]
  PROB_N2: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "PROB")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const lower = asNum(args[0]), upper = asNum(args[1])
    const values = args.slice(2).map(asNum)
    const inRange = values.filter(v => v >= lower && v <= upper).length
    const result = num(values.length > 0 ? inRange / values.length : 0); s.push(result); return { result }
  },
  // LAMBDA_N: simplified lambda (just returns the last value like LET). For future extension.
  LAMBDA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LAMBDA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = args[args.length - 1]; s.push(result); return { result }
  },
  // MAP_N: apply operation to each value. MAP(v1, ..., vN) → just passes through values
  MAP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAP")); return { result: s[s.length-1] } }
    return { result: s[s.length - 1] }
  },
  // REDUCE_N: reduce values. REDUCE(initial, v1, ..., vN) → sum (default reduce is sum)
  REDUCE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "REDUCE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let acc = asNum(args[0])
    for (let i = 1; i < args.length; i++) { if (!isVMError(args[i])) acc += asNum(args[i]) }
    const result = num(acc); s.push(result); return { result }
  },
  // SCAN_N: running accumulation. SCAN(initial, v1, ..., vN) → pushes running sums
  SCAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SCAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let acc = asNum(args[0])
    for (let i = 1; i < args.length; i++) {
      if (!isVMError(args[i])) acc += asNum(args[i])
      s.push(num(acc))
    }
    return { result: num(acc) }
  },
  // BYROW_N: simplified — in 1D model, same as identity
  BYROW_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "BYROW")); return { result: s[s.length-1] } }
    return { result: s[s.length - 1] }
  },
  // BYCOL_N: simplified — same as BYROW in 1D
  BYCOL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "BYCOL")); return { result: s[s.length-1] } }
    return { result: s[s.length - 1] }
  },
  // LEFTB_OP: left bytes (same as LEFT for non-CJK)
  LEFTB_OP: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return str(vmDisplay(a).slice(0, asNum(b))) }, "LEFTB") }),
  // RIGHTB_OP: right bytes
  RIGHTB_OP: (_o, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const s2 = vmDisplay(a); return str(s2.slice(Math.max(0, s2.length - asNum(b)))) }, "RIGHTB") }),
  // LENB_OP: length in bytes (UTF-8)
  LENB_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(new TextEncoder().encode(vmDisplay(a)).length), "LENB") }),
  // NUMBERVALUE_OP already exists. Add BAHTTEXT_OP: number to Thai baht text (simplified)
  BAHTTEXT_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(`${asNum(a)} Baht`), "BAHTTEXT") }),
  // PHONETIC_OP: return text as-is (simplified — no CJK phonetic conversion)
  PHONETIC_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a)), "PHONETIC") }),
  // BESSELY_OP: Bessel Y0(x) approximation (Neumann function)
  BESSELY_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "BESSELY")); return { result: s[s.length-1] } }
    const order = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (x <= 0) { s.push(vmError("TYPE_MISMATCH", "BESSELY: x must be > 0")); return { result: s[s.length-1] } }
    // Rough Y0 approximation for order 0
    const gamma = 0.5772156649
    let j0 = 1, term = 1
    for (let k = 1; k <= 20; k++) { term *= -(x*x)/(4*k*k); j0 += term }
    const y0 = (2/Math.PI) * (Math.log(x/2) + gamma) * j0
    const result = num(order === 0 ? y0 : y0 / (order + 1)); s.push(result); return { result }
  },
  // HEX2BIN_OP: hex to binary
  HEX2BIN_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 16)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "HEX2BIN") : str(n.toString(2))
  }, "HEX2BIN") }),
  // HEX2OCT_OP: hex to octal
  HEX2OCT_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 16)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "HEX2OCT") : str(n.toString(8))
  }, "HEX2OCT") }),
  // OCT2BIN_OP: octal to binary
  OCT2BIN_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 8)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "OCT2BIN") : str(n.toString(2))
  }, "OCT2BIN") }),
  // OCT2HEX_OP: octal to hex
  OCT2HEX_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 8)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "OCT2HEX") : str(n.toString(16).toUpperCase())
  }, "OCT2HEX") }),
  // IMTAN_OP: complex tangent sin(z)/cos(z)
  IMTAN_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMTAN")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    // tan(z) = sin(z)/cos(z) using sin/cos formulas
    const sr = Math.sin(r)*Math.cosh(i2), si = Math.cos(r)*Math.sinh(i2)
    const cr = Math.cos(r)*Math.cosh(i2), ci = -Math.sin(r)*Math.sinh(i2)
    const denom = cr*cr + ci*ci
    if (denom === 0) return vmError("DIV_ZERO", "IMTAN")
    const rr = +((sr*cr + si*ci) / denom).toFixed(10)
    const ri = +((si*cr - sr*ci) / denom).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMTAN") }),
  // IMLOG2_OP: log base 2 of complex
  IMLOG2_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMLOG2")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const mag = Math.sqrt(r*r + i2*i2), arg = Math.atan2(i2, r)
    const ln2 = Math.log(2)
    const rr = +(Math.log(mag) / ln2).toFixed(10), ri = +(arg / ln2).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMLOG2") }),
  // IMLOG10_OP: log base 10 of complex
  IMLOG10_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMLOG10")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const mag = Math.sqrt(r*r + i2*i2), arg = Math.atan2(i2, r)
    const ln10 = Math.log(10)
    const rr = +(Math.log(mag) / ln10).toFixed(10), ri = +(arg / ln10).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMLOG10") }),
  // DPRODUCT_N: product of all values. DPRODUCT(v1, ..., vN) → product
  DPRODUCT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DPRODUCT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let product = 1
    for (const v of args) { if (!isVMError(v)) product *= asNum(v) }
    const result = num(product); s.push(result); return { result }
  },
  // RANDBETWEEN_FLOAT_OP: random float between min and max
  RANDBETWEEN_FLOAT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "RANDBETWEEN.FLOAT")); return { result: s[s.length-1] } }
    const max = asNum(s.pop()!), min = asNum(s.pop()!)
    const result = num(min + Math.random() * (max - min)); s.push(result); return { result }
  },
  // FORMULATEXT_OP: returns the formula as text (meta function — returns the string of the input)
  FORMULATEXT_OP: (_o, s) => ({ result: unop(s, a => str(vmDisplay(a)), "FORMULATEXT") }),
  // ADDRESS_OP: construct cell reference string. ADDRESS(row, col)
  ADDRESS_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "ADDRESS")); return { result: s[s.length-1] } }
    const col = Math.round(asNum(s.pop()!)), row = Math.round(asNum(s.pop()!))
    const colLetter = String.fromCharCode(64 + Math.min(26, Math.max(1, col)))
    const result = str(`$${colLetter}$${row}`); s.push(result); return { result }
  },
  // IMDIV_OP: divide two complex. (a+bi)/(c+di) = ((ac+bd)+(bc-ad)i)/(c²+d²)
  IMDIV_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IMDIV")); return { result: s[s.length-1] } }
    const bs = vmDisplay(s.pop()!), as2 = vmDisplay(s.pop()!)
    const parseC = (s2: string) => {
      const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
      return { r: mr ? parseFloat(mr[1]) : 0, i: mi ? parseFloat(mi[1]) : 0 }
    }
    const ca = parseC(as2), cb = parseC(bs)
    const denom = cb.r*cb.r + cb.i*cb.i
    if (denom === 0) { s.push(vmError("DIV_ZERO", "IMDIV")); return { result: s[s.length-1] } }
    const rr = +((ca.r*cb.r + ca.i*cb.i) / denom).toFixed(10)
    const ri = +((ca.i*cb.r - ca.r*cb.i) / denom).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    const result = str(`${rr}${sign}${ri}i`); s.push(result); return { result }
  },
  // IMSUB_OP: subtract two complex
  IMSUB_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IMSUB")); return { result: s[s.length-1] } }
    const bs = vmDisplay(s.pop()!), as2 = vmDisplay(s.pop()!)
    const parseC = (s2: string) => {
      const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
      return { r: mr ? parseFloat(mr[1]) : 0, i: mi ? parseFloat(mi[1]) : 0 }
    }
    const ca = parseC(as2), cb = parseC(bs)
    const rr = ca.r - cb.r, ri = ca.i - cb.i
    const sign = ri >= 0 ? "+" : ""
    const result = str(`${rr}${sign}${ri}i`); s.push(result); return { result }
  },
  // BIN2DEC_OP: binary string to decimal
  BIN2DEC_OP: (_o, s) => ({ result: unop(s, a => {
    const b = vmDisplay(a)
    const n = parseInt(b, 2)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "BIN2DEC: invalid binary") : num(n)
  }, "BIN2DEC") }),
  // DEC2BIN_OP: decimal to binary string
  DEC2BIN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str((asNum(a) >>> 0).toString(2))
  }, "DEC2BIN") }),
  // BIN2HEX_OP: binary string to hex
  BIN2HEX_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 2)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "BIN2HEX") : str(n.toString(16).toUpperCase())
  }, "BIN2HEX") }),
  // HEX2DEC_OP: hex string to decimal
  HEX2DEC_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 16)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "HEX2DEC") : num(n)
  }, "HEX2DEC") }),
  // DEC2HEX_OP: decimal to hex string
  DEC2HEX_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(Math.round(asNum(a)).toString(16).toUpperCase())
  }, "DEC2HEX") }),
  // OCT2DEC_OP: octal string to decimal
  OCT2DEC_OP: (_o, s) => ({ result: unop(s, a => {
    const n = parseInt(vmDisplay(a), 8)
    return isNaN(n) ? vmError("TYPE_MISMATCH", "OCT2DEC") : num(n)
  }, "OCT2DEC") }),
  // DEC2OCT_OP: decimal to octal string
  DEC2OCT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(Math.round(asNum(a)).toString(8))
  }, "DEC2OCT") }),
  // BITAND_OP: bitwise AND
  BITAND_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num((Math.round(asNum(a)) & Math.round(asNum(b))) >>> 0)
  }, "BITAND") }),
  // BITOR_OP: bitwise OR
  BITOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num((Math.round(asNum(a)) | Math.round(asNum(b))) >>> 0)
  }, "BITOR") }),
  // BITXOR_OP: bitwise XOR
  BITXOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num((Math.round(asNum(a)) ^ Math.round(asNum(b))) >>> 0)
  }, "BITXOR") }),
  // BITLSHIFT_OP: bitwise left shift
  BITLSHIFT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num((Math.round(asNum(a)) << Math.round(asNum(b))) >>> 0)
  }, "BITLSHIFT") }),
  // BITRSHIFT_OP: bitwise right shift
  BITRSHIFT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(Math.round(asNum(a)) >>> Math.round(asNum(b)))
  }, "BITRSHIFT") }),
  // IMPOWER_OP: raise complex to integer power. IMPOWER(complex, n)
  IMPOWER_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IMPOWER")); return { result: s[s.length-1] } }
    const n = Math.round(asNum(s.pop()!)), cs = vmDisplay(s.pop()!)
    const mr = cs.match(/^([-+]?\d*\.?\d+)/), mi = cs.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) { s.push(vmError("TYPE_MISMATCH", "IMPOWER")); return { result: s[s.length-1] } }
    const r = parseFloat(mr[1]), i = parseFloat(mi[1])
    const mag = Math.sqrt(r*r + i*i), arg = Math.atan2(i, r)
    const newMag = Math.pow(mag, n), newArg = arg * n
    const rr = +(newMag * Math.cos(newArg)).toFixed(10)
    const ri = +(newMag * Math.sin(newArg)).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    const result = str(`${rr}${sign}${ri}i`); s.push(result); return { result }
  },
  // IMEXP_OP: e^(a+bi) = e^a * (cos(b) + i*sin(b))
  IMEXP_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMEXP")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const ea = Math.exp(r)
    const rr = +(ea * Math.cos(i2)).toFixed(10), ri = +(ea * Math.sin(i2)).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMEXP") }),
  // IMLN_OP: ln(a+bi) = ln|z| + i*arg(z)
  IMLN_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMLN")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const mag = Math.sqrt(r*r + i2*i2), arg = Math.atan2(i2, r)
    const rr = +(Math.log(mag)).toFixed(10), ri = +(arg).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMLN") }),
  // IMSIN_OP: sin(a+bi) using complex formula
  IMSIN_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMSIN")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const rr = +(Math.sin(r) * Math.cosh(i2)).toFixed(10)
    const ri = +(Math.cos(r) * Math.sinh(i2)).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMSIN") }),
  // IMCOS_OP: cos(a+bi)
  IMCOS_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMCOS")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const rr = +(Math.cos(r) * Math.cosh(i2)).toFixed(10)
    const ri = +(-(Math.sin(r) * Math.sinh(i2))).toFixed(10)
    const sign = ri >= 0 ? "+" : ""
    return str(`${rr}${sign}${ri}i`)
  }, "IMCOS") }),
  // IMSUM_OP: add two complex numbers. IMSUM(a, b) where a,b are complex strings
  IMSUM_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IMSUM")); return { result: s[s.length-1] } }
    const b = vmDisplay(s.pop()!), a = vmDisplay(s.pop()!)
    const parseC = (s2: string) => {
      const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
      return { r: mr ? parseFloat(mr[1]) : 0, i: mi ? parseFloat(mi[1]) : 0 }
    }
    const ca = parseC(a), cb = parseC(b)
    const rr = ca.r + cb.r, ri = ca.i + cb.i
    const sign = ri >= 0 ? "+" : ""
    const result = str(`${rr}${sign}${ri}i`); s.push(result); return { result }
  },
  // IMPRODUCT_OP: multiply two complex. (a+bi)(c+di) = (ac-bd)+(ad+bc)i
  IMPRODUCT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IMPRODUCT")); return { result: s[s.length-1] } }
    const b = vmDisplay(s.pop()!), a = vmDisplay(s.pop()!)
    const parseC = (s2: string) => {
      const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
      return { r: mr ? parseFloat(mr[1]) : 0, i: mi ? parseFloat(mi[1]) : 0 }
    }
    const ca = parseC(a), cb = parseC(b)
    const rr = ca.r*cb.r - ca.i*cb.i, ri = ca.r*cb.i + ca.i*cb.r
    const sign = ri >= 0 ? "+" : ""
    const result = str(`${rr}${sign}${ri}i`); s.push(result); return { result }
  },
  // IMARGUMENT_OP: argument (angle) of complex. atan2(b, a)
  IMARGUMENT_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMARGUMENT: not complex")
    return num(Math.atan2(parseFloat(mi[1]), parseFloat(mr[1])))
  }, "IMARGUMENT") }),
  // IMCONJUGATE_OP: conjugate of complex. a+bi → a-bi
  IMCONJUGATE_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMCONJUGATE: not complex")
    const r = parseFloat(mr[1]), i = -parseFloat(mi[1])
    const sign = i >= 0 ? "+" : ""
    return str(`${r}${sign}${i}i`)
  }, "IMCONJUGATE") }),
  // IMSQRT_OP: square root of complex
  IMSQRT_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/), mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMSQRT: not complex")
    const r = parseFloat(mr[1]), i2 = parseFloat(mi[1])
    const mag = Math.sqrt(r*r + i2*i2), arg = Math.atan2(i2, r)
    const sqrtMag = Math.sqrt(mag), halfArg = arg / 2
    const rr = sqrtMag * Math.cos(halfArg), ri = sqrtMag * Math.sin(halfArg)
    const sign = ri >= 0 ? "+" : ""
    return str(`${+rr.toFixed(10)}${sign}${+ri.toFixed(10)}i`)
  }, "IMSQRT") }),
  // BESSELJ_OP: Bessel function J0(x) approximation. BESSELJ(x, order)
  BESSELJ_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "BESSELJ")); return { result: s[s.length-1] } }
    const order = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    // J0 approximation for order 0, otherwise simple series
    if (order === 0) {
      let sum = 1, term = 1
      for (let k = 1; k <= 20; k++) { term *= -(x*x) / (4*k*k); sum += term }
      const result = num(sum); s.push(result); return { result }
    }
    // Higher orders: rough series approximation
    let fac = 1; for (let i = 2; i <= order; i++) fac *= i
    let sum = 0, term = Math.pow(x/2, order) / fac
    sum = term
    for (let k = 1; k <= 20; k++) {
      term *= -(x*x) / (4*k*(k+order))
      sum += term
    }
    const result = num(sum); s.push(result); return { result }
  },
  // COMPLEX_OP: create complex string from real, imaginary. COMPLEX(real, imag)
  COMPLEX_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "COMPLEX")); return { result: s[s.length-1] } }
    const imag = asNum(s.pop()!), real = asNum(s.pop()!)
    const sign = imag >= 0 ? "+" : ""
    const result = str(`${real}${sign}${imag}i`); s.push(result); return { result }
  },
  // IMREAL_OP: extract real part from complex string. IMREAL("3+4i")
  IMREAL_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const m = s2.match(/^([-+]?\d*\.?\d+)/)
    return m ? num(parseFloat(m[1])) : vmError("TYPE_MISMATCH", "IMREAL: not complex")
  }, "IMREAL") }),
  // IMAGINARY_OP: extract imaginary part. IMAGINARY("3+4i")
  IMAGINARY_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const m = s2.match(/([-+]?\d*\.?\d+)i/)
    return m ? num(parseFloat(m[1])) : vmError("TYPE_MISMATCH", "IMAGINARY: not complex")
  }, "IMAGINARY") }),
  // IMABS_OP: absolute value of complex. |a+bi| = sqrt(a²+b²)
  IMABS_OP: (_o, s) => ({ result: unop(s, a => {
    const s2 = vmDisplay(a)
    const mr = s2.match(/^([-+]?\d*\.?\d+)/)
    const mi = s2.match(/([-+]?\d*\.?\d+)i/)
    if (!mr || !mi) return vmError("TYPE_MISMATCH", "IMABS: not complex")
    const real = parseFloat(mr[1]), imag = parseFloat(mi[1])
    return num(Math.sqrt(real*real + imag*imag))
  }, "IMABS") }),
  // Actually too complex. Let's do NORMDIST approximation instead.
  // TAKE_N: take first K values from stack. TAKE(count, v1, ..., vN) → first count values
  TAKE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TAKE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[0]))
    const values = args.slice(1)
    const taken = values.slice(0, Math.min(count, values.length))
    for (const v of taken) s.push(v)
    return { result: taken.length > 0 ? taken[taken.length - 1] : num(0) }
  },
  // DROP_N: drop first K values, keep rest. DROP(count, v1, ..., vN)
  DROP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DROP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[0]))
    const values = args.slice(1)
    const kept = values.slice(Math.min(count, values.length))
    for (const v of kept) s.push(v)
    return { result: kept.length > 0 ? kept[kept.length - 1] : num(0) }
  },
  // HSTACK_N: combine values (horizontal stack). In 1D model, just pushes all values
  HSTACK_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "HSTACK")); return { result: s[s.length-1] } }
    return { result: num(n) }
  },
  // WRAPROWS_N: wrap flat array into rows. WRAPROWS(wrap_count, v1, ..., vN) → returns count of rows
  WRAPROWS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "WRAPROWS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const wrapCount = Math.round(asNum(args[0]))
    const values = args.slice(1)
    for (const v of values) s.push(v)
    const result = num(Math.ceil(values.length / Math.max(1, wrapCount))); s.push(result); return { result }
  },
  // ISFORMULA_OP: always returns TRUE (in our context, everything is a formula)
  ISFORMULA_OP: (_o, s) => ({ result: unop(s, _a => bool(true), "ISFORMULA") }),
  REGEXMATCH_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "REGEXMATCH")); return { result: s[s.length-1] } }
    const pattern = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    try {
      const re = new RegExp(pattern)
      const result = bool(re.test(text)); s.push(result); return { result }
    } catch { const result = vmError("TYPE_MISMATCH", "REGEXMATCH: invalid regex"); s.push(result); return { result } }
  },
  // REGEXEXTRACT_OP: extract first match. REGEXEXTRACT(text, pattern)
  REGEXEXTRACT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "REGEXEXTRACT")); return { result: s[s.length-1] } }
    const pattern = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    try {
      const re = new RegExp(pattern)
      const m = text.match(re)
      if (!m) { const result = vmError("TYPE_MISMATCH", "REGEXEXTRACT: no match"); s.push(result); return { result } }
      const result = str(m[1] ?? m[0]); s.push(result); return { result }
    } catch { const result = vmError("TYPE_MISMATCH", "REGEXEXTRACT: invalid regex"); s.push(result); return { result } }
  },
  // REGEXREPLACE_OP: replace matches. REGEXREPLACE(text, pattern, replacement)
  REGEXREPLACE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "REGEXREPLACE")); return { result: s[s.length-1] } }
    const replacement = vmDisplay(s.pop()!), pattern = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    try {
      const re = new RegExp(pattern, "g")
      const result = str(text.replace(re, replacement)); s.push(result); return { result }
    } catch { const result = vmError("TYPE_MISMATCH", "REGEXREPLACE: invalid regex"); s.push(result); return { result } }
  },
  // LET_N: bind named values. LET(name1, val1, ..., nameN, valN, expression)
  // Simplified: LET just evaluates args left-to-right, returns last. Names are unused in stack VM.
  LET_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LET")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    // Return the last value (the expression result after bindings)
    const result = args[args.length - 1]; s.push(result); return { result }
  },
  // SWITCH_N already exists but let's add CHOOSECOLS_N: pick specific columns by index
  CHOOSECOLS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CHOOSECOLS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    // First arg is how many indices, rest are the values array
    // Simplified: CHOOSECOLS(idx1, idx2, ..., v1, v2, ...) — indices pick from values
    const indices: number[] = []
    let i = 0
    while (i < args.length && args[i]._tag === "num" && asNum(args[i]) < 100) {
      indices.push(Math.round(asNum(args[i])) - 1) // 1-based to 0-based
      i++
    }
    const values = args.slice(i)
    for (const idx of indices) {
      if (idx >= 0 && idx < values.length) s.push(values[idx])
      else s.push(vmError("TYPE_MISMATCH", `CHOOSECOLS: index ${idx+1} out of range`))
    }
    return { result: s[s.length - 1] }
  },
  // SUMXMY2_N: sum of (xi - yi)². Stack: [x1,...,xK, y1,...,yK] where n=2K
  SUMXMY2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "SUMXMY2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    let sum = 0
    for (let i = 0; i < half; i++) sum += (asNum(args[i]) - asNum(args[half + i])) ** 2
    const result = num(sum); s.push(result); return { result }
  },
  // SUMX2PY2_N: sum of (xi² + yi²). Stack: [x1,...,xK, y1,...,yK]
  SUMX2PY2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "SUMX2PY2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    let sum = 0
    for (let i = 0; i < half; i++) sum += asNum(args[i]) ** 2 + asNum(args[half + i]) ** 2
    const result = num(sum); s.push(result); return { result }
  },
  // SUMX2MY2_N: sum of (xi² - yi²). Stack: [x1,...,xK, y1,...,yK]
  SUMX2MY2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "SUMX2MY2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    let sum = 0
    for (let i = 0; i < half; i++) sum += asNum(args[i]) ** 2 - asNum(args[half + i]) ** 2
    const result = num(sum); s.push(result); return { result }
  },
  // ERF_OP: error function (Abramowitz & Stegun approximation)
  ERF_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    const sign = x >= 0 ? 1 : -1
    const ax = Math.abs(x)
    const t = 1 / (1 + 0.3275911 * ax)
    const y = 1 - (0.254829592 * t - 0.284496736 * t*t + 1.421413741 * t*t*t - 1.453152027 * t*t*t*t + 1.061405429 * t*t*t*t*t) * Math.exp(-ax * ax)
    return num(sign * y)
  }, "ERF") }),
  // ERFC_OP: complementary error function = 1 - erf(x)
  ERFC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    const ax = Math.abs(x)
    const t = 1 / (1 + 0.3275911 * ax)
    const y = 1 - (0.254829592 * t - 0.284496736 * t*t + 1.421413741 * t*t*t - 1.453152027 * t*t*t*t + 1.061405429 * t*t*t*t*t) * Math.exp(-ax * ax)
    return num(x >= 0 ? 1 - y : 1 + y)
  }, "ERFC") }),
  // YEARFRAC_OP: fraction of year between two serial dates. YEARFRAC(start, end)
  YEARFRAC_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "YEARFRAC")); return { result: s[s.length-1] } }
    const end = Math.round(asNum(s.pop()!)), start = Math.round(asNum(s.pop()!))
    const result = num(Math.abs(end - start) / 365.25); s.push(result); return { result }
  },
  // COUPDAYBS_OP: days from beginning of coupon period to settlement
  COUPDAYBS_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "COUPDAYBS")); return { result: s[s.length-1] } }
    const frequency = Math.round(asNum(s.pop()!)), settlement = Math.round(asNum(s.pop()!))
    const daysInPeriod = Math.round(365 / frequency)
    const result = num(settlement % daysInPeriod); s.push(result); return { result }
  },
  // TBILLYIELD_OP: T-bill yield. TBILLYIELD(settlement, maturity, price)
  TBILLYIELD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TBILLYIELD")); return { result: s[s.length-1] } }
    const price = asNum(s.pop()!), maturity = Math.round(asNum(s.pop()!)), settlement = Math.round(asNum(s.pop()!))
    const dsm = maturity - settlement
    if (dsm <= 0 || price <= 0) { s.push(vmError("TYPE_MISMATCH", "TBILLYIELD")); return { result: s[s.length-1] } }
    const result = num((100 - price) / price * (360 / dsm)); s.push(result); return { result }
  },
  // RECEIVED_OP: amount received at maturity. RECEIVED(settlement, maturity, investment, discount)
  RECEIVED_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "RECEIVED")); return { result: s[s.length-1] } }
    const disc = asNum(s.pop()!), investment = asNum(s.pop()!), maturity = Math.round(asNum(s.pop()!)), settlement = Math.round(asNum(s.pop()!))
    const dsm = maturity - settlement
    const result = num(investment / (1 - disc * dsm / 360)); s.push(result); return { result }
  },
  // PRICEDISC_OP: price of discounted security. PRICEDISC(settlement, maturity, discount, redemption)
  PRICEDISC_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "PRICEDISC")); return { result: s[s.length-1] } }
    const redemption = asNum(s.pop()!), disc = asNum(s.pop()!), maturity = Math.round(asNum(s.pop()!)), settlement = Math.round(asNum(s.pop()!))
    const dsm = maturity - settlement
    const result = num(redemption - disc * redemption * dsm / 360); s.push(result); return { result }
  },
  // MIRR_N: modified internal rate of return. MIRR(finance_rate, reinvest_rate, cf1, ..., cfN)
  MIRR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MIRR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const finRate = asNum(args[0]), reinRate = asNum(args[1])
    const cfs = args.slice(2).map(asNum)
    const nPer = cfs.length
    let pvNeg = 0, fvPos = 0
    for (let i = 0; i < nPer; i++) {
      if (cfs[i] < 0) pvNeg += cfs[i] / Math.pow(1 + finRate, i)
      else fvPos += cfs[i] * Math.pow(1 + reinRate, nPer - 1 - i)
    }
    if (pvNeg === 0) { s.push(vmError("TYPE_MISMATCH", "MIRR: no negative cash flows")); return { result: s[s.length-1] } }
    const result = num(Math.pow(-fvPos / pvNeg, 1 / (nPer - 1)) - 1)
    s.push(result); return { result }
  },
  // XNPV_N: NPV with irregular dates. XNPV(rate, date1, cf1, date2, cf2, ...)
  XNPV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "XNPV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const rate = asNum(args[0])
    const pairs: [number, number][] = []
    for (let i = 1; i < args.length - 1; i += 2) pairs.push([asNum(args[i]), asNum(args[i+1])])
    if (pairs.length === 0) { s.push(vmError("TYPE_MISMATCH", "XNPV: no date/cf pairs")); return { result: s[s.length-1] } }
    const d0 = pairs[0][0]
    const npv = pairs.reduce((sum, [d, cf]) => sum + cf / Math.pow(1 + rate, (d - d0) / 365), 0)
    const result = num(npv); s.push(result); return { result }
  },
  // ACCRINT_OP: accrued interest. ACCRINT(issue, first_interest, settlement, rate, par, frequency)
  // Simplified: ACCRINT = par * rate * (settlement - issue) / (365 / frequency)
  ACCRINT_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "ACCRINT")); return { result: s[s.length-1] } }
    const freq = asNum(s.pop()!), par = asNum(s.pop()!), rate = asNum(s.pop()!), settlement = Math.round(asNum(s.pop()!))
    // Simplified: days * par * rate / days_in_year
    const daysAccrued = settlement % Math.round(365 / freq)
    const result = num(par * rate * daysAccrued / 365); s.push(result); return { result }
  },
  // COUPDAYS_OP: days in coupon period. COUPDAYS(settlement, maturity, frequency)
  COUPDAYS_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "COUPDAYS")); return { result: s[s.length-1] } }
    s.pop()! // maturity (not used in simplified)
    const freq = Math.round(asNum(s.pop()!))
    s.pop()! // settlement
    const result = num(Math.round(365 / freq)); s.push(result); return { result }
  },
  // DOLLARDE_OP: fractional dollar to decimal. DOLLARDE(fractional, fraction)
  DOLLARDE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DOLLARDE")); return { result: s[s.length-1] } }
    const fraction = Math.round(asNum(s.pop()!)), fractional = asNum(s.pop()!)
    const intPart = Math.trunc(fractional)
    const fracPart = fractional - intPart
    const result = num(intPart + fracPart * 10 / fraction); s.push(result); return { result }
  },
  // DOLLARFR_OP: decimal dollar to fractional. DOLLARFR(decimal, fraction)
  DOLLARFR_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DOLLARFR")); return { result: s[s.length-1] } }
    const fraction = Math.round(asNum(s.pop()!)), decimal = asNum(s.pop()!)
    const intPart = Math.trunc(decimal)
    const fracPart = decimal - intPart
    const result = num(intPart + fracPart * fraction / 10); s.push(result); return { result }
  },
  // SORT_N: sort values ascending. Stack: [v1, ..., vN] → sorted
  SORT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SORT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    args.sort((a, b) => asNum(a) - asNum(b))
    for (const v of args) s.push(v)
    return { result: args[args.length - 1] }
  },
  // UNIQUE_N: deduplicate values. Stack: [v1, ..., vN] → unique values
  UNIQUE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "UNIQUE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const seen = new Set<string>()
    const unique: any[] = []
    for (const v of args) {
      const key = vmDisplay(v)
      if (!seen.has(key)) { seen.add(key); unique.push(v) }
    }
    for (const v of unique) s.push(v)
    return { result: num(unique.length) }
  },
  // FILTER_N: filter values by criteria. Stack: [criteria, v1, ..., vN]
  FILTER_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FILTER")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    const matches = args.slice(1).filter(v => pred(v))
    if (matches.length === 0) { s.push(vmError("TYPE_MISMATCH", "FILTER: no matches")); return { result: s[s.length-1] } }
    for (const v of matches) s.push(v)
    return { result: num(matches.length) }
  },
  // PPMT_OP: principal payment. PPMT(rate, period, nper, pv)
  PPMT_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "PPMT")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), nper = asNum(s.pop()!), per = asNum(s.pop()!), rate = asNum(s.pop()!)
    // PMT = pv * rate / (1 - (1+rate)^-nper)
    const pmt = rate === 0 ? -pv / nper : -pv * rate / (1 - Math.pow(1 + rate, -nper))
    // IPMT for this period
    const fv_before = pv * Math.pow(1 + rate, per - 1) + pmt * (Math.pow(1 + rate, per - 1) - 1) / rate
    const ipmt = fv_before * rate
    const result = num(pmt - ipmt); s.push(result); return { result }
  },
  // IPMT_OP: interest payment. IPMT(rate, period, nper, pv)
  IPMT_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "IPMT")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), nper = asNum(s.pop()!), per = asNum(s.pop()!), rate = asNum(s.pop()!)
    const pmt = rate === 0 ? -pv / nper : -pv * rate / (1 - Math.pow(1 + rate, -nper))
    const fv_before = pv * Math.pow(1 + rate, per - 1) + pmt * (Math.pow(1 + rate, per - 1) - 1) / rate
    const result = num(fv_before * rate); s.push(result); return { result }
  },
  // CELL_OP: cell info (simplified — returns "v" for value type)
  CELL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return str("e")
    if (a._tag === "str") return str("l") // label
    if (a._tag === "bool") return str("b")
    return str("v") // value
  }, "CELL") }),
  // ROWS_N: count of values (simulates ROWS for arrays). Stack: [v1..vN]
  ROWS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ROWS")); return { result: s[s.length-1] } }
    s.splice(s.length - n, n)
    const result = num(n); s.push(result); return { result }
  },
  // RANDARRAY_N: generate N random numbers. RANDARRAY(count) → pushes count random values, returns last
  RANDARRAY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANDARRAY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[0]))
    let last: any = num(0)
    for (let i = 0; i < count; i++) { last = num(Math.random()); s.push(last) }
    return { result: last }
  },
  // SEQUENCE_N: generate sequence of numbers. SEQUENCE(count, [start], [step])
  SEQUENCE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SEQUENCE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[0]))
    const start = args.length > 1 ? asNum(args[1]) : 1
    const step = args.length > 2 ? asNum(args[2]) : 1
    let last: any = num(0)
    for (let i = 0; i < count; i++) { last = num(start + i * step); s.push(last) }
    return { result: last }
  },
  // XMATCH_N: extended match. XMATCH(lookup, values...) → 1-based position, supports approximate match
  XMATCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "XMATCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const lookup = args[0]
    const lookupNum = lookup._tag === "num" ? lookup.value : NaN
    const lookupStr = lookup._tag === "str" ? lookup.value.toLowerCase() : ""
    // Exact match first
    for (let i = 1; i < args.length; i++) {
      const v = args[i]
      if (lookup._tag === "num" && v._tag === "num" && v.value === lookupNum) { const result = num(i); s.push(result); return { result } }
      if (lookup._tag === "str" && v._tag === "str" && v.value.toLowerCase() === lookupStr) { const result = num(i); s.push(result); return { result } }
    }
    // If no exact match for numeric, try closest (binary search for sorted data)
    if (lookup._tag === "num") {
      let best = 1, bestDiff = Infinity
      for (let i = 1; i < args.length; i++) {
        if (args[i]._tag === "num") {
          const diff = Math.abs(args[i].value - lookupNum)
          if (diff < bestDiff) { bestDiff = diff; best = i }
        }
      }
      const result = num(best); s.push(result); return { result }
    }
    s.push(vmError("TYPE_MISMATCH", "XMATCH: not found")); return { result: s[s.length-1] }
  },
  // CEILING_PRECISE_OP: alias for CEILING.MATH behavior
  CEILING_PRECISE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "CEILING.PRECISE")); return { result: s[s.length-1] } }
    const sig = asNum(s.pop()!), n2 = asNum(s.pop()!)
    if (sig === 0) { const result = num(0); s.push(result); return { result } }
    const result = num(Math.ceil(n2 / Math.abs(sig)) * Math.abs(sig)); s.push(result); return { result }
  },
  // FLOOR_PRECISE_OP: alias for FLOOR.MATH behavior
  FLOOR_PRECISE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "FLOOR.PRECISE")); return { result: s[s.length-1] } }
    const sig = asNum(s.pop()!), n2 = asNum(s.pop()!)
    if (sig === 0) { const result = num(0); s.push(result); return { result } }
    const result = num(Math.floor(n2 / Math.abs(sig)) * Math.abs(sig)); s.push(result); return { result }
  },
  // AVERAGEA_N: like AVG but text=0, TRUE=1, FALSE=0
  AVERAGEA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AVERAGEA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let sum = 0, count = 0
    for (const v of args) {
      if (isVMError(v)) continue
      if (v._tag === "str") { sum += 0; count++ } // text counts as 0
      else if (v._tag === "bool") { sum += v.value ? 1 : 0; count++ }
      else { sum += asNum(v); count++ }
    }
    if (count === 0) { s.push(vmError("DIV_ZERO", "AVERAGEA: empty")); return { result: s[s.length-1] } }
    const result = num(sum / count); s.push(result); return { result }
  },
  // MAXA_N: like MAX but includes TRUE=1, FALSE=0, text=0
  MAXA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAXA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let max = -Infinity
    for (const v of args) {
      if (isVMError(v)) continue
      const val = v._tag === "str" ? 0 : v._tag === "bool" ? (v.value ? 1 : 0) : asNum(v)
      if (val > max) max = val
    }
    const result = num(max === -Infinity ? 0 : max); s.push(result); return { result }
  },
  // MINA_N: like MIN but includes TRUE=1, FALSE=0, text=0
  MINA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MINA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let min = Infinity
    for (const v of args) {
      if (isVMError(v)) continue
      const val = v._tag === "str" ? 0 : v._tag === "bool" ? (v.value ? 1 : 0) : asNum(v)
      if (val < min) min = val
    }
    const result = num(min === Infinity ? 0 : min); s.push(result); return { result }
  },
  // NEGBINOMDIST_OP: negative binomial. P(X failures before k-th success)
  NEGBINOMDIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NEGBINOMDIST")); return { result: s[s.length-1] } }
    const prob = asNum(s.pop()!), successes = Math.round(asNum(s.pop()!)), failures = Math.round(asNum(s.pop()!))
    if (prob <= 0 || prob >= 1 || failures < 0 || successes < 1) { s.push(vmError("TYPE_MISMATCH", "NEGBINOMDIST")); return { result: s[s.length-1] } }
    // C(failures+successes-1, successes-1) * p^successes * (1-p)^failures
    let coeff = 1; for (let i = 0; i < successes - 1; i++) coeff *= (failures + successes - 1 - i) / (i + 1)
    const result = num(coeff * Math.pow(prob, successes) * Math.pow(1 - prob, failures))
    s.push(result); return { result }
  },
  // BETADIST_OP: beta distribution CDF (uses incomplete beta via series). BETADIST(x, alpha, beta)
  // Simplified using numerical integration (trapezoidal)
  BETADIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BETADIST")); return { result: s[s.length-1] } }
    const beta2 = asNum(s.pop()!), alpha = asNum(s.pop()!), x = asNum(s.pop()!)
    if (x < 0 || x > 1 || alpha <= 0 || beta2 <= 0) { s.push(vmError("TYPE_MISMATCH", "BETADIST")); return { result: s[s.length-1] } }
    // Trapezoidal integration of B(t; α, β) from 0 to x
    const steps = 200
    const h = x / steps
    const f = (t: number) => Math.pow(t, alpha - 1) * Math.pow(1 - t, beta2 - 1)
    let integral = (f(0) + f(x)) / 2
    for (let i = 1; i < steps; i++) integral += f(i * h)
    integral *= h
    // Normalize by B(α, β) = integral from 0 to 1
    const h2 = 1 / steps
    let betaFull = (f(0) + f(1)) / 2
    for (let i = 1; i < steps; i++) betaFull += f(i * h2)
    betaFull *= h2
    const result = num(betaFull > 0 ? integral / betaFull : 0); s.push(result); return { result }
  },
  // HYPGEOMDIST_OP: hypergeometric distribution CDF. P(X=k) = C(K,k)*C(N-K,n-k)/C(N,n)
  HYPGEOMDIST_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "HYPGEOMDIST")); return { result: s[s.length-1] } }
    const pop = Math.round(asNum(s.pop()!)), popSucc = Math.round(asNum(s.pop()!))
    const drawN = Math.round(asNum(s.pop()!)), k = Math.round(asNum(s.pop()!))
    const comb = (n2: number, r: number) => { let c = 1; for (let i = 0; i < r; i++) c *= (n2 - i) / (i + 1); return Math.round(c) }
    let sum = 0
    for (let i = 0; i <= k; i++) { sum += comb(popSucc, i) * comb(pop - popSucc, drawN - i) / comb(pop, drawN) }
    const result = num(sum); s.push(result); return { result }
  },
  // ISNA_OP: check if value is #N/A error specifically
  ISNA_OP: (_o, s) => ({ result: unop(s, a => bool(isVMError(a) && a.code === "TYPE_MISMATCH" && a.message.includes("#N/A")), "ISNA") }),
  // SHEET_OP: always returns 1 (single sheet mode)
  SHEET_OP: (_o, s) => { const result = num(1); s.push(result); return { result } },
  // TEXTSPLIT_N: split text by delimiter, return Nth piece (1-based). Stack: [text, delim, index]
  TEXTSPLIT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TEXTSPLIT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const text = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const delim = args[1]._tag === "str" ? args[1].value : vmDisplay(args[1])
    const idx = n >= 3 ? Math.round(asNum(args[2])) : 1
    const parts = text.split(delim)
    if (idx < 1 || idx > parts.length) { s.push(vmError("TYPE_MISMATCH", `TEXTSPLIT: index ${idx} out of range`)); return { result: s[s.length-1] } }
    const result = str(parts[idx - 1]); s.push(result); return { result }
  },
  // DATESTRING_OP: serial date → "YYYY-MM-DD" string
  DATESTRING_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const serial = Math.round(asNum(a))
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + serial * 86400000)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return str(`${yyyy}-${mm}-${dd}`)
  }, "DATESTRING") }),
  // WORKDAY_OP: business day offset. WORKDAY(start_serial, days)
  WORKDAY_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "WORKDAY")); return { result: s[s.length-1] } }
    let days = Math.round(asNum(s.pop()!)), current = Math.round(asNum(s.pop()!))
    const epoch = new Date(1899, 11, 30)
    const dir = days > 0 ? 1 : -1
    let remaining = Math.abs(days)
    while (remaining > 0) {
      current += dir
      const dt = new Date(epoch.getTime() + current * 86400000)
      const dow = dt.getDay()
      if (dow !== 0 && dow !== 6) remaining--
    }
    const result = num(current); s.push(result); return { result }
  },
  // TEXTBEFORE_OP: text before delimiter. TEXTBEFORE(text, delimiter)
  TEXTBEFORE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "TEXTBEFORE")); return { result: s[s.length-1] } }
    const delim = s.pop()!, textVal = s.pop()!
    const text = textVal._tag === "str" ? textVal.value : vmDisplay(textVal)
    const d = delim._tag === "str" ? delim.value : vmDisplay(delim)
    const idx = text.indexOf(d)
    const result = idx < 0 ? str(text) : str(text.substring(0, idx))
    s.push(result); return { result }
  },
  // TEXTAFTER_OP: text after delimiter. TEXTAFTER(text, delimiter)
  TEXTAFTER_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "TEXTAFTER")); return { result: s[s.length-1] } }
    const delim = s.pop()!, textVal = s.pop()!
    const text = textVal._tag === "str" ? textVal.value : vmDisplay(textVal)
    const d = delim._tag === "str" ? delim.value : vmDisplay(delim)
    const idx = text.indexOf(d)
    const result = idx < 0 ? str(text) : str(text.substring(idx + d.length))
    s.push(result); return { result }
  },
  // VALUETOTEXT_OP: convert any value to text representation
  VALUETOTEXT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return str("#ERROR!")
    return str(vmDisplay(a))
  }, "VALUETOTEXT") }),
  // ISPMT_OP: interest payment for a period. ISPMT(rate, period, nper, pv)
  ISPMT_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "ISPMT")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), nper = asNum(s.pop()!), per = asNum(s.pop()!), rate = asNum(s.pop()!)
    const result = num(pv * rate * (per / nper - 1)); s.push(result); return { result }
  },
  // DISC_OP: discount rate. DISC(settlement, maturity, price, redemption)
  // Simplified: DISC = (redemption - price) / redemption * (365 / days)
  DISC_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DISC")); return { result: s[s.length-1] } }
    const redemption = asNum(s.pop()!), price = asNum(s.pop()!), maturitySerial = Math.round(asNum(s.pop()!)), settlementSerial = Math.round(asNum(s.pop()!))
    const days = maturitySerial - settlementSerial
    if (days <= 0 || redemption <= 0) { s.push(vmError("TYPE_MISMATCH", "DISC: invalid params")); return { result: s[s.length-1] } }
    const result = num((redemption - price) / redemption * (365 / days))
    s.push(result); return { result }
  },
  // INTRATE_OP: interest rate. INTRATE(settlement, maturity, investment, redemption)
  INTRATE_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "INTRATE")); return { result: s[s.length-1] } }
    const redemption = asNum(s.pop()!), investment = asNum(s.pop()!), maturitySerial = Math.round(asNum(s.pop()!)), settlementSerial = Math.round(asNum(s.pop()!))
    const days = maturitySerial - settlementSerial
    if (days <= 0 || investment <= 0) { s.push(vmError("TYPE_MISMATCH", "INTRATE: invalid params")); return { result: s[s.length-1] } }
    const result = num((redemption - investment) / investment * (365 / days))
    s.push(result); return { result }
  },
  // SYD_OP: sum-of-years-digits depreciation. SYD(cost, salvage, life, period)
  SYD_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "SYD")); return { result: s[s.length-1] } }
    const period = asNum(s.pop()!), life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    const syd = life * (life + 1) / 2 // sum of years
    const result = num((cost - salvage) * (life - period + 1) / syd)
    s.push(result); return { result }
  },
  // EFFECT_OP: effective annual interest rate. EFFECT(nominal_rate, npery)
  EFFECT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "EFFECT")); return { result: s[s.length-1] } }
    const npery = asNum(s.pop()!), nomRate = asNum(s.pop()!)
    const result = num(Math.pow(1 + nomRate / npery, npery) - 1)
    s.push(result); return { result }
  },
  // NOMINAL_OP: nominal interest rate from effective. NOMINAL(effect_rate, npery)
  NOMINAL_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "NOMINAL")); return { result: s[s.length-1] } }
    const npery = asNum(s.pop()!), effRate = asNum(s.pop()!)
    const result = num(npery * (Math.pow(1 + effRate, 1 / npery) - 1))
    s.push(result); return { result }
  },
  // NORMINV_OP: inverse normal (quantile). Uses Beasley-Springer-Moro approximation
  NORMINV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NORMINV")); return { result: s[s.length-1] } }
    const stdev = asNum(s.pop()!), mean = asNum(s.pop()!), p = asNum(s.pop()!)
    if (p <= 0 || p >= 1 || stdev <= 0) { s.push(vmError("TYPE_MISMATCH", "NORMINV: 0<p<1, stdev>0")); return { result: s[s.length-1] } }
    // Rational approximation
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    const pLow = 0.02425, pHigh = 1 - pLow
    let q: number, r: number, z: number
    if (p < pLow) { q = Math.sqrt(-2 * Math.log(p)); z = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1) }
    else if (p <= pHigh) { q = p - 0.5; r = q * q; z = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1) }
    else { q = Math.sqrt(-2 * Math.log(1 - p)); z = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1) }
    const result = num(mean + stdev * z); s.push(result); return { result }
  },
  // DDB_OP: double declining balance depreciation. DDB(cost, salvage, life, period)
  DDB_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DDB")); return { result: s[s.length-1] } }
    const period = asNum(s.pop()!), life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    let bookValue = cost
    for (let i = 1; i <= period; i++) {
      const depr = Math.min(bookValue * (2 / life), bookValue - salvage)
      if (i === period) { const result = num(depr); s.push(result); return { result } }
      bookValue -= depr
    }
    const result = num(0); s.push(result); return { result }
  },
  // PERCENTRANK_N: percentile rank of value in dataset. Stack: [target, v1, ..., vN]
  PERCENTRANK_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "PERCENTRANK")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const values = args.slice(1).map(asNum).sort((a, b) => a - b)
    let rank = 0
    for (let i = 0; i < values.length; i++) {
      if (values[i] <= target) rank = i
    }
    const result = num(rank / (values.length - 1)); s.push(result); return { result }
  },
  // QUARTILE_N: quartile (0-4). Stack: [quart, v1, ..., vN]
  QUARTILE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "QUARTILE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const quart = Math.round(asNum(args[0]))
    if (quart < 0 || quart > 4) { s.push(vmError("TYPE_MISMATCH", `QUARTILE: ${quart} not in 0-4`)); return { result: s[s.length-1] } }
    const sorted = args.slice(1).map(asNum).sort((a, b) => a - b)
    const k = (quart / 4) * (sorted.length - 1)
    const f = Math.floor(k), c = Math.ceil(k)
    const result = num(f === c ? sorted[f] : sorted[f] + (k - f) * (sorted[c] - sorted[f]))
    s.push(result); return { result }
  },
  // WEIBULL_OP: Weibull CDF. WEIBULL(x, alpha, beta) = 1 - e^(-(x/β)^α)
  WEIBULL_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "WEIBULL")); return { result: s[s.length-1] } }
    const beta = asNum(s.pop()!), alpha = asNum(s.pop()!), x = asNum(s.pop()!)
    if (x < 0 || alpha <= 0 || beta <= 0) { s.push(vmError("TYPE_MISMATCH", "WEIBULL: x≥0, α>0, β>0")); return { result: s[s.length-1] } }
    const result = num(1 - Math.exp(-Math.pow(x / beta, alpha))); s.push(result); return { result }
  },
  // GAMMADIST_OP: gamma distribution CDF (incomplete gamma). Simplified: only integer α
  // Using sum formula: P = 1 - e^(-x/β) Σ_{k=0}^{α-1} (x/β)^k / k!
  GAMMADIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "GAMMADIST")); return { result: s[s.length-1] } }
    const beta = asNum(s.pop()!), alpha = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (x < 0 || alpha < 1 || beta <= 0) { s.push(vmError("TYPE_MISMATCH", "GAMMADIST: x≥0, α≥1, β>0")); return { result: s[s.length-1] } }
    const z = x / beta
    let sum = 0, term = 1
    for (let k = 0; k < alpha; k++) { sum += term; term *= z / (k + 1) }
    const result = num(1 - Math.exp(-z) * sum); s.push(result); return { result }
  },
  // EXPONDIST_OP: exponential distribution CDF. EXPONDIST(x, lambda) = 1 - e^(-λx)
  EXPONDIST_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "EXPONDIST")); return { result: s[s.length-1] } }
    const lambda = asNum(s.pop()!), x = asNum(s.pop()!)
    if (lambda <= 0 || x < 0) { s.push(vmError("TYPE_MISMATCH", "EXPONDIST: λ>0, x≥0")); return { result: s[s.length-1] } }
    const result = num(1 - Math.exp(-lambda * x)); s.push(result); return { result }
  },
  // POISSON_OP: Poisson CDF. POISSON(x, mean) = cumulative up to x
  POISSON_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "POISSON")); return { result: s[s.length-1] } }
    const mean = asNum(s.pop()!), x = Math.round(asNum(s.pop()!))
    if (mean < 0 || x < 0) { s.push(vmError("TYPE_MISMATCH", "POISSON: mean≥0, x≥0")); return { result: s[s.length-1] } }
    let sum = 0, term = Math.exp(-mean)
    for (let k = 0; k <= x; k++) { sum += term; term *= mean / (k + 1) }
    const result = num(sum); s.push(result); return { result }
  },
  // BINOMDIST_OP: binomial CDF. BINOMDIST(successes, trials, prob) = Σ C(n,k)·p^k·(1-p)^(n-k)
  BINOMDIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BINOMDIST")); return { result: s[s.length-1] } }
    const prob = asNum(s.pop()!), trials = Math.round(asNum(s.pop()!)), successes = Math.round(asNum(s.pop()!))
    if (prob < 0 || prob > 1 || successes < 0 || trials < 0 || successes > trials) {
      s.push(vmError("TYPE_MISMATCH", "BINOMDIST: invalid params")); return { result: s[s.length-1] }
    }
    let sum = 0
    for (let k = 0; k <= successes; k++) {
      let coeff = 1; for (let i = 0; i < k; i++) coeff *= (trials - i) / (i + 1)
      sum += coeff * Math.pow(prob, k) * Math.pow(1 - prob, trials - k)
    }
    const result = num(sum); s.push(result); return { result }
  },
  // LOGNORMDIST_OP: log-normal CDF. LOGNORMDIST(x, mean, stdev) = Φ((ln(x)-mean)/stdev)
  LOGNORMDIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "LOGNORMDIST")); return { result: s[s.length-1] } }
    const stdev = asNum(s.pop()!), mean = asNum(s.pop()!), x = asNum(s.pop()!)
    if (x <= 0 || stdev <= 0) { s.push(vmError("TYPE_MISMATCH", "LOGNORMDIST: x>0, stdev>0")); return { result: s[s.length-1] } }
    const z = (Math.log(x) - mean) / stdev
    // Reuse Φ(z) approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989422804014327
    const p = d * Math.exp(-z * z / 2) * (0.319381530 * t - 0.356563782 * t*t + 1.781477937 * t*t*t - 1.821255978 * t*t*t*t + 1.330274429 * t*t*t*t*t)
    const result = num(z >= 0 ? 1 - p : p); s.push(result); return { result }
  },
  // STANDARDIZE_OP: z-score. STANDARDIZE(x, mean, stdev) = (x - mean) / stdev
  STANDARDIZE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "STANDARDIZE")); return { result: s[s.length-1] } }
    const stdev = asNum(s.pop()!), mean = asNum(s.pop()!), x = asNum(s.pop()!)
    if (stdev <= 0) { s.push(vmError("TYPE_MISMATCH", "STANDARDIZE: stdev must be > 0")); return { result: s[s.length-1] } }
    const result = num((x - mean) / stdev); s.push(result); return { result }
  },
  // CONFIDENCE_OP: confidence interval half-width. CONFIDENCE(alpha, stdev, n) = z_(1-α/2) · σ / √n
  CONFIDENCE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CONFIDENCE")); return { result: s[s.length-1] } }
    const n = asNum(s.pop()!), stdev = asNum(s.pop()!), alpha = asNum(s.pop()!)
    if (alpha <= 0 || alpha >= 1 || stdev <= 0 || n < 1) {
      s.push(vmError("TYPE_MISMATCH", "CONFIDENCE: invalid params")); return { result: s[s.length-1] }
    }
    // Approximate z-score for (1-α/2) using rational approx
    const p = 1 - alpha / 2
    const t2 = -2 * Math.log(1 - p)
    const z = Math.sqrt(t2 - Math.log(t2) / t2) // rough approximation
    const result = num(z * stdev / Math.sqrt(n)); s.push(result); return { result }
  },
  // NORMDIST_OP: cumulative normal distribution. NORMDIST(x, mean, stdev, cumulative)
  // Simplified: always cumulative, uses Abramowitz & Stegun approximation
  NORMDIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NORMDIST")); return { result: s[s.length-1] } }
    const stdev = asNum(s.pop()!), mean = asNum(s.pop()!), x = asNum(s.pop()!)
    if (stdev <= 0) { s.push(vmError("TYPE_MISMATCH", "NORMDIST: stdev must be > 0")); return { result: s[s.length-1] } }
    const z = (x - mean) / stdev
    // Abramowitz & Stegun approximation for Φ(z)
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989422804014327 // 1/sqrt(2*PI)
    const p = d * Math.exp(-z * z / 2) * (0.319381530 * t - 0.356563782 * t*t + 1.781477937 * t*t*t - 1.821255978 * t*t*t*t + 1.330274429 * t*t*t*t*t)
    const result = num(z >= 0 ? 1 - p : p); s.push(result); return { result }
  },
  // STEYX_N: standard error of predicted y. Stack: [x1,...,xK, y1,...,yK]
  STEYX_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "STEYX")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    if (half < 3) { s.push(vmError("TYPE_MISMATCH", "STEYX: need ≥3 points")); return { result: s[s.length-1] } }
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0, sumY2 = 0
    for (let i = 0; i < half; i++) { const dx = xs[i] - meanX, dy = ys[i] - meanY; sumXY += dx * dy; sumX2 += dx * dx; sumY2 += dy * dy }
    if (sumX2 === 0) { s.push(vmError("DIV_ZERO", "STEYX")); return { result: s[s.length-1] } }
    const sse = sumY2 - (sumXY * sumXY) / sumX2
    const result = num(Math.sqrt(sse / (half - 2))); s.push(result); return { result }
  },
  // FISHER_OP: Fisher transformation = 0.5 * ln((1+x)/(1-x))
  FISHER_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    if (x <= -1 || x >= 1) return vmError("TYPE_MISMATCH", "FISHER: x must be in (-1, 1)")
    return num(0.5 * Math.log((1 + x) / (1 - x)))
  }, "FISHER") }),
  // FISHERINV_OP: inverse Fisher = (e^(2x) - 1) / (e^(2x) + 1)
  FISHERINV_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    const e2x = Math.exp(2 * x)
    return num((e2x - 1) / (e2x + 1))
  }, "FISHERINV") }),
  // KURT_N: kurtosis
  KURT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "KURT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    const k = nums.length
    if (k < 4) { s.push(vmError("TYPE_MISMATCH", "KURT: need ≥4 values")); return { result: s[s.length-1] } }
    const mean = nums.reduce((a, b) => a + b, 0) / k
    const sd = Math.sqrt(nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (k - 1))
    if (sd === 0) { s.push(vmError("DIV_ZERO", "KURT")); return { result: s[s.length-1] } }
    const m4 = nums.reduce((sum, v) => sum + ((v - mean) / sd) ** 4, 0)
    const excess = (k * (k + 1) * m4) / ((k - 1) * (k - 2) * (k - 3)) - (3 * (k - 1) ** 2) / ((k - 2) * (k - 3))
    const result = num(excess); s.push(result); return { result }
  },
  // SKEW_N: skewness
  SKEW_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SKEW")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    const k = nums.length
    if (k < 3) { s.push(vmError("TYPE_MISMATCH", "SKEW: need ≥3 values")); return { result: s[s.length-1] } }
    const mean = nums.reduce((a, b) => a + b, 0) / k
    const sd = Math.sqrt(nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (k - 1))
    if (sd === 0) { s.push(vmError("DIV_ZERO", "SKEW")); return { result: s[s.length-1] } }
    const m3 = nums.reduce((sum, v) => sum + ((v - mean) / sd) ** 3, 0)
    const result = num((k * m3) / ((k - 1) * (k - 2))); s.push(result); return { result }
  },
  // CONVERT_OP: unit conversion. CONVERT(value, from_unit, to_unit)
  CONVERT_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CONVERT")); return { result: s[s.length-1] } }
    const toUnit = s.pop()!, fromUnit = s.pop()!, val = asNum(s.pop()!)
    const from = (fromUnit._tag === "str" ? fromUnit.value : vmDisplay(fromUnit)).toLowerCase()
    const to = (toUnit._tag === "str" ? toUnit.value : vmDisplay(toUnit)).toLowerCase()
    // Conversion table: everything to a base unit, then convert
    const units: Record<string, Record<string, number>> = {
      // Length: base = meter
      m: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
      // Weight: base = kg
      kg: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 907.185 },
      // Temperature: special handling
      temp: { c: 1, f: 1, k: 1 },
      // Time: base = second
      s: { s: 1, min: 60, hr: 3600, day: 86400 },
    }
    // Find category
    for (const [, category] of Object.entries(units)) {
      if (from in category && to in category) {
        // Temperature special case
        if (from === "c" || from === "f" || from === "k") {
          let celsius: number
          if (from === "c") celsius = val
          else if (from === "f") celsius = (val - 32) * 5/9
          else celsius = val - 273.15
          let result: number
          if (to === "c") result = celsius
          else if (to === "f") result = celsius * 9/5 + 32
          else result = celsius + 273.15
          const r = num(result); s.push(r); return { result: r }
        }
        const baseValue = val * category[from]
        const result = num(baseValue / category[to])
        s.push(result); return { result }
      }
    }
    s.push(vmError("TYPE_MISMATCH", `CONVERT: unknown units ${from}→${to}`)); return { result: s[s.length-1] }
  },
  // SLOPE_N: slope of linear regression. Stack: [x1,...,xK, y1,...,yK] where n=2K
  SLOPE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "SLOPE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0
    for (let i = 0; i < half; i++) { const dx = xs[i] - meanX; sumXY += dx * (ys[i] - meanY); sumX2 += dx * dx }
    if (sumX2 === 0) { s.push(vmError("DIV_ZERO", "SLOPE")); return { result: s[s.length-1] } }
    const result = num(sumXY / sumX2); s.push(result); return { result }
  },
  // INTERCEPT_N: y-intercept of linear regression. Stack: [x1,...,xK, y1,...,yK]
  INTERCEPT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "INTERCEPT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0
    for (let i = 0; i < half; i++) { const dx = xs[i] - meanX; sumXY += dx * (ys[i] - meanY); sumX2 += dx * dx }
    if (sumX2 === 0) { s.push(vmError("DIV_ZERO", "INTERCEPT")); return { result: s[s.length-1] } }
    const slope = sumXY / sumX2
    const result = num(meanY - slope * meanX); s.push(result); return { result }
  },
  // RSQ_N: R-squared (coefficient of determination). Stack: [x1,...,xK, y1,...,yK]
  RSQ_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "RSQ")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0, sumY2 = 0
    for (let i = 0; i < half; i++) { const dx = xs[i] - meanX, dy = ys[i] - meanY; sumXY += dx * dy; sumX2 += dx * dx; sumY2 += dy * dy }
    const denom = sumX2 * sumY2
    if (denom === 0) { s.push(vmError("DIV_ZERO", "RSQ")); return { result: s[s.length-1] } }
    const r = sumXY / Math.sqrt(denom)
    const result = num(r * r); s.push(result); return { result }
  },
  // COVAR_N: population covariance. COVAR(x1,...,xK, y1,...,yK) where n=2K
  COVAR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "COVAR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    const cov = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / half
    const result = num(cov); s.push(result); return { result }
  },
  // FORECAST_N: linear forecast. FORECAST(x, known_xs..., known_ys...) where n = 1 + 2K
  FORECAST_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FORECAST")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const x = asNum(args[0])
    const rest = args.slice(1)
    if (rest.length % 2 !== 0) { s.push(vmError("TYPE_MISMATCH", "FORECAST: xs and ys must be equal")); return { result: s[s.length-1] } }
    const half = rest.length / 2
    const xs = rest.slice(0, half).map(asNum), ys = rest.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0
    for (let i = 0; i < half; i++) { const dx = xs[i] - meanX; sumXY += dx * (ys[i] - meanY); sumX2 += dx * dx }
    if (sumX2 === 0) { s.push(vmError("DIV_ZERO", "FORECAST")); return { result: s[s.length-1] } }
    const slope = sumXY / sumX2
    const intercept = meanY - slope * meanX
    const result = num(slope * x + intercept); s.push(result); return { result }
  },
  // STDEVP_N: population standard deviation (divide by N not N-1)
  STDEVP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "STDEV.P")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.length === 0) { s.push(vmError("DIV_ZERO", "STDEV.P: empty")); return { result: s[s.length-1] } }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length
    const result = num(Math.sqrt(variance)); s.push(result); return { result }
  },
  // VARP_N: population variance (divide by N not N-1)
  VARP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "VAR.P")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.length === 0) { s.push(vmError("DIV_ZERO", "VAR.P: empty")); return { result: s[s.length-1] } }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const result = num(nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length)
    s.push(result); return { result }
  },
  // CORREL_N: Pearson correlation coefficient. Stack: [x1,...,xK, y1,...,yK] where n=2K
  CORREL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "CORREL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const xs = args.slice(0, half).map(asNum), ys = args.slice(half).map(asNum)
    const meanX = xs.reduce((a, b) => a + b, 0) / half
    const meanY = ys.reduce((a, b) => a + b, 0) / half
    let sumXY = 0, sumX2 = 0, sumY2 = 0
    for (let i = 0; i < half; i++) {
      const dx = xs[i] - meanX, dy = ys[i] - meanY
      sumXY += dx * dy; sumX2 += dx * dx; sumY2 += dy * dy
    }
    const denom = Math.sqrt(sumX2 * sumY2)
    if (denom === 0) { s.push(vmError("DIV_ZERO", "CORREL")); return { result: s[s.length-1] } }
    const result = num(sumXY / denom); s.push(result); return { result }
  },
  // SUMSQ_N: sum of squares
  SUMSQ_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SUMSQ")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const total = args.filter(v => !isVMError(v)).reduce((sum, v) => sum + asNum(v) ** 2, 0)
    const result = num(total); s.push(result); return { result }
  },
  // DEVSQ_N: sum of squared deviations from mean
  DEVSQ_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DEVSQ")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const total = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0)
    const result = num(total); s.push(result); return { result }
  },
  // AVEDEV_N: average absolute deviation from mean
  AVEDEV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AVEDEV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const total = nums.reduce((sum, v) => sum + Math.abs(v - mean), 0)
    const result = num(total / nums.length); s.push(result); return { result }
  },
  // TRIMMEAN_N: trimmed mean (remove % from extremes). TRIMMEAN(pct, values...)
  TRIMMEAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TRIMMEAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const pct = asNum(args[0])
    const nums = args.slice(1).filter(v => !isVMError(v)).map(asNum).sort((a, b) => a - b)
    const trim = Math.floor(nums.length * pct / 2)
    const trimmed = nums.slice(trim, nums.length - trim)
    if (trimmed.length === 0) { s.push(vmError("TYPE_MISMATCH", "TRIMMEAN: all trimmed")); return { result: s[s.length-1] } }
    const result = num(trimmed.reduce((a, b) => a + b, 0) / trimmed.length); s.push(result); return { result }
  },
  // XOR_N: exclusive OR — true if odd number of TRUE args
  XOR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "XOR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let trueCount = 0
    for (const v of args) { if (!isVMError(v) && asNum(v) !== 0) trueCount++ }
    const result = bool(trueCount % 2 === 1); s.push(result); return { result }
  },
  // ISOWEEKNUM_OP: ISO 8601 week number from serial date
  ISOWEEKNUM_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const serial = Math.round(asNum(a))
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + serial * 86400000)
    // ISO week: week containing Thursday determines the week number
    const jan4 = new Date(d.getFullYear(), 0, 4)
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1
    const dayOfWeek = d.getDay() || 7 // Mon=1..Sun=7
    const weekNum = Math.ceil((dayOfYear - dayOfWeek + 10) / 7)
    return num(weekNum)
  }, "ISOWEEKNUM") }),
  // NETWORKDAYS_OP: business days between two serial dates (excludes weekends)
  NETWORKDAYS_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "NETWORKDAYS")); return { result: s[s.length-1] } }
    const end = Math.round(asNum(s.pop()!)), start = Math.round(asNum(s.pop()!))
    const epoch = new Date(1899, 11, 30)
    let count = 0
    const dir = start <= end ? 1 : -1
    for (let d = start; dir > 0 ? d <= end : d >= end; d += dir) {
      const dt = new Date(epoch.getTime() + d * 86400000)
      const dow = dt.getDay()
      if (dow !== 0 && dow !== 6) count++
    }
    const result = num(count * dir); s.push(result); return { result }
  },
  // SUBTOTAL_N: Excel SUBTOTAL dispatcher. SUBTOTAL(function_num, values...)
  SUBTOTAL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SUBTOTAL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const funcNum = Math.round(asNum(args[0]))
    const values = args.slice(1).filter(v => !isVMError(v)).map(asNum)
    let val: number
    switch (funcNum) {
      case 1: case 101: val = values.reduce((a, b) => a + b, 0) / values.length; break // AVG
      case 2: case 102: val = values.length; break // COUNT
      case 4: case 104: val = Math.max(...values); break // MAX
      case 5: case 105: val = Math.min(...values); break // MIN
      case 9: case 109: val = values.reduce((a, b) => a + b, 0); break // SUM
      default: { s.push(vmError("TYPE_MISMATCH", `SUBTOTAL: unknown func ${funcNum}`)); return { result: s[s.length-1] } }
    }
    const result = num(val); s.push(result); return { result }
  },
  // DELTA_OP: Kronecker delta. DELTA(a, b) = 1 if a==b, 0 otherwise
  DELTA_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DELTA")); return { result: s[s.length-1] } }
    const b = asNum(s.pop()!), a = asNum(s.pop()!)
    const result = num(a === b ? 1 : 0); s.push(result); return { result }
  },
  // GESTEP_OP: step function. GESTEP(x, step) = 1 if x>=step, 0 otherwise
  GESTEP_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "GESTEP")); return { result: s[s.length-1] } }
    const step = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = num(x >= step ? 1 : 0); s.push(result); return { result }
  },
  // MULTINOMIAL_N: multinomial(a,b,c) = (a+b+c)! / (a!*b!*c!)
  MULTINOMIAL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MULTINOMIAL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(v => Math.round(asNum(v)))
    const total = args.reduce((a, b) => a + b, 0)
    const factorial = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r }
    const denom = args.reduce((p, v) => p * factorial(v), 1)
    const result = num(factorial(total) / denom); s.push(result); return { result }
  },
  // SERIESSUM_N: power series sum. SERIESSUM(x, n, m, coeff...) = Σ coeff_i * x^(n + i*m)
  SERIESSUM_N: (op: any, s) => {
    const nArgs = op.n as number
    if (s.length < nArgs) { s.push(vmError("STACK_UNDERFLOW", "SERIESSUM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - nArgs, nArgs)
    const x = asNum(args[0]), n2 = asNum(args[1]), m = asNum(args[2])
    let total = 0
    for (let i = 3; i < args.length; i++) { total += asNum(args[i]) * Math.pow(x, n2 + (i - 3) * m) }
    const result = num(total); s.push(result); return { result }
  },
  // SEC_OP: secant = 1/cos
  SEC_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const c = Math.cos(asNum(a)); return c === 0 ? vmError("DIV_ZERO", "SEC") : num(1 / c) }, "SEC") }),
  // CSC_OP: cosecant = 1/sin
  CSC_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sn = Math.sin(asNum(a)); return sn === 0 ? vmError("DIV_ZERO", "CSC") : num(1 / sn) }, "CSC") }),
  // COTH_OP: hyperbolic cotangent = cosh/sinh
  COTH_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sn = Math.sinh(asNum(a)); return sn === 0 ? vmError("DIV_ZERO", "COTH") : num(Math.cosh(asNum(a)) / sn) }, "COTH") }),
  // SECH_OP: hyperbolic secant = 1/cosh
  SECH_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(1 / Math.cosh(asNum(a))) }, "SECH") }),
  // CSCH_OP: hyperbolic cosecant = 1/sinh
  CSCH_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sn = Math.sinh(asNum(a)); return sn === 0 ? vmError("DIV_ZERO", "CSCH") : num(1 / sn) }, "CSCH") }),
  // SUMIFS_N: sum matching ALL criteria (dual-criteria). Stack: [criteria1, criteria2, v1, ..., vN]
  SUMIFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SUMIFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const c1 = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const c2 = args[1]._tag === "str" ? args[1].value : vmDisplay(args[1])
    const pred1 = parseCriteria(c1), pred2 = parseCriteria(c2)
    let total = 0
    for (const v of args.slice(2)) { if (pred1(v) && pred2(v)) total += asNum(v) }
    const result = num(total); s.push(result); return { result }
  },
  // AVERAGEIFS_N: average matching ALL criteria. Stack: [criteria1, criteria2, v1, ..., vN]
  AVERAGEIFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AVERAGEIFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const c1 = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const c2 = args[1]._tag === "str" ? args[1].value : vmDisplay(args[1])
    const pred1 = parseCriteria(c1), pred2 = parseCriteria(c2)
    let total = 0, count = 0
    for (const v of args.slice(2)) { if (pred1(v) && pred2(v)) { total += asNum(v); count++ } }
    if (count === 0) { s.push(vmError("DIV_ZERO", "AVERAGEIFS: no matches")); return { result: s[s.length-1] } }
    const result = num(total / count); s.push(result); return { result }
  },
  // NA_OP: generate #N/A error
  NA_OP: (_o, s) => { const result = vmError("TYPE_MISMATCH", "#N/A"); s.push(result); return { result } },
  // COT_OP: cotangent
  COT_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const n = asNum(a); return n === 0 ? vmError("DIV_ZERO", "COT(0)") : num(1 / Math.tan(n)) }, "COT") }),
  // ACOT_OP: inverse cotangent = PI/2 - atan(x)
  ACOT_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(Math.PI / 2 - Math.atan(asNum(a))) }, "ACOT") }),
  // UNICODE_OP: get unicode code point of first char
  UNICODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = a._tag === "str" ? a.value : vmDisplay(a)
    if (text.length === 0) return vmError("TYPE_MISMATCH", "UNICODE: empty string")
    return num(text.codePointAt(0)!)
  }, "UNICODE") }),
  // UNICHAR_OP: unicode code point to character
  UNICHAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const cp = Math.round(asNum(a))
    return str(String.fromCodePoint(cp))
  }, "UNICHAR") }),
  // ENCODEURL_OP: percent-encode a string
  ENCODEURL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = a._tag === "str" ? a.value : vmDisplay(a)
    return str(encodeURIComponent(text))
  }, "ENCODEURL") }),
  // DAYS_OP: days between two serial dates. DAYS(end, start) = end - start
  DAYS_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DAYS")); return { result: s[s.length-1] } }
    const start = Math.round(asNum(s.pop()!)), end = Math.round(asNum(s.pop()!))
    const result = num(end - start); s.push(result); return { result }
  },
  // DATEVALUE_OP: parse date string to Excel serial number
  DATEVALUE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = a._tag === "str" ? a.value : vmDisplay(a)
    const d = new Date(text)
    if (isNaN(d.getTime())) return vmError("TYPE_MISMATCH", `DATEVALUE: "${text}"`)
    // Excel serial: days since Dec 30, 1899
    const epoch = new Date(1899, 11, 30)
    return num(Math.floor((d.getTime() - epoch.getTime()) / 86400000))
  }, "DATEVALUE") }),
  // EDATE_OP: add months to serial date. EDATE(start_serial, months)
  EDATE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "EDATE")); return { result: s[s.length-1] } }
    const months = Math.round(asNum(s.pop()!)), serial = Math.round(asNum(s.pop()!))
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + serial * 86400000)
    d.setMonth(d.getMonth() + months)
    const resultSerial = Math.floor((d.getTime() - epoch.getTime()) / 86400000)
    const result = num(resultSerial); s.push(result); return { result }
  },
  // WEEKDAY_OP: day of week (1=Sun ... 7=Sat) from Excel serial date
  WEEKDAY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    // Excel serial: day 1 = Jan 1, 1900 (Monday). Day 0 is a bug but convention.
    // (serial + 6) % 7 + 1 maps to 1=Sun...7=Sat
    const serial = Math.floor(asNum(a))
    return num((serial + 6) % 7 + 1)
  }, "WEEKDAY") }),
  // WEEKNUM_OP: week number of the year
  WEEKNUM_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const serial = Math.floor(asNum(a))
    // Approximate: week = ceil(dayOfYear / 7)
    // For Excel serial: Jan 1, 1900 = 1
    // Use modular approach: week number within year
    const d = new Date(1900, 0, serial) // serial 1 = Jan 1, 1900
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1
    return num(Math.ceil(dayOfYear / 7))
  }, "WEEKNUM") }),
  // ARABIC_OP: convert Roman numerals to number
  ARABIC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const roman = (a._tag === "str" ? a.value : vmDisplay(a)).toUpperCase()
    const map: Record<string, number> = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 }
    let result = 0
    for (let i = 0; i < roman.length; i++) {
      const curr = map[roman[i]] ?? 0, next = map[roman[i+1]] ?? 0
      result += curr < next ? -curr : curr
    }
    return num(result)
  }, "ARABIC") }),
  // TEXT_OP: format number as text. TEXT(number, format). Supports: "0.00", "#,##0", "0%"
  TEXT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "TEXT")); return { result: s[s.length-1] } }
    const fmtVal = s.pop()!, fmt = fmtVal._tag === "str" ? fmtVal.value : vmDisplay(fmtVal), value = asNum(s.pop()!)
    let formatted: string
    if (fmt.includes("%")) {
      const decimals = (fmt.match(/0+$/)?.[0]?.length ?? 0)
      formatted = (value * 100).toFixed(Math.max(0, decimals - 1)) + "%"
    } else if (fmt.includes("#,##0") || fmt.includes(",")) {
      const decimals = fmt.includes(".") ? (fmt.split(".")[1]?.replace(/[^0#]/g, "").length ?? 0) : 0
      formatted = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    } else {
      const decimals = fmt.includes(".") ? (fmt.split(".")[1]?.replace(/[^0]/g, "").length ?? 0) : 0
      formatted = value.toFixed(decimals)
    }
    const result = str(formatted); s.push(result); return { result }
  },
  // NUMBERVALUE_OP: parse text to number. NUMBERVALUE("1,234.56") → 1234.56
  NUMBERVALUE_OP: (_o, s) => {
    if (s.length < 1) { s.push(vmError("STACK_UNDERFLOW", "NUMBERVALUE")); return { result: s[s.length-1] } }
    const rawVal = s.pop()!, raw = rawVal._tag === "str" ? rawVal.value : vmDisplay(rawVal)
    const cleaned = raw.replace(/[,$\s]/g, "").replace(/%$/, "")
    const n = Number(cleaned)
    if (isNaN(n)) { s.push(vmError("TYPE_MISMATCH", `NUMBERVALUE: "${raw}"`)); return { result: s[s.length-1] } }
    const result = raw.endsWith("%") ? num(n / 100) : num(n)
    s.push(result); return { result }
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

  // IRR_N: internal rate of return via Newton-Raphson. Stack: [cf0, cf1, ..., cfN]
  IRR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "IRR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    // Newton-Raphson: find rate where NPV(rate, cfs) = 0
    let rate = 0.1 // initial guess
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, dnpv = 0
      for (let i = 0; i < args.length; i++) {
        npv += args[i] / Math.pow(1 + rate, i)
        dnpv -= i * args[i] / Math.pow(1 + rate, i + 1)
      }
      if (Math.abs(npv) < 1e-10) break
      if (dnpv === 0) { s.push(vmError("TYPE_MISMATCH", "IRR: no convergence")); return { result: s[s.length-1] } }
      const next = rate - npv / dnpv
      if (Math.abs(next - rate) < 1e-10) { rate = next; break }
      rate = next
    }
    const result = num(rate); s.push(result); return { result }
  },

  // SLN_OP: straight-line depreciation. SLN(cost, salvage, life)
  SLN_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SLN")); return { result: s[s.length-1] } }
    const life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    if (life === 0) { s.push(vmError("DIV_ZERO", "SLN: life=0")); return { result: s[s.length-1] } }
    const result = num((cost - salvage) / life); s.push(result); return { result }
  },

  // RATE_OP: solve for interest rate. RATE(nper, pmt, pv) via Newton-Raphson
  RATE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "RATE")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), pmt = asNum(s.pop()!), nper = asNum(s.pop()!)
    if (nper <= 0) { s.push(vmError("TYPE_MISMATCH", "RATE: nper≤0")); return { result: s[s.length-1] } }
    // Newton-Raphson: find r where pv + pmt*(1-(1+r)^-nper)/r = 0
    let rate = 0.1
    for (let iter = 0; iter < 100; iter++) {
      const f1 = Math.pow(1 + rate, nper)
      const f = pv * f1 + pmt * (f1 - 1) / rate
      const df = pv * nper * Math.pow(1 + rate, nper - 1) + pmt * (nper * rate * Math.pow(1 + rate, nper - 1) - (f1 - 1)) / (rate * rate)
      if (Math.abs(df) < 1e-15) break
      const next = rate - f / df
      if (Math.abs(next - rate) < 1e-10) { rate = next; break }
      rate = next
    }
    const result = num(rate); s.push(result); return { result }
  },

  // DB_OP: declining balance depreciation. DB(cost, salvage, life, period)
  DB_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DB")); return { result: s[s.length-1] } }
    const period = asNum(s.pop()!), life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    if (life <= 0 || period <= 0 || period > life) { s.push(vmError("TYPE_MISMATCH", "DB: invalid args")); return { result: s[s.length-1] } }
    const rate = 1 - Math.pow(salvage / cost, 1 / life)
    const rateRounded = Math.round(rate * 1000) / 1000 // Excel rounds rate to 3 decimal places
    let value = cost
    for (let i = 1; i <= period; i++) {
      const depreciation = value * rateRounded
      if (i === Math.floor(period)) { const result = num(Math.round(depreciation * 100) / 100); s.push(result); return { result } }
      value -= depreciation
    }
    const result = num(0); s.push(result); return { result }
  },

  // NPV_N: net present value. Stack: [rate, cf1, cf2, ..., cfN]
  NPV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NPV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const rate = asNum(args[0])
    let npv = 0
    for (let i = 1; i < args.length; i++) {
      npv += asNum(args[i]) / Math.pow(1 + rate, i)
    }
    const result = num(npv); s.push(result); return { result }
  },

  // VAR_N: sample variance of N values (STDEV²)
  VAR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "VAR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.length < 2) { const err = vmError("TYPE_MISMATCH", "VAR: need ≥2 values"); s.push(err); return { result: err } }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1)
    const result = num(variance)
    s.push(result); return { result }
  },

  // PERCENTILE_N: k-th percentile (0-1). Stack: [k, v1, ..., vN]
  PERCENTILE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[0])
    if (k < 0 || k > 1) { const err = vmError("TYPE_MISMATCH", `PERCENTILE: k=${k} out of [0,1]`); s.push(err); return { result: err } }
    const nums = args.slice(1).filter(v => !isVMError(v)).map(asNum).sort((a, b) => a - b)
    if (nums.length === 0) { s.push(vmError("TYPE_MISMATCH", "PERCENTILE: empty")); return { result: s[s.length-1] } }
    const index = k * (nums.length - 1)
    const lo = Math.floor(index), hi = Math.ceil(index)
    const result = lo === hi ? num(nums[lo]) : num(nums[lo] + (nums[hi] - nums[lo]) * (index - lo))
    s.push(result); return { result }
  },

  // COUNTA_N: count non-blank values
  COUNTA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let count = 0
    for (const v of args) { if (v._tag !== "blank") count++ }
    const result = num(count); s.push(result); return { result }
  },

  // COUNTBLANK_N: count blank values
  COUNTBLANK_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTBLANK")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let count = 0
    for (const v of args) { if (v._tag === "blank") count++ }
    const result = num(count); s.push(result); return { result }
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

  // MAXIFS_N: max of values matching criteria. Stack: [criteria, v1, ..., vN]
  MAXIFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAXIFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    let max = -Infinity, found = false
    for (const v of args.slice(1)) { if (pred(v)) { const n = asNum(v); if (n > max) { max = n; found = true } } }
    if (!found) { const err = vmError("TYPE_MISMATCH", "MAXIFS: no matches"); s.push(err); return { result: err } }
    const result = num(max); s.push(result); return { result }
  },
  // MINIFS_N: min of values matching criteria
  MINIFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MINIFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const criteriaRaw = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const pred = parseCriteria(criteriaRaw)
    let min = Infinity, found = false
    for (const v of args.slice(1)) { if (pred(v)) { const n = asNum(v); if (n < min) { min = n; found = true } } }
    if (!found) { const err = vmError("TYPE_MISMATCH", "MINIFS: no matches"); s.push(err); return { result: err } }
    const result = num(min); s.push(result); return { result }
  },
  // IFNA_OP: return alt value if error is N/A (or any error for simplicity)
  IFNA_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IFNA")); return { result: s[s.length-1] } }
    const alt = s.pop()!, val = s.pop()!
    const result = isVMError(val) ? alt : val; s.push(result); return { result }
  },
  // EOMONTH_OP: end of month + months offset. EOMONTH(serial, months)
  EOMONTH_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "EOMONTH")); return { result: s[s.length-1] } }
    const months = Math.round(asNum(s.pop()!)), serial = Math.round(asNum(s.pop()!))
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + serial * 86400000)
    d.setMonth(d.getMonth() + months + 1, 0) // day 0 of next month = last day of target month
    const result = num(Math.floor((d.getTime() - epoch.getTime()) / 86400000))
    s.push(result); return { result }
  },
  // DATEDIF_OP: date difference. DATEDIF(start, end, unit). unit: "d"=days, "m"=months, "y"=years
  DATEDIF_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "DATEDIF")); return { result: s[s.length-1] } }
    const unitVal = s.pop()!, endSerial = Math.round(asNum(s.pop()!)), startSerial = Math.round(asNum(s.pop()!))
    const unit = (unitVal._tag === "str" ? unitVal.value : vmDisplay(unitVal)).toUpperCase()
    const epoch = new Date(1899, 11, 30)
    const start = new Date(epoch.getTime() + startSerial * 86400000)
    const end = new Date(epoch.getTime() + endSerial * 86400000)
    let val: number
    switch (unit) {
      case "D": val = endSerial - startSerial; break
      case "M": val = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()); break
      case "Y": val = end.getFullYear() - start.getFullYear(); break
      default: { s.push(vmError("TYPE_MISMATCH", `DATEDIF: unknown unit "${unit}"`)); return { result: s[s.length-1] } }
    }
    const result = num(val); s.push(result); return { result }
  },
  // PERMUT_OP: permutations. PERMUT(n, k) = n!/(n-k)!
  PERMUT_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "PERMUT")); return { result: s[s.length-1] } }
    const k = Math.round(asNum(s.pop()!)), n = Math.round(asNum(s.pop()!))
    if (k < 0 || k > n) { s.push(vmError("TYPE_MISMATCH", `PERMUT: k=${k}, n=${n}`)); return { result: s[s.length-1] } }
    let p = 1; for (let i = n; i > n - k; i--) p *= i
    const result = num(p); s.push(result); return { result }
  },
  // FACTDOUBLE_OP: double factorial. n!! = n*(n-2)*(n-4)*...
  FACTDOUBLE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a))
    if (n < 0) return vmError("TYPE_MISMATCH", `FACTDOUBLE: ${n}<0`)
    let result = 1; while (n > 1) { result *= n; n -= 2 }
    return num(result)
  }, "FACTDOUBLE") }),
  // MATCH_N: find position of value in list. Stack: [lookup, v1, ..., vN] → 1-based position
  MATCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MATCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const lookup = args[0]
    const lookupNum = lookup._tag === "num" ? lookup.value : NaN
    const lookupStr = lookup._tag === "str" ? lookup.value.toLowerCase() : ""
    for (let i = 1; i < args.length; i++) {
      const v = args[i]
      if (lookup._tag === "num" && v._tag === "num" && v.value === lookupNum) {
        const result = num(i); s.push(result); return { result }
      }
      if (lookup._tag === "str" && v._tag === "str" && v.value.toLowerCase() === lookupStr) {
        const result = num(i); s.push(result); return { result }
      }
    }
    s.push(vmError("TYPE_MISMATCH", "MATCH: not found")); return { result: s[s.length-1] }
  },
  // INDEX_N: return value at position. Stack: [position, v1, ..., vN]
  INDEX_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "INDEX")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const pos = Math.round(asNum(args[0]))
    if (pos < 1 || pos >= args.length) { s.push(vmError("TYPE_MISMATCH", `INDEX: position ${pos} out of range`)); return { result: s[s.length-1] } }
    const result = args[pos]; s.push(result); return { result }
  },
  // MODE_N: statistical mode (most frequent value)
  MODE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MODE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    const freq = new Map<number, number>()
    for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1)
    let maxFreq = 0, modeVal = nums[0]
    for (const [val, cnt] of freq) { if (cnt > maxFreq) { maxFreq = cnt; modeVal = val } }
    if (maxFreq <= 1) { s.push(vmError("TYPE_MISMATCH", "MODE: no repeated value")); return { result: s[s.length-1] } }
    const result = num(modeVal); s.push(result); return { result }
  },
  // HARMEAN_N: harmonic mean = N / sum(1/xi)
  HARMEAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "HARMEAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.some(v => v <= 0)) { s.push(vmError("TYPE_MISMATCH", "HARMEAN: all values must be > 0")); return { result: s[s.length-1] } }
    const sumReciprocal = nums.reduce((sum, v) => sum + 1 / v, 0)
    const result = num(nums.length / sumReciprocal); s.push(result); return { result }
  },
  // GEOMEAN_N: geometric mean = (x1*x2*...*xn)^(1/n)
  GEOMEAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GEOMEAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(v => !isVMError(v)).map(asNum)
    if (nums.some(v => v <= 0)) { s.push(vmError("TYPE_MISMATCH", "GEOMEAN: all values must be > 0")); return { result: s[s.length-1] } }
    const logSum = nums.reduce((sum, v) => sum + Math.log(v), 0)
    const result = num(Math.exp(logSum / nums.length)); s.push(result); return { result }
  },
  // AGGREGATE_N: versatile aggregation. Stack: [funcNum, v1, ..., vN]
  // funcNum: 1=AVG, 2=COUNT, 3=COUNTA, 4=MAX, 5=MIN, 6=PRODUCT, 7=STDEV, 9=SUM, 12=MEDIAN, 13=VAR
  AGGREGATE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AGGREGATE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const funcNum = Math.round(asNum(args[0]))
    const values = args.slice(1)
    const nums = values.filter(v => !isVMError(v)).map(asNum)
    let val: number
    switch (funcNum) {
      case 1: val = nums.reduce((a, b) => a + b, 0) / nums.length; break // AVG
      case 2: val = nums.length; break // COUNT
      case 3: val = values.length; break // COUNTA
      case 4: val = Math.max(...nums); break // MAX
      case 5: val = Math.min(...nums); break // MIN
      case 6: val = nums.reduce((a, b) => a * b, 1); break // PRODUCT
      case 7: { const mean = nums.reduce((a, b) => a + b, 0) / nums.length; val = Math.sqrt(nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1)); break } // STDEV
      case 9: val = nums.reduce((a, b) => a + b, 0); break // SUM
      case 12: { const sorted = [...nums].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); val = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; break } // MEDIAN
      case 13: { const m = nums.reduce((a, b) => a + b, 0) / nums.length; val = nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / (nums.length - 1); break } // VAR
      default: { s.push(vmError("TYPE_MISMATCH", `AGGREGATE: unknown function ${funcNum}`)); return { result: s[s.length-1] } }
    }
    const result = num(val); s.push(result); return { result }
  },

  // COUNTIFS_N: count matching ALL criteria. Stack: [criteria1, criteria2, v1, ..., vN]
  // Values are tested against ALL criteria (AND logic)
  COUNTIFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTIFS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    // First 2 args are criteria, rest are values
    const criteria1 = args[0]._tag === "str" ? args[0].value : vmDisplay(args[0])
    const criteria2 = args[1]._tag === "str" ? args[1].value : vmDisplay(args[1])
    const pred1 = parseCriteria(criteria1), pred2 = parseCriteria(criteria2)
    let count = 0
    for (const v of args.slice(2)) { if (pred1(v) && pred2(v)) count++ }
    const result = num(count); s.push(result); return { result }
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
  ISLOGICAL_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "bool"), "ISLOGICAL") }),
  ISNONTEXT_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag !== "str"), "ISNONTEXT") }),
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
  // PMT: loan payment. PMT(rate, nper, pv) = pv * rate / (1 - (1+rate)^-nper)
  PMT_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "PMT")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), nper = asNum(s.pop()!), rate = asNum(s.pop()!)
    if (nper === 0) { const err = vmError("TYPE_MISMATCH", "PMT: nper=0"); s.push(err); return { result: err } }
    if (rate === 0) { const result = num(-pv / nper); s.push(result); return { result } }
    const result = num(-pv * rate / (1 - Math.pow(1 + rate, -nper)))
    s.push(result); return { result }
  },
  // FV: future value. FV(rate, nper, pmt) = -pmt * ((1+rate)^nper - 1) / rate
  FV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "FV")); return { result: s[s.length-1] } }
    const pmt = asNum(s.pop()!), nper = asNum(s.pop()!), rate = asNum(s.pop()!)
    if (rate === 0) { const result = num(-pmt * nper); s.push(result); return { result } }
    const result = num(-pmt * (Math.pow(1 + rate, nper) - 1) / rate)
    s.push(result); return { result }
  },
  // PV: present value. PV(rate, nper, pmt) = -pmt * (1 - (1+rate)^-nper) / rate
  PV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "PV")); return { result: s[s.length-1] } }
    const pmt = asNum(s.pop()!), nper = asNum(s.pop()!), rate = asNum(s.pop()!)
    if (rate === 0) { const result = num(-pmt * nper); s.push(result); return { result } }
    const result = num(-pmt * (1 - Math.pow(1 + rate, -nper)) / rate)
    s.push(result); return { result }
  },
  // NPER: number of periods. NPER(rate, pmt, pv) = ln(pmt/(pmt + pv*rate)) / ln(1+rate)
  NPER_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NPER")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), pmt = asNum(s.pop()!), rate = asNum(s.pop()!)
    if (rate === 0) { if (pmt === 0) { s.push(vmError("DIV_ZERO", "NPER: pmt=0")); return { result: s[s.length-1] } }; const result = num(-pv / pmt); s.push(result); return { result } }
    const denom = pmt + pv * rate
    if (denom === 0 || pmt === 0) { s.push(vmError("TYPE_MISMATCH", "NPER: no solution")); return { result: s[s.length-1] } }
    const x = pmt / denom
    if (x <= 0) { s.push(vmError("TYPE_MISMATCH", "NPER: no solution")); return { result: s[s.length-1] } }
    const result = num(Math.log(x) / Math.log(1 + rate)); s.push(result); return { result }
  },
  MROUND_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "MROUND")); return { result: s[s.length-1] } }
    const multiple = asNum(s.pop()!), value = asNum(s.pop()!)
    if (multiple === 0) { const result = num(0); s.push(result); return { result } }
    const result = num(Math.round(value / multiple) * multiple); s.push(result); return { result }
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
  // SQRTPI: square root of (PI * number)
  SQRTPI_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(Math.sqrt(Math.PI * asNum(a))) }, "SQRTPI") }),
  // BASE: convert number to string in given base. BASE(number, radix)
  BASE_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "BASE")); return { result: s[s.length-1] } }
    const radix = Math.round(asNum(s.pop()!)), value = Math.round(asNum(s.pop()!))
    if (radix < 2 || radix > 36) { s.push(vmError("TYPE_MISMATCH", `BASE: radix ${radix} out of [2,36]`)); return { result: s[s.length-1] } }
    const result = str(value.toString(radix).toUpperCase()); s.push(result); return { result }
  },
  // DECIMAL_OP: parse string in given base to number. DECIMAL("FF", 16) → 255
  DECIMAL_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "DECIMAL")); return { result: s[s.length-1] } }
    const radix = Math.round(asNum(s.pop()!))
    const textVal = s.pop()!, text = textVal._tag === "str" ? textVal.value : vmDisplay(textVal)
    const n = parseInt(text, radix)
    if (isNaN(n)) { s.push(vmError("TYPE_MISMATCH", `DECIMAL: "${text}" base ${radix}`)); return { result: s[s.length-1] } }
    const result = num(n); s.push(result); return { result }
  },
  // CEILING_MATH: round up to nearest significance. CEILING.MATH(number, significance)
  CEILING_MATH_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "CEILING.MATH")); return { result: s[s.length-1] } }
    const sig = asNum(s.pop()!), value = asNum(s.pop()!)
    if (sig === 0) { const result = num(0); s.push(result); return { result } }
    const result = num(Math.ceil(value / sig) * sig); s.push(result); return { result }
  },
  // FLOOR_MATH: round down to nearest significance
  FLOOR_MATH_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "FLOOR.MATH")); return { result: s[s.length-1] } }
    const sig = asNum(s.pop()!), value = asNum(s.pop()!)
    if (sig === 0) { const result = num(0); s.push(result); return { result } }
    const result = num(Math.floor(value / sig) * sig); s.push(result); return { result }
  },
  // ROUNDUP/ROUNDDOWN: round away from / toward zero (2-arg: number, digits)
  ROUNDUP_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "ROUNDUP")); return { result: s[s.length-1] } }
    const digits = Math.round(asNum(s.pop()!)), value = asNum(s.pop()!)
    const factor = Math.pow(10, digits)
    const result = num(value >= 0 ? Math.ceil(value * factor) / factor : Math.floor(value * factor) / factor)
    s.push(result); return { result }
  },
  ROUNDDOWN_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "ROUNDDOWN")); return { result: s[s.length-1] } }
    const digits = Math.round(asNum(s.pop()!)), value = asNum(s.pop()!)
    const factor = Math.pow(10, digits)
    const result = num(Math.trunc(value * factor) / factor)
    s.push(result); return { result }
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
  CHAR_OP: { _tag: "CHAR_OP" }, CODE_OP: { _tag: "CODE_OP" }, T_OP: { _tag: "T_OP" },
  ISLOGICAL_OP: { _tag: "ISLOGICAL_OP" }, ISNONTEXT_OP: { _tag: "ISNONTEXT_OP" }, ERROR_TYPE_OP: { _tag: "ERROR_TYPE_OP" },
  ISEVEN_OP: { _tag: "ISEVEN_OP" }, ISODD_OP: { _tag: "ISODD_OP" },
  INT_OP: { _tag: "INT_OP" }, EVEN_OP: { _tag: "EVEN_OP" }, ODD_OP: { _tag: "ODD_OP" },
  SQRTPI_OP: { _tag: "SQRTPI_OP" }, BASE_OP: { _tag: "BASE_OP" }, DECIMAL_OP: { _tag: "DECIMAL_OP" },
  CEILING_MATH_OP: { _tag: "CEILING_MATH_OP" }, FLOOR_MATH_OP: { _tag: "FLOOR_MATH_OP" },
  ROUNDUP_OP: { _tag: "ROUNDUP_OP" }, ROUNDDOWN_OP: { _tag: "ROUNDDOWN_OP" },
  TRUNC_OP: { _tag: "TRUNC_OP" }, EXP_OP: { _tag: "EXP_OP" }, LN_OP: { _tag: "LN_OP" }, LOG2_OP: { _tag: "LOG2_OP" },
  RAND_BETWEEN: { _tag: "RAND_BETWEEN" }, RATE_OP: { _tag: "RATE_OP" }, DB_OP: { _tag: "DB_OP" }, NPER_OP: { _tag: "NPER_OP" }, SLN_OP: { _tag: "SLN_OP" }, PMT_OP: { _tag: "PMT_OP" }, FV_OP: { _tag: "FV_OP" }, PV_OP: { _tag: "PV_OP" },
  MROUND_OP: { _tag: "MROUND_OP" }, FIXED_OP: { _tag: "FIXED_OP" }, DOLLAR_OP: { _tag: "DOLLAR_OP" },
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
  IFNA_OP: { _tag: "IFNA_OP" }, EOMONTH_OP: { _tag: "EOMONTH_OP" }, DATEDIF_OP: { _tag: "DATEDIF_OP" },
  PERMUT_OP: { _tag: "PERMUT_OP" }, FACTDOUBLE_OP: { _tag: "FACTDOUBLE_OP" },
  ISNUMBER_OP: { _tag: "ISNUMBER_OP" }, ISTEXT_OP: { _tag: "ISTEXT_OP" }, ISEVEN_OP: { _tag: "ISEVEN_OP" }, ISODD_OP: { _tag: "ISODD_OP" }, N_OP: { _tag: "N_OP" }, T_OP: { _tag: "T_OP" }, LEFTB_OP: { _tag: "LEFTB_OP" }, RIGHTB_OP: { _tag: "RIGHTB_OP" }, LENB_OP: { _tag: "LENB_OP" }, BAHTTEXT_OP: { _tag: "BAHTTEXT_OP" }, PHONETIC_OP: { _tag: "PHONETIC_OP" }, BESSELY_OP: { _tag: "BESSELY_OP" }, HEX2BIN_OP: { _tag: "HEX2BIN_OP" }, HEX2OCT_OP: { _tag: "HEX2OCT_OP" }, OCT2BIN_OP: { _tag: "OCT2BIN_OP" }, OCT2HEX_OP: { _tag: "OCT2HEX_OP" }, IMTAN_OP: { _tag: "IMTAN_OP" }, IMLOG2_OP: { _tag: "IMLOG2_OP" }, IMLOG10_OP: { _tag: "IMLOG10_OP" }, RANDBETWEEN_FLOAT_OP: { _tag: "RANDBETWEEN_FLOAT_OP" }, FORMULATEXT_OP: { _tag: "FORMULATEXT_OP" }, ADDRESS_OP: { _tag: "ADDRESS_OP" }, IMDIV_OP: { _tag: "IMDIV_OP" }, IMSUB_OP: { _tag: "IMSUB_OP" }, BIN2DEC_OP: { _tag: "BIN2DEC_OP" }, DEC2BIN_OP: { _tag: "DEC2BIN_OP" }, BIN2HEX_OP: { _tag: "BIN2HEX_OP" }, HEX2DEC_OP: { _tag: "HEX2DEC_OP" }, DEC2HEX_OP: { _tag: "DEC2HEX_OP" }, OCT2DEC_OP: { _tag: "OCT2DEC_OP" }, DEC2OCT_OP: { _tag: "DEC2OCT_OP" }, BITAND_OP: { _tag: "BITAND_OP" }, BITOR_OP: { _tag: "BITOR_OP" }, BITXOR_OP: { _tag: "BITXOR_OP" }, BITLSHIFT_OP: { _tag: "BITLSHIFT_OP" }, BITRSHIFT_OP: { _tag: "BITRSHIFT_OP" }, IMPOWER_OP: { _tag: "IMPOWER_OP" }, IMEXP_OP: { _tag: "IMEXP_OP" }, IMLN_OP: { _tag: "IMLN_OP" }, IMSIN_OP: { _tag: "IMSIN_OP" }, IMCOS_OP: { _tag: "IMCOS_OP" }, IMSUM_OP: { _tag: "IMSUM_OP" }, IMPRODUCT_OP: { _tag: "IMPRODUCT_OP" }, IMARGUMENT_OP: { _tag: "IMARGUMENT_OP" }, IMCONJUGATE_OP: { _tag: "IMCONJUGATE_OP" }, IMSQRT_OP: { _tag: "IMSQRT_OP" }, BESSELJ_OP: { _tag: "BESSELJ_OP" }, COMPLEX_OP: { _tag: "COMPLEX_OP" }, IMREAL_OP: { _tag: "IMREAL_OP" }, IMAGINARY_OP: { _tag: "IMAGINARY_OP" }, IMABS_OP: { _tag: "IMABS_OP" }, TINV_OP: { _tag: "TINV_OP" }, CHISQ_INV_OP: { _tag: "CHISQ_INV_OP" }, FINV_OP: { _tag: "FINV_OP" }, GAMMALN_OP: { _tag: "GAMMALN_OP" }, GAMMA_OP: { _tag: "GAMMA_OP" }, CHISQ_DIST_OP: { _tag: "CHISQ_DIST_OP" }, TDIST_OP: { _tag: "TDIST_OP" }, FDIST_OP: { _tag: "FDIST_OP" }, PHI_OP: { _tag: "PHI_OP" }, GAUSS_OP: { _tag: "GAUSS_OP" }, MIDB_OP: { _tag: "MIDB_OP" }, DBCS_OP: { _tag: "DBCS_OP" }, ASC_OP: { _tag: "ASC_OP" }, TEXTREVERSE_OP: { _tag: "TEXTREVERSE_OP" }, CUMIPMT_OP: { _tag: "CUMIPMT_OP" }, INDIRECT_OP: { _tag: "INDIRECT_OP" }, OFFSET_OP: { _tag: "OFFSET_OP" }, TIMEVALUE_OP: { _tag: "TIMEVALUE_OP" }, TIME_OP: { _tag: "TIME_OP" }, SECOND_OP: { _tag: "SECOND_OP" }, MINUTE_OP: { _tag: "MINUTE_OP" }, HOUR_OP: { _tag: "HOUR_OP" }, ISFORMULA_OP: { _tag: "ISFORMULA_OP" }, REGEXMATCH_OP: { _tag: "REGEXMATCH_OP" }, REGEXEXTRACT_OP: { _tag: "REGEXEXTRACT_OP" }, REGEXREPLACE_OP: { _tag: "REGEXREPLACE_OP" }, ERF_OP: { _tag: "ERF_OP" }, ERFC_OP: { _tag: "ERFC_OP" }, YEARFRAC_OP: { _tag: "YEARFRAC_OP" }, COUPDAYBS_OP: { _tag: "COUPDAYBS_OP" }, TBILLYIELD_OP: { _tag: "TBILLYIELD_OP" }, RECEIVED_OP: { _tag: "RECEIVED_OP" }, PRICEDISC_OP: { _tag: "PRICEDISC_OP" }, ACCRINT_OP: { _tag: "ACCRINT_OP" }, COUPDAYS_OP: { _tag: "COUPDAYS_OP" }, DOLLARDE_OP: { _tag: "DOLLARDE_OP" }, DOLLARFR_OP: { _tag: "DOLLARFR_OP" }, PPMT_OP: { _tag: "PPMT_OP" }, IPMT_OP: { _tag: "IPMT_OP" }, CELL_OP: { _tag: "CELL_OP" }, CEILING_PRECISE_OP: { _tag: "CEILING_PRECISE_OP" }, FLOOR_PRECISE_OP: { _tag: "FLOOR_PRECISE_OP" }, NEGBINOMDIST_OP: { _tag: "NEGBINOMDIST_OP" }, BETADIST_OP: { _tag: "BETADIST_OP" }, HYPGEOMDIST_OP: { _tag: "HYPGEOMDIST_OP" }, ISNA_OP: { _tag: "ISNA_OP" }, SHEET_OP: { _tag: "SHEET_OP" }, DATESTRING_OP: { _tag: "DATESTRING_OP" }, WORKDAY_OP: { _tag: "WORKDAY_OP" }, TEXTBEFORE_OP: { _tag: "TEXTBEFORE_OP" }, TEXTAFTER_OP: { _tag: "TEXTAFTER_OP" }, VALUETOTEXT_OP: { _tag: "VALUETOTEXT_OP" }, ISPMT_OP: { _tag: "ISPMT_OP" }, DISC_OP: { _tag: "DISC_OP" }, INTRATE_OP: { _tag: "INTRATE_OP" }, SYD_OP: { _tag: "SYD_OP" }, EFFECT_OP: { _tag: "EFFECT_OP" }, NOMINAL_OP: { _tag: "NOMINAL_OP" }, NORMINV_OP: { _tag: "NORMINV_OP" }, DDB_OP: { _tag: "DDB_OP" }, WEIBULL_OP: { _tag: "WEIBULL_OP" }, GAMMADIST_OP: { _tag: "GAMMADIST_OP" }, EXPONDIST_OP: { _tag: "EXPONDIST_OP" }, POISSON_OP: { _tag: "POISSON_OP" }, BINOMDIST_OP: { _tag: "BINOMDIST_OP" }, LOGNORMDIST_OP: { _tag: "LOGNORMDIST_OP" }, STANDARDIZE_OP: { _tag: "STANDARDIZE_OP" }, CONFIDENCE_OP: { _tag: "CONFIDENCE_OP" }, NORMDIST_OP: { _tag: "NORMDIST_OP" }, FISHER_OP: { _tag: "FISHER_OP" }, FISHERINV_OP: { _tag: "FISHERINV_OP" }, CONVERT_OP: { _tag: "CONVERT_OP" }, ISOWEEKNUM_OP: { _tag: "ISOWEEKNUM_OP" }, NETWORKDAYS_OP: { _tag: "NETWORKDAYS_OP" },
  DELTA_OP: { _tag: "DELTA_OP" }, GESTEP_OP: { _tag: "GESTEP_OP" }, SEC_OP: { _tag: "SEC_OP" }, CSC_OP: { _tag: "CSC_OP" }, COTH_OP: { _tag: "COTH_OP" },
  SECH_OP: { _tag: "SECH_OP" }, CSCH_OP: { _tag: "CSCH_OP" },
  NA_OP: { _tag: "NA_OP" }, COT_OP: { _tag: "COT_OP" }, ACOT_OP: { _tag: "ACOT_OP" },
  UNICODE_OP: { _tag: "UNICODE_OP" }, UNICHAR_OP: { _tag: "UNICHAR_OP" }, ENCODEURL_OP: { _tag: "ENCODEURL_OP" }, DAYS_OP: { _tag: "DAYS_OP" }, DATEVALUE_OP: { _tag: "DATEVALUE_OP" }, EDATE_OP: { _tag: "EDATE_OP" },
  WEEKDAY_OP: { _tag: "WEEKDAY_OP" }, WEEKNUM_OP: { _tag: "WEEKNUM_OP" },
  ROMAN_OP: { _tag: "ROMAN_OP" }, ARABIC_OP: { _tag: "ARABIC_OP" },
  TEXT_OP: { _tag: "TEXT_OP" }, NUMBERVALUE_OP: { _tag: "NUMBERVALUE_OP" },
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
    case "ISLOGICAL_OP": return _OP.ISLOGICAL_OP
    case "ISNONTEXT_OP": return _OP.ISNONTEXT_OP
    case "ERROR_TYPE_OP": return _OP.ERROR_TYPE_OP
    case "ISEVEN_OP": return _OP.ISEVEN_OP
    case "ISODD_OP": return _OP.ISODD_OP
    case "SQRTPI_OP": return _OP.SQRTPI_OP
    case "BASE_OP": return _OP.BASE_OP
    case "DECIMAL_OP": return _OP.DECIMAL_OP
    case "CEILING_MATH_OP": return _OP.CEILING_MATH_OP
    case "FLOOR_MATH_OP": return _OP.FLOOR_MATH_OP
    case "ROUNDUP_OP": return _OP.ROUNDUP_OP
    case "ROUNDDOWN_OP": return _OP.ROUNDDOWN_OP
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
    case "RATE_OP": return _OP.RATE_OP
    case "DB_OP": return _OP.DB_OP
    case "SLN_OP": return _OP.SLN_OP
    case "NPER_OP": return _OP.NPER_OP
    case "PMT_OP": return _OP.PMT_OP
    case "FV_OP": return _OP.FV_OP
    case "PV_OP": return _OP.PV_OP
    case "MROUND_OP": return _OP.MROUND_OP
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
    case "IRR_N": return { _tag: "IRR_N", n: 0 } as any
    case "NPV_N": return { _tag: "NPV_N", n: 0 } as any
    case "VAR_N": return { _tag: "VAR_N", n: 0 } as any
    case "PERCENTILE_N": return { _tag: "PERCENTILE_N", n: 0 } as any
    case "COUNTA_N": return { _tag: "COUNTA_N", n: 0 } as any
    case "COUNTBLANK_N": return { _tag: "COUNTBLANK_N", n: 0 } as any
    case "MATCH_N": return { _tag: "MATCH_N", n: 0 } as any
    case "INDEX_N": return { _tag: "INDEX_N", n: 0 } as any
    case "MODE_N": return { _tag: "MODE_N", n: 0 } as any
    case "HARMEAN_N": return { _tag: "HARMEAN_N", n: 0 } as any
    case "GEOMEAN_N": return { _tag: "GEOMEAN_N", n: 0 } as any
    case "AGGREGATE_N": return { _tag: "AGGREGATE_N", n: 0 } as any
    case "COUNTIFS_N": return { _tag: "COUNTIFS_N", n: 0 } as any
    case "MAXIFS_N": return { _tag: "MAXIFS_N", n: 0 } as any
    case "MINIFS_N": return { _tag: "MINIFS_N", n: 0 } as any
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
    case "IFNA_OP": return _OP.IFNA_OP
    case "EOMONTH_OP": return _OP.EOMONTH_OP
    case "DATEDIF_OP": return _OP.DATEDIF_OP
    case "PERMUT_OP": return _OP.PERMUT_OP
    case "FACTDOUBLE_OP": return _OP.FACTDOUBLE_OP
    case "TINV_OP": return _OP.TINV_OP
    case "CHISQ_INV_OP": return _OP.CHISQ_INV_OP
    case "FINV_OP": return _OP.FINV_OP
    case "GAMMALN_OP": return _OP.GAMMALN_OP
    case "GAMMA_OP": return _OP.GAMMA_OP
    case "CHISQ_DIST_OP": return _OP.CHISQ_DIST_OP
    case "TDIST_OP": return _OP.TDIST_OP
    case "FDIST_OP": return _OP.FDIST_OP
    case "PHI_OP": return _OP.PHI_OP
    case "GAUSS_OP": return _OP.GAUSS_OP
    case "MIDB_OP": return _OP.MIDB_OP
    case "DBCS_OP": return _OP.DBCS_OP
    case "ASC_OP": return _OP.ASC_OP
    case "CONCAT_WS_N": return { _tag: "CONCAT_WS_N", n: 0 } as any
    case "TEXTREVERSE_OP": return _OP.TEXTREVERSE_OP
    case "FVSCHEDULE_N": return { _tag: "FVSCHEDULE_N", n: 0 } as any
    case "CUMIPMT_OP": return _OP.CUMIPMT_OP
    case "COLUMNS_N": return { _tag: "COLUMNS_N", n: 0 } as any
    case "INDIRECT_OP": return _OP.INDIRECT_OP
    case "OFFSET_OP": return _OP.OFFSET_OP
    case "ZTEST_N": return { _tag: "ZTEST_N", n: 0 } as any
    case "COVARIANCE_S_N": return { _tag: "COVARIANCE_S_N", n: 0 } as any
    case "STDEV_S_N": return { _tag: "STDEV_S_N", n: 0 } as any
    case "TIMEVALUE_OP": return _OP.TIMEVALUE_OP
    case "TIME_OP": return _OP.TIME_OP
    case "SECOND_OP": return _OP.SECOND_OP
    case "MINUTE_OP": return _OP.MINUTE_OP
    case "HOUR_OP": return _OP.HOUR_OP
    case "GROWTH_N": return { _tag: "GROWTH_N", n: 0 } as any
    case "TREND_N": return { _tag: "TREND_N", n: 0 } as any
    case "FREQUENCY_N": return { _tag: "FREQUENCY_N", n: 0 } as any
    case "PROB_N2": return { _tag: "PROB_N2", n: 0 } as any
    case "LAMBDA_N": return { _tag: "LAMBDA_N", n: 0 } as any
    case "MAP_N": return { _tag: "MAP_N", n: 0 } as any
    case "REDUCE_N": return { _tag: "REDUCE_N", n: 0 } as any
    case "SCAN_N": return { _tag: "SCAN_N", n: 0 } as any
    case "BYROW_N": return { _tag: "BYROW_N", n: 0 } as any
    case "BYCOL_N": return { _tag: "BYCOL_N", n: 0 } as any
    case "LEFTB_OP": return _OP.LEFTB_OP
    case "RIGHTB_OP": return _OP.RIGHTB_OP
    case "LENB_OP": return _OP.LENB_OP
    case "BAHTTEXT_OP": return _OP.BAHTTEXT_OP
    case "PHONETIC_OP": return _OP.PHONETIC_OP
    case "BESSELY_OP": return _OP.BESSELY_OP
    case "HEX2BIN_OP": return _OP.HEX2BIN_OP
    case "HEX2OCT_OP": return _OP.HEX2OCT_OP
    case "OCT2BIN_OP": return _OP.OCT2BIN_OP
    case "OCT2HEX_OP": return _OP.OCT2HEX_OP
    case "IMTAN_OP": return _OP.IMTAN_OP
    case "IMLOG2_OP": return _OP.IMLOG2_OP
    case "IMLOG10_OP": return _OP.IMLOG10_OP
    case "DPRODUCT_N": return { _tag: "DPRODUCT_N", n: 0 } as any
    case "RANDBETWEEN_FLOAT_OP": return _OP.RANDBETWEEN_FLOAT_OP
    case "FORMULATEXT_OP": return _OP.FORMULATEXT_OP
    case "ADDRESS_OP": return _OP.ADDRESS_OP
    case "IMDIV_OP": return _OP.IMDIV_OP
    case "IMSUB_OP": return _OP.IMSUB_OP
    case "BIN2DEC_OP": return _OP.BIN2DEC_OP
    case "DEC2BIN_OP": return _OP.DEC2BIN_OP
    case "BIN2HEX_OP": return _OP.BIN2HEX_OP
    case "HEX2DEC_OP": return _OP.HEX2DEC_OP
    case "DEC2HEX_OP": return _OP.DEC2HEX_OP
    case "OCT2DEC_OP": return _OP.OCT2DEC_OP
    case "DEC2OCT_OP": return _OP.DEC2OCT_OP
    case "BITAND_OP": return _OP.BITAND_OP
    case "BITOR_OP": return _OP.BITOR_OP
    case "BITXOR_OP": return _OP.BITXOR_OP
    case "BITLSHIFT_OP": return _OP.BITLSHIFT_OP
    case "BITRSHIFT_OP": return _OP.BITRSHIFT_OP
    case "IMPOWER_OP": return _OP.IMPOWER_OP
    case "IMEXP_OP": return _OP.IMEXP_OP
    case "IMLN_OP": return _OP.IMLN_OP
    case "IMSIN_OP": return _OP.IMSIN_OP
    case "IMCOS_OP": return _OP.IMCOS_OP
    case "IMSUM_OP": return _OP.IMSUM_OP
    case "IMPRODUCT_OP": return _OP.IMPRODUCT_OP
    case "IMARGUMENT_OP": return _OP.IMARGUMENT_OP
    case "IMCONJUGATE_OP": return _OP.IMCONJUGATE_OP
    case "IMSQRT_OP": return _OP.IMSQRT_OP
    case "BESSELJ_OP": return _OP.BESSELJ_OP
    case "COMPLEX_OP": return _OP.COMPLEX_OP
    case "IMREAL_OP": return _OP.IMREAL_OP
    case "IMAGINARY_OP": return _OP.IMAGINARY_OP
    case "IMABS_OP": return _OP.IMABS_OP
    case "TAKE_N": return { _tag: "TAKE_N", n: 0 } as any
    case "DROP_N": return { _tag: "DROP_N", n: 0 } as any
    case "HSTACK_N": return { _tag: "HSTACK_N", n: 0 } as any
    case "WRAPROWS_N": return { _tag: "WRAPROWS_N", n: 0 } as any
    case "ISFORMULA_OP": return _OP.ISFORMULA_OP
    case "REGEXMATCH_OP": return _OP.REGEXMATCH_OP
    case "REGEXEXTRACT_OP": return _OP.REGEXEXTRACT_OP
    case "REGEXREPLACE_OP": return _OP.REGEXREPLACE_OP
    case "LET_N": return { _tag: "LET_N", n: 0 } as any
    case "CHOOSECOLS_N": return { _tag: "CHOOSECOLS_N", n: 0 } as any
    case "SUMXMY2_N": return { _tag: "SUMXMY2_N", n: 0 } as any
    case "SUMX2PY2_N": return { _tag: "SUMX2PY2_N", n: 0 } as any
    case "SUMX2MY2_N": return { _tag: "SUMX2MY2_N", n: 0 } as any
    case "ERF_OP": return _OP.ERF_OP
    case "ERFC_OP": return _OP.ERFC_OP
    case "YEARFRAC_OP": return _OP.YEARFRAC_OP
    case "COUPDAYBS_OP": return _OP.COUPDAYBS_OP
    case "TBILLYIELD_OP": return _OP.TBILLYIELD_OP
    case "RECEIVED_OP": return _OP.RECEIVED_OP
    case "PRICEDISC_OP": return _OP.PRICEDISC_OP
    case "MIRR_N": return { _tag: "MIRR_N", n: 0 } as any
    case "XNPV_N": return { _tag: "XNPV_N", n: 0 } as any
    case "ACCRINT_OP": return _OP.ACCRINT_OP
    case "COUPDAYS_OP": return _OP.COUPDAYS_OP
    case "DOLLARDE_OP": return _OP.DOLLARDE_OP
    case "DOLLARFR_OP": return _OP.DOLLARFR_OP
    case "SORT_N": return { _tag: "SORT_N", n: 0 } as any
    case "UNIQUE_N": return { _tag: "UNIQUE_N", n: 0 } as any
    case "FILTER_N": return { _tag: "FILTER_N", n: 0 } as any
    case "PPMT_OP": return _OP.PPMT_OP
    case "IPMT_OP": return _OP.IPMT_OP
    case "CELL_OP": return _OP.CELL_OP
    case "ROWS_N": return { _tag: "ROWS_N", n: 0 } as any
    case "RANDARRAY_N": return { _tag: "RANDARRAY_N", n: 0 } as any
    case "SEQUENCE_N": return { _tag: "SEQUENCE_N", n: 0 } as any
    case "XMATCH_N": return { _tag: "XMATCH_N", n: 0 } as any
    case "CEILING_PRECISE_OP": return _OP.CEILING_PRECISE_OP
    case "FLOOR_PRECISE_OP": return _OP.FLOOR_PRECISE_OP
    case "AVERAGEA_N": return { _tag: "AVERAGEA_N", n: 0 } as any
    case "MAXA_N": return { _tag: "MAXA_N", n: 0 } as any
    case "MINA_N": return { _tag: "MINA_N", n: 0 } as any
    case "NEGBINOMDIST_OP": return _OP.NEGBINOMDIST_OP
    case "BETADIST_OP": return _OP.BETADIST_OP
    case "HYPGEOMDIST_OP": return _OP.HYPGEOMDIST_OP
    case "ISNA_OP": return _OP.ISNA_OP
    case "SHEET_OP": return _OP.SHEET_OP
    case "TEXTSPLIT_N": return { _tag: "TEXTSPLIT_N", n: 0 } as any
    case "DATESTRING_OP": return _OP.DATESTRING_OP
    case "WORKDAY_OP": return _OP.WORKDAY_OP
    case "TEXTBEFORE_OP": return _OP.TEXTBEFORE_OP
    case "TEXTAFTER_OP": return _OP.TEXTAFTER_OP
    case "VALUETOTEXT_OP": return _OP.VALUETOTEXT_OP
    case "ISPMT_OP": return _OP.ISPMT_OP
    case "DISC_OP": return _OP.DISC_OP
    case "INTRATE_OP": return _OP.INTRATE_OP
    case "SYD_OP": return _OP.SYD_OP
    case "EFFECT_OP": return _OP.EFFECT_OP
    case "NOMINAL_OP": return _OP.NOMINAL_OP
    case "NORMINV_OP": return _OP.NORMINV_OP
    case "DDB_OP": return _OP.DDB_OP
    case "PERCENTRANK_N": return { _tag: "PERCENTRANK_N", n: 0 } as any
    case "QUARTILE_N": return { _tag: "QUARTILE_N", n: 0 } as any
    case "WEIBULL_OP": return _OP.WEIBULL_OP
    case "GAMMADIST_OP": return _OP.GAMMADIST_OP
    case "EXPONDIST_OP": return _OP.EXPONDIST_OP
    case "POISSON_OP": return _OP.POISSON_OP
    case "BINOMDIST_OP": return _OP.BINOMDIST_OP
    case "LOGNORMDIST_OP": return _OP.LOGNORMDIST_OP
    case "STANDARDIZE_OP": return _OP.STANDARDIZE_OP
    case "CONFIDENCE_OP": return _OP.CONFIDENCE_OP
    case "NORMDIST_OP": return _OP.NORMDIST_OP
    case "STEYX_N": return { _tag: "STEYX_N", n: 0 } as any
    case "FISHER_OP": return _OP.FISHER_OP
    case "FISHERINV_OP": return _OP.FISHERINV_OP
    case "KURT_N": return { _tag: "KURT_N", n: 0 } as any
    case "SKEW_N": return { _tag: "SKEW_N", n: 0 } as any
    case "CONVERT_OP": return _OP.CONVERT_OP
    case "SLOPE_N": return { _tag: "SLOPE_N", n: 0 } as any
    case "INTERCEPT_N": return { _tag: "INTERCEPT_N", n: 0 } as any
    case "RSQ_N": return { _tag: "RSQ_N", n: 0 } as any
    case "COVAR_N": return { _tag: "COVAR_N", n: 0 } as any
    case "FORECAST_N": return { _tag: "FORECAST_N", n: 0 } as any
    case "STDEVP_N": return { _tag: "STDEVP_N", n: 0 } as any
    case "VARP_N": return { _tag: "VARP_N", n: 0 } as any
    case "CORREL_N": return { _tag: "CORREL_N", n: 0 } as any
    case "SUMSQ_N": return { _tag: "SUMSQ_N", n: 0 } as any
    case "DEVSQ_N": return { _tag: "DEVSQ_N", n: 0 } as any
    case "AVEDEV_N": return { _tag: "AVEDEV_N", n: 0 } as any
    case "TRIMMEAN_N": return { _tag: "TRIMMEAN_N", n: 0 } as any
    case "XOR_N": return { _tag: "XOR_N", n: 0 } as any
    case "ISOWEEKNUM_OP": return _OP.ISOWEEKNUM_OP
    case "NETWORKDAYS_OP": return _OP.NETWORKDAYS_OP
    case "SUBTOTAL_N": return { _tag: "SUBTOTAL_N", n: 0 } as any
    case "DELTA_OP": return _OP.DELTA_OP
    case "GESTEP_OP": return _OP.GESTEP_OP
    case "MULTINOMIAL_N": return { _tag: "MULTINOMIAL_N", n: 0 } as any
    case "SERIESSUM_N": return { _tag: "SERIESSUM_N", n: 0 } as any
    case "SEC_OP": return _OP.SEC_OP
    case "CSC_OP": return _OP.CSC_OP
    case "COTH_OP": return _OP.COTH_OP
    case "SECH_OP": return _OP.SECH_OP
    case "CSCH_OP": return _OP.CSCH_OP
    case "SUMIFS_N": return { _tag: "SUMIFS_N", n: 0 } as any
    case "AVERAGEIFS_N": return { _tag: "AVERAGEIFS_N", n: 0 } as any
    case "NA_OP": return _OP.NA_OP
    case "COT_OP": return _OP.COT_OP
    case "ACOT_OP": return _OP.ACOT_OP
    case "UNICODE_OP": return _OP.UNICODE_OP
    case "UNICHAR_OP": return _OP.UNICHAR_OP
    case "ENCODEURL_OP": return _OP.ENCODEURL_OP
    case "DAYS_OP": return _OP.DAYS_OP
    case "DATEVALUE_OP": return _OP.DATEVALUE_OP
    case "EDATE_OP": return _OP.EDATE_OP
    case "WEEKDAY_OP": return _OP.WEEKDAY_OP
    case "WEEKNUM_OP": return _OP.WEEKNUM_OP
    case "ROMAN_OP": return _OP.ROMAN_OP
    case "ARABIC_OP": return _OP.ARABIC_OP
    case "TEXT_OP": return _OP.TEXT_OP
    case "NUMBERVALUE_OP": return _OP.NUMBERVALUE_OP
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
const ALWAYS_N_FNS = new Set(["AND_N", "OR_N", "CHOOSE_N", "SWITCH_N", "IFS_N", "IRR_N", "NPV_N", "VAR_N", "PERCENTILE_N", "COUNTA_N", "COUNTBLANK_N", "SUMPRODUCT_N", "MATCH_N", "INDEX_N", "MODE_N", "HARMEAN_N", "GEOMEAN_N", "AGGREGATE_N", "COUNTIF_N", "COUNTIFS_N", "CONCAT_WS_N", "FVSCHEDULE_N", "COLUMNS_N", "ZTEST_N", "COVARIANCE_S_N", "STDEV_S_N", "GROWTH_N", "TREND_N", "FREQUENCY_N", "PROB_N2", "LAMBDA_N", "MAP_N", "REDUCE_N", "SCAN_N", "BYROW_N", "BYCOL_N", "DPRODUCT_N", "TAKE_N", "DROP_N", "HSTACK_N", "WRAPROWS_N", "LET_N", "CHOOSECOLS_N", "SUMXMY2_N", "SUMX2PY2_N", "SUMX2MY2_N", "MIRR_N", "XNPV_N", "SORT_N", "UNIQUE_N", "FILTER_N", "ROWS_N", "RANDARRAY_N", "SEQUENCE_N", "XMATCH_N", "AVERAGEA_N", "MAXA_N", "MINA_N", "TEXTSPLIT_N", "PERCENTRANK_N", "QUARTILE_N", "STEYX_N", "KURT_N", "SKEW_N", "SLOPE_N", "INTERCEPT_N", "RSQ_N", "COVAR_N", "FORECAST_N", "STDEVP_N", "VARP_N", "CORREL_N", "SUMSQ_N", "DEVSQ_N", "AVEDEV_N", "TRIMMEAN_N", "XOR_N", "SUBTOTAL_N", "MULTINOMIAL_N", "SERIESSUM_N", "SUMIFS_N", "AVERAGEIFS_N", "SUMIF_N", "MAXIFS_N", "MINIFS_N", "AVERAGEIF_N", "LARGE_N", "SMALL_N", "STDEV_N", "MEDIAN_N", "RANK_N", "CONCATENATE_N", "TEXTJOIN_N"])
const N_VARIANTS: Record<string, string> = {
  SUM_DYN: "SUM_N", MIN_DYN: "MIN_N", MAX_DYN: "MAX_N", AVG_DYN: "AVG_N",
  PRODUCT_DYN: "PRODUCT_N",
  AND_N: "AND_N", OR_N: "OR_N", CHOOSE_N: "CHOOSE_N", SWITCH_N: "SWITCH_N", IFS_N: "IFS_N",
  IRR_N: "IRR_N", NPV_N: "NPV_N", VAR_N: "VAR_N", PERCENTILE_N: "PERCENTILE_N", COUNTA_N: "COUNTA_N", COUNTBLANK_N: "COUNTBLANK_N",
  SUMPRODUCT_N: "SUMPRODUCT_N", MATCH_N: "MATCH_N", INDEX_N: "INDEX_N", MODE_N: "MODE_N", HARMEAN_N: "HARMEAN_N", GEOMEAN_N: "GEOMEAN_N", AGGREGATE_N: "AGGREGATE_N", COUNTIF_N: "COUNTIF_N", COUNTIFS_N: "COUNTIFS_N", SUMIF_N: "SUMIF_N", MAXIFS_N: "MAXIFS_N", MINIFS_N: "MINIFS_N", AVERAGEIF_N: "AVERAGEIF_N", LARGE_N: "LARGE_N", SMALL_N: "SMALL_N",
  CONCAT_WS_N: "CONCAT_WS_N", FVSCHEDULE_N: "FVSCHEDULE_N", COLUMNS_N: "COLUMNS_N", ZTEST_N: "ZTEST_N", COVARIANCE_S_N: "COVARIANCE_S_N", STDEV_S_N: "STDEV_S_N", GROWTH_N: "GROWTH_N", TREND_N: "TREND_N", FREQUENCY_N: "FREQUENCY_N", PROB_N2: "PROB_N2", LAMBDA_N: "LAMBDA_N", MAP_N: "MAP_N", REDUCE_N: "REDUCE_N", SCAN_N: "SCAN_N", BYROW_N: "BYROW_N", BYCOL_N: "BYCOL_N", DPRODUCT_N: "DPRODUCT_N", TAKE_N: "TAKE_N", DROP_N: "DROP_N", HSTACK_N: "HSTACK_N", WRAPROWS_N: "WRAPROWS_N", LET_N: "LET_N", CHOOSECOLS_N: "CHOOSECOLS_N", SUMXMY2_N: "SUMXMY2_N", SUMX2PY2_N: "SUMX2PY2_N", SUMX2MY2_N: "SUMX2MY2_N", MIRR_N: "MIRR_N", XNPV_N: "XNPV_N", SORT_N: "SORT_N", UNIQUE_N: "UNIQUE_N", FILTER_N: "FILTER_N", ROWS_N: "ROWS_N", RANDARRAY_N: "RANDARRAY_N", SEQUENCE_N: "SEQUENCE_N", XMATCH_N: "XMATCH_N", AVERAGEA_N: "AVERAGEA_N", MAXA_N: "MAXA_N", MINA_N: "MINA_N", TEXTSPLIT_N: "TEXTSPLIT_N", PERCENTRANK_N: "PERCENTRANK_N", QUARTILE_N: "QUARTILE_N", STEYX_N: "STEYX_N", KURT_N: "KURT_N", SKEW_N: "SKEW_N", SLOPE_N: "SLOPE_N", INTERCEPT_N: "INTERCEPT_N", RSQ_N: "RSQ_N", COVAR_N: "COVAR_N", FORECAST_N: "FORECAST_N", STDEVP_N: "STDEVP_N", VARP_N: "VARP_N", CORREL_N: "CORREL_N", SUMSQ_N: "SUMSQ_N", DEVSQ_N: "DEVSQ_N", AVEDEV_N: "AVEDEV_N", TRIMMEAN_N: "TRIMMEAN_N",
  XOR_N: "XOR_N", SUBTOTAL_N: "SUBTOTAL_N",
  MULTINOMIAL_N: "MULTINOMIAL_N", SERIESSUM_N: "SERIESSUM_N",
  SUMIFS_N: "SUMIFS_N", AVERAGEIFS_N: "AVERAGEIFS_N",
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
      // Check for dotted function name: CEILING.MATH, FLOOR.MATH etc.
      if (i < expr.length && expr[i] === "." && i + 1 < expr.length && ((expr[i+1] >= "A" && expr[i+1] <= "Z") || (expr[i+1] >= "a" && expr[i+1] <= "z"))) {
        id += "."
        i++
        while (i < expr.length && ((expr[i] >= "A" && expr[i] <= "Z") || (expr[i] >= "a" && expr[i] <= "z") || (expr[i] >= "0" && expr[i] <= "9") || expr[i] === "_")) {
          id += expr[i]; i++
        }
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
  SUM: "SUM_DYN", MIN: "MIN_DYN", MAX: "MAX_DYN", AVG: "AVG_DYN", AVERAGE: "AVG_DYN",
  COUNT: "COUNT_DYN", POWER: "POWER",
  ROUND: "ROUND", FLOOR: "FLOOR", CEIL: "CEIL",
  SQRT: "SQRT_OP", SIGN: "SIGN_OP", LOG: "LOG_OP", LOG10: "LOG10_OP",
  ABS: "ABS", NEG: "NEG", IF: "IF", IFERROR: "IFERROR",
  AND: "AND_N", OR: "OR_N", CHOOSE: "CHOOSE_N",
  PRODUCT: "PRODUCT_DYN",
  NOW: "NOW_OP", RAND: "RAND_OP", PI: "PI_OP", TODAY: "TODAY_OP",
  CONCAT: "CONCAT", TO_NUM: "TO_NUM", TO_STR: "TO_STR",
  LEN: "LEN_OP", LEFT: "LEFT_OP", RIGHT: "RIGHT_OP", MID: "MID_OP",
  TRIM: "TRIM_OP", UPPER: "UPPER_OP", LOWER: "LOWER_OP", PROPER: "PROPER_OP", CLEAN: "CLEAN_OP", CHAR: "CHAR_OP", CODE: "CODE_OP", T: "T_OP",
  ISLOGICAL: "ISLOGICAL_OP", ISNONTEXT: "ISNONTEXT_OP", ERRORTYPE: "ERROR_TYPE_OP",
  ISEVEN: "ISEVEN_OP", ISODD: "ISODD_OP", ISNUMBER: "ISNUM_OP",
  INT: "INT_OP", SQRTPI: "SQRTPI_OP", BASE: "BASE_OP", DECIMAL: "DECIMAL_OP", "CEILING.MATH": "CEILING_MATH_OP", "FLOOR.MATH": "FLOOR_MATH_OP", ROUNDUP: "ROUNDUP_OP", ROUNDDOWN: "ROUNDDOWN_OP", EVEN: "EVEN_OP", ODD: "ODD_OP", TRUNC: "TRUNC_OP", EXP: "EXP_OP", LN: "LN_OP", LOG2: "LOG2_OP",
  RANDBETWEEN: "RAND_BETWEEN", IRR: "IRR_N", RATE: "RATE_OP", DB: "DB_OP", NPER: "NPER_OP", SLN: "SLN_OP", PMT: "PMT_OP", FV: "FV_OP", PV: "PV_OP", MROUND: "MROUND_OP", FIXED: "FIXED_OP", DOLLAR: "DOLLAR_OP",
  SINH: "SINH_OP", COSH: "COSH_OP", TANH: "TANH_OP",
  SIN: "SIN_OP", COS: "COS_OP", TAN: "TAN_OP", ASIN: "ASIN_OP", ACOS: "ACOS_OP", ATAN: "ATAN_OP", ATAN2: "ATAN2_OP", RADIANS: "RADIANS_OP", DEGREES: "DEGREES_OP",
  FACT: "FACT_OP", QUOTIENT: "QUOTIENT_OP", GCD: "GCD_OP", LCM: "LCM_OP", COMBIN: "COMBIN_OP", SUBSTITUTE: "SUBSTITUTE_OP",
  ISNUM: "ISNUM_OP", ISTEXT: "ISTEXT_OP", ISERROR: "ISERROR_OP", ISBLANK: "ISBLANK_OP",
  NPV: "NPV_N", VAR: "VAR_N", PERCENTILE: "PERCENTILE_N", COUNTA: "COUNTA_N", COUNTBLANK: "COUNTBLANK_N",
  SUMPRODUCT: "SUMPRODUCT_N", MATCH: "MATCH_N", INDEX: "INDEX_N", MODE: "MODE_N", HARMEAN: "HARMEAN_N", GEOMEAN: "GEOMEAN_N", AGGREGATE: "AGGREGATE_N", COUNTIF: "COUNTIF_N", COUNTIFS: "COUNTIFS_N", SUMIF: "SUMIF_N", MAXIFS: "MAXIFS_N", MINIFS: "MINIFS_N", AVERAGEIF: "AVERAGEIF_N", LARGE: "LARGE_N", SMALL: "SMALL_N",
  STDEV: "STDEV_N", MEDIAN: "MEDIAN_N", RANK: "RANK_N", CONCATENATE: "CONCATENATE_N", TEXTJOIN: "TEXTJOIN_N",
  TINV: "TINV_OP", "CHISQ.INV": "CHISQ_INV_OP", FINV: "FINV_OP", GAMMALN: "GAMMALN_OP", GAMMA: "GAMMA_OP", "CHISQ.DIST": "CHISQ_DIST_OP", TDIST: "TDIST_OP", FDIST: "FDIST_OP", PHI: "PHI_OP", GAUSS: "GAUSS_OP", MIDB: "MIDB_OP", DBCS: "DBCS_OP", ASC: "ASC_OP", CONCAT_WS: "CONCAT_WS_N", TEXTREVERSE: "TEXTREVERSE_OP", FVSCHEDULE: "FVSCHEDULE_N", CUMIPMT: "CUMIPMT_OP", COLUMNS: "COLUMNS_N", INDIRECT: "INDIRECT_OP", OFFSET: "OFFSET_OP", ZTEST: "ZTEST_N", "COVARIANCE.S": "COVARIANCE_S_N", "STDEV.S": "STDEV_S_N", TIMEVALUE: "TIMEVALUE_OP", TIME: "TIME_OP", GROWTH: "GROWTH_N", TREND: "TREND_N", FREQUENCY: "FREQUENCY_N", PROB: "PROB_N2", LAMBDA: "LAMBDA_N", MAP: "MAP_N", REDUCE: "REDUCE_N", SCAN: "SCAN_N", BYROW: "BYROW_N", BYCOL: "BYCOL_N", LEFTB: "LEFTB_OP", RIGHTB: "RIGHTB_OP", LENB: "LENB_OP", BAHTTEXT: "BAHTTEXT_OP", PHONETIC: "PHONETIC_OP", BESSELY: "BESSELY_OP", HEX2BIN: "HEX2BIN_OP", HEX2OCT: "HEX2OCT_OP", OCT2BIN: "OCT2BIN_OP", OCT2HEX: "OCT2HEX_OP", IMTAN: "IMTAN_OP", IMLOG2: "IMLOG2_OP", IMLOG10: "IMLOG10_OP", DPRODUCT: "DPRODUCT_N", "RANDBETWEEN.FLOAT": "RANDBETWEEN_FLOAT_OP", FORMULATEXT: "FORMULATEXT_OP", ADDRESS: "ADDRESS_OP", IMDIV: "IMDIV_OP", IMSUB: "IMSUB_OP", BIN2DEC: "BIN2DEC_OP", DEC2BIN: "DEC2BIN_OP", BIN2HEX: "BIN2HEX_OP", HEX2DEC: "HEX2DEC_OP", DEC2HEX: "DEC2HEX_OP", OCT2DEC: "OCT2DEC_OP", DEC2OCT: "DEC2OCT_OP", BITAND: "BITAND_OP", BITOR: "BITOR_OP", BITXOR: "BITXOR_OP", BITLSHIFT: "BITLSHIFT_OP", BITRSHIFT: "BITRSHIFT_OP", IMPOWER: "IMPOWER_OP", IMEXP: "IMEXP_OP", IMLN: "IMLN_OP", IMSIN: "IMSIN_OP", IMCOS: "IMCOS_OP", IMSUM: "IMSUM_OP", IMPRODUCT: "IMPRODUCT_OP", IMARGUMENT: "IMARGUMENT_OP", IMCONJUGATE: "IMCONJUGATE_OP", IMSQRT: "IMSQRT_OP", BESSELJ: "BESSELJ_OP", COMPLEX: "COMPLEX_OP", IMREAL: "IMREAL_OP", IMAGINARY: "IMAGINARY_OP", IMABS: "IMABS_OP", TAKE: "TAKE_N", DROP: "DROP_N", HSTACK: "HSTACK_N", WRAPROWS: "WRAPROWS_N", ISFORMULA: "ISFORMULA_OP", REGEXMATCH: "REGEXMATCH_OP", REGEXEXTRACT: "REGEXEXTRACT_OP", REGEXREPLACE: "REGEXREPLACE_OP", LET: "LET_N", CHOOSECOLS: "CHOOSECOLS_N", SUMXMY2: "SUMXMY2_N", SUMX2PY2: "SUMX2PY2_N", SUMX2MY2: "SUMX2MY2_N", ERF: "ERF_OP", ERFC: "ERFC_OP", YEARFRAC: "YEARFRAC_OP", COUPDAYBS: "COUPDAYBS_OP", TBILLYIELD: "TBILLYIELD_OP", RECEIVED: "RECEIVED_OP", PRICEDISC: "PRICEDISC_OP", MIRR: "MIRR_N", XNPV: "XNPV_N", ACCRINT: "ACCRINT_OP", COUPDAYS: "COUPDAYS_OP", DOLLARDE: "DOLLARDE_OP", DOLLARFR: "DOLLARFR_OP", SORT: "SORT_N", UNIQUE: "UNIQUE_N", FILTER: "FILTER_N", PPMT: "PPMT_OP", IPMT: "IPMT_OP", CELL: "CELL_OP", ROWS: "ROWS_N", RANDARRAY: "RANDARRAY_N", SEQUENCE: "SEQUENCE_N", XMATCH: "XMATCH_N", "CEILING.PRECISE": "CEILING_PRECISE_OP", "FLOOR.PRECISE": "FLOOR_PRECISE_OP",
  IFNA: "IFNA_OP", AVERAGEA: "AVERAGEA_N", MAXA: "MAXA_N", MINA: "MINA_N", NEGBINOMDIST: "NEGBINOMDIST_OP", BETADIST: "BETADIST_OP", HYPGEOMDIST: "HYPGEOMDIST_OP", ISNA: "ISNA_OP", SHEET: "SHEET_OP", TEXTSPLIT: "TEXTSPLIT_N", DATESTRING: "DATESTRING_OP", WORKDAY: "WORKDAY_OP", TEXTBEFORE: "TEXTBEFORE_OP", TEXTAFTER: "TEXTAFTER_OP", VALUETOTEXT: "VALUETOTEXT_OP", ISPMT: "ISPMT_OP", DISC: "DISC_OP", INTRATE: "INTRATE_OP", SYD: "SYD_OP", EFFECT: "EFFECT_OP", NOMINAL: "NOMINAL_OP", NORMINV: "NORMINV_OP", DDB: "DDB_OP", PERCENTRANK: "PERCENTRANK_N", QUARTILE: "QUARTILE_N", WEIBULL: "WEIBULL_OP", GAMMADIST: "GAMMADIST_OP", EXPONDIST: "EXPONDIST_OP", POISSON: "POISSON_OP", BINOMDIST: "BINOMDIST_OP", LOGNORMDIST: "LOGNORMDIST_OP", STANDARDIZE: "STANDARDIZE_OP", CONFIDENCE: "CONFIDENCE_OP", NORMDIST: "NORMDIST_OP", STEYX: "STEYX_N", FISHER: "FISHER_OP", FISHERINV: "FISHERINV_OP", KURT: "KURT_N", SKEW: "SKEW_N", CONVERT: "CONVERT_OP", SLOPE: "SLOPE_N", INTERCEPT: "INTERCEPT_N", RSQ: "RSQ_N", COVAR: "COVAR_N", FORECAST: "FORECAST_N", "STDEV.P": "STDEVP_N", "VAR.P": "VARP_N", CORREL: "CORREL_N", SUMSQ: "SUMSQ_N", DEVSQ: "DEVSQ_N", AVEDEV: "AVEDEV_N", TRIMMEAN: "TRIMMEAN_N", XOR: "XOR_N", ISOWEEKNUM: "ISOWEEKNUM_OP", NETWORKDAYS: "NETWORKDAYS_OP", SUBTOTAL: "SUBTOTAL_N", DELTA: "DELTA_OP", GESTEP: "GESTEP_OP", MULTINOMIAL: "MULTINOMIAL_N", SERIESSUM: "SERIESSUM_N", SEC: "SEC_OP", CSC: "CSC_OP", COTH: "COTH_OP", SECH: "SECH_OP", CSCH: "CSCH_OP", SUMIFS: "SUMIFS_N", AVERAGEIFS: "AVERAGEIFS_N", NA: "NA_OP", COT: "COT_OP", ACOT: "ACOT_OP", UNICODE: "UNICODE_OP", UNICHAR: "UNICHAR_OP", ENCODEURL: "ENCODEURL_OP", DAYS: "DAYS_OP", EOMONTH: "EOMONTH_OP", DATEDIF: "DATEDIF_OP", PERMUT: "PERMUT_OP", FACTDOUBLE: "FACTDOUBLE_OP",
  DATEVALUE: "DATEVALUE_OP", EDATE: "EDATE_OP", WEEKDAY: "WEEKDAY_OP", WEEKNUM: "WEEKNUM_OP", ROMAN: "ROMAN_OP", ARABIC: "ARABIC_OP", TEXT: "TEXT_OP", NUMBERVALUE: "NUMBERVALUE_OP", REPT: "REPT_OP", EXACT: "EXACT_OP", FIND: "FIND_OP", REPLACE: "REPLACE_OP", SEARCH: "SEARCH_OP",
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
  { name: "AVERAGE", args: "range | values...", description: "Average of values (alias for AVG)", category: "stat" },
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
  { name: "ISLOGICAL", args: "value", description: "TRUE if boolean", category: "info" },
  { name: "ISNONTEXT", args: "value", description: "TRUE if not text", category: "info" },
  { name: "ERRORTYPE", args: "error_value", description: "Numeric error type code", category: "info" },
  { name: "ISEVEN", args: "number", description: "TRUE if even", category: "info" },
  { name: "ISODD", args: "number", description: "TRUE if odd", category: "info" },
  { name: "ISNUMBER", args: "value", description: "Alias for ISNUM", category: "info" },
  { name: "SQRTPI", args: "number", description: "Square root of (PI × number)", category: "math" },
  { name: "BASE", args: "number, radix", description: "Convert number to text in given base", category: "math" },
  { name: "DECIMAL", args: "text, radix", description: "Parse text in given base to number", category: "math" },
  { name: "CEILING.MATH", args: "number, significance", description: "Round up to nearest significance", category: "math" },
  { name: "FLOOR.MATH", args: "number, significance", description: "Round down to nearest significance", category: "math" },
  { name: "ROUNDUP", args: "number, digits", description: "Round away from zero", category: "math" },
  { name: "ROUNDDOWN", args: "number, digits", description: "Round toward zero", category: "math" },
  { name: "INT", args: "number", description: "Truncate to integer (toward negative infinity)", category: "math" },
  { name: "EVEN", args: "number", description: "Round up to nearest even integer", category: "math" },
  { name: "ODD", args: "number", description: "Round up to nearest odd integer", category: "math" },
  { name: "TRUNC", args: "number", description: "Truncate toward zero", category: "math" },
  { name: "EXP", args: "number", description: "e raised to power", category: "math" },
  { name: "LN", args: "number", description: "Natural logarithm", category: "math" },
  { name: "LOG2", args: "number", description: "Base-2 logarithm", category: "math" },
  { name: "RANDBETWEEN", args: "low, high", description: "Random integer between bounds", category: "volatile" },
  { name: "IRR", args: "cashflows...", description: "Internal rate of return (Newton-Raphson)", category: "financial" },
  { name: "RATE", args: "nper, pmt, pv", description: "Solve for interest rate (Newton-Raphson)", category: "financial" },
  { name: "DB", args: "cost, salvage, life, period", description: "Declining balance depreciation", category: "financial" },
  { name: "SLN", args: "cost, salvage, life", description: "Straight-line depreciation", category: "financial" },
  { name: "NPV", args: "rate, cashflows...", description: "Net present value of cash flows", category: "financial" },
  { name: "NPER", args: "rate, pmt, pv", description: "Number of payment periods", category: "financial" },
  { name: "PMT", args: "rate, nper, pv", description: "Loan payment amount", category: "financial" },
  { name: "FV", args: "rate, nper, pmt", description: "Future value of annuity", category: "financial" },
  { name: "PV", args: "rate, nper, pmt", description: "Present value of annuity", category: "financial" },
  { name: "MROUND", args: "number, multiple", description: "Round to nearest multiple", category: "math" },
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
  { name: "IFNA", args: "value, alt", description: "Return alt if value is error", category: "logic" },
  { name: "TINV", args: "probability, df", description: "Inverse Student's t-distribution", category: "stat" },
  { name: "CHISQ.INV", args: "probability, df", description: "Inverse chi-squared distribution", category: "stat" },
  { name: "FINV", args: "probability, df1, df2", description: "Inverse F-distribution", category: "stat" },
  { name: "GAMMALN", args: "x", description: "Natural log of gamma function", category: "math" },
  { name: "GAMMA", args: "x", description: "Gamma function Γ(x)", category: "math" },
  { name: "CHISQ.DIST", args: "x, df, cumulative", description: "Chi-squared distribution", category: "stat" },
  { name: "TDIST", args: "x, df", description: "Student's t-distribution CDF", category: "stat" },
  { name: "FDIST", args: "x, df1, df2", description: "F-distribution CDF", category: "stat" },
  { name: "PHI", args: "x", description: "Standard normal PDF φ(x)", category: "stat" },
  { name: "GAUSS", args: "x", description: "Area under normal curve from 0 to x", category: "stat" },
  { name: "MIDB", args: "text, start, num_bytes", description: "MID for bytes", category: "text" },
  { name: "DBCS", args: "text", description: "Half-width to full-width (CJK)", category: "text" },
  { name: "ASC", args: "text", description: "Full-width to half-width (CJK)", category: "text" },
  { name: "CONCAT_WS", args: "separator, values...", description: "Concatenate with separator", category: "text" },
  { name: "TEXTREVERSE", args: "text", description: "Reverse a string", category: "text" },
  { name: "FVSCHEDULE", args: "pv, rates...", description: "Future value with variable rate schedule", category: "financial" },
  { name: "CUMIPMT", args: "rate, nper, pv, start, end", description: "Cumulative interest paid", category: "financial" },
  { name: "COLUMNS", args: "values...", description: "Count of values (column count)", category: "info" },
  { name: "INDIRECT", args: "ref", description: "Return reference value (simplified)", category: "lookup" },
  { name: "OFFSET", args: "ref", description: "Return offset reference (simplified)", category: "lookup" },
  { name: "ZTEST", args: "sigma, mu0, values...", description: "One-sample z-test p-value", category: "stat" },
  { name: "COVARIANCE.S", args: "x1,...,xK,y1,...,yK", description: "Sample covariance (n-1)", category: "stat" },
  { name: "STDEV.S", args: "values...", description: "Sample standard deviation (n-1)", category: "stat" },
  { name: "TIMEVALUE", args: "time_string", description: "Convert time string to serial", category: "info" },
  { name: "TIME", args: "hour, minute, second", description: "Construct time serial", category: "info" },
  { name: "GROWTH", args: "known_y...", description: "Exponential growth prediction", category: "stat" },
  { name: "TREND", args: "known_y...", description: "Linear trend prediction", category: "stat" },
  { name: "FREQUENCY", args: "data...", description: "Frequency distribution count", category: "stat" },
  { name: "PROB", args: "lower, upper, values...", description: "Probability of values in range", category: "stat" },
  { name: "LAMBDA", args: "params..., body", description: "User-defined function (simplified)", category: "logic" },
  { name: "MAP", args: "values...", description: "Apply operation to each value", category: "logic" },
  { name: "REDUCE", args: "initial, values...", description: "Reduce values (default: sum)", category: "logic" },
  { name: "SCAN", args: "initial, values...", description: "Running accumulation", category: "logic" },
  { name: "BYROW", args: "values...", description: "Apply by row (1D identity)", category: "logic" },
  { name: "BYCOL", args: "values...", description: "Apply by column (1D identity)", category: "logic" },
  { name: "LEFTB", args: "text, num_bytes", description: "Left bytes of string", category: "text" },
  { name: "RIGHTB", args: "text, num_bytes", description: "Right bytes of string", category: "text" },
  { name: "LENB", args: "text", description: "Length in bytes (UTF-8)", category: "text" },
  { name: "BAHTTEXT", args: "number", description: "Number to Thai baht text", category: "text" },
  { name: "PHONETIC", args: "text", description: "Phonetic reading (identity for non-CJK)", category: "text" },
  { name: "BESSELY", args: "x, order", description: "Bessel function of second kind Yn(x)", category: "math" },
  { name: "HEX2BIN", args: "hex_string", description: "Hexadecimal to binary", category: "math" },
  { name: "HEX2OCT", args: "hex_string", description: "Hexadecimal to octal", category: "math" },
  { name: "OCT2BIN", args: "octal_string", description: "Octal to binary", category: "math" },
  { name: "OCT2HEX", args: "octal_string", description: "Octal to hexadecimal", category: "math" },
  { name: "IMTAN", args: "complex_string", description: "Complex tangent", category: "math" },
  { name: "IMLOG2", args: "complex_string", description: "Complex log base 2", category: "math" },
  { name: "IMLOG10", args: "complex_string", description: "Complex log base 10", category: "math" },
  { name: "DPRODUCT", args: "values...", description: "Product of all values", category: "stat" },
  { name: "FORMULATEXT", args: "value", description: "Return formula as text", category: "info" },
  { name: "ADDRESS", args: "row, col", description: "Construct cell reference string", category: "lookup" },
  { name: "IMDIV", args: "complex1, complex2", description: "Divide two complex numbers", category: "math" },
  { name: "IMSUB", args: "complex1, complex2", description: "Subtract two complex numbers", category: "math" },
  { name: "BIN2DEC", args: "binary_string", description: "Binary to decimal", category: "math" },
  { name: "DEC2BIN", args: "number", description: "Decimal to binary string", category: "math" },
  { name: "BIN2HEX", args: "binary_string", description: "Binary to hexadecimal", category: "math" },
  { name: "HEX2DEC", args: "hex_string", description: "Hexadecimal to decimal", category: "math" },
  { name: "DEC2HEX", args: "number", description: "Decimal to hexadecimal string", category: "math" },
  { name: "OCT2DEC", args: "octal_string", description: "Octal to decimal", category: "math" },
  { name: "DEC2OCT", args: "number", description: "Decimal to octal string", category: "math" },
  { name: "BITAND", args: "a, b", description: "Bitwise AND", category: "math" },
  { name: "BITOR", args: "a, b", description: "Bitwise OR", category: "math" },
  { name: "BITXOR", args: "a, b", description: "Bitwise XOR", category: "math" },
  { name: "BITLSHIFT", args: "number, shift", description: "Bitwise left shift", category: "math" },
  { name: "BITRSHIFT", args: "number, shift", description: "Bitwise right shift", category: "math" },
  { name: "IMPOWER", args: "complex, n", description: "Raise complex to integer power", category: "math" },
  { name: "IMEXP", args: "complex_string", description: "Complex exponential e^z", category: "math" },
  { name: "IMLN", args: "complex_string", description: "Complex natural logarithm", category: "math" },
  { name: "IMSIN", args: "complex_string", description: "Complex sine", category: "math" },
  { name: "IMCOS", args: "complex_string", description: "Complex cosine", category: "math" },
  { name: "IMSUM", args: "complex1, complex2", description: "Add two complex numbers", category: "math" },
  { name: "IMPRODUCT", args: "complex1, complex2", description: "Multiply two complex numbers", category: "math" },
  { name: "IMARGUMENT", args: "complex_string", description: "Argument (angle) of complex number", category: "math" },
  { name: "IMCONJUGATE", args: "complex_string", description: "Conjugate of complex number", category: "math" },
  { name: "IMSQRT", args: "complex_string", description: "Square root of complex number", category: "math" },
  { name: "BESSELJ", args: "x, order", description: "Bessel function of first kind Jn(x)", category: "math" },
  { name: "COMPLEX", args: "real, imaginary", description: "Create complex number string", category: "math" },
  { name: "IMREAL", args: "complex_string", description: "Extract real part of complex", category: "math" },
  { name: "IMAGINARY", args: "complex_string", description: "Extract imaginary part of complex", category: "math" },
  { name: "IMABS", args: "complex_string", description: "Absolute value of complex number", category: "math" },
  { name: "TAKE", args: "count, values...", description: "Take first N values", category: "lookup" },
  { name: "DROP", args: "count, values...", description: "Drop first N values, keep rest", category: "lookup" },
  { name: "HSTACK", args: "values...", description: "Horizontal stack (combine values)", category: "lookup" },
  { name: "WRAPROWS", args: "wrap_count, values...", description: "Wrap flat array into rows", category: "lookup" },
  { name: "ISFORMULA", args: "value", description: "TRUE if cell contains formula", category: "info" },
  { name: "REGEXMATCH", args: "text, pattern", description: "Test if text matches regex", category: "text" },
  { name: "REGEXEXTRACT", args: "text, pattern", description: "Extract first regex match (group 1 if present)", category: "text" },
  { name: "REGEXREPLACE", args: "text, pattern, replacement", description: "Replace regex matches globally", category: "text" },
  { name: "LET", args: "name1, val1, ..., expression", description: "Bind named values for sub-expressions", category: "logic" },
  { name: "CHOOSECOLS", args: "indices..., values...", description: "Pick specific values by 1-based index", category: "lookup" },
  { name: "SUMXMY2", args: "x1,...,xK,y1,...,yK", description: "Sum of (xi-yi)² (squared differences)", category: "stat" },
  { name: "SUMX2PY2", args: "x1,...,xK,y1,...,yK", description: "Sum of (xi²+yi²)", category: "stat" },
  { name: "SUMX2MY2", args: "x1,...,xK,y1,...,yK", description: "Sum of (xi²-yi²)", category: "stat" },
  { name: "ERF", args: "x", description: "Error function erf(x)", category: "math" },
  { name: "ERFC", args: "x", description: "Complementary error function 1-erf(x)", category: "math" },
  { name: "YEARFRAC", args: "start, end", description: "Fraction of year between dates", category: "info" },
  { name: "COUPDAYBS", args: "settlement, frequency", description: "Days from coupon period start", category: "financial" },
  { name: "TBILLYIELD", args: "settlement, maturity, price", description: "Treasury bill yield", category: "financial" },
  { name: "RECEIVED", args: "settlement, maturity, investment, discount", description: "Amount received at maturity", category: "financial" },
  { name: "PRICEDISC", args: "settlement, maturity, discount, redemption", description: "Price of discounted security", category: "financial" },
  { name: "MIRR", args: "finance_rate, reinvest_rate, cashflows...", description: "Modified internal rate of return", category: "financial" },
  { name: "XNPV", args: "rate, date1, cf1, date2, cf2, ...", description: "NPV with irregular dates", category: "financial" },
  { name: "ACCRINT", args: "settlement, rate, par, frequency", description: "Accrued interest (simplified)", category: "financial" },
  { name: "COUPDAYS", args: "settlement, maturity, frequency", description: "Days in coupon period", category: "financial" },
  { name: "DOLLARDE", args: "fractional, fraction", description: "Fractional dollar to decimal", category: "financial" },
  { name: "DOLLARFR", args: "decimal, fraction", description: "Decimal dollar to fractional", category: "financial" },
  { name: "SORT", args: "values...", description: "Sort values ascending", category: "lookup" },
  { name: "UNIQUE", args: "values...", description: "Remove duplicates", category: "lookup" },
  { name: "FILTER", args: "criteria, values...", description: "Filter values matching criteria", category: "lookup" },
  { name: "PPMT", args: "rate, period, nper, pv", description: "Principal portion of payment", category: "financial" },
  { name: "IPMT", args: "rate, period, nper, pv", description: "Interest portion of payment", category: "financial" },
  { name: "CELL", args: "value", description: "Cell type info (v=value, l=label, b=bool, e=error)", category: "info" },
  { name: "ROWS", args: "values...", description: "Count of values (array row count)", category: "info" },
  { name: "RANDARRAY", args: "count", description: "Generate N random numbers", category: "volatile" },
  { name: "SEQUENCE", args: "count, [start], [step]", description: "Generate number sequence", category: "info" },
  { name: "XMATCH", args: "lookup, values...", description: "Extended MATCH (exact then nearest)", category: "lookup" },
  { name: "CEILING.PRECISE", args: "number, significance", description: "Round up to nearest significance (always positive)", category: "math" },
  { name: "FLOOR.PRECISE", args: "number, significance", description: "Round down to nearest significance (always positive)", category: "math" },
  { name: "AVERAGEA", args: "values...", description: "Average including text(=0), bool(=0/1)", category: "stat" },
  { name: "MAXA", args: "values...", description: "Max including text(=0), bool(=0/1)", category: "stat" },
  { name: "MINA", args: "values...", description: "Min including text(=0), bool(=0/1)", category: "stat" },
  { name: "NEGBINOMDIST", args: "failures, successes, prob", description: "Negative binomial distribution PMF", category: "stat" },
  { name: "BETADIST", args: "x, alpha, beta", description: "Beta distribution CDF", category: "stat" },
  { name: "HYPGEOMDIST", args: "k, draws, pop_success, pop_size", description: "Hypergeometric distribution CDF", category: "stat" },
  { name: "ISNA", args: "value", description: "Check if value is #N/A error", category: "info" },
  { name: "SHEET", args: "(none)", description: "Sheet number (always 1)", category: "info" },
  { name: "TEXTSPLIT", args: "text, delimiter, [index]", description: "Split text and return Nth piece (1-based)", category: "text" },
  { name: "DATESTRING", args: "serial_date", description: "Serial date to YYYY-MM-DD string", category: "info" },
  { name: "WORKDAY", args: "start_serial, days", description: "Business day offset (skips weekends)", category: "info" },
  { name: "TEXTBEFORE", args: "text, delimiter", description: "Text before first occurrence of delimiter", category: "text" },
  { name: "TEXTAFTER", args: "text, delimiter", description: "Text after first occurrence of delimiter", category: "text" },
  { name: "VALUETOTEXT", args: "value", description: "Convert any value to text representation", category: "text" },
  { name: "ISPMT", args: "rate, period, nper, pv", description: "Interest payment for a period", category: "financial" },
  { name: "DISC", args: "settlement, maturity, price, redemption", description: "Discount rate of a security", category: "financial" },
  { name: "INTRATE", args: "settlement, maturity, investment, redemption", description: "Interest rate for fully invested security", category: "financial" },
  { name: "SYD", args: "cost, salvage, life, period", description: "Sum-of-years-digits depreciation", category: "financial" },
  { name: "EFFECT", args: "nominal_rate, npery", description: "Effective annual interest rate", category: "financial" },
  { name: "NOMINAL", args: "effect_rate, npery", description: "Nominal rate from effective rate", category: "financial" },
  { name: "NORMINV", args: "probability, mean, stdev", description: "Inverse normal (quantile function)", category: "stat" },
  { name: "DDB", args: "cost, salvage, life, period", description: "Double declining balance depreciation", category: "financial" },
  { name: "PERCENTRANK", args: "target, values...", description: "Percentile rank (0-1) in dataset", category: "stat" },
  { name: "QUARTILE", args: "quart(0-4), values...", description: "Quartile value (Q0=min, Q2=median, Q4=max)", category: "stat" },
  { name: "WEIBULL", args: "x, alpha, beta", description: "Weibull distribution CDF", category: "stat" },
  { name: "GAMMADIST", args: "x, alpha, beta", description: "Gamma distribution CDF (integer α)", category: "stat" },
  { name: "EXPONDIST", args: "x, lambda", description: "Exponential distribution CDF (1-e^(-λx))", category: "stat" },
  { name: "POISSON", args: "x, mean", description: "Poisson cumulative distribution", category: "stat" },
  { name: "BINOMDIST", args: "successes, trials, prob", description: "Binomial cumulative distribution", category: "stat" },
  { name: "LOGNORMDIST", args: "x, mean, stdev", description: "Log-normal cumulative distribution", category: "stat" },
  { name: "STANDARDIZE", args: "x, mean, stdev", description: "Z-score ((x-μ)/σ)", category: "stat" },
  { name: "CONFIDENCE", args: "alpha, stdev, n", description: "Confidence interval half-width", category: "stat" },
  { name: "NORMDIST", args: "x, mean, stdev", description: "Cumulative normal distribution Φ(z)", category: "stat" },
  { name: "STEYX", args: "x1,...,xK,y1,...,yK", description: "Standard error of predicted y", category: "stat" },
  { name: "FISHER", args: "x", description: "Fisher transformation (arctanh)", category: "stat" },
  { name: "FISHERINV", args: "y", description: "Inverse Fisher transformation (tanh)", category: "stat" },
  { name: "KURT", args: "values...", description: "Excess kurtosis", category: "stat" },
  { name: "SKEW", args: "values...", description: "Skewness", category: "stat" },
  { name: "CONVERT", args: "value, from_unit, to_unit", description: "Unit conversion (length/weight/temp/time)", category: "math" },
  { name: "SLOPE", args: "x1,...,xK,y1,...,yK", description: "Slope of linear regression line", category: "stat" },
  { name: "INTERCEPT", args: "x1,...,xK,y1,...,yK", description: "Y-intercept of linear regression", category: "stat" },
  { name: "RSQ", args: "x1,...,xK,y1,...,yK", description: "R² coefficient of determination", category: "stat" },
  { name: "COVAR", args: "x1,...,xK,y1,...,yK", description: "Population covariance", category: "stat" },
  { name: "FORECAST", args: "x, known_xs..., known_ys...", description: "Linear forecast (y = mx + b)", category: "stat" },
  { name: "STDEV.P", args: "values...", description: "Population standard deviation (÷N)", category: "stat" },
  { name: "VAR.P", args: "values...", description: "Population variance (÷N)", category: "stat" },
  { name: "CORREL", args: "x1,...,xK,y1,...,yK", description: "Pearson correlation coefficient", category: "stat" },
  { name: "SUMSQ", args: "values...", description: "Sum of squares (Σx²)", category: "stat" },
  { name: "DEVSQ", args: "values...", description: "Sum of squared deviations from mean", category: "stat" },
  { name: "AVEDEV", args: "values...", description: "Average absolute deviation from mean", category: "stat" },
  { name: "TRIMMEAN", args: "pct, values...", description: "Trimmed mean (remove % extremes)", category: "stat" },
  { name: "XOR", args: "values...", description: "Exclusive OR (true if odd # TRUE)", category: "logic" },
  { name: "ISOWEEKNUM", args: "serial_date", description: "ISO 8601 week number", category: "info" },
  { name: "NETWORKDAYS", args: "start, end", description: "Business days between dates (excl. weekends)", category: "info" },
  { name: "SUBTOTAL", args: "function_num, values...", description: "SUBTOTAL dispatcher (1=AVG,2=COUNT,4=MAX,5=MIN,9=SUM)", category: "stat" },
  { name: "DELTA", args: "a, b", description: "Kronecker delta (1 if a=b, 0 otherwise)", category: "math" },
  { name: "GESTEP", args: "x, step", description: "Step function (1 if x≥step, 0 otherwise)", category: "math" },
  { name: "MULTINOMIAL", args: "values...", description: "Multinomial coefficient (a+b+c)!/(a!·b!·c!)", category: "math" },
  { name: "SERIESSUM", args: "x, n, m, coeffs...", description: "Power series Σ(coeff·x^(n+i·m))", category: "math" },
  { name: "SEC", args: "number", description: "Secant (1/cos)", category: "math" },
  { name: "CSC", args: "number", description: "Cosecant (1/sin)", category: "math" },
  { name: "COTH", args: "number", description: "Hyperbolic cotangent", category: "math" },
  { name: "SECH", args: "number", description: "Hyperbolic secant", category: "math" },
  { name: "CSCH", args: "number", description: "Hyperbolic cosecant", category: "math" },
  { name: "SUMIFS", args: "criteria1, criteria2, values...", description: "Sum matching all criteria (AND)", category: "stat" },
  { name: "AVERAGEIFS", args: "criteria1, criteria2, values...", description: "Average matching all criteria (AND)", category: "stat" },
  { name: "NA", args: "(none)", description: "Generate #N/A error value", category: "info" },
  { name: "COT", args: "number", description: "Cotangent (1/tan)", category: "math" },
  { name: "ACOT", args: "number", description: "Inverse cotangent", category: "math" },
  { name: "UNICODE", args: "text", description: "Unicode code point of first character", category: "text" },
  { name: "UNICHAR", args: "number", description: "Unicode code point to character", category: "text" },
  { name: "ENCODEURL", args: "text", description: "Percent-encode text for URLs", category: "text" },
  { name: "DAYS", args: "end_serial, start_serial", description: "Days between two serial dates", category: "info" },
  { name: "EOMONTH", args: "start_serial, months", description: "End of month + months offset", category: "info" },
  { name: "DATEDIF", args: "start, end, unit", description: "Date difference (D/M/Y)", category: "info" },
  { name: "PERMUT", args: "n, k", description: "Permutations n!/(n-k)!", category: "math" },
  { name: "FACTDOUBLE", args: "number", description: "Double factorial n!!", category: "math" },
  { name: "DATEVALUE", args: "date_text", description: "Parse date string to Excel serial", category: "info" },
  { name: "EDATE", args: "start_serial, months", description: "Add months to serial date", category: "info" },
  { name: "WEEKDAY", args: "serial_date", description: "Day of week (1=Sun...7=Sat)", category: "info" },
  { name: "WEEKNUM", args: "serial_date", description: "Week number of the year", category: "info" },
  { name: "ROMAN", args: "number", description: "Convert number to Roman numerals", category: "text" },
  { name: "ARABIC", args: "roman_text", description: "Convert Roman numerals to number", category: "text" },
  { name: "TEXT", args: "number, format", description: "Format number as text (0.00, #,##0, 0%)", category: "text" },
  { name: "NUMBERVALUE", args: "text", description: "Parse text to number (strips $, commas, %)", category: "text" },
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
  { name: "VAR", args: "values...", description: "Sample variance", category: "stat" },
  { name: "PERCENTILE", args: "k, values...", description: "K-th percentile (0-1)", category: "stat" },
  { name: "COUNTA", args: "values...", description: "Count non-blank values", category: "stat" },
  { name: "COUNTBLANK", args: "values...", description: "Count blank values", category: "stat" },
  { name: "SUMPRODUCT", args: "a1,...aN, b1,...bN", description: "Sum of pairwise products", category: "math" },
  { name: "COUNTIF", args: "criteria, values...", description: "Count values matching criteria", category: "stat" },
  { name: "SUMIF", args: "criteria, values...", description: "Sum values matching criteria", category: "stat" },
  { name: "MATCH", args: "lookup, values...", description: "Position of value in list (1-based)", category: "lookup" },
  { name: "INDEX", args: "position, values...", description: "Return value at position", category: "lookup" },
  { name: "MODE", args: "values...", description: "Most frequent value", category: "stat" },
  { name: "HARMEAN", args: "values...", description: "Harmonic mean (N / Σ(1/xi))", category: "stat" },
  { name: "GEOMEAN", args: "values...", description: "Geometric mean ((x1·x2·...·xn)^(1/n))", category: "stat" },
  { name: "AGGREGATE", args: "function_num, values...", description: "Versatile aggregation (1=AVG,4=MAX,5=MIN,9=SUM...)", category: "stat" },
  { name: "COUNTIFS", args: "criteria1, criteria2, values...", description: "Count matching ALL criteria (AND)", category: "stat" },
  { name: "MAXIFS", args: "criteria, values...", description: "Max of values matching criteria", category: "stat" },
  { name: "MINIFS", args: "criteria, values...", description: "Min of values matching criteria", category: "stat" },
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
    LEN_OP: "LEN", TRIM_OP: "TRIM", UPPER_OP: "UPPER", LOWER_OP: "LOWER", PROPER_OP: "PROPER", CLEAN_OP: "CLEAN", CHAR_OP: "CHAR", CODE_OP: "CODE", T_OP: "T",
    ISLOGICAL_OP: "ISLOGICAL", ISNONTEXT_OP: "ISNONTEXT", ERROR_TYPE_OP: "ERRORTYPE", ISEVEN_OP: "ISEVEN", ISODD_OP: "ISODD",
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
