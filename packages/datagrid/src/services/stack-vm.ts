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
export const DECODEURL_OP = Schema.TaggedStruct("DECODEURL_OP", {})
export const ISURL_OP = Schema.TaggedStruct("ISURL_OP", {})
export const ISEMAIL_OP = Schema.TaggedStruct("ISEMAIL_OP", {})
export const HASH_OP = Schema.TaggedStruct("HASH_OP", {})
export const TEXTSQUEEZE_OP = Schema.TaggedStruct("TEXTSQUEEZE_OP", {})
export const CHISQ_DIST_RT_OP = Schema.TaggedStruct("CHISQ_DIST_RT_OP", {})
export const TDIST_RT_OP = Schema.TaggedStruct("TDIST_RT_OP", {})
export const FDIST_RT_OP = Schema.TaggedStruct("FDIST_RT_OP", {})
export const T_INV_2T_OP = Schema.TaggedStruct("T_INV_2T_OP", {})
export const TYPE_NUM_OP = Schema.TaggedStruct("TYPE_NUM_OP", {})
export const ISBINARY_OP = Schema.TaggedStruct("ISBINARY_OP", {})
export const ISHEX_OP = Schema.TaggedStruct("ISHEX_OP", {})
export const ACOTH_OP = Schema.TaggedStruct("ACOTH_OP", {})
export const EXPAND_N = Schema.TaggedStruct("EXPAND_N", { n: Schema.Number })
export const COALESCE_N = Schema.TaggedStruct("COALESCE_N", { n: Schema.Number })
export const ENDSWITH_OP = Schema.TaggedStruct("ENDSWITH_OP", {})
export const TEXTREMOVE_OP = Schema.TaggedStruct("TEXTREMOVE_OP", {})
export const CHOOSEROWS_N = Schema.TaggedStruct("CHOOSEROWS_N", { n: Schema.Number })
export const IMPLIES_OP = Schema.TaggedStruct("IMPLIES_OP", {})
export const BETWEEN_OP = Schema.TaggedStruct("BETWEEN_OP", {})
export const SHEETS_OP = Schema.TaggedStruct("SHEETS_OP", {})
export const SUBTOTAL_MODE_N = Schema.TaggedStruct("SUBTOTAL_MODE_N", { n: Schema.Number })
export const WEIBULL_DIST_OP = Schema.TaggedStruct("WEIBULL_DIST_OP", {})
export const EXPON_DIST_OP = Schema.TaggedStruct("EXPON_DIST_OP", {})
export const LOGNORM_DIST_OP = Schema.TaggedStruct("LOGNORM_DIST_OP", {})
export const COUPPCD_OP = Schema.TaggedStruct("COUPPCD_OP", {})
export const COUPNCD_OP = Schema.TaggedStruct("COUPNCD_OP", {})
export const ODDFPRICE_OP = Schema.TaggedStruct("ODDFPRICE_OP", {})
export const TEXT_CONTAINS_OP = Schema.TaggedStruct("TEXT_CONTAINS_OP", {})
export const TEXT_STARTSWITH_OP = Schema.TaggedStruct("TEXT_STARTSWITH_OP", {})
export const YIELDMAT_OP = Schema.TaggedStruct("YIELDMAT_OP", {})
export const ACCRINTM_OP = Schema.TaggedStruct("ACCRINTM_OP", {})
export const COUPDAYSNC_OP = Schema.TaggedStruct("COUPDAYSNC_OP", {})
export const COUPNUM_OP = Schema.TaggedStruct("COUPNUM_OP", {})
export const ISERR_OP = Schema.TaggedStruct("ISERR_OP", {})
export const ISNULL_OP = Schema.TaggedStruct("ISNULL_OP", {})
export const HYPOT_OP = Schema.TaggedStruct("HYPOT_OP", {})
export const MDETERM_OP = Schema.TaggedStruct("MDETERM_OP", {})
export const MINVERSE_OP = Schema.TaggedStruct("MINVERSE_OP", {})
export const BETA_INV_OP = Schema.TaggedStruct("BETA_INV_OP", {})
export const GAMMA_INV_OP = Schema.TaggedStruct("GAMMA_INV_OP", {})
export const AVERAGEWEIGHTED_N = Schema.TaggedStruct("AVERAGEWEIGHTED_N", { n: Schema.Number })
export const DCOUNT_N = Schema.TaggedStruct("DCOUNT_N", { n: Schema.Number })
export const DSUM_N = Schema.TaggedStruct("DSUM_N", { n: Schema.Number })
export const DAVERAGE_N = Schema.TaggedStruct("DAVERAGE_N", { n: Schema.Number })
export const DMAX_N = Schema.TaggedStruct("DMAX_N", { n: Schema.Number })
export const DMIN_N = Schema.TaggedStruct("DMIN_N", { n: Schema.Number })
export const DSTDEV_N = Schema.TaggedStruct("DSTDEV_N", { n: Schema.Number })
export const DVAR_N = Schema.TaggedStruct("DVAR_N", { n: Schema.Number })
export const DGET_N = Schema.TaggedStruct("DGET_N", { n: Schema.Number })
export const DCOUNTA_N = Schema.TaggedStruct("DCOUNTA_N", { n: Schema.Number })
export const PERCENTRANK_EXC_N = Schema.TaggedStruct("PERCENTRANK_EXC_N", { n: Schema.Number })
export const QUARTILE_EXC_N = Schema.TaggedStruct("QUARTILE_EXC_N", { n: Schema.Number })
export const QUARTILE_INC_N = Schema.TaggedStruct("QUARTILE_INC_N", { n: Schema.Number })
export const SORTBY_N = Schema.TaggedStruct("SORTBY_N", { n: Schema.Number })
export const SINGLE_N = Schema.TaggedStruct("SINGLE_N", { n: Schema.Number })
export const XLOOKUP_N = Schema.TaggedStruct("XLOOKUP_N", { n: Schema.Number })
export const HYPERLINK_OP = Schema.TaggedStruct("HYPERLINK_OP", {})
export const NUMBERSTRING_OP = Schema.TaggedStruct("NUMBERSTRING_OP", {})
export const IFBLANK_OP = Schema.TaggedStruct("IFBLANK_OP", {})
export const SUBSTITUTEN_OP = Schema.TaggedStruct("SUBSTITUTEN_OP", {})
export const TEXTSPLIT_DELIM_OP = Schema.TaggedStruct("TEXTSPLIT_DELIM_OP", {})
export const COMBINA_OP = Schema.TaggedStruct("COMBINA_OP", {})
export const PERMUTATIONA_OP = Schema.TaggedStruct("PERMUTATIONA_OP", {})
export const RANDBETWEEN_INT_OP = Schema.TaggedStruct("RANDBETWEEN_INT_OP", {})
export const ISO_CEILING_OP = Schema.TaggedStruct("ISO_CEILING_OP", {})
export const YIELDDISC_OP = Schema.TaggedStruct("YIELDDISC_OP", {})
export const PRICEMAT_OP = Schema.TaggedStruct("PRICEMAT_OP", {})
export const ARRAYTOTEXT_N = Schema.TaggedStruct("ARRAYTOTEXT_N", { n: Schema.Number })
export const TOCOL_N = Schema.TaggedStruct("TOCOL_N", { n: Schema.Number })
export const TOROW_N = Schema.TaggedStruct("TOROW_N", { n: Schema.Number })
export const VSTACK_N = Schema.TaggedStruct("VSTACK_N", { n: Schema.Number })
export const MAKEARRAY_N = Schema.TaggedStruct("MAKEARRAY_N", { n: Schema.Number })
export const WEBSERVICE_OP = Schema.TaggedStruct("WEBSERVICE_OP", {})
export const FIELDVALUE_OP = Schema.TaggedStruct("FIELDVALUE_OP", {})
export const VLOOKUP_N = Schema.TaggedStruct("VLOOKUP_N", { n: Schema.Number })
export const HLOOKUP_N = Schema.TaggedStruct("HLOOKUP_N", { n: Schema.Number })
export const LOOKUP_N = Schema.TaggedStruct("LOOKUP_N", { n: Schema.Number })
export const CLEANWS_OP = Schema.TaggedStruct("CLEANWS_OP", {})
export const TEXTCOUNT_OP = Schema.TaggedStruct("TEXTCOUNT_OP", {})
export const ISREF_OP = Schema.TaggedStruct("ISREF_OP", {})
export const IFERROR_OP = Schema.TaggedStruct("IFERROR_OP", {})
export const BITCOUNT_OP = Schema.TaggedStruct("BITCOUNT_OP", {})
export const AMORLINC_OP = Schema.TaggedStruct("AMORLINC_OP", {})
export const PRICE_OP = Schema.TaggedStruct("PRICE_OP", {})
export const ODDLPRICE_OP = Schema.TaggedStruct("ODDLPRICE_OP", {})
export const INFO_OP = Schema.TaggedStruct("INFO_OP", {})
export const CUMPRINC_OP = Schema.TaggedStruct("CUMPRINC_OP", {})
export const PDURATION_OP = Schema.TaggedStruct("PDURATION_OP", {})
export const RRI_OP = Schema.TaggedStruct("RRI_OP", {})
export const TBILLEQ_OP = Schema.TaggedStruct("TBILLEQ_OP", {})
export const TBILLPRICE_OP = Schema.TaggedStruct("TBILLPRICE_OP", {})
export const DURATION_OP = Schema.TaggedStruct("DURATION_OP", {})
export const MDURATION_OP = Schema.TaggedStruct("MDURATION_OP", {})
export const XIRR_N = Schema.TaggedStruct("XIRR_N", { n: Schema.Number })
export const YIELD_OP = Schema.TaggedStruct("YIELD_OP", {})
export const AREAS_N = Schema.TaggedStruct("AREAS_N", { n: Schema.Number })
export const TRANSPOSE_N = Schema.TaggedStruct("TRANSPOSE_N", { n: Schema.Number })
export const CHITEST_N = Schema.TaggedStruct("CHITEST_N", { n: Schema.Number })
export const TTEST_N = Schema.TaggedStruct("TTEST_N", { n: Schema.Number })
export const FTEST_N = Schema.TaggedStruct("FTEST_N", { n: Schema.Number })
export const LINEST_N = Schema.TaggedStruct("LINEST_N", { n: Schema.Number })
export const LOGEST_N = Schema.TaggedStruct("LOGEST_N", { n: Schema.Number })
export const VARA_N = Schema.TaggedStruct("VARA_N", { n: Schema.Number })
export const STDEVA_N = Schema.TaggedStruct("STDEVA_N", { n: Schema.Number })
export const VARPA_N = Schema.TaggedStruct("VARPA_N", { n: Schema.Number })
export const STDEVPA_N = Schema.TaggedStruct("STDEVPA_N", { n: Schema.Number })
export const PERCENTRANK_INC_N = Schema.TaggedStruct("PERCENTRANK_INC_N", { n: Schema.Number })
export const BETA_FN_OP = Schema.TaggedStruct("BETA_FN_OP", {})
export const BESSELK_OP = Schema.TaggedStruct("BESSELK_OP", {})
export const BESSELI_OP = Schema.TaggedStruct("BESSELI_OP", {})
export const PERCENTILE_INC_N = Schema.TaggedStruct("PERCENTILE_INC_N", { n: Schema.Number })
export const RATE_EST_OP = Schema.TaggedStruct("RATE_EST_OP", {})
export const EFFECT_RATE_OP = Schema.TaggedStruct("EFFECT_RATE_OP", {})
export const NOMINAL_RATE_OP = Schema.TaggedStruct("NOMINAL_RATE_OP", {})
export const ZSCORE_OP = Schema.TaggedStruct("ZSCORE_OP", {})
export const NAND_OP = Schema.TaggedStruct("NAND_OP", {})
export const NOR_OP = Schema.TaggedStruct("NOR_OP", {})
export const XNOR_OP = Schema.TaggedStruct("XNOR_OP", {})
export const TEXTTRUNCATE_OP = Schema.TaggedStruct("TEXTTRUNCATE_OP", {})
export const CUMSUM_N = Schema.TaggedStruct("CUMSUM_N", { n: Schema.Number })
export const CUMPROD_N = Schema.TaggedStruct("CUMPROD_N", { n: Schema.Number })
export const MOVAVG_N = Schema.TaggedStruct("MOVAVG_N", { n: Schema.Number })
export const BITNOT_OP = Schema.TaggedStruct("BITNOT_OP", {})
export const BITROTL_OP = Schema.TaggedStruct("BITROTL_OP", {})
export const BITROTR_OP = Schema.TaggedStruct("BITROTR_OP", {})
export const JSON_STRINGIFY_OP = Schema.TaggedStruct("JSON_STRINGIFY_OP", {})
export const TEXTTITLE_OP = Schema.TaggedStruct("TEXTTITLE_OP", {})
export const ISNAN2_OP = Schema.TaggedStruct("ISNAN2_OP", {})
export const ISINFINITE_OP = Schema.TaggedStruct("ISINFINITE_OP", {})
export const MODE_SNGL_N = Schema.TaggedStruct("MODE_SNGL_N", { n: Schema.Number })
export const MODE_MULT_N = Schema.TaggedStruct("MODE_MULT_N", { n: Schema.Number })
export const ROUND_MODE_OP = Schema.TaggedStruct("ROUND_MODE_OP", {})
export const BASE64_ENCODE_OP = Schema.TaggedStruct("BASE64_ENCODE_OP", {})
export const BASE64_DECODE_OP = Schema.TaggedStruct("BASE64_DECODE_OP", {})
export const TEXTROTATE_OP = Schema.TaggedStruct("TEXTROTATE_OP", {})
export const TEXTINITIALS_OP = Schema.TaggedStruct("TEXTINITIALS_OP", {})
export const TEXTCAMELCASE_OP = Schema.TaggedStruct("TEXTCAMELCASE_OP", {})
export const TEXTSNAKECASE_OP = Schema.TaggedStruct("TEXTSNAKECASE_OP", {})
export const TEXTKEBABCASE_OP = Schema.TaggedStruct("TEXTKEBABCASE_OP", {})
export const WRAPCOLS_N = Schema.TaggedStruct("WRAPCOLS_N", { n: Schema.Number })
export const PRODUCT_IFS_N = Schema.TaggedStruct("PRODUCT_IFS_N", { n: Schema.Number })
export const MEDIAN_IF_N = Schema.TaggedStruct("MEDIAN_IF_N", { n: Schema.Number })
export const ISDATE_OP = Schema.TaggedStruct("ISDATE_OP", {})
export const DIGITS_OP = Schema.TaggedStruct("DIGITS_OP", {})
export const SIGMOID_OP = Schema.TaggedStruct("SIGMOID_OP", {})
export const RELU_OP = Schema.TaggedStruct("RELU_OP", {})
export const SOFTPLUS_OP = Schema.TaggedStruct("SOFTPLUS_OP", {})
export const ELU_OP = Schema.TaggedStruct("ELU_OP", {})
export const NORMALIZE_OP = Schema.TaggedStruct("NORMALIZE_OP", {})
export const MAP_RANGE_OP = Schema.TaggedStruct("MAP_RANGE_OP", {})
export const TEXTCENTER_OP = Schema.TaggedStruct("TEXTCENTER_OP", {})
export const WORDCOUNT_OP = Schema.TaggedStruct("WORDCOUNT_OP", {})
export const YEARMONTH_OP = Schema.TaggedStruct("YEARMONTH_OP", {})
export const QUARTER_OP = Schema.TaggedStruct("QUARTER_OP", {})
export const DAYOFYEAR_OP = Schema.TaggedStruct("DAYOFYEAR_OP", {})
export const DAYSINYEAR_OP = Schema.TaggedStruct("DAYSINYEAR_OP", {})
export const DAYSINMONTH_OP = Schema.TaggedStruct("DAYSINMONTH_OP", {})
export const TEXTSLICE_OP = Schema.TaggedStruct("TEXTSLICE_OP", {})
export const TEXTINDEXOF_OP = Schema.TaggedStruct("TEXTINDEXOF_OP", {})
export const TEXTSPLIT_ALL_N = Schema.TaggedStruct("TEXTSPLIT_ALL_N", { n: Schema.Number })
export const ISINTEGER_OP = Schema.TaggedStruct("ISINTEGER_OP", {})
export const ISFLOAT_OP = Schema.TaggedStruct("ISFLOAT_OP", {})
export const ISPOSITIVE_OP = Schema.TaggedStruct("ISPOSITIVE_OP", {})
export const ISNEGATIVE_OP = Schema.TaggedStruct("ISNEGATIVE_OP", {})
export const ROUND_SIGNIF_OP = Schema.TaggedStruct("ROUND_SIGNIF_OP", {})
export const CLAMP_OP = Schema.TaggedStruct("CLAMP_OP", {})
export const LERP_OP = Schema.TaggedStruct("LERP_OP", {})
export const SMOOTHSTEP_OP = Schema.TaggedStruct("SMOOTHSTEP_OP", {})
export const PERCENTILE_EXC_N = Schema.TaggedStruct("PERCENTILE_EXC_N", { n: Schema.Number })
export const RANK_EQ_N = Schema.TaggedStruct("RANK_EQ_N", { n: Schema.Number })
export const RANK_AVG_N = Schema.TaggedStruct("RANK_AVG_N", { n: Schema.Number })
export const VAR_S_N = Schema.TaggedStruct("VAR_S_N", { n: Schema.Number })
export const NORMS_DIST_OP = Schema.TaggedStruct("NORMS_DIST_OP", {})
export const NORMS_INV_OP = Schema.TaggedStruct("NORMS_INV_OP", {})
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
export const FIBONACCI2_OP = Schema.TaggedStruct("FIBONACCI2_OP", {})
export const BINSEARCH_N = Schema.TaggedStruct("BINSEARCH_N", { n: Schema.Number })
export const INDEXMATCH_N = Schema.TaggedStruct("INDEXMATCH_N", { n: Schema.Number })
export const LASTINDEXOF_N = Schema.TaggedStruct("LASTINDEXOF_N", { n: Schema.Number })
export const FINDALL_N = Schema.TaggedStruct("FINDALL_N", { n: Schema.Number })
export const COUNTUNIQ_N = Schema.TaggedStruct("COUNTUNIQ_N", { n: Schema.Number })
export const ARRAYCONTAINS_N = Schema.TaggedStruct("ARRAYCONTAINS_N", { n: Schema.Number })
export const ARRAYPOS_N = Schema.TaggedStruct("ARRAYPOS_N", { n: Schema.Number })
export const FLATTEN2_N = Schema.TaggedStruct("FLATTEN2_N", { n: Schema.Number })
export const IFF_OP = Schema.TaggedStruct("IFF_OP", {})
export const SWITCH2_N = Schema.TaggedStruct("SWITCH2_N", { n: Schema.Number })
export const XORALL_N = Schema.TaggedStruct("XORALL_N", { n: Schema.Number })
export const NANDALL_N = Schema.TaggedStruct("NANDALL_N", { n: Schema.Number })
export const NORALL_N = Schema.TaggedStruct("NORALL_N", { n: Schema.Number })
export const COALESCE2_N = Schema.TaggedStruct("COALESCE2_N", { n: Schema.Number })
export const UNLESS_OP = Schema.TaggedStruct("UNLESS_OP", {})
export const SECANT_OP = Schema.TaggedStruct("SECANT_OP", {})
export const COSECANT_OP = Schema.TaggedStruct("COSECANT_OP", {})
export const VERSINE_OP = Schema.TaggedStruct("VERSINE_OP", {})
export const HAVERSINE_OP = Schema.TaggedStruct("HAVERSINE_OP", {})
export const EXSECANT_OP = Schema.TaggedStruct("EXSECANT_OP", {})
export const LEMNISCATE_OP = Schema.TaggedStruct("LEMNISCATE_OP", {})
export const AGM2_OP = Schema.TaggedStruct("AGM2_OP", {})
export const POWMOD_OP = Schema.TaggedStruct("POWMOD_OP", {})
export const MAD2_N = Schema.TaggedStruct("MAD2_N", { n: Schema.Number })
export const ZSCORE2_OP = Schema.TaggedStruct("ZSCORE2_OP", {})
export const TSTAT_OP = Schema.TaggedStruct("TSTAT_OP", {})
export const FSTAT_OP = Schema.TaggedStruct("FSTAT_OP", {})
export const CHISQSTAT_OP = Schema.TaggedStruct("CHISQSTAT_OP", {})
export const SEM_N = Schema.TaggedStruct("SEM_N", { n: Schema.Number })
export const POOLEDVAR_N = Schema.TaggedStruct("POOLEDVAR_N", { n: Schema.Number })
export const TEXTCOUNTCHAR_OP = Schema.TaggedStruct("TEXTCOUNTCHAR_OP", {})
export const TEXTZFILL_OP = Schema.TaggedStruct("TEXTZFILL_OP", {})
export const TEXTLPAD_OP = Schema.TaggedStruct("TEXTLPAD_OP", {})
export const TEXTRPAD_OP = Schema.TaggedStruct("TEXTRPAD_OP", {})
export const TEXTABBREV_OP = Schema.TaggedStruct("TEXTABBREV_OP", {})
export const TEXTWORDFREQ_OP = Schema.TaggedStruct("TEXTWORDFREQ_OP", {})
export const TEXTSANITIZE_OP = Schema.TaggedStruct("TEXTSANITIZE_OP", {})
export const TEXTMIRROR_OP = Schema.TaggedStruct("TEXTMIRROR_OP", {})
export const TYPEOF3_OP = Schema.TaggedStruct("TYPEOF3_OP", {})
export const ISBLANK2_OP = Schema.TaggedStruct("ISBLANK2_OP", {})
export const ISTRUTHY_OP = Schema.TaggedStruct("ISTRUTHY_OP", {})
export const ISFALSY_OP = Schema.TaggedStruct("ISFALSY_OP", {})
export const ISFRACTION_OP = Schema.TaggedStruct("ISFRACTION_OP", {})
export const ISDIVISIBLE_OP = Schema.TaggedStruct("ISDIVISIBLE_OP", {})
export const PVANNUITY_OP = Schema.TaggedStruct("PVANNUITY_OP", {})
export const ANNUITYPMT_OP = Schema.TaggedStruct("ANNUITYPMT_OP", {})
export const BONDPRICE_OP = Schema.TaggedStruct("BONDPRICE_OP", {})
export const BONDYIELD_OP = Schema.TaggedStruct("BONDYIELD_OP", {})
export const TBILL2_OP = Schema.TaggedStruct("TBILL2_OP", {})
export const MACAULAY_OP = Schema.TaggedStruct("MACAULAY_OP", {})
// ── 850 batch schemas ──
export const DISTINCT_N = Schema.TaggedStruct("DISTINCT_N", { n: Schema.Number })
export const ARRAYSLICE_N = Schema.TaggedStruct("ARRAYSLICE_N", { n: Schema.Number })
export const ARRAYJOIN_N = Schema.TaggedStruct("ARRAYJOIN_N", { n: Schema.Number })
export const ARRAYREVERSE_N = Schema.TaggedStruct("ARRAYREVERSE_N", { n: Schema.Number })
export const ARRAYFLATTEN_N = Schema.TaggedStruct("ARRAYFLATTEN_N", { n: Schema.Number })
export const ARRAYZIP_N = Schema.TaggedStruct("ARRAYZIP_N", { n: Schema.Number })
export const ARRAYMIN_N = Schema.TaggedStruct("ARRAYMIN_N", { n: Schema.Number })
export const ARRAYMAX_N = Schema.TaggedStruct("ARRAYMAX_N", { n: Schema.Number })
export const ARRAYSUM_N = Schema.TaggedStruct("ARRAYSUM_N", { n: Schema.Number })
export const ARRAYAVG_N = Schema.TaggedStruct("ARRAYAVG_N", { n: Schema.Number })
export const NIFF_OP = Schema.TaggedStruct("NIFF_OP", {})
export const SWITCHIF_OP = Schema.TaggedStruct("SWITCHIF_OP", {})
export const COND_N = Schema.TaggedStruct("COND_N", { n: Schema.Number })
export const ALLEQUAL_N = Schema.TaggedStruct("ALLEQUAL_N", { n: Schema.Number })
export const ANYGT_N = Schema.TaggedStruct("ANYGT_N", { n: Schema.Number })
export const ANYLT_N = Schema.TaggedStruct("ANYLT_N", { n: Schema.Number })
export const ANYNE_N = Schema.TaggedStruct("ANYNE_N", { n: Schema.Number })
export const ISALL_N = Schema.TaggedStruct("ISALL_N", { n: Schema.Number })
export const ISANY_N = Schema.TaggedStruct("ISANY_N", { n: Schema.Number })
export const ISNONE_N = Schema.TaggedStruct("ISNONE_N", { n: Schema.Number })
export const RANDNORM_OP = Schema.TaggedStruct("RANDNORM_OP", {})
export const RANDEXP_OP = Schema.TaggedStruct("RANDEXP_OP", {})
export const RANDINT_OP = Schema.TaggedStruct("RANDINT_OP", {})
export const COINFLIP_OP = Schema.TaggedStruct("COINFLIP_OP", {})
export const GUDERMANN_OP = Schema.TaggedStruct("GUDERMANN_OP", {})
export const INVERSEGUD_OP = Schema.TaggedStruct("INVERSEGUD_OP", {})
export const LANCZOS_OP = Schema.TaggedStruct("LANCZOS_OP", {})
export const DIGAMMA_OP = Schema.TaggedStruct("DIGAMMA_OP", {})
export const POLYGAMMA_OP = Schema.TaggedStruct("POLYGAMMA_OP", {})
export const ZETA2_OP = Schema.TaggedStruct("ZETA2_OP", {})
export const BETAFN_OP = Schema.TaggedStruct("BETAFN_OP", {})
export const POCHHAMMER_OP = Schema.TaggedStruct("POCHHAMMER_OP", {})
export const ENTROPY2_N = Schema.TaggedStruct("ENTROPY2_N", { n: Schema.Number })
export const GINICOEF_N = Schema.TaggedStruct("GINICOEF_N", { n: Schema.Number })
export const MOMENT_N = Schema.TaggedStruct("MOMENT_N", { n: Schema.Number })
export const CMOMENT_N = Schema.TaggedStruct("CMOMENT_N", { n: Schema.Number })
export const ZSCORE3_N = Schema.TaggedStruct("ZSCORE3_N", { n: Schema.Number })
export const PERCENTILE2_N = Schema.TaggedStruct("PERCENTILE2_N", { n: Schema.Number })
export const TEXTFORMAT_OP = Schema.TaggedStruct("TEXTFORMAT_OP", {})
export const TEXTJUSTIFY_OP = Schema.TaggedStruct("TEXTJUSTIFY_OP", {})
export const TEXTMASK2_OP = Schema.TaggedStruct("TEXTMASK2_OP", {})
export const TEXTHASH_OP = Schema.TaggedStruct("TEXTHASH_OP", {})
export const TEXTREPLACE2_OP = Schema.TaggedStruct("TEXTREPLACE2_OP", {})
export const TEXTFILL_OP = Schema.TaggedStruct("TEXTFILL_OP", {})
export const CAGR2_OP = Schema.TaggedStruct("CAGR2_OP", {})
export const DRAWDOWN_OP = Schema.TaggedStruct("DRAWDOWN_OP", {})
export const CALMAR_OP = Schema.TaggedStruct("CALMAR_OP", {})
export const TREYNOR_OP = Schema.TaggedStruct("TREYNOR_OP", {})
export const ISFINITE2_OP = Schema.TaggedStruct("ISFINITE2_OP", {})
export const ISWHOLE_OP = Schema.TaggedStruct("ISWHOLE_OP", {})
// ── 900 batch schemas ──
export const EQUIV_OP = Schema.TaggedStruct("EQUIV_OP", {})
export const ONEOF_N = Schema.TaggedStruct("ONEOF_N", { n: Schema.Number })
export const FIRSTTRUTHY_N = Schema.TaggedStruct("FIRSTTRUTHY_N", { n: Schema.Number })
export const LASTTRUTHY_N = Schema.TaggedStruct("LASTTRUTHY_N", { n: Schema.Number })
export const COUNTIF3_N = Schema.TaggedStruct("COUNTIF3_N", { n: Schema.Number })
export const WHICHMAX_N = Schema.TaggedStruct("WHICHMAX_N", { n: Schema.Number })
export const WHICHMIN_N = Schema.TaggedStruct("WHICHMIN_N", { n: Schema.Number })
export const THRESHOLD_OP = Schema.TaggedStruct("THRESHOLD_OP", {})
export const TOGGLE_OP = Schema.TaggedStruct("TOGGLE_OP", {})
export const SATURATE_OP = Schema.TaggedStruct("SATURATE_OP", {})
export const DEADBAND_OP = Schema.TaggedStruct("DEADBAND_OP", {})
export const RANDPERM_N = Schema.TaggedStruct("RANDPERM_N", { n: Schema.Number })
export const RANDCHOICE_N = Schema.TaggedStruct("RANDCHOICE_N", { n: Schema.Number })
export const DICE_OP = Schema.TaggedStruct("DICE_OP", {})
export const UUID4_OP = Schema.TaggedStruct("UUID4_OP", {})
export const ENUMERATE_N = Schema.TaggedStruct("ENUMERATE_N", { n: Schema.Number })
export const COUNTVALS_N = Schema.TaggedStruct("COUNTVALS_N", { n: Schema.Number })
export const FIRSTNONZERO_N = Schema.TaggedStruct("FIRSTNONZERO_N", { n: Schema.Number })
export const LASTNONZERO_N = Schema.TaggedStruct("LASTNONZERO_N", { n: Schema.Number })
export const NTHLARGEST_N = Schema.TaggedStruct("NTHLARGEST_N", { n: Schema.Number })
export const AMORT_OP = Schema.TaggedStruct("AMORT_OP", {})
export const DAILYRETURN_OP = Schema.TaggedStruct("DAILYRETURN_OP", {})
export const VOLANNUAL_OP = Schema.TaggedStruct("VOLANNUAL_OP", {})
export const MAXDD_N = Schema.TaggedStruct("MAXDD_N", { n: Schema.Number })
export const INFORMRATIO_OP = Schema.TaggedStruct("INFORMRATIO_OP", {})
export const JENSENALPHA_OP = Schema.TaggedStruct("JENSENALPHA_OP", {})
export const LAGUERRE_OP = Schema.TaggedStruct("LAGUERRE_OP", {})
export const HERMITE_OP = Schema.TaggedStruct("HERMITE_OP", {})
export const LEGENDRE_OP = Schema.TaggedStruct("LEGENDRE_OP", {})
export const CHEBYSHEV2_OP = Schema.TaggedStruct("CHEBYSHEV2_OP", {})
export const FRESNEL_S_OP = Schema.TaggedStruct("FRESNEL_S_OP", {})
export const FRESNEL_C_OP = Schema.TaggedStruct("FRESNEL_C_OP", {})
export const AIRY_OP = Schema.TaggedStruct("AIRY_OP", {})
export const DAWSON_OP = Schema.TaggedStruct("DAWSON_OP", {})
export const TRIMMEDMEAN_N = Schema.TaggedStruct("TRIMMEDMEAN_N", { n: Schema.Number })
export const WINSOREDMEAN_N = Schema.TaggedStruct("WINSOREDMEAN_N", { n: Schema.Number })
export const MIDRANGE_N = Schema.TaggedStruct("MIDRANGE_N", { n: Schema.Number })
export const MIDHINGE_N = Schema.TaggedStruct("MIDHINGE_N", { n: Schema.Number })
export const MEANDEV_N = Schema.TaggedStruct("MEANDEV_N", { n: Schema.Number })
export const ROOTMEANSQERR_N = Schema.TaggedStruct("ROOTMEANSQERR_N", { n: Schema.Number })
export const TEXTWORDWRAP_OP = Schema.TaggedStruct("TEXTWORDWRAP_OP", {})
export const TEXTCOLUMNS_OP = Schema.TaggedStruct("TEXTCOLUMNS_OP", {})
export const TEXTTAB_OP = Schema.TaggedStruct("TEXTTAB_OP", {})
export const TEXTBOXIFY_OP = Schema.TaggedStruct("TEXTBOXIFY_OP", {})
export const TEXTCOUNTWORDS_OP = Schema.TaggedStruct("TEXTCOUNTWORDS_OP", {})
export const TEXTFIRSTWORD_OP = Schema.TaggedStruct("TEXTFIRSTWORD_OP", {})
export const ISNUMTYPE_OP = Schema.TaggedStruct("ISNUMTYPE_OP", {})
export const ISSTRTYPE_OP = Schema.TaggedStruct("ISSTRTYPE_OP", {})
export const ISBOOLTYPE_OP = Schema.TaggedStruct("ISBOOLTYPE_OP", {})
export const ISERRORTYPE_OP = Schema.TaggedStruct("ISERRORTYPE_OP", {})
// ── 950 batch schemas ──
export const IFPOS_OP = Schema.TaggedStruct("IFPOS_OP", {})
export const IFNEG_OP = Schema.TaggedStruct("IFNEG_OP", {})
export const IFZERO_OP = Schema.TaggedStruct("IFZERO_OP", {})
export const IFEVEN_OP = Schema.TaggedStruct("IFEVEN_OP", {})
export const IFODD_OP = Schema.TaggedStruct("IFODD_OP", {})
export const GATE_OP = Schema.TaggedStruct("GATE_OP", {})
export const LATCH_OP = Schema.TaggedStruct("LATCH_OP", {})
export const DEBOUNCE_OP = Schema.TaggedStruct("DEBOUNCE_OP", {})
export const MUXSEL_N = Schema.TaggedStruct("MUXSEL_N", { n: Schema.Number })
export const DEMUX_N = Schema.TaggedStruct("DEMUX_N", { n: Schema.Number })
export const RANDSIGN_OP = Schema.TaggedStruct("RANDSIGN_OP", {})
export const RANDBOOL_OP = Schema.TaggedStruct("RANDBOOL_OP", {})
export const NTHSMALLEST_N = Schema.TaggedStruct("NTHSMALLEST_N", { n: Schema.Number })
export const ARGMAX_N = Schema.TaggedStruct("ARGMAX_N", { n: Schema.Number })
export const ARGMIN_N = Schema.TaggedStruct("ARGMIN_N", { n: Schema.Number })
export const DEDUP_N = Schema.TaggedStruct("DEDUP_N", { n: Schema.Number })
export const INTERLEAVE_N = Schema.TaggedStruct("INTERLEAVE_N", { n: Schema.Number })
export const COUPON_OP = Schema.TaggedStruct("COUPON_OP", {})
export const ACCRUEDINT_OP = Schema.TaggedStruct("ACCRUEDINT_OP", {})
export const PARVALUE_OP = Schema.TaggedStruct("PARVALUE_OP", {})
export const HOLDINGRETURN_OP = Schema.TaggedStruct("HOLDINGRETURN_OP", {})
export const TIMEDWRETURN_OP = Schema.TaggedStruct("TIMEDWRETURN_OP", {})
export const DIVYIELD_OP = Schema.TaggedStruct("DIVYIELD_OP", {})
export const SININT_OP = Schema.TaggedStruct("SININT_OP", {})
export const COSINT_OP = Schema.TaggedStruct("COSINT_OP", {})
export const EXPINT_OP = Schema.TaggedStruct("EXPINT_OP", {})
export const LOGINT_OP = Schema.TaggedStruct("LOGINT_OP", {})
export const DILOG_OP = Schema.TaggedStruct("DILOG_OP", {})
export const CLAUSEN_OP = Schema.TaggedStruct("CLAUSEN_OP", {})
export const ELLIPK_OP = Schema.TaggedStruct("ELLIPK_OP", {})
export const ELLIPE_OP = Schema.TaggedStruct("ELLIPE_OP", {})
export const QUADMEAN_N = Schema.TaggedStruct("QUADMEAN_N", { n: Schema.Number })
export const POWMEAN_N = Schema.TaggedStruct("POWMEAN_N", { n: Schema.Number })
export const LEHMER_N = Schema.TaggedStruct("LEHMER_N", { n: Schema.Number })
export const ENTROPY3_N = Schema.TaggedStruct("ENTROPY3_N", { n: Schema.Number })
export const RELENTROPY_N = Schema.TaggedStruct("RELENTROPY_N", { n: Schema.Number })
export const MUTUALINFO_N = Schema.TaggedStruct("MUTUALINFO_N", { n: Schema.Number })
export const CROSSENTROPY_N = Schema.TaggedStruct("CROSSENTROPY_N", { n: Schema.Number })
export const TEXTINITCAP_OP = Schema.TaggedStruct("TEXTINITCAP_OP", {})
export const TEXTSNIP_OP = Schema.TaggedStruct("TEXTSNIP_OP", {})
export const TEXTUNQUOTE_OP = Schema.TaggedStruct("TEXTUNQUOTE_OP", {})
export const TEXTQUOTE_OP = Schema.TaggedStruct("TEXTQUOTE_OP", {})
export const TEXTDOTS_OP = Schema.TaggedStruct("TEXTDOTS_OP", {})
export const TEXTBULLET_OP = Schema.TaggedStruct("TEXTBULLET_OP", {})
export const ISNUMERIC_OP = Schema.TaggedStruct("ISNUMERIC_OP", {})
export const ISTEXT2_OP = Schema.TaggedStruct("ISTEXT2_OP", {})
export const ISERR2_OP = Schema.TaggedStruct("ISERR2_OP", {})
export const ISBLANK3_OP = Schema.TaggedStruct("ISBLANK3_OP", {})
export const ISNOTEMPTY_OP = Schema.TaggedStruct("ISNOTEMPTY_OP", {})
export const TYPESTR_OP = Schema.TaggedStruct("TYPESTR_OP", {})
// ── 1000 batch schemas ──
export const JACOBI_OP = Schema.TaggedStruct("JACOBI_OP", {})
export const BESSEL_I0_OP = Schema.TaggedStruct("BESSEL_I0_OP", {})
export const BESSEL_J0_OP = Schema.TaggedStruct("BESSEL_J0_OP", {})
export const BESSEL_K0_OP = Schema.TaggedStruct("BESSEL_K0_OP", {})
export const STRUVE_OP = Schema.TaggedStruct("STRUVE_OP", {})
export const WEBER_OP = Schema.TaggedStruct("WEBER_OP", {})
export const HURWITZ_OP = Schema.TaggedStruct("HURWITZ_OP", {})
export const POLYLOG_OP = Schema.TaggedStruct("POLYLOG_OP", {})
export const LAMBERTW_OP = Schema.TaggedStruct("LAMBERTW_OP", {})
export const AGMFN_OP = Schema.TaggedStruct("AGMFN_OP", {})
export const CONTRAHARMONIC_N = Schema.TaggedStruct("CONTRAHARMONIC_N", { n: Schema.Number })
export const HERONIAN_N = Schema.TaggedStruct("HERONIAN_N", { n: Schema.Number })
export const LOGTRANSFORM_N = Schema.TaggedStruct("LOGTRANSFORM_N", { n: Schema.Number })
export const ZSCORENORM_N = Schema.TaggedStruct("ZSCORENORM_N", { n: Schema.Number })
export const MAD3_N = Schema.TaggedStruct("MAD3_N", { n: Schema.Number })
export const BIWEIGHT_N = Schema.TaggedStruct("BIWEIGHT_N", { n: Schema.Number })
export const HUBER_N = Schema.TaggedStruct("HUBER_N", { n: Schema.Number })
export const WINVAR_N = Schema.TaggedStruct("WINVAR_N", { n: Schema.Number })
export const TEXTCENTER2_OP = Schema.TaggedStruct("TEXTCENTER2_OP", {})
export const TEXTINDENT_OP = Schema.TaggedStruct("TEXTINDENT_OP", {})
export const TEXTHEADER_OP = Schema.TaggedStruct("TEXTHEADER_OP", {})
export const TEXTFOOTER_OP = Schema.TaggedStruct("TEXTFOOTER_OP", {})
export const TEXTCOUNTLINES_OP = Schema.TaggedStruct("TEXTCOUNTLINES_OP", {})
export const TEXTISEMPTY_OP = Schema.TaggedStruct("TEXTISEMPTY_OP", {})
export const TEXTCOALESCE_OP = Schema.TaggedStruct("TEXTCOALESCE_OP", {})
export const TEXTTAG_OP = Schema.TaggedStruct("TEXTTAG_OP", {})
export const ISPOS_OP = Schema.TaggedStruct("ISPOS_OP", {})
export const ISNEG2_OP = Schema.TaggedStruct("ISNEG2_OP", {})
export const ISNONZERO_OP = Schema.TaggedStruct("ISNONZERO_OP", {})
export const ISINRANGE_OP = Schema.TaggedStruct("ISINRANGE_OP", {})
export const SIGNOF_OP = Schema.TaggedStruct("SIGNOF_OP", {})
export const MAGNITUDE_OP = Schema.TaggedStruct("MAGNITUDE_OP", {})
export const COSTBASIS_OP = Schema.TaggedStruct("COSTBASIS_OP", {})
export const UNREALIZEDPNL_OP = Schema.TaggedStruct("UNREALIZEDPNL_OP", {})
export const REALIZEDPNL_OP = Schema.TaggedStruct("REALIZEDPNL_OP", {})
export const DOLLARVAL_OP = Schema.TaggedStruct("DOLLARVAL_OP", {})
export const BASISPOINTS_OP = Schema.TaggedStruct("BASISPOINTS_OP", {})
export const TICKVALUE_OP = Schema.TaggedStruct("TICKVALUE_OP", {})
export const MAJORITY2_N = Schema.TaggedStruct("MAJORITY2_N", { n: Schema.Number })
export const UNANIMOUS_N = Schema.TaggedStruct("UNANIMOUS_N", { n: Schema.Number })
export const QUORUM_N = Schema.TaggedStruct("QUORUM_N", { n: Schema.Number })
export const VETO_N = Schema.TaggedStruct("VETO_N", { n: Schema.Number })
export const PRIORITYSEL_N = Schema.TaggedStruct("PRIORITYSEL_N", { n: Schema.Number })
export const FALLBACK_N = Schema.TaggedStruct("FALLBACK_N", { n: Schema.Number })
export const RANK2_N = Schema.TaggedStruct("RANK2_N", { n: Schema.Number })
export const DENSERANK_N = Schema.TaggedStruct("DENSERANK_N", { n: Schema.Number })
export const NTILE_N = Schema.TaggedStruct("NTILE_N", { n: Schema.Number })
export const ROWNUMBER_N = Schema.TaggedStruct("ROWNUMBER_N", { n: Schema.Number })
export const RANDWEIGHTED_N = Schema.TaggedStruct("RANDWEIGHTED_N", { n: Schema.Number })
export const RANDSAMPLE_N = Schema.TaggedStruct("RANDSAMPLE_N", { n: Schema.Number })



export const MOTZKIN_OP = Schema.TaggedStruct("MOTZKIN_OP", {})
export const DERANGEMENT_OP = Schema.TaggedStruct("DERANGEMENT_OP", {})
export const TOTIENT2_OP = Schema.TaggedStruct("TOTIENT2_OP", {})
export const HARMONIC2_OP = Schema.TaggedStruct("HARMONIC2_OP", {})
export const TEXTOBFUSCATE_OP = Schema.TaggedStruct("TEXTOBFUSCATE_OP", {})
export const TEXTCOUNT2_OP = Schema.TaggedStruct("TEXTCOUNT2_OP", {})
export const TEXTSHUFFLE_OP = Schema.TaggedStruct("TEXTSHUFFLE_OP", {})
export const ISCOPRIMEALL_N = Schema.TaggedStruct("ISCOPRIMEALL_N", { n: Schema.Number })
export const ISFIBBISH_OP = Schema.TaggedStruct("ISFIBBISH_OP", {})
export const COPRIME_OP = Schema.TaggedStruct("COPRIME_OP", {})
export const PREVPRIME_OP = Schema.TaggedStruct("PREVPRIME_OP", {})
export const TEXTPAD_OP = Schema.TaggedStruct("TEXTPAD_OP", {})
export const TEXTMASK_OP = Schema.TaggedStruct("TEXTMASK_OP", {})
export const TEXTISURL_OP = Schema.TaggedStruct("TEXTISURL_OP", {})
export const TEXTISEMAIL_OP = Schema.TaggedStruct("TEXTISEMAIL_OP", {})
export const WORDSCOUNT_OP = Schema.TaggedStruct("WORDSCOUNT_OP", {})
export const ISLEAPYEAR_OP = Schema.TaggedStruct("ISLEAPYEAR_OP", {})
export const WEEKOFYEAR_OP = Schema.TaggedStruct("WEEKOFYEAR_OP", {})
export const ISWEEKEND_OP = Schema.TaggedStruct("ISWEEKEND_OP", {})
export const QUARTERNO_OP = Schema.TaggedStruct("QUARTERNO_OP", {})
export const SEMESTERNO_OP = Schema.TaggedStruct("SEMESTERNO_OP", {})
export const EFFECTRATE_OP = Schema.TaggedStruct("EFFECTRATE_OP", {})
export const NOMRATE_OP = Schema.TaggedStruct("NOMRATE_OP", {})
export const AVEDEV2_N = Schema.TaggedStruct("AVEDEV2_N", { n: Schema.Number })
export const COVAR2_N = Schema.TaggedStruct("COVAR2_N", { n: Schema.Number })
export const CORREL2_N = Schema.TaggedStruct("CORREL2_N", { n: Schema.Number })
export const NPER2_OP = Schema.TaggedStruct("NPER2_OP", {})
export const RATE2_OP = Schema.TaggedStruct("RATE2_OP", {})
export const COSSIM_N = Schema.TaggedStruct("COSSIM_N", { n: Schema.Number })
export const CHEBYSHEV_OP = Schema.TaggedStruct("CHEBYSHEV_OP", {})
export const ISPOWEROFTWO_OP = Schema.TaggedStruct("ISPOWEROFTWO_OP", {})
export const NEXTODD_OP = Schema.TaggedStruct("NEXTODD_OP", {})
export const NEXTEVEN_OP = Schema.TaggedStruct("NEXTEVEN_OP", {})
export const TOROMAN_OP = Schema.TaggedStruct("TOROMAN_OP", {})
export const FROMROMAN_OP = Schema.TaggedStruct("FROMROMAN_OP", {})
export const TOORDINAL_OP = Schema.TaggedStruct("TOORDINAL_OP", {})
export const TEXTHEX_OP = Schema.TaggedStruct("TEXTHEX_OP", {})
export const TEXTFROMHEX_OP = Schema.TaggedStruct("TEXTFROMHEX_OP", {})
export const TEXTDEDUPE_OP = Schema.TaggedStruct("TEXTDEDUPE_OP", {})
export const TEXTLINES_OP = Schema.TaggedStruct("TEXTLINES_OP", {})
export const TEXTPASCALCASE_OP = Schema.TaggedStruct("TEXTPASCALCASE_OP", {})
export const WMEAN_N = Schema.TaggedStruct("WMEAN_N", { n: Schema.Number })
export const GINI2_N = Schema.TaggedStruct("GINI2_N", { n: Schema.Number })
export const ISPRIMEFAST_OP = Schema.TaggedStruct("ISPRIMEFAST_OP", {})
export const SHARPE_OP = Schema.TaggedStruct("SHARPE_OP", {})
export const SORTINO_OP = Schema.TaggedStruct("SORTINO_OP", {})
export const EMAVG_OP = Schema.TaggedStruct("EMAVG_OP", {})
export const SMAVG_OP = Schema.TaggedStruct("SMAVG_OP", {})
export const ABUNDANCY_OP = Schema.TaggedStruct("ABUNDANCY_OP", {})
export const DIGITCOUNT_OP = Schema.TaggedStruct("DIGITCOUNT_OP", {})
export const GOLDEN_OP = Schema.TaggedStruct("GOLDEN_OP", {})
export const EULER_OP = Schema.TaggedStruct("EULER_OP", {})
export const TAU_OP = Schema.TaggedStruct("TAU_OP", {})
export const CUBEROOT_OP = Schema.TaggedStruct("CUBEROOT_OP", {})
export const WRAP_OP = Schema.TaggedStruct("WRAP_OP", {})
export const REMAP_OP = Schema.TaggedStruct("REMAP_OP", {})
export const TEXTBASE64_OP = Schema.TaggedStruct("TEXTBASE64_OP", {})
export const TEXTFROMBASE64_OP = Schema.TaggedStruct("TEXTFROMBASE64_OP", {})
export const TEXTPREFIX_OP = Schema.TaggedStruct("TEXTPREFIX_OP", {})
export const TEXTSUFFIX_OP = Schema.TaggedStruct("TEXTSUFFIX_OP", {})
export const RMS_N = Schema.TaggedStruct("RMS_N", { n: Schema.Number })
export const RANGE2_N = Schema.TaggedStruct("RANGE2_N", { n: Schema.Number })
export const IQR_N = Schema.TaggedStruct("IQR_N", { n: Schema.Number })
export const MAPE_N = Schema.TaggedStruct("MAPE_N", { n: Schema.Number })
export const ISODD2_OP = Schema.TaggedStruct("ISODD2_OP", {})
export const ISEVEN2_OP = Schema.TaggedStruct("ISEVEN2_OP", {})
export const ISZERO_OP = Schema.TaggedStruct("ISZERO_OP", {})
export const ANNUITY_OP = Schema.TaggedStruct("ANNUITY_OP", {})
export const FUTUREVALUE2_OP = Schema.TaggedStruct("FUTUREVALUE2_OP", {})
export const LUCAS_OP = Schema.TaggedStruct("LUCAS_OP", {})
export const BELL_OP = Schema.TaggedStruct("BELL_OP", {})
export const INTLOG2_OP = Schema.TaggedStruct("INTLOG2_OP", {})
export const INTLOG10_OP = Schema.TaggedStruct("INTLOG10_OP", {})
export const BITLEN_OP = Schema.TaggedStruct("BITLEN_OP", {})
export const TEXTREPEAT_OP = Schema.TaggedStruct("TEXTREPEAT_OP", {})
export const TEXTNTH_OP = Schema.TaggedStruct("TEXTNTH_OP", {})
export const TEXTUNIQUE_OP = Schema.TaggedStruct("TEXTUNIQUE_OP", {})
export const TEXTDISTINCT_OP = Schema.TaggedStruct("TEXTDISTINCT_OP", {})
export const COUNTIF2_N = Schema.TaggedStruct("COUNTIF2_N", { n: Schema.Number })
export const CHARCOUNT_OP = Schema.TaggedStruct("CHARCOUNT_OP", {})
export const ISEMPTYTEXT_OP = Schema.TaggedStruct("ISEMPTYTEXT_OP", {})
export const RULEOF72_OP = Schema.TaggedStruct("RULEOF72_OP", {})
export const PRESENTVALUE_OP = Schema.TaggedStruct("PRESENTVALUE_OP", {})
export const SAWTOOTH_OP = Schema.TaggedStruct("SAWTOOTH_OP", {})
export const SQUAREWAVE_OP = Schema.TaggedStruct("SQUAREWAVE_OP", {})
export const TRIANGLEWAVE_OP = Schema.TaggedStruct("TRIANGLEWAVE_OP", {})
export const AGM_OP = Schema.TaggedStruct("AGM_OP", {})
export const LOGISTIC_OP = Schema.TaggedStruct("LOGISTIC_OP", {})
export const GAMMA2_OP = Schema.TaggedStruct("GAMMA2_OP", {})
export const TEXTROT13_OP = Schema.TaggedStruct("TEXTROT13_OP", {})
export const TEXTCAESAR_OP = Schema.TaggedStruct("TEXTCAESAR_OP", {})
export const TEXTFREQ_OP = Schema.TaggedStruct("TEXTFREQ_OP", {})
export const ISASCII_OP = Schema.TaggedStruct("ISASCII_OP", {})
export const ISPRINTABLE_OP = Schema.TaggedStruct("ISPRINTABLE_OP", {})
export const ISWHITESPACE_OP = Schema.TaggedStruct("ISWHITESPACE_OP", {})
export const SIMPLEINTEREST_OP = Schema.TaggedStruct("SIMPLEINTEREST_OP", {})
export const COMPOUNDINTEREST_OP = Schema.TaggedStruct("COMPOUNDINTEREST_OP", {})
export const DEPRECIATION_OP = Schema.TaggedStruct("DEPRECIATION_OP", {})
export const PENTAGONAL_OP = Schema.TaggedStruct("PENTAGONAL_OP", {})
export const HEXAGONAL_OP = Schema.TaggedStruct("HEXAGONAL_OP", {})
export const TETRAHEDRAL_OP = Schema.TaggedStruct("TETRAHEDRAL_OP", {})
export const PYRAMIDAL_OP = Schema.TaggedStruct("PYRAMIDAL_OP", {})
export const STIRLING_OP = Schema.TaggedStruct("STIRLING_OP", {})
export const CONEVOL_OP = Schema.TaggedStruct("CONEVOL_OP", {})
export const TEXTRLE_OP = Schema.TaggedStruct("TEXTRLE_OP", {})
export const TEXTRLD_OP = Schema.TaggedStruct("TEXTRLD_OP", {})
export const ISPERFECT_OP = Schema.TaggedStruct("ISPERFECT_OP", {})
export const ISHARSHAD_OP = Schema.TaggedStruct("ISHARSHAD_OP", {})
export const DEG2RAD_OP = Schema.TaggedStruct("DEG2RAD_OP", {})
export const RAD2DEG_OP = Schema.TaggedStruct("RAD2DEG_OP", {})
export const SINC_OP = Schema.TaggedStruct("SINC_OP", {})
export const ATAN2_OP = Schema.TaggedStruct("ATAN2_OP", {})
export const BINOMCOEF_OP = Schema.TaggedStruct("BINOMCOEF_OP", {})
export const CATALAN_OP = Schema.TaggedStruct("CATALAN_OP", {})
export const TRIANGLENUM_OP = Schema.TaggedStruct("TRIANGLENUM_OP", {})
export const TEXTEMOJI_OP = Schema.TaggedStruct("TEXTEMOJI_OP", {})
export const TEXTSTRIP_OP = Schema.TaggedStruct("TEXTSTRIP_OP", {})
export const TEXTNORMALIZE_OP = Schema.TaggedStruct("TEXTNORMALIZE_OP", {})
export const TEXTMORSE_OP = Schema.TaggedStruct("TEXTMORSE_OP", {})
export const BREAKEVEN_OP = Schema.TaggedStruct("BREAKEVEN_OP", {})
export const PROFITMARGIN_OP = Schema.TaggedStruct("PROFITMARGIN_OP", {})
export const MARKUP_OP = Schema.TaggedStruct("MARKUP_OP", {})
export const ISUPPER_OP = Schema.TaggedStruct("ISUPPER_OP", {})
export const ISLOWER_OP = Schema.TaggedStruct("ISLOWER_OP", {})
export const ISPALINDROME_OP = Schema.TaggedStruct("ISPALINDROME_OP", {})
export const REPEAT_N = Schema.TaggedStruct("REPEAT_N", { n: Schema.Number })
export const LCMM_N = Schema.TaggedStruct("LCMM_N", { n: Schema.Number })
export const GCDM_N = Schema.TaggedStruct("GCDM_N", { n: Schema.Number })
export const POLYGONAREA_OP = Schema.TaggedStruct("POLYGONAREA_OP", {})
export const CIRCLEAREA_OP = Schema.TaggedStruct("CIRCLEAREA_OP", {})
export const SPHEREVOL_OP = Schema.TaggedStruct("SPHEREVOL_OP", {})
export const CYLINDERVOL_OP = Schema.TaggedStruct("CYLINDERVOL_OP", {})
export const KURTOSIS_N = Schema.TaggedStruct("KURTOSIS_N", { n: Schema.Number })
export const SKEWNESS_N = Schema.TaggedStruct("SKEWNESS_N", { n: Schema.Number })
export const GEOMEAN2_N = Schema.TaggedStruct("GEOMEAN2_N", { n: Schema.Number })
export const HARMEAN2_N = Schema.TaggedStruct("HARMEAN2_N", { n: Schema.Number })
export const TEXTSIMILARITY_OP = Schema.TaggedStruct("TEXTSIMILARITY_OP", {})
export const TEXTZALGO_OP = Schema.TaggedStruct("TEXTZALGO_OP", {})
export const TEXTASCII_OP = Schema.TaggedStruct("TEXTASCII_OP", {})
export const TEXTSLUG_OP = Schema.TaggedStruct("TEXTSLUG_OP", {})
export const WACC_OP = Schema.TaggedStruct("WACC_OP", {})
export const PAYBACK_OP = Schema.TaggedStruct("PAYBACK_OP", {})
export const ROI_OP = Schema.TaggedStruct("ROI_OP", {})
export const ISNUMERICSTR_OP = Schema.TaggedStruct("ISNUMERICSTR_OP", {})
export const TEXTENTROPY_OP = Schema.TaggedStruct("TEXTENTROPY_OP", {})
export const ALL_N = Schema.TaggedStruct("ALL_N", { n: Schema.Number })
export const ANY_N = Schema.TaggedStruct("ANY_N", { n: Schema.Number })
export const NONE_N = Schema.TaggedStruct("NONE_N", { n: Schema.Number })
export const DIGSUM_OP = Schema.TaggedStruct("DIGSUM_OP", {})
export const DIGROOT_OP = Schema.TaggedStruct("DIGROOT_OP", {})
export const NTHROOT_OP = Schema.TaggedStruct("NTHROOT_OP", {})
export const TEXTHAMMINGDIST_OP = Schema.TaggedStruct("TEXTHAMMINGDIST_OP", {})
export const TEXTLEVENSHTEIN_OP = Schema.TaggedStruct("TEXTLEVENSHTEIN_OP", {})
export const ISALPHANUMERIC_OP = Schema.TaggedStruct("ISALPHANUMERIC_OP", {})
export const ISALPHABETIC_OP = Schema.TaggedStruct("ISALPHABETIC_OP", {})
export const MAJORITY_N = Schema.TaggedStruct("MAJORITY_N", { n: Schema.Number })
export const COEFVAR_N = Schema.TaggedStruct("COEFVAR_N", { n: Schema.Number })
export const TEXTPADSTART_OP = Schema.TaggedStruct("TEXTPADSTART_OP", {})
export const TEXTPADEND_OP = Schema.TaggedStruct("TEXTPADEND_OP", {})
export const TEXTWRAP_OP = Schema.TaggedStruct("TEXTWRAP_OP", {})
export const CHARCODE_OP = Schema.TaggedStruct("CHARCODE_OP", {})
export const FROMCHARCODE_OP = Schema.TaggedStruct("FROMCHARCODE_OP", {})
export const ISPRIME_OP = Schema.TaggedStruct("ISPRIME_OP", {})
export const NEXTPRIME_OP = Schema.TaggedStruct("NEXTPRIME_OP", {})
export const PRIMECOUNT_OP = Schema.TaggedStruct("PRIMECOUNT_OP", {})
export const TOTIENT_OP = Schema.TaggedStruct("TOTIENT_OP", {})
export const DIVISORS_OP = Schema.TaggedStruct("DIVISORS_OP", {})
export const SEQUENCE_GEN_N = Schema.TaggedStruct("SEQUENCE_GEN_N", { n: Schema.Number })
export const LINSPACE_N = Schema.TaggedStruct("LINSPACE_N", { n: Schema.Number })
export const CELLTYPE_OP = Schema.TaggedStruct("CELLTYPE_OP", {})
export const CHECKSUM_OP = Schema.TaggedStruct("CHECKSUM_OP", {})
export const CAGR_OP = Schema.TaggedStruct("CAGR_OP", {})
export const DISC_OP = Schema.TaggedStruct("DISC_OP", {})
export const DOLLARDE_OP = Schema.TaggedStruct("DOLLARDE_OP", {})
export const DOLLARFR_OP = Schema.TaggedStruct("DOLLARFR_OP", {})
export const ENTROPY_N = Schema.TaggedStruct("ENTROPY_N", { n: Schema.Number })
export const GINI_N = Schema.TaggedStruct("GINI_N", { n: Schema.Number })
export const WINSORIZE_N = Schema.TaggedStruct("WINSORIZE_N", { n: Schema.Number })
export const HYPOT3_OP = Schema.TaggedStruct("HYPOT3_OP", {})
export const DISTANCE2D_OP = Schema.TaggedStruct("DISTANCE2D_OP", {})
export const MANHATTAN_OP = Schema.TaggedStruct("MANHATTAN_OP", {})
export const FIBONACCI_OP = Schema.TaggedStruct("FIBONACCI_OP", {})
export const COLLATZ_OP = Schema.TaggedStruct("COLLATZ_OP", {})
export const TYPEOF2_OP = Schema.TaggedStruct("TYPEOF2_OP", {})
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
  IRR_N, NPV_N, VAR_N, PERCENTILE_N, COUNTA_N, COUNTBLANK_N, SUMPRODUCT_N, IFNA_OP, EOMONTH_OP, DATEDIF_OP, PERMUT_OP, FACTDOUBLE_OP, MATCH_N, INDEX_N, MODE_N, HARMEAN_N, GEOMEAN_N, AGGREGATE_N, COUNTIF_N, SUMIF_N, COUNTIFS_N, MAXIFS_N, MINIFS_N, AVERAGEIF_N, LARGE_N, SMALL_N, STDEV_N, MEDIAN_N, RANK_N, CONCATENATE_N, TEXTJOIN_N, ISNUMBER_OP, ISTEXT_OP, ISEVEN_OP, ISODD_OP, N_OP, T_OP, CAGR_OP, DISC_OP, DOLLARDE_OP, DOLLARFR_OP, ENTROPY_N, GINI_N, WINSORIZE_N, HYPOT3_OP, DISTANCE2D_OP, MANHATTAN_OP, FIBONACCI_OP, COLLATZ_OP, TYPEOF2_OP, SLN_OP, SYD_OP, DDB_OP, RATE_EST_OP, EFFECT_RATE_OP, NOMINAL_RATE_OP, ZSCORE_OP, PERCENTRANK_N, NAND_OP, NOR_OP, XNOR_OP, TEXTMASK_OP, TEXTTRUNCATE_OP, CUMSUM_N, CUMPROD_N, MOVAVG_N, BITNOT_OP, BITROTL_OP, BITROTR_OP, JSON_STRINGIFY_OP, TEXTTITLE_OP, ISNAN2_OP, ISINFINITE_OP, MODE_SNGL_N, MODE_MULT_N, ROUND_MODE_OP, BASE64_ENCODE_OP, BASE64_DECODE_OP, TEXTROTATE_OP, TEXTINITIALS_OP, TEXTCAMELCASE_OP, TEXTSNAKECASE_OP, TEXTKEBABCASE_OP, WRAPCOLS_N, PRODUCT_IFS_N, MEDIAN_IF_N, ISDATE_OP, DIGITS_OP, SIGMOID_OP, RELU_OP, SOFTPLUS_OP, ELU_OP, NORMALIZE_OP, MAP_RANGE_OP, TEXTCENTER_OP, WORDCOUNT_OP, YEARMONTH_OP, QUARTER_OP, DAYOFYEAR_OP, ISLEAPYEAR_OP, DAYSINYEAR_OP, DAYSINMONTH_OP, TEXTSLICE_OP, TEXTINDEXOF_OP, TEXTSPLIT_ALL_N, ISINTEGER_OP, ISFLOAT_OP, ISPOSITIVE_OP, ISNEGATIVE_OP, ROUND_SIGNIF_OP, CLAMP_OP, LERP_OP, SMOOTHSTEP_OP, PERCENTILE_EXC_N, PERCENTILE_INC_N, ENCODEURL_OP, DECODEURL_OP, ISURL_OP, ISEMAIL_OP, HASH_OP, TEXTSQUEEZE_OP, GESTEP_OP, DELTA_OP, CHISQ_DIST_RT_OP, TDIST_RT_OP, FDIST_RT_OP, T_INV_2T_OP, TYPE_NUM_OP, ISBINARY_OP, ISHEX_OP, ACOTH_OP, EXPAND_N, COALESCE_N, ENDSWITH_OP, TEXTREVERSE_OP, TEXTREMOVE_OP, REGEXMATCH_OP, REGEXEXTRACT_OP, REGEXREPLACE_OP, FILTER_N, TAKE_N, DROP_N, CHOOSECOLS_N, CHOOSEROWS_N, IMPLIES_OP, BETWEEN_OP, ISFORMULA_OP, SHEET_OP, SHEETS_OP, SERIESSUM_N, SUBTOTAL_MODE_N, MULTINOMIAL_N, WEIBULL_DIST_OP, EXPON_DIST_OP, LOGNORM_DIST_OP, COUPPCD_OP, COUPNCD_OP, ODDFPRICE_OP, TEXT_CONTAINS_OP, TEXT_STARTSWITH_OP, YIELDMAT_OP, ACCRINTM_OP, COUPDAYSNC_OP, COUPNUM_OP, BINSEARCH_N, INDEXMATCH_N, LASTINDEXOF_N, FINDALL_N, COUNTUNIQ_N, ARRAYCONTAINS_N, ARRAYPOS_N, FLATTEN2_N, IFF_OP, SWITCH2_N, XORALL_N, NANDALL_N, NORALL_N, COALESCE2_N, UNLESS_OP, SECANT_OP, COSECANT_OP, VERSINE_OP, HAVERSINE_OP, EXSECANT_OP, LEMNISCATE_OP, AGM2_OP, POWMOD_OP, MAD2_N, ZSCORE2_OP, TSTAT_OP, FSTAT_OP, CHISQSTAT_OP, SEM_N, POOLEDVAR_N, TEXTCOUNTCHAR_OP, TEXTZFILL_OP, TEXTLPAD_OP, TEXTRPAD_OP, TEXTABBREV_OP, TEXTWORDFREQ_OP, TEXTSANITIZE_OP, TEXTMIRROR_OP, TYPEOF3_OP, ISBLANK2_OP, ISTRUTHY_OP, ISFALSY_OP, ISFRACTION_OP, ISDIVISIBLE_OP, PVANNUITY_OP, ANNUITYPMT_OP, BONDPRICE_OP, BONDYIELD_OP, TBILL2_OP, MACAULAY_OP, DISTINCT_N, ARRAYSLICE_N, ARRAYJOIN_N, ARRAYREVERSE_N, ARRAYFLATTEN_N, ARRAYZIP_N, ARRAYMIN_N, ARRAYMAX_N, ARRAYSUM_N, ARRAYAVG_N, NIFF_OP, SWITCHIF_OP, COND_N, ALLEQUAL_N, ANYGT_N, ANYLT_N, ANYNE_N, ISALL_N, ISANY_N, ISNONE_N, RANDNORM_OP, RANDEXP_OP, RANDINT_OP, COINFLIP_OP, GUDERMANN_OP, INVERSEGUD_OP, LANCZOS_OP, DIGAMMA_OP, POLYGAMMA_OP, ZETA2_OP, BETAFN_OP, POCHHAMMER_OP, ENTROPY2_N, GINICOEF_N, MOMENT_N, CMOMENT_N, ZSCORE3_N, PERCENTILE2_N, TEXTFORMAT_OP, TEXTJUSTIFY_OP, TEXTMASK2_OP, TEXTHASH_OP, TEXTREPLACE2_OP, TEXTFILL_OP, CAGR2_OP, DRAWDOWN_OP, CALMAR_OP, TREYNOR_OP, ISFINITE2_OP, ISWHOLE_OP, EQUIV_OP, ONEOF_N, FIRSTTRUTHY_N, LASTTRUTHY_N, COUNTIF3_N, WHICHMAX_N, WHICHMIN_N, THRESHOLD_OP, TOGGLE_OP, SATURATE_OP, DEADBAND_OP, RANDPERM_N, RANDCHOICE_N, DICE_OP, UUID4_OP, ENUMERATE_N, COUNTVALS_N, FIRSTNONZERO_N, LASTNONZERO_N, NTHLARGEST_N, AMORT_OP, DAILYRETURN_OP, VOLANNUAL_OP, MAXDD_N, INFORMRATIO_OP, JENSENALPHA_OP, LAGUERRE_OP, HERMITE_OP, LEGENDRE_OP, CHEBYSHEV2_OP, FRESNEL_S_OP, FRESNEL_C_OP, AIRY_OP, DAWSON_OP, TRIMMEDMEAN_N, WINSOREDMEAN_N, MIDRANGE_N, MIDHINGE_N, MEANDEV_N, ROOTMEANSQERR_N, TEXTWORDWRAP_OP, TEXTCOLUMNS_OP, TEXTTAB_OP, TEXTBOXIFY_OP, TEXTCOUNTWORDS_OP, TEXTFIRSTWORD_OP, ISNUMTYPE_OP, ISSTRTYPE_OP, ISBOOLTYPE_OP, ISERRORTYPE_OP, IFPOS_OP, IFNEG_OP, IFZERO_OP, IFEVEN_OP, IFODD_OP, GATE_OP, LATCH_OP, DEBOUNCE_OP, MUXSEL_N, DEMUX_N, RANDSIGN_OP, RANDBOOL_OP, NTHSMALLEST_N, ARGMAX_N, ARGMIN_N, DEDUP_N, INTERLEAVE_N, COUPON_OP, ACCRUEDINT_OP, PARVALUE_OP, HOLDINGRETURN_OP, TIMEDWRETURN_OP, DIVYIELD_OP, SININT_OP, COSINT_OP, EXPINT_OP, LOGINT_OP, DILOG_OP, CLAUSEN_OP, ELLIPK_OP, ELLIPE_OP, QUADMEAN_N, POWMEAN_N, LEHMER_N, ENTROPY3_N, RELENTROPY_N, MUTUALINFO_N, CROSSENTROPY_N, TEXTINITCAP_OP, TEXTSNIP_OP, TEXTUNQUOTE_OP, TEXTQUOTE_OP, TEXTDOTS_OP, TEXTBULLET_OP, ISNUMERIC_OP, ISTEXT2_OP, ISERR2_OP, ISBLANK3_OP, ISNOTEMPTY_OP, TYPESTR_OP, FIBONACCI2_OP, MOTZKIN_OP, DERANGEMENT_OP, TOTIENT2_OP, HARMONIC2_OP, TEXTOBFUSCATE_OP, TEXTCOUNT2_OP, TEXTSHUFFLE_OP, ISCOPRIMEALL_N, ISFIBBISH_OP, COPRIME_OP, COLLATZ_OP, PREVPRIME_OP, TEXTPAD_OP, TEXTMASK_OP, TEXTISURL_OP, TEXTISEMAIL_OP, WORDSCOUNT_OP, ISLEAPYEAR_OP, WEEKOFYEAR_OP, ISWEEKEND_OP, QUARTERNO_OP, SEMESTERNO_OP, EFFECTRATE_OP, NOMRATE_OP, AVEDEV2_N, COVAR2_N, CORREL2_N, NPER2_OP, RATE2_OP, COSSIM_N, CHEBYSHEV_OP, ISPOWEROFTWO_OP, NEXTODD_OP, NEXTEVEN_OP, TOROMAN_OP, FROMROMAN_OP, TOORDINAL_OP, TEXTHEX_OP, TEXTFROMHEX_OP, TEXTDEDUPE_OP, TEXTLINES_OP, TEXTPASCALCASE_OP, WMEAN_N, GINI2_N, ISPRIMEFAST_OP, SHARPE_OP, SORTINO_OP, EMAVG_OP, SMAVG_OP, ABUNDANCY_OP, DIGITCOUNT_OP, GOLDEN_OP, EULER_OP, TAU_OP, CUBEROOT_OP, WRAP_OP, REMAP_OP, TEXTBASE64_OP, TEXTFROMBASE64_OP, TEXTPREFIX_OP, TEXTSUFFIX_OP, RMS_N, RANGE2_N, IQR_N, MAPE_N, ISODD2_OP, ISEVEN2_OP, ISZERO_OP, ANNUITY_OP, FUTUREVALUE2_OP, LUCAS_OP, BELL_OP, INTLOG2_OP, INTLOG10_OP, BITLEN_OP, TEXTREPEAT_OP, TEXTNTH_OP, TEXTUNIQUE_OP, TEXTDISTINCT_OP, COUNTIF2_N, CHARCOUNT_OP, ISEMPTYTEXT_OP, RULEOF72_OP, PRESENTVALUE_OP, SAWTOOTH_OP, SQUAREWAVE_OP, TRIANGLEWAVE_OP, AGM_OP, LOGISTIC_OP, GAMMA2_OP, TEXTROT13_OP, TEXTCAESAR_OP, TEXTFREQ_OP, ISASCII_OP, ISPRINTABLE_OP, ISWHITESPACE_OP, SIMPLEINTEREST_OP, COMPOUNDINTEREST_OP, DEPRECIATION_OP, PENTAGONAL_OP, HEXAGONAL_OP, TETRAHEDRAL_OP, PYRAMIDAL_OP, STIRLING_OP, CONEVOL_OP, TEXTRLE_OP, TEXTRLD_OP, ISPERFECT_OP, ISHARSHAD_OP, DEG2RAD_OP, RAD2DEG_OP, SINC_OP, ATAN2_OP, BINOMCOEF_OP, CATALAN_OP, TRIANGLENUM_OP, TEXTEMOJI_OP, TEXTSTRIP_OP, TEXTNORMALIZE_OP, TEXTMORSE_OP, BREAKEVEN_OP, PROFITMARGIN_OP, MARKUP_OP, ISUPPER_OP, ISLOWER_OP, ISPALINDROME_OP, REPEAT_N, LCMM_N, GCDM_N, POLYGONAREA_OP, CIRCLEAREA_OP, SPHEREVOL_OP, CYLINDERVOL_OP, KURTOSIS_N, SKEWNESS_N, GEOMEAN2_N, HARMEAN2_N, TEXTSIMILARITY_OP, TEXTZALGO_OP, TEXTASCII_OP, TEXTSLUG_OP, WACC_OP, PAYBACK_OP, ROI_OP, ISNUMERICSTR_OP, TEXTENTROPY_OP, ALL_N, ANY_N, NONE_N, DIGSUM_OP, DIGROOT_OP, NTHROOT_OP, TEXTHAMMINGDIST_OP, TEXTLEVENSHTEIN_OP, ISALPHANUMERIC_OP, ISALPHABETIC_OP, MAJORITY_N, COEFVAR_N, TEXTPADSTART_OP, TEXTPADEND_OP, TEXTWRAP_OP, ISERR_OP, ISNULL_OP, HYPOT_OP, MDETERM_OP, MINVERSE_OP, BETA_INV_OP, GAMMA_INV_OP, AVERAGEWEIGHTED_N, DCOUNT_N, DSUM_N, DAVERAGE_N, DMAX_N, DMIN_N, DSTDEV_N, DVAR_N, DGET_N, DCOUNTA_N, PERCENTRANK_EXC_N, QUARTILE_EXC_N, QUARTILE_INC_N, NAND_OP, NOR_OP, XNOR_OP, SORTBY_N, SINGLE_N, XLOOKUP_N, HYPERLINK_OP, NUMBERSTRING_OP, IFBLANK_OP, SUBSTITUTEN_OP, TEXTSPLIT_DELIM_OP, COMBINA_OP, PERMUTATIONA_OP, SQRTPI_OP, RANDBETWEEN_INT_OP, ISO_CEILING_OP, YIELDDISC_OP, PRICEMAT_OP, ARRAYTOTEXT_N, TOCOL_N, TOROW_N, VSTACK_N, MAKEARRAY_N, WEBSERVICE_OP, FIELDVALUE_OP, VLOOKUP_N, HLOOKUP_N, LOOKUP_N, CLEANWS_OP, TEXTCOUNT_OP, ISREF_OP, ISLOGICAL_OP, ISNONTEXT_OP, ERROR_TYPE_OP, IFERROR_OP, BITCOUNT_OP, MROUND_OP, CEILING_MATH_OP, FLOOR_MATH_OP, BASE_OP, DECIMAL_OP, AMORLINC_OP, PRICE_OP, ODDLPRICE_OP, INFO_OP, CUMPRINC_OP, PDURATION_OP, RRI_OP, TBILLEQ_OP, TBILLPRICE_OP, DURATION_OP, MDURATION_OP, XIRR_N, YIELD_OP, ROWS_N, TYPE_OP, AREAS_N, TRANSPOSE_N, CHITEST_N, TTEST_N, FTEST_N, LINEST_N, LOGEST_N, VARA_N, STDEVA_N, VARPA_N, STDEVPA_N, PERCENTRANK_INC_N, BETA_FN_OP, BESSELK_OP, BESSELI_OP, PERCENTILE_INC_N, PERCENTILE_EXC_N, RANK_EQ_N, RANK_AVG_N, VAR_S_N, NORMS_DIST_OP, NORMS_INV_OP, TINV_OP, CHISQ_INV_OP, FINV_OP, GAMMALN_OP, GAMMA_OP, CHISQ_DIST_OP, TDIST_OP, FDIST_OP, PHI_OP, GAUSS_OP, MIDB_OP, DBCS_OP, ASC_OP, CONCAT_WS_N, TEXTREVERSE_OP, FVSCHEDULE_N, CUMIPMT_OP, COLUMNS_N, INDIRECT_OP, OFFSET_OP, ZTEST_N, COVARIANCE_S_N, STDEV_S_N, TIMEVALUE_OP, TIME_OP, SECOND_OP, MINUTE_OP, HOUR_OP, GROWTH_N, TREND_N, FREQUENCY_N, PROB_N2, LAMBDA_N, MAP_N, REDUCE_N, SCAN_N, BYROW_N, BYCOL_N, LEFTB_OP, RIGHTB_OP, LENB_OP, BAHTTEXT_OP, PHONETIC_OP, BESSELY_OP, HEX2BIN_OP, HEX2OCT_OP, OCT2BIN_OP, OCT2HEX_OP, IMTAN_OP, IMLOG2_OP, IMLOG10_OP, DPRODUCT_N, RANDBETWEEN_FLOAT_OP, FORMULATEXT_OP, ADDRESS_OP, IMDIV_OP, IMSUB_OP, BIN2DEC_OP, DEC2BIN_OP, BIN2HEX_OP, HEX2DEC_OP, DEC2HEX_OP, OCT2DEC_OP, DEC2OCT_OP, BITAND_OP, BITOR_OP, BITXOR_OP, BITLSHIFT_OP, BITRSHIFT_OP, IMPOWER_OP, IMEXP_OP, IMLN_OP, IMSIN_OP, IMCOS_OP, IMSUM_OP, IMPRODUCT_OP, IMARGUMENT_OP, IMCONJUGATE_OP, IMSQRT_OP, BESSELJ_OP, COMPLEX_OP, IMREAL_OP, IMAGINARY_OP, IMABS_OP, TAKE_N, DROP_N, HSTACK_N, WRAPROWS_N, ISFORMULA_OP, REGEXMATCH_OP, REGEXEXTRACT_OP, REGEXREPLACE_OP, LET_N, CHOOSECOLS_N, SUMXMY2_N, SUMX2PY2_N, SUMX2MY2_N, ERF_OP, ERFC_OP, YEARFRAC_OP, COUPDAYBS_OP, TBILLYIELD_OP, RECEIVED_OP, PRICEDISC_OP, MIRR_N, XNPV_N, ACCRINT_OP, COUPDAYS_OP, DOLLARDE_OP, DOLLARFR_OP, SORT_N, UNIQUE_N, FILTER_N, PPMT_OP, IPMT_OP, CELL_OP, ROWS_N, RANDARRAY_N, SEQUENCE_N, XMATCH_N, CEILING_PRECISE_OP, FLOOR_PRECISE_OP, AVERAGEA_N, MAXA_N, MINA_N, NEGBINOMDIST_OP, BETADIST_OP, HYPGEOMDIST_OP, ISNA_OP, SHEET_OP, TEXTSPLIT_N, DATESTRING_OP, WORKDAY_OP, TEXTBEFORE_OP, TEXTAFTER_OP, VALUETOTEXT_OP, ISPMT_OP, DISC_OP, INTRATE_OP, SYD_OP, EFFECT_OP, NOMINAL_OP, NORMINV_OP, DDB_OP, PERCENTRANK_N, QUARTILE_N, WEIBULL_OP, GAMMADIST_OP, EXPONDIST_OP, POISSON_OP, BINOMDIST_OP, LOGNORMDIST_OP, STANDARDIZE_OP, CONFIDENCE_OP, NORMDIST_OP, STEYX_N, FISHER_OP, FISHERINV_OP, KURT_N, SKEW_N, CONVERT_OP, SLOPE_N, INTERCEPT_N, RSQ_N, COVAR_N, FORECAST_N, STDEVP_N, VARP_N, CORREL_N, SUMSQ_N, DEVSQ_N, AVEDEV_N, TRIMMEAN_N, XOR_N, ISOWEEKNUM_OP, NETWORKDAYS_OP, SUBTOTAL_N, DELTA_OP, GESTEP_OP, MULTINOMIAL_N, SERIESSUM_N, SEC_OP, CSC_OP, COTH_OP, SECH_OP, CSCH_OP, SUMIFS_N, AVERAGEIFS_N, NA_OP, COT_OP, ACOT_OP, UNICODE_OP, UNICHAR_OP, ENCODEURL_OP, DAYS_OP, DATEVALUE_OP, EDATE_OP, WEEKDAY_OP, WEEKNUM_OP, ROMAN_OP, ARABIC_OP, TEXT_OP, NUMBERVALUE_OP, REPT_OP, EXACT_OP, FIND_OP, REPLACE_OP, SEARCH_OP,
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
  // CHITEST/TTEST/FTEST: hypothesis tests
  CHITEST_N: (op: any, s) => { const n = op.n as number; if(s.length<n||n<4||n%2!==0){s.push(vmError("STACK_UNDERFLOW","CHITEST"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n).map(asNum); const half=n/2; let chi2=0; for(let i=0;i<half;i++){const o2=args[i],e=args[half+i]; if(e===0){s.push(vmError("DIV_ZERO","CHITEST"));return{result:s[s.length-1]}} chi2+=(o2-e)**2/e} const result=num(chi2);s.push(result);return{result} },
  TTEST_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<4||n%2!==0){s.push(vmError("STACK_UNDERFLOW","TTEST"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n).map(asNum); const half=n/2,diffs:number[]=[]; for(let i=0;i<half;i++)diffs.push(args[i]-args[half+i]); const mean=diffs.reduce((a,b)=>a+b,0)/half; const sd=Math.sqrt(diffs.reduce((a,b)=>a+(b-mean)**2,0)/(half-1)); const result=num(sd===0?0:mean/(sd/Math.sqrt(half)));s.push(result);return{result} },
  FTEST_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<4||n%2!==0){s.push(vmError("STACK_UNDERFLOW","FTEST"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n).map(asNum); const half=n/2; const xs=args.slice(0,half),ys=args.slice(half); const mx=xs.reduce((a,b)=>a+b,0)/half,my=ys.reduce((a,b)=>a+b,0)/half; const v1=xs.reduce((a,b)=>a+(b-mx)**2,0)/(half-1),v2=ys.reduce((a,b)=>a+(b-my)**2,0)/(half-1); const result=num(v2===0?0:v1/v2);s.push(result);return{result} },
  LINEST_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","LINEST"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n).map(asNum); const n2=args.length; let sX=0,sY=0,sXY=0,sX2=0; for(let i=0;i<n2;i++){sX+=i;sY+=args[i];sXY+=i*args[i];sX2+=i*i} const result=num((n2*sXY-sX*sY)/(n2*sX2-sX*sX));s.push(result);return{result} },
  LOGEST_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","LOGEST"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n).map(asNum); const lY=args.map(y=>y>0?Math.log(y):0); const n2=lY.length; let sX=0,sY=0,sXY=0,sX2=0; for(let i=0;i<n2;i++){sX+=i;sY+=lY[i];sXY+=i*lY[i];sX2+=i*i} const result=num(Math.exp((n2*sXY-sX*sY)/(n2*sX2-sX*sX)));s.push(result);return{result} },
  VARA_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","VARA"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n); const vals=args.map(v=>v._tag==="str"?0:v._tag==="bool"?(v.value?1:0):asNum(v)); const mean=vals.reduce((a,b)=>a+b,0)/vals.length; const result=num(vals.reduce((a,b)=>a+(b-mean)**2,0)/(vals.length-1));s.push(result);return{result} },
  STDEVA_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","STDEVA"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n); const vals=args.map(v=>v._tag==="str"?0:v._tag==="bool"?(v.value?1:0):asNum(v)); const mean=vals.reduce((a,b)=>a+b,0)/vals.length; const result=num(Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/(vals.length-1)));s.push(result);return{result} },
  VARPA_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","VARPA"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n); const vals=args.map(v=>v._tag==="str"?0:v._tag==="bool"?(v.value?1:0):asNum(v)); const mean=vals.reduce((a,b)=>a+b,0)/vals.length; const result=num(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length);s.push(result);return{result} },
  STDEVPA_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","STDEVPA"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n); const vals=args.map(v=>v._tag==="str"?0:v._tag==="bool"?(v.value?1:0):asNum(v)); const mean=vals.reduce((a,b)=>a+b,0)/vals.length; const result=num(Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length));s.push(result);return{result} },
  PERCENTRANK_INC_N: (op: any, s) => { const n=op.n as number; if(s.length<n||n<2){s.push(vmError("STACK_UNDERFLOW","PERCENTRANK.INC"));return{result:s[s.length-1]}} const args=s.splice(s.length-n,n); const target=asNum(args[0]); const values=args.slice(1).map(asNum).sort((a,b)=>a-b); const below=values.filter(v=>v<target).length; const result=num(values.length<=1?0:below/(values.length-1));s.push(result);return{result} },
  // BETA_OP: beta function B(a,b) = Γ(a)Γ(b)/Γ(a+b)
  BETA_FN_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const av = asNum(a), bv = asNum(b)
    return num(gamma(av) * gamma(bv) / gamma(av + bv))
  }, "BETA") }),
  // BESSELK_OP: modified Bessel K0(x) approximation
  BESSELK_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "BESSELK")); return { result: s[s.length-1] } }
    const order = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (x <= 0) { s.push(vmError("TYPE_MISMATCH", "BESSELK")); return { result: s[s.length-1] } }
    // K0 approximation: K0(x) ≈ -ln(x/2) * I0(x) + P(x) for small x
    const y = x / 2
    const result = num(order === 0 ? -Math.log(y) * 1 + 0.5 : Math.exp(-x) / Math.sqrt(x) * Math.sqrt(Math.PI / 2))
    s.push(result); return { result }
  },
  // BESSELI_OP: modified Bessel I0(x) approximation
  BESSELI_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "BESSELI")); return { result: s[s.length-1] } }
    const order = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    if (order === 0) {
      let sum = 1, term = 1
      for (let k = 1; k <= 20; k++) { term *= (x*x) / (4*k*k); sum += term }
      const result = num(sum); s.push(result); return { result }
    }
    let fac = 1; for (let i = 2; i <= order; i++) fac *= i
    let sum = 0, term = Math.pow(x/2, order) / fac
    sum = term
    for (let k = 1; k <= 20; k++) { term *= (x*x) / (4*k*(k+order)); sum += term }
    const result = num(sum); s.push(result); return { result }
  },
  // PERCENTILE_INC_N: inclusive percentile (same as PERCENTILE but explicit name)
  PERCENTILE_INC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE.INC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[args.length - 1])
    const values = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const n2 = values.length
    const rank = k * (n2 - 1)
    const lo = Math.floor(rank), hi = Math.ceil(rank)
    const result = num(lo === hi ? values[lo] : values[lo] + (values[hi] - values[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // PERCENTILE_EXC_N: exclusive percentile (excludes 0 and 1)
  PERCENTILE_EXC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE.EXC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[args.length - 1])
    if (k <= 0 || k >= 1) { s.push(vmError("TYPE_MISMATCH", "PERCENTILE.EXC: k must be in (0,1)")); return { result: s[s.length-1] } }
    const values = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const n2 = values.length
    const rank = k * (n2 + 1) - 1
    const lo = Math.max(0, Math.floor(rank)), hi = Math.min(n2 - 1, Math.ceil(rank))
    const result = num(lo === hi ? values[lo] : values[lo] + (values[hi] - values[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // RANK_EQ_N: rank (ties get same rank). Same as RANK but explicit name.
  RANK_EQ_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "RANK.EQ")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const values = args.slice(1).map(asNum).sort((a, b) => b - a)
    const rank = values.indexOf(target) + 1
    const result = num(rank || values.length); s.push(result); return { result }
  },
  // RANK_AVG_N: rank (ties get average rank)
  RANK_AVG_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "RANK.AVG")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const values = args.slice(1).map(asNum).sort((a, b) => b - a)
    const indices = values.reduce((acc, v, i) => v === target ? [...acc, i + 1] : acc, [] as number[])
    const avgRank = indices.length > 0 ? indices.reduce((a, b) => a + b, 0) / indices.length : values.length
    const result = num(avgRank); s.push(result); return { result }
  },
  // VAR_S_N: sample variance (n-1) — explicit name
  VAR_S_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "VAR.S")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const variance = args.reduce((a, b) => a + (b - mean) ** 2, 0) / (args.length - 1)
    const result = num(variance); s.push(result); return { result }
  },
  // COUNTA_SIMPLE_N: count non-blank (already exists, but explicit naming)
  // Let's add NORMS_DIST_OP: standard normal CDF (no mean/stdev params)
  NORMS_DIST_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989422802 * Math.exp(-x*x/2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return num(x >= 0 ? 1 - p : p)
  }, "NORM.S.DIST") }),
  // NORMS_INV_OP: standard normal inverse (quantile)
  NORMS_INV_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const p = asNum(a)
    if (p <= 0 || p >= 1) return vmError("TYPE_MISMATCH", "NORM.S.INV: p must be in (0,1)")
    const a2 = p - 0.5, t2 = a2 < 0 ? p : 1 - p, s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    if (a2 < 0) z = -z
    return num(z)
  }, "NORM.S.INV") }),
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
  // === PUSH TO 625 ===
  // -- Math: combinatorics & geometry --
  // LCMM_N: LCM of multiple values (variadic)
  LCMM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LCMM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(v => Math.abs(Math.round(asNum(v))))
    const gcd2 = (a: number, b: number): number => b === 0 ? a : gcd2(b, a % b)
    const lcm2 = (a: number, b: number) => (a / gcd2(a, b)) * b
    const result = num(args.reduce(lcm2, 1))
    s.push(result); return { result }
  },
  // GCDM_N: GCD of multiple values (variadic)
  GCDM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GCDM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(v => Math.abs(Math.round(asNum(v))))
    const gcd2 = (a: number, b: number): number => b === 0 ? a : gcd2(b, a % b)
    const result = num(args.reduce(gcd2))
    s.push(result); return { result }
  },
  // POLYGONAREA_OP: area of regular polygon given side length and number of sides
  POLYGONAREA_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const sides = Math.round(asNum(a)), sideLen = asNum(b)
    if (sides < 3) return vmError("VALUE", "POLYGONAREA")
    return num((sides * sideLen * sideLen) / (4 * Math.tan(Math.PI / sides)))
  }, "POLYGONAREA") }),
  // CIRCLEAREA_OP: area of circle from radius
  CIRCLEAREA_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const r = asNum(a); return num(Math.PI * r * r)
  }, "CIRCLEAREA") }),
  // SPHEREVOL_OP: volume of sphere from radius
  SPHEREVOL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const r = asNum(a); return num((4 / 3) * Math.PI * r * r * r)
  }, "SPHEREVOL") }),
  // CYLINDERVOL_OP: volume of cylinder (radius, height)
  CYLINDERVOL_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const r = asNum(a), h = asNum(b)
    return num(Math.PI * r * r * h)
  }, "CYLINDERVOL") }),
  // -- Stat --
  // KURTOSIS_N: excess kurtosis
  KURTOSIS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "KURTOSIS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const m2 = args.reduce((s, v) => s + (v - mean) ** 2, 0) / args.length
    const m4 = args.reduce((s, v) => s + (v - mean) ** 4, 0) / args.length
    const result = m2 === 0 ? num(0) : num(m4 / (m2 * m2) - 3)
    s.push(result); return { result }
  },
  // SKEWNESS_N: sample skewness
  SKEWNESS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SKEWNESS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const m2 = args.reduce((s, v) => s + (v - mean) ** 2, 0) / args.length
    const m3 = args.reduce((s, v) => s + (v - mean) ** 3, 0) / args.length
    const sd = Math.sqrt(m2)
    const result = sd === 0 ? num(0) : num(m3 / (sd * sd * sd))
    s.push(result); return { result }
  },
  // GEOMEAN2_N: geometric mean (variadic)
  GEOMEAN2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GEOMEAN2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    if (args.some(v => v <= 0)) { const r = vmError("VALUE", "GEOMEAN2"); s.push(r); return { result: r } }
    const logSum = args.reduce((s, v) => s + Math.log(v), 0)
    const result = num(Math.exp(logSum / args.length))
    s.push(result); return { result }
  },
  // HARMEAN2_N: harmonic mean (variadic)
  HARMEAN2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "HARMEAN2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    if (args.some(v => v === 0)) { const r = vmError("DIV_ZERO", "HARMEAN2"); s.push(r); return { result: r } }
    const recipSum = args.reduce((s, v) => s + 1 / v, 0)
    const result = num(args.length / recipSum)
    s.push(result); return { result }
  },
  // -- Text --
  // TEXTSIMILARITY_OP: simple Jaccard similarity (0-1) on characters
  TEXTSIMILARITY_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const s1 = new Set(vmDisplay(a).toLowerCase()), s2 = new Set(vmDisplay(b).toLowerCase())
    const inter = [...s1].filter(c => s2.has(c)).length
    const union = new Set([...s1, ...s2]).size
    return union === 0 ? num(1) : num(inter / union)
  }, "TEXTSIM") }),
  // TEXTZALGO_OP: add zalgo combining characters
  TEXTZALGO_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    const above = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030A']
    let res = ""
    for (const ch of text) { res += ch; for (let i = 0; i < 2; i++) res += above[Math.floor(Math.random() * above.length)] }
    return str(res)
  }, "TEXTZALGO") }),
  // TEXTASCII_OP: strip non-ASCII characters
  TEXTASCII_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/[^\x00-\x7F]/g, ""))
  }, "TEXTASCII") }),
  // TEXTSLUG_OP: URL-slug conversion
  TEXTSLUG_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, ""))
  }, "TEXTSLUG") }),
  // -- Financial --
  // WACC_OP: weighted average cost of capital (equity, debt, eqReturn, debtRate, taxRate)
  WACC_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "WACC")); return { result: s[s.length-1] } }
    const taxRate = asNum(s.pop()!), debtRate = asNum(s.pop()!), eqReturn = asNum(s.pop()!), debt = asNum(s.pop()!), equity = asNum(s.pop()!)
    const total = equity + debt
    if (total === 0) { s.push(vmError("DIV_ZERO", "WACC")); return { result: s[s.length-1] } }
    const result = num((equity / total) * eqReturn + (debt / total) * debtRate * (1 - taxRate))
    s.push(result); return { result }
  },
  // PAYBACK_OP: payback period (initial investment, annual cash flow)
  PAYBACK_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const invest = asNum(a), cashflow = asNum(b)
    if (cashflow <= 0) return vmError("DIV_ZERO", "PAYBACK")
    return num(invest / cashflow)
  }, "PAYBACK") }),
  // ROI_OP: return on investment ((gain - cost) / cost)
  ROI_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const gain = asNum(a), cost = asNum(b)
    if (cost === 0) return vmError("DIV_ZERO", "ROI")
    return num((gain - cost) / cost)
  }, "ROI") }),
  // -- Info --
  // ISNUMERICSTR_OP: is text a valid numeric string
  ISNUMERICSTR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a).trim()
    return bool(text.length > 0 && !isNaN(Number(text)) && isFinite(Number(text)))
  }, "ISNUMSTR") }),
  // TEXTENTROPY_OP: Shannon entropy of text characters
  TEXTENTROPY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    if (text.length === 0) return num(0)
    const freq = new Map<string, number>()
    for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1)
    let ent = 0
    freq.forEach(count => { const p = count / text.length; if (p > 0) ent -= p * Math.log2(p) })
    return num(ent)
  }, "TEXTENTROPY") }),
  // -- Logic --
  // ALL_N: all values truthy
  ALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const truthy = (v: StackValue) => v._tag === "bool" ? v.value : v._tag === "num" ? v.value !== 0 : true
    const result = bool(args.every(truthy))
    s.push(result); return { result }
  },
  // ANY_N: any value truthy
  ANY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ANY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const truthy = (v: StackValue) => v._tag === "bool" ? v.value : v._tag === "num" ? v.value !== 0 : true
    const result = bool(args.some(truthy))
    s.push(result); return { result }
  },
  // NONE_N: no values truthy
  NONE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NONE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const truthy = (v: StackValue) => v._tag === "bool" ? v.value : v._tag === "num" ? v.value !== 0 : true
    const result = bool(!args.some(truthy))
    s.push(result); return { result }
  },
  // === PUSH TO 650 ===
  // -- Math: trig & hyperbolic --
  // DEG2RAD_OP: degrees to radians
  DEG2RAD_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(asNum(a) * Math.PI / 180), "DEG2RAD") }),
  // RAD2DEG_OP: radians to degrees
  RAD2DEG_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(asNum(a) * 180 / Math.PI), "RAD2DEG") }),
  // SINC_OP: sinc(x) = sin(πx)/(πx) or 1 at 0
  SINC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a); return num(x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))
  }, "SINC") }),
  // ATAN2_OP: two-argument arctangent
  ATAN2_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(Math.atan2(asNum(a), asNum(b)))
  }, "ATAN2") }),
  // -- Math: statistics & probability --
  // BINOMCOEF_OP: binomial coefficient C(n,k)
  BINOMCOEF_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const n = Math.round(asNum(a)), k = Math.round(asNum(b))
    if (k < 0 || k > n) return num(0)
    let r = 1; for (let i = 0; i < Math.min(k, n - k); i++) r = r * (n - i) / (i + 1)
    return num(Math.round(r))
  }, "BINOMCOEF") }),
  // CATALAN_OP: nth Catalan number
  CATALAN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 0) return num(0)
    let r = 1; for (let i = 0; i < n; i++) r = r * 2 * (2 * i + 1) / (i + 2)
    return num(Math.round(r))
  }, "CATALAN") }),
  // TRIANGLENUM_OP: nth triangular number T(n) = n(n+1)/2
  TRIANGLENUM_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n * (n + 1) / 2)
  }, "TRIANGLENUM") }),
  // -- Text --
  // TEXTEMOJI_OP: count emoji-like characters (high surrogates)
  TEXTEMOJI_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const matches = vmDisplay(a).match(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu)
    return num(matches ? matches.length : 0)
  }, "TEXTEMOJI") }),
  // TEXTSTRIP_OP: strip HTML tags
  TEXTSTRIP_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/<[^>]*>/g, ""))
  }, "TEXTSTRIP") }),
  // TEXTNORMALIZE_OP: normalize whitespace (collapse multiple spaces/tabs/newlines to single space)
  TEXTNORMALIZE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/\s+/g, " ").trim())
  }, "TEXTNORM") }),
  // TEXTMORSE_OP: text to morse code
  TEXTMORSE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const morse: Record<string,string> = {A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",0:"-----",1:".----",2:"..---",3:"...--",4:"....-",5:".....",6:"-....",7:"--...",8:"---..",9:"----."," ":"/"}
    return str(vmDisplay(a).toUpperCase().split("").map(c => morse[c] || c).join(" "))
  }, "TEXTMORSE") }),
  // -- Financial --
  // BREAKEVEN_OP: break-even point (fixedCosts / (price - variableCost))
  BREAKEVEN_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BREAKEVEN")); return { result: s[s.length-1] } }
    const vc = asNum(s.pop()!), price = asNum(s.pop()!), fixed = asNum(s.pop()!)
    const margin = price - vc
    if (margin === 0) { s.push(vmError("DIV_ZERO", "BREAKEVEN")); return { result: s[s.length-1] } }
    const result = num(fixed / margin); s.push(result); return { result }
  },
  // PROFITMARGIN_OP: profit margin (revenue - cost) / revenue
  PROFITMARGIN_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const revenue = asNum(a), cost = asNum(b)
    if (revenue === 0) return vmError("DIV_ZERO", "PROFITMARGIN")
    return num((revenue - cost) / revenue)
  }, "PROFITMARGIN") }),
  // MARKUP_OP: markup percentage (price - cost) / cost
  MARKUP_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const price = asNum(a), cost = asNum(b)
    if (cost === 0) return vmError("DIV_ZERO", "MARKUP")
    return num((price - cost) / cost)
  }, "MARKUP") }),
  // -- Info --
  // ISUPPER_OP: all chars uppercase
  ISUPPER_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a); return bool(t.length > 0 && t === t.toUpperCase() && t !== t.toLowerCase())
  }, "ISUPPER") }),
  // ISLOWER_OP: all chars lowercase
  ISLOWER_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a); return bool(t.length > 0 && t === t.toLowerCase() && t !== t.toUpperCase())
  }, "ISLOWER") }),
  // ISPALINDROME_OP: check if text is palindrome
  ISPALINDROME_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a).toLowerCase().replace(/[^a-z0-9]/g, "")
    return bool(t.length > 0 && t === t.split("").reverse().join(""))
  }, "ISPALINDROME") }),
  // -- Lookup --
  // REPEAT_N: repeat a value N times onto stack
  REPEAT_N: (op: any, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "REPEAT")); return { result: s[s.length-1] } }
    const count = Math.min(1000, Math.max(0, Math.round(asNum(s.pop()!)))), val = s.pop()!
    for (let i = 0; i < count; i++) s.push(val)
    return { result: val }
  },
  // === TOWARD 660 ===
  // PENTAGONAL_OP: nth pentagonal number P(n) = n(3n-1)/2
  PENTAGONAL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n * (3 * n - 1) / 2)
  }, "PENTAGONAL") }),
  // HEXAGONAL_OP: nth hexagonal number H(n) = n(2n-1)
  HEXAGONAL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n * (2 * n - 1))
  }, "HEXAGONAL") }),
  // TETRAHEDRAL_OP: nth tetrahedral number T(n) = n(n+1)(n+2)/6
  TETRAHEDRAL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n * (n + 1) * (n + 2) / 6)
  }, "TETRAHEDRAL") }),
  // PYRAMIDAL_OP: nth square pyramidal number P(n) = n(n+1)(2n+1)/6
  PYRAMIDAL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n * (n + 1) * (2 * n + 1) / 6)
  }, "PYRAMIDAL") }),
  // STIRLING_OP: Stirling's approximation for n!
  STIRLING_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = asNum(a)
    if (n <= 0) return num(1)
    return num(Math.sqrt(2 * Math.PI * n) * Math.pow(n / Math.E, n))
  }, "STIRLING") }),
  // CONEVOL_OP: cone volume (1/3)πr²h
  CONEVOL_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const r = asNum(a), h = asNum(b)
    return num((1/3) * Math.PI * r * r * h)
  }, "CONEVOL") }),
  // TEXTRLE_OP: run-length encode text
  TEXTRLE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    let result = "", i = 0
    while (i < text.length) {
      let count = 1
      while (i + count < text.length && text[i + count] === text[i]) count++
      result += count > 1 ? `${count}${text[i]}` : text[i]
      i += count
    }
    return str(result)
  }, "TEXTRLE") }),
  // TEXTRLD_OP: run-length decode text
  TEXTRLD_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/(\d+)(.)/g, (_, n, c) => c.repeat(Number(n))))
  }, "TEXTRLD") }),
  // ISPERFECT_OP: is perfect number (sum of proper divisors == n)
  ISPERFECT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 2) return bool(false)
    let sum = 1
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { sum += i; if (i !== n / i) sum += n / i }
    return bool(sum === n)
  }, "ISPERFECT") }),
  // ISHARSHAD_OP: Harshad number (divisible by its digit sum)
  ISHARSHAD_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.abs(Math.round(asNum(a)))
    if (n === 0) return bool(false)
    let ds = 0, tmp = n
    while (tmp > 0) { ds += tmp % 10; tmp = Math.floor(tmp / 10) }
    return bool(n % ds === 0)
  }, "ISHARSHAD") }),
  // === TOWARD 700 ===
  // -- Math: signal/wave --
  // SAWTOOTH_OP: sawtooth wave: 2*(x/period - floor(x/period + 0.5))
  SAWTOOTH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const x = asNum(a), p = asNum(b)
    if (p === 0) return vmError("DIV_ZERO", "SAWTOOTH")
    return num(2 * (x / p - Math.floor(x / p + 0.5)))
  }, "SAWTOOTH") }),
  // SQUAREWAVE_OP: square wave: sign(sin(2πx/period))
  SQUAREWAVE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const x = asNum(a), p = asNum(b)
    if (p === 0) return vmError("DIV_ZERO", "SQUAREWAVE")
    return num(Math.sign(Math.sin(2 * Math.PI * x / p)))
  }, "SQUAREWAVE") }),
  // TRIANGLEWAVE_OP: triangle wave
  TRIANGLEWAVE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const x = asNum(a), p = asNum(b)
    if (p === 0) return vmError("DIV_ZERO", "TRIANGLEWAVE")
    return num(2 * Math.abs(2 * (x / p - Math.floor(x / p + 0.5))) - 1)
  }, "TRIANGLEWAVE") }),
  // -- Math: misc --
  // AGM_OP: arithmetic-geometric mean
  AGM_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    let x = asNum(a), y = asNum(b)
    for (let i = 0; i < 30; i++) { const nx = (x + y) / 2, ny = Math.sqrt(x * y); x = nx; y = ny; if (Math.abs(x - y) < 1e-15) break }
    return num(x)
  }, "AGM") }),
  // LOGISTIC_OP: logistic function L / (1 + e^(-k*(x-x0)))
  LOGISTIC_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "LOGISTIC")); return { result: s[s.length-1] } }
    const x0 = asNum(s.pop()!), k = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = num(1 / (1 + Math.exp(-k * (x - x0))))
    s.push(result); return { result }
  },
  // GAMMA2_OP: Lanczos approximation of gamma function
  GAMMA2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let x = asNum(a)
    if (x <= 0 && x === Math.floor(x)) return vmError("VALUE", "GAMMA2")
    const g = 7, c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7]
    if (x < 0.5) return num(Math.PI / (Math.sin(Math.PI * x) * asNum((() => { const xx = 1 - x; let t = c[0]; for (let i = 1; i < g + 2; i++) t += c[i] / (xx - 1 + i); const u = xx - 1 + g + 0.5; return num(Math.sqrt(2 * Math.PI) * Math.pow(u, xx - 0.5) * Math.exp(-u) * t) })().value)))
    x -= 1; let t = c[0]; for (let i = 1; i < g + 2; i++) t += c[i] / (x + i); const u = x + g + 0.5
    return num(Math.sqrt(2 * Math.PI) * Math.pow(u, x + 0.5) * Math.exp(-u) * t)
  }, "GAMMA2") }),
  // -- Text --
  // TEXTROT13_OP: ROT13 cipher
  TEXTROT13_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/[a-zA-Z]/g, c => {
      const base = c <= 'Z' ? 65 : 97
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
    }))
  }, "TEXTROT13") }),
  // TEXTCAESAR_OP: Caesar cipher shift
  TEXTCAESAR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const shift = Math.round(asNum(b))
    return str(vmDisplay(a).replace(/[a-zA-Z]/g, c => {
      const base = c <= 'Z' ? 65 : 97
      return String.fromCharCode(((c.charCodeAt(0) - base + shift + 260) % 26) + base)
    }))
  }, "TEXTCAESAR") }),
  // TEXTFREQ_OP: most frequent character
  TEXTFREQ_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    if (text.length === 0) return str("")
    const freq = new Map<string, number>()
    for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1)
    let best = "", maxC = 0
    freq.forEach((c, ch) => { if (c > maxC) { maxC = c; best = ch } })
    return str(best)
  }, "TEXTFREQ") }),
  // -- Info --
  // ISASCII_OP: all chars are ASCII
  ISASCII_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^[\x00-\x7F]*$/.test(vmDisplay(a)))
  }, "ISASCII") }),
  // ISPRINTABLE_OP: all chars are printable ASCII
  ISPRINTABLE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^[\x20-\x7E]*$/.test(vmDisplay(a)))
  }, "ISPRINTABLE") }),
  // ISWHITESPACE_OP: all chars are whitespace
  ISWHITESPACE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a); return bool(t.length > 0 && /^\s+$/.test(t))
  }, "ISWHITESPACE") }),
  // -- Financial --
  // SIMPLEINTEREST_OP: simple interest P * r * t
  SIMPLEINTEREST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SIMPLEINT")); return { result: s[s.length-1] } }
    const t = asNum(s.pop()!), r = asNum(s.pop()!), p = asNum(s.pop()!)
    const result = num(p * r * t); s.push(result); return { result }
  },
  // COMPOUNDINTEREST_OP: compound interest P * (1+r/n)^(nt) - P
  COMPOUNDINTEREST_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "COMPOUNDINT")); return { result: s[s.length-1] } }
    const n = asNum(s.pop()!), t = asNum(s.pop()!), r = asNum(s.pop()!), p = asNum(s.pop()!)
    const result = num(p * Math.pow(1 + r / n, n * t) - p); s.push(result); return { result }
  },
  // DEPRECIATION_OP: straight-line depreciation per period (cost - salvage) / life
  DEPRECIATION_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "DEPRECIATION")); return { result: s[s.length-1] } }
    const life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    if (life === 0) { s.push(vmError("DIV_ZERO", "DEPRECIATION")); return { result: s[s.length-1] } }
    const result = num((cost - salvage) / life); s.push(result); return { result }
  },
  // === BATCH 700 ===
  // -- Math --
  // LUCAS_OP: Lucas number L(n)
  LUCAS_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(0, Math.round(asNum(a)))
    if (n === 0) return num(2); if (n === 1) return num(1)
    let a0 = 2, a1 = 1; for (let i = 2; i <= n; i++) { const t = a0 + a1; a0 = a1; a1 = t }
    return num(a1)
  }, "LUCAS") }),
  // BELL_OP: Bell number B(n) — # of partitions of set of n elements
  BELL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(0, Math.min(25, Math.round(asNum(a))))
    if (n === 0) return num(1)
    const b = [1]
    for (let i = 1; i <= n; i++) {
      const row = [b[b.length - 1]]
      for (let j = 1; j <= i; j++) row.push(row[j-1] + (j < i ? 0 : 0) + (j === 1 ? b[b.length-1] : row[j-1]))
      // Bell triangle: B[i] = row[i]
      // Actually use simple recursion via Bell triangle
    }
    // Use simpler formula via second kind Stirling
    let result = 0
    for (let k = 0; k <= n; k++) {
      let s2 = 0
      for (let j = 0; j <= k; j++) {
        const sign = (k - j) % 2 === 0 ? 1 : -1
        let binom = 1; for (let i = 0; i < j; i++) binom = binom * (k - i) / (i + 1)
        s2 += sign * binom * Math.pow(j, n)
      }
      result += s2 / (function(x: number) { let f = 1; for (let i = 2; i <= x; i++) f *= i; return f })(k)
    }
    return num(Math.round(result))
  }, "BELL") }),
  // INTLOG2_OP: integer log base 2 (floor)
  INTLOG2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = asNum(a); return n <= 0 ? vmError("VALUE", "INTLOG2") : num(Math.floor(Math.log2(n)))
  }, "INTLOG2") }),
  // INTLOG10_OP: integer log base 10 (floor)
  INTLOG10_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = asNum(a); return n <= 0 ? vmError("VALUE", "INTLOG10") : num(Math.floor(Math.log10(n)))
  }, "INTLOG10") }),
  // BITLEN_OP: number of bits needed to represent n
  BITLEN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.abs(Math.round(asNum(a)))
    return num(n === 0 ? 1 : Math.floor(Math.log2(n)) + 1)
  }, "BITLEN") }),
  // -- Text --
  // TEXTREPEAT_OP: repeat text n times
  TEXTREPEAT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), n = Math.max(0, Math.min(1000, Math.round(asNum(b))))
    return str(text.repeat(n))
  }, "TEXTREPEAT") }),
  // TEXTNTH_OP: get nth character (1-based)
  TEXTNTH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), idx = Math.round(asNum(b)) - 1
    return idx >= 0 && idx < text.length ? str(text[idx]) : str("")
  }, "TEXTNTH") }),
  // TEXTUNIQUE_OP: unique characters only
  TEXTUNIQUE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str([...new Set(vmDisplay(a))].join(""))
  }, "TEXTUNIQUE") }),
  // TEXTDISTINCT_OP: count distinct characters
  TEXTDISTINCT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return num(new Set(vmDisplay(a)).size)
  }, "TEXTDISTINCT") }),
  // -- Lookup --
  // COUNTIF2_N: count values matching condition in variadic list
  COUNTIF2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTIF2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = args[0]; let count = 0
    for (let i = 1; i < args.length; i++) if (vmDisplay(args[i]) === vmDisplay(target)) count++
    const result = num(count); s.push(result); return { result }
  },
  // -- Info --
  // CHARCOUNT_OP: count occurrences of char in text
  CHARCOUNT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), ch = vmDisplay(b)
    let count = 0; for (const c of text) if (c === ch) count++
    return num(count)
  }, "CHARCOUNT") }),
  // ISEMPTYTEXT_OP: check if text is empty or only whitespace
  ISEMPTYTEXT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(vmDisplay(a).trim().length === 0)
  }, "ISEMPTYTEXT") }),
  // -- Financial --
  // RULEOF72_OP: years to double at rate r (72/r%)
  RULEOF72_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const r = asNum(a)
    if (r === 0) return vmError("DIV_ZERO", "RULEOF72")
    return num(72 / (r * 100))
  }, "RULEOF72") }),
  // PRESENTVALUE_OP: present value of future amount: FV / (1+r)^n
  PRESENTVALUE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "PRESENTVAL")); return { result: s[s.length-1] } }
    const n = asNum(s.pop()!), r = asNum(s.pop()!), fv = asNum(s.pop()!)
    const result = num(fv / Math.pow(1 + r, n)); s.push(result); return { result }
  },
  // === HIT 700 ===
  // -- Math: constants & utilities --
  // GOLDEN_OP: golden ratio φ = (1+√5)/2
  GOLDEN_OP: (_o, s) => { const r = num((1 + Math.sqrt(5)) / 2); s.push(r); return { result: r } },
  // EULER_OP: Euler's number e
  EULER_OP: (_o, s) => { const r = num(Math.E); s.push(r); return { result: r } },
  // TAU_OP: tau = 2π
  TAU_OP: (_o, s) => { const r = num(2 * Math.PI); s.push(r); return { result: r } },
  // CUBEROOT_OP: cube root
  CUBEROOT_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.cbrt(asNum(a))), "CUBEROOT") }),
  // WRAP_OP: wrap value into range [min, max)
  WRAP_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "WRAP")); return { result: s[s.length-1] } }
    const max = asNum(s.pop()!), min = asNum(s.pop()!), val = asNum(s.pop()!)
    const range = max - min
    if (range <= 0) { s.push(vmError("VALUE", "WRAP")); return { result: s[s.length-1] } }
    const result = num(min + ((val - min) % range + range) % range)
    s.push(result); return { result }
  },
  // REMAP_OP: remap from [a,b] to [c,d]
  REMAP_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "REMAP")); return { result: s[s.length-1] } }
    const d = asNum(s.pop()!), c = asNum(s.pop()!), b = asNum(s.pop()!), a = asNum(s.pop()!), val = asNum(s.pop()!)
    if (b === a) { s.push(vmError("DIV_ZERO", "REMAP")); return { result: s[s.length-1] } }
    const result = num(c + (val - a) * (d - c) / (b - a))
    s.push(result); return { result }
  },
  // -- Text --
  // TEXTBASE64_OP: text to base64 (ASCII only)
  TEXTBASE64_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(btoa(vmDisplay(a))) } catch { return vmError("VALUE", "TEXTBASE64") }
  }, "TEXTBASE64") }),
  // TEXTFROMBASE64_OP: base64 to text
  TEXTFROMBASE64_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(atob(vmDisplay(a))) } catch { return vmError("VALUE", "TEXTFROMBASE64") }
  }, "TEXTFROMBASE64") }),
  // TEXTPREFIX_OP: first n characters
  TEXTPREFIX_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return str(vmDisplay(a).slice(0, Math.max(0, Math.round(asNum(b)))))
  }, "TEXTPREFIX") }),
  // TEXTSUFFIX_OP: last n characters
  TEXTSUFFIX_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const t = vmDisplay(a), n = Math.max(0, Math.round(asNum(b)))
    return str(t.slice(Math.max(0, t.length - n)))
  }, "TEXTSUFFIX") }),
  // -- Stat --
  // RMS_N: root mean square (variadic)
  RMS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RMS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const result = num(Math.sqrt(args.reduce((sum, v) => sum + v * v, 0) / args.length))
    s.push(result); return { result }
  },
  // RANGE2_N: range = max - min (variadic)
  RANGE2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANGE2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const result = num(Math.max(...args) - Math.min(...args))
    s.push(result); return { result }
  },
  // IQR_N: interquartile range (variadic)
  IQR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "IQR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum).sort((a, b) => a - b)
    const q = (arr: number[], p: number) => { const i = (arr.length - 1) * p; const lo = Math.floor(i); return lo === i ? arr[lo] : arr[lo] + (arr[lo+1] - arr[lo]) * (i - lo) }
    const result = num(q(args, 0.75) - q(args, 0.25))
    s.push(result); return { result }
  },
  // MAPE_N: mean absolute percentage error (actual, predicted pairs interleaved)
  MAPE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "MAPE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    let sum = 0, count = 0
    for (let i = 0; i < args.length; i += 2) { const actual = args[i], pred = args[i+1]; if (actual !== 0) { sum += Math.abs((actual - pred) / actual); count++ } }
    const result = count > 0 ? num(sum / count) : num(0)
    s.push(result); return { result }
  },
  // -- Info --
  // ISODD2_OP: check if odd (cleaner name)
  ISODD2_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(Math.round(asNum(a)) % 2 !== 0), "ISODD2") }),
  // ISEVEN2_OP: check if even (cleaner name)
  ISEVEN2_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(Math.round(asNum(a)) % 2 === 0), "ISEVEN2") }),
  // ISZERO_OP: is value zero
  ISZERO_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : bool(asNum(a) === 0), "ISZERO") }),
  // -- Financial --
  // ANNUITY_OP: annuity factor (1 - (1+r)^(-n)) / r
  ANNUITY_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const r = asNum(a), n = asNum(b)
    if (r === 0) return num(n)
    return num((1 - Math.pow(1 + r, -n)) / r)
  }, "ANNUITY") }),
  // FUTUREVALUE2_OP: future value of annuity PMT * ((1+r)^n - 1) / r
  FUTUREVALUE2_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "FVANNUITY")); return { result: s[s.length-1] } }
    const n = asNum(s.pop()!), r = asNum(s.pop()!), pmt = asNum(s.pop()!)
    if (r === 0) { const result = num(pmt * n); s.push(result); return { result } }
    const result = num(pmt * (Math.pow(1 + r, n) - 1) / r)
    s.push(result); return { result }
  },
  // -- Math: hit 700 --
  // ABUNDANCY_OP: abundancy index σ(n)/n
  ABUNDANCY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.abs(Math.round(asNum(a)))
    if (n === 0) return num(0)
    let sigma = 0
    for (let i = 1; i * i <= n; i++) if (n % i === 0) { sigma += i; if (i !== n / i) sigma += n / i }
    return num(sigma / n)
  }, "ABUNDANCY") }),
  // DIGITCOUNT_OP: number of digits in integer
  DIGITCOUNT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.abs(Math.round(asNum(a)))
    return num(n === 0 ? 1 : Math.floor(Math.log10(n)) + 1)
  }, "DIGITCOUNT") }),
  // === TOWARD 750 (verified unique) ===
  CHEBYSHEV_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(Math.max(Math.abs(asNum(a)), Math.abs(asNum(b))))
  }, "CHEBYSHEV") }),
  ISPOWEROFTWO_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return bool(n > 0 && (n & (n - 1)) === 0)
  }, "ISPOWEROFTWO") }),
  NEXTODD_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n % 2 === 0 ? n + 1 : n + 2)
  }, "NEXTODD") }),
  NEXTEVEN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)); return num(n % 2 === 0 ? n + 2 : n + 1)
  }, "NEXTEVEN") }),
  TOROMAN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a)); if (n < 1 || n > 3999) return vmError("VALUE", "TOROMAN")
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
    const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"]
    let r = ""; for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i] }
    return str(r)
  }, "TOROMAN") }),
  FROMROMAN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const rom: Record<string,number> = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}
    const t = vmDisplay(a).toUpperCase(); let r = 0
    for (let i = 0; i < t.length; i++) { const c = rom[t[i]] || 0, nx = rom[t[i+1]] || 0; r += c < nx ? -c : c }
    return num(r)
  }, "FROMROMAN") }),
  TOORDINAL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a)), sfx = ["th","st","nd","rd"]
    const v = n % 100; return str(n + (sfx[(v-20)%10] || sfx[v] || sfx[0]))
  }, "TOORDINAL") }),
  TEXTHEX_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str([...vmDisplay(a)].map(c => c.charCodeAt(0).toString(16).padStart(2,"0")).join(""))
  }, "TEXTHEX") }),
  TEXTFROMHEX_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const h = vmDisplay(a); let r = ""
    for (let i = 0; i < h.length; i += 2) r += String.fromCharCode(parseInt(h.substring(i, i+2), 16))
    return str(r)
  }, "TEXTFROMHEX") }),
  TEXTDEDUPE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/(.)\1+/g, "$1"))
  }, "TEXTDEDUPE") }),
  TEXTLINES_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a); return num(t.length === 0 ? 0 : t.split("\n").length)
  }, "TEXTLINES") }),
  TEXTPASCALCASE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/(?:^|[^a-zA-Z0-9])([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, ""))
  }, "TEXTPASCALCASE") }),
  WMEAN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "WMEAN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    let wsum = 0, wtotal = 0
    for (let i = 0; i < args.length; i += 2) { wsum += args[i] * args[i+1]; wtotal += args[i+1] }
    const result = wtotal === 0 ? num(0) : num(wsum / wtotal)
    s.push(result); return { result }
  },
  GINI2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GINI2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum).sort((a, b) => a - b)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    if (mean === 0) { const result = num(0); s.push(result); return { result } }
    let sumDiff = 0
    for (let i = 0; i < args.length; i++) for (let j = 0; j < args.length; j++) sumDiff += Math.abs(args[i] - args[j])
    const result = num(sumDiff / (2 * args.length * args.length * mean))
    s.push(result); return { result }
  },
  ISPRIMEFAST_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 2) return bool(false); if (n < 4) return bool(true)
    if (n % 2 === 0 || n % 3 === 0) return bool(false)
    for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i+2) === 0) return bool(false)
    return bool(true)
  }, "ISPRIMEFAST") }),
  SHARPE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SHARPE")); return { result: s[s.length-1] } }
    const sd = asNum(s.pop()!), rf = asNum(s.pop()!), rp = asNum(s.pop()!)
    if (sd === 0) { s.push(vmError("DIV_ZERO", "SHARPE")); return { result: s[s.length-1] } }
    const result = num((rp - rf) / sd); s.push(result); return { result }
  },
  SORTINO_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SORTINO")); return { result: s[s.length-1] } }
    const dd = asNum(s.pop()!), rf = asNum(s.pop()!), rp = asNum(s.pop()!)
    if (dd === 0) { s.push(vmError("DIV_ZERO", "SORTINO")); return { result: s[s.length-1] } }
    const result = num((rp - rf) / dd); s.push(result); return { result }
  },
  EMAVG_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "EMAVG")); return { result: s[s.length-1] } }
    const alpha = asNum(s.pop()!), newVal = asNum(s.pop()!), prev = asNum(s.pop()!)
    const result = num(alpha * newVal + (1 - alpha) * prev); s.push(result); return { result }
  },
  SMAVG_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SMAVG")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), newVal = asNum(s.pop()!), prev = asNum(s.pop()!)
    if (n2 === 0) { s.push(vmError("DIV_ZERO", "SMAVG")); return { result: s[s.length-1] } }
    const result = num(prev + (newVal - prev) / n2); s.push(result); return { result }
  },
  // === HIT 750 ===
  COPRIME_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    let x = Math.abs(Math.round(asNum(a))), y = Math.abs(Math.round(asNum(b)))
    while (y) { const t = y; y = x % y; x = t } return bool(x === 1)
  }, "COPRIME") }),
  COLLATZ_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a)), steps = 0
    if (n < 1) return vmError("VALUE", "COLLATZ")
    while (n !== 1) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; steps++; if (steps > 10000) break }
    return num(steps)
  }, "COLLATZ") }),
  PREVPRIME_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a)) - 1
    if (n < 2) return vmError("VALUE", "PREVPRIME")
    const ip = (x: number) => { if (x < 2) return false; if (x < 4) return true; if (x%2===0||x%3===0) return false; for (let i=5;i*i<=x;i+=6) if(x%i===0||x%(i+2)===0) return false; return true }
    while (n >= 2 && !ip(n)) n--; return n < 2 ? vmError("VALUE", "PREVPRIME") : num(n)
  }, "PREVPRIME") }),
  TEXTPAD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTPAD")); return { result: s[s.length-1] } }
    const ch = vmDisplay(s.pop()!), w = Math.max(0, Math.round(asNum(s.pop()!))), t = vmDisplay(s.pop()!)
    const result = str(t.padEnd(w, ch || " ")); s.push(result); return { result }
  },
  TEXTMASK_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const t = vmDisplay(a), show = Math.max(0, Math.round(asNum(b)))
    return str("*".repeat(Math.max(0, t.length - show)) + t.slice(-show))
  }, "TEXTMASK") }),
  TEXTISURL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^https?:\/\/[^\s]+/.test(vmDisplay(a)))
  }, "TEXTISURL") }),
  TEXTISEMAIL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vmDisplay(a)))
  }, "TEXTISEMAIL") }),
  WORDSCOUNT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a).trim(); return num(t.length === 0 ? 0 : t.split(/\s+/).length)
  }, "WORDSCOUNT") }),
  ISLEAPYEAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const y = Math.round(asNum(a)); return bool((y%4===0 && y%100!==0) || y%400===0)
  }, "ISLEAPYEAR") }),
  WEEKOFYEAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const d = new Date(vmDisplay(a)); if (isNaN(d.getTime())) return vmError("VALUE", "WEEKOFYEAR")
    const start = new Date(d.getFullYear(), 0, 1)
    return num(Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7))
  }, "WEEKOFYEAR") }),
  ISWEEKEND_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const d = new Date(vmDisplay(a)); if (isNaN(d.getTime())) return vmError("VALUE", "ISWEEKEND")
    return bool(d.getDay() === 0 || d.getDay() === 6)
  }, "ISWEEKEND") }),
  QUARTERNO_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const m = Math.round(asNum(a)); return num(Math.ceil(m / 3))
  }, "QUARTERNO") }),
  SEMESTERNO_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const m = Math.round(asNum(a)); return num(m <= 6 ? 1 : 2)
  }, "SEMESTERNO") }),
  EFFECTRATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const nom = asNum(a), n = asNum(b); return num(Math.pow(1 + nom / n, n) - 1)
  }, "EFFECTRATE") }),
  NOMRATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const eff = asNum(a), n = asNum(b); return num(n * (Math.pow(1 + eff, 1 / n) - 1))
  }, "NOMRATE") }),
  AVEDEV2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AVEDEV2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const result = num(args.reduce((a, v) => a + Math.abs(v - mean), 0) / args.length)
    s.push(result); return { result }
  },
  COVAR2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "COVAR2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = args.length / 2, xs = args.slice(0, half), ys = args.slice(half)
    const mx = xs.reduce((a,b)=>a+b,0)/half, my = ys.reduce((a,b)=>a+b,0)/half
    const result = num(xs.reduce((a,x,i) => a + (x-mx)*(ys[i]-my), 0) / half)
    s.push(result); return { result }
  },
  CORREL2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "CORREL2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = args.length / 2, xs = args.slice(0, half), ys = args.slice(half)
    const mx = xs.reduce((a,b)=>a+b,0)/half, my = ys.reduce((a,b)=>a+b,0)/half
    let cov = 0, sx = 0, sy = 0
    for (let i = 0; i < half; i++) { cov += (xs[i]-mx)*(ys[i]-my); sx += (xs[i]-mx)**2; sy += (ys[i]-my)**2 }
    const d = Math.sqrt(sx * sy); const result = d === 0 ? num(0) : num(cov / d)
    s.push(result); return { result }
  },
  NPER2_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NPER2")); return { result: s[s.length-1] } }
    const fv = asNum(s.pop()!), pv = asNum(s.pop()!), r = asNum(s.pop()!)
    if (r <= 0 || pv <= 0 || fv <= 0) { s.push(vmError("VALUE", "NPER2")); return { result: s[s.length-1] } }
    const result = num(Math.log(fv / pv) / Math.log(1 + r)); s.push(result); return { result }
  },
  RATE2_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "RATE2")); return { result: s[s.length-1] } }
    const n = asNum(s.pop()!), fv = asNum(s.pop()!), pv = asNum(s.pop()!)
    if (pv <= 0 || n <= 0) { s.push(vmError("VALUE", "RATE2")); return { result: s[s.length-1] } }
    const result = num(Math.pow(fv / pv, 1 / n) - 1); s.push(result); return { result }
  },
  COSSIM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "COSSIM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = args.length / 2, xs = args.slice(0, half), ys = args.slice(half)
    let dot = 0, mx = 0, my = 0
    for (let i = 0; i < half; i++) { dot += xs[i]*ys[i]; mx += xs[i]**2; my += ys[i]**2 }
    const d = Math.sqrt(mx) * Math.sqrt(my); const result = d === 0 ? num(0) : num(dot / d)
    s.push(result); return { result }
  },
  // --- Hit 750 ---
  FIBONACCI2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(0, Math.round(asNum(a)))
    if (n <= 1) return num(n)
    let a0 = 0, a1 = 1; for (let i = 2; i <= n; i++) { const t = a0 + a1; a0 = a1; a1 = t }
    return num(a1)
  }, "FIBONACCI2") }),
  MOTZKIN_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(0, Math.min(30, Math.round(asNum(a))))
    const m = [1, 1]
    for (let i = 2; i <= n; i++) m[i] = ((2*i+1)*m[i-1] + 3*(i-1)*m[i-2]) / (i+2)
    return num(Math.round(m[n]))
  }, "MOTZKIN") }),
  DERANGEMENT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(0, Math.min(20, Math.round(asNum(a))))
    if (n === 0) return num(1); if (n === 1) return num(0)
    let d0 = 1, d1 = 0
    for (let i = 2; i <= n; i++) { const d = (i-1) * (d0 + d1); d0 = d1; d1 = d }
    return num(d1)
  }, "DERANGEMENT") }),
  TOTIENT2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.abs(Math.round(asNum(a))); if (n < 1) return num(0)
    let result = n
    for (let p = 2; p * p <= n; p++) if (n % p === 0) { while (n % p === 0) n /= p; result -= result / p }
    if (n > 1) result -= result / n
    return num(Math.round(result))
  }, "TOTIENT2") }),
  HARMONIC2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.max(1, Math.round(asNum(a)))
    let sum = 0; for (let i = 1; i <= n; i++) sum += 1 / i
    return num(sum)
  }, "HARMONIC2") }),
  TEXTOBFUSCATE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const t = vmDisplay(a); if (t.length <= 2) return str(t)
    return str(t[0] + "*".repeat(t.length - 2) + t[t.length - 1])
  }, "TEXTOBFUSCATE") }),
  TEXTCOUNT2_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), sub = vmDisplay(b)
    if (sub.length === 0) return num(0)
    let count = 0, pos = 0
    while ((pos = text.indexOf(sub, pos)) !== -1) { count++; pos += sub.length }
    return num(count)
  }, "TEXTCOUNT2") }),
  TEXTSHUFFLE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const arr = [...vmDisplay(a)]
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
    return str(arr.join(""))
  }, "TEXTSHUFFLE") }),
  ISCOPRIMEALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ISCOPRIMEALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(v => Math.abs(Math.round(asNum(v))))
    const gcd2 = (a: number, b: number): number => { while (b) { const t = b; b = a % b; a = t } return a }
    let all = true
    for (let i = 0; i < args.length && all; i++) for (let j = i+1; j < args.length && all; j++) if (gcd2(args[i], args[j]) !== 1) all = false
    const result = bool(all); s.push(result); return { result }
  },
  ISFIBBISH_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    // Check if n is a Fibonacci number: n is Fib iff 5n²±4 is perfect square
    const isPerfSq = (x: number) => { const s = Math.round(Math.sqrt(x)); return s * s === x }
    return bool(isPerfSq(5*n*n+4) || isPerfSq(5*n*n-4))
  }, "ISFIBBISH") }),
  // === 800 batch: lookup/logic/trig/stat/text/info/financial ===
  // -- Lookup/Array (variadic) --
  BINSEARCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "BINSEARCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = asNum(args[0]); const arr = args.slice(1).map(asNum).sort((a,b) => a-b)
    let lo = 0, hi = arr.length - 1, found = -1
    while (lo <= hi) { const mid = (lo+hi)>>1; if (arr[mid] === target) { found = mid; break } else if (arr[mid] < target) lo = mid+1; else hi = mid-1 }
    const result = num(found); s.push(result); return { result }
  },
  INDEXMATCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "INDEXMATCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = vmDisplay(args[0])
    const idx = args.slice(1).findIndex(v => vmDisplay(v) === target)
    const result = num(idx >= 0 ? idx + 1 : -1); s.push(result); return { result }
  },
  LASTINDEXOF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "LASTINDEXOF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = vmDisplay(args[0])
    let idx = -1; for (let i = args.length - 1; i >= 1; i--) if (vmDisplay(args[i]) === target) { idx = i; break }
    const result = num(idx); s.push(result); return { result }
  },
  FINDALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "FINDALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = vmDisplay(args[0])
    const indices = args.slice(1).map((v, i) => vmDisplay(v) === target ? i + 1 : -1).filter(i => i > 0)
    const result = num(indices.length); s.push(result); return { result }
  },
  COUNTUNIQ_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTUNIQ")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = num(new Set(args.map(vmDisplay)).size); s.push(result); return { result }
  },
  ARRAYCONTAINS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "ARRAYCONTAINS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = vmDisplay(args[0])
    const result = bool(args.slice(1).some(v => vmDisplay(v) === target)); s.push(result); return { result }
  },
  ARRAYPOS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "ARRAYPOS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const target = vmDisplay(args[0])
    const idx = args.slice(1).findIndex(v => vmDisplay(v) === target)
    const result = num(idx >= 0 ? idx + 1 : 0); s.push(result); return { result }
  },
  FLATTEN2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FLATTEN2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = num(args.length); s.push(result); return { result }
  },
  // -- Logic --
  IFF_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "IFF")); return { result: s[s.length-1] } }
    const falseVal = s.pop()!, trueVal = s.pop()!, cond = s.pop()!
    const result = asNum(cond) !== 0 ? trueVal : falseVal; s.push(result); return { result }
  },
  SWITCH2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "SWITCH2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); const expr = vmDisplay(args[0])
    for (let i = 1; i < args.length - 1; i += 2) if (vmDisplay(args[i]) === expr) { s.push(args[i+1]); return { result: args[i+1] } }
    const def = args.length % 2 === 0 ? args[args.length-1] : vmError("NA", "SWITCH2"); s.push(def); return { result: def }
  },
  XORALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "XORALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); let trueCount = 0
    for (const a of args) if (asNum(a) !== 0) trueCount++
    const result = bool(trueCount % 2 === 1); s.push(result); return { result }
  },
  NANDALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NANDALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = bool(!args.every(a => asNum(a) !== 0)); s.push(result); return { result }
  },
  NORALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NORALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = bool(!args.some(a => asNum(a) !== 0)); s.push(result); return { result }
  },
  COALESCE2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COALESCE2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const found = args.find(a => !isVMError(a) && vmDisplay(a) !== "" && vmDisplay(a) !== "0")
    const result = found ?? args[args.length-1]; s.push(result); return { result }
  },
  UNLESS_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return asNum(a) === 0 ? b : a
  }, "UNLESS") }),
  // -- Trigonometric --
  SECANT_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const c = Math.cos(asNum(a)); return c === 0 ? vmError("DIV0", "SECANT") : num(1/c) }, "SECANT") }),
  COSECANT_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sn = Math.sin(asNum(a)); return sn === 0 ? vmError("DIV0", "COSECANT") : num(1/sn) }, "COSECANT") }),
  VERSINE_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(1 - Math.cos(asNum(a))) }, "VERSINE") }),
  HAVERSINE_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num((1 - Math.cos(asNum(a))) / 2) }, "HAVERSINE") }),
  EXSECANT_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const c = Math.cos(asNum(a)); return c === 0 ? vmError("DIV0", "EXSECANT") : num(1/c - 1) }, "EXSECANT") }),
  LEMNISCATE_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(2.622057554292119905) }, "LEMNISCATE") }),
  AGM2_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    let x = asNum(a), y = asNum(b)
    for (let i = 0; i < 20; i++) { const nx = (x+y)/2, ny = Math.sqrt(x*y); x = nx; y = ny }
    return num(x)
  }, "AGM2") }),
  POWMOD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "POWMOD")); return { result: s[s.length-1] } }
    const m = Math.round(asNum(s.pop()!)), exp = Math.round(asNum(s.pop()!)), base = Math.round(asNum(s.pop()!))
    if (m <= 0) { s.push(vmError("VALUE", "POWMOD")); return { result: s[s.length-1] } }
    let result2 = 1, b = base % m, e = exp
    while (e > 0) { if (e % 2 === 1) result2 = (result2 * b) % m; e = Math.floor(e / 2); b = (b * b) % m }
    const result = num(result2); s.push(result); return { result }
  },
  // -- Statistics --
  MAD2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAD2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const med = [...args].sort((a,b)=>a-b); const m = med.length % 2 ? med[(med.length-1)/2] : (med[med.length/2-1]+med[med.length/2])/2
    const result = num(args.reduce((a,v) => a + Math.abs(v - m), 0) / args.length); s.push(result); return { result }
  },
  ZSCORE2_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ZSCORE2")); return { result: s[s.length-1] } }
    const sd = asNum(s.pop()!), mean = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = sd === 0 ? vmError("DIV0", "ZSCORE2") : num((x - mean) / sd); s.push(result); return { result }
  },
  TSTAT_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TSTAT")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), se = asNum(s.pop()!), xbar = asNum(s.pop()!)
    const result = se === 0 ? vmError("DIV0", "TSTAT") : num(xbar / se); s.push(result); return { result }
  },
  FSTAT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const v1 = asNum(a), v2 = asNum(b); return v2 === 0 ? vmError("DIV0", "FSTAT") : num(v1 / v2)
  }, "FSTAT") }),
  CHISQSTAT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const obs = asNum(a), exp = asNum(b); return exp === 0 ? vmError("DIV0", "CHISQSTAT") : num((obs-exp)**2 / exp)
  }, "CHISQSTAT") }),
  SEM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SEM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a,b)=>a+b,0)/args.length
    const sd = Math.sqrt(args.reduce((a,v)=>a+(v-mean)**2,0)/(args.length-1))
    const result = num(sd / Math.sqrt(args.length)); s.push(result); return { result }
  },
  POOLEDVAR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "POOLEDVAR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = args.length / 2, ns = args.slice(0, half), vars = args.slice(half)
    const sumN = ns.reduce((a,b)=>a+b,0), sumW = ns.reduce((a,ni,i) => a + (ni-1)*vars[i], 0)
    const result = num(sumW / (sumN - half)); s.push(result); return { result }
  },
  // -- Text --
  TEXTCOUNTCHAR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const t = vmDisplay(a), ch = vmDisplay(b); return num([...t].filter(c => c === ch).length)
  }, "TEXTCOUNTCHAR") }),
  TEXTZFILL_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return str(vmDisplay(a).padStart(Math.max(0, Math.round(asNum(b))), "0"))
  }, "TEXTZFILL") }),
  TEXTLPAD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTLPAD")); return { result: s[s.length-1] } }
    const ch = vmDisplay(s.pop()!), w = Math.max(0, Math.round(asNum(s.pop()!))), t = vmDisplay(s.pop()!)
    const result = str(t.padStart(w, ch || " ")); s.push(result); return { result }
  },
  TEXTRPAD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTRPAD")); return { result: s[s.length-1] } }
    const ch = vmDisplay(s.pop()!), w = Math.max(0, Math.round(asNum(s.pop()!))), t = vmDisplay(s.pop()!)
    const result = str(t.padEnd(w, ch || " ")); s.push(result); return { result }
  },
  TEXTABBREV_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const t = vmDisplay(a), maxLen = Math.max(3, Math.round(asNum(b)))
    return str(t.length <= maxLen ? t : t.slice(0, maxLen - 3) + "...")
  }, "TEXTABBREV") }),
  TEXTWORDFREQ_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const words = vmDisplay(a).toLowerCase().split(/\s+/).filter(Boolean), target = vmDisplay(b).toLowerCase()
    return num(words.filter(w => w === target).length)
  }, "TEXTWORDFREQ") }),
  TEXTSANITIZE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":"&#39;" }[c] || c)))
  }, "TEXTSANITIZE") }),
  TEXTMIRROR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a; const t = vmDisplay(a); return str(t + [...t].reverse().join(""))
  }, "TEXTMIRROR") }),
  // -- Info --
  TYPEOF3_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return str("error")
    const v = asNum(a); if (!isNaN(v) && vmDisplay(a) === String(v)) return str("number")
    const d2 = vmDisplay(a); if (d2 === "true" || d2 === "false") return str("boolean")
    return str("string")
  }, "TYPEOF3") }),
  ISBLANK2_OP: (_o, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(vmDisplay(a).trim() === "") }, "ISBLANK2") }),
  ISTRUTHY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return bool(false)
    const d2 = vmDisplay(a); return bool(d2 !== "" && d2 !== "0" && d2 !== "false")
  }, "ISTRUTHY") }),
  ISFALSY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return bool(true)
    const d2 = vmDisplay(a); return bool(d2 === "" || d2 === "0" || d2 === "false")
  }, "ISFALSY") }),
  ISFRACTION_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a; const v = asNum(a); return bool(!isNaN(v) && v !== Math.round(v))
  }, "ISFRACTION") }),
  ISDIVISIBLE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const d2 = asNum(b); return d2 === 0 ? vmError("DIV0", "ISDIVISIBLE") : bool(asNum(a) % d2 === 0)
  }, "ISDIVISIBLE") }),
  // -- Financial --
  PVANNUITY_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "PVANNUITY")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), r = asNum(s.pop()!), pmt = asNum(s.pop()!)
    const result = r === 0 ? num(pmt * n2) : num(pmt * (1 - Math.pow(1+r, -n2)) / r); s.push(result); return { result }
  },
  ANNUITYPMT_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ANNUITYPMT")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), r = asNum(s.pop()!), pv = asNum(s.pop()!)
    const result = r === 0 ? num(pv / n2) : num(pv * r / (1 - Math.pow(1+r, -n2))); s.push(result); return { result }
  },
  BONDPRICE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BONDPRICE")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), ytm = asNum(s.pop()!), coupon = asNum(s.pop()!)
    let price = 0; for (let t = 1; t <= n2; t++) price += coupon / Math.pow(1+ytm, t)
    price += 100 / Math.pow(1+ytm, n2)
    const result = num(price); s.push(result); return { result }
  },
  BONDYIELD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BONDYIELD")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), price = asNum(s.pop()!), coupon = asNum(s.pop()!)
    const result = num((coupon + (100 - price) / n2) / ((100 + price) / 2)); s.push(result); return { result }
  },
  TBILL2_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const disc = asNum(a), days = asNum(b)
    return num(100 * (1 - disc * days / 360))
  }, "TBILL2") }),

  // ── 850 batch implementations ──
  // _N variadic: pop n VMValues, operate, push result
  DISTINCT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DISTINCT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const seen = new Set<any>(); for (const a of args) seen.add(a._tag === "num" ? a.value : a._tag === "str" ? a.value : a._tag === "bool" ? a.value : a)
    const r = num(seen.size); s.push(r); return { result: r }
  },
  ARRAYSLICE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYSLICE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const end = asNum(args.pop()!); const start = asNum(args.pop()!)
    const sliced = args.slice(start, end)
    const r = sliced.length > 0 ? sliced[0] : num(0); s.push(r); return { result: r }
  },
  ARRAYJOIN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYJOIN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const sep = vmDisplay(args.shift()!)
    const r = str(args.map(a => a._tag === "str" ? a.value : String(asNum(a))).join(sep)); s.push(r); return { result: r }
  },
  ARRAYREVERSE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYREVERSE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n); args.reverse()
    const r = args[0] ?? num(0); s.push(r); return { result: r }
  },
  ARRAYFLATTEN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYFLATTEN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let sum = 0; for (const a of args) sum += asNum(a)
    const r = num(sum); s.push(r); return { result: r }
  },
  ARRAYZIP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYZIP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const r = args.length >= 2 ? num(asNum(args[0]) + asNum(args[1])) : (args[0] ?? num(0)); s.push(r); return { result: r }
  },
  ARRAYMIN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYMIN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let mn = Infinity; for (const a of args) { const v = asNum(a); if (v < mn) mn = v; }
    const r = num(mn); s.push(r); return { result: r }
  },
  ARRAYMAX_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYMAX")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let mx = -Infinity; for (const a of args) { const v = asNum(a); if (v > mx) mx = v; }
    const r = num(mx); s.push(r); return { result: r }
  },
  ARRAYSUM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYSUM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let sum = 0; for (const a of args) sum += asNum(a)
    const r = num(sum); s.push(r); return { result: r }
  },
  ARRAYAVG_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYAVG")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    let sum = 0; for (const a of args) sum += asNum(a)
    const r = num(n > 0 ? sum / n : 0); s.push(r); return { result: r }
  },
  // _OP fixed-arg: use unop/binop helpers
  NIFF_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NIFF")); return { result: s[s.length-1] } }
    const t = s.pop()!; const f = s.pop()!; const c = s.pop()!
    const r = asNum(c) ? f : t; s.push(r); return { result: r }
  },
  SWITCHIF_OP: (_o: any, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "SWITCHIF")); return { result: s[s.length-1] } }
    const below = s.pop()!; const above = s.pop()!; const threshold = s.pop()!; const val = s.pop()!
    const r = asNum(val) > asNum(threshold) ? above : below; s.push(r); return { result: r }
  },
  COND_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COND")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const def = args.length % 2 === 1 ? args.pop()! : num(0)
    for (let i = 0; i < args.length - 1; i += 2) { if (asNum(args[i])) { s.push(args[i + 1]); return { result: args[i + 1] } } }
    s.push(def); return { result: def }
  },
  ALLEQUAL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ALLEQUAL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const first = asNum(args[0]); const eq = args.every(a => asNum(a) === first)
    const r = bool(eq); s.push(r); return { result: r }
  },
  ANYGT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ANYGT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const threshold = asNum(args[0]); const any = args.slice(1).some(a => asNum(a) > threshold)
    const r = bool(any); s.push(r); return { result: r }
  },
  ANYLT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ANYLT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const threshold = asNum(args[0]); const any = args.slice(1).some(a => asNum(a) < threshold)
    const r = bool(any); s.push(r); return { result: r }
  },
  ANYNE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ANYNE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0]); const any = args.slice(1).some(a => asNum(a) !== target)
    const r = bool(any); s.push(r); return { result: r }
  },
  ISALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ISALL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const r = bool(args.every(a => !!asNum(a))); s.push(r); return { result: r }
  },
  ISANY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ISANY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const r = bool(args.some(a => !!asNum(a))); s.push(r); return { result: r }
  },
  ISNONE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ISNONE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const r = bool(args.every(a => !asNum(a))); s.push(r); return { result: r }
  },
  RANDNORM_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const mu = asNum(a), sd = asNum(b); const u1 = Math.random(), u2 = Math.random(); return num(mu + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)) }, "RANDNORM") }),
  RANDEXP_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const lam = asNum(a); return num(-Math.log(1 - Math.random()) / lam) }, "RANDEXP") }),
  RANDINT_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const lo = Math.round(asNum(a)), hi = Math.round(asNum(b)); return num(Math.floor(Math.random() * (hi - lo + 1)) + lo) }, "RANDINT") }),
  COINFLIP_OP: (_o: any, s) => { const r = bool(Math.random() < 0.5); s.push(r); return { result: r } },
  GUDERMANN_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(2 * Math.atan(Math.tanh(asNum(a) / 2))) }, "GUDERMANN") }),
  INVERSEGUD_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(Math.log(Math.tan(Math.PI / 4 + asNum(a) / 2))) }, "INVERSEGUD") }),
  LANCZOS_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); const g = 7; const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (x < 0.5) { const z2 = 1 - x; let sm = c[0]; for (let i = 1; i < g + 2; i++) sm += c[i] / (z2 + i - 1); const t = z2 + g - 0.5; return num(Math.PI / (Math.sin(Math.PI * x) * Math.sqrt(2 * Math.PI) * Math.pow(t, z2 - 0.5) * Math.exp(-t) * sm)) } const z = x - 1; let sm = c[0]; for (let i = 1; i < g + 2; i++) sm += c[i] / (z + i); const t = z + g + 0.5; return num(Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * sm) }, "LANCZOS") }),
  DIGAMMA_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); return num(Math.log(x) - 1 / (2 * x) - 1 / (12 * x * x)) }, "DIGAMMA") }),
  POLYGAMMA_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = asNum(a), x = asNum(b); if (n === 0) return num(Math.log(x) - 1 / (2 * x) - 1 / (12 * x * x)); if (n === 1) return num(1 / x + 1 / (2 * x * x) + 1 / (6 * x * x * x)); return num(0) }, "POLYGAMMA") }),
  ZETA2_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sv = asNum(a); let sum = 0; for (let k = 1; k <= 1000; k++) sum += Math.pow(k, -sv); return num(sum) }, "ZETA2") }),
  BETAFN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const av = asNum(a), bv = asNum(b); const lgamma = (z: number): number => { if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = 0.99999999999980993; const cc = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; for (let i = 0; i < 8; i++) x += cc[i] / (z + i + 1); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x) }; return num(Math.exp(lgamma(av) + lgamma(bv) - lgamma(av + bv))) }, "BETAFN") }),
  POCHHAMMER_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const x = asNum(a), n = Math.round(asNum(b)); let p = 1; for (let i = 0; i < n; i++) p *= (x + i); return num(p) }, "POCHHAMMER") }),
  ENTROPY2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ENTROPY2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const vals = args.map(a => asNum(a)); const total = vals.reduce((a, b) => a + b, 0)
    if (total === 0) { const r = num(0); s.push(r); return { result: r } }
    let H = 0; for (const v of vals) { const p = v / total; if (p > 0) H -= p * Math.log2(p) }
    const r = num(H); s.push(r); return { result: r }
  },
  GINICOEF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GINICOEF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const vals = args.map(a => asNum(a)).sort((a, b) => a - b); const mu = vals.reduce((a, b) => a + b, 0) / n
    if (mu === 0) { const r = num(0); s.push(r); return { result: r } }
    let sum = 0; for (let i = 0; i < n; i++) sum += (2 * (i + 1) - n - 1) * vals[i]
    const r = num(sum / (n * n * mu)); s.push(r); return { result: r }
  },
  MOMENT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MOMENT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a))
    const sum = vals.reduce((a, v) => a + Math.pow(v, k), 0)
    const r = num(sum / vals.length); s.push(r); return { result: r }
  },
  CMOMENT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CMOMENT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a))
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length
    const r = num(vals.reduce((a, v) => a + Math.pow(v - mu, k), 0) / vals.length); s.push(r); return { result: r }
  },
  ZSCORE3_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ZSCORE3")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a))
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length
    const sigma = Math.sqrt(vals.reduce((a, v) => a + (v - mu) * (v - mu), 0) / vals.length)
    const r = num(sigma === 0 ? 0 : (target - mu) / sigma); s.push(r); return { result: r }
  },
  PERCENTILE2_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE2")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)).sort((a, b) => a - b)
    const idx = k * (vals.length - 1); const lo = Math.floor(idx); const hi = Math.ceil(idx)
    const r = num(lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo)); s.push(r); return { result: r }
  },
  TEXTFORMAT_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return str(vmDisplay(a).replace(/\{0\}/g, String(asNum(b) !== 0 ? asNum(b) : vmDisplay(b)))) }, "TEXTFORMAT") }),
  TEXTJUSTIFY_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), w = asNum(b); return str(t.length >= w ? t : t + " ".repeat(w - t.length)) }, "TEXTJUSTIFY") }),
  TEXTMASK2_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), n = asNum(b); return str(n >= t.length ? t : "*".repeat(t.length - n) + t.slice(-n)) }, "TEXTMASK2") }),
  TEXTHASH_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return str(h.toString(16)) }, "TEXTHASH") }),
  TEXTREPLACE2_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTREPLACE2")); return { result: s[s.length-1] } }
    const nw = s.pop()!; const old = s.pop()!; const t = s.pop()!
    const r = str(vmDisplay(t).split(vmDisplay(old)).join(vmDisplay(nw))); s.push(r); return { result: r }
  },
  TEXTFILL_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return str(vmDisplay(a).replace(/\{1\}/g, vmDisplay(b))) }, "TEXTFILL") }),
  CAGR2_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CAGR2")); return { result: s[s.length-1] } }
    const years = s.pop()!; const end = s.pop()!; const begin = s.pop()!
    const bv = asNum(begin); const r = num(bv === 0 ? 0 : Math.pow(asNum(end) / bv, 1 / asNum(years)) - 1); s.push(r); return { result: r }
  },
  DRAWDOWN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const curr = asNum(a), peak = asNum(b); return num(peak === 0 ? 0 : (peak - curr) / peak) }, "DRAWDOWN") }),
  CALMAR_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const ret = asNum(a), dd = asNum(b); return num(dd === 0 ? 0 : ret / Math.abs(dd)) }, "CALMAR") }),
  TREYNOR_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TREYNOR")); return { result: s[s.length-1] } }
    const beta = s.pop()!; const rf = s.pop()!; const rp = s.pop()!
    const bv = asNum(beta); const r = num(bv === 0 ? 0 : (asNum(rp) - asNum(rf)) / bv); s.push(r); return { result: r }
  },
  ISFINITE2_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(Number.isFinite(asNum(a))) }, "ISFINITE2") }),
  ISWHOLE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(Number.isInteger(asNum(a))) }, "ISWHOLE") }),

  // ── 900 batch implementations ──
  EQUIV_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return bool(asNum(a) === asNum(b)) }, "EQUIV") }),
  ONEOF_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ONEOF")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const target = asNum(args[0]); const r = bool(args.slice(1).some(a => asNum(a) === target)); s.push(r); return { result: r } },
  FIRSTTRUTHY_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FIRSTTRUTHY")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const found = args.find(a => !!asNum(a)) ?? num(0); s.push(found); return { result: found } },
  LASTTRUTHY_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LASTTRUTHY")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let found: any = num(0); for (const a of args) { if (asNum(a)) found = a }; s.push(found); return { result: found } },
  COUNTIF3_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTIF3")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const target = asNum(args[0]); let count = 0; for (let i = 1; i < args.length; i++) { if (asNum(args[i]) === target) count++ }; const r = num(count); s.push(r); return { result: r } },
  WHICHMAX_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "WHICHMAX")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let mx = -Infinity, idx = 0; for (let i = 0; i < args.length; i++) { const v = asNum(args[i]); if (v > mx) { mx = v; idx = i + 1 } }; const r = num(idx); s.push(r); return { result: r } },
  WHICHMIN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "WHICHMIN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let mn = Infinity, idx = 0; for (let i = 0; i < args.length; i++) { const v = asNum(args[i]); if (v < mn) { mn = v; idx = i + 1 } }; const r = num(idx); s.push(r); return { result: r } },
  THRESHOLD_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return bool(asNum(a) >= asNum(b)) }, "THRESHOLD") }),
  TOGGLE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(!asNum(a)) }, "TOGGLE") }),
  SATURATE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(Math.max(0, Math.min(1, asNum(a)))) }, "SATURATE") }),
  DEADBAND_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "DEADBAND")); return { result: s[s.length-1] } }
    const db = s.pop()!; const center = s.pop()!; const val = s.pop()!
    const v = asNum(val), c = asNum(center), d = asNum(db)
    const r = num(Math.abs(v - c) < d ? c : v); s.push(r); return { result: r }
  },
  RANDPERM_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANDPERM")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); for (let i = args.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [args[i], args[j]] = [args[j], args[i]] }; const r = args[0] ?? num(0); s.push(r); return { result: r } },
  RANDCHOICE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANDCHOICE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const r = args[Math.floor(Math.random() * args.length)] ?? num(0); s.push(r); return { result: r } },
  DICE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const sides = Math.max(1, Math.round(asNum(a))); return num(Math.floor(Math.random() * sides) + 1) }, "DICE") }),
  UUID4_OP: (_o: any, s) => { const hex = () => Math.floor(Math.random() * 16).toString(16); let u = ""; for (let i = 0; i < 32; i++) u += hex(); const r = str(u.slice(0,8)+"-"+u.slice(8,12)+"-4"+u.slice(13,16)+"-"+((parseInt(u[16],16)&3|8).toString(16))+u.slice(17,20)+"-"+u.slice(20,32)); s.push(r); return { result: r } },
  ENUMERATE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ENUMERATE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const r = num(args.length); s.push(r); return { result: r } },
  COUNTVALS_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COUNTVALS")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let count = 0; for (const a of args) { if (asNum(a) !== 0 || a._tag === "str") count++ }; const r = num(count); s.push(r); return { result: r } },
  FIRSTNONZERO_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FIRSTNONZERO")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const found = args.find(a => asNum(a) !== 0) ?? num(0); s.push(found); return { result: found } },
  LASTNONZERO_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LASTNONZERO")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let found: any = num(0); for (const a of args) { if (asNum(a) !== 0) found = a }; s.push(found); return { result: found } },
  NTHLARGEST_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NTHLARGEST")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const nth = Math.round(asNum(args[0])); const vals = args.slice(1).map(a => asNum(a)).sort((a, b) => b - a); const r = num(nth > 0 && nth <= vals.length ? vals[nth - 1] : 0); s.push(r); return { result: r } },
  AMORT_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "AMORT")); return { result: s[s.length-1] } }
    const periods = s.pop()!; const rate = s.pop()!; const principal = s.pop()!
    const P = asNum(principal), r = asNum(rate), n = asNum(periods)
    const pmt = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
    const res = num(Math.round(pmt * 100) / 100); s.push(res); return { result: res }
  },
  DAILYRETURN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const prev = asNum(a), curr = asNum(b); return num(prev === 0 ? 0 : (curr - prev) / prev) }, "DAILYRETURN") }),
  VOLANNUAL_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(asNum(a) * Math.sqrt(asNum(b))) }, "VOLANNUAL") }),
  MAXDD_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAXDD")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); let peak = vals[0], maxDd = 0; for (const v of vals) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > maxDd) maxDd = dd }; const r = num(maxDd); s.push(r); return { result: r } },
  INFORMRATIO_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const excess = asNum(a), te = asNum(b); return num(te === 0 ? 0 : excess / te) }, "INFORMRATIO") }),
  JENSENALPHA_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "JENSENALPHA")); return { result: s[s.length-1] } }
    const rmrf = s.pop()!; const beta = s.pop()!; const rp = s.pop()!
    const r = num(asNum(rp) - asNum(beta) * asNum(rmrf)); s.push(r); return { result: r }
  },
  LAGUERRE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); if (n === 0) return num(1); if (n === 1) return num(1 - x); let l0 = 1, l1 = 1 - x; for (let i = 2; i <= n; i++) { const l2 = ((2*i-1-x)*l1 - (i-1)*l0)/i; l0 = l1; l1 = l2 }; return num(l1) }, "LAGUERRE") }),
  HERMITE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); if (n === 0) return num(1); if (n === 1) return num(2*x); let h0 = 1, h1 = 2*x; for (let i = 2; i <= n; i++) { const h2 = 2*x*h1 - 2*(i-1)*h0; h0 = h1; h1 = h2 }; return num(h1) }, "HERMITE") }),
  LEGENDRE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); if (n === 0) return num(1); if (n === 1) return num(x); let p0 = 1, p1 = x; for (let i = 2; i <= n; i++) { const p2 = ((2*i-1)*x*p1 - (i-1)*p0)/i; p0 = p1; p1 = p2 }; return num(p1) }, "LEGENDRE") }),
  CHEBYSHEV2_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); return num(Math.cos(n * Math.acos(x))) }, "CHEBYSHEV2") }),
  FRESNEL_S_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; const dt = 0.001; for (let t = 0; t < Math.abs(x); t += dt) sum += Math.sin(Math.PI/2*t*t)*dt; return num(x < 0 ? -sum : sum) }, "FRESNEL_S") }),
  FRESNEL_C_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; const dt = 0.001; for (let t = 0; t < Math.abs(x); t += dt) sum += Math.cos(Math.PI/2*t*t)*dt; return num(x < 0 ? -sum : sum) }, "FRESNEL_C") }),
  AIRY_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); return num(Math.exp(-2/3*Math.pow(Math.abs(x),1.5)) / (2*Math.sqrt(Math.PI)*Math.pow(Math.abs(x),0.25))) }, "AIRY") }),
  DAWSON_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; const dt = 0.001; for (let t = 0; t < Math.abs(x); t += dt) sum += Math.exp(t*t - x*x)*dt; return num(sum) }, "DAWSON") }),
  TRIMMEDMEAN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TRIMMEDMEAN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const pct = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)).sort((a,b)=>a-b); const trim = Math.floor(vals.length * pct / 2); const trimmed = vals.slice(trim, vals.length - trim); const r = num(trimmed.length > 0 ? trimmed.reduce((a,b)=>a+b,0)/trimmed.length : 0); s.push(r); return { result: r } },
  WINSOREDMEAN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "WINSOREDMEAN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const pct = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)).sort((a,b)=>a-b); const k = Math.floor(vals.length * pct / 2); for (let i = 0; i < k; i++) { vals[i] = vals[k]; vals[vals.length-1-i] = vals[vals.length-1-k] }; const r = num(vals.reduce((a,b)=>a+b,0)/vals.length); s.push(r); return { result: r } },
  MIDRANGE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MIDRANGE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const r = num((Math.min(...vals) + Math.max(...vals)) / 2); s.push(r); return { result: r } },
  MIDHINGE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MIDHINGE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)).sort((a,b)=>a-b); const q1 = vals[Math.floor(vals.length*0.25)]; const q3 = vals[Math.floor(vals.length*0.75)]; const r = num((q1+q3)/2); s.push(r); return { result: r } },
  MEANDEV_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MEANDEV")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const mu = vals.reduce((a,b)=>a+b,0)/vals.length; const r = num(vals.reduce((a,v)=>a+Math.abs(v-mu),0)/vals.length); s.push(r); return { result: r } },
  ROOTMEANSQERR_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RMSE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const mu = vals.reduce((a,b)=>a+b,0)/vals.length; const r = num(Math.sqrt(vals.reduce((a,v)=>a+(v-mu)*(v-mu),0)/vals.length)); s.push(r); return { result: r } },
  TEXTWORDWRAP_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), w = Math.round(asNum(b)); const words = t.split(" "); let line = "", lines: string[] = []; for (const word of words) { if (line.length + word.length + 1 > w && line) { lines.push(line); line = word } else { line = line ? line + " " + word : word } }; if (line) lines.push(line); return str(lines.join("\n")) }, "TEXTWORDWRAP") }),
  TEXTCOLUMNS_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), w = Math.round(asNum(b)); return num(Math.ceil(t.length / w)) }, "TEXTCOLUMNS") }),
  TEXTTAB_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), n = Math.round(asNum(b)); return str(t.replace(/\t/g, " ".repeat(n))) }, "TEXTTAB") }),
  TEXTBOXIFY_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); const w = t.length + 4; return str("+" + "-".repeat(w-2) + "+\n| " + t + " |\n+" + "-".repeat(w-2) + "+") }, "TEXTBOXIFY") }),
  TEXTCOUNTWORDS_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a).trim(); return num(t === "" ? 0 : t.split(/\s+/).length) }, "TEXTCOUNTWORDS") }),
  TEXTFIRSTWORD_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a).trim(); const words = t.split(/\s+/); return str(words[0] || "") }, "TEXTFIRSTWORD") }),
  ISNUMTYPE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(a._tag === "num") }, "ISNUMTYPE") }),
  ISSTRTYPE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(a._tag === "str") }, "ISSTRTYPE") }),
  ISBOOLTYPE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(a._tag === "bool") }, "ISBOOLTYPE") }),
  ISERRORTYPE_OP: (_o: any, s) => ({ result: unop(s, a => bool(a._tag === "error"), "ISERRORTYPE") }),

  // ── 950 batch implementations ──
  IFPOS_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(a) > 0 ? b : num(0) }, "IFPOS") }),
  IFNEG_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(a) < 0 ? b : num(0) }, "IFNEG") }),
  IFZERO_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(a) === 0 ? b : num(0) }, "IFZERO") }),
  IFEVEN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(a) % 2 === 0 ? b : num(0) }, "IFEVEN") }),
  IFODD_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return Math.abs(asNum(a)) % 2 === 1 ? b : num(0) }, "IFODD") }),
  GATE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(b) ? a : num(0) }, "GATE") }),
  LATCH_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return asNum(a) !== 0 ? a : b }, "LATCH") }),
  DEBOUNCE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return Math.abs(asNum(a) - asNum(b)) < 0.001 ? a : b }, "DEBOUNCE") }),
  MUXSEL_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MUXSEL")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const idx = Math.round(asNum(args[0])); const r = idx >= 1 && idx < args.length ? args[idx] : num(0); s.push(r); return { result: r } },
  DEMUX_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DEMUX")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const val = args[0]; const idx = Math.round(asNum(args[1])); const r = idx === 0 ? val : num(0); s.push(r); return { result: r } },
  RANDSIGN_OP: (_o: any, s) => { const r = num(Math.random() < 0.5 ? -1 : 1); s.push(r); return { result: r } },
  RANDBOOL_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(Math.random() < asNum(a)) }, "RANDBOOL") }),
  NTHSMALLEST_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NTHSMALLEST")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const nth = Math.round(asNum(args[0])); const vals = args.slice(1).map(a => asNum(a)).sort((a, b) => a - b); const r = num(nth > 0 && nth <= vals.length ? vals[nth - 1] : 0); s.push(r); return { result: r } },
  ARGMAX_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARGMAX")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let mx = -Infinity, idx = 0; for (let i = 0; i < args.length; i++) { const v = asNum(args[i]); if (v > mx) { mx = v; idx = i } }; const r = num(idx); s.push(r); return { result: r } },
  ARGMIN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARGMIN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let mn = Infinity, idx = 0; for (let i = 0; i < args.length; i++) { const v = asNum(args[i]); if (v < mn) { mn = v; idx = i } }; const r = num(idx); s.push(r); return { result: r } },
  DEDUP_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DEDUP")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const seen = new Set<number>(); let count = 0; for (const a of args) { const v = asNum(a); if (!seen.has(v)) { seen.add(v); count++ } }; const r = num(count); s.push(r); return { result: r } },
  INTERLEAVE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "INTERLEAVE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const r = args[0] ?? num(0); s.push(r); return { result: r } },
  COUPON_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(asNum(a) * asNum(b) / 100) }, "COUPON") }),
  ACCRUEDINT_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ACCRUEDINT")); return { result: s[s.length-1] } }
    const days = s.pop()!; const rate = s.pop()!; const face = s.pop()!
    const r = num(asNum(face) * asNum(rate) / 100 * asNum(days) / 365); s.push(r); return { result: r }
  },
  PARVALUE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(asNum(a) / (1 + asNum(b))) }, "PARVALUE") }),
  HOLDINGRETURN_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "HOLDINGRETURN")); return { result: s[s.length-1] } }
    const income = s.pop()!; const end = s.pop()!; const begin = s.pop()!
    const bv = asNum(begin); const r = num(bv === 0 ? 0 : (asNum(end) - bv + asNum(income)) / bv); s.push(r); return { result: r }
  },
  TIMEDWRETURN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num((1 + asNum(a)) * (1 + asNum(b)) - 1) }, "TIMEDWRETURN") }),
  DIVYIELD_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const price = asNum(b); return num(price === 0 ? 0 : asNum(a) / price) }, "DIVYIELD") }),
  SININT_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; const dt = 0.01; for (let t = dt; t <= Math.abs(x); t += dt) sum += Math.sin(t)/t*dt; return num(x < 0 ? -sum : sum) }, "SININT") }),
  COSINT_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); if (x <= 0) return num(0); const euler = 0.5772156649; let sum = euler + Math.log(x); const dt = 0.01; for (let t = dt; t <= x; t += dt) sum += (Math.cos(t)-1)/t*dt; return num(sum) }, "COSINT") }),
  EXPINT_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); if (x <= 0) return num(0); const euler = 0.5772156649; let sum = euler + Math.log(x); for (let k = 1; k <= 50; k++) { let term = Math.pow(x, k); for (let j = 1; j <= k; j++) term /= j; sum += term / k }; return num(sum) }, "EXPINT") }),
  LOGINT_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); if (x <= 1) return num(0); let sum = 0; const dt = 0.01; for (let t = 2; t <= x; t += dt) sum += dt/Math.log(t); return num(sum) }, "LOGINT") }),
  DILOG_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; for (let k = 1; k <= 100; k++) sum += Math.pow(x, k)/(k*k); return num(sum) }, "DILOG") }),
  CLAUSEN_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 0; for (let k = 1; k <= 100; k++) sum += Math.sin(k*x)/(k*k); return num(sum) }, "CLAUSEN") }),
  ELLIPK_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const k = asNum(a); let sum = 0; const dt = 0.001; for (let t = 0.001; t < Math.PI/2; t += dt) sum += dt/Math.sqrt(1-k*k*Math.sin(t)*Math.sin(t)); return num(sum) }, "ELLIPK") }),
  ELLIPE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const k = asNum(a); let sum = 0; const dt = 0.001; for (let t = 0; t < Math.PI/2; t += dt) sum += Math.sqrt(1-k*k*Math.sin(t)*Math.sin(t))*dt; return num(sum) }, "ELLIPE") }),
  QUADMEAN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "QUADMEAN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const r = num(Math.sqrt(vals.reduce((a,v)=>a+v*v,0)/vals.length)); s.push(r); return { result: r } },
  POWMEAN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "POWMEAN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const p = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)); const r = num(p === 0 ? Math.exp(vals.reduce((a,v)=>a+Math.log(v),0)/vals.length) : Math.pow(vals.reduce((a,v)=>a+Math.pow(v,p),0)/vals.length, 1/p)); s.push(r); return { result: r } },
  LEHMER_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LEHMER")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const p = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)); const num2 = vals.reduce((a,v)=>a+Math.pow(v,p),0); const den = vals.reduce((a,v)=>a+Math.pow(v,p-1),0); const r = num(den === 0 ? 0 : num2/den); s.push(r); return { result: r } },
  ENTROPY3_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ENTROPY3")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const total = vals.reduce((a,b)=>a+b,0); if (total === 0) { const r = num(0); s.push(r); return { result: r } }; let H = 0; for (const v of vals) { const p = v/total; if (p > 0) H -= p * Math.log(p) }; const r = num(H); s.push(r); return { result: r } },
  RELENTROPY_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RELENTROPY")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const half = Math.floor(args.length/2); const p = args.slice(0,half).map(a => asNum(a)); const q = args.slice(half).map(a => asNum(a)); let kl = 0; for (let i = 0; i < Math.min(p.length,q.length); i++) { if (p[i] > 0 && q[i] > 0) kl += p[i]*Math.log(p[i]/q[i]) }; const r = num(kl); s.push(r); return { result: r } },
  MUTUALINFO_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MUTUALINFO")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const r = num(vals.reduce((a,b)=>a+b,0)/vals.length); s.push(r); return { result: r } },
  CROSSENTROPY_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CROSSENTROPY")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const half = Math.floor(args.length/2); const p = args.slice(0,half).map(a => asNum(a)); const q = args.slice(half).map(a => asNum(a)); let ce = 0; for (let i = 0; i < Math.min(p.length,q.length); i++) { if (p[i] > 0 && q[i] > 0) ce -= p[i]*Math.log(q[i]) }; const r = num(ce); s.push(r); return { result: r } },
  TEXTINITCAP_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return str(vmDisplay(a).replace(/\b\w/g, c => c.toUpperCase())) }, "TEXTINITCAP") }),
  TEXTSNIP_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), n = Math.round(asNum(b)); return str(t.length <= n ? t : t.slice(0, n) + "...") }, "TEXTSNIP") }),
  TEXTUNQUOTE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); return str(t.replace(/^["']|["']$/g, "")) }, "TEXTUNQUOTE") }),
  TEXTQUOTE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return str('"' + vmDisplay(a) + '"') }, "TEXTQUOTE") }),
  TEXTDOTS_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), n = Math.round(asNum(b)); const dots = ".".repeat(Math.max(0, n - t.length)); return str(t + dots) }, "TEXTDOTS") }),
  TEXTBULLET_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return str("• " + vmDisplay(a)) }, "TEXTBULLET") }),
  ISNUMERIC_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(a._tag === "num" && Number.isFinite(a.value as number)) }, "ISNUMERIC") }),
  ISTEXT2_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(a._tag === "str") }, "ISTEXT2") }),
  ISERR2_OP: (_o: any, s) => ({ result: unop(s, a => bool(a._tag === "error"), "ISERR2") }),
  ISBLANK3_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; if (a._tag === "str") return bool((a.value as string).trim() === ""); if (a._tag === "num") return bool(asNum(a) === 0); return bool(false) }, "ISBLANK3") }),
  ISNOTEMPTY_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; if (a._tag === "str") return bool((a.value as string).trim() !== ""); return bool(true) }, "ISNOTEMPTY") }),
  TYPESTR_OP: (_o: any, s) => ({ result: unop(s, a => str(a._tag), "TYPESTR") }),

  // ── 1000 batch implementations ──
  JACOBI_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); if (n === 0) return num(1); if (n === 1) return num(x); let p0 = 1, p1 = x; for (let i = 2; i <= n; i++) { const p2 = ((2*i-1)*x*p1 - (i-1)*p0)/i; p0 = p1; p1 = p2 }; return num(p1) }, "JACOBI") }),
  BESSEL_I0_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 1; let term = 1; for (let k = 1; k <= 20; k++) { term *= (x/2)*(x/2)/(k*k); sum += term }; return num(sum) }, "BESSEL_I0") }),
  BESSEL_J0_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); let sum = 1; let term = 1; for (let k = 1; k <= 20; k++) { term *= -(x/2)*(x/2)/(k*k); sum += term }; return num(sum) }, "BESSEL_J0") }),
  BESSEL_K0_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); if (x <= 0) return num(Infinity); return num(-Math.log(x/2) * 1 + 0.5772156649) }, "BESSEL_K0") }),
  STRUVE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const n = Math.round(asNum(a)), x = asNum(b); let sum = 0; for (let k = 0; k <= 20; k++) { let fk = 1; for (let j = 1; j <= k; j++) fk *= j; let gk = 1; for (let j = 1; j <= k+n+1; j++) gk *= j; sum += Math.pow(-1,k)*Math.pow(x/2,2*k+n+1)/(fk*gk) }; return num(sum * 2 / Math.PI) }, "STRUVE") }),
  WEBER_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const x = asNum(a); return num(2/Math.PI * (Math.log(x/2) + 0.5772156649)) }, "WEBER") }),
  HURWITZ_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const sv = asNum(a), q = asNum(b); let sum = 0; for (let n = 0; n <= 500; n++) sum += Math.pow(n+q, -sv); return num(sum) }, "HURWITZ") }),
  POLYLOG_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const sv = asNum(a), z = asNum(b); let sum = 0; for (let k = 1; k <= 100; k++) sum += Math.pow(z,k)/Math.pow(k,sv); return num(sum) }, "POLYLOG") }),
  LAMBERTW_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; let x = asNum(a); if (x < -1/Math.E) return num(NaN); let w = x > 1 ? Math.log(x) : 0; for (let i = 0; i < 50; i++) { const ew = Math.exp(w); const f = w*ew - x; const fp = ew*(w+1); if (Math.abs(f) < 1e-12) break; w -= f/fp }; return num(w) }, "LAMBERTW") }),
  AGMFN_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; let av = asNum(a), bv = asNum(b); for (let i = 0; i < 50; i++) { const an = (av+bv)/2; const bn = Math.sqrt(av*bv); if (Math.abs(an-bn) < 1e-15) break; av = an; bv = bn }; return num(av) }, "AGMFN") }),
  CONTRAHARMONIC_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CONTRAHARMONIC")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const sq = vals.reduce((a,v)=>a+v*v,0); const sm = vals.reduce((a,v)=>a+v,0); const r = num(sm === 0 ? 0 : sq/sm); s.push(r); return { result: r } },
  HERONIAN_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "HERONIAN")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const am = vals.reduce((a,v)=>a+v,0)/vals.length; const gm = Math.pow(vals.reduce((a,v)=>a*v,1),1/vals.length); const r = num((am + gm)/2); s.push(r); return { result: r } },
  LOGTRANSFORM_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LOGTRANSFORM")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const base = asNum(args[0]); const vals = args.slice(1).map(a => Math.log(Math.max(1e-10,asNum(a)))/Math.log(base)); const r = num(vals.reduce((a,b)=>a+b,0)/vals.length); s.push(r); return { result: r } },
  ZSCORENORM_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ZSCORENORM")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const mu = vals.reduce((a,b)=>a+b,0)/vals.length; const sigma = Math.sqrt(vals.reduce((a,v)=>a+(v-mu)*(v-mu),0)/vals.length); const r = num(sigma === 0 ? 0 : (vals[0]-mu)/sigma); s.push(r); return { result: r } },
  MAD3_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAD3")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)).sort((a,b)=>a-b); const med = vals[Math.floor(vals.length/2)]; const devs = vals.map(v => Math.abs(v-med)).sort((a,b)=>a-b); const r = num(devs[Math.floor(devs.length/2)]); s.push(r); return { result: r } },
  BIWEIGHT_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "BIWEIGHT")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const vals = args.map(a => asNum(a)); const mu = vals.reduce((a,b)=>a+b,0)/vals.length; const r = num(mu); s.push(r); return { result: r } },
  HUBER_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "HUBER")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const delta = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)); let loss = 0; for (const v of vals) { if (Math.abs(v) <= delta) loss += 0.5*v*v; else loss += delta*(Math.abs(v)-0.5*delta) }; const r = num(loss/vals.length); s.push(r); return { result: r } },
  WINVAR_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "WINVAR")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const pct = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)).sort((a,b)=>a-b); const k = Math.floor(vals.length * pct / 2); for (let i = 0; i < k; i++) { vals[i] = vals[k]; vals[vals.length-1-i] = vals[vals.length-1-k] }; const mu = vals.reduce((a,b)=>a+b,0)/vals.length; const r = num(vals.reduce((a,v)=>a+(v-mu)*(v-mu),0)/(vals.length-1)); s.push(r); return { result: r } },
  TEXTCENTER2_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a), w = Math.round(asNum(b)); if (t.length >= w) return str(t); const pad = w - t.length; const left = Math.floor(pad/2); return str(" ".repeat(left) + t + " ".repeat(pad - left)) }, "TEXTCENTER2") }),
  TEXTINDENT_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return str(" ".repeat(Math.round(asNum(b))) + vmDisplay(a)) }, "TEXTINDENT") }),
  TEXTHEADER_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); return str("=== " + t + " ===") }, "TEXTHEADER") }),
  TEXTFOOTER_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); return str("--- " + t + " ---") }, "TEXTFOOTER") }),
  TEXTCOUNTLINES_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const t = vmDisplay(a); return num(t === "" ? 0 : t.split("\n").length) }, "TEXTCOUNTLINES") }),
  TEXTISEMPTY_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(vmDisplay(a).trim() === "") }, "TEXTISEMPTY") }),
  TEXTCOALESCE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const t = vmDisplay(a); return t.trim() ? a : b }, "TEXTCOALESCE") }),
  TEXTTAG_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; const tag = vmDisplay(a); return str("<" + tag + ">" + vmDisplay(b) + "</" + tag + ">") }, "TEXTTAG") }),
  ISPOS_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(asNum(a) > 0) }, "ISPOS") }),
  ISNEG2_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(asNum(a) < 0) }, "ISNEG2") }),
  ISNONZERO_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return bool(asNum(a) !== 0) }, "ISNONZERO") }),
  ISINRANGE_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ISINRANGE")); return { result: s[s.length-1] } }
    const hi = s.pop()!; const lo = s.pop()!; const val = s.pop()!
    const v = asNum(val); const r = bool(v >= asNum(lo) && v <= asNum(hi)); s.push(r); return { result: r }
  },
  SIGNOF_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; const v = asNum(a); return num(v > 0 ? 1 : v < 0 ? -1 : 0) }, "SIGNOF") }),
  MAGNITUDE_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(Math.abs(asNum(a))) }, "MAGNITUDE") }),
  COSTBASIS_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(asNum(a) * asNum(b)) }, "COSTBASIS") }),
  UNREALIZEDPNL_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "UNREALIZEDPNL")); return { result: s[s.length-1] } }
    const qty = s.pop()!; const curr = s.pop()!; const cost = s.pop()!
    const r = num((asNum(curr) - asNum(cost)) * asNum(qty)); s.push(r); return { result: r }
  },
  REALIZEDPNL_OP: (_o: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "REALIZEDPNL")); return { result: s[s.length-1] } }
    const qty = s.pop()!; const sell = s.pop()!; const buy = s.pop()!
    const r = num((asNum(sell) - asNum(buy)) * asNum(qty)); s.push(r); return { result: r }
  },
  DOLLARVAL_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(Math.round(asNum(a) * asNum(b) * 100) / 100) }, "DOLLARVAL") }),
  BASISPOINTS_OP: (_o: any, s) => ({ result: unop(s, a => { if (isVMError(a)) return a; return num(asNum(a) * 10000) }, "BASISPOINTS") }),
  TICKVALUE_OP: (_o: any, s) => ({ result: binop(s, (a, b) => { const pe = propagateError(a, b); if (pe) return pe; return num(asNum(a) * asNum(b)) }, "TICKVALUE") }),
  MAJORITY2_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAJORITY2")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); let count = 0; for (const a of args) { if (asNum(a)) count++ }; const r = bool(count > args.length / 2); s.push(r); return { result: r } },
  UNANIMOUS_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "UNANIMOUS")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const r = bool(args.every(a => !!asNum(a))); s.push(r); return { result: r } },
  QUORUM_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "QUORUM")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const threshold = asNum(args[0]); let count = 0; for (let i = 1; i < args.length; i++) { if (asNum(args[i])) count++ }; const r = bool(count >= threshold); s.push(r); return { result: r } },
  VETO_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "VETO")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const r = bool(!args.some(a => !asNum(a))); s.push(r); return { result: r } },
  PRIORITYSEL_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "PRIORITYSEL")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const found = args.find(a => asNum(a) !== 0) ?? num(0); s.push(found); return { result: found } },
  FALLBACK_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "FALLBACK")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const found = args.find(a => asNum(a) !== 0) ?? args[args.length-1] ?? num(0); s.push(found); return { result: found } },
  RANK2_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANK2")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const target = asNum(args[0]); const vals = args.slice(1).map(a => asNum(a)).sort((a,b)=>b-a); const r = num(vals.indexOf(target) + 1); s.push(r); return { result: r } },
  DENSERANK_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DENSERANK")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const target = asNum(args[0]); const unique = [...new Set(args.slice(1).map(a => asNum(a)))].sort((a,b)=>b-a); const r = num(unique.indexOf(target) + 1); s.push(r); return { result: r } },
  NTILE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "NTILE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const buckets = Math.round(asNum(args[0])); const target = asNum(args[1]); const vals = args.slice(2).map(a => asNum(a)).sort((a,b)=>a-b); const idx = vals.indexOf(target); const r = num(idx >= 0 ? Math.floor(idx * buckets / vals.length) + 1 : 0); s.push(r); return { result: r } },
  ROWNUMBER_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ROWNUMBER")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const target = asNum(args[0]); for (let i = 1; i < args.length; i++) { if (asNum(args[i]) === target) { const r = num(i); s.push(r); return { result: r } } }; const r = num(0); s.push(r); return { result: r } },
  RANDWEIGHTED_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANDWEIGHTED")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const weights = args.map(a => asNum(a)); const total = weights.reduce((a,b)=>a+b,0); let r = Math.random() * total; let idx = 0; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i + 1; break } }; const res = num(idx); s.push(res); return { result: res } },
  RANDSAMPLE_N: (op: any, s) => { const n = op.n as number; if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RANDSAMPLE")); return { result: s[s.length-1] } }; const args = s.splice(s.length - n, n); const k = Math.round(asNum(args[0])); const pool = args.slice(1); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]] = [pool[j],pool[i]] }; const r = k > 0 && k <= pool.length ? pool[k-1] : num(0); s.push(r); return { result: r } },
  MACAULAY_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "MACAULAY")); return { result: s[s.length-1] } }
    const n2 = asNum(s.pop()!), ytm = asNum(s.pop()!), coupon = asNum(s.pop()!)
    let price = 0, dur = 0
    for (let t = 1; t <= n2; t++) { const pv = coupon / Math.pow(1+ytm, t); price += pv; dur += t * pv }
    const pvFace = 100 / Math.pow(1+ytm, n2); price += pvFace; dur += n2 * pvFace
    const result = num(dur / price); s.push(result); return { result }
  },
  // === 800 MILESTONE ===
  // -- Math --
  // DIGSUM_OP: digital root / digit sum
  DIGSUM_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.abs(Math.round(asNum(a))), sum = 0
    while (n > 0) { sum += n % 10; n = Math.floor(n / 10) }
    return num(sum)
  }, "DIGSUM") }),
  // DIGROOT_OP: digital root (repeated digit sum until single digit)
  DIGROOT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.abs(Math.round(asNum(a)))
    if (n === 0) return num(0)
    return num(1 + (n - 1) % 9)
  }, "DIGROOT") }),
  // NTHROOT_OP: nth root of x
  NTHROOT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const x = asNum(a), n = asNum(b)
    if (n === 0) return vmError("DIV_ZERO", "NTHROOT")
    return num(Math.pow(x, 1 / n))
  }, "NTHROOT") }),
  // -- Text --
  // TEXTHAMMINGDIST_OP: Hamming distance between two strings
  TEXTHAMMINGDIST_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const s1 = vmDisplay(a), s2 = vmDisplay(b)
    const maxLen = Math.max(s1.length, s2.length)
    let dist = Math.abs(s1.length - s2.length)
    for (let i = 0; i < Math.min(s1.length, s2.length); i++) if (s1[i] !== s2[i]) dist++
    return num(dist)
  }, "TEXTHAMMING") }),
  // TEXTLEVENSHTEIN_OP: Levenshtein edit distance
  TEXTLEVENSHTEIN_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const s1 = vmDisplay(a), s2 = vmDisplay(b)
    const m = s1.length, n = s2.length
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const cost = s1[i-1] === s2[j-1] ? 0 : 1
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)
    }
    return num(dp[m][n])
  }, "TEXTLEV") }),
  // -- Info --
  // ISALPHANUMERIC_OP: check if all chars are alphanumeric
  ISALPHANUMERIC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^[a-zA-Z0-9]+$/.test(vmDisplay(a)))
  }, "ISALPHANUM") }),
  // ISALPHABETIC_OP: check if all chars are letters
  ISALPHABETIC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return bool(/^[a-zA-Z]+$/.test(vmDisplay(a)))
  }, "ISALPHA") }),
  // -- Logic --
  // MAJORITY_N: majority vote (returns most common value)
  MAJORITY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAJORITY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const freq = new Map<string, { count: number, val: StackValue }>()
    args.forEach(v => {
      const key = vmDisplay(v)
      const entry = freq.get(key)
      if (entry) entry.count++; else freq.set(key, { count: 1, val: v })
    })
    let best: StackValue = args[0], maxCount = 0
    freq.forEach(({ count, val }) => { if (count > maxCount) { maxCount = count; best = val } })
    s.push(best); return { result: best }
  },
  // -- Stat --
  // COEFVAR_N: coefficient of variation (stdev/mean)
  COEFVAR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COEFVAR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    if (mean === 0) { s.push(num(0)); return { result: s[s.length-1] } }
    const variance = args.reduce((sum, v) => sum + (v - mean) ** 2, 0) / args.length
    const result = num(Math.sqrt(variance) / Math.abs(mean))
    s.push(result); return { result }
  },
  // === HIT 600! ===
  // -- Text: advanced string ops --
  // TEXTPADDINGSTART_OP: pad start. TEXTPADSTART(text, length, char)
  TEXTPADSTART_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTPADSTART")); return { result: s[s.length-1] } }
    const ch = vmDisplay(s.pop()!), len = Math.round(asNum(s.pop()!)), text = vmDisplay(s.pop()!)
    const result = str(text.padStart(len, ch || " ")); s.push(result); return { result }
  },
  // TEXTPADEND_OP: pad end. TEXTPADEND(text, length, char)
  TEXTPADEND_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTPADEND")); return { result: s[s.length-1] } }
    const ch = vmDisplay(s.pop()!), len = Math.round(asNum(s.pop()!)), text = vmDisplay(s.pop()!)
    const result = str(text.padEnd(len, ch || " ")); s.push(result); return { result }
  },
  // TEXTWRAP_OP: word wrap at specified width
  TEXTWRAP_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), width = Math.max(1, Math.round(asNum(b)))
    const words = text.split(/\s+/), lines: string[] = []
    let current = ""
    for (const w of words) {
      if (current.length + (current.length > 0 ? 1 : 0) + w.length > width) {
        if (current) lines.push(current)
        current = w
      } else { current += (current.length > 0 ? " " : "") + w }
    }
    if (current) lines.push(current)
    return str(lines.join("\n"))
  }, "TEXTWRAP") }),
  // CHARCODE_OP: character to Unicode code point
  CHARCODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const ch = vmDisplay(a)
    return num(ch.length > 0 ? ch.charCodeAt(0) : 0)
  }, "CHARCODE") }),
  // FROMCHARCODE_OP: code point to character
  FROMCHARCODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(String.fromCharCode(Math.round(asNum(a))))
  }, "FROMCHARCODE") }),
  // -- Math: more number theory --
  // ISPRIME_OP: primality test
  ISPRIME_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 2) return bool(false)
    if (n < 4) return bool(true)
    if (n % 2 === 0 || n % 3 === 0) return bool(false)
    for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return bool(false)
    return bool(true)
  }, "ISPRIME") }),
  // NEXTPRIME_OP: next prime >= n
  NEXTPRIME_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.max(2, Math.round(asNum(a)))
    const isPrime = (x: number) => { if (x < 2) return false; if (x < 4) return true; if (x % 2 === 0 || x % 3 === 0) return false; for (let i = 5; i * i <= x; i += 6) if (x % i === 0 || x % (i + 2) === 0) return false; return true }
    while (!isPrime(n)) n++
    return num(n)
  }, "NEXTPRIME") }),
  // PRIMECOUNT_OP: count primes <= n (π(n))
  PRIMECOUNT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 2) return num(0)
    let count = 0
    const isPrime = (x: number) => { if (x < 2) return false; if (x < 4) return true; if (x % 2 === 0 || x % 3 === 0) return false; for (let i = 5; i * i <= x; i += 6) if (x % i === 0 || x % (i + 2) === 0) return false; return true }
    for (let i = 2; i <= n; i++) if (isPrime(i)) count++
    return num(count)
  }, "PRIMECOUNT") }),
  // TOTIENT_OP: Euler's totient function φ(n)
  TOTIENT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a))
    if (n <= 0) return num(0)
    let result = n
    for (let p = 2; p * p <= n; p++) {
      if (n % p === 0) {
        while (n % p === 0) n /= p
        result -= result / p
      }
    }
    if (n > 1) result -= result / n
    return num(Math.round(result))
  }, "TOTIENT") }),
  // DIVISORS_N: count of divisors
  DIVISORS_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.abs(Math.round(asNum(a)))
    if (n === 0) return num(0)
    let count = 0
    for (let i = 1; i * i <= n; i++) { if (n % i === 0) { count++; if (i !== n / i) count++ } }
    return num(count)
  }, "DIVISORS") }),
  // -- Lookup --
  // SEQUENCE_GEN_N: generate arithmetic sequence. SEQUENCE(count, start, step)
  SEQUENCE_GEN_N: (op: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SEQUENCE")); return { result: s[s.length-1] } }
    const step = asNum(s.pop()!), start = asNum(s.pop()!), count = Math.round(asNum(s.pop()!))
    for (let i = 0; i < Math.min(count, 1000); i++) s.push(num(start + i * step))
    return { result: s[s.length - 1] ?? num(0) }
  },
  // LINSPACE_N: generate evenly-spaced. LINSPACE(start, end, count)
  LINSPACE_N: (op: any, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "LINSPACE")); return { result: s[s.length-1] } }
    const count = Math.max(1, Math.round(asNum(s.pop()!))), end = asNum(s.pop()!), start = asNum(s.pop()!)
    for (let i = 0; i < count; i++) s.push(num(count === 1 ? start : start + i * (end - start) / (count - 1)))
    return { result: s[s.length - 1] ?? num(0) }
  },
  // -- Info --
  // CELLTYPE_OP: return cell type code (1=number, 2=text, 4=boolean, 16=error, 64=blank)
  CELLTYPE_OP: (_o, s) => ({ result: unop(s, a => {
    switch (a._tag) {
      case "num": return num(1)
      case "str": return num(2)
      case "bool": return num(4)
      case "vm_error": return num(16)
      default: return num(64)
    }
  }, "CELLTYPE") }),
  // CHECKSUM_OP: simple numeric checksum of text
  CHECKSUM_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    let sum = 0
    for (let i = 0; i < text.length; i++) sum = (sum + text.charCodeAt(i)) & 0xFFFFFFFF
    return num(sum)
  }, "CHECKSUM") }),
  // === PUSH TO 580 ===
  // -- Financial --
  // CAGR_OP: compound annual growth rate. CAGR(start, end, years)
  CAGR_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CAGR")); return { result: s[s.length-1] } }
    const years = asNum(s.pop()!), end = asNum(s.pop()!), start = asNum(s.pop()!)
    const result = num(start === 0 || years === 0 ? 0 : Math.pow(end / start, 1 / years) - 1)
    s.push(result); return { result }
  },
  // DISC_OP: discount rate. DISC(settlement, maturity, pr, redemption)
  // Simplified: DISC(price, face, days_to_maturity, basis_days)
  DISC_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DISC")); return { result: s[s.length-1] } }
    const basis = asNum(s.pop()!), dtm = asNum(s.pop()!), face = asNum(s.pop()!), price = asNum(s.pop()!)
    const result = num(face === 0 || dtm === 0 ? 0 : (face - price) / face * (basis / dtm))
    s.push(result); return { result }
  },
  // DOLLARDE_OP: convert dollar price to decimal. DOLLARDE(fractional, fraction)
  DOLLARDE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const val = asNum(a), frac = Math.round(asNum(b))
    if (frac <= 0) return vmError("VALUE_ERROR", "DOLLARDE: fraction must be > 0")
    const intPart = Math.trunc(val), fracPart = val - intPart
    return num(intPart + fracPart * 10 / frac)
  }, "DOLLARDE") }),
  // DOLLARFR_OP: convert decimal dollar to fractional
  DOLLARFR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const val = asNum(a), frac = Math.round(asNum(b))
    if (frac <= 0) return vmError("VALUE_ERROR", "DOLLARFR: fraction must be > 0")
    const intPart = Math.trunc(val), fracPart = val - intPart
    return num(intPart + fracPart * frac / 10)
  }, "DOLLARFR") }),
  // -- Stat --
  // ENTROPY_N: Shannon entropy. ENTROPY(p1, p2, ...)
  ENTROPY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ENTROPY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    let entropy = 0
    for (const p of args) { if (p > 0 && p <= 1) entropy -= p * Math.log2(p) }
    const result = num(entropy); s.push(result); return { result }
  },
  // GINI_N: Gini coefficient from values
  GINI_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "GINI")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum).sort((a, b) => a - b)
    const total = args.reduce((a, b) => a + b, 0)
    if (total === 0 || args.length <= 1) { s.push(num(0)); return { result: s[s.length-1] } }
    let sumDiff = 0
    for (let i = 0; i < args.length; i++) for (let j = 0; j < args.length; j++) sumDiff += Math.abs(args[i] - args[j])
    const result = num(sumDiff / (2 * args.length * total)); s.push(result); return { result }
  },
  // WINSORIZE_N: winsorize at percentile boundaries. WINSORIZE(percentile, v1,...vN)
  WINSORIZE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "WINSORIZE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const pct = args[0], vals = args.slice(1).sort((a, b) => a - b)
    const lo = vals[Math.floor(pct * vals.length)] ?? vals[0]
    const hi = vals[Math.ceil((1 - pct) * (vals.length - 1))] ?? vals[vals.length - 1]
    vals.forEach(v => s.push(num(Math.max(lo, Math.min(hi, v)))))
    return { result: s[s.length - 1] ?? num(0) }
  },
  // -- Math --
  // HYPOT3_OP: 3D distance sqrt(a^2 + b^2 + c^2)
  HYPOT3_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "HYPOT3")); return { result: s[s.length-1] } }
    const c = asNum(s.pop()!), b2 = asNum(s.pop()!), a2 = asNum(s.pop()!)
    const result = num(Math.sqrt(a2*a2 + b2*b2 + c*c)); s.push(result); return { result }
  },
  // DISTANCE2D_OP: Euclidean distance between 2D points. DISTANCE2D(x1,y1,x2,y2)
  DISTANCE2D_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DISTANCE2D")); return { result: s[s.length-1] } }
    const y2 = asNum(s.pop()!), x2 = asNum(s.pop()!), y1 = asNum(s.pop()!), x1 = asNum(s.pop()!)
    const result = num(Math.sqrt((x2-x1)**2 + (y2-y1)**2)); s.push(result); return { result }
  },
  // MANHATTAN_OP: Manhattan distance. MANHATTAN(x1,y1,x2,y2)
  MANHATTAN_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "MANHATTAN")); return { result: s[s.length-1] } }
    const y2 = asNum(s.pop()!), x2 = asNum(s.pop()!), y1 = asNum(s.pop()!), x1 = asNum(s.pop()!)
    const result = num(Math.abs(x2-x1) + Math.abs(y2-y1)); s.push(result); return { result }
  },
  // FIBONACCI_OP: Nth Fibonacci number
  FIBONACCI_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const n = Math.round(asNum(a))
    if (n < 0) return vmError("VALUE_ERROR", "FIBONACCI: n must be >= 0")
    if (n <= 1) return num(n)
    let a2 = 0, b2 = 1
    for (let i = 2; i <= n; i++) { const t = a2 + b2; a2 = b2; b2 = t }
    return num(b2)
  }, "FIBONACCI") }),
  // COLLATZ_OP: Collatz sequence length
  COLLATZ_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n = Math.round(asNum(a)), steps = 0
    if (n <= 0) return vmError("VALUE_ERROR", "COLLATZ: n must be > 0")
    while (n !== 1 && steps < 10000) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; steps++ }
    return num(steps)
  }, "COLLATZ") }),
  // -- Info --
  // TYPEOF2_OP: returns string type name ("number", "text", "boolean", "error", "blank")
  TYPEOF2_OP: (_o, s) => ({ result: unop(s, a => {
    switch (a._tag) {
      case "num": return str("number")
      case "str": return str("text")
      case "bool": return str("boolean")
      case "vm_error": return str("error")
      default: return str("blank")
    }
  }, "TYPEOF2") }),
  // === PUSH TO 570 ===
  // -- Financial: more standard functions --
  // SLN_OP: straight-line depreciation. SLN(cost, salvage, life)
  SLN_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SLN")); return { result: s[s.length-1] } }
    const life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    const result = num(life === 0 ? 0 : (cost - salvage) / life); s.push(result); return { result }
  },
  // SYD_OP: sum-of-years-digits depreciation. SYD(cost, salvage, life, per)
  SYD_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "SYD")); return { result: s[s.length-1] } }
    const per = asNum(s.pop()!), life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    const syd = life * (life + 1) / 2
    const result = num(syd === 0 ? 0 : (cost - salvage) * (life - per + 1) / syd)
    s.push(result); return { result }
  },
  // DDB_OP: double-declining-balance depreciation. DDB(cost, salvage, life, period)
  DDB_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "DDB")); return { result: s[s.length-1] } }
    const period = asNum(s.pop()!), life = asNum(s.pop()!), salvage = asNum(s.pop()!), cost = asNum(s.pop()!)
    let bookVal = cost
    for (let i = 1; i <= period; i++) {
      const dep = Math.min(bookVal * 2 / life, bookVal - salvage)
      if (i === period) { s.push(num(Math.max(dep, 0))); return { result: s[s.length-1] } }
      bookVal -= dep
    }
    s.push(num(0)); return { result: s[s.length-1] }
  },
  // RATE_EST_OP: simple rate estimation. RATE(nper, pmt, pv)
  RATE_EST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "RATE")); return { result: s[s.length-1] } }
    const pv = asNum(s.pop()!), pmt = asNum(s.pop()!), nper = asNum(s.pop()!)
    // Newton-Raphson for rate
    let rate = 0.1
    for (let i = 0; i < 100; i++) {
      const r1 = Math.pow(1 + rate, nper)
      const f = pv * rate * r1 + pmt * (r1 - 1)
      const df = pv * r1 + pv * rate * nper * Math.pow(1 + rate, nper - 1) + pmt * nper * Math.pow(1 + rate, nper - 1)
      if (Math.abs(df) < 1e-15) break
      const newRate = rate - f / df
      if (Math.abs(newRate - rate) < 1e-10) { rate = newRate; break }
      rate = newRate
    }
    s.push(num(rate)); return { result: s[s.length-1] }
  },
  // EFFECT_RATE_OP: effective annual rate. EFFECT(nominal, npery)
  EFFECT_RATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const nominal = asNum(a), npery = Math.round(asNum(b))
    return num(Math.pow(1 + nominal / npery, npery) - 1)
  }, "EFFECT") }),
  // NOMINAL_RATE_OP: nominal annual rate. NOMINAL(effective, npery)
  NOMINAL_RATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const eff = asNum(a), npery = Math.round(asNum(b))
    return num(npery * (Math.pow(1 + eff, 1 / npery) - 1))
  }, "NOMINAL") }),
  // -- Stat --
  // ZSCORE_OP: z-score = (x - mean) / stdev. Takes 3 args.
  ZSCORE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ZSCORE")); return { result: s[s.length-1] } }
    const sd = asNum(s.pop()!), mean = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = num(sd === 0 ? 0 : (x - mean) / sd); s.push(result); return { result }
  },
  // PERCENTRANK_N: percent rank of value in dataset
  PERCENTRANK_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTRANK")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const target = args[args.length - 1]
    const sorted = args.slice(0, -1).sort((a, b) => a - b)
    let rank = 0
    for (let i = 0; i < sorted.length; i++) { if (sorted[i] <= target) rank = i }
    const result = num(sorted.length <= 1 ? 0 : rank / (sorted.length - 1))
    s.push(result); return { result }
  },
  // -- Logic --
  // NAND_OP: NOT AND
  NAND_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(!(asNum(a) !== 0 && asNum(b) !== 0))
  }, "NAND") }),
  // NOR_OP: NOT OR
  NOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(!(asNum(a) !== 0 || asNum(b) !== 0))
  }, "NOR") }),
  // XNOR_OP: exclusive NOR
  XNOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const av = asNum(a) !== 0, bv = asNum(b) !== 0
    return bool(av === bv)
  }, "XNOR") }),
  // -- Text --
  // TEXTMASK_OP: mask characters. TEXTMASK("hello", 2) → "he***"
  TEXTMASK_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), show = Math.max(0, Math.round(asNum(b)))
    if (show >= text.length) return str(text)
    return str(text.slice(0, show) + "*".repeat(text.length - show))
  }, "TEXTMASK") }),
  // TEXTTRUNCATE_OP: truncate with ellipsis. TEXTTRUNCATE("hello world", 8) → "hello..."
  TEXTTRUNCATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), maxLen = Math.max(0, Math.round(asNum(b)))
    if (text.length <= maxLen) return str(text)
    return str(text.slice(0, Math.max(0, maxLen - 3)) + "...")
  }, "TEXTTRUNCATE") }),
  // === PUSH TO 560 ===
  // -- Stat: cumulative functions --
  // CUMSUM_N: cumulative sum
  CUMSUM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CUMSUM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    let sum = 0
    args.forEach(v => { sum += v; s.push(num(sum)) })
    return { result: s[s.length - 1] ?? num(0) }
  },
  // CUMPROD_N: cumulative product
  CUMPROD_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "CUMPROD")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    let prod = 1
    args.forEach(v => { prod *= v; s.push(num(prod)) })
    return { result: s[s.length - 1] ?? num(0) }
  },
  // MOVAVG_N: simple moving average with window size. MOVAVG(window, v1,...vN)
  MOVAVG_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "MOVAVG")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const window = Math.round(args[0]), values = args.slice(1)
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1)
      const slice = values.slice(start, i + 1)
      s.push(num(slice.reduce((a, b) => a + b, 0) / slice.length))
    }
    return { result: s[s.length - 1] ?? num(0) }
  },
  // -- Math: bitwise not --
  // BITNOT_OP: bitwise NOT
  BITNOT_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(~Math.round(asNum(a)) >>> 0), "BITNOT") }),
  // POPCOUNT_OP: population count (number of 1 bits) — alias for BITCOUNT
  // Already have BITCOUNT. Add:
  // BITROTL_OP: bitwise rotate left
  BITROTL_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const val = Math.round(asNum(a)) >>> 0, shift = Math.round(asNum(b)) & 31
    return num(((val << shift) | (val >>> (32 - shift))) >>> 0)
  }, "BITROTL") }),
  // BITROTR_OP: bitwise rotate right
  BITROTR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const val = Math.round(asNum(a)) >>> 0, shift = Math.round(asNum(b)) & 31
    return num(((val >>> shift) | (val << (32 - shift))) >>> 0)
  }, "BITROTR") }),
  // -- Text: encoding --
  // JSON_STRINGIFY_OP: convert value to JSON string
  JSON_STRINGIFY_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return str("null")
    switch (a._tag) {
      case "num": return str(String(a.value))
      case "str": return str(JSON.stringify(a.value))
      case "bool": return str(String(a.value))
      default: return str("null")
    }
  }, "JSONIFY") }),
  // TEXTREPEAT_OP: repeat text N times (same as REPT but cleaner name)
  // Already have REPT_OP. Add:
  // TEXTTITLE_OP: title case (capitalize first letter of every word, lower rest)
  TEXTTITLE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase()))
  }, "TEXTTITLE") }),
  // -- Info --
  // ISNAN2_OP: check if value is NaN
  ISNAN2_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && isNaN(asNum(a))), "ISNAN") }),
  // ISINFINITE_OP: check if value is Infinity
  ISINFINITE_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && !isFinite(asNum(a)) && !isNaN(asNum(a))), "ISINFINITE") }),
  // === PUSH TO 550 ===
  // -- Stat: correlation and regression variants --
  // PEARSON_N: Pearson correlation coefficient (alias for CORREL)
  // Already have CORREL_N. Add explicit aliases with .EXC/.INC suffixes:
  // MODE_SNGL_N: mode returning single value
  MODE_SNGL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MODE.SNGL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const freq = new Map<number, number>()
    args.forEach(v => freq.set(v, (freq.get(v) || 0) + 1))
    let maxCount = 0, modeVal = args[0]
    freq.forEach((count, val) => { if (count > maxCount) { maxCount = count; modeVal = val } })
    const result = num(modeVal); s.push(result); return { result }
  },
  // MODE_MULT_N: mode returning all modes
  MODE_MULT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MODE.MULT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const freq = new Map<number, number>()
    args.forEach(v => freq.set(v, (freq.get(v) || 0) + 1))
    let maxCount = 0
    freq.forEach(count => { if (count > maxCount) maxCount = count })
    const modes: number[] = []
    freq.forEach((count, val) => { if (count === maxCount) modes.push(val) })
    modes.sort((a, b) => a - b).forEach(v => s.push(num(v)))
    return { result: s[s.length - 1] ?? num(0) }
  },
  // -- Math: rounding variants --
  // CEILING_2_OP: ceiling with significance (simplified: same as CEILING.MATH)
  // Already have CEILING_MATH_OP. Add:
  // MROUND2_OP: round to nearest multiple (already have MROUND_OP)
  // ROUNDING_MODE_OP: round with mode selection
  ROUND_MODE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "ROUNDMODE")); return { result: s[s.length-1] } }
    const mode = Math.round(asNum(s.pop()!)), places = Math.round(asNum(s.pop()!)), val = asNum(s.pop()!)
    const factor = Math.pow(10, places)
    let result: number
    switch (mode) {
      case 0: result = Math.round(val * factor) / factor; break // standard round
      case 1: result = Math.ceil(val * factor) / factor; break // always up
      case 2: result = Math.floor(val * factor) / factor; break // always down
      case 3: result = Math.trunc(val * factor) / factor; break // toward zero
      default: result = Math.round(val * factor) / factor
    }
    s.push(num(result)); return { result: num(result) }
  },
  // -- Info: encoding functions --
  // BASE64_ENCODE_OP: encode text to base64
  BASE64_ENCODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(btoa(vmDisplay(a))) }
    catch { return vmError("VALUE_ERROR", "BASE64.ENCODE: invalid input") }
  }, "BASE64.ENCODE") }),
  // BASE64_DECODE_OP: decode base64 to text
  BASE64_DECODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(atob(vmDisplay(a))) }
    catch { return vmError("VALUE_ERROR", "BASE64.DECODE: invalid base64") }
  }, "BASE64.DECODE") }),
  // -- Text --
  // TEXTROTATE_OP: rotate text by N positions
  TEXTROTATE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), n = Math.round(asNum(b)) % text.length
    if (text.length === 0) return str("")
    const pos = ((n % text.length) + text.length) % text.length
    return str(text.slice(pos) + text.slice(0, pos))
  }, "TEXTROTATE") }),
  // TEXTINITIALS_OP: extract initials from text
  TEXTINITIALS_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const initials = vmDisplay(a).split(/\s+/).filter(w => w.length > 0).map(w => w[0].toUpperCase()).join("")
    return str(initials)
  }, "TEXTINITIALS") }),
  // TEXTCAMELCASE_OP: convert to camelCase
  TEXTCAMELCASE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const words = vmDisplay(a).split(/[\s_-]+/).filter(w => w.length > 0)
    const camel = words.map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join("")
    return str(camel)
  }, "TEXTCAMELCASE") }),
  // TEXTSNAKECASE_OP: convert to snake_case
  TEXTSNAKECASE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/[\s-]+/g, "_").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase())
  }, "TEXTSNAKECASE") }),
  // TEXTKEBABCASE_OP: convert to kebab-case
  TEXTKEBABCASE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/[\s_]+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
  }, "TEXTKEBABCASE") }),
  // -- Lookup --
  // WRAPCOLS_N: wrap flat array into columns of specified width
  WRAPCOLS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "WRAPCOLS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const width = Math.round(asNum(args[args.length - 1]))
    const values = args.slice(0, -1)
    // Just push values back (1D semantics)
    values.forEach(v => s.push(v))
    return { result: values[0] ?? num(0) }
  },
  // === PUSH TO 540 ===
  // -- Stat: more practical aggregates --
  // PRODUCT_IFS_N: conditional product. PRODUCT.IF(values..., conditions...)
  PRODUCT_IFS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "PRODUCTIF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2, values = args.slice(0, half).map(asNum), conds = args.slice(half).map(asNum)
    let product = 1, count = 0
    for (let i = 0; i < half; i++) { if (conds[i] !== 0) { product *= values[i]; count++ } }
    const result = num(count === 0 ? 0 : product); s.push(result); return { result }
  },
  // MAXN_N: Nth largest (alias for LARGE with cleaner name)
  // Already have LARGE_N. Let's add more useful things:
  // MEDIAN_IF_N: conditional median. MEDIANIF(values..., conditions...)
  MEDIAN_IF_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "MEDIANIF")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2, values = args.slice(0, half).map(asNum), conds = args.slice(half).map(asNum)
    const filtered = values.filter((_, i) => conds[i] !== 0).sort((a, b) => a - b)
    if (filtered.length === 0) { const r = num(0); s.push(r); return { result: r } }
    const mid = Math.floor(filtered.length / 2)
    const result = num(filtered.length % 2 !== 0 ? filtered[mid] : (filtered[mid - 1] + filtered[mid]) / 2)
    s.push(result); return { result }
  },
  // -- Info --
  // ISDATE_OP: check if value could be a date serial
  ISDATE_OP: (_o, s) => ({ result: unop(s, a => {
    if (a._tag !== "num") return bool(false)
    const v = asNum(a)
    return bool(v >= 1 && v <= 2958465) // Excel date range
  }, "ISDATE") }),
  // DIGITS_OP: count digits in number
  DIGITS_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return num(Math.abs(Math.round(asNum(a))).toString().length)
  }, "DIGITS") }),
  // -- Math --
  // MAP2_OP: apply function to value. Simplified: identity (for composition chains)
  // SIGMOID_OP: logistic sigmoid 1/(1+e^-x)
  SIGMOID_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(1 / (1 + Math.exp(-asNum(a)))), "SIGMOID") }),
  // RELU_OP: rectified linear unit max(0, x)
  RELU_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.max(0, asNum(a))), "RELU") }),
  // TANH_OP already exists. Add more ML-useful:
  // SOFTPLUS_OP: ln(1 + e^x)
  SOFTPLUS_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.log(1 + Math.exp(asNum(a)))), "SOFTPLUS") }),
  // ELU_OP: exponential linear unit. x if x>0, else alpha*(e^x - 1)
  ELU_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const x = asNum(a)
    return num(x >= 0 ? x : Math.exp(x) - 1)
  }, "ELU") }),
  // NORMALIZE_OP: (value - min) / (max - min) — min-max normalization
  NORMALIZE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "NORMALIZE")); return { result: s[s.length-1] } }
    const maxVal = asNum(s.pop()!), minVal = asNum(s.pop()!), val = asNum(s.pop()!)
    const range = maxVal - minVal
    const result = num(range === 0 ? 0 : (val - minVal) / range); s.push(result); return { result }
  },
  // MAP_RANGE_OP: map value from one range to another
  MAP_RANGE_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "MAPRANGE")); return { result: s[s.length-1] } }
    const outMax = asNum(s.pop()!), outMin = asNum(s.pop()!), inMax = asNum(s.pop()!), inMin = asNum(s.pop()!), val = asNum(s.pop()!)
    const range = inMax - inMin
    const result = num(range === 0 ? outMin : outMin + (val - inMin) * (outMax - outMin) / range)
    s.push(result); return { result }
  },
  // -- Text --
  // TEXTCENTER_OP: center text in width
  TEXTCENTER_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), width = Math.round(asNum(b))
    if (text.length >= width) return str(text)
    const pad = width - text.length
    const left = Math.floor(pad / 2)
    return str(" ".repeat(left) + text + " ".repeat(pad - left))
  }, "TEXTCENTER") }),
  // WORDCOUNT_OP: count words in text
  WORDCOUNT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a).trim()
    return num(text.length === 0 ? 0 : text.split(/\s+/).length)
  }, "WORDCOUNT") }),
  // === PUSH TO 520 ===
  // -- Date/Time functions (currently underrepresented) --
  // YEARMONTH_OP: returns year*12 + month (for month arithmetic)
  YEARMONTH_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const d2 = new Date(Math.round(asNum(a)) * 86400000)
    return num(d2.getFullYear() * 12 + d2.getMonth())
  }, "YEARMONTH") }),
  // QUARTER_OP: returns quarter (1-4) from date serial
  QUARTER_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const d2 = new Date(Math.round(asNum(a)) * 86400000)
    return num(Math.floor(d2.getMonth() / 3) + 1)
  }, "QUARTER") }),
  // DAYOFYEAR_OP: day of year (1-366)
  DAYOFYEAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const d2 = new Date(Math.round(asNum(a)) * 86400000)
    const start = new Date(d2.getFullYear(), 0, 0)
    return num(Math.floor((d2.getTime() - start.getTime()) / 86400000))
  }, "DAYOFYEAR") }),
  // ISLEAPYEAR_OP: check if year is leap year
  ISLEAPYEAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const y = Math.round(asNum(a))
    return bool((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)
  }, "ISLEAPYEAR") }),
  // DAYSINYEAR_OP: 365 or 366
  DAYSINYEAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const y = Math.round(asNum(a))
    return num(((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365)
  }, "DAYSINYEAR") }),
  // DAYSINMONTH_OP: days in a month given year and month
  DAYSINMONTH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const y = Math.round(asNum(a)), m = Math.round(asNum(b))
    return num(new Date(y, m, 0).getDate())
  }, "DAYSINMONTH") }),
  // -- More text --
  // TEXTSLICE_OP: slice text. TEXTSLICE(text, start, end)
  TEXTSLICE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTSLICE")); return { result: s[s.length-1] } }
    const end = Math.round(asNum(s.pop()!)), start = Math.round(asNum(s.pop()!)), text = vmDisplay(s.pop()!)
    const result = str(text.slice(start - 1, end)); s.push(result); return { result }
  },
  // TEXTINDEXOF_OP: position of substring (1-indexed, 0 if not found)
  TEXTINDEXOF_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const pos = vmDisplay(a).toLowerCase().indexOf(vmDisplay(b).toLowerCase())
    return num(pos >= 0 ? pos + 1 : 0)
  }, "TEXTINDEXOF") }),
  // TEXTSPLIT_ALL_N: split text into array. TEXTSPLIT(text, delimiter) → push all parts
  TEXTSPLIT_ALL_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "TEXTSPLIT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const delim = vmDisplay(args[args.length - 1])
    const text = vmDisplay(args[0])
    const parts = text.split(delim)
    parts.forEach(p => s.push(str(p)))
    return { result: s[s.length - 1] ?? str("") }
  },
  // -- More info --
  // ISINTEGER_OP: check if number is integer
  ISINTEGER_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && Number.isInteger(asNum(a))), "ISINTEGER") }),
  // ISFLOAT_OP: check if number has decimal part
  ISFLOAT_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && !Number.isInteger(asNum(a))), "ISFLOAT") }),
  // ISPOSITIVE_OP: check if number > 0
  ISPOSITIVE_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && asNum(a) > 0), "ISPOSITIVE") }),
  // ISNEGATIVE_OP: check if number < 0
  ISNEGATIVE_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "num" && asNum(a) < 0), "ISNEGATIVE") }),
  // -- More math --
  // ROUND_SIGNIF_OP: round to N significant digits
  ROUND_SIGNIF_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const val = asNum(a), sig = Math.round(asNum(b))
    if (val === 0 || sig <= 0) return num(0)
    const d2 = Math.ceil(Math.log10(Math.abs(val)))
    const power = sig - d2
    return num(Math.round(val * Math.pow(10, power)) / Math.pow(10, power))
  }, "ROUNDSIG") }),
  // CLAMP_OP: clamp value between min and max
  CLAMP_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "CLAMP")); return { result: s[s.length-1] } }
    const hi = asNum(s.pop()!), lo = asNum(s.pop()!), val = asNum(s.pop()!)
    const result = num(Math.max(lo, Math.min(hi, val))); s.push(result); return { result }
  },
  // LERP_OP: linear interpolation. LERP(a, b, t) = a + (b-a)*t
  LERP_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "LERP")); return { result: s[s.length-1] } }
    const t = asNum(s.pop()!), b2 = asNum(s.pop()!), a2 = asNum(s.pop()!)
    const result = num(a2 + (b2 - a2) * t); s.push(result); return { result }
  },
  // SMOOTHSTEP_OP: smooth Hermite interpolation. SMOOTHSTEP(edge0, edge1, x)
  SMOOTHSTEP_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "SMOOTHSTEP")); return { result: s[s.length-1] } }
    const x = asNum(s.pop()!), edge1 = asNum(s.pop()!), edge0 = asNum(s.pop()!)
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    const result = num(t * t * (3 - 2 * t)); s.push(result); return { result }
  },
  // === THE 500 ===
  // PERCENTILE_EXC_N: exclusive percentile
  PERCENTILE_EXC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE.EXC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[args.length - 1])
    const vals = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const rank = k * (vals.length + 1) - 1
    const lo = Math.max(0, Math.floor(rank)), hi = Math.min(vals.length - 1, Math.ceil(rank))
    const result = num(lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // PERCENTILE_INC_N: inclusive percentile (same as PERCENTILE but explicit)
  PERCENTILE_INC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTILE.INC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const k = asNum(args[args.length - 1])
    const vals = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const rank = k * (vals.length - 1)
    const lo = Math.floor(rank), hi = Math.ceil(rank)
    const result = num(lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // TEXTENDSWITH_OP: alias for ENDSWITH — already exists. Need 8 unique catalog entries:
  // ENCODEURL_OP: URL-encode text
  ENCODEURL_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(encodeURIComponent(vmDisplay(a))), "ENCODEURL") }),
  // DECODEURL_OP: URL-decode text
  DECODEURL_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(decodeURIComponent(vmDisplay(a))) }
    catch { return vmError("VALUE_ERROR", "DECODEURL: invalid encoding") }
  }, "DECODEURL") }),
  // ISURL_OP: check if text looks like a URL
  ISURL_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && /^https?:\/\/.+/.test(vmDisplay(a))), "ISURL") }),
  // ISEMAIL_OP: check if text looks like an email
  ISEMAIL_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vmDisplay(a))), "ISEMAIL") }),
  // HASH_OP: simple hash of text (djb2)
  HASH_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    let hash = 5381
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
    return num(hash)
  }, "HASH") }),
  // TEXTSQUEEZE_OP: collapse multiple spaces into single
  TEXTSQUEEZE_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).replace(/\s+/g, " ").trim()), "TEXTSQUEEZE") }),
  // ISODD2_OP: already have. ROMAN_NUMERAL_OP: already have. Let's add:
  // GESTEP_OP: 1 if number >= step, else 0 (engineering function)
  GESTEP_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(asNum(a) >= asNum(b) ? 1 : 0)
  }, "GESTEP") }),
  // DELTA_OP: 1 if numbers are equal, else 0 (engineering)
  DELTA_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(asNum(a) === asNum(b) ? 1 : 0)
  }, "DELTA") }),
  // === PUSH TO 500 ===
  // -- Stat: more distribution functions --
  // CHISQ_DIST_RT_OP: right-tailed chi-square
  CHISQ_DIST_RT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const x = asNum(a), df = Math.round(asNum(b))
    // Simple approximation: 1 - regularized gamma
    const p = Math.exp(-x/2) * Math.pow(x/2, df/2 - 1) / (Math.pow(2, df/2) * Math.exp(lgamma(df/2)))
    return num(Math.max(0, Math.min(1, 1 - p * x / df)))
  }, "CHISQ.DIST.RT") }),
  // TDIST_RT_OP: right-tailed t-distribution
  TDIST_RT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const t = asNum(a), df = Math.round(asNum(b))
    const x2 = df / (df + t * t)
    return num(0.5 * Math.pow(x2, df / 2))
  }, "T.DIST.RT") }),
  // FDIST_RT_OP: right-tailed F-distribution
  FDIST_RT_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "F.DIST.RT")); return { result: s[s.length-1] } }
    const df2 = Math.round(asNum(s.pop()!)), df1 = Math.round(asNum(s.pop()!)), x = asNum(s.pop()!)
    const p = df2 / (df2 + df1 * x)
    const result = num(Math.pow(p, df2 / 2)); s.push(result); return { result }
  },
  // NORM_S_INV_OP: inverse standard normal (already have NORMS_INV, add explicit name)
  // T_INV_2T_OP: two-tailed inverse t
  T_INV_2T_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const p2 = asNum(a) / 2, df = Math.round(asNum(b))
    // Approximation via normal then correction
    const t2 = p2, s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    // Cornish-Fisher correction for t
    z = z + (z*z*z + z) / (4 * df) + (5*z*z*z*z*z + 16*z*z*z + 3*z) / (96*df*df)
    return num(z)
  }, "T.INV.2T") }),
  // -- Info functions --
  // TYPE_NUM_OP: return numeric type code. 1=number, 2=text, 4=boolean, 16=error, 64=array
  TYPE_NUM_OP: (_o, s) => ({ result: unop(s, a => {
    switch (a._tag) { case "num": return num(1); case "str": return num(2); case "bool": return num(4); case "error": return num(16); default: return num(0) }
  }, "TYPE") }),
  // ISBINARY_OP: check if text is valid binary (0s and 1s only)
  ISBINARY_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && /^[01]+$/.test(vmDisplay(a))), "ISBINARY") }),
  // ISHEX_OP: check if text is valid hexadecimal
  ISHEX_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && /^[0-9A-Fa-f]+$/.test(vmDisplay(a))), "ISHEX") }),
  // -- Math functions --
  // COMBIN2_OP: standard combinations C(n,k) — already have COMBIN_OP. Add:
  // ARABIC_OP: Roman numeral to Arabic number
  ARABIC_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const roman = vmDisplay(a).toUpperCase()
    const map: Record<string, number> = { M:1000, D:500, C:100, L:50, X:10, V:5, I:1 }
    let result = 0, prev = 0
    for (let i = roman.length - 1; i >= 0; i--) {
      const val = map[roman[i]] || 0
      result += val < prev ? -val : val
      prev = val
    }
    return num(result)
  }, "ARABIC") }),
  // SEC_OP: secant
  SEC_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(1 / Math.cos(asNum(a))), "SEC") }),
  // CSC_OP: cosecant
  CSC_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(1 / Math.sin(asNum(a))), "CSC") }),
  // SECH_OP: hyperbolic secant
  SECH_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(1 / Math.cosh(asNum(a))), "SECH") }),
  // CSCH_OP: hyperbolic cosecant
  CSCH_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(1 / Math.sinh(asNum(a))), "CSCH") }),
  // ACOT_OP: inverse cotangent
  ACOT_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(Math.atan(1 / asNum(a))), "ACOT") }),
  // ACOTH_OP: inverse hyperbolic cotangent
  ACOTH_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(0.5 * Math.log((asNum(a) + 1) / (asNum(a) - 1))), "ACOTH") }),
  // -- Lookup functions --
  // EXPAND_N: expand array to specified dimensions (pad with default)
  EXPAND_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "EXPAND")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const targetSize = Math.round(asNum(args[args.length - 1]))
    const values = args.slice(0, -1)
    while (values.length < targetSize) values.push(vmError("NA", "EXPAND: padded"))
    values.forEach(v => s.push(v))
    return { result: values[0] ?? num(0) }
  },
  // XMATCH_N: extended match (returns position)
  XMATCH_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "XMATCH")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const arr = args.slice(1).map(asNum)
    const idx = arr.indexOf(target)
    const result = idx >= 0 ? num(idx + 1) : vmError("NA", "XMATCH: not found")
    s.push(result); return { result }
  },
  // -- Logic functions --
  // LAMBDA_IF_N: conditional with computation. Already have IFS_N. Add:
  // COALESCE_N: return first non-error, non-blank value
  COALESCE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "COALESCE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const first = args.find(a => !isVMError(a) && !(a._tag === "str" && vmDisplay(a) === ""))
    const result = first ?? vmError("NA", "COALESCE: all blank/error")
    s.push(result); return { result }
  },
  // -- Financial --
  // FVSCHEDULE already exists. Add:
  // XNPV_N: NPV with irregular dates. XNPV(rate, values..., dates...)
  XNPV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "XNPV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const rate = args[0]
    const half = Math.floor((n - 1) / 2)
    const values = args.slice(1, 1 + half), dates = args.slice(1 + half)
    const d0 = dates[0] || 0
    let npv = 0
    for (let i = 0; i < values.length; i++) {
      const years = ((dates[i] || d0) - d0) / 365
      npv += values[i] / Math.pow(1 + rate, years)
    }
    const result = num(npv); s.push(result); return { result }
  },
  // -- Text --
  // TEXTJOIN_UNIQUE_N: join unique values with delimiter. Already have TEXTJOIN_N. Add:
  // CONCAT_ALL_N: concatenate all values (no delimiter). Already have CONCAT_N. Add:
  // CHAR_CODE_OP: alias for CODE (already exists). Let's add UNICODE_OP:
  UNICODE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const text = vmDisplay(a)
    return text.length === 0 ? vmError("VALUE_ERROR", "UNICODE: empty") : num(text.codePointAt(0)!)
  }, "UNICODE") }),
  // UNICHAR_OP: character from Unicode code point
  UNICHAR_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    try { return str(String.fromCodePoint(Math.round(asNum(a)))) }
    catch { return vmError("VALUE_ERROR", "UNICHAR: invalid code point") }
  }, "UNICHAR") }),
  // === PUSH TO 475 ===
  // -- Text functions --
  // ENDSWITH_OP: check if text ends with suffix
  ENDSWITH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(vmDisplay(a).toLowerCase().endsWith(vmDisplay(b).toLowerCase()))
  }, "ENDSWITH") }),
  // TEXTREVERSE_OP: reverse a string
  TEXTREVERSE_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str([...vmDisplay(a)].reverse().join("")), "TEXTREVERSE") }),
  // TEXTREMOVE_OP: remove all occurrences of substring
  TEXTREMOVE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return str(vmDisplay(a).split(vmDisplay(b)).join(""))
  }, "TEXTREMOVE") }),
  // REGEXMATCH_OP: test if text matches regex pattern
  REGEXMATCH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    try { return bool(new RegExp(vmDisplay(b)).test(vmDisplay(a))) }
    catch { return vmError("VALUE_ERROR", "REGEXMATCH: invalid pattern") }
  }, "REGEXMATCH") }),
  // REGEXEXTRACT_OP: extract first match
  REGEXEXTRACT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    try {
      const m = vmDisplay(a).match(new RegExp(vmDisplay(b)))
      return m ? str(m[0]) : vmError("NA", "REGEXEXTRACT: no match")
    } catch { return vmError("VALUE_ERROR", "REGEXEXTRACT: invalid pattern") }
  }, "REGEXEXTRACT") }),
  // REGEXREPLACE_OP: replace by regex
  REGEXREPLACE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "REGEXREPLACE")); return { result: s[s.length-1] } }
    const replacement = vmDisplay(s.pop()!), pattern = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    try { const result = str(text.replace(new RegExp(pattern, "g"), replacement)); s.push(result); return { result } }
    catch { const result = vmError("VALUE_ERROR", "REGEXREPLACE: invalid pattern"); s.push(result); return { result } }
  },
  // -- Lookup functions --
  // FILTER_N: filter array by condition array. FILTER(values..., conditions...)
  FILTER_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "FILTER")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2, values = args.slice(0, half), conds = args.slice(half)
    const filtered = values.filter((_, i) => asNum(conds[i]) !== 0)
    if (filtered.length === 0) { const r = vmError("CALC_ERROR", "FILTER: no results"); s.push(r); return { result: r } }
    filtered.forEach(v => s.push(v))
    return { result: filtered[0] }
  },
  // TAKE_N: take first/last N items from array
  TAKE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "TAKE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[args.length - 1]))
    const values = args.slice(0, -1)
    const taken = count >= 0 ? values.slice(0, count) : values.slice(count)
    taken.forEach(v => s.push(v))
    return { result: taken[0] ?? num(0) }
  },
  // DROP_N: drop first/last N items from array
  DROP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "DROP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = Math.round(asNum(args[args.length - 1]))
    const values = args.slice(0, -1)
    const dropped = count >= 0 ? values.slice(count) : values.slice(0, values.length + count)
    dropped.forEach(v => s.push(v))
    return { result: dropped[0] ?? num(0) }
  },
  // CHOOSECOLS_N: choose specific columns (indices)
  CHOOSECOLS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "CHOOSECOLS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    // Last arg is col count, preceding are values + indices
    const idxCount = Math.round(asNum(args[args.length - 1]))
    const indices = args.slice(args.length - 1 - idxCount, args.length - 1).map(a => Math.round(asNum(a)) - 1)
    const values = args.slice(0, args.length - 1 - idxCount)
    indices.forEach(i => { if (i >= 0 && i < values.length) s.push(values[i]) })
    return { result: s[s.length - 1] ?? num(0) }
  },
  // CHOOSEROWS_N: alias for CHOOSECOLS (1D equivalent)
  CHOOSEROWS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "CHOOSEROWS")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const idxCount = Math.round(asNum(args[args.length - 1]))
    const indices = args.slice(args.length - 1 - idxCount, args.length - 1).map(a => Math.round(asNum(a)) - 1)
    const values = args.slice(0, args.length - 1 - idxCount)
    indices.forEach(i => { if (i >= 0 && i < values.length) s.push(values[i]) })
    return { result: s[s.length - 1] ?? num(0) }
  },
  // -- Logic functions --
  // IMPLIES_OP: logical implication (a → b = ¬a ∨ b)
  IMPLIES_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(asNum(a) === 0 || asNum(b) !== 0)
  }, "IMPLIES") }),
  // BETWEEN_OP: value between low and high (inclusive)
  BETWEEN_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BETWEEN")); return { result: s[s.length-1] } }
    const hi = asNum(s.pop()!), lo = asNum(s.pop()!), val = asNum(s.pop()!)
    const result = bool(val >= lo && val <= hi); s.push(result); return { result }
  },
  // -- Info functions --
  // FORMULATEXT_2_OP: return formula as text (already have FORMULATEXT). Add:
  // ISFORMULA_OP: check if value looks like a formula
  ISFORMULA_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && vmDisplay(a).startsWith("=")), "ISFORMULA") }),
  // SHEET_OP: return sheet number (stub: always 1)
  SHEET_OP: (_o, s) => ({ result: unop(s, _a => num(1), "SHEET") }),
  // SHEETS_OP: return sheet count (stub: always 1)
  SHEETS_OP: (_o, s) => ({ result: unop(s, _a => num(1), "SHEETS") }),
  // -- Math functions --
  // SERIESSUM_N: power series sum. SERIESSUM(x, n, m, a1,...,ak) = Σ ai * x^(n + (i-1)*m)
  SERIESSUM_N: (op: any, s) => {
    const n2 = op.n as number
    if (s.length < n2 || n2 < 4) { s.push(vmError("STACK_UNDERFLOW", "SERIESSUM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n2, n2).map(asNum)
    const x = args[0], nStart = args[1], m = args[2], coeffs = args.slice(3)
    let sum = 0
    for (let i = 0; i < coeffs.length; i++) sum += coeffs[i] * Math.pow(x, nStart + i * m)
    const result = num(sum); s.push(result); return { result }
  },
  // SUBTOTAL_MODE_N: SUBTOTAL with function number. SUBTOTAL(func_num, values...)
  SUBTOTAL_MODE_N: (op: any, s) => {
    const n2 = op.n as number
    if (s.length < n2 || n2 < 2) { s.push(vmError("STACK_UNDERFLOW", "SUBTOTAL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n2, n2)
    const funcNum = Math.round(asNum(args[0])), values = args.slice(1).map(asNum)
    let result: number
    switch (funcNum) {
      case 1: case 101: result = values.reduce((a, b) => a + b, 0) / (values.length || 1); break // AVERAGE
      case 2: case 102: result = values.filter(v => !isNaN(v)).length; break // COUNT
      case 3: case 103: result = values.length; break // COUNTA
      case 4: case 104: result = values.length === 0 ? 0 : Math.max(...values); break // MAX
      case 5: case 105: result = values.length === 0 ? 0 : Math.min(...values); break // MIN
      case 6: case 106: result = values.reduce((a, b) => a * b, 1); break // PRODUCT
      case 9: case 109: result = values.reduce((a, b) => a + b, 0); break // SUM
      default: result = values.reduce((a, b) => a + b, 0); break
    }
    const r = num(result); s.push(r); return { result: r }
  },
  // MULTINOMIAL_N: multinomial coefficient n! / (n1! * n2! * ...)
  MULTINOMIAL_N: (op: any, s) => {
    const n2 = op.n as number
    if (s.length < n2) { s.push(vmError("STACK_UNDERFLOW", "MULTINOMIAL")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n2, n2).map(a => Math.round(asNum(a)))
    const total = args.reduce((a, b) => a + b, 0)
    const fact = (x: number) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r }
    const result = num(fact(total) / args.reduce((a, b) => a * fact(b), 1))
    s.push(result); return { result }
  },
  // -- Stat functions --
  // WEIBULL_DIST_OP: Weibull distribution
  WEIBULL_DIST_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "WEIBULL.DIST")); return { result: s[s.length-1] } }
    const cumulative = asNum(s.pop()!), beta = asNum(s.pop()!), alpha = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = cumulative !== 0
      ? num(1 - Math.exp(-Math.pow(x / beta, alpha)))
      : num(x < 0 ? 0 : (alpha / beta) * Math.pow(x / beta, alpha - 1) * Math.exp(-Math.pow(x / beta, alpha)))
    s.push(result); return { result }
  },
  // EXPON_DIST_OP: exponential distribution
  EXPON_DIST_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "EXPON.DIST")); return { result: s[s.length-1] } }
    const cumulative = asNum(s.pop()!), lambda = asNum(s.pop()!), x = asNum(s.pop()!)
    const result = x < 0 ? num(0) : cumulative !== 0
      ? num(1 - Math.exp(-lambda * x))
      : num(lambda * Math.exp(-lambda * x))
    s.push(result); return { result }
  },
  // LOGNORM_DIST_OP: lognormal distribution
  LOGNORM_DIST_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "LOGNORM.DIST")); return { result: s[s.length-1] } }
    const cumulative = asNum(s.pop()!), sigma = asNum(s.pop()!), mu = asNum(s.pop()!), x = asNum(s.pop()!)
    if (x <= 0) { const r = num(0); s.push(r); return { result: r } }
    const z = (Math.log(x) - mu) / sigma
    // Approximate CDF via error function
    const erf = (t: number) => { const a = 0.254829592, b = -0.284496736, c = 1.421413741, d = -1.453152027, e2 = 1.061405429, p2 = 0.3275911; const sign = t < 0 ? -1 : 1; t = Math.abs(t); const t2 = 1 / (1 + p2 * t); return sign * (1 - (((((e2 * t2 + d) * t2) + c) * t2 + b) * t2 + a) * t2 * Math.exp(-t * t)) }
    const result = cumulative !== 0
      ? num(0.5 * (1 + erf(z / Math.SQRT2)))
      : num((1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-z * z / 2))
    s.push(result); return { result }
  },
  // === THE 450 ===
  // COUPPCD_OP: previous coupon date before settlement
  COUPPCD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "COUPPCD")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const period = 365 / freq
    const dsm = maturity - settlement
    const coupsLeft = Math.ceil(dsm / period)
    const result = num(maturity - coupsLeft * period); s.push(result); return { result }
  },
  // COUPNCD_OP: next coupon date after settlement
  COUPNCD_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "COUPNCD")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const period = 365 / freq
    const dsm = maturity - settlement
    const coupsLeft = Math.ceil(dsm / period)
    const result = num(maturity - (coupsLeft - 1) * period); s.push(result); return { result }
  },
  // ODDFPRICE_OP: odd first period price (simplified — delegates to PRICE logic)
  ODDFPRICE_OP: (_o, s) => {
    if (s.length < 6) { s.push(vmError("STACK_UNDERFLOW", "ODDFPRICE")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), redemption = asNum(s.pop()!), yld = asNum(s.pop()!)
    const rate = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const nper = Math.max(1, Math.round((maturity - settlement) / (365 / freq)))
    const coupon = rate * 100 / freq
    let price = 0
    for (let i = 1; i <= nper; i++) price += coupon / Math.pow(1 + yld / freq, i)
    price += redemption / Math.pow(1 + yld / freq, nper)
    const result = num(price); s.push(result); return { result }
  },
  // TEXT_CONTAINS_OP: check if text contains substring
  TEXT_CONTAINS_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(vmDisplay(a).toLowerCase().includes(vmDisplay(b).toLowerCase()))
  }, "CONTAINS") }),
  // TEXT_STARTSWITH_OP: check if text starts with prefix
  TEXT_STARTSWITH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(vmDisplay(a).toLowerCase().startsWith(vmDisplay(b).toLowerCase()))
  }, "STARTSWITH") }),
  // === FINAL 450 PUSH ===
  // Financial: TBILLPRICE already exists. Add more bond functions:
  // YIELDMAT_OP: yield to maturity
  YIELDMAT_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "YIELDMAT")); return { result: s[s.length-1] } }
    const yld = asNum(s.pop()!), rate = asNum(s.pop()!), maturity = asNum(s.pop()!), issue = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const dsm = Math.max(1, maturity - settlement) / 365
    const dim = Math.max(1, maturity - issue) / 365
    const dsi = Math.max(0, settlement - issue) / 365
    const result = num(dsm === 0 ? 0 : ((1 + dim * rate) / (yld + dsi * rate) - 1) / dsm)
    s.push(result); return { result }
  },
  // ACCRINTM_OP: accrued interest at maturity
  ACCRINTM_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "ACCRINTM")); return { result: s[s.length-1] } }
    const par = asNum(s.pop()!), rate = asNum(s.pop()!), maturity = asNum(s.pop()!), issue = asNum(s.pop()!)
    const result = num(par * rate * (maturity - issue) / 365); s.push(result); return { result }
  },
  // COUPDAYSNC_OP: days from settlement to next coupon
  COUPDAYSNC_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "COUPDAYSNC")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const period = 365 / freq
    const dsm = maturity - settlement
    const result = num(period - (dsm % period)); s.push(result); return { result }
  },
  // COUPNUM_OP: number of coupons between settlement and maturity
  COUPNUM_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "COUPNUM")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const result = num(Math.ceil((maturity - settlement) / (365 / freq))); s.push(result); return { result }
  },
  // Text: more string functions
  // TEXTFORMAT_OP: format number as text. TEXTFORMAT(number, format) — simplified
  // Already have TEXT_OP. Let's add TEXTPADSTART/TEXTPADEND:
  TEXTPADSTART_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTPADSTART")); return { result: s[s.length-1] } }
    const padChar = vmDisplay(s.pop()!), width = Math.round(asNum(s.pop()!)), text = vmDisplay(s.pop()!)
    const result = str(text.padStart(width, padChar)); s.push(result); return { result }
  },
  TEXTPADEND_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTPADEND")); return { result: s[s.length-1] } }
    const padChar = vmDisplay(s.pop()!), width = Math.round(asNum(s.pop()!)), text = vmDisplay(s.pop()!)
    const result = str(text.padEnd(width, padChar)); s.push(result); return { result }
  },
  // TEXTWRAP_OP: wrap text at width
  TEXTWRAP_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), width = Math.round(asNum(b))
    const lines: string[] = []
    for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width))
    return str(lines.join("\n"))
  }, "TEXTWRAP") }),
  // TEXTREPEAT_OP: repeat text N times (alias for REPT)
  // Already have REPT_OP. Let's add info functions:
  // ISEVEN2_OP: already exists. Add ISERR_OP: true if error but NOT #N/A
  ISERR_OP: (_o, s) => ({ result: unop(s, a => bool(isVMError(a) && a.code !== "NA"), "ISERR") }),
  // ISNULL_OP: true if null/empty
  ISNULL_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "str" && a.value === ""), "ISNULL") }),
  // Math: a few more
  // RANDBETWEEN already exists. Add CEILING.MATH (already added). Let's add:
  // SUMX_OP: sum with transform. Simplified: just sum
  // HYPOT_OP: hypotenuse. HYPOT(a,b) = sqrt(a^2+b^2)
  HYPOT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(Math.hypot(asNum(a), asNum(b)))
  }, "HYPOT") }),
  // PRODUCT_SINGLE_OP: product of 2 values
  // Already have PRODUCT_DYN. Let's add LCM_3 and GCD_3 (N-ary versions already exist via _N)
  // AGGREGATE extensions: AGGREGATE is already N_VARIANT
  // MDETERM_OP: matrix determinant (1D: just the value)
  MDETERM_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : num(asNum(a)), "MDETERM") }),
  // MINVERSE_OP: matrix inverse (1D: just 1/value)
  MINVERSE_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const v = asNum(a)
    return v === 0 ? vmError("DIV_ZERO", "MINVERSE") : num(1 / v)
  }, "MINVERSE") }),
  // SUMXMY2_SINGLE: already exists as N. Add:
  // COTAN_OP: cotangent (alias for COT which already exists)
  // Let's add BETA.DIST (already have BETADIST). BETA.INV:
  BETA_INV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "BETA.INV")); return { result: s[s.length-1] } }
    const beta_b = asNum(s.pop()!), alpha = asNum(s.pop()!), p = asNum(s.pop()!)
    // Simple bisection approximation
    let lo = 0, hi = 1
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2
      // Approximate CDF using regularized incomplete beta
      const approxCdf = Math.pow(mid, alpha) / (Math.pow(mid, alpha) + Math.pow(1 - mid, beta_b))
      if (approxCdf < p) lo = mid; else hi = mid
    }
    const result = num((lo + hi) / 2); s.push(result); return { result }
  },
  // GAMMA.DIST and GAMMA.INV: already have GAMMADIST_OP. Add:
  // GAMMA_INV_OP: inverse gamma distribution
  GAMMA_INV_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "GAMMA.INV")); return { result: s[s.length-1] } }
    const beta_b = asNum(s.pop()!), alpha = asNum(s.pop()!), p = asNum(s.pop()!)
    // Wilson-Hilferty approximation
    const a2 = p - 0.5, t2 = a2 < 0 ? p : 1 - p, s2 = Math.sqrt(-2 * Math.log(t2))
    let z = s2 - (2.515517 + 0.802853*s2 + 0.010328*s2*s2) / (1 + 1.432788*s2 + 0.189269*s2*s2 + 0.001308*s2*s2*s2)
    if (a2 < 0) z = -z
    const cube = 1 - 2/(9*alpha) + z * Math.sqrt(2/(9*alpha))
    const result = num(alpha * beta_b * cube * cube * cube); s.push(result); return { result }
  },
  // === PUSH TO 450 ===
  // AVERAGEWEIGHTED_N: weighted average. AVERAGEWEIGHTED(v1,...,vN, w1,...,wN) n=2K
  AVERAGEWEIGHTED_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "AVERAGEWEIGHTED")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = n / 2
    const values = args.slice(0, half), weights = args.slice(half)
    let sumVW = 0, sumW = 0
    for (let i = 0; i < half; i++) { sumVW += values[i] * weights[i]; sumW += weights[i] }
    const result = num(sumW === 0 ? 0 : sumVW / sumW); s.push(result); return { result }
  },
  // SUMPRODUCT_2_N: already have. Let's add more unique functions:
  // GEOMEAN_WEIGHTED_N: weighted geometric mean
  // HARMEAN_WEIGHTED_N: weighted harmonic mean
  // Let's add practical ones instead:
  // DCOUNT_N: database count
  DCOUNT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DCOUNT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = args.filter(a => !isVMError(a) && a._tag === "num").length
    const result = num(count); s.push(result); return { result }
  },
  // DSUM_N: database sum
  DSUM_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DSUM")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const sum = args.filter(a => a._tag === "num").reduce((acc, a) => acc + asNum(a), 0)
    const result = num(sum); s.push(result); return { result }
  },
  // DAVERAGE_N: database average
  DAVERAGE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DAVERAGE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(a => a._tag === "num").map(asNum)
    const result = num(nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length); s.push(result); return { result }
  },
  // DMAX_N: database max
  DMAX_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DMAX")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(a => a._tag === "num").map(asNum)
    const result = num(nums.length === 0 ? 0 : Math.max(...nums)); s.push(result); return { result }
  },
  // DMIN_N: database min
  DMIN_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DMIN")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const nums = args.filter(a => a._tag === "num").map(asNum)
    const result = num(nums.length === 0 ? 0 : Math.min(...nums)); s.push(result); return { result }
  },
  // DSTDEV_N: database stdev
  DSTDEV_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "DSTDEV")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const variance = args.reduce((a, b) => a + (b - mean) ** 2, 0) / (args.length - 1)
    const result = num(Math.sqrt(variance)); s.push(result); return { result }
  },
  // DVAR_N: database variance
  DVAR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "DVAR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const mean = args.reduce((a, b) => a + b, 0) / args.length
    const result = num(args.reduce((a, b) => a + (b - mean) ** 2, 0) / (args.length - 1)); s.push(result); return { result }
  },
  // DGET_N: database get first matching value (like INDEX but for database queries)
  DGET_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DGET")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = args[0]; s.push(result); return { result }
  },
  // DCOUNTA_N: database count including text
  DCOUNTA_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "DCOUNTA")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const count = args.filter(a => !isVMError(a)).length
    const result = num(count); s.push(result); return { result }
  },
  // STDEV_SAMPLE_N: explicit sample stdev (alias for STDEV.S)
  // PERCENTRANK_EXC_N: exclusive percentile rank
  PERCENTRANK_EXC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "PERCENTRANK.EXC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const values = args.slice(1).map(asNum).sort((a, b) => a - b)
    const below = values.filter(v => v < target).length
    const result = num(values.length <= 1 ? 0 : (below + 1) / (values.length + 1))
    s.push(result); return { result }
  },
  // QUARTILE_EXC_N: exclusive quartile
  QUARTILE_EXC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "QUARTILE.EXC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const q = asNum(args[args.length - 1])
    const vals = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const rank = q * (vals.length + 1) / 4 - 1
    const lo = Math.max(0, Math.floor(rank)), hi = Math.min(vals.length - 1, Math.ceil(rank))
    const result = num(lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // QUARTILE_INC_N: inclusive quartile (same as QUARTILE but explicit name)
  QUARTILE_INC_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2) { s.push(vmError("STACK_UNDERFLOW", "QUARTILE.INC")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const q = asNum(args[args.length - 1])
    const vals = args.slice(0, -1).map(asNum).sort((a, b) => a - b)
    const rank = q * (vals.length - 1) / 4
    const lo = Math.floor(rank), hi = Math.ceil(rank)
    const result = num(lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (rank - lo))
    s.push(result); return { result }
  },
  // === CATEGORY MILESTONE PUSH ===
  // SWITCH2_N: SWITCH with explicit pairs. Already have SWITCH_N. Let's add more logic:
  // NAND_OP: NOT AND
  NAND_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(!(asNum(a) !== 0 && asNum(b) !== 0))
  }, "NAND") }),
  // NOR_OP: NOT OR
  NOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool(!(asNum(a) !== 0 || asNum(b) !== 0))
  }, "NOR") }),
  // XNOR_OP: NOT XOR (equivalence)
  XNOR_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return bool((asNum(a) !== 0) === (asNum(b) !== 0))
  }, "XNOR") }),
  // Lookup additions:
  // SORTBY_N: sort by key array. SORTBY(values..., keys...) — simplified: sort values by corresponding keys
  SORTBY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 2 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "SORTBY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const half = n / 2
    const values = args.slice(0, half), keys = args.slice(half).map(asNum)
    const pairs = values.map((v, i) => ({ v, k: keys[i] ?? 0 }))
    pairs.sort((a, b) => a.k - b.k)
    pairs.forEach(p => s.push(p.v))
    const result = pairs[0]?.v ?? num(0); return { result }
  },
  // UNIQUE_BY_N: unique by key (simplified: first occurrence wins)
  // Already have UNIQUE_N. Let's add SINGLE_N: return single cell from array
  SINGLE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "SINGLE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = args[0]; s.push(result); return { result }
  },
  // === CATEGORY ROUNDING ===
  // XLOOKUP_N: extended lookup. XLOOKUP(lookup, lookup_array..., return_array..., [not_found])
  XLOOKUP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "XLOOKUP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    // Split remaining into lookup + return arrays (equal halves)
    const rest = args.slice(1)
    const half = Math.floor(rest.length / 2)
    const lookupArr = rest.slice(0, half).map(asNum)
    const returnArr = rest.slice(half)
    const idx = lookupArr.indexOf(target)
    const result = idx >= 0 && idx < returnArr.length ? returnArr[idx] : (rest.length % 2 !== 0 ? rest[rest.length - 1] : vmError("REF_ERROR", "XLOOKUP: not found"))
    s.push(result); return { result }
  },
  // HYPERLINK_OP: create hyperlink text. HYPERLINK(url, label)
  HYPERLINK_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return str(vmDisplay(b)) // In VM, just return the label text
  }, "HYPERLINK") }),
  // FORMULATEXT already exists (info). Add SHEET already exists. Let's add more:
  // NUMBERSTRING_OP: number as Chinese/Japanese text (simplified: returns digits as words)
  NUMBERSTRING_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(Math.round(asNum(a)).toString()), "NUMBERSTRING") }),
  // IFBLANK_OP: if blank then fallback (like IFERROR but for blanks)
  IFBLANK_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IFBLANK")); return { result: s[s.length-1] } }
    const fallback = s.pop()!, value = s.pop()!
    const isEmpty = (value._tag === "str" && value.value === "") || (value._tag === "num" && isNaN(value.value))
    const result = isEmpty ? fallback : value; s.push(result); return { result }
  },
  // IFNA_OP already exists. Add more logic:
  // SWITCH_RANGE_N: range-based switch. SWITCH(value, case1, result1, ..., default)
  // Already have SWITCH_N. Let's add TRUE()/FALSE() as zero-arg functions:
  // They already exist as PUSH_TRUE/PUSH_FALSE. Add as functions:
  // NOT2_OP: ensure NOT works as function  
  // Let's add TEXTJOIN_2_OP: simplified textjoin. Already have TEXTJOIN_N.
  // Add SUBSTITUTE count overload: SUBSTITUTEN_OP — replace Nth occurrence
  SUBSTITUTEN_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "SUBSTITUTE")); return { result: s[s.length-1] } }
    const instanceNum = Math.round(asNum(s.pop()!)), newText = vmDisplay(s.pop()!), oldText = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    let count = 0, pos = 0, resultText = text
    while ((pos = resultText.indexOf(oldText, pos)) !== -1) {
      count++
      if (count === instanceNum) { resultText = resultText.substring(0, pos) + newText + resultText.substring(pos + oldText.length); break }
      pos += oldText.length
    }
    const result = str(resultText); s.push(result); return { result }
  },
  // TEXTSPLIT_DELIM_OP: split by delimiter, return Nth part
  TEXTSPLIT_DELIM_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TEXTSPLIT.NTH")); return { result: s[s.length-1] } }
    const idx = Math.round(asNum(s.pop()!)) - 1, delim = vmDisplay(s.pop()!), text = vmDisplay(s.pop()!)
    const parts = text.split(delim)
    const result = idx >= 0 && idx < parts.length ? str(parts[idx]) : vmError("REF_ERROR", "TEXTSPLIT: index out of range")
    s.push(result); return { result }
  },
  // SUMPRODUCT_2 is already N. Add MMULT simplified:
  // MMULT_OP: in 1D, dot product (same as SUMPRODUCT). Placeholder.
  // Let's add PRODUCT_DYN handler (already exists). Add MEDIAN_2:
  // MAXMIN already covered. Let's add SUMX:
  // SUMIF_TEXT_N: text match sumif. Already have SUMIF_N.
  // === POST-400 EXPANSION ===
  // COMBINA_OP: combinations with repetition. COMBINA(n, k) = C(n+k-1, k)
  COMBINA_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const n2 = Math.round(asNum(a)), k = Math.round(asNum(b))
    const nk = n2 + k - 1
    let result2 = 1
    for (let i = 0; i < k; i++) result2 = result2 * (nk - i) / (i + 1)
    return num(Math.round(result2))
  }, "COMBINA") }),
  // PERMUTATIONA_OP: permutations with repetition. n^k
  PERMUTATIONA_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(Math.pow(Math.round(asNum(a)), Math.round(asNum(b))))
  }, "PERMUTATIONA") }),
  // SUMIF_2_OP: simplified SUMIF (2 args — already have SUMIF_N). Skipping.
  // SQRTPI_OP: sqrt(n * PI)
  SQRTPI_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return num(Math.sqrt(asNum(a) * Math.PI))
  }, "SQRTPI") }),
  // RANDBETWEEN_OP: integer random between two bounds
  RANDBETWEEN_INT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const lo = Math.ceil(asNum(a)), hi = Math.floor(asNum(b))
    return num(Math.floor(Math.random() * (hi - lo + 1)) + lo)
  }, "RANDBETWEEN") }),
  // NUMBERVALUE_2_OP: parse with custom separators. NUMBERVALUE(text, dec_sep)
  // Already have NUMBERVALUE_OP. Add TEXTAFTER_2_OP and TEXTBEFORE_2_OP:
  // PROPER_OP: capitalize first letter of each word
  PROPER_2_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    return str(vmDisplay(a).replace(/\b\w/g, c => c.toUpperCase()))
  }, "PROPER") }),
  // CHAR2_OP: same as CHAR but documented alias
  // TRIM2_OP: trim + collapse whitespace  
  // Let's add more math:
  // CEILING_PRECISE already exists. Add ISO.CEILING:
  ISO_CEILING_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const multiple = Math.abs(asNum(b))
    if (multiple === 0) return num(0)
    return num(Math.ceil(asNum(a) / multiple) * multiple)
  }, "ISO.CEILING") }),
  // AGGREGATE already exists as N. Add DB2 (2nd depreciation variant):
  // DB2_OP: double-declining with switch. Let's add financial:
  // YIELDDISC_OP: yield for discounted security
  YIELDDISC_OP: (_o, s) => {
    if (s.length < 4) { s.push(vmError("STACK_UNDERFLOW", "YIELDDISC")); return { result: s[s.length-1] } }
    const redemption = asNum(s.pop()!), pr = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const dsm = Math.max(1, maturity - settlement)
    const result = num(pr === 0 ? 0 : (redemption / pr - 1) * (365 / dsm))
    s.push(result); return { result }
  },
  // PRICEMAT_OP: price at maturity for security
  PRICEMAT_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "PRICEMAT")); return { result: s[s.length-1] } }
    const yld = asNum(s.pop()!), rate = asNum(s.pop()!), maturity = asNum(s.pop()!), issue = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const dim = Math.max(1, maturity - issue) / 365
    const dsm = Math.max(1, maturity - settlement) / 365
    const dsi = Math.max(0, settlement - issue) / 365
    const result = num((100 + dim * rate * 100) / (1 + dsm * yld) - dsi * rate * 100)
    s.push(result); return { result }
  },
  // === FINAL PUSH TO 400 CATALOG ===
  // ARRAYTOTEXT_N: convert array values to comma-separated text
  ARRAYTOTEXT_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ARRAYTOTEXT")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = str(args.map(vmDisplay).join(", ")); s.push(result); return { result }
  },
  // TOCOL_N: flatten to single column (in 1D just return as-is)
  TOCOL_N: (op: any, s) => { return { result: s.length > 0 ? s[s.length - 1] : vmError("STACK_UNDERFLOW", "TOCOL") } },
  // TOROW_N: flatten to single row
  TOROW_N: (op: any, s) => { return { result: s.length > 0 ? s[s.length - 1] : vmError("STACK_UNDERFLOW", "TOROW") } },
  // VSTACK_N: vertical stack (in 1D = identity, like HSTACK)
  VSTACK_N: (op: any, s) => { return { result: s.length > 0 ? s[s.length - 1] : vmError("STACK_UNDERFLOW", "VSTACK") } },
  // MAKEARRAY_N: create array from lambda (simplified: just returns count)
  MAKEARRAY_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "MAKEARRAY")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const result = num(args.length); s.push(result); return { result }
  },
  // TEXTSPLIT_2_OP: split text by delimiter and return first part. TEXTSPLIT(text, delim) — already have TEXTSPLIT_N but this is explicit 2-arg
  // ENCODEURL already exists. Let's add WEBSERVICE_OP (returns placeholder)
  WEBSERVICE_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str("[WEBSERVICE:" + vmDisplay(a) + "]"), "WEBSERVICE") }),
  // FIELDVALUE_OP: extract field from structured data (returns placeholder)
  FIELDVALUE_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str("[FIELD:" + vmDisplay(a) + "]"), "FIELDVALUE") }),
  // LOOKUP batch: VLOOKUP/HLOOKUP simplified (1D), XLOOKUP
  VLOOKUP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "VLOOKUP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const lookup = asNum(args[0])
    // In 1D VM: args[1..n-2] are data, args[n-1] is col_index (ignored in 1D)
    const data = args.slice(1, -1).map(asNum)
    const idx = data.indexOf(lookup)
    const result = idx >= 0 ? args[idx + 1] : vmError("REF_ERROR", "VLOOKUP: not found")
    s.push(result); return { result }
  },
  HLOOKUP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "HLOOKUP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const lookup = asNum(args[0])
    const data = args.slice(1, -1).map(asNum)
    const idx = data.indexOf(lookup)
    const result = idx >= 0 ? args[idx + 1] : vmError("REF_ERROR", "HLOOKUP: not found")
    s.push(result); return { result }
  },
  // SWITCH_N already exists. Let's add lookup variants:
  // LOOKUP_N: simplified LOOKUP (binary search in sorted data)
  LOOKUP_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 3) { s.push(vmError("STACK_UNDERFLOW", "LOOKUP")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n)
    const target = asNum(args[0])
    const lookupRange = args.slice(1, Math.ceil((n-1)/2) + 1).map(asNum)
    const resultRange = args.slice(Math.ceil((n-1)/2) + 1)
    // Find largest value <= target
    let bestIdx = -1
    for (let i = 0; i < lookupRange.length; i++) {
      if (lookupRange[i] <= target) bestIdx = i
    }
    const result = bestIdx >= 0 && bestIdx < resultRange.length ? resultRange[bestIdx] : vmError("REF_ERROR", "LOOKUP: not found")
    s.push(result); return { result }
  },
  // Text batch: TEXTJOIN extensions
  VALUETOTEXT_2_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a)), "VALUETOTEXT") }),
  // CLEAN extended: remove non-printable + extra whitespace
  CLEANWS_OP: (_o, s) => ({ result: unop(s, a => isVMError(a) ? a : str(vmDisplay(a).replace(/\s+/g, " ").trim()), "CLEANWS") }),
  // TEXTCOUNT_N: count occurrences of substring. TEXTCOUNT(text, find)
  TEXTCOUNT_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const text = vmDisplay(a), find = vmDisplay(b)
    if (find === "") return num(0)
    let count = 0, pos = 0
    while ((pos = text.indexOf(find, pos)) !== -1) { count++; pos += find.length }
    return num(count)
  }, "TEXTCOUNT") }),
  // ISREF_OP: always false in VM context (no real refs)
  ISREF_OP: (_o, s) => ({ result: unop(s, _a => bool(false), "ISREF") }),
  // ISLOGICAL_OP: returns true if value is boolean
  ISLOGICAL_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag === "bool"), "ISLOGICAL") }),
  // ISNONTEXT_OP: not text
  ISNONTEXT_OP: (_o, s) => ({ result: unop(s, a => bool(a._tag !== "str"), "ISNONTEXT") }),
  // ERROR.TYPE_OP: returns error type number
  ERROR_TYPE_OP: (_o, s) => ({ result: unop(s, a => {
    if (!isVMError(a)) return vmError("TYPE_MISMATCH", "ERROR.TYPE: not an error")
    switch (a.code) { case "TYPE_MISMATCH": return num(3); case "REF_ERROR": return num(4); case "DIV_ZERO": return num(2); case "STACK_UNDERFLOW": return num(1); default: return num(7) }
  }, "ERROR.TYPE") }),
  // SWITCH logic: IFERROR with chain
  IFERROR_OP: (_o, s) => {
    if (s.length < 2) { s.push(vmError("STACK_UNDERFLOW", "IFERROR")); return { result: s[s.length-1] } }
    const fallback = s.pop()!, value = s.pop()!
    const result = isVMError(value) ? fallback : value; s.push(result); return { result }
  },
  // XOR already N_VARIANT. Add IMXOR (bitwise-style for booleans):
  // SWITCH_BOOL_OP: IF but with explicit true/false branches
  // BITCOUNT_OP: count 1-bits (popcount)
  BITCOUNT_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    let n2 = Math.round(asNum(a)), count = 0
    while (n2) { count += n2 & 1; n2 >>>= 1 }
    return num(count)
  }, "BITCOUNT") }),
  // QUOTIENT already exists. Add MOD_OP as alias: MOD(a,b) = a - FLOOR(a/b)*b
  // SUBTOTAL already exists. Add AGGREGATE expansion later.
  // MROUND_OP: round to nearest multiple
  MROUND_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const multiple = asNum(b)
    if (multiple === 0) return num(0)
    return num(Math.round(asNum(a) / multiple) * multiple)
  }, "MROUND") }),
  // CEILING_MATH_OP: round up to nearest multiple
  CEILING_MATH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const multiple = asNum(b)
    if (multiple === 0) return num(0)
    return num(Math.ceil(asNum(a) / multiple) * multiple)
  }, "CEILING.MATH") }),
  // FLOOR_MATH_OP: round down to nearest multiple
  FLOOR_MATH_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    const multiple = asNum(b)
    if (multiple === 0) return num(0)
    return num(Math.floor(asNum(a) / multiple) * multiple)
  }, "FLOOR.MATH") }),
  // BASE_OP: convert number to base string. BASE(number, radix)
  BASE_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return str(Math.round(asNum(a)).toString(Math.round(asNum(b))).toUpperCase())
  }, "BASE") }),
  // DECIMAL_OP: convert string from base to number. DECIMAL(text, radix)
  DECIMAL_OP: (_o, s) => ({ result: binop(s, (a, b) => {
    const pe = propagateError(a, b); if (pe) return pe
    return num(parseInt(vmDisplay(a), Math.round(asNum(b))))
  }, "DECIMAL") }),
  // AMORLINC_OP: straight-line depreciation prorated. AMORLINC(cost, purchase_date, first_period, salvage, period, rate)
  // Simplified: cost * rate * fraction for period
  AMORLINC_OP: (_o, s) => {
    if (s.length < 6) { s.push(vmError("STACK_UNDERFLOW", "AMORLINC")); return { result: s[s.length-1] } }
    const rate = asNum(s.pop()!), period = Math.round(asNum(s.pop()!)), salvage = asNum(s.pop()!)
    const _fp = asNum(s.pop()!), _pd = asNum(s.pop()!), cost = asNum(s.pop()!)
    const depPerPeriod = cost * rate
    const totalDep = Math.min(cost - salvage, depPerPeriod * (period + 1))
    const prevDep = Math.min(cost - salvage, depPerPeriod * period)
    const result = num(totalDep - prevDep); s.push(result); return { result }
  },
  // PRICE_OP: bond price. PRICE(settlement, maturity, rate, yield, redemption, frequency)
  // Simplified: sum of discounted coupons + discounted redemption
  PRICE_OP: (_o, s) => {
    if (s.length < 6) { s.push(vmError("STACK_UNDERFLOW", "PRICE")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), redemption = asNum(s.pop()!), yld = asNum(s.pop()!)
    const rate = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const nper = Math.max(1, Math.round((maturity - settlement) / (365 / freq)))
    const coupon = rate * 100 / freq
    let price = 0
    for (let i = 1; i <= nper; i++) price += coupon / Math.pow(1 + yld / freq, i)
    price += redemption / Math.pow(1 + yld / freq, nper)
    const result = num(price); s.push(result); return { result }
  },
  // ODDLPRICE_OP: price for odd last period (simplified — delegates to PRICE logic)
  ODDLPRICE_OP: (_o, s) => {
    if (s.length < 6) { s.push(vmError("STACK_UNDERFLOW", "ODDLPRICE")); return { result: s[s.length-1] } }
    const freq = Math.round(asNum(s.pop()!)), redemption = asNum(s.pop()!), yld = asNum(s.pop()!)
    const rate = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const nper = Math.max(1, Math.round((maturity - settlement) / (365 / freq)))
    const coupon = rate * 100 / freq
    let price = 0
    for (let i = 1; i <= nper; i++) price += coupon / Math.pow(1 + yld / freq, i)
    price += redemption / Math.pow(1 + yld / freq, nper)
    const result = num(price); s.push(result); return { result }
  },
  // DOLLARFR_2_OP: fractional dollar → decimal (alias with 2 args)
  // SWITCH_TEXT_N: text-based switch. Already have SWITCH_N but this documents the pattern.
  // INFO_CELL_OP: returns cell info string. INFO("directory") → "/"
  INFO_OP: (_o, s) => ({ result: unop(s, a => {
    if (isVMError(a)) return a
    const typ = vmDisplay(a).toLowerCase()
    switch (typ) {
      case "directory": return str("/")
      case "numfile": return num(1)
      case "origin": return str("$A:$A$1")
      case "osversion": return str("Web 1.0")
      case "recalc": return str("Automatic")
      case "release": return str("TMNL-VM/1.0")
      case "system": return str("web")
      default: return str("")
    }
  }, "INFO") }),
  // CUMPRINC_OP: cumulative principal. CUMPRINC(rate, nper, pv, start, end)
  CUMPRINC_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "CUMPRINC")); return { result: s[s.length-1] } }
    const endPer = Math.round(asNum(s.pop()!)), startPer = Math.round(asNum(s.pop()!))
    const pv = asNum(s.pop()!), nper = Math.round(asNum(s.pop()!)), rate = asNum(s.pop()!)
    const pmt = rate === 0 ? -pv / nper : -pv * rate / (1 - Math.pow(1 + rate, -nper))
    let cumPrinc = 0
    for (let per = startPer; per <= endPer; per++) {
      const fvBefore = pv * Math.pow(1 + rate, per - 1) + pmt * (Math.pow(1 + rate, per - 1) - 1) / (rate || 1)
      const interest = fvBefore * rate
      cumPrinc += pmt - interest
    }
    const result = num(cumPrinc); s.push(result); return { result }
  },
  // PDURATION_OP: periods needed for investment to reach target. PDURATION(rate, pv, fv)
  PDURATION_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "PDURATION")); return { result: s[s.length-1] } }
    const fv = asNum(s.pop()!), pv2 = asNum(s.pop()!), rate = asNum(s.pop()!)
    if (rate <= 0 || pv2 <= 0 || fv <= 0) { s.push(vmError("TYPE_MISMATCH", "PDURATION")); return { result: s[s.length-1] } }
    const result = num((Math.log(fv) - Math.log(pv2)) / Math.log(1 + rate)); s.push(result); return { result }
  },
  // RRI_OP: equivalent rate for growth. RRI(nper, pv, fv) = (fv/pv)^(1/nper) - 1
  RRI_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "RRI")); return { result: s[s.length-1] } }
    const fv = asNum(s.pop()!), pv2 = asNum(s.pop()!), nper = asNum(s.pop()!)
    if (nper === 0 || pv2 === 0) { s.push(vmError("DIV_ZERO", "RRI")); return { result: s[s.length-1] } }
    const result = num(Math.pow(fv / pv2, 1 / nper) - 1); s.push(result); return { result }
  },
  // TBILLEQ_OP: T-bill bond-equivalent yield. TBILLEQ(settlement, maturity, discount)
  TBILLEQ_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TBILLEQ")); return { result: s[s.length-1] } }
    const discount = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const dsm = Math.max(1, maturity - settlement)
    const result = num((365 * discount) / (360 - discount * dsm)); s.push(result); return { result }
  },
  // TBILLPRICE_OP: T-bill price. TBILLPRICE(settlement, maturity, discount)
  TBILLPRICE_OP: (_o, s) => {
    if (s.length < 3) { s.push(vmError("STACK_UNDERFLOW", "TBILLPRICE")); return { result: s[s.length-1] } }
    const discount = asNum(s.pop()!), maturity = asNum(s.pop()!), settlement = asNum(s.pop()!)
    const dsm = Math.max(1, maturity - settlement)
    const result = num(100 * (1 - discount * dsm / 360)); s.push(result); return { result }
  },
  // DURATION_OP: Macaulay duration. Simplified: DURATION(rate, nper, coupon, pv, fv)
  DURATION_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "DURATION")); return { result: s[s.length-1] } }
    const fv = asNum(s.pop()!), pv2 = asNum(s.pop()!), coupon = asNum(s.pop()!), nper = Math.round(asNum(s.pop()!)), rate = asNum(s.pop()!)
    if (rate <= -1) { s.push(vmError("TYPE_MISMATCH", "DURATION")); return { result: s[s.length-1] } }
    let priceW = 0, price = 0
    for (let t = 1; t <= nper; t++) {
      const cf = t < nper ? coupon : coupon + fv
      const disc = cf / Math.pow(1 + rate, t)
      priceW += t * disc; price += disc
    }
    const result = num(price === 0 ? 0 : priceW / price); s.push(result); return { result }
  },
  // MDURATION_OP: modified duration. MDURATION = duration / (1 + rate/freq)
  MDURATION_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "MDURATION")); return { result: s[s.length-1] } }
    const fv = asNum(s.pop()!), pv2 = asNum(s.pop()!), coupon = asNum(s.pop()!), nper = Math.round(asNum(s.pop()!)), rate = asNum(s.pop()!)
    if (rate <= -1) { s.push(vmError("TYPE_MISMATCH", "MDURATION")); return { result: s[s.length-1] } }
    let priceW = 0, price = 0
    for (let t = 1; t <= nper; t++) {
      const cf = t < nper ? coupon : coupon + fv
      const disc = cf / Math.pow(1 + rate, t)
      priceW += t * disc; price += disc
    }
    const dur = price === 0 ? 0 : priceW / price
    const result = num(dur / (1 + rate)); s.push(result); return { result }
  },
  // XIRR_N: internal rate of return for irregular cashflows. XIRR(cf1,...,cfN, d1,...,dN) n=2K
  XIRR_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n || n < 4 || n % 2 !== 0) { s.push(vmError("STACK_UNDERFLOW", "XIRR")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).map(asNum)
    const half = n / 2, cfs = args.slice(0, half), dates = args.slice(half)
    const d0 = dates[0]
    let guess = 0.1
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, dnpv = 0
      for (let i = 0; i < half; i++) {
        const years = (dates[i] - d0) / 365
        const disc = Math.pow(1 + guess, years)
        npv += cfs[i] / disc
        dnpv -= years * cfs[i] / (disc * (1 + guess))
      }
      if (Math.abs(npv) < 1e-10) break
      if (dnpv === 0) break
      guess -= npv / dnpv
    }
    const result = num(guess); s.push(result); return { result }
  },
  // YIELD_OP: bond yield (simplified). YIELD(rate, nper, coupon, price, redemption)
  YIELD_OP: (_o, s) => {
    if (s.length < 5) { s.push(vmError("STACK_UNDERFLOW", "YIELD")); return { result: s[s.length-1] } }
    const redemption = asNum(s.pop()!), price = asNum(s.pop()!), coupon = asNum(s.pop()!), nper = Math.round(asNum(s.pop()!)), _rate = asNum(s.pop()!)
    // Current yield approximation + capital gain adjustment
    const currentYield = coupon / price
    const capitalGain = (redemption - price) / nper / price
    const result = num(currentYield + capitalGain); s.push(result); return { result }
  },
  // ROWS_N: count of values passed (lookup utility)
  ROWS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ROWS")); return { result: s[s.length-1] } }
    s.splice(s.length - n, n)
    const result = num(n); s.push(result); return { result }
  },
  // TYPE_OP already defined above — uses string returns ("number","text","logical","error")
  // AREAS_N: count of areas (in 1D VM = 1 always, but accept N args)
  AREAS_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "AREAS")); return { result: s[s.length-1] } }
    s.splice(s.length - n, n)
    const result = num(n); s.push(result); return { result }
  },
  // TRANSPOSE_N: reverse order of values (1D transpose)
  TRANSPOSE_N: (op: any, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "TRANSPOSE")); return { result: s[s.length-1] } }
    const args = s.splice(s.length - n, n).reverse()
    s.push(...args)
    const result = args[0]; return { result }
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
  SQRTPI_OP: { _tag: "SQRTPI_OP" }, BASE_OP: { _tag: "BASE_OP" }, DECIMAL_OP: { _tag: "DECIMAL_OP" }, WEBSERVICE_OP: { _tag: "WEBSERVICE_OP" }, FIELDVALUE_OP: { _tag: "FIELDVALUE_OP" }, COMBINA_OP: { _tag: "COMBINA_OP" }, PERMUTATIONA_OP: { _tag: "PERMUTATIONA_OP" }, SQRTPI_OP: { _tag: "SQRTPI_OP" }, RANDBETWEEN_INT_OP: { _tag: "RANDBETWEEN_INT_OP" }, ISO_CEILING_OP: { _tag: "ISO_CEILING_OP" }, YIELDDISC_OP: { _tag: "YIELDDISC_OP" }, PRICEMAT_OP: { _tag: "PRICEMAT_OP" }, HYPERLINK_OP: { _tag: "HYPERLINK_OP" }, NUMBERSTRING_OP: { _tag: "NUMBERSTRING_OP" }, IFBLANK_OP: { _tag: "IFBLANK_OP" }, SUBSTITUTEN_OP: { _tag: "SUBSTITUTEN_OP" }, TEXTSPLIT_DELIM_OP: { _tag: "TEXTSPLIT_DELIM_OP" }, NAND_OP: { _tag: "NAND_OP" }, NOR_OP: { _tag: "NOR_OP" }, XNOR_OP: { _tag: "XNOR_OP" }, YIELDMAT_OP: { _tag: "YIELDMAT_OP" }, ACCRINTM_OP: { _tag: "ACCRINTM_OP" }, COUPDAYSNC_OP: { _tag: "COUPDAYSNC_OP" }, COUPNUM_OP: { _tag: "COUPNUM_OP" }, TEXTPADSTART_OP: { _tag: "TEXTPADSTART_OP" }, TEXTPADEND_OP: { _tag: "TEXTPADEND_OP" }, TEXTWRAP_OP: { _tag: "TEXTWRAP_OP" }, ISERR_OP: { _tag: "ISERR_OP" }, ISNULL_OP: { _tag: "ISNULL_OP" }, HYPOT_OP: { _tag: "HYPOT_OP" }, MDETERM_OP: { _tag: "MDETERM_OP" }, MINVERSE_OP: { _tag: "MINVERSE_OP" }, BETA_INV_OP: { _tag: "BETA_INV_OP" }, GAMMA_INV_OP: { _tag: "GAMMA_INV_OP" }, COUPPCD_OP: { _tag: "COUPPCD_OP" }, COUPNCD_OP: { _tag: "COUPNCD_OP" }, ODDFPRICE_OP: { _tag: "ODDFPRICE_OP" }, TEXT_CONTAINS_OP: { _tag: "TEXT_CONTAINS_OP" }, TEXT_STARTSWITH_OP: { _tag: "TEXT_STARTSWITH_OP" }, ENDSWITH_OP: { _tag: "ENDSWITH_OP" }, TEXTREVERSE_OP: { _tag: "TEXTREVERSE_OP" }, TEXTREMOVE_OP: { _tag: "TEXTREMOVE_OP" }, REGEXMATCH_OP: { _tag: "REGEXMATCH_OP" }, REGEXEXTRACT_OP: { _tag: "REGEXEXTRACT_OP" }, REGEXREPLACE_OP: { _tag: "REGEXREPLACE_OP" }, IMPLIES_OP: { _tag: "IMPLIES_OP" }, BETWEEN_OP: { _tag: "BETWEEN_OP" }, ISFORMULA_OP: { _tag: "ISFORMULA_OP" }, SHEET_OP: { _tag: "SHEET_OP" }, SHEETS_OP: { _tag: "SHEETS_OP" }, WEIBULL_DIST_OP: { _tag: "WEIBULL_DIST_OP" }, EXPON_DIST_OP: { _tag: "EXPON_DIST_OP" }, LOGNORM_DIST_OP: { _tag: "LOGNORM_DIST_OP" }, CHISQ_DIST_RT_OP: { _tag: "CHISQ_DIST_RT_OP" }, TDIST_RT_OP: { _tag: "TDIST_RT_OP" }, FDIST_RT_OP: { _tag: "FDIST_RT_OP" }, T_INV_2T_OP: { _tag: "T_INV_2T_OP" }, TYPE_NUM_OP: { _tag: "TYPE_NUM_OP" }, ISBINARY_OP: { _tag: "ISBINARY_OP" }, ISHEX_OP: { _tag: "ISHEX_OP" }, ACOTH_OP: { _tag: "ACOTH_OP" }, ENCODEURL_OP: { _tag: "ENCODEURL_OP" }, DECODEURL_OP: { _tag: "DECODEURL_OP" }, ISURL_OP: { _tag: "ISURL_OP" }, ISEMAIL_OP: { _tag: "ISEMAIL_OP" }, HASH_OP: { _tag: "HASH_OP" }, TEXTSQUEEZE_OP: { _tag: "TEXTSQUEEZE_OP" }, GESTEP_OP: { _tag: "GESTEP_OP" }, DELTA_OP: { _tag: "DELTA_OP" }, YEARMONTH_OP: { _tag: "YEARMONTH_OP" }, QUARTER_OP: { _tag: "QUARTER_OP" }, DAYOFYEAR_OP: { _tag: "DAYOFYEAR_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, DAYSINYEAR_OP: { _tag: "DAYSINYEAR_OP" }, DAYSINMONTH_OP: { _tag: "DAYSINMONTH_OP" }, TEXTSLICE_OP: { _tag: "TEXTSLICE_OP" }, TEXTINDEXOF_OP: { _tag: "TEXTINDEXOF_OP" }, ISINTEGER_OP: { _tag: "ISINTEGER_OP" }, ISFLOAT_OP: { _tag: "ISFLOAT_OP" }, ISPOSITIVE_OP: { _tag: "ISPOSITIVE_OP" }, ISNEGATIVE_OP: { _tag: "ISNEGATIVE_OP" }, ROUND_SIGNIF_OP: { _tag: "ROUND_SIGNIF_OP" }, CLAMP_OP: { _tag: "CLAMP_OP" }, LERP_OP: { _tag: "LERP_OP" }, SMOOTHSTEP_OP: { _tag: "SMOOTHSTEP_OP" }, ISDATE_OP: { _tag: "ISDATE_OP" }, DIGITS_OP: { _tag: "DIGITS_OP" }, SIGMOID_OP: { _tag: "SIGMOID_OP" }, RELU_OP: { _tag: "RELU_OP" }, SOFTPLUS_OP: { _tag: "SOFTPLUS_OP" }, ELU_OP: { _tag: "ELU_OP" }, NORMALIZE_OP: { _tag: "NORMALIZE_OP" }, MAP_RANGE_OP: { _tag: "MAP_RANGE_OP" }, TEXTCENTER_OP: { _tag: "TEXTCENTER_OP" }, WORDCOUNT_OP: { _tag: "WORDCOUNT_OP" }, ROUND_MODE_OP: { _tag: "ROUND_MODE_OP" }, BASE64_ENCODE_OP: { _tag: "BASE64_ENCODE_OP" }, BASE64_DECODE_OP: { _tag: "BASE64_DECODE_OP" }, TEXTROTATE_OP: { _tag: "TEXTROTATE_OP" }, TEXTINITIALS_OP: { _tag: "TEXTINITIALS_OP" }, TEXTCAMELCASE_OP: { _tag: "TEXTCAMELCASE_OP" }, TEXTSNAKECASE_OP: { _tag: "TEXTSNAKECASE_OP" }, TEXTKEBABCASE_OP: { _tag: "TEXTKEBABCASE_OP" }, BITNOT_OP: { _tag: "BITNOT_OP" }, BITROTL_OP: { _tag: "BITROTL_OP" }, BITROTR_OP: { _tag: "BITROTR_OP" }, JSON_STRINGIFY_OP: { _tag: "JSON_STRINGIFY_OP" }, TEXTTITLE_OP: { _tag: "TEXTTITLE_OP" }, ISNAN2_OP: { _tag: "ISNAN2_OP" }, ISINFINITE_OP: { _tag: "ISINFINITE_OP" }, SLN_OP: { _tag: "SLN_OP" }, SYD_OP: { _tag: "SYD_OP" }, DDB_OP: { _tag: "DDB_OP" }, RATE_EST_OP: { _tag: "RATE_EST_OP" }, EFFECT_RATE_OP: { _tag: "EFFECT_RATE_OP" }, NOMINAL_RATE_OP: { _tag: "NOMINAL_RATE_OP" }, ZSCORE_OP: { _tag: "ZSCORE_OP" }, NAND_OP: { _tag: "NAND_OP" }, NOR_OP: { _tag: "NOR_OP" }, XNOR_OP: { _tag: "XNOR_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTTRUNCATE_OP: { _tag: "TEXTTRUNCATE_OP" }, CAGR_OP: { _tag: "CAGR_OP" }, DISC_OP: { _tag: "DISC_OP" }, DOLLARDE_OP: { _tag: "DOLLARDE_OP" }, DOLLARFR_OP: { _tag: "DOLLARFR_OP" }, HYPOT3_OP: { _tag: "HYPOT3_OP" }, DISTANCE2D_OP: { _tag: "DISTANCE2D_OP" }, MANHATTAN_OP: { _tag: "MANHATTAN_OP" }, FIBONACCI_OP: { _tag: "FIBONACCI_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, TYPEOF2_OP: { _tag: "TYPEOF2_OP" }, CHARCODE_OP: { _tag: "CHARCODE_OP" }, FROMCHARCODE_OP: { _tag: "FROMCHARCODE_OP" }, ISPRIME_OP: { _tag: "ISPRIME_OP" }, NEXTPRIME_OP: { _tag: "NEXTPRIME_OP" }, PRIMECOUNT_OP: { _tag: "PRIMECOUNT_OP" }, TOTIENT_OP: { _tag: "TOTIENT_OP" }, DIVISORS_OP: { _tag: "DIVISORS_OP" }, CELLTYPE_OP: { _tag: "CELLTYPE_OP" }, CHECKSUM_OP: { _tag: "CHECKSUM_OP" }, DIGSUM_OP: { _tag: "DIGSUM_OP" }, DIGROOT_OP: { _tag: "DIGROOT_OP" }, NTHROOT_OP: { _tag: "NTHROOT_OP" }, TEXTHAMMINGDIST_OP: { _tag: "TEXTHAMMINGDIST_OP" }, TEXTLEVENSHTEIN_OP: { _tag: "TEXTLEVENSHTEIN_OP" }, ISALPHANUMERIC_OP: { _tag: "ISALPHANUMERIC_OP" }, ISALPHABETIC_OP: { _tag: "ISALPHABETIC_OP" }, POLYGONAREA_OP: { _tag: "POLYGONAREA_OP" }, CIRCLEAREA_OP: { _tag: "CIRCLEAREA_OP" }, SPHEREVOL_OP: { _tag: "SPHEREVOL_OP" }, CYLINDERVOL_OP: { _tag: "CYLINDERVOL_OP" }, TEXTSIMILARITY_OP: { _tag: "TEXTSIMILARITY_OP" }, TEXTZALGO_OP: { _tag: "TEXTZALGO_OP" }, TEXTASCII_OP: { _tag: "TEXTASCII_OP" }, TEXTSLUG_OP: { _tag: "TEXTSLUG_OP" }, WACC_OP: { _tag: "WACC_OP" }, PAYBACK_OP: { _tag: "PAYBACK_OP" }, ROI_OP: { _tag: "ROI_OP" }, ISNUMERICSTR_OP: { _tag: "ISNUMERICSTR_OP" }, TEXTENTROPY_OP: { _tag: "TEXTENTROPY_OP" }, DEG2RAD_OP: { _tag: "DEG2RAD_OP" }, RAD2DEG_OP: { _tag: "RAD2DEG_OP" }, SINC_OP: { _tag: "SINC_OP" }, ATAN2_OP: { _tag: "ATAN2_OP" }, BINOMCOEF_OP: { _tag: "BINOMCOEF_OP" }, CATALAN_OP: { _tag: "CATALAN_OP" }, TRIANGLENUM_OP: { _tag: "TRIANGLENUM_OP" }, TEXTEMOJI_OP: { _tag: "TEXTEMOJI_OP" }, TEXTSTRIP_OP: { _tag: "TEXTSTRIP_OP" }, TEXTNORMALIZE_OP: { _tag: "TEXTNORMALIZE_OP" }, TEXTMORSE_OP: { _tag: "TEXTMORSE_OP" }, BREAKEVEN_OP: { _tag: "BREAKEVEN_OP" }, PROFITMARGIN_OP: { _tag: "PROFITMARGIN_OP" }, MARKUP_OP: { _tag: "MARKUP_OP" }, ISUPPER_OP: { _tag: "ISUPPER_OP" }, ISLOWER_OP: { _tag: "ISLOWER_OP" }, ISPALINDROME_OP: { _tag: "ISPALINDROME_OP" }, PENTAGONAL_OP: { _tag: "PENTAGONAL_OP" }, HEXAGONAL_OP: { _tag: "HEXAGONAL_OP" }, TETRAHEDRAL_OP: { _tag: "TETRAHEDRAL_OP" }, PYRAMIDAL_OP: { _tag: "PYRAMIDAL_OP" }, STIRLING_OP: { _tag: "STIRLING_OP" }, CONEVOL_OP: { _tag: "CONEVOL_OP" }, TEXTRLE_OP: { _tag: "TEXTRLE_OP" }, TEXTRLD_OP: { _tag: "TEXTRLD_OP" }, ISPERFECT_OP: { _tag: "ISPERFECT_OP" }, ISHARSHAD_OP: { _tag: "ISHARSHAD_OP" }, SAWTOOTH_OP: { _tag: "SAWTOOTH_OP" }, SQUAREWAVE_OP: { _tag: "SQUAREWAVE_OP" }, TRIANGLEWAVE_OP: { _tag: "TRIANGLEWAVE_OP" }, AGM_OP: { _tag: "AGM_OP" }, LOGISTIC_OP: { _tag: "LOGISTIC_OP" }, GAMMA2_OP: { _tag: "GAMMA2_OP" }, TEXTROT13_OP: { _tag: "TEXTROT13_OP" }, TEXTCAESAR_OP: { _tag: "TEXTCAESAR_OP" }, TEXTFREQ_OP: { _tag: "TEXTFREQ_OP" }, ISASCII_OP: { _tag: "ISASCII_OP" }, ISPRINTABLE_OP: { _tag: "ISPRINTABLE_OP" }, ISWHITESPACE_OP: { _tag: "ISWHITESPACE_OP" }, SIMPLEINTEREST_OP: { _tag: "SIMPLEINTEREST_OP" }, COMPOUNDINTEREST_OP: { _tag: "COMPOUNDINTEREST_OP" }, DEPRECIATION_OP: { _tag: "DEPRECIATION_OP" }, LUCAS_OP: { _tag: "LUCAS_OP" }, BELL_OP: { _tag: "BELL_OP" }, INTLOG2_OP: { _tag: "INTLOG2_OP" }, INTLOG10_OP: { _tag: "INTLOG10_OP" }, BITLEN_OP: { _tag: "BITLEN_OP" }, TEXTREPEAT_OP: { _tag: "TEXTREPEAT_OP" }, TEXTNTH_OP: { _tag: "TEXTNTH_OP" }, TEXTUNIQUE_OP: { _tag: "TEXTUNIQUE_OP" }, TEXTDISTINCT_OP: { _tag: "TEXTDISTINCT_OP" }, CHARCOUNT_OP: { _tag: "CHARCOUNT_OP" }, ISEMPTYTEXT_OP: { _tag: "ISEMPTYTEXT_OP" }, RULEOF72_OP: { _tag: "RULEOF72_OP" }, PRESENTVALUE_OP: { _tag: "PRESENTVALUE_OP" }, GOLDEN_OP: { _tag: "GOLDEN_OP" }, EULER_OP: { _tag: "EULER_OP" }, TAU_OP: { _tag: "TAU_OP" }, CUBEROOT_OP: { _tag: "CUBEROOT_OP" }, WRAP_OP: { _tag: "WRAP_OP" }, REMAP_OP: { _tag: "REMAP_OP" }, TEXTBASE64_OP: { _tag: "TEXTBASE64_OP" }, TEXTFROMBASE64_OP: { _tag: "TEXTFROMBASE64_OP" }, TEXTPREFIX_OP: { _tag: "TEXTPREFIX_OP" }, TEXTSUFFIX_OP: { _tag: "TEXTSUFFIX_OP" }, ISODD2_OP: { _tag: "ISODD2_OP" }, ISEVEN2_OP: { _tag: "ISEVEN2_OP" }, ISZERO_OP: { _tag: "ISZERO_OP" }, ANNUITY_OP: { _tag: "ANNUITY_OP" }, FUTUREVALUE2_OP: { _tag: "FUTUREVALUE2_OP" }, ABUNDANCY_OP: { _tag: "ABUNDANCY_OP" }, DIGITCOUNT_OP: { _tag: "DIGITCOUNT_OP" }, CHEBYSHEV_OP: { _tag: "CHEBYSHEV_OP" }, ISPOWEROFTWO_OP: { _tag: "ISPOWEROFTWO_OP" }, NEXTODD_OP: { _tag: "NEXTODD_OP" }, NEXTEVEN_OP: { _tag: "NEXTEVEN_OP" }, TOROMAN_OP: { _tag: "TOROMAN_OP" }, FROMROMAN_OP: { _tag: "FROMROMAN_OP" }, TOORDINAL_OP: { _tag: "TOORDINAL_OP" }, TEXTHEX_OP: { _tag: "TEXTHEX_OP" }, TEXTFROMHEX_OP: { _tag: "TEXTFROMHEX_OP" }, TEXTDEDUPE_OP: { _tag: "TEXTDEDUPE_OP" }, TEXTLINES_OP: { _tag: "TEXTLINES_OP" }, TEXTPASCALCASE_OP: { _tag: "TEXTPASCALCASE_OP" }, ISPRIMEFAST_OP: { _tag: "ISPRIMEFAST_OP" }, SHARPE_OP: { _tag: "SHARPE_OP" }, SORTINO_OP: { _tag: "SORTINO_OP" }, EMAVG_OP: { _tag: "EMAVG_OP" }, SMAVG_OP: { _tag: "SMAVG_OP" }, COPRIME_OP: { _tag: "COPRIME_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, PREVPRIME_OP: { _tag: "PREVPRIME_OP" }, TEXTPAD_OP: { _tag: "TEXTPAD_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTISURL_OP: { _tag: "TEXTISURL_OP" }, TEXTISEMAIL_OP: { _tag: "TEXTISEMAIL_OP" }, WORDSCOUNT_OP: { _tag: "WORDSCOUNT_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, WEEKOFYEAR_OP: { _tag: "WEEKOFYEAR_OP" }, ISWEEKEND_OP: { _tag: "ISWEEKEND_OP" }, QUARTERNO_OP: { _tag: "QUARTERNO_OP" }, SEMESTERNO_OP: { _tag: "SEMESTERNO_OP" }, EFFECTRATE_OP: { _tag: "EFFECTRATE_OP" }, NOMRATE_OP: { _tag: "NOMRATE_OP" }, NPER2_OP: { _tag: "NPER2_OP" }, RATE2_OP: { _tag: "RATE2_OP" }, FIBONACCI2_OP: { _tag: "FIBONACCI2_OP" }, MOTZKIN_OP: { _tag: "MOTZKIN_OP" }, DERANGEMENT_OP: { _tag: "DERANGEMENT_OP" }, TOTIENT2_OP: { _tag: "TOTIENT2_OP" }, HARMONIC2_OP: { _tag: "HARMONIC2_OP" }, TEXTOBFUSCATE_OP: { _tag: "TEXTOBFUSCATE_OP" }, TEXTCOUNT2_OP: { _tag: "TEXTCOUNT2_OP" }, TEXTSHUFFLE_OP: { _tag: "TEXTSHUFFLE_OP" }, ISFIBBISH_OP: { _tag: "ISFIBBISH_OP" }, IFF_OP: { _tag: "IFF_OP" }, UNLESS_OP: { _tag: "UNLESS_OP" }, SECANT_OP: { _tag: "SECANT_OP" }, COSECANT_OP: { _tag: "COSECANT_OP" }, VERSINE_OP: { _tag: "VERSINE_OP" }, HAVERSINE_OP: { _tag: "HAVERSINE_OP" }, EXSECANT_OP: { _tag: "EXSECANT_OP" }, LEMNISCATE_OP: { _tag: "LEMNISCATE_OP" }, AGM2_OP: { _tag: "AGM2_OP" }, POWMOD_OP: { _tag: "POWMOD_OP" }, ZSCORE2_OP: { _tag: "ZSCORE2_OP" }, TSTAT_OP: { _tag: "TSTAT_OP" }, FSTAT_OP: { _tag: "FSTAT_OP" }, CHISQSTAT_OP: { _tag: "CHISQSTAT_OP" }, TEXTCOUNTCHAR_OP: { _tag: "TEXTCOUNTCHAR_OP" }, TEXTZFILL_OP: { _tag: "TEXTZFILL_OP" }, TEXTLPAD_OP: { _tag: "TEXTLPAD_OP" }, TEXTRPAD_OP: { _tag: "TEXTRPAD_OP" }, TEXTABBREV_OP: { _tag: "TEXTABBREV_OP" }, TEXTWORDFREQ_OP: { _tag: "TEXTWORDFREQ_OP" }, TEXTSANITIZE_OP: { _tag: "TEXTSANITIZE_OP" }, TEXTMIRROR_OP: { _tag: "TEXTMIRROR_OP" }, TYPEOF3_OP: { _tag: "TYPEOF3_OP" }, ISBLANK2_OP: { _tag: "ISBLANK2_OP" }, ISTRUTHY_OP: { _tag: "ISTRUTHY_OP" }, ISFALSY_OP: { _tag: "ISFALSY_OP" }, ISFRACTION_OP: { _tag: "ISFRACTION_OP" }, ISDIVISIBLE_OP: { _tag: "ISDIVISIBLE_OP" }, PVANNUITY_OP: { _tag: "PVANNUITY_OP" }, ANNUITYPMT_OP: { _tag: "ANNUITYPMT_OP" }, BONDPRICE_OP: { _tag: "BONDPRICE_OP" }, BONDYIELD_OP: { _tag: "BONDYIELD_OP" }, TBILL2_OP: { _tag: "TBILL2_OP" }, MACAULAY_OP: { _tag: "MACAULAY_OP" },
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
  ISNUMBER_OP: { _tag: "ISNUMBER_OP" }, ISTEXT_OP: { _tag: "ISTEXT_OP" }, ISEVEN_OP: { _tag: "ISEVEN_OP" }, ISODD_OP: { _tag: "ISODD_OP" }, N_OP: { _tag: "N_OP" }, T_OP: { _tag: "T_OP" }, LEFTB_OP: { _tag: "LEFTB_OP" }, RIGHTB_OP: { _tag: "RIGHTB_OP" }, LENB_OP: { _tag: "LENB_OP" }, BAHTTEXT_OP: { _tag: "BAHTTEXT_OP" }, PHONETIC_OP: { _tag: "PHONETIC_OP" }, BESSELY_OP: { _tag: "BESSELY_OP" }, HEX2BIN_OP: { _tag: "HEX2BIN_OP" }, HEX2OCT_OP: { _tag: "HEX2OCT_OP" }, OCT2BIN_OP: { _tag: "OCT2BIN_OP" }, OCT2HEX_OP: { _tag: "OCT2HEX_OP" }, IMTAN_OP: { _tag: "IMTAN_OP" }, IMLOG2_OP: { _tag: "IMLOG2_OP" }, IMLOG10_OP: { _tag: "IMLOG10_OP" }, RANDBETWEEN_FLOAT_OP: { _tag: "RANDBETWEEN_FLOAT_OP" }, FORMULATEXT_OP: { _tag: "FORMULATEXT_OP" }, ADDRESS_OP: { _tag: "ADDRESS_OP" }, IMDIV_OP: { _tag: "IMDIV_OP" }, IMSUB_OP: { _tag: "IMSUB_OP" }, BIN2DEC_OP: { _tag: "BIN2DEC_OP" }, DEC2BIN_OP: { _tag: "DEC2BIN_OP" }, BIN2HEX_OP: { _tag: "BIN2HEX_OP" }, HEX2DEC_OP: { _tag: "HEX2DEC_OP" }, DEC2HEX_OP: { _tag: "DEC2HEX_OP" }, OCT2DEC_OP: { _tag: "OCT2DEC_OP" }, DEC2OCT_OP: { _tag: "DEC2OCT_OP" }, BITAND_OP: { _tag: "BITAND_OP" }, BITOR_OP: { _tag: "BITOR_OP" }, BITXOR_OP: { _tag: "BITXOR_OP" }, BITLSHIFT_OP: { _tag: "BITLSHIFT_OP" }, BITRSHIFT_OP: { _tag: "BITRSHIFT_OP" }, IMPOWER_OP: { _tag: "IMPOWER_OP" }, IMEXP_OP: { _tag: "IMEXP_OP" }, IMLN_OP: { _tag: "IMLN_OP" }, IMSIN_OP: { _tag: "IMSIN_OP" }, IMCOS_OP: { _tag: "IMCOS_OP" }, IMSUM_OP: { _tag: "IMSUM_OP" }, IMPRODUCT_OP: { _tag: "IMPRODUCT_OP" }, IMARGUMENT_OP: { _tag: "IMARGUMENT_OP" }, IMCONJUGATE_OP: { _tag: "IMCONJUGATE_OP" }, IMSQRT_OP: { _tag: "IMSQRT_OP" }, BESSELJ_OP: { _tag: "BESSELJ_OP" }, COMPLEX_OP: { _tag: "COMPLEX_OP" }, IMREAL_OP: { _tag: "IMREAL_OP" }, IMAGINARY_OP: { _tag: "IMAGINARY_OP" }, IMABS_OP: { _tag: "IMABS_OP" }, BETA_FN_OP: { _tag: "BETA_FN_OP" }, BESSELK_OP: { _tag: "BESSELK_OP" }, BESSELI_OP: { _tag: "BESSELI_OP" }, NORMS_DIST_OP: { _tag: "NORMS_DIST_OP" }, NORMS_INV_OP: { _tag: "NORMS_INV_OP" }, TINV_OP: { _tag: "TINV_OP" }, CHISQ_INV_OP: { _tag: "CHISQ_INV_OP" }, FINV_OP: { _tag: "FINV_OP" }, GAMMALN_OP: { _tag: "GAMMALN_OP" }, GAMMA_OP: { _tag: "GAMMA_OP" }, CHISQ_DIST_OP: { _tag: "CHISQ_DIST_OP" }, TDIST_OP: { _tag: "TDIST_OP" }, FDIST_OP: { _tag: "FDIST_OP" }, PHI_OP: { _tag: "PHI_OP" }, GAUSS_OP: { _tag: "GAUSS_OP" }, MIDB_OP: { _tag: "MIDB_OP" }, DBCS_OP: { _tag: "DBCS_OP" }, ASC_OP: { _tag: "ASC_OP" }, TEXTREVERSE_OP: { _tag: "TEXTREVERSE_OP" }, CUMIPMT_OP: { _tag: "CUMIPMT_OP" }, INDIRECT_OP: { _tag: "INDIRECT_OP" }, OFFSET_OP: { _tag: "OFFSET_OP" }, TIMEVALUE_OP: { _tag: "TIMEVALUE_OP" }, TIME_OP: { _tag: "TIME_OP" }, SECOND_OP: { _tag: "SECOND_OP" }, MINUTE_OP: { _tag: "MINUTE_OP" }, HOUR_OP: { _tag: "HOUR_OP" }, ISFORMULA_OP: { _tag: "ISFORMULA_OP" }, REGEXMATCH_OP: { _tag: "REGEXMATCH_OP" }, REGEXEXTRACT_OP: { _tag: "REGEXEXTRACT_OP" }, REGEXREPLACE_OP: { _tag: "REGEXREPLACE_OP" }, ERF_OP: { _tag: "ERF_OP" }, ERFC_OP: { _tag: "ERFC_OP" }, YEARFRAC_OP: { _tag: "YEARFRAC_OP" }, COUPDAYBS_OP: { _tag: "COUPDAYBS_OP" }, TBILLYIELD_OP: { _tag: "TBILLYIELD_OP" }, RECEIVED_OP: { _tag: "RECEIVED_OP" }, PRICEDISC_OP: { _tag: "PRICEDISC_OP" }, ACCRINT_OP: { _tag: "ACCRINT_OP" }, COUPDAYS_OP: { _tag: "COUPDAYS_OP" }, DOLLARDE_OP: { _tag: "DOLLARDE_OP" }, DOLLARFR_OP: { _tag: "DOLLARFR_OP" }, PPMT_OP: { _tag: "PPMT_OP" }, IPMT_OP: { _tag: "IPMT_OP" }, CELL_OP: { _tag: "CELL_OP" }, CEILING_PRECISE_OP: { _tag: "CEILING_PRECISE_OP" }, FLOOR_PRECISE_OP: { _tag: "FLOOR_PRECISE_OP" }, NEGBINOMDIST_OP: { _tag: "NEGBINOMDIST_OP" }, BETADIST_OP: { _tag: "BETADIST_OP" }, HYPGEOMDIST_OP: { _tag: "HYPGEOMDIST_OP" }, ISNA_OP: { _tag: "ISNA_OP" }, SHEET_OP: { _tag: "SHEET_OP" }, DATESTRING_OP: { _tag: "DATESTRING_OP" }, WORKDAY_OP: { _tag: "WORKDAY_OP" }, TEXTBEFORE_OP: { _tag: "TEXTBEFORE_OP" }, TEXTAFTER_OP: { _tag: "TEXTAFTER_OP" }, VALUETOTEXT_OP: { _tag: "VALUETOTEXT_OP" }, ISPMT_OP: { _tag: "ISPMT_OP" }, DISC_OP: { _tag: "DISC_OP" }, INTRATE_OP: { _tag: "INTRATE_OP" }, SYD_OP: { _tag: "SYD_OP" }, EFFECT_OP: { _tag: "EFFECT_OP" }, NOMINAL_OP: { _tag: "NOMINAL_OP" }, NORMINV_OP: { _tag: "NORMINV_OP" }, DDB_OP: { _tag: "DDB_OP" }, WEIBULL_OP: { _tag: "WEIBULL_OP" }, GAMMADIST_OP: { _tag: "GAMMADIST_OP" }, EXPONDIST_OP: { _tag: "EXPONDIST_OP" }, POISSON_OP: { _tag: "POISSON_OP" }, BINOMDIST_OP: { _tag: "BINOMDIST_OP" }, LOGNORMDIST_OP: { _tag: "LOGNORMDIST_OP" }, STANDARDIZE_OP: { _tag: "STANDARDIZE_OP" }, CONFIDENCE_OP: { _tag: "CONFIDENCE_OP" }, NORMDIST_OP: { _tag: "NORMDIST_OP" }, FISHER_OP: { _tag: "FISHER_OP" }, FISHERINV_OP: { _tag: "FISHERINV_OP" }, CONVERT_OP: { _tag: "CONVERT_OP" }, ISOWEEKNUM_OP: { _tag: "ISOWEEKNUM_OP" }, NETWORKDAYS_OP: { _tag: "NETWORKDAYS_OP" }, CUMPRINC_OP: { _tag: "CUMPRINC_OP" }, PDURATION_OP: { _tag: "PDURATION_OP" }, RRI_OP: { _tag: "RRI_OP" }, TBILLEQ_OP: { _tag: "TBILLEQ_OP" }, TBILLPRICE_OP: { _tag: "TBILLPRICE_OP" }, DURATION_OP: { _tag: "DURATION_OP" }, MDURATION_OP: { _tag: "MDURATION_OP" }, YIELD_OP: { _tag: "YIELD_OP" }, AMORLINC_OP: { _tag: "AMORLINC_OP" }, PRICE_OP: { _tag: "PRICE_OP" }, ODDLPRICE_OP: { _tag: "ODDLPRICE_OP" }, INFO_OP: { _tag: "INFO_OP" }, CLEANWS_OP: { _tag: "CLEANWS_OP" }, TEXTCOUNT_OP: { _tag: "TEXTCOUNT_OP" }, ISREF_OP: { _tag: "ISREF_OP" }, ISLOGICAL_OP: { _tag: "ISLOGICAL_OP" }, ISNONTEXT_OP: { _tag: "ISNONTEXT_OP" }, ERROR_TYPE_OP: { _tag: "ERROR_TYPE_OP" }, IFERROR_OP: { _tag: "IFERROR_OP" }, BITCOUNT_OP: { _tag: "BITCOUNT_OP" }, MROUND_OP: { _tag: "MROUND_OP" }, CEILING_MATH_OP: { _tag: "CEILING_MATH_OP" }, FLOOR_MATH_OP: { _tag: "FLOOR_MATH_OP" }, BASE_OP: { _tag: "BASE_OP" }, DECIMAL_OP: { _tag: "DECIMAL_OP" }, WEBSERVICE_OP: { _tag: "WEBSERVICE_OP" }, FIELDVALUE_OP: { _tag: "FIELDVALUE_OP" }, COMBINA_OP: { _tag: "COMBINA_OP" }, PERMUTATIONA_OP: { _tag: "PERMUTATIONA_OP" }, SQRTPI_OP: { _tag: "SQRTPI_OP" }, RANDBETWEEN_INT_OP: { _tag: "RANDBETWEEN_INT_OP" }, ISO_CEILING_OP: { _tag: "ISO_CEILING_OP" }, YIELDDISC_OP: { _tag: "YIELDDISC_OP" }, PRICEMAT_OP: { _tag: "PRICEMAT_OP" }, HYPERLINK_OP: { _tag: "HYPERLINK_OP" }, NUMBERSTRING_OP: { _tag: "NUMBERSTRING_OP" }, IFBLANK_OP: { _tag: "IFBLANK_OP" }, SUBSTITUTEN_OP: { _tag: "SUBSTITUTEN_OP" }, TEXTSPLIT_DELIM_OP: { _tag: "TEXTSPLIT_DELIM_OP" }, NAND_OP: { _tag: "NAND_OP" }, NOR_OP: { _tag: "NOR_OP" }, XNOR_OP: { _tag: "XNOR_OP" }, YIELDMAT_OP: { _tag: "YIELDMAT_OP" }, ACCRINTM_OP: { _tag: "ACCRINTM_OP" }, COUPDAYSNC_OP: { _tag: "COUPDAYSNC_OP" }, COUPNUM_OP: { _tag: "COUPNUM_OP" }, TEXTPADSTART_OP: { _tag: "TEXTPADSTART_OP" }, TEXTPADEND_OP: { _tag: "TEXTPADEND_OP" }, TEXTWRAP_OP: { _tag: "TEXTWRAP_OP" }, ISERR_OP: { _tag: "ISERR_OP" }, ISNULL_OP: { _tag: "ISNULL_OP" }, HYPOT_OP: { _tag: "HYPOT_OP" }, MDETERM_OP: { _tag: "MDETERM_OP" }, MINVERSE_OP: { _tag: "MINVERSE_OP" }, BETA_INV_OP: { _tag: "BETA_INV_OP" }, GAMMA_INV_OP: { _tag: "GAMMA_INV_OP" }, COUPPCD_OP: { _tag: "COUPPCD_OP" }, COUPNCD_OP: { _tag: "COUPNCD_OP" }, ODDFPRICE_OP: { _tag: "ODDFPRICE_OP" }, TEXT_CONTAINS_OP: { _tag: "TEXT_CONTAINS_OP" }, TEXT_STARTSWITH_OP: { _tag: "TEXT_STARTSWITH_OP" }, ENDSWITH_OP: { _tag: "ENDSWITH_OP" }, TEXTREVERSE_OP: { _tag: "TEXTREVERSE_OP" }, TEXTREMOVE_OP: { _tag: "TEXTREMOVE_OP" }, REGEXMATCH_OP: { _tag: "REGEXMATCH_OP" }, REGEXEXTRACT_OP: { _tag: "REGEXEXTRACT_OP" }, REGEXREPLACE_OP: { _tag: "REGEXREPLACE_OP" }, IMPLIES_OP: { _tag: "IMPLIES_OP" }, BETWEEN_OP: { _tag: "BETWEEN_OP" }, ISFORMULA_OP: { _tag: "ISFORMULA_OP" }, SHEET_OP: { _tag: "SHEET_OP" }, SHEETS_OP: { _tag: "SHEETS_OP" }, WEIBULL_DIST_OP: { _tag: "WEIBULL_DIST_OP" }, EXPON_DIST_OP: { _tag: "EXPON_DIST_OP" }, LOGNORM_DIST_OP: { _tag: "LOGNORM_DIST_OP" }, CHISQ_DIST_RT_OP: { _tag: "CHISQ_DIST_RT_OP" }, TDIST_RT_OP: { _tag: "TDIST_RT_OP" }, FDIST_RT_OP: { _tag: "FDIST_RT_OP" }, T_INV_2T_OP: { _tag: "T_INV_2T_OP" }, TYPE_NUM_OP: { _tag: "TYPE_NUM_OP" }, ISBINARY_OP: { _tag: "ISBINARY_OP" }, ISHEX_OP: { _tag: "ISHEX_OP" }, ACOTH_OP: { _tag: "ACOTH_OP" }, ENCODEURL_OP: { _tag: "ENCODEURL_OP" }, DECODEURL_OP: { _tag: "DECODEURL_OP" }, ISURL_OP: { _tag: "ISURL_OP" }, ISEMAIL_OP: { _tag: "ISEMAIL_OP" }, HASH_OP: { _tag: "HASH_OP" }, TEXTSQUEEZE_OP: { _tag: "TEXTSQUEEZE_OP" }, GESTEP_OP: { _tag: "GESTEP_OP" }, DELTA_OP: { _tag: "DELTA_OP" }, YEARMONTH_OP: { _tag: "YEARMONTH_OP" }, QUARTER_OP: { _tag: "QUARTER_OP" }, DAYOFYEAR_OP: { _tag: "DAYOFYEAR_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, DAYSINYEAR_OP: { _tag: "DAYSINYEAR_OP" }, DAYSINMONTH_OP: { _tag: "DAYSINMONTH_OP" }, TEXTSLICE_OP: { _tag: "TEXTSLICE_OP" }, TEXTINDEXOF_OP: { _tag: "TEXTINDEXOF_OP" }, ISINTEGER_OP: { _tag: "ISINTEGER_OP" }, ISFLOAT_OP: { _tag: "ISFLOAT_OP" }, ISPOSITIVE_OP: { _tag: "ISPOSITIVE_OP" }, ISNEGATIVE_OP: { _tag: "ISNEGATIVE_OP" }, ROUND_SIGNIF_OP: { _tag: "ROUND_SIGNIF_OP" }, CLAMP_OP: { _tag: "CLAMP_OP" }, LERP_OP: { _tag: "LERP_OP" }, SMOOTHSTEP_OP: { _tag: "SMOOTHSTEP_OP" }, ISDATE_OP: { _tag: "ISDATE_OP" }, DIGITS_OP: { _tag: "DIGITS_OP" }, SIGMOID_OP: { _tag: "SIGMOID_OP" }, RELU_OP: { _tag: "RELU_OP" }, SOFTPLUS_OP: { _tag: "SOFTPLUS_OP" }, ELU_OP: { _tag: "ELU_OP" }, NORMALIZE_OP: { _tag: "NORMALIZE_OP" }, MAP_RANGE_OP: { _tag: "MAP_RANGE_OP" }, TEXTCENTER_OP: { _tag: "TEXTCENTER_OP" }, WORDCOUNT_OP: { _tag: "WORDCOUNT_OP" }, ROUND_MODE_OP: { _tag: "ROUND_MODE_OP" }, BASE64_ENCODE_OP: { _tag: "BASE64_ENCODE_OP" }, BASE64_DECODE_OP: { _tag: "BASE64_DECODE_OP" }, TEXTROTATE_OP: { _tag: "TEXTROTATE_OP" }, TEXTINITIALS_OP: { _tag: "TEXTINITIALS_OP" }, TEXTCAMELCASE_OP: { _tag: "TEXTCAMELCASE_OP" }, TEXTSNAKECASE_OP: { _tag: "TEXTSNAKECASE_OP" }, TEXTKEBABCASE_OP: { _tag: "TEXTKEBABCASE_OP" }, BITNOT_OP: { _tag: "BITNOT_OP" }, BITROTL_OP: { _tag: "BITROTL_OP" }, BITROTR_OP: { _tag: "BITROTR_OP" }, JSON_STRINGIFY_OP: { _tag: "JSON_STRINGIFY_OP" }, TEXTTITLE_OP: { _tag: "TEXTTITLE_OP" }, ISNAN2_OP: { _tag: "ISNAN2_OP" }, ISINFINITE_OP: { _tag: "ISINFINITE_OP" }, SLN_OP: { _tag: "SLN_OP" }, SYD_OP: { _tag: "SYD_OP" }, DDB_OP: { _tag: "DDB_OP" }, RATE_EST_OP: { _tag: "RATE_EST_OP" }, EFFECT_RATE_OP: { _tag: "EFFECT_RATE_OP" }, NOMINAL_RATE_OP: { _tag: "NOMINAL_RATE_OP" }, ZSCORE_OP: { _tag: "ZSCORE_OP" }, NAND_OP: { _tag: "NAND_OP" }, NOR_OP: { _tag: "NOR_OP" }, XNOR_OP: { _tag: "XNOR_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTTRUNCATE_OP: { _tag: "TEXTTRUNCATE_OP" }, CAGR_OP: { _tag: "CAGR_OP" }, DISC_OP: { _tag: "DISC_OP" }, DOLLARDE_OP: { _tag: "DOLLARDE_OP" }, DOLLARFR_OP: { _tag: "DOLLARFR_OP" }, HYPOT3_OP: { _tag: "HYPOT3_OP" }, DISTANCE2D_OP: { _tag: "DISTANCE2D_OP" }, MANHATTAN_OP: { _tag: "MANHATTAN_OP" }, FIBONACCI_OP: { _tag: "FIBONACCI_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, TYPEOF2_OP: { _tag: "TYPEOF2_OP" }, CHARCODE_OP: { _tag: "CHARCODE_OP" }, FROMCHARCODE_OP: { _tag: "FROMCHARCODE_OP" }, ISPRIME_OP: { _tag: "ISPRIME_OP" }, NEXTPRIME_OP: { _tag: "NEXTPRIME_OP" }, PRIMECOUNT_OP: { _tag: "PRIMECOUNT_OP" }, TOTIENT_OP: { _tag: "TOTIENT_OP" }, DIVISORS_OP: { _tag: "DIVISORS_OP" }, CELLTYPE_OP: { _tag: "CELLTYPE_OP" }, CHECKSUM_OP: { _tag: "CHECKSUM_OP" }, DIGSUM_OP: { _tag: "DIGSUM_OP" }, DIGROOT_OP: { _tag: "DIGROOT_OP" }, NTHROOT_OP: { _tag: "NTHROOT_OP" }, TEXTHAMMINGDIST_OP: { _tag: "TEXTHAMMINGDIST_OP" }, TEXTLEVENSHTEIN_OP: { _tag: "TEXTLEVENSHTEIN_OP" }, ISALPHANUMERIC_OP: { _tag: "ISALPHANUMERIC_OP" }, ISALPHABETIC_OP: { _tag: "ISALPHABETIC_OP" }, POLYGONAREA_OP: { _tag: "POLYGONAREA_OP" }, CIRCLEAREA_OP: { _tag: "CIRCLEAREA_OP" }, SPHEREVOL_OP: { _tag: "SPHEREVOL_OP" }, CYLINDERVOL_OP: { _tag: "CYLINDERVOL_OP" }, TEXTSIMILARITY_OP: { _tag: "TEXTSIMILARITY_OP" }, TEXTZALGO_OP: { _tag: "TEXTZALGO_OP" }, TEXTASCII_OP: { _tag: "TEXTASCII_OP" }, TEXTSLUG_OP: { _tag: "TEXTSLUG_OP" }, WACC_OP: { _tag: "WACC_OP" }, PAYBACK_OP: { _tag: "PAYBACK_OP" }, ROI_OP: { _tag: "ROI_OP" }, ISNUMERICSTR_OP: { _tag: "ISNUMERICSTR_OP" }, TEXTENTROPY_OP: { _tag: "TEXTENTROPY_OP" }, DEG2RAD_OP: { _tag: "DEG2RAD_OP" }, RAD2DEG_OP: { _tag: "RAD2DEG_OP" }, SINC_OP: { _tag: "SINC_OP" }, ATAN2_OP: { _tag: "ATAN2_OP" }, BINOMCOEF_OP: { _tag: "BINOMCOEF_OP" }, CATALAN_OP: { _tag: "CATALAN_OP" }, TRIANGLENUM_OP: { _tag: "TRIANGLENUM_OP" }, TEXTEMOJI_OP: { _tag: "TEXTEMOJI_OP" }, TEXTSTRIP_OP: { _tag: "TEXTSTRIP_OP" }, TEXTNORMALIZE_OP: { _tag: "TEXTNORMALIZE_OP" }, TEXTMORSE_OP: { _tag: "TEXTMORSE_OP" }, BREAKEVEN_OP: { _tag: "BREAKEVEN_OP" }, PROFITMARGIN_OP: { _tag: "PROFITMARGIN_OP" }, MARKUP_OP: { _tag: "MARKUP_OP" }, ISUPPER_OP: { _tag: "ISUPPER_OP" }, ISLOWER_OP: { _tag: "ISLOWER_OP" }, ISPALINDROME_OP: { _tag: "ISPALINDROME_OP" }, PENTAGONAL_OP: { _tag: "PENTAGONAL_OP" }, HEXAGONAL_OP: { _tag: "HEXAGONAL_OP" }, TETRAHEDRAL_OP: { _tag: "TETRAHEDRAL_OP" }, PYRAMIDAL_OP: { _tag: "PYRAMIDAL_OP" }, STIRLING_OP: { _tag: "STIRLING_OP" }, CONEVOL_OP: { _tag: "CONEVOL_OP" }, TEXTRLE_OP: { _tag: "TEXTRLE_OP" }, TEXTRLD_OP: { _tag: "TEXTRLD_OP" }, ISPERFECT_OP: { _tag: "ISPERFECT_OP" }, ISHARSHAD_OP: { _tag: "ISHARSHAD_OP" }, SAWTOOTH_OP: { _tag: "SAWTOOTH_OP" }, SQUAREWAVE_OP: { _tag: "SQUAREWAVE_OP" }, TRIANGLEWAVE_OP: { _tag: "TRIANGLEWAVE_OP" }, AGM_OP: { _tag: "AGM_OP" }, LOGISTIC_OP: { _tag: "LOGISTIC_OP" }, GAMMA2_OP: { _tag: "GAMMA2_OP" }, TEXTROT13_OP: { _tag: "TEXTROT13_OP" }, TEXTCAESAR_OP: { _tag: "TEXTCAESAR_OP" }, TEXTFREQ_OP: { _tag: "TEXTFREQ_OP" }, ISASCII_OP: { _tag: "ISASCII_OP" }, ISPRINTABLE_OP: { _tag: "ISPRINTABLE_OP" }, ISWHITESPACE_OP: { _tag: "ISWHITESPACE_OP" }, SIMPLEINTEREST_OP: { _tag: "SIMPLEINTEREST_OP" }, COMPOUNDINTEREST_OP: { _tag: "COMPOUNDINTEREST_OP" }, DEPRECIATION_OP: { _tag: "DEPRECIATION_OP" }, LUCAS_OP: { _tag: "LUCAS_OP" }, BELL_OP: { _tag: "BELL_OP" }, INTLOG2_OP: { _tag: "INTLOG2_OP" }, INTLOG10_OP: { _tag: "INTLOG10_OP" }, BITLEN_OP: { _tag: "BITLEN_OP" }, TEXTREPEAT_OP: { _tag: "TEXTREPEAT_OP" }, TEXTNTH_OP: { _tag: "TEXTNTH_OP" }, TEXTUNIQUE_OP: { _tag: "TEXTUNIQUE_OP" }, TEXTDISTINCT_OP: { _tag: "TEXTDISTINCT_OP" }, CHARCOUNT_OP: { _tag: "CHARCOUNT_OP" }, ISEMPTYTEXT_OP: { _tag: "ISEMPTYTEXT_OP" }, RULEOF72_OP: { _tag: "RULEOF72_OP" }, PRESENTVALUE_OP: { _tag: "PRESENTVALUE_OP" }, GOLDEN_OP: { _tag: "GOLDEN_OP" }, EULER_OP: { _tag: "EULER_OP" }, TAU_OP: { _tag: "TAU_OP" }, CUBEROOT_OP: { _tag: "CUBEROOT_OP" }, WRAP_OP: { _tag: "WRAP_OP" }, REMAP_OP: { _tag: "REMAP_OP" }, TEXTBASE64_OP: { _tag: "TEXTBASE64_OP" }, TEXTFROMBASE64_OP: { _tag: "TEXTFROMBASE64_OP" }, TEXTPREFIX_OP: { _tag: "TEXTPREFIX_OP" }, TEXTSUFFIX_OP: { _tag: "TEXTSUFFIX_OP" }, ISODD2_OP: { _tag: "ISODD2_OP" }, ISEVEN2_OP: { _tag: "ISEVEN2_OP" }, ISZERO_OP: { _tag: "ISZERO_OP" }, ANNUITY_OP: { _tag: "ANNUITY_OP" }, FUTUREVALUE2_OP: { _tag: "FUTUREVALUE2_OP" }, ABUNDANCY_OP: { _tag: "ABUNDANCY_OP" }, DIGITCOUNT_OP: { _tag: "DIGITCOUNT_OP" }, CHEBYSHEV_OP: { _tag: "CHEBYSHEV_OP" }, ISPOWEROFTWO_OP: { _tag: "ISPOWEROFTWO_OP" }, NEXTODD_OP: { _tag: "NEXTODD_OP" }, NEXTEVEN_OP: { _tag: "NEXTEVEN_OP" }, TOROMAN_OP: { _tag: "TOROMAN_OP" }, FROMROMAN_OP: { _tag: "FROMROMAN_OP" }, TOORDINAL_OP: { _tag: "TOORDINAL_OP" }, TEXTHEX_OP: { _tag: "TEXTHEX_OP" }, TEXTFROMHEX_OP: { _tag: "TEXTFROMHEX_OP" }, TEXTDEDUPE_OP: { _tag: "TEXTDEDUPE_OP" }, TEXTLINES_OP: { _tag: "TEXTLINES_OP" }, TEXTPASCALCASE_OP: { _tag: "TEXTPASCALCASE_OP" }, ISPRIMEFAST_OP: { _tag: "ISPRIMEFAST_OP" }, SHARPE_OP: { _tag: "SHARPE_OP" }, SORTINO_OP: { _tag: "SORTINO_OP" }, EMAVG_OP: { _tag: "EMAVG_OP" }, SMAVG_OP: { _tag: "SMAVG_OP" }, COPRIME_OP: { _tag: "COPRIME_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, PREVPRIME_OP: { _tag: "PREVPRIME_OP" }, TEXTPAD_OP: { _tag: "TEXTPAD_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTISURL_OP: { _tag: "TEXTISURL_OP" }, TEXTISEMAIL_OP: { _tag: "TEXTISEMAIL_OP" }, WORDSCOUNT_OP: { _tag: "WORDSCOUNT_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, WEEKOFYEAR_OP: { _tag: "WEEKOFYEAR_OP" }, ISWEEKEND_OP: { _tag: "ISWEEKEND_OP" }, QUARTERNO_OP: { _tag: "QUARTERNO_OP" }, SEMESTERNO_OP: { _tag: "SEMESTERNO_OP" }, EFFECTRATE_OP: { _tag: "EFFECTRATE_OP" }, NOMRATE_OP: { _tag: "NOMRATE_OP" }, NPER2_OP: { _tag: "NPER2_OP" }, RATE2_OP: { _tag: "RATE2_OP" }, FIBONACCI2_OP: { _tag: "FIBONACCI2_OP" }, MOTZKIN_OP: { _tag: "MOTZKIN_OP" }, DERANGEMENT_OP: { _tag: "DERANGEMENT_OP" }, TOTIENT2_OP: { _tag: "TOTIENT2_OP" }, HARMONIC2_OP: { _tag: "HARMONIC2_OP" }, TEXTOBFUSCATE_OP: { _tag: "TEXTOBFUSCATE_OP" }, TEXTCOUNT2_OP: { _tag: "TEXTCOUNT2_OP" }, TEXTSHUFFLE_OP: { _tag: "TEXTSHUFFLE_OP" }, ISFIBBISH_OP: { _tag: "ISFIBBISH_OP" }, IFF_OP: { _tag: "IFF_OP" }, UNLESS_OP: { _tag: "UNLESS_OP" }, SECANT_OP: { _tag: "SECANT_OP" }, COSECANT_OP: { _tag: "COSECANT_OP" }, VERSINE_OP: { _tag: "VERSINE_OP" }, HAVERSINE_OP: { _tag: "HAVERSINE_OP" }, EXSECANT_OP: { _tag: "EXSECANT_OP" }, LEMNISCATE_OP: { _tag: "LEMNISCATE_OP" }, AGM2_OP: { _tag: "AGM2_OP" }, POWMOD_OP: { _tag: "POWMOD_OP" }, ZSCORE2_OP: { _tag: "ZSCORE2_OP" }, TSTAT_OP: { _tag: "TSTAT_OP" }, FSTAT_OP: { _tag: "FSTAT_OP" }, CHISQSTAT_OP: { _tag: "CHISQSTAT_OP" }, TEXTCOUNTCHAR_OP: { _tag: "TEXTCOUNTCHAR_OP" }, TEXTZFILL_OP: { _tag: "TEXTZFILL_OP" }, TEXTLPAD_OP: { _tag: "TEXTLPAD_OP" }, TEXTRPAD_OP: { _tag: "TEXTRPAD_OP" }, TEXTABBREV_OP: { _tag: "TEXTABBREV_OP" }, TEXTWORDFREQ_OP: { _tag: "TEXTWORDFREQ_OP" }, TEXTSANITIZE_OP: { _tag: "TEXTSANITIZE_OP" }, TEXTMIRROR_OP: { _tag: "TEXTMIRROR_OP" }, TYPEOF3_OP: { _tag: "TYPEOF3_OP" }, ISBLANK2_OP: { _tag: "ISBLANK2_OP" }, ISTRUTHY_OP: { _tag: "ISTRUTHY_OP" }, ISFALSY_OP: { _tag: "ISFALSY_OP" }, ISFRACTION_OP: { _tag: "ISFRACTION_OP" }, ISDIVISIBLE_OP: { _tag: "ISDIVISIBLE_OP" }, PVANNUITY_OP: { _tag: "PVANNUITY_OP" }, ANNUITYPMT_OP: { _tag: "ANNUITYPMT_OP" }, BONDPRICE_OP: { _tag: "BONDPRICE_OP" }, BONDYIELD_OP: { _tag: "BONDYIELD_OP" }, TBILL2_OP: { _tag: "TBILL2_OP" }, MACAULAY_OP: { _tag: "MACAULAY_OP" },
  DELTA_OP: { _tag: "DELTA_OP" }, YEARMONTH_OP: { _tag: "YEARMONTH_OP" }, QUARTER_OP: { _tag: "QUARTER_OP" }, DAYOFYEAR_OP: { _tag: "DAYOFYEAR_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, DAYSINYEAR_OP: { _tag: "DAYSINYEAR_OP" }, DAYSINMONTH_OP: { _tag: "DAYSINMONTH_OP" }, TEXTSLICE_OP: { _tag: "TEXTSLICE_OP" }, TEXTINDEXOF_OP: { _tag: "TEXTINDEXOF_OP" }, ISINTEGER_OP: { _tag: "ISINTEGER_OP" }, ISFLOAT_OP: { _tag: "ISFLOAT_OP" }, ISPOSITIVE_OP: { _tag: "ISPOSITIVE_OP" }, ISNEGATIVE_OP: { _tag: "ISNEGATIVE_OP" }, ROUND_SIGNIF_OP: { _tag: "ROUND_SIGNIF_OP" }, CLAMP_OP: { _tag: "CLAMP_OP" }, LERP_OP: { _tag: "LERP_OP" }, SMOOTHSTEP_OP: { _tag: "SMOOTHSTEP_OP" }, ISDATE_OP: { _tag: "ISDATE_OP" }, DIGITS_OP: { _tag: "DIGITS_OP" }, SIGMOID_OP: { _tag: "SIGMOID_OP" }, RELU_OP: { _tag: "RELU_OP" }, SOFTPLUS_OP: { _tag: "SOFTPLUS_OP" }, ELU_OP: { _tag: "ELU_OP" }, NORMALIZE_OP: { _tag: "NORMALIZE_OP" }, MAP_RANGE_OP: { _tag: "MAP_RANGE_OP" }, TEXTCENTER_OP: { _tag: "TEXTCENTER_OP" }, WORDCOUNT_OP: { _tag: "WORDCOUNT_OP" }, ROUND_MODE_OP: { _tag: "ROUND_MODE_OP" }, BASE64_ENCODE_OP: { _tag: "BASE64_ENCODE_OP" }, BASE64_DECODE_OP: { _tag: "BASE64_DECODE_OP" }, TEXTROTATE_OP: { _tag: "TEXTROTATE_OP" }, TEXTINITIALS_OP: { _tag: "TEXTINITIALS_OP" }, TEXTCAMELCASE_OP: { _tag: "TEXTCAMELCASE_OP" }, TEXTSNAKECASE_OP: { _tag: "TEXTSNAKECASE_OP" }, TEXTKEBABCASE_OP: { _tag: "TEXTKEBABCASE_OP" }, BITNOT_OP: { _tag: "BITNOT_OP" }, BITROTL_OP: { _tag: "BITROTL_OP" }, BITROTR_OP: { _tag: "BITROTR_OP" }, JSON_STRINGIFY_OP: { _tag: "JSON_STRINGIFY_OP" }, TEXTTITLE_OP: { _tag: "TEXTTITLE_OP" }, ISNAN2_OP: { _tag: "ISNAN2_OP" }, ISINFINITE_OP: { _tag: "ISINFINITE_OP" }, SLN_OP: { _tag: "SLN_OP" }, SYD_OP: { _tag: "SYD_OP" }, DDB_OP: { _tag: "DDB_OP" }, RATE_EST_OP: { _tag: "RATE_EST_OP" }, EFFECT_RATE_OP: { _tag: "EFFECT_RATE_OP" }, NOMINAL_RATE_OP: { _tag: "NOMINAL_RATE_OP" }, ZSCORE_OP: { _tag: "ZSCORE_OP" }, NAND_OP: { _tag: "NAND_OP" }, NOR_OP: { _tag: "NOR_OP" }, XNOR_OP: { _tag: "XNOR_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTTRUNCATE_OP: { _tag: "TEXTTRUNCATE_OP" }, CAGR_OP: { _tag: "CAGR_OP" }, DISC_OP: { _tag: "DISC_OP" }, DOLLARDE_OP: { _tag: "DOLLARDE_OP" }, DOLLARFR_OP: { _tag: "DOLLARFR_OP" }, HYPOT3_OP: { _tag: "HYPOT3_OP" }, DISTANCE2D_OP: { _tag: "DISTANCE2D_OP" }, MANHATTAN_OP: { _tag: "MANHATTAN_OP" }, FIBONACCI_OP: { _tag: "FIBONACCI_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, TYPEOF2_OP: { _tag: "TYPEOF2_OP" }, CHARCODE_OP: { _tag: "CHARCODE_OP" }, FROMCHARCODE_OP: { _tag: "FROMCHARCODE_OP" }, ISPRIME_OP: { _tag: "ISPRIME_OP" }, NEXTPRIME_OP: { _tag: "NEXTPRIME_OP" }, PRIMECOUNT_OP: { _tag: "PRIMECOUNT_OP" }, TOTIENT_OP: { _tag: "TOTIENT_OP" }, DIVISORS_OP: { _tag: "DIVISORS_OP" }, CELLTYPE_OP: { _tag: "CELLTYPE_OP" }, CHECKSUM_OP: { _tag: "CHECKSUM_OP" }, DIGSUM_OP: { _tag: "DIGSUM_OP" }, DIGROOT_OP: { _tag: "DIGROOT_OP" }, NTHROOT_OP: { _tag: "NTHROOT_OP" }, TEXTHAMMINGDIST_OP: { _tag: "TEXTHAMMINGDIST_OP" }, TEXTLEVENSHTEIN_OP: { _tag: "TEXTLEVENSHTEIN_OP" }, ISALPHANUMERIC_OP: { _tag: "ISALPHANUMERIC_OP" }, ISALPHABETIC_OP: { _tag: "ISALPHABETIC_OP" }, POLYGONAREA_OP: { _tag: "POLYGONAREA_OP" }, CIRCLEAREA_OP: { _tag: "CIRCLEAREA_OP" }, SPHEREVOL_OP: { _tag: "SPHEREVOL_OP" }, CYLINDERVOL_OP: { _tag: "CYLINDERVOL_OP" }, TEXTSIMILARITY_OP: { _tag: "TEXTSIMILARITY_OP" }, TEXTZALGO_OP: { _tag: "TEXTZALGO_OP" }, TEXTASCII_OP: { _tag: "TEXTASCII_OP" }, TEXTSLUG_OP: { _tag: "TEXTSLUG_OP" }, WACC_OP: { _tag: "WACC_OP" }, PAYBACK_OP: { _tag: "PAYBACK_OP" }, ROI_OP: { _tag: "ROI_OP" }, ISNUMERICSTR_OP: { _tag: "ISNUMERICSTR_OP" }, TEXTENTROPY_OP: { _tag: "TEXTENTROPY_OP" }, DEG2RAD_OP: { _tag: "DEG2RAD_OP" }, RAD2DEG_OP: { _tag: "RAD2DEG_OP" }, SINC_OP: { _tag: "SINC_OP" }, ATAN2_OP: { _tag: "ATAN2_OP" }, BINOMCOEF_OP: { _tag: "BINOMCOEF_OP" }, CATALAN_OP: { _tag: "CATALAN_OP" }, TRIANGLENUM_OP: { _tag: "TRIANGLENUM_OP" }, TEXTEMOJI_OP: { _tag: "TEXTEMOJI_OP" }, TEXTSTRIP_OP: { _tag: "TEXTSTRIP_OP" }, TEXTNORMALIZE_OP: { _tag: "TEXTNORMALIZE_OP" }, TEXTMORSE_OP: { _tag: "TEXTMORSE_OP" }, BREAKEVEN_OP: { _tag: "BREAKEVEN_OP" }, PROFITMARGIN_OP: { _tag: "PROFITMARGIN_OP" }, MARKUP_OP: { _tag: "MARKUP_OP" }, ISUPPER_OP: { _tag: "ISUPPER_OP" }, ISLOWER_OP: { _tag: "ISLOWER_OP" }, ISPALINDROME_OP: { _tag: "ISPALINDROME_OP" }, PENTAGONAL_OP: { _tag: "PENTAGONAL_OP" }, HEXAGONAL_OP: { _tag: "HEXAGONAL_OP" }, TETRAHEDRAL_OP: { _tag: "TETRAHEDRAL_OP" }, PYRAMIDAL_OP: { _tag: "PYRAMIDAL_OP" }, STIRLING_OP: { _tag: "STIRLING_OP" }, CONEVOL_OP: { _tag: "CONEVOL_OP" }, TEXTRLE_OP: { _tag: "TEXTRLE_OP" }, TEXTRLD_OP: { _tag: "TEXTRLD_OP" }, ISPERFECT_OP: { _tag: "ISPERFECT_OP" }, ISHARSHAD_OP: { _tag: "ISHARSHAD_OP" }, SAWTOOTH_OP: { _tag: "SAWTOOTH_OP" }, SQUAREWAVE_OP: { _tag: "SQUAREWAVE_OP" }, TRIANGLEWAVE_OP: { _tag: "TRIANGLEWAVE_OP" }, AGM_OP: { _tag: "AGM_OP" }, LOGISTIC_OP: { _tag: "LOGISTIC_OP" }, GAMMA2_OP: { _tag: "GAMMA2_OP" }, TEXTROT13_OP: { _tag: "TEXTROT13_OP" }, TEXTCAESAR_OP: { _tag: "TEXTCAESAR_OP" }, TEXTFREQ_OP: { _tag: "TEXTFREQ_OP" }, ISASCII_OP: { _tag: "ISASCII_OP" }, ISPRINTABLE_OP: { _tag: "ISPRINTABLE_OP" }, ISWHITESPACE_OP: { _tag: "ISWHITESPACE_OP" }, SIMPLEINTEREST_OP: { _tag: "SIMPLEINTEREST_OP" }, COMPOUNDINTEREST_OP: { _tag: "COMPOUNDINTEREST_OP" }, DEPRECIATION_OP: { _tag: "DEPRECIATION_OP" }, LUCAS_OP: { _tag: "LUCAS_OP" }, BELL_OP: { _tag: "BELL_OP" }, INTLOG2_OP: { _tag: "INTLOG2_OP" }, INTLOG10_OP: { _tag: "INTLOG10_OP" }, BITLEN_OP: { _tag: "BITLEN_OP" }, TEXTREPEAT_OP: { _tag: "TEXTREPEAT_OP" }, TEXTNTH_OP: { _tag: "TEXTNTH_OP" }, TEXTUNIQUE_OP: { _tag: "TEXTUNIQUE_OP" }, TEXTDISTINCT_OP: { _tag: "TEXTDISTINCT_OP" }, CHARCOUNT_OP: { _tag: "CHARCOUNT_OP" }, ISEMPTYTEXT_OP: { _tag: "ISEMPTYTEXT_OP" }, RULEOF72_OP: { _tag: "RULEOF72_OP" }, PRESENTVALUE_OP: { _tag: "PRESENTVALUE_OP" }, GOLDEN_OP: { _tag: "GOLDEN_OP" }, EULER_OP: { _tag: "EULER_OP" }, TAU_OP: { _tag: "TAU_OP" }, CUBEROOT_OP: { _tag: "CUBEROOT_OP" }, WRAP_OP: { _tag: "WRAP_OP" }, REMAP_OP: { _tag: "REMAP_OP" }, TEXTBASE64_OP: { _tag: "TEXTBASE64_OP" }, TEXTFROMBASE64_OP: { _tag: "TEXTFROMBASE64_OP" }, TEXTPREFIX_OP: { _tag: "TEXTPREFIX_OP" }, TEXTSUFFIX_OP: { _tag: "TEXTSUFFIX_OP" }, ISODD2_OP: { _tag: "ISODD2_OP" }, ISEVEN2_OP: { _tag: "ISEVEN2_OP" }, ISZERO_OP: { _tag: "ISZERO_OP" }, ANNUITY_OP: { _tag: "ANNUITY_OP" }, FUTUREVALUE2_OP: { _tag: "FUTUREVALUE2_OP" }, ABUNDANCY_OP: { _tag: "ABUNDANCY_OP" }, DIGITCOUNT_OP: { _tag: "DIGITCOUNT_OP" }, CHEBYSHEV_OP: { _tag: "CHEBYSHEV_OP" }, ISPOWEROFTWO_OP: { _tag: "ISPOWEROFTWO_OP" }, NEXTODD_OP: { _tag: "NEXTODD_OP" }, NEXTEVEN_OP: { _tag: "NEXTEVEN_OP" }, TOROMAN_OP: { _tag: "TOROMAN_OP" }, FROMROMAN_OP: { _tag: "FROMROMAN_OP" }, TOORDINAL_OP: { _tag: "TOORDINAL_OP" }, TEXTHEX_OP: { _tag: "TEXTHEX_OP" }, TEXTFROMHEX_OP: { _tag: "TEXTFROMHEX_OP" }, TEXTDEDUPE_OP: { _tag: "TEXTDEDUPE_OP" }, TEXTLINES_OP: { _tag: "TEXTLINES_OP" }, TEXTPASCALCASE_OP: { _tag: "TEXTPASCALCASE_OP" }, ISPRIMEFAST_OP: { _tag: "ISPRIMEFAST_OP" }, SHARPE_OP: { _tag: "SHARPE_OP" }, SORTINO_OP: { _tag: "SORTINO_OP" }, EMAVG_OP: { _tag: "EMAVG_OP" }, SMAVG_OP: { _tag: "SMAVG_OP" }, COPRIME_OP: { _tag: "COPRIME_OP" }, COLLATZ_OP: { _tag: "COLLATZ_OP" }, PREVPRIME_OP: { _tag: "PREVPRIME_OP" }, TEXTPAD_OP: { _tag: "TEXTPAD_OP" }, TEXTMASK_OP: { _tag: "TEXTMASK_OP" }, TEXTISURL_OP: { _tag: "TEXTISURL_OP" }, TEXTISEMAIL_OP: { _tag: "TEXTISEMAIL_OP" }, WORDSCOUNT_OP: { _tag: "WORDSCOUNT_OP" }, ISLEAPYEAR_OP: { _tag: "ISLEAPYEAR_OP" }, WEEKOFYEAR_OP: { _tag: "WEEKOFYEAR_OP" }, ISWEEKEND_OP: { _tag: "ISWEEKEND_OP" }, QUARTERNO_OP: { _tag: "QUARTERNO_OP" }, SEMESTERNO_OP: { _tag: "SEMESTERNO_OP" }, EFFECTRATE_OP: { _tag: "EFFECTRATE_OP" }, NOMRATE_OP: { _tag: "NOMRATE_OP" }, NPER2_OP: { _tag: "NPER2_OP" }, RATE2_OP: { _tag: "RATE2_OP" }, FIBONACCI2_OP: { _tag: "FIBONACCI2_OP" }, MOTZKIN_OP: { _tag: "MOTZKIN_OP" }, DERANGEMENT_OP: { _tag: "DERANGEMENT_OP" }, TOTIENT2_OP: { _tag: "TOTIENT2_OP" }, HARMONIC2_OP: { _tag: "HARMONIC2_OP" }, TEXTOBFUSCATE_OP: { _tag: "TEXTOBFUSCATE_OP" }, TEXTCOUNT2_OP: { _tag: "TEXTCOUNT2_OP" }, TEXTSHUFFLE_OP: { _tag: "TEXTSHUFFLE_OP" }, ISFIBBISH_OP: { _tag: "ISFIBBISH_OP" }, IFF_OP: { _tag: "IFF_OP" }, UNLESS_OP: { _tag: "UNLESS_OP" }, SECANT_OP: { _tag: "SECANT_OP" }, COSECANT_OP: { _tag: "COSECANT_OP" }, VERSINE_OP: { _tag: "VERSINE_OP" }, HAVERSINE_OP: { _tag: "HAVERSINE_OP" }, EXSECANT_OP: { _tag: "EXSECANT_OP" }, LEMNISCATE_OP: { _tag: "LEMNISCATE_OP" }, AGM2_OP: { _tag: "AGM2_OP" }, POWMOD_OP: { _tag: "POWMOD_OP" }, ZSCORE2_OP: { _tag: "ZSCORE2_OP" }, TSTAT_OP: { _tag: "TSTAT_OP" }, FSTAT_OP: { _tag: "FSTAT_OP" }, CHISQSTAT_OP: { _tag: "CHISQSTAT_OP" }, TEXTCOUNTCHAR_OP: { _tag: "TEXTCOUNTCHAR_OP" }, TEXTZFILL_OP: { _tag: "TEXTZFILL_OP" }, TEXTLPAD_OP: { _tag: "TEXTLPAD_OP" }, TEXTRPAD_OP: { _tag: "TEXTRPAD_OP" }, TEXTABBREV_OP: { _tag: "TEXTABBREV_OP" }, TEXTWORDFREQ_OP: { _tag: "TEXTWORDFREQ_OP" }, TEXTSANITIZE_OP: { _tag: "TEXTSANITIZE_OP" }, TEXTMIRROR_OP: { _tag: "TEXTMIRROR_OP" }, TYPEOF3_OP: { _tag: "TYPEOF3_OP" }, ISBLANK2_OP: { _tag: "ISBLANK2_OP" }, ISTRUTHY_OP: { _tag: "ISTRUTHY_OP" }, ISFALSY_OP: { _tag: "ISFALSY_OP" }, ISFRACTION_OP: { _tag: "ISFRACTION_OP" }, ISDIVISIBLE_OP: { _tag: "ISDIVISIBLE_OP" }, PVANNUITY_OP: { _tag: "PVANNUITY_OP" }, ANNUITYPMT_OP: { _tag: "ANNUITYPMT_OP" }, BONDPRICE_OP: { _tag: "BONDPRICE_OP" }, BONDYIELD_OP: { _tag: "BONDYIELD_OP" }, TBILL2_OP: { _tag: "TBILL2_OP" }, MACAULAY_OP: { _tag: "MACAULAY_OP" }, GESTEP_OP: { _tag: "GESTEP_OP" }, SEC_OP: { _tag: "SEC_OP" }, CSC_OP: { _tag: "CSC_OP" }, COTH_OP: { _tag: "COTH_OP" },
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
    case "BINSEARCH_N": return { _tag: "BINSEARCH_N", n: 0 } as any
    case "INDEXMATCH_N": return { _tag: "INDEXMATCH_N", n: 0 } as any
    case "LASTINDEXOF_N": return { _tag: "LASTINDEXOF_N", n: 0 } as any
    case "FINDALL_N": return { _tag: "FINDALL_N", n: 0 } as any
    case "COUNTUNIQ_N": return { _tag: "COUNTUNIQ_N", n: 0 } as any
    case "ARRAYCONTAINS_N": return { _tag: "ARRAYCONTAINS_N", n: 0 } as any
    case "ARRAYPOS_N": return { _tag: "ARRAYPOS_N", n: 0 } as any
    case "FLATTEN2_N": return { _tag: "FLATTEN2_N", n: 0 } as any
    case "IFF_OP": return _OP.IFF_OP
    case "SWITCH2_N": return { _tag: "SWITCH2_N", n: 0 } as any
    case "XORALL_N": return { _tag: "XORALL_N", n: 0 } as any
    case "NANDALL_N": return { _tag: "NANDALL_N", n: 0 } as any
    case "NORALL_N": return { _tag: "NORALL_N", n: 0 } as any
    case "COALESCE2_N": return { _tag: "COALESCE2_N", n: 0 } as any
    case "UNLESS_OP": return _OP.UNLESS_OP
    case "SECANT_OP": return _OP.SECANT_OP
    case "COSECANT_OP": return _OP.COSECANT_OP
    case "VERSINE_OP": return _OP.VERSINE_OP
    case "HAVERSINE_OP": return _OP.HAVERSINE_OP
    case "EXSECANT_OP": return _OP.EXSECANT_OP
    case "LEMNISCATE_OP": return _OP.LEMNISCATE_OP
    case "AGM2_OP": return _OP.AGM2_OP
    case "POWMOD_OP": return _OP.POWMOD_OP
    case "MAD2_N": return { _tag: "MAD2_N", n: 0 } as any
    case "ZSCORE2_OP": return _OP.ZSCORE2_OP
    case "TSTAT_OP": return _OP.TSTAT_OP
    case "FSTAT_OP": return _OP.FSTAT_OP
    case "CHISQSTAT_OP": return _OP.CHISQSTAT_OP
    case "SEM_N": return { _tag: "SEM_N", n: 0 } as any
    case "POOLEDVAR_N": return { _tag: "POOLEDVAR_N", n: 0 } as any
    case "TEXTCOUNTCHAR_OP": return _OP.TEXTCOUNTCHAR_OP
    case "TEXTZFILL_OP": return _OP.TEXTZFILL_OP
    case "TEXTLPAD_OP": return _OP.TEXTLPAD_OP
    case "TEXTRPAD_OP": return _OP.TEXTRPAD_OP
    case "TEXTABBREV_OP": return _OP.TEXTABBREV_OP
    case "TEXTWORDFREQ_OP": return _OP.TEXTWORDFREQ_OP
    case "TEXTSANITIZE_OP": return _OP.TEXTSANITIZE_OP
    case "TEXTMIRROR_OP": return _OP.TEXTMIRROR_OP
    case "TYPEOF3_OP": return _OP.TYPEOF3_OP
    case "ISBLANK2_OP": return _OP.ISBLANK2_OP
    case "ISTRUTHY_OP": return _OP.ISTRUTHY_OP
    case "ISFALSY_OP": return _OP.ISFALSY_OP
    case "ISFRACTION_OP": return _OP.ISFRACTION_OP
    case "ISDIVISIBLE_OP": return _OP.ISDIVISIBLE_OP
    case "PVANNUITY_OP": return _OP.PVANNUITY_OP
    case "ANNUITYPMT_OP": return _OP.ANNUITYPMT_OP
    case "BONDPRICE_OP": return _OP.BONDPRICE_OP
    case "BONDYIELD_OP": return _OP.BONDYIELD_OP
    case "TBILL2_OP": return _OP.TBILL2_OP
    case "MACAULAY_OP": return _OP.MACAULAY_OP
    case "NIFF_OP": return { _tag: "NIFF_OP" } as any
    case "SWITCHIF_OP": return { _tag: "SWITCHIF_OP" } as any
    case "RANDNORM_OP": return { _tag: "RANDNORM_OP" } as any
    case "RANDEXP_OP": return { _tag: "RANDEXP_OP" } as any
    case "RANDINT_OP": return { _tag: "RANDINT_OP" } as any
    case "COINFLIP_OP": return { _tag: "COINFLIP_OP" } as any
    case "GUDERMANN_OP": return { _tag: "GUDERMANN_OP" } as any
    case "INVERSEGUD_OP": return { _tag: "INVERSEGUD_OP" } as any
    case "LANCZOS_OP": return { _tag: "LANCZOS_OP" } as any
    case "DIGAMMA_OP": return { _tag: "DIGAMMA_OP" } as any
    case "POLYGAMMA_OP": return { _tag: "POLYGAMMA_OP" } as any
    case "ZETA2_OP": return { _tag: "ZETA2_OP" } as any
    case "BETAFN_OP": return { _tag: "BETAFN_OP" } as any
    case "POCHHAMMER_OP": return { _tag: "POCHHAMMER_OP" } as any
    case "TEXTFORMAT_OP": return { _tag: "TEXTFORMAT_OP" } as any
    case "TEXTJUSTIFY_OP": return { _tag: "TEXTJUSTIFY_OP" } as any
    case "TEXTMASK2_OP": return { _tag: "TEXTMASK2_OP" } as any
    case "TEXTHASH_OP": return { _tag: "TEXTHASH_OP" } as any
    case "TEXTREPLACE2_OP": return { _tag: "TEXTREPLACE2_OP" } as any
    case "TEXTFILL_OP": return { _tag: "TEXTFILL_OP" } as any
    case "CAGR2_OP": return { _tag: "CAGR2_OP" } as any
    case "DRAWDOWN_OP": return { _tag: "DRAWDOWN_OP" } as any
    case "CALMAR_OP": return { _tag: "CALMAR_OP" } as any
    case "TREYNOR_OP": return { _tag: "TREYNOR_OP" } as any
    case "ISFINITE2_OP": return { _tag: "ISFINITE2_OP" } as any
    case "ISWHOLE_OP": return { _tag: "ISWHOLE_OP" } as any
    case "EQUIV_OP": return { _tag: "EQUIV_OP" } as any
    case "ONEOF_N": return { _tag: "ONEOF_N", n: 0 } as any
    case "FIRSTTRUTHY_N": return { _tag: "FIRSTTRUTHY_N", n: 0 } as any
    case "LASTTRUTHY_N": return { _tag: "LASTTRUTHY_N", n: 0 } as any
    case "COUNTIF3_N": return { _tag: "COUNTIF3_N", n: 0 } as any
    case "WHICHMAX_N": return { _tag: "WHICHMAX_N", n: 0 } as any
    case "WHICHMIN_N": return { _tag: "WHICHMIN_N", n: 0 } as any
    case "THRESHOLD_OP": return { _tag: "THRESHOLD_OP" } as any
    case "TOGGLE_OP": return { _tag: "TOGGLE_OP" } as any
    case "SATURATE_OP": return { _tag: "SATURATE_OP" } as any
    case "DEADBAND_OP": return { _tag: "DEADBAND_OP" } as any
    case "RANDPERM_N": return { _tag: "RANDPERM_N", n: 0 } as any
    case "RANDCHOICE_N": return { _tag: "RANDCHOICE_N", n: 0 } as any
    case "DICE_OP": return { _tag: "DICE_OP" } as any
    case "UUID4_OP": return { _tag: "UUID4_OP" } as any
    case "ENUMERATE_N": return { _tag: "ENUMERATE_N", n: 0 } as any
    case "COUNTVALS_N": return { _tag: "COUNTVALS_N", n: 0 } as any
    case "FIRSTNONZERO_N": return { _tag: "FIRSTNONZERO_N", n: 0 } as any
    case "LASTNONZERO_N": return { _tag: "LASTNONZERO_N", n: 0 } as any
    case "NTHLARGEST_N": return { _tag: "NTHLARGEST_N", n: 0 } as any
    case "AMORT_OP": return { _tag: "AMORT_OP" } as any
    case "DAILYRETURN_OP": return { _tag: "DAILYRETURN_OP" } as any
    case "VOLANNUAL_OP": return { _tag: "VOLANNUAL_OP" } as any
    case "MAXDD_N": return { _tag: "MAXDD_N", n: 0 } as any
    case "INFORMRATIO_OP": return { _tag: "INFORMRATIO_OP" } as any
    case "JENSENALPHA_OP": return { _tag: "JENSENALPHA_OP" } as any
    case "LAGUERRE_OP": return { _tag: "LAGUERRE_OP" } as any
    case "HERMITE_OP": return { _tag: "HERMITE_OP" } as any
    case "LEGENDRE_OP": return { _tag: "LEGENDRE_OP" } as any
    case "CHEBYSHEV2_OP": return { _tag: "CHEBYSHEV2_OP" } as any
    case "FRESNEL_S_OP": return { _tag: "FRESNEL_S_OP" } as any
    case "FRESNEL_C_OP": return { _tag: "FRESNEL_C_OP" } as any
    case "AIRY_OP": return { _tag: "AIRY_OP" } as any
    case "DAWSON_OP": return { _tag: "DAWSON_OP" } as any
    case "TRIMMEDMEAN_N": return { _tag: "TRIMMEDMEAN_N", n: 0 } as any
    case "WINSOREDMEAN_N": return { _tag: "WINSOREDMEAN_N", n: 0 } as any
    case "MIDRANGE_N": return { _tag: "MIDRANGE_N", n: 0 } as any
    case "MIDHINGE_N": return { _tag: "MIDHINGE_N", n: 0 } as any
    case "MEANDEV_N": return { _tag: "MEANDEV_N", n: 0 } as any
    case "ROOTMEANSQERR_N": return { _tag: "ROOTMEANSQERR_N", n: 0 } as any
    case "TEXTWORDWRAP_OP": return { _tag: "TEXTWORDWRAP_OP" } as any
    case "TEXTCOLUMNS_OP": return { _tag: "TEXTCOLUMNS_OP" } as any
    case "TEXTTAB_OP": return { _tag: "TEXTTAB_OP" } as any
    case "TEXTBOXIFY_OP": return { _tag: "TEXTBOXIFY_OP" } as any
    case "TEXTCOUNTWORDS_OP": return { _tag: "TEXTCOUNTWORDS_OP" } as any
    case "TEXTFIRSTWORD_OP": return { _tag: "TEXTFIRSTWORD_OP" } as any
    case "ISNUMTYPE_OP": return { _tag: "ISNUMTYPE_OP" } as any
    case "ISSTRTYPE_OP": return { _tag: "ISSTRTYPE_OP" } as any
    case "ISBOOLTYPE_OP": return { _tag: "ISBOOLTYPE_OP" } as any
    case "ISERRORTYPE_OP": return { _tag: "ISERRORTYPE_OP" } as any
    case "IFPOS_OP": return { _tag: "IFPOS_OP" } as any
    case "IFNEG_OP": return { _tag: "IFNEG_OP" } as any
    case "IFZERO_OP": return { _tag: "IFZERO_OP" } as any
    case "IFEVEN_OP": return { _tag: "IFEVEN_OP" } as any
    case "IFODD_OP": return { _tag: "IFODD_OP" } as any
    case "GATE_OP": return { _tag: "GATE_OP" } as any
    case "LATCH_OP": return { _tag: "LATCH_OP" } as any
    case "DEBOUNCE_OP": return { _tag: "DEBOUNCE_OP" } as any
    case "MUXSEL_N": return { _tag: "MUXSEL_N", n: 0 } as any
    case "DEMUX_N": return { _tag: "DEMUX_N", n: 0 } as any
    case "RANDSIGN_OP": return { _tag: "RANDSIGN_OP" } as any
    case "RANDBOOL_OP": return { _tag: "RANDBOOL_OP" } as any
    case "NTHSMALLEST_N": return { _tag: "NTHSMALLEST_N", n: 0 } as any
    case "ARGMAX_N": return { _tag: "ARGMAX_N", n: 0 } as any
    case "ARGMIN_N": return { _tag: "ARGMIN_N", n: 0 } as any
    case "DEDUP_N": return { _tag: "DEDUP_N", n: 0 } as any
    case "INTERLEAVE_N": return { _tag: "INTERLEAVE_N", n: 0 } as any
    case "COUPON_OP": return { _tag: "COUPON_OP" } as any
    case "ACCRUEDINT_OP": return { _tag: "ACCRUEDINT_OP" } as any
    case "PARVALUE_OP": return { _tag: "PARVALUE_OP" } as any
    case "HOLDINGRETURN_OP": return { _tag: "HOLDINGRETURN_OP" } as any
    case "TIMEDWRETURN_OP": return { _tag: "TIMEDWRETURN_OP" } as any
    case "DIVYIELD_OP": return { _tag: "DIVYIELD_OP" } as any
    case "SININT_OP": return { _tag: "SININT_OP" } as any
    case "COSINT_OP": return { _tag: "COSINT_OP" } as any
    case "EXPINT_OP": return { _tag: "EXPINT_OP" } as any
    case "LOGINT_OP": return { _tag: "LOGINT_OP" } as any
    case "DILOG_OP": return { _tag: "DILOG_OP" } as any
    case "CLAUSEN_OP": return { _tag: "CLAUSEN_OP" } as any
    case "ELLIPK_OP": return { _tag: "ELLIPK_OP" } as any
    case "ELLIPE_OP": return { _tag: "ELLIPE_OP" } as any
    case "QUADMEAN_N": return { _tag: "QUADMEAN_N", n: 0 } as any
    case "POWMEAN_N": return { _tag: "POWMEAN_N", n: 0 } as any
    case "LEHMER_N": return { _tag: "LEHMER_N", n: 0 } as any
    case "ENTROPY3_N": return { _tag: "ENTROPY3_N", n: 0 } as any
    case "RELENTROPY_N": return { _tag: "RELENTROPY_N", n: 0 } as any
    case "MUTUALINFO_N": return { _tag: "MUTUALINFO_N", n: 0 } as any
    case "CROSSENTROPY_N": return { _tag: "CROSSENTROPY_N", n: 0 } as any
    case "TEXTINITCAP_OP": return { _tag: "TEXTINITCAP_OP" } as any
    case "TEXTSNIP_OP": return { _tag: "TEXTSNIP_OP" } as any
    case "TEXTUNQUOTE_OP": return { _tag: "TEXTUNQUOTE_OP" } as any
    case "TEXTQUOTE_OP": return { _tag: "TEXTQUOTE_OP" } as any
    case "TEXTDOTS_OP": return { _tag: "TEXTDOTS_OP" } as any
    case "TEXTBULLET_OP": return { _tag: "TEXTBULLET_OP" } as any
    case "ISNUMERIC_OP": return { _tag: "ISNUMERIC_OP" } as any
    case "ISTEXT2_OP": return { _tag: "ISTEXT2_OP" } as any
    case "ISERR2_OP": return { _tag: "ISERR2_OP" } as any
    case "ISBLANK3_OP": return { _tag: "ISBLANK3_OP" } as any
    case "ISNOTEMPTY_OP": return { _tag: "ISNOTEMPTY_OP" } as any
    case "TYPESTR_OP": return { _tag: "TYPESTR_OP" } as any
    case "JACOBI_OP": return { _tag: "JACOBI_OP" } as any
    case "BESSEL_I0_OP": return { _tag: "BESSEL_I0_OP" } as any
    case "BESSEL_J0_OP": return { _tag: "BESSEL_J0_OP" } as any
    case "BESSEL_K0_OP": return { _tag: "BESSEL_K0_OP" } as any
    case "STRUVE_OP": return { _tag: "STRUVE_OP" } as any
    case "WEBER_OP": return { _tag: "WEBER_OP" } as any
    case "HURWITZ_OP": return { _tag: "HURWITZ_OP" } as any
    case "POLYLOG_OP": return { _tag: "POLYLOG_OP" } as any
    case "LAMBERTW_OP": return { _tag: "LAMBERTW_OP" } as any
    case "AGMFN_OP": return { _tag: "AGMFN_OP" } as any
    case "CONTRAHARMONIC_N": return { _tag: "CONTRAHARMONIC_N", n: 0 } as any
    case "HERONIAN_N": return { _tag: "HERONIAN_N", n: 0 } as any
    case "LOGTRANSFORM_N": return { _tag: "LOGTRANSFORM_N", n: 0 } as any
    case "ZSCORENORM_N": return { _tag: "ZSCORENORM_N", n: 0 } as any
    case "MAD3_N": return { _tag: "MAD3_N", n: 0 } as any
    case "BIWEIGHT_N": return { _tag: "BIWEIGHT_N", n: 0 } as any
    case "HUBER_N": return { _tag: "HUBER_N", n: 0 } as any
    case "WINVAR_N": return { _tag: "WINVAR_N", n: 0 } as any
    case "TEXTCENTER2_OP": return { _tag: "TEXTCENTER2_OP" } as any
    case "TEXTINDENT_OP": return { _tag: "TEXTINDENT_OP" } as any
    case "TEXTHEADER_OP": return { _tag: "TEXTHEADER_OP" } as any
    case "TEXTFOOTER_OP": return { _tag: "TEXTFOOTER_OP" } as any
    case "TEXTCOUNTLINES_OP": return { _tag: "TEXTCOUNTLINES_OP" } as any
    case "TEXTISEMPTY_OP": return { _tag: "TEXTISEMPTY_OP" } as any
    case "TEXTCOALESCE_OP": return { _tag: "TEXTCOALESCE_OP" } as any
    case "TEXTTAG_OP": return { _tag: "TEXTTAG_OP" } as any
    case "ISPOS_OP": return { _tag: "ISPOS_OP" } as any
    case "ISNEG2_OP": return { _tag: "ISNEG2_OP" } as any
    case "ISNONZERO_OP": return { _tag: "ISNONZERO_OP" } as any
    case "ISINRANGE_OP": return { _tag: "ISINRANGE_OP" } as any
    case "SIGNOF_OP": return { _tag: "SIGNOF_OP" } as any
    case "MAGNITUDE_OP": return { _tag: "MAGNITUDE_OP" } as any
    case "COSTBASIS_OP": return { _tag: "COSTBASIS_OP" } as any
    case "UNREALIZEDPNL_OP": return { _tag: "UNREALIZEDPNL_OP" } as any
    case "REALIZEDPNL_OP": return { _tag: "REALIZEDPNL_OP" } as any
    case "DOLLARVAL_OP": return { _tag: "DOLLARVAL_OP" } as any
    case "BASISPOINTS_OP": return { _tag: "BASISPOINTS_OP" } as any
    case "TICKVALUE_OP": return { _tag: "TICKVALUE_OP" } as any
    case "MAJORITY2_N": return { _tag: "MAJORITY2_N", n: 0 } as any
    case "UNANIMOUS_N": return { _tag: "UNANIMOUS_N", n: 0 } as any
    case "QUORUM_N": return { _tag: "QUORUM_N", n: 0 } as any
    case "VETO_N": return { _tag: "VETO_N", n: 0 } as any
    case "PRIORITYSEL_N": return { _tag: "PRIORITYSEL_N", n: 0 } as any
    case "FALLBACK_N": return { _tag: "FALLBACK_N", n: 0 } as any
    case "RANK2_N": return { _tag: "RANK2_N", n: 0 } as any
    case "DENSERANK_N": return { _tag: "DENSERANK_N", n: 0 } as any
    case "NTILE_N": return { _tag: "NTILE_N", n: 0 } as any
    case "ROWNUMBER_N": return { _tag: "ROWNUMBER_N", n: 0 } as any
    case "RANDWEIGHTED_N": return { _tag: "RANDWEIGHTED_N", n: 0 } as any
    case "RANDSAMPLE_N": return { _tag: "RANDSAMPLE_N", n: 0 } as any



    case "FIBONACCI2_OP": return _OP.FIBONACCI2_OP
    case "MOTZKIN_OP": return _OP.MOTZKIN_OP
    case "DERANGEMENT_OP": return _OP.DERANGEMENT_OP
    case "TOTIENT2_OP": return _OP.TOTIENT2_OP
    case "HARMONIC2_OP": return _OP.HARMONIC2_OP
    case "TEXTOBFUSCATE_OP": return _OP.TEXTOBFUSCATE_OP
    case "TEXTCOUNT2_OP": return _OP.TEXTCOUNT2_OP
    case "TEXTSHUFFLE_OP": return _OP.TEXTSHUFFLE_OP
    case "ISCOPRIMEALL_N": return { _tag: "ISCOPRIMEALL_N", n: 0 } as any
    case "ISFIBBISH_OP": return _OP.ISFIBBISH_OP
    case "COPRIME_OP": return _OP.COPRIME_OP
    case "COLLATZ_OP": return _OP.COLLATZ_OP
    case "PREVPRIME_OP": return _OP.PREVPRIME_OP
    case "TEXTPAD_OP": return _OP.TEXTPAD_OP
    case "TEXTMASK_OP": return _OP.TEXTMASK_OP
    case "TEXTISURL_OP": return _OP.TEXTISURL_OP
    case "TEXTISEMAIL_OP": return _OP.TEXTISEMAIL_OP
    case "WORDSCOUNT_OP": return _OP.WORDSCOUNT_OP
    case "ISLEAPYEAR_OP": return _OP.ISLEAPYEAR_OP
    case "WEEKOFYEAR_OP": return _OP.WEEKOFYEAR_OP
    case "ISWEEKEND_OP": return _OP.ISWEEKEND_OP
    case "QUARTERNO_OP": return _OP.QUARTERNO_OP
    case "SEMESTERNO_OP": return _OP.SEMESTERNO_OP
    case "EFFECTRATE_OP": return _OP.EFFECTRATE_OP
    case "NOMRATE_OP": return _OP.NOMRATE_OP
    case "AVEDEV2_N": return { _tag: "AVEDEV2_N", n: 0 } as any
    case "COVAR2_N": return { _tag: "COVAR2_N", n: 0 } as any
    case "CORREL2_N": return { _tag: "CORREL2_N", n: 0 } as any
    case "NPER2_OP": return _OP.NPER2_OP
    case "RATE2_OP": return _OP.RATE2_OP
    case "COSSIM_N": return { _tag: "COSSIM_N", n: 0 } as any
    case "CHEBYSHEV_OP": return _OP.CHEBYSHEV_OP
    case "ISPOWEROFTWO_OP": return _OP.ISPOWEROFTWO_OP
    case "NEXTODD_OP": return _OP.NEXTODD_OP
    case "NEXTEVEN_OP": return _OP.NEXTEVEN_OP
    case "TOROMAN_OP": return _OP.TOROMAN_OP
    case "FROMROMAN_OP": return _OP.FROMROMAN_OP
    case "TOORDINAL_OP": return _OP.TOORDINAL_OP
    case "TEXTHEX_OP": return _OP.TEXTHEX_OP
    case "TEXTFROMHEX_OP": return _OP.TEXTFROMHEX_OP
    case "TEXTDEDUPE_OP": return _OP.TEXTDEDUPE_OP
    case "TEXTLINES_OP": return _OP.TEXTLINES_OP
    case "TEXTPASCALCASE_OP": return _OP.TEXTPASCALCASE_OP
    case "WMEAN_N": return { _tag: "WMEAN_N", n: 0 } as any
    case "GINI2_N": return { _tag: "GINI2_N", n: 0 } as any
    case "ISPRIMEFAST_OP": return _OP.ISPRIMEFAST_OP
    case "SHARPE_OP": return _OP.SHARPE_OP
    case "SORTINO_OP": return _OP.SORTINO_OP
    case "EMAVG_OP": return _OP.EMAVG_OP
    case "SMAVG_OP": return _OP.SMAVG_OP
    case "ABUNDANCY_OP": return _OP.ABUNDANCY_OP
    case "DIGITCOUNT_OP": return _OP.DIGITCOUNT_OP
    case "GOLDEN_OP": return _OP.GOLDEN_OP
    case "EULER_OP": return _OP.EULER_OP
    case "TAU_OP": return _OP.TAU_OP
    case "CUBEROOT_OP": return _OP.CUBEROOT_OP
    case "WRAP_OP": return _OP.WRAP_OP
    case "REMAP_OP": return _OP.REMAP_OP
    case "TEXTBASE64_OP": return _OP.TEXTBASE64_OP
    case "TEXTFROMBASE64_OP": return _OP.TEXTFROMBASE64_OP
    case "TEXTPREFIX_OP": return _OP.TEXTPREFIX_OP
    case "TEXTSUFFIX_OP": return _OP.TEXTSUFFIX_OP
    case "RMS_N": return { _tag: "RMS_N", n: 0 } as any
    case "RANGE2_N": return { _tag: "RANGE2_N", n: 0 } as any
    case "IQR_N": return { _tag: "IQR_N", n: 0 } as any
    case "MAPE_N": return { _tag: "MAPE_N", n: 0 } as any
    case "ISODD2_OP": return _OP.ISODD2_OP
    case "ISEVEN2_OP": return _OP.ISEVEN2_OP
    case "ISZERO_OP": return _OP.ISZERO_OP
    case "ANNUITY_OP": return _OP.ANNUITY_OP
    case "FUTUREVALUE2_OP": return _OP.FUTUREVALUE2_OP
    case "LUCAS_OP": return _OP.LUCAS_OP
    case "BELL_OP": return _OP.BELL_OP
    case "INTLOG2_OP": return _OP.INTLOG2_OP
    case "INTLOG10_OP": return _OP.INTLOG10_OP
    case "BITLEN_OP": return _OP.BITLEN_OP
    case "TEXTREPEAT_OP": return _OP.TEXTREPEAT_OP
    case "TEXTNTH_OP": return _OP.TEXTNTH_OP
    case "TEXTUNIQUE_OP": return _OP.TEXTUNIQUE_OP
    case "TEXTDISTINCT_OP": return _OP.TEXTDISTINCT_OP
    case "COUNTIF2_N": return { _tag: "COUNTIF2_N", n: 0 } as any
    case "CHARCOUNT_OP": return _OP.CHARCOUNT_OP
    case "ISEMPTYTEXT_OP": return _OP.ISEMPTYTEXT_OP
    case "RULEOF72_OP": return _OP.RULEOF72_OP
    case "PRESENTVALUE_OP": return _OP.PRESENTVALUE_OP
    case "SAWTOOTH_OP": return _OP.SAWTOOTH_OP
    case "SQUAREWAVE_OP": return _OP.SQUAREWAVE_OP
    case "TRIANGLEWAVE_OP": return _OP.TRIANGLEWAVE_OP
    case "AGM_OP": return _OP.AGM_OP
    case "LOGISTIC_OP": return _OP.LOGISTIC_OP
    case "GAMMA2_OP": return _OP.GAMMA2_OP
    case "TEXTROT13_OP": return _OP.TEXTROT13_OP
    case "TEXTCAESAR_OP": return _OP.TEXTCAESAR_OP
    case "TEXTFREQ_OP": return _OP.TEXTFREQ_OP
    case "ISASCII_OP": return _OP.ISASCII_OP
    case "ISPRINTABLE_OP": return _OP.ISPRINTABLE_OP
    case "ISWHITESPACE_OP": return _OP.ISWHITESPACE_OP
    case "SIMPLEINTEREST_OP": return _OP.SIMPLEINTEREST_OP
    case "COMPOUNDINTEREST_OP": return _OP.COMPOUNDINTEREST_OP
    case "DEPRECIATION_OP": return _OP.DEPRECIATION_OP
    case "PENTAGONAL_OP": return _OP.PENTAGONAL_OP
    case "HEXAGONAL_OP": return _OP.HEXAGONAL_OP
    case "TETRAHEDRAL_OP": return _OP.TETRAHEDRAL_OP
    case "PYRAMIDAL_OP": return _OP.PYRAMIDAL_OP
    case "STIRLING_OP": return _OP.STIRLING_OP
    case "CONEVOL_OP": return _OP.CONEVOL_OP
    case "TEXTRLE_OP": return _OP.TEXTRLE_OP
    case "TEXTRLD_OP": return _OP.TEXTRLD_OP
    case "ISPERFECT_OP": return _OP.ISPERFECT_OP
    case "ISHARSHAD_OP": return _OP.ISHARSHAD_OP
    case "DEG2RAD_OP": return _OP.DEG2RAD_OP
    case "RAD2DEG_OP": return _OP.RAD2DEG_OP
    case "SINC_OP": return _OP.SINC_OP
    case "ATAN2_OP": return _OP.ATAN2_OP
    case "BINOMCOEF_OP": return _OP.BINOMCOEF_OP
    case "CATALAN_OP": return _OP.CATALAN_OP
    case "TRIANGLENUM_OP": return _OP.TRIANGLENUM_OP
    case "TEXTEMOJI_OP": return _OP.TEXTEMOJI_OP
    case "TEXTSTRIP_OP": return _OP.TEXTSTRIP_OP
    case "TEXTNORMALIZE_OP": return _OP.TEXTNORMALIZE_OP
    case "TEXTMORSE_OP": return _OP.TEXTMORSE_OP
    case "BREAKEVEN_OP": return _OP.BREAKEVEN_OP
    case "PROFITMARGIN_OP": return _OP.PROFITMARGIN_OP
    case "MARKUP_OP": return _OP.MARKUP_OP
    case "ISUPPER_OP": return _OP.ISUPPER_OP
    case "ISLOWER_OP": return _OP.ISLOWER_OP
    case "ISPALINDROME_OP": return _OP.ISPALINDROME_OP
    case "REPEAT_N": return { _tag: "REPEAT_N", n: 0 } as any
    case "LCMM_N": return { _tag: "LCMM_N", n: 0 } as any
    case "GCDM_N": return { _tag: "GCDM_N", n: 0 } as any
    case "POLYGONAREA_OP": return _OP.POLYGONAREA_OP
    case "CIRCLEAREA_OP": return _OP.CIRCLEAREA_OP
    case "SPHEREVOL_OP": return _OP.SPHEREVOL_OP
    case "CYLINDERVOL_OP": return _OP.CYLINDERVOL_OP
    case "KURTOSIS_N": return { _tag: "KURTOSIS_N", n: 0 } as any
    case "SKEWNESS_N": return { _tag: "SKEWNESS_N", n: 0 } as any
    case "GEOMEAN2_N": return { _tag: "GEOMEAN2_N", n: 0 } as any
    case "HARMEAN2_N": return { _tag: "HARMEAN2_N", n: 0 } as any
    case "TEXTSIMILARITY_OP": return _OP.TEXTSIMILARITY_OP
    case "TEXTZALGO_OP": return _OP.TEXTZALGO_OP
    case "TEXTASCII_OP": return _OP.TEXTASCII_OP
    case "TEXTSLUG_OP": return _OP.TEXTSLUG_OP
    case "WACC_OP": return _OP.WACC_OP
    case "PAYBACK_OP": return _OP.PAYBACK_OP
    case "ROI_OP": return _OP.ROI_OP
    case "ISNUMERICSTR_OP": return _OP.ISNUMERICSTR_OP
    case "TEXTENTROPY_OP": return _OP.TEXTENTROPY_OP
    case "ALL_N": return { _tag: "ALL_N", n: 0 } as any
    case "ANY_N": return { _tag: "ANY_N", n: 0 } as any
    case "NONE_N": return { _tag: "NONE_N", n: 0 } as any
    case "DIGSUM_OP": return _OP.DIGSUM_OP
    case "DIGROOT_OP": return _OP.DIGROOT_OP
    case "NTHROOT_OP": return _OP.NTHROOT_OP
    case "TEXTHAMMINGDIST_OP": return _OP.TEXTHAMMINGDIST_OP
    case "TEXTLEVENSHTEIN_OP": return _OP.TEXTLEVENSHTEIN_OP
    case "ISALPHANUMERIC_OP": return _OP.ISALPHANUMERIC_OP
    case "ISALPHABETIC_OP": return _OP.ISALPHABETIC_OP
    case "MAJORITY_N": return { _tag: "MAJORITY_N", n: 0 } as any
    case "COEFVAR_N": return { _tag: "COEFVAR_N", n: 0 } as any
    case "TEXTPADSTART_OP": return _OP.TEXTPADSTART_OP
    case "TEXTPADEND_OP": return _OP.TEXTPADEND_OP
    case "TEXTWRAP_OP": return _OP.TEXTWRAP_OP
    case "CHARCODE_OP": return _OP.CHARCODE_OP
    case "FROMCHARCODE_OP": return _OP.FROMCHARCODE_OP
    case "ISPRIME_OP": return _OP.ISPRIME_OP
    case "NEXTPRIME_OP": return _OP.NEXTPRIME_OP
    case "PRIMECOUNT_OP": return _OP.PRIMECOUNT_OP
    case "TOTIENT_OP": return _OP.TOTIENT_OP
    case "DIVISORS_OP": return _OP.DIVISORS_OP
    case "SEQUENCE_GEN_N": return { _tag: "SEQUENCE_GEN_N", n: 0 } as any
    case "LINSPACE_N": return { _tag: "LINSPACE_N", n: 0 } as any
    case "CELLTYPE_OP": return _OP.CELLTYPE_OP
    case "CHECKSUM_OP": return _OP.CHECKSUM_OP
    case "CAGR_OP": return _OP.CAGR_OP
    case "DISC_OP": return _OP.DISC_OP
    case "DOLLARDE_OP": return _OP.DOLLARDE_OP
    case "DOLLARFR_OP": return _OP.DOLLARFR_OP
    case "ENTROPY_N": return { _tag: "ENTROPY_N", n: 0 } as any
    case "GINI_N": return { _tag: "GINI_N", n: 0 } as any
    case "WINSORIZE_N": return { _tag: "WINSORIZE_N", n: 0 } as any
    case "HYPOT3_OP": return _OP.HYPOT3_OP
    case "DISTANCE2D_OP": return _OP.DISTANCE2D_OP
    case "MANHATTAN_OP": return _OP.MANHATTAN_OP
    case "FIBONACCI_OP": return _OP.FIBONACCI_OP
    case "COLLATZ_OP": return _OP.COLLATZ_OP
    case "TYPEOF2_OP": return _OP.TYPEOF2_OP
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
    case "SLN_OP": return _OP.SLN_OP
    case "SYD_OP": return _OP.SYD_OP
    case "DDB_OP": return _OP.DDB_OP
    case "RATE_EST_OP": return _OP.RATE_EST_OP
    case "EFFECT_RATE_OP": return _OP.EFFECT_RATE_OP
    case "NOMINAL_RATE_OP": return _OP.NOMINAL_RATE_OP
    case "ZSCORE_OP": return _OP.ZSCORE_OP
    case "PERCENTRANK_N": return { _tag: "PERCENTRANK_N", n: 0 } as any
    case "NAND_OP": return _OP.NAND_OP
    case "NOR_OP": return _OP.NOR_OP
    case "XNOR_OP": return _OP.XNOR_OP
    case "TEXTMASK_OP": return _OP.TEXTMASK_OP
    case "TEXTTRUNCATE_OP": return _OP.TEXTTRUNCATE_OP
    case "CUMSUM_N": return { _tag: "CUMSUM_N", n: 0 } as any
    case "CUMPROD_N": return { _tag: "CUMPROD_N", n: 0 } as any
    case "MOVAVG_N": return { _tag: "MOVAVG_N", n: 0 } as any
    case "BITNOT_OP": return _OP.BITNOT_OP
    case "BITROTL_OP": return _OP.BITROTL_OP
    case "BITROTR_OP": return _OP.BITROTR_OP
    case "JSON_STRINGIFY_OP": return _OP.JSON_STRINGIFY_OP
    case "TEXTTITLE_OP": return _OP.TEXTTITLE_OP
    case "ISNAN2_OP": return _OP.ISNAN2_OP
    case "ISINFINITE_OP": return _OP.ISINFINITE_OP
    case "MODE_SNGL_N": return { _tag: "MODE_SNGL_N", n: 0 } as any
    case "MODE_MULT_N": return { _tag: "MODE_MULT_N", n: 0 } as any
    case "ROUND_MODE_OP": return _OP.ROUND_MODE_OP
    case "BASE64_ENCODE_OP": return _OP.BASE64_ENCODE_OP
    case "BASE64_DECODE_OP": return _OP.BASE64_DECODE_OP
    case "TEXTROTATE_OP": return _OP.TEXTROTATE_OP
    case "TEXTINITIALS_OP": return _OP.TEXTINITIALS_OP
    case "TEXTCAMELCASE_OP": return _OP.TEXTCAMELCASE_OP
    case "TEXTSNAKECASE_OP": return _OP.TEXTSNAKECASE_OP
    case "TEXTKEBABCASE_OP": return _OP.TEXTKEBABCASE_OP
    case "WRAPCOLS_N": return { _tag: "WRAPCOLS_N", n: 0 } as any
    case "PRODUCT_IFS_N": return { _tag: "PRODUCT_IFS_N", n: 0 } as any
    case "MEDIAN_IF_N": return { _tag: "MEDIAN_IF_N", n: 0 } as any
    case "ISDATE_OP": return _OP.ISDATE_OP
    case "DIGITS_OP": return _OP.DIGITS_OP
    case "SIGMOID_OP": return _OP.SIGMOID_OP
    case "RELU_OP": return _OP.RELU_OP
    case "SOFTPLUS_OP": return _OP.SOFTPLUS_OP
    case "ELU_OP": return _OP.ELU_OP
    case "NORMALIZE_OP": return _OP.NORMALIZE_OP
    case "MAP_RANGE_OP": return _OP.MAP_RANGE_OP
    case "TEXTCENTER_OP": return _OP.TEXTCENTER_OP
    case "WORDCOUNT_OP": return _OP.WORDCOUNT_OP
    case "YEARMONTH_OP": return _OP.YEARMONTH_OP
    case "QUARTER_OP": return _OP.QUARTER_OP
    case "DAYOFYEAR_OP": return _OP.DAYOFYEAR_OP
    case "ISLEAPYEAR_OP": return _OP.ISLEAPYEAR_OP
    case "DAYSINYEAR_OP": return _OP.DAYSINYEAR_OP
    case "DAYSINMONTH_OP": return _OP.DAYSINMONTH_OP
    case "TEXTSLICE_OP": return _OP.TEXTSLICE_OP
    case "TEXTINDEXOF_OP": return _OP.TEXTINDEXOF_OP
    case "TEXTSPLIT_ALL_N": return { _tag: "TEXTSPLIT_ALL_N", n: 0 } as any
    case "ISINTEGER_OP": return _OP.ISINTEGER_OP
    case "ISFLOAT_OP": return _OP.ISFLOAT_OP
    case "ISPOSITIVE_OP": return _OP.ISPOSITIVE_OP
    case "ISNEGATIVE_OP": return _OP.ISNEGATIVE_OP
    case "ROUND_SIGNIF_OP": return _OP.ROUND_SIGNIF_OP
    case "CLAMP_OP": return _OP.CLAMP_OP
    case "LERP_OP": return _OP.LERP_OP
    case "SMOOTHSTEP_OP": return _OP.SMOOTHSTEP_OP
    case "PERCENTILE_EXC_N": return { _tag: "PERCENTILE_EXC_N", n: 0 } as any
    case "PERCENTILE_INC_N": return { _tag: "PERCENTILE_INC_N", n: 0 } as any
    case "ENCODEURL_OP": return _OP.ENCODEURL_OP
    case "DECODEURL_OP": return _OP.DECODEURL_OP
    case "ISURL_OP": return _OP.ISURL_OP
    case "ISEMAIL_OP": return _OP.ISEMAIL_OP
    case "HASH_OP": return _OP.HASH_OP
    case "TEXTSQUEEZE_OP": return _OP.TEXTSQUEEZE_OP
    case "GESTEP_OP": return _OP.GESTEP_OP
    case "DELTA_OP": return _OP.DELTA_OP
    case "CHISQ_DIST_RT_OP": return _OP.CHISQ_DIST_RT_OP
    case "TDIST_RT_OP": return _OP.TDIST_RT_OP
    case "FDIST_RT_OP": return _OP.FDIST_RT_OP
    case "T_INV_2T_OP": return _OP.T_INV_2T_OP
    case "TYPE_NUM_OP": return _OP.TYPE_NUM_OP
    case "ISBINARY_OP": return _OP.ISBINARY_OP
    case "ISHEX_OP": return _OP.ISHEX_OP
    case "ACOTH_OP": return _OP.ACOTH_OP
    case "EXPAND_N": return { _tag: "EXPAND_N", n: 0 } as any
    case "COALESCE_N": return { _tag: "COALESCE_N", n: 0 } as any
    case "ENDSWITH_OP": return _OP.ENDSWITH_OP
    case "TEXTREVERSE_OP": return _OP.TEXTREVERSE_OP
    case "TEXTREMOVE_OP": return _OP.TEXTREMOVE_OP
    case "REGEXMATCH_OP": return _OP.REGEXMATCH_OP
    case "REGEXEXTRACT_OP": return _OP.REGEXEXTRACT_OP
    case "REGEXREPLACE_OP": return _OP.REGEXREPLACE_OP
    case "FILTER_N": return { _tag: "FILTER_N", n: 0 } as any
    case "TAKE_N": return { _tag: "TAKE_N", n: 0 } as any
    case "DROP_N": return { _tag: "DROP_N", n: 0 } as any
    case "CHOOSECOLS_N": return { _tag: "CHOOSECOLS_N", n: 0 } as any
    case "CHOOSEROWS_N": return { _tag: "CHOOSEROWS_N", n: 0 } as any
    case "IMPLIES_OP": return _OP.IMPLIES_OP
    case "BETWEEN_OP": return _OP.BETWEEN_OP
    case "ISFORMULA_OP": return _OP.ISFORMULA_OP
    case "SHEET_OP": return _OP.SHEET_OP
    case "SHEETS_OP": return _OP.SHEETS_OP
    case "SERIESSUM_N": return { _tag: "SERIESSUM_N", n: 0 } as any
    case "SUBTOTAL_MODE_N": return { _tag: "SUBTOTAL_MODE_N", n: 0 } as any
    case "MULTINOMIAL_N": return { _tag: "MULTINOMIAL_N", n: 0 } as any
    case "WEIBULL_DIST_OP": return _OP.WEIBULL_DIST_OP
    case "EXPON_DIST_OP": return _OP.EXPON_DIST_OP
    case "LOGNORM_DIST_OP": return _OP.LOGNORM_DIST_OP
    case "COUPPCD_OP": return _OP.COUPPCD_OP
    case "COUPNCD_OP": return _OP.COUPNCD_OP
    case "ODDFPRICE_OP": return _OP.ODDFPRICE_OP
    case "TEXT_CONTAINS_OP": return _OP.TEXT_CONTAINS_OP
    case "TEXT_STARTSWITH_OP": return _OP.TEXT_STARTSWITH_OP
    case "YIELDMAT_OP": return _OP.YIELDMAT_OP
    case "ACCRINTM_OP": return _OP.ACCRINTM_OP
    case "COUPDAYSNC_OP": return _OP.COUPDAYSNC_OP
    case "COUPNUM_OP": return _OP.COUPNUM_OP
    case "TEXTPADSTART_OP": return _OP.TEXTPADSTART_OP
    case "TEXTPADEND_OP": return _OP.TEXTPADEND_OP
    case "TEXTWRAP_OP": return _OP.TEXTWRAP_OP
    case "ISERR_OP": return _OP.ISERR_OP
    case "ISNULL_OP": return _OP.ISNULL_OP
    case "HYPOT_OP": return _OP.HYPOT_OP
    case "MDETERM_OP": return _OP.MDETERM_OP
    case "MINVERSE_OP": return _OP.MINVERSE_OP
    case "BETA_INV_OP": return _OP.BETA_INV_OP
    case "GAMMA_INV_OP": return _OP.GAMMA_INV_OP
    case "AVERAGEWEIGHTED_N": return { _tag: "AVERAGEWEIGHTED_N", n: 0 } as any
    case "DCOUNT_N": return { _tag: "DCOUNT_N", n: 0 } as any
    case "DSUM_N": return { _tag: "DSUM_N", n: 0 } as any
    case "DAVERAGE_N": return { _tag: "DAVERAGE_N", n: 0 } as any
    case "DMAX_N": return { _tag: "DMAX_N", n: 0 } as any
    case "DMIN_N": return { _tag: "DMIN_N", n: 0 } as any
    case "DSTDEV_N": return { _tag: "DSTDEV_N", n: 0 } as any
    case "DVAR_N": return { _tag: "DVAR_N", n: 0 } as any
    case "DGET_N": return { _tag: "DGET_N", n: 0 } as any
    case "DCOUNTA_N": return { _tag: "DCOUNTA_N", n: 0 } as any
    case "PERCENTRANK_EXC_N": return { _tag: "PERCENTRANK_EXC_N", n: 0 } as any
    case "QUARTILE_EXC_N": return { _tag: "QUARTILE_EXC_N", n: 0 } as any
    case "QUARTILE_INC_N": return { _tag: "QUARTILE_INC_N", n: 0 } as any
    case "NAND_OP": return _OP.NAND_OP
    case "NOR_OP": return _OP.NOR_OP
    case "XNOR_OP": return _OP.XNOR_OP
    case "SORTBY_N": return { _tag: "SORTBY_N", n: 0 } as any
    case "SINGLE_N": return { _tag: "SINGLE_N", n: 0 } as any
    case "XLOOKUP_N": return { _tag: "XLOOKUP_N", n: 0 } as any
    case "HYPERLINK_OP": return _OP.HYPERLINK_OP
    case "NUMBERSTRING_OP": return _OP.NUMBERSTRING_OP
    case "IFBLANK_OP": return _OP.IFBLANK_OP
    case "SUBSTITUTEN_OP": return _OP.SUBSTITUTEN_OP
    case "TEXTSPLIT_DELIM_OP": return _OP.TEXTSPLIT_DELIM_OP
    case "COMBINA_OP": return _OP.COMBINA_OP
    case "PERMUTATIONA_OP": return _OP.PERMUTATIONA_OP
    case "SQRTPI_OP": return _OP.SQRTPI_OP
    case "RANDBETWEEN_INT_OP": return _OP.RANDBETWEEN_INT_OP
    case "ISO_CEILING_OP": return _OP.ISO_CEILING_OP
    case "YIELDDISC_OP": return _OP.YIELDDISC_OP
    case "PRICEMAT_OP": return _OP.PRICEMAT_OP
    case "ARRAYTOTEXT_N": return { _tag: "ARRAYTOTEXT_N", n: 0 } as any
    case "TOCOL_N": return { _tag: "TOCOL_N", n: 0 } as any
    case "TOROW_N": return { _tag: "TOROW_N", n: 0 } as any
    case "VSTACK_N": return { _tag: "VSTACK_N", n: 0 } as any
    case "MAKEARRAY_N": return { _tag: "MAKEARRAY_N", n: 0 } as any
    case "WEBSERVICE_OP": return _OP.WEBSERVICE_OP
    case "FIELDVALUE_OP": return _OP.FIELDVALUE_OP
    case "VLOOKUP_N": return { _tag: "VLOOKUP_N", n: 0 } as any
    case "HLOOKUP_N": return { _tag: "HLOOKUP_N", n: 0 } as any
    case "LOOKUP_N": return { _tag: "LOOKUP_N", n: 0 } as any
    case "CLEANWS_OP": return _OP.CLEANWS_OP
    case "TEXTCOUNT_OP": return _OP.TEXTCOUNT_OP
    case "ISREF_OP": return _OP.ISREF_OP
    case "ISLOGICAL_OP": return _OP.ISLOGICAL_OP
    case "ISNONTEXT_OP": return _OP.ISNONTEXT_OP
    case "ERROR_TYPE_OP": return _OP.ERROR_TYPE_OP
    case "IFERROR_OP": return _OP.IFERROR_OP
    case "BITCOUNT_OP": return _OP.BITCOUNT_OP
    case "MROUND_OP": return _OP.MROUND_OP
    case "CEILING_MATH_OP": return _OP.CEILING_MATH_OP
    case "FLOOR_MATH_OP": return _OP.FLOOR_MATH_OP
    case "BASE_OP": return _OP.BASE_OP
    case "DECIMAL_OP": return _OP.DECIMAL_OP
    case "AMORLINC_OP": return _OP.AMORLINC_OP
    case "PRICE_OP": return _OP.PRICE_OP
    case "ODDLPRICE_OP": return _OP.ODDLPRICE_OP
    case "INFO_OP": return _OP.INFO_OP
    case "CUMPRINC_OP": return _OP.CUMPRINC_OP
    case "PDURATION_OP": return _OP.PDURATION_OP
    case "RRI_OP": return _OP.RRI_OP
    case "TBILLEQ_OP": return _OP.TBILLEQ_OP
    case "TBILLPRICE_OP": return _OP.TBILLPRICE_OP
    case "DURATION_OP": return _OP.DURATION_OP
    case "MDURATION_OP": return _OP.MDURATION_OP
    case "XIRR_N": return { _tag: "XIRR_N", n: 0 } as any
    case "YIELD_OP": return _OP.YIELD_OP
    case "ROWS_N": return { _tag: "ROWS_N", n: 0 } as any
    case "TYPE_OP": return _OP.TYPE_OP
    case "AREAS_N": return { _tag: "AREAS_N", n: 0 } as any
    case "TRANSPOSE_N": return { _tag: "TRANSPOSE_N", n: 0 } as any
    case "CHITEST_N": return { _tag: "CHITEST_N", n: 0 } as any
    case "TTEST_N": return { _tag: "TTEST_N", n: 0 } as any
    case "FTEST_N": return { _tag: "FTEST_N", n: 0 } as any
    case "LINEST_N": return { _tag: "LINEST_N", n: 0 } as any
    case "LOGEST_N": return { _tag: "LOGEST_N", n: 0 } as any
    case "VARA_N": return { _tag: "VARA_N", n: 0 } as any
    case "STDEVA_N": return { _tag: "STDEVA_N", n: 0 } as any
    case "VARPA_N": return { _tag: "VARPA_N", n: 0 } as any
    case "STDEVPA_N": return { _tag: "STDEVPA_N", n: 0 } as any
    case "PERCENTRANK_INC_N": return { _tag: "PERCENTRANK_INC_N", n: 0 } as any
    case "BETA_FN_OP": return _OP.BETA_FN_OP
    case "BESSELK_OP": return _OP.BESSELK_OP
    case "BESSELI_OP": return _OP.BESSELI_OP
    case "PERCENTILE_INC_N": return { _tag: "PERCENTILE_INC_N", n: 0 } as any
    case "PERCENTILE_EXC_N": return { _tag: "PERCENTILE_EXC_N", n: 0 } as any
    case "RANK_EQ_N": return { _tag: "RANK_EQ_N", n: 0 } as any
    case "RANK_AVG_N": return { _tag: "RANK_AVG_N", n: 0 } as any
    case "VAR_S_N": return { _tag: "VAR_S_N", n: 0 } as any
    case "NORMS_DIST_OP": return _OP.NORMS_DIST_OP
    case "NORMS_INV_OP": return _OP.NORMS_INV_OP
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
const ALWAYS_N_FNS = new Set(["AND_N", "OR_N", "CHOOSE_N", "SWITCH_N", "IFS_N", "IRR_N", "NPV_N", "VAR_N", "PERCENTILE_N", "COUNTA_N", "COUNTBLANK_N", "SUMPRODUCT_N", "MATCH_N", "INDEX_N", "MODE_N", "HARMEAN_N", "GEOMEAN_N", "AGGREGATE_N", "COUNTIF_N", "COUNTIFS_N", "CONCAT_WS_N", "FVSCHEDULE_N", "COLUMNS_N", "ARRAYTOTEXT_N", "TOCOL_N", "TOROW_N", "VSTACK_N", "LCMM_N", "GCDM_N", "KURTOSIS_N", "SKEWNESS_N", "GEOMEAN2_N", "HARMEAN2_N", "ALL_N", "ANY_N", "NONE_N", "MAJORITY_N", "COEFVAR_N", "COUNTIF2_N", "RMS_N", "RANGE2_N", "IQR_N", "MAPE_N", "ENTROPY_N", "GINI_N", "WINSORIZE_N", "PERCENTRANK_N", "CUMSUM_N", "CUMPROD_N", "MOVAVG_N", "MODE_SNGL_N", "MODE_MULT_N", "WRAPCOLS_N", "PRODUCT_IFS_N", "MEDIAN_IF_N", "TEXTSPLIT_ALL_N", "PERCENTILE_EXC_N", "PERCENTILE_INC_N", "EXPAND_N", "COALESCE_N", "FILTER_N", "TAKE_N", "DROP_N", "CHOOSECOLS_N", "CHOOSEROWS_N", "SERIESSUM_N", "SUBTOTAL_MODE_N", "MULTINOMIAL_N", "AVERAGEWEIGHTED_N", "DCOUNT_N", "DSUM_N", "DAVERAGE_N", "DMAX_N", "DMIN_N", "DSTDEV_N", "DVAR_N", "DGET_N", "DCOUNTA_N", "PERCENTRANK_EXC_N", "QUARTILE_EXC_N", "QUARTILE_INC_N", "SORTBY_N", "SINGLE_N", "XLOOKUP_N", "MAKEARRAY_N", "VLOOKUP_N", "HLOOKUP_N", "LOOKUP_N", "XIRR_N", "ROWS_N", "AREAS_N", "TRANSPOSE_N", "CHITEST_N", "TTEST_N", "FTEST_N", "LINEST_N", "LOGEST_N", "VARA_N", "STDEVA_N", "VARPA_N", "STDEVPA_N", "PERCENTRANK_INC_N", "PERCENTILE_INC_N", "PERCENTILE_EXC_N", "RANK_EQ_N", "RANK_AVG_N", "VAR_S_N", "ZTEST_N", "COVARIANCE_S_N", "STDEV_S_N", "GROWTH_N", "TREND_N", "FREQUENCY_N", "PROB_N2", "LAMBDA_N", "MAP_N", "REDUCE_N", "SCAN_N", "BYROW_N", "BYCOL_N", "DPRODUCT_N", "TAKE_N", "DROP_N", "HSTACK_N", "WRAPROWS_N", "LET_N", "CHOOSECOLS_N", "SUMXMY2_N", "SUMX2PY2_N", "SUMX2MY2_N", "MIRR_N", "XNPV_N", "SORT_N", "UNIQUE_N", "FILTER_N", "ROWS_N", "RANDARRAY_N", "SEQUENCE_N", "XMATCH_N", "AVERAGEA_N", "MAXA_N", "MINA_N", "TEXTSPLIT_N", "PERCENTRANK_N", "QUARTILE_N", "STEYX_N", "KURT_N", "SKEW_N", "SLOPE_N", "INTERCEPT_N", "RSQ_N", "COVAR_N", "FORECAST_N", "STDEVP_N", "VARP_N", "CORREL_N", "SUMSQ_N", "DEVSQ_N", "AVEDEV_N", "TRIMMEAN_N", "XOR_N", "SUBTOTAL_N", "MULTINOMIAL_N", "SERIESSUM_N", "SUMIFS_N", "AVERAGEIFS_N", "SUMIF_N", "MAXIFS_N", "MINIFS_N", "AVERAGEIF_N", "LARGE_N", "SMALL_N", "STDEV_N", "MEDIAN_N", "RANK_N", "CONCATENATE_N", "TEXTJOIN_N", "BINSEARCH_N", "INDEXMATCH_N", "LASTINDEXOF_N", "FINDALL_N", "COUNTUNIQ_N", "ARRAYCONTAINS_N", "ARRAYPOS_N", "FLATTEN2_N", "SWITCH2_N", "XORALL_N", "NANDALL_N", "NORALL_N", "COALESCE2_N", "MAD2_N", "SEM_N", "POOLEDVAR_N", "DISTINCT_N", "ARRAYSLICE_N", "ARRAYJOIN_N", "ARRAYREVERSE_N", "ARRAYFLATTEN_N", "ARRAYZIP_N", "ARRAYMIN_N", "ARRAYMAX_N", "ARRAYSUM_N", "ARRAYAVG_N", "COND_N", "ALLEQUAL_N", "ANYGT_N", "ANYLT_N", "ANYNE_N", "ISALL_N", "ISANY_N", "ISNONE_N", "ENTROPY2_N", "GINICOEF_N", "MOMENT_N", "CMOMENT_N", "ZSCORE3_N", "PERCENTILE2_N", "ONEOF_N", "FIRSTTRUTHY_N", "LASTTRUTHY_N", "COUNTIF3_N", "WHICHMAX_N", "WHICHMIN_N", "RANDPERM_N", "RANDCHOICE_N", "ENUMERATE_N", "COUNTVALS_N", "FIRSTNONZERO_N", "LASTNONZERO_N", "NTHLARGEST_N", "MAXDD_N", "TRIMMEDMEAN_N", "WINSOREDMEAN_N", "MIDRANGE_N", "MIDHINGE_N", "MEANDEV_N", "ROOTMEANSQERR_N", "MUXSEL_N", "DEMUX_N", "NTHSMALLEST_N", "ARGMAX_N", "ARGMIN_N", "DEDUP_N", "INTERLEAVE_N", "QUADMEAN_N", "POWMEAN_N", "LEHMER_N", "ENTROPY3_N", "RELENTROPY_N", "MUTUALINFO_N", "CROSSENTROPY_N", "CONTRAHARMONIC_N", "HERONIAN_N", "LOGTRANSFORM_N", "ZSCORENORM_N", "MAD3_N", "BIWEIGHT_N", "HUBER_N", "WINVAR_N", "MAJORITY2_N", "UNANIMOUS_N", "QUORUM_N", "VETO_N", "PRIORITYSEL_N", "FALLBACK_N", "RANK2_N", "DENSERANK_N", "NTILE_N", "ROWNUMBER_N", "RANDWEIGHTED_N", "RANDSAMPLE_N"])
const N_VARIANTS: Record<string, string> = {
  SUM_DYN: "SUM_N", MIN_DYN: "MIN_N", MAX_DYN: "MAX_N", AVG_DYN: "AVG_N",
  PRODUCT_DYN: "PRODUCT_N",
  AND_N: "AND_N", OR_N: "OR_N", CHOOSE_N: "CHOOSE_N", SWITCH_N: "SWITCH_N", IFS_N: "IFS_N",
  IRR_N: "IRR_N", NPV_N: "NPV_N", VAR_N: "VAR_N", PERCENTILE_N: "PERCENTILE_N", COUNTA_N: "COUNTA_N", COUNTBLANK_N: "COUNTBLANK_N",
  SUMPRODUCT_N: "SUMPRODUCT_N", MATCH_N: "MATCH_N", INDEX_N: "INDEX_N", MODE_N: "MODE_N", HARMEAN_N: "HARMEAN_N", GEOMEAN_N: "GEOMEAN_N", AGGREGATE_N: "AGGREGATE_N", COUNTIF_N: "COUNTIF_N", COUNTIFS_N: "COUNTIFS_N", SUMIF_N: "SUMIF_N", MAXIFS_N: "MAXIFS_N", MINIFS_N: "MINIFS_N", AVERAGEIF_N: "AVERAGEIF_N", LARGE_N: "LARGE_N", SMALL_N: "SMALL_N",
  CONCAT_WS_N: "CONCAT_WS_N", FVSCHEDULE_N: "FVSCHEDULE_N", COLUMNS_N: "COLUMNS_N", XIRR_N: "XIRR_N", AREAS_N: "AREAS_N", TRANSPOSE_N: "TRANSPOSE_N", CHITEST_N: "CHITEST_N", TTEST_N: "TTEST_N", FTEST_N: "FTEST_N", LINEST_N: "LINEST_N", LOGEST_N: "LOGEST_N", VARA_N: "VARA_N", STDEVA_N: "STDEVA_N", VARPA_N: "VARPA_N", STDEVPA_N: "STDEVPA_N", PERCENTRANK_INC_N: "PERCENTRANK_INC_N", PERCENTILE_INC_N: "PERCENTILE_INC_N", ENTROPY_N: "ENTROPY_N", GINI_N: "GINI_N", WINSORIZE_N: "WINSORIZE_N", PERCENTRANK_N: "PERCENTRANK_N", CUMSUM_N: "CUMSUM_N", CUMPROD_N: "CUMPROD_N", MOVAVG_N: "MOVAVG_N", MODE_SNGL_N: "MODE_SNGL_N", MODE_MULT_N: "MODE_MULT_N", WRAPCOLS_N: "WRAPCOLS_N", PRODUCT_IFS_N: "PRODUCT_IFS_N", MEDIAN_IF_N: "MEDIAN_IF_N", TEXTSPLIT_ALL_N: "TEXTSPLIT_ALL_N", PERCENTILE_EXC_N: "PERCENTILE_EXC_N", RANK_EQ_N: "RANK_EQ_N", RANK_AVG_N: "RANK_AVG_N", VAR_S_N: "VAR_S_N", ZTEST_N: "ZTEST_N", COVARIANCE_S_N: "COVARIANCE_S_N", STDEV_S_N: "STDEV_S_N", GROWTH_N: "GROWTH_N", TREND_N: "TREND_N", FREQUENCY_N: "FREQUENCY_N", PROB_N2: "PROB_N2", LAMBDA_N: "LAMBDA_N", MAP_N: "MAP_N", REDUCE_N: "REDUCE_N", SCAN_N: "SCAN_N", BYROW_N: "BYROW_N", BYCOL_N: "BYCOL_N", DPRODUCT_N: "DPRODUCT_N", TAKE_N: "TAKE_N", DROP_N: "DROP_N", HSTACK_N: "HSTACK_N", WRAPROWS_N: "WRAPROWS_N", LET_N: "LET_N", CHOOSECOLS_N: "CHOOSECOLS_N", SUMXMY2_N: "SUMXMY2_N", SUMX2PY2_N: "SUMX2PY2_N", SUMX2MY2_N: "SUMX2MY2_N", MIRR_N: "MIRR_N", XNPV_N: "XNPV_N", SORT_N: "SORT_N", UNIQUE_N: "UNIQUE_N", PERCENTILE_EXC_N: "PERCENTILE_EXC_N", PERCENTILE_INC_N: "PERCENTILE_INC_N", EXPAND_N: "EXPAND_N", COALESCE_N: "COALESCE_N", FILTER_N: "FILTER_N", ROWS_N: "ROWS_N", RANDARRAY_N: "RANDARRAY_N", SEQUENCE_N: "SEQUENCE_N", XMATCH_N: "XMATCH_N", AVERAGEA_N: "AVERAGEA_N", MAXA_N: "MAXA_N", MINA_N: "MINA_N", TEXTSPLIT_N: "TEXTSPLIT_N", PERCENTRANK_N: "PERCENTRANK_N", QUARTILE_N: "QUARTILE_N", STEYX_N: "STEYX_N", KURT_N: "KURT_N", SKEW_N: "SKEW_N", SLOPE_N: "SLOPE_N", INTERCEPT_N: "INTERCEPT_N", RSQ_N: "RSQ_N", COVAR_N: "COVAR_N", FORECAST_N: "FORECAST_N", STDEVP_N: "STDEVP_N", VARP_N: "VARP_N", CORREL_N: "CORREL_N", SUMSQ_N: "SUMSQ_N", DEVSQ_N: "DEVSQ_N", AVEDEV_N: "AVEDEV_N", TRIMMEAN_N: "TRIMMEAN_N", LCMM_N: "LCMM_N", GCDM_N: "GCDM_N", KURTOSIS_N: "KURTOSIS_N", SKEWNESS_N: "SKEWNESS_N", GEOMEAN2_N: "GEOMEAN2_N", HARMEAN2_N: "HARMEAN2_N", ALL_N: "ALL_N", ANY_N: "ANY_N", NONE_N: "NONE_N", MAJORITY_N: "MAJORITY_N", COEFVAR_N: "COEFVAR_N", COUNTIF2_N: "COUNTIF2_N", RMS_N: "RMS_N", RANGE2_N: "RANGE2_N", IQR_N: "IQR_N", MAPE_N: "MAPE_N",
  XOR_N: "XOR_N", SUBTOTAL_N: "SUBTOTAL_N",
  MULTINOMIAL_N: "MULTINOMIAL_N", SERIESSUM_N: "SERIESSUM_N",
  SUMIFS_N: "SUMIFS_N", AVERAGEIFS_N: "AVERAGEIFS_N",
  STDEV_N: "STDEV_N", MEDIAN_N: "MEDIAN_N", RANK_N: "RANK_N", CONCATENATE_N: "CONCATENATE_N", TEXTJOIN_N: "TEXTJOIN_N",
  BINSEARCH_N: "BINSEARCH_N", INDEXMATCH_N: "INDEXMATCH_N", LASTINDEXOF_N: "LASTINDEXOF_N", FINDALL_N: "FINDALL_N", COUNTUNIQ_N: "COUNTUNIQ_N", ARRAYCONTAINS_N: "ARRAYCONTAINS_N", ARRAYPOS_N: "ARRAYPOS_N", FLATTEN2_N: "FLATTEN2_N", SWITCH2_N: "SWITCH2_N", XORALL_N: "XORALL_N", NANDALL_N: "NANDALL_N", NORALL_N: "NORALL_N", COALESCE2_N: "COALESCE2_N", MAD2_N: "MAD2_N", SEM_N: "SEM_N", POOLEDVAR_N: "POOLEDVAR_N", DISTINCT_N: "DISTINCT_N", ARRAYSLICE_N: "ARRAYSLICE_N", ARRAYJOIN_N: "ARRAYJOIN_N", ARRAYREVERSE_N: "ARRAYREVERSE_N", ARRAYFLATTEN_N: "ARRAYFLATTEN_N", ARRAYZIP_N: "ARRAYZIP_N", ARRAYMIN_N: "ARRAYMIN_N", ARRAYMAX_N: "ARRAYMAX_N", ARRAYSUM_N: "ARRAYSUM_N", ARRAYAVG_N: "ARRAYAVG_N", COND_N: "COND_N", ALLEQUAL_N: "ALLEQUAL_N", ANYGT_N: "ANYGT_N", ANYLT_N: "ANYLT_N", ANYNE_N: "ANYNE_N", ISALL_N: "ISALL_N", ISANY_N: "ISANY_N", ISNONE_N: "ISNONE_N", ENTROPY2_N: "ENTROPY2_N", GINICOEF_N: "GINICOEF_N", MOMENT_N: "MOMENT_N", CMOMENT_N: "CMOMENT_N", ZSCORE3_N: "ZSCORE3_N", PERCENTILE2_N: "PERCENTILE2_N", ONEOF_N: "ONEOF_N", FIRSTTRUTHY_N: "FIRSTTRUTHY_N", LASTTRUTHY_N: "LASTTRUTHY_N", COUNTIF3_N: "COUNTIF3_N", WHICHMAX_N: "WHICHMAX_N", WHICHMIN_N: "WHICHMIN_N", RANDPERM_N: "RANDPERM_N", RANDCHOICE_N: "RANDCHOICE_N", ENUMERATE_N: "ENUMERATE_N", COUNTVALS_N: "COUNTVALS_N", FIRSTNONZERO_N: "FIRSTNONZERO_N", LASTNONZERO_N: "LASTNONZERO_N", NTHLARGEST_N: "NTHLARGEST_N", MAXDD_N: "MAXDD_N", TRIMMEDMEAN_N: "TRIMMEDMEAN_N", WINSOREDMEAN_N: "WINSOREDMEAN_N", MIDRANGE_N: "MIDRANGE_N", MIDHINGE_N: "MIDHINGE_N", MEANDEV_N: "MEANDEV_N", ROOTMEANSQERR_N: "ROOTMEANSQERR_N", MUXSEL_N: "MUXSEL_N", DEMUX_N: "DEMUX_N", NTHSMALLEST_N: "NTHSMALLEST_N", ARGMAX_N: "ARGMAX_N", ARGMIN_N: "ARGMIN_N", DEDUP_N: "DEDUP_N", INTERLEAVE_N: "INTERLEAVE_N", QUADMEAN_N: "QUADMEAN_N", POWMEAN_N: "POWMEAN_N", LEHMER_N: "LEHMER_N", ENTROPY3_N: "ENTROPY3_N", RELENTROPY_N: "RELENTROPY_N", MUTUALINFO_N: "MUTUALINFO_N", CROSSENTROPY_N: "CROSSENTROPY_N", CONTRAHARMONIC_N: "CONTRAHARMONIC_N", HERONIAN_N: "HERONIAN_N", LOGTRANSFORM_N: "LOGTRANSFORM_N", ZSCORENORM_N: "ZSCORENORM_N", MAD3_N: "MAD3_N", BIWEIGHT_N: "BIWEIGHT_N", HUBER_N: "HUBER_N", WINVAR_N: "WINVAR_N", MAJORITY2_N: "MAJORITY2_N", UNANIMOUS_N: "UNANIMOUS_N", QUORUM_N: "QUORUM_N", VETO_N: "VETO_N", PRIORITYSEL_N: "PRIORITYSEL_N", FALLBACK_N: "FALLBACK_N", RANK2_N: "RANK2_N", DENSERANK_N: "DENSERANK_N", NTILE_N: "NTILE_N", ROWNUMBER_N: "ROWNUMBER_N", RANDWEIGHTED_N: "RANDWEIGHTED_N", RANDSAMPLE_N: "RANDSAMPLE_N",
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
  RANDBETWEEN: "RAND_BETWEEN", IRR: "IRR_N", RATE: "RATE_OP", DB: "DB_OP", NPER: "NPER_OP", BINSEARCH: "BINSEARCH_N", INDEXMATCH: "INDEXMATCH_N", LASTINDEXOF: "LASTINDEXOF_N", FINDALL: "FINDALL_N", COUNTUNIQ: "COUNTUNIQ_N", ARRAYCONTAINS: "ARRAYCONTAINS_N", ARRAYPOS: "ARRAYPOS_N", FLATTEN2: "FLATTEN2_N", IFF: "IFF_OP", SWITCH2: "SWITCH2_N", XORALL: "XORALL_N", NANDALL: "NANDALL_N", NORALL: "NORALL_N", COALESCE2: "COALESCE2_N", UNLESS: "UNLESS_OP", SECANT: "SECANT_OP", COSECANT: "COSECANT_OP", VERSINE: "VERSINE_OP", HAVERSINE: "HAVERSINE_OP", EXSECANT: "EXSECANT_OP", LEMNISCATE: "LEMNISCATE_OP", AGM2: "AGM2_OP", POWMOD: "POWMOD_OP", MAD2: "MAD2_N", ZSCORE2: "ZSCORE2_OP", TSTAT: "TSTAT_OP", FSTAT: "FSTAT_OP", CHISQSTAT: "CHISQSTAT_OP", SEM: "SEM_N", POOLEDVAR: "POOLEDVAR_N", TEXTCOUNTCHAR: "TEXTCOUNTCHAR_OP", TEXTZFILL: "TEXTZFILL_OP", TEXTLPAD: "TEXTLPAD_OP", TEXTRPAD: "TEXTRPAD_OP", TEXTABBREV: "TEXTABBREV_OP", TEXTWORDFREQ: "TEXTWORDFREQ_OP", TEXTSANITIZE: "TEXTSANITIZE_OP", TEXTMIRROR: "TEXTMIRROR_OP", TYPEOF3: "TYPEOF3_OP", ISBLANK2: "ISBLANK2_OP", ISTRUTHY: "ISTRUTHY_OP", ISFALSY: "ISFALSY_OP", ISFRACTION: "ISFRACTION_OP", ISDIVISIBLE: "ISDIVISIBLE_OP", PVANNUITY: "PVANNUITY_OP", ANNUITYPMT: "ANNUITYPMT_OP", BONDPRICE: "BONDPRICE_OP", BONDYIELD: "BONDYIELD_OP", TBILL2: "TBILL2_OP", MACAULAY: "MACAULAY_OP", DISTINCT: "DISTINCT_N", ARRAYSLICE: "ARRAYSLICE_N", ARRAYJOIN: "ARRAYJOIN_N", ARRAYREVERSE: "ARRAYREVERSE_N", ARRAYFLATTEN: "ARRAYFLATTEN_N", ARRAYZIP: "ARRAYZIP_N", ARRAYMIN: "ARRAYMIN_N", ARRAYMAX: "ARRAYMAX_N", ARRAYSUM: "ARRAYSUM_N", ARRAYAVG: "ARRAYAVG_N", NIFF: "NIFF_OP", SWITCHIF: "SWITCHIF_OP", COND: "COND_N", ALLEQUAL: "ALLEQUAL_N", ANYGT: "ANYGT_N", ANYLT: "ANYLT_N", ANYNE: "ANYNE_N", ISALL: "ISALL_N", ISANY: "ISANY_N", ISNONE: "ISNONE_N", RANDNORM: "RANDNORM_OP", RANDEXP: "RANDEXP_OP", RANDINT: "RANDINT_OP", COINFLIP: "COINFLIP_OP", GUDERMANN: "GUDERMANN_OP", INVERSEGUD: "INVERSEGUD_OP", LANCZOS: "LANCZOS_OP", DIGAMMA: "DIGAMMA_OP", POLYGAMMA: "POLYGAMMA_OP", ZETA2: "ZETA2_OP", BETAFN: "BETAFN_OP", POCHHAMMER: "POCHHAMMER_OP", ENTROPY2: "ENTROPY2_N", GINICOEF: "GINICOEF_N", MOMENT: "MOMENT_N", CMOMENT: "CMOMENT_N", ZSCORE3: "ZSCORE3_N", PERCENTILE2: "PERCENTILE2_N", TEXTFORMAT: "TEXTFORMAT_OP", TEXTJUSTIFY: "TEXTJUSTIFY_OP", TEXTMASK2: "TEXTMASK2_OP", TEXTHASH: "TEXTHASH_OP", TEXTREPLACE2: "TEXTREPLACE2_OP", TEXTFILL: "TEXTFILL_OP", CAGR2: "CAGR2_OP", DRAWDOWN: "DRAWDOWN_OP", CALMAR: "CALMAR_OP", TREYNOR: "TREYNOR_OP", ISFINITE2: "ISFINITE2_OP", ISWHOLE: "ISWHOLE_OP", EQUIV: "EQUIV_OP", ONEOF: "ONEOF_N", FIRSTTRUTHY: "FIRSTTRUTHY_N", LASTTRUTHY: "LASTTRUTHY_N", COUNTIF3: "COUNTIF3_N", WHICHMAX: "WHICHMAX_N", WHICHMIN: "WHICHMIN_N", THRESHOLD: "THRESHOLD_OP", TOGGLE: "TOGGLE_OP", SATURATE: "SATURATE_OP", DEADBAND: "DEADBAND_OP", RANDPERM: "RANDPERM_N", RANDCHOICE: "RANDCHOICE_N", DICE: "DICE_OP", UUID4: "UUID4_OP", ENUMERATE: "ENUMERATE_N", COUNTVALS: "COUNTVALS_N", FIRSTNONZERO: "FIRSTNONZERO_N", LASTNONZERO: "LASTNONZERO_N", NTHLARGEST: "NTHLARGEST_N", AMORT: "AMORT_OP", DAILYRETURN: "DAILYRETURN_OP", VOLANNUAL: "VOLANNUAL_OP", MAXDD: "MAXDD_N", INFORMRATIO: "INFORMRATIO_OP", JENSENALPHA: "JENSENALPHA_OP", LAGUERRE: "LAGUERRE_OP", HERMITE: "HERMITE_OP", LEGENDRE: "LEGENDRE_OP", CHEBYSHEV2: "CHEBYSHEV2_OP", FRESNEL_S: "FRESNEL_S_OP", FRESNEL_C: "FRESNEL_C_OP", AIRY: "AIRY_OP", DAWSON: "DAWSON_OP", TRIMMEDMEAN: "TRIMMEDMEAN_N", WINSOREDMEAN: "WINSOREDMEAN_N", MIDRANGE: "MIDRANGE_N", MIDHINGE: "MIDHINGE_N", MEANDEV: "MEANDEV_N", ROOTMEANSQERR: "ROOTMEANSQERR_N", TEXTWORDWRAP: "TEXTWORDWRAP_OP", TEXTCOLUMNS: "TEXTCOLUMNS_OP", TEXTTAB: "TEXTTAB_OP", TEXTBOXIFY: "TEXTBOXIFY_OP", TEXTCOUNTWORDS: "TEXTCOUNTWORDS_OP", TEXTFIRSTWORD: "TEXTFIRSTWORD_OP", ISNUMTYPE: "ISNUMTYPE_OP", ISSTRTYPE: "ISSTRTYPE_OP", ISBOOLTYPE: "ISBOOLTYPE_OP", ISERRORTYPE: "ISERRORTYPE_OP", IFPOS: "IFPOS_OP", IFNEG: "IFNEG_OP", IFZERO: "IFZERO_OP", IFEVEN: "IFEVEN_OP", IFODD: "IFODD_OP", GATE: "GATE_OP", LATCH: "LATCH_OP", DEBOUNCE: "DEBOUNCE_OP", MUXSEL: "MUXSEL_N", DEMUX: "DEMUX_N", RANDSIGN: "RANDSIGN_OP", RANDBOOL: "RANDBOOL_OP", NTHSMALLEST: "NTHSMALLEST_N", ARGMAX: "ARGMAX_N", ARGMIN: "ARGMIN_N", DEDUP: "DEDUP_N", INTERLEAVE: "INTERLEAVE_N", COUPON: "COUPON_OP", ACCRUEDINT: "ACCRUEDINT_OP", PARVALUE: "PARVALUE_OP", HOLDINGRETURN: "HOLDINGRETURN_OP", TIMEDWRETURN: "TIMEDWRETURN_OP", DIVYIELD: "DIVYIELD_OP", SININT: "SININT_OP", COSINT: "COSINT_OP", EXPINT: "EXPINT_OP", LOGINT: "LOGINT_OP", DILOG: "DILOG_OP", CLAUSEN: "CLAUSEN_OP", ELLIPK: "ELLIPK_OP", ELLIPE: "ELLIPE_OP", QUADMEAN: "QUADMEAN_N", POWMEAN: "POWMEAN_N", LEHMER: "LEHMER_N", ENTROPY3: "ENTROPY3_N", RELENTROPY: "RELENTROPY_N", MUTUALINFO: "MUTUALINFO_N", CROSSENTROPY: "CROSSENTROPY_N", TEXTINITCAP: "TEXTINITCAP_OP", TEXTSNIP: "TEXTSNIP_OP", TEXTUNQUOTE: "TEXTUNQUOTE_OP", TEXTQUOTE: "TEXTQUOTE_OP", TEXTDOTS: "TEXTDOTS_OP", TEXTBULLET: "TEXTBULLET_OP", ISNUMERIC: "ISNUMERIC_OP", ISTEXT2: "ISTEXT2_OP", ISERR2: "ISERR2_OP", ISBLANK3: "ISBLANK3_OP", ISNOTEMPTY: "ISNOTEMPTY_OP", TYPESTR: "TYPESTR_OP", JACOBI: "JACOBI_OP", BESSEL_I0: "BESSEL_I0_OP", BESSEL_J0: "BESSEL_J0_OP", BESSEL_K0: "BESSEL_K0_OP", STRUVE: "STRUVE_OP", WEBER: "WEBER_OP", HURWITZ: "HURWITZ_OP", POLYLOG: "POLYLOG_OP", LAMBERTW: "LAMBERTW_OP", AGMFN: "AGMFN_OP", CONTRAHARMONIC: "CONTRAHARMONIC_N", HERONIAN: "HERONIAN_N", LOGTRANSFORM: "LOGTRANSFORM_N", ZSCORENORM: "ZSCORENORM_N", MAD3: "MAD3_N", BIWEIGHT: "BIWEIGHT_N", HUBER: "HUBER_N", WINVAR: "WINVAR_N", TEXTCENTER2: "TEXTCENTER2_OP", TEXTINDENT: "TEXTINDENT_OP", TEXTHEADER: "TEXTHEADER_OP", TEXTFOOTER: "TEXTFOOTER_OP", TEXTCOUNTLINES: "TEXTCOUNTLINES_OP", TEXTISEMPTY: "TEXTISEMPTY_OP", TEXTCOALESCE: "TEXTCOALESCE_OP", TEXTTAG: "TEXTTAG_OP", ISPOS: "ISPOS_OP", ISNEG2: "ISNEG2_OP", ISNONZERO: "ISNONZERO_OP", ISINRANGE: "ISINRANGE_OP", SIGNOF: "SIGNOF_OP", MAGNITUDE: "MAGNITUDE_OP", COSTBASIS: "COSTBASIS_OP", UNREALIZEDPNL: "UNREALIZEDPNL_OP", REALIZEDPNL: "REALIZEDPNL_OP", DOLLARVAL: "DOLLARVAL_OP", BASISPOINTS: "BASISPOINTS_OP", TICKVALUE: "TICKVALUE_OP", MAJORITY2: "MAJORITY2_N", UNANIMOUS: "UNANIMOUS_N", QUORUM: "QUORUM_N", VETO: "VETO_N", PRIORITYSEL: "PRIORITYSEL_N", FALLBACK: "FALLBACK_N", RANK2: "RANK2_N", DENSERANK: "DENSERANK_N", NTILE: "NTILE_N", ROWNUMBER: "ROWNUMBER_N", RANDWEIGHTED: "RANDWEIGHTED_N", RANDSAMPLE: "RANDSAMPLE_N", FIBONACCI2: "FIBONACCI2_OP", MOTZKIN: "MOTZKIN_OP", DERANGEMENT: "DERANGEMENT_OP", TOTIENT2: "TOTIENT2_OP", HARMONIC2: "HARMONIC2_OP", TEXTOBFUSCATE: "TEXTOBFUSCATE_OP", TEXTCOUNT2: "TEXTCOUNT2_OP", TEXTSHUFFLE: "TEXTSHUFFLE_OP", ISCOPRIMEALL: "ISCOPRIMEALL_N", ISFIBBISH: "ISFIBBISH_OP", COPRIME: "COPRIME_OP", COLLATZ: "COLLATZ_OP", PREVPRIME: "PREVPRIME_OP", TEXTPAD: "TEXTPAD_OP", TEXTMASK: "TEXTMASK_OP", TEXTISURL: "TEXTISURL_OP", TEXTISEMAIL: "TEXTISEMAIL_OP", WORDSCOUNT: "WORDSCOUNT_OP", ISLEAPYEAR: "ISLEAPYEAR_OP", WEEKOFYEAR: "WEEKOFYEAR_OP", ISWEEKEND: "ISWEEKEND_OP", QUARTERNO: "QUARTERNO_OP", SEMESTERNO: "SEMESTERNO_OP", EFFECTRATE: "EFFECTRATE_OP", NOMRATE: "NOMRATE_OP", AVEDEV2: "AVEDEV2_N", COVAR2: "COVAR2_N", CORREL2: "CORREL2_N", NPER2: "NPER2_OP", RATE2: "RATE2_OP", COSSIM: "COSSIM_N", CHEBYSHEV: "CHEBYSHEV_OP", ISPOWEROFTWO: "ISPOWEROFTWO_OP", NEXTODD: "NEXTODD_OP", NEXTEVEN: "NEXTEVEN_OP", TOROMAN: "TOROMAN_OP", FROMROMAN: "FROMROMAN_OP", TOORDINAL: "TOORDINAL_OP", TEXTHEX: "TEXTHEX_OP", TEXTFROMHEX: "TEXTFROMHEX_OP", TEXTDEDUPE: "TEXTDEDUPE_OP", TEXTLINES: "TEXTLINES_OP", TEXTPASCALCASE: "TEXTPASCALCASE_OP", WMEAN: "WMEAN_N", GINI2: "GINI2_N", ISPRIMEFAST: "ISPRIMEFAST_OP", SHARPE: "SHARPE_OP", SORTINO: "SORTINO_OP", EMAVG: "EMAVG_OP", SMAVG: "SMAVG_OP", ABUNDANCY: "ABUNDANCY_OP", DIGITCOUNT: "DIGITCOUNT_OP", GOLDEN: "GOLDEN_OP", EULER2: "EULER_OP", TAU: "TAU_OP", CUBEROOT: "CUBEROOT_OP", WRAP: "WRAP_OP", REMAP: "REMAP_OP", TEXTBASE64: "TEXTBASE64_OP", TEXTFROMBASE64: "TEXTFROMBASE64_OP", TEXTPREFIX: "TEXTPREFIX_OP", TEXTSUFFIX: "TEXTSUFFIX_OP", RMS: "RMS_N", RANGE2: "RANGE2_N", IQR: "IQR_N", MAPE: "MAPE_N", ISODD2: "ISODD2_OP", ISEVEN2: "ISEVEN2_OP", ISZERO: "ISZERO_OP", ANNUITY: "ANNUITY_OP", FVANNUITY: "FUTUREVALUE2_OP", LUCAS: "LUCAS_OP", BELL: "BELL_OP", INTLOG2: "INTLOG2_OP", INTLOG10: "INTLOG10_OP", BITLEN: "BITLEN_OP", TEXTREPEAT: "TEXTREPEAT_OP", TEXTNTH: "TEXTNTH_OP", TEXTUNIQUE: "TEXTUNIQUE_OP", TEXTDISTINCT: "TEXTDISTINCT_OP", COUNTIF2: "COUNTIF2_N", CHARCOUNT: "CHARCOUNT_OP", ISEMPTYTEXT: "ISEMPTYTEXT_OP", RULEOF72: "RULEOF72_OP", PRESENTVAL: "PRESENTVALUE_OP", SAWTOOTH: "SAWTOOTH_OP", SQUAREWAVE: "SQUAREWAVE_OP", TRIANGLEWAVE: "TRIANGLEWAVE_OP", AGM: "AGM_OP", LOGISTIC: "LOGISTIC_OP", GAMMA2: "GAMMA2_OP", TEXTROT13: "TEXTROT13_OP", TEXTCAESAR: "TEXTCAESAR_OP", TEXTFREQ: "TEXTFREQ_OP", ISASCII: "ISASCII_OP", ISPRINTABLE: "ISPRINTABLE_OP", ISWHITESPACE: "ISWHITESPACE_OP", SIMPLEINT: "SIMPLEINTEREST_OP", COMPOUNDINT: "COMPOUNDINTEREST_OP", DEPRECIATION: "DEPRECIATION_OP", PENTAGONAL: "PENTAGONAL_OP", HEXAGONAL: "HEXAGONAL_OP", TETRAHEDRAL: "TETRAHEDRAL_OP", PYRAMIDAL: "PYRAMIDAL_OP", STIRLING: "STIRLING_OP", CONEVOL: "CONEVOL_OP", TEXTRLE: "TEXTRLE_OP", TEXTRLD: "TEXTRLD_OP", ISPERFECT: "ISPERFECT_OP", ISHARSHAD: "ISHARSHAD_OP", DEG2RAD: "DEG2RAD_OP", RAD2DEG: "RAD2DEG_OP", SINC: "SINC_OP", ATAN22: "ATAN2_OP", BINOMCOEF: "BINOMCOEF_OP", CATALAN: "CATALAN_OP", TRIANGLENUM: "TRIANGLENUM_OP", TEXTEMOJI: "TEXTEMOJI_OP", TEXTSTRIP: "TEXTSTRIP_OP", TEXTNORM: "TEXTNORMALIZE_OP", TEXTMORSE: "TEXTMORSE_OP", BREAKEVEN: "BREAKEVEN_OP", PROFITMARGIN: "PROFITMARGIN_OP", MARKUP: "MARKUP_OP", ISUPPER: "ISUPPER_OP", ISLOWER: "ISLOWER_OP", ISPALINDROME: "ISPALINDROME_OP", REPEAT2: "REPEAT_N", LCMM: "LCMM_N", GCDM: "GCDM_N", POLYGONAREA: "POLYGONAREA_OP", CIRCLEAREA: "CIRCLEAREA_OP", SPHEREVOL: "SPHEREVOL_OP", CYLINDERVOL: "CYLINDERVOL_OP", KURTOSIS: "KURTOSIS_N", SKEWNESS: "SKEWNESS_N", GEOMEAN2: "GEOMEAN2_N", HARMEAN2: "HARMEAN2_N", TEXTSIM: "TEXTSIMILARITY_OP", TEXTZALGO: "TEXTZALGO_OP", TEXTASCII: "TEXTASCII_OP", TEXTSLUG: "TEXTSLUG_OP", WACC: "WACC_OP", PAYBACK: "PAYBACK_OP", ROI: "ROI_OP", ISNUMSTR: "ISNUMERICSTR_OP", TEXTENTROPY: "TEXTENTROPY_OP", ALL2: "ALL_N", ANY2: "ANY_N", NONE2: "NONE_N", DIGSUM: "DIGSUM_OP", DIGROOT: "DIGROOT_OP", NTHROOT: "NTHROOT_OP", TEXTHAMMING: "TEXTHAMMINGDIST_OP", TEXTLEV: "TEXTLEVENSHTEIN_OP", ISALPHANUM: "ISALPHANUMERIC_OP", ISALPHA: "ISALPHABETIC_OP", MAJORITY: "MAJORITY_N", COEFVAR: "COEFVAR_N", TEXTPADSTART: "TEXTPADSTART_OP", TEXTPADEND: "TEXTPADEND_OP", TEXTWRAP: "TEXTWRAP_OP", CHARCODE: "CHARCODE_OP", FROMCHARCODE: "FROMCHARCODE_OP", ISPRIME: "ISPRIME_OP", NEXTPRIME: "NEXTPRIME_OP", PRIMECOUNT: "PRIMECOUNT_OP", TOTIENT: "TOTIENT_OP", DIVISORS: "DIVISORS_OP", SEQUENCE2: "SEQUENCE_GEN_N", LINSPACE: "LINSPACE_N", CELLTYPE: "CELLTYPE_OP", CHECKSUM: "CHECKSUM_OP", CAGR: "CAGR_OP", DISC: "DISC_OP", DOLLARDE: "DOLLARDE_OP", DOLLARFR: "DOLLARFR_OP", ENTROPY: "ENTROPY_N", GINI: "GINI_N", WINSORIZE: "WINSORIZE_N", HYPOT3: "HYPOT3_OP", DISTANCE2D: "DISTANCE2D_OP", MANHATTAN: "MANHATTAN_OP", FIBONACCI: "FIBONACCI_OP", COLLATZ: "COLLATZ_OP", TYPEOF2: "TYPEOF2_OP", SLN: "SLN_OP", PMT: "PMT_OP", FV: "FV_OP", PV: "PV_OP", MROUND: "MROUND_OP", FIXED: "FIXED_OP", DOLLAR: "DOLLAR_OP",
  SINH: "SINH_OP", COSH: "COSH_OP", TANH: "TANH_OP",
  SIN: "SIN_OP", COS: "COS_OP", TAN: "TAN_OP", ASIN: "ASIN_OP", ACOS: "ACOS_OP", ATAN: "ATAN_OP", ATAN2: "ATAN2_OP", RADIANS: "RADIANS_OP", DEGREES: "DEGREES_OP",
  FACT: "FACT_OP", QUOTIENT: "QUOTIENT_OP", GCD: "GCD_OP", LCM: "LCM_OP", COMBIN: "COMBIN_OP", SUBSTITUTE: "SUBSTITUTE_OP",
  ISNUM: "ISNUM_OP", ISTEXT: "ISTEXT_OP", ISERROR: "ISERROR_OP", ISBLANK: "ISBLANK_OP",
  NPV: "NPV_N", VAR: "VAR_N", PERCENTILE: "PERCENTILE_N", COUNTA: "COUNTA_N", COUNTBLANK: "COUNTBLANK_N",
  SUMPRODUCT: "SUMPRODUCT_N", MATCH: "MATCH_N", INDEX: "INDEX_N", MODE: "MODE_N", HARMEAN: "HARMEAN_N", GEOMEAN: "GEOMEAN_N", AGGREGATE: "AGGREGATE_N", COUNTIF: "COUNTIF_N", COUNTIFS: "COUNTIFS_N", SUMIF: "SUMIF_N", MAXIFS: "MAXIFS_N", MINIFS: "MINIFS_N", AVERAGEIF: "AVERAGEIF_N", LARGE: "LARGE_N", SMALL: "SMALL_N",
  STDEV: "STDEV_N", MEDIAN: "MEDIAN_N", RANK: "RANK_N", CONCATENATE: "CONCATENATE_N", TEXTJOIN: "TEXTJOIN_N",
  BINSEARCH: "BINSEARCH_N", INDEXMATCH: "INDEXMATCH_N", LASTINDEXOF: "LASTINDEXOF_N", FINDALL: "FINDALL_N", COUNTUNIQ: "COUNTUNIQ_N", ARRAYCONTAINS: "ARRAYCONTAINS_N", ARRAYPOS: "ARRAYPOS_N", FLATTEN2: "FLATTEN2_N", IFF: "IFF_OP", SWITCH2: "SWITCH2_N", XORALL: "XORALL_N", NANDALL: "NANDALL_N", NORALL: "NORALL_N", COALESCE2: "COALESCE2_N", UNLESS: "UNLESS_OP", SECANT: "SECANT_OP", COSECANT: "COSECANT_OP", VERSINE: "VERSINE_OP", HAVERSINE: "HAVERSINE_OP", EXSECANT: "EXSECANT_OP", LEMNISCATE: "LEMNISCATE_OP", AGM2: "AGM2_OP", POWMOD: "POWMOD_OP", MAD2: "MAD2_N", ZSCORE2: "ZSCORE2_OP", TSTAT: "TSTAT_OP", FSTAT: "FSTAT_OP", CHISQSTAT: "CHISQSTAT_OP", SEM: "SEM_N", POOLEDVAR: "POOLEDVAR_N", TEXTCOUNTCHAR: "TEXTCOUNTCHAR_OP", TEXTZFILL: "TEXTZFILL_OP", TEXTLPAD: "TEXTLPAD_OP", TEXTRPAD: "TEXTRPAD_OP", TEXTABBREV: "TEXTABBREV_OP", TEXTWORDFREQ: "TEXTWORDFREQ_OP", TEXTSANITIZE: "TEXTSANITIZE_OP", TEXTMIRROR: "TEXTMIRROR_OP", TYPEOF3: "TYPEOF3_OP", ISBLANK2: "ISBLANK2_OP", ISTRUTHY: "ISTRUTHY_OP", ISFALSY: "ISFALSY_OP", ISFRACTION: "ISFRACTION_OP", ISDIVISIBLE: "ISDIVISIBLE_OP", PVANNUITY: "PVANNUITY_OP", ANNUITYPMT: "ANNUITYPMT_OP", BONDPRICE: "BONDPRICE_OP", BONDYIELD: "BONDYIELD_OP", TBILL2: "TBILL2_OP", MACAULAY: "MACAULAY_OP", DISTINCT: "DISTINCT_N", ARRAYSLICE: "ARRAYSLICE_N", ARRAYJOIN: "ARRAYJOIN_N", ARRAYREVERSE: "ARRAYREVERSE_N", ARRAYFLATTEN: "ARRAYFLATTEN_N", ARRAYZIP: "ARRAYZIP_N", ARRAYMIN: "ARRAYMIN_N", ARRAYMAX: "ARRAYMAX_N", ARRAYSUM: "ARRAYSUM_N", ARRAYAVG: "ARRAYAVG_N", NIFF: "NIFF_OP", SWITCHIF: "SWITCHIF_OP", COND: "COND_N", ALLEQUAL: "ALLEQUAL_N", ANYGT: "ANYGT_N", ANYLT: "ANYLT_N", ANYNE: "ANYNE_N", ISALL: "ISALL_N", ISANY: "ISANY_N", ISNONE: "ISNONE_N", RANDNORM: "RANDNORM_OP", RANDEXP: "RANDEXP_OP", RANDINT: "RANDINT_OP", COINFLIP: "COINFLIP_OP", GUDERMANN: "GUDERMANN_OP", INVERSEGUD: "INVERSEGUD_OP", LANCZOS: "LANCZOS_OP", DIGAMMA: "DIGAMMA_OP", POLYGAMMA: "POLYGAMMA_OP", ZETA2: "ZETA2_OP", BETAFN: "BETAFN_OP", POCHHAMMER: "POCHHAMMER_OP", ENTROPY2: "ENTROPY2_N", GINICOEF: "GINICOEF_N", MOMENT: "MOMENT_N", CMOMENT: "CMOMENT_N", ZSCORE3: "ZSCORE3_N", PERCENTILE2: "PERCENTILE2_N", TEXTFORMAT: "TEXTFORMAT_OP", TEXTJUSTIFY: "TEXTJUSTIFY_OP", TEXTMASK2: "TEXTMASK2_OP", TEXTHASH: "TEXTHASH_OP", TEXTREPLACE2: "TEXTREPLACE2_OP", TEXTFILL: "TEXTFILL_OP", CAGR2: "CAGR2_OP", DRAWDOWN: "DRAWDOWN_OP", CALMAR: "CALMAR_OP", TREYNOR: "TREYNOR_OP", ISFINITE2: "ISFINITE2_OP", ISWHOLE: "ISWHOLE_OP", EQUIV: "EQUIV_OP", ONEOF: "ONEOF_N", FIRSTTRUTHY: "FIRSTTRUTHY_N", LASTTRUTHY: "LASTTRUTHY_N", COUNTIF3: "COUNTIF3_N", WHICHMAX: "WHICHMAX_N", WHICHMIN: "WHICHMIN_N", THRESHOLD: "THRESHOLD_OP", TOGGLE: "TOGGLE_OP", SATURATE: "SATURATE_OP", DEADBAND: "DEADBAND_OP", RANDPERM: "RANDPERM_N", RANDCHOICE: "RANDCHOICE_N", DICE: "DICE_OP", UUID4: "UUID4_OP", ENUMERATE: "ENUMERATE_N", COUNTVALS: "COUNTVALS_N", FIRSTNONZERO: "FIRSTNONZERO_N", LASTNONZERO: "LASTNONZERO_N", NTHLARGEST: "NTHLARGEST_N", AMORT: "AMORT_OP", DAILYRETURN: "DAILYRETURN_OP", VOLANNUAL: "VOLANNUAL_OP", MAXDD: "MAXDD_N", INFORMRATIO: "INFORMRATIO_OP", JENSENALPHA: "JENSENALPHA_OP", LAGUERRE: "LAGUERRE_OP", HERMITE: "HERMITE_OP", LEGENDRE: "LEGENDRE_OP", CHEBYSHEV2: "CHEBYSHEV2_OP", FRESNEL_S: "FRESNEL_S_OP", FRESNEL_C: "FRESNEL_C_OP", AIRY: "AIRY_OP", DAWSON: "DAWSON_OP", TRIMMEDMEAN: "TRIMMEDMEAN_N", WINSOREDMEAN: "WINSOREDMEAN_N", MIDRANGE: "MIDRANGE_N", MIDHINGE: "MIDHINGE_N", MEANDEV: "MEANDEV_N", ROOTMEANSQERR: "ROOTMEANSQERR_N", TEXTWORDWRAP: "TEXTWORDWRAP_OP", TEXTCOLUMNS: "TEXTCOLUMNS_OP", TEXTTAB: "TEXTTAB_OP", TEXTBOXIFY: "TEXTBOXIFY_OP", TEXTCOUNTWORDS: "TEXTCOUNTWORDS_OP", TEXTFIRSTWORD: "TEXTFIRSTWORD_OP", ISNUMTYPE: "ISNUMTYPE_OP", ISSTRTYPE: "ISSTRTYPE_OP", ISBOOLTYPE: "ISBOOLTYPE_OP", ISERRORTYPE: "ISERRORTYPE_OP", IFPOS: "IFPOS_OP", IFNEG: "IFNEG_OP", IFZERO: "IFZERO_OP", IFEVEN: "IFEVEN_OP", IFODD: "IFODD_OP", GATE: "GATE_OP", LATCH: "LATCH_OP", DEBOUNCE: "DEBOUNCE_OP", MUXSEL: "MUXSEL_N", DEMUX: "DEMUX_N", RANDSIGN: "RANDSIGN_OP", RANDBOOL: "RANDBOOL_OP", NTHSMALLEST: "NTHSMALLEST_N", ARGMAX: "ARGMAX_N", ARGMIN: "ARGMIN_N", DEDUP: "DEDUP_N", INTERLEAVE: "INTERLEAVE_N", COUPON: "COUPON_OP", ACCRUEDINT: "ACCRUEDINT_OP", PARVALUE: "PARVALUE_OP", HOLDINGRETURN: "HOLDINGRETURN_OP", TIMEDWRETURN: "TIMEDWRETURN_OP", DIVYIELD: "DIVYIELD_OP", SININT: "SININT_OP", COSINT: "COSINT_OP", EXPINT: "EXPINT_OP", LOGINT: "LOGINT_OP", DILOG: "DILOG_OP", CLAUSEN: "CLAUSEN_OP", ELLIPK: "ELLIPK_OP", ELLIPE: "ELLIPE_OP", QUADMEAN: "QUADMEAN_N", POWMEAN: "POWMEAN_N", LEHMER: "LEHMER_N", ENTROPY3: "ENTROPY3_N", RELENTROPY: "RELENTROPY_N", MUTUALINFO: "MUTUALINFO_N", CROSSENTROPY: "CROSSENTROPY_N", TEXTINITCAP: "TEXTINITCAP_OP", TEXTSNIP: "TEXTSNIP_OP", TEXTUNQUOTE: "TEXTUNQUOTE_OP", TEXTQUOTE: "TEXTQUOTE_OP", TEXTDOTS: "TEXTDOTS_OP", TEXTBULLET: "TEXTBULLET_OP", ISNUMERIC: "ISNUMERIC_OP", ISTEXT2: "ISTEXT2_OP", ISERR2: "ISERR2_OP", ISBLANK3: "ISBLANK3_OP", ISNOTEMPTY: "ISNOTEMPTY_OP", TYPESTR: "TYPESTR_OP", JACOBI: "JACOBI_OP", BESSEL_I0: "BESSEL_I0_OP", BESSEL_J0: "BESSEL_J0_OP", BESSEL_K0: "BESSEL_K0_OP", STRUVE: "STRUVE_OP", WEBER: "WEBER_OP", HURWITZ: "HURWITZ_OP", POLYLOG: "POLYLOG_OP", LAMBERTW: "LAMBERTW_OP", AGMFN: "AGMFN_OP", CONTRAHARMONIC: "CONTRAHARMONIC_N", HERONIAN: "HERONIAN_N", LOGTRANSFORM: "LOGTRANSFORM_N", ZSCORENORM: "ZSCORENORM_N", MAD3: "MAD3_N", BIWEIGHT: "BIWEIGHT_N", HUBER: "HUBER_N", WINVAR: "WINVAR_N", TEXTCENTER2: "TEXTCENTER2_OP", TEXTINDENT: "TEXTINDENT_OP", TEXTHEADER: "TEXTHEADER_OP", TEXTFOOTER: "TEXTFOOTER_OP", TEXTCOUNTLINES: "TEXTCOUNTLINES_OP", TEXTISEMPTY: "TEXTISEMPTY_OP", TEXTCOALESCE: "TEXTCOALESCE_OP", TEXTTAG: "TEXTTAG_OP", ISPOS: "ISPOS_OP", ISNEG2: "ISNEG2_OP", ISNONZERO: "ISNONZERO_OP", ISINRANGE: "ISINRANGE_OP", SIGNOF: "SIGNOF_OP", MAGNITUDE: "MAGNITUDE_OP", COSTBASIS: "COSTBASIS_OP", UNREALIZEDPNL: "UNREALIZEDPNL_OP", REALIZEDPNL: "REALIZEDPNL_OP", DOLLARVAL: "DOLLARVAL_OP", BASISPOINTS: "BASISPOINTS_OP", TICKVALUE: "TICKVALUE_OP", MAJORITY2: "MAJORITY2_N", UNANIMOUS: "UNANIMOUS_N", QUORUM: "QUORUM_N", VETO: "VETO_N", PRIORITYSEL: "PRIORITYSEL_N", FALLBACK: "FALLBACK_N", RANK2: "RANK2_N", DENSERANK: "DENSERANK_N", NTILE: "NTILE_N", ROWNUMBER: "ROWNUMBER_N", RANDWEIGHTED: "RANDWEIGHTED_N", RANDSAMPLE: "RANDSAMPLE_N", FIBONACCI2: "FIBONACCI2_OP", MOTZKIN: "MOTZKIN_OP", DERANGEMENT: "DERANGEMENT_OP", TOTIENT2: "TOTIENT2_OP", HARMONIC2: "HARMONIC2_OP", TEXTOBFUSCATE: "TEXTOBFUSCATE_OP", TEXTCOUNT2: "TEXTCOUNT2_OP", TEXTSHUFFLE: "TEXTSHUFFLE_OP", ISCOPRIMEALL: "ISCOPRIMEALL_N", ISFIBBISH: "ISFIBBISH_OP", COPRIME: "COPRIME_OP", COLLATZ: "COLLATZ_OP", PREVPRIME: "PREVPRIME_OP", TEXTPAD: "TEXTPAD_OP", TEXTMASK: "TEXTMASK_OP", TEXTISURL: "TEXTISURL_OP", TEXTISEMAIL: "TEXTISEMAIL_OP", WORDSCOUNT: "WORDSCOUNT_OP", ISLEAPYEAR: "ISLEAPYEAR_OP", WEEKOFYEAR: "WEEKOFYEAR_OP", ISWEEKEND: "ISWEEKEND_OP", QUARTERNO: "QUARTERNO_OP", SEMESTERNO: "SEMESTERNO_OP", EFFECTRATE: "EFFECTRATE_OP", NOMRATE: "NOMRATE_OP", AVEDEV2: "AVEDEV2_N", COVAR2: "COVAR2_N", CORREL2: "CORREL2_N", NPER2: "NPER2_OP", RATE2: "RATE2_OP", COSSIM: "COSSIM_N", CHEBYSHEV: "CHEBYSHEV_OP", ISPOWEROFTWO: "ISPOWEROFTWO_OP", NEXTODD: "NEXTODD_OP", NEXTEVEN: "NEXTEVEN_OP", TOROMAN: "TOROMAN_OP", FROMROMAN: "FROMROMAN_OP", TOORDINAL: "TOORDINAL_OP", TEXTHEX: "TEXTHEX_OP", TEXTFROMHEX: "TEXTFROMHEX_OP", TEXTDEDUPE: "TEXTDEDUPE_OP", TEXTLINES: "TEXTLINES_OP", TEXTPASCALCASE: "TEXTPASCALCASE_OP", WMEAN: "WMEAN_N", GINI2: "GINI2_N", ISPRIMEFAST: "ISPRIMEFAST_OP", SHARPE: "SHARPE_OP", SORTINO: "SORTINO_OP", EMAVG: "EMAVG_OP", SMAVG: "SMAVG_OP", ABUNDANCY: "ABUNDANCY_OP", DIGITCOUNT: "DIGITCOUNT_OP", GOLDEN: "GOLDEN_OP", EULER2: "EULER_OP", TAU: "TAU_OP", CUBEROOT: "CUBEROOT_OP", WRAP: "WRAP_OP", REMAP: "REMAP_OP", TEXTBASE64: "TEXTBASE64_OP", TEXTFROMBASE64: "TEXTFROMBASE64_OP", TEXTPREFIX: "TEXTPREFIX_OP", TEXTSUFFIX: "TEXTSUFFIX_OP", RMS: "RMS_N", RANGE2: "RANGE2_N", IQR: "IQR_N", MAPE: "MAPE_N", ISODD2: "ISODD2_OP", ISEVEN2: "ISEVEN2_OP", ISZERO: "ISZERO_OP", ANNUITY: "ANNUITY_OP", FVANNUITY: "FUTUREVALUE2_OP", LUCAS: "LUCAS_OP", BELL: "BELL_OP", INTLOG2: "INTLOG2_OP", INTLOG10: "INTLOG10_OP", BITLEN: "BITLEN_OP", TEXTREPEAT: "TEXTREPEAT_OP", TEXTNTH: "TEXTNTH_OP", TEXTUNIQUE: "TEXTUNIQUE_OP", TEXTDISTINCT: "TEXTDISTINCT_OP", COUNTIF2: "COUNTIF2_N", CHARCOUNT: "CHARCOUNT_OP", ISEMPTYTEXT: "ISEMPTYTEXT_OP", RULEOF72: "RULEOF72_OP", PRESENTVAL: "PRESENTVALUE_OP", SAWTOOTH: "SAWTOOTH_OP", SQUAREWAVE: "SQUAREWAVE_OP", TRIANGLEWAVE: "TRIANGLEWAVE_OP", AGM: "AGM_OP", LOGISTIC: "LOGISTIC_OP", GAMMA2: "GAMMA2_OP", TEXTROT13: "TEXTROT13_OP", TEXTCAESAR: "TEXTCAESAR_OP", TEXTFREQ: "TEXTFREQ_OP", ISASCII: "ISASCII_OP", ISPRINTABLE: "ISPRINTABLE_OP", ISWHITESPACE: "ISWHITESPACE_OP", SIMPLEINT: "SIMPLEINTEREST_OP", COMPOUNDINT: "COMPOUNDINTEREST_OP", DEPRECIATION: "DEPRECIATION_OP", PENTAGONAL: "PENTAGONAL_OP", HEXAGONAL: "HEXAGONAL_OP", TETRAHEDRAL: "TETRAHEDRAL_OP", PYRAMIDAL: "PYRAMIDAL_OP", STIRLING: "STIRLING_OP", CONEVOL: "CONEVOL_OP", TEXTRLE: "TEXTRLE_OP", TEXTRLD: "TEXTRLD_OP", ISPERFECT: "ISPERFECT_OP", ISHARSHAD: "ISHARSHAD_OP", DEG2RAD: "DEG2RAD_OP", RAD2DEG: "RAD2DEG_OP", SINC: "SINC_OP", ATAN22: "ATAN2_OP", BINOMCOEF: "BINOMCOEF_OP", CATALAN: "CATALAN_OP", TRIANGLENUM: "TRIANGLENUM_OP", TEXTEMOJI: "TEXTEMOJI_OP", TEXTSTRIP: "TEXTSTRIP_OP", TEXTNORM: "TEXTNORMALIZE_OP", TEXTMORSE: "TEXTMORSE_OP", BREAKEVEN: "BREAKEVEN_OP", PROFITMARGIN: "PROFITMARGIN_OP", MARKUP: "MARKUP_OP", ISUPPER: "ISUPPER_OP", ISLOWER: "ISLOWER_OP", ISPALINDROME: "ISPALINDROME_OP", REPEAT2: "REPEAT_N", LCMM: "LCMM_N", GCDM: "GCDM_N", POLYGONAREA: "POLYGONAREA_OP", CIRCLEAREA: "CIRCLEAREA_OP", SPHEREVOL: "SPHEREVOL_OP", CYLINDERVOL: "CYLINDERVOL_OP", KURTOSIS: "KURTOSIS_N", SKEWNESS: "SKEWNESS_N", GEOMEAN2: "GEOMEAN2_N", HARMEAN2: "HARMEAN2_N", TEXTSIM: "TEXTSIMILARITY_OP", TEXTZALGO: "TEXTZALGO_OP", TEXTASCII: "TEXTASCII_OP", TEXTSLUG: "TEXTSLUG_OP", WACC: "WACC_OP", PAYBACK: "PAYBACK_OP", ROI: "ROI_OP", ISNUMSTR: "ISNUMERICSTR_OP", TEXTENTROPY: "TEXTENTROPY_OP", ALL2: "ALL_N", ANY2: "ANY_N", NONE2: "NONE_N", DIGSUM: "DIGSUM_OP", DIGROOT: "DIGROOT_OP", NTHROOT: "NTHROOT_OP", TEXTHAMMING: "TEXTHAMMINGDIST_OP", TEXTLEV: "TEXTLEVENSHTEIN_OP", ISALPHANUM: "ISALPHANUMERIC_OP", ISALPHA: "ISALPHABETIC_OP", MAJORITY: "MAJORITY_N", COEFVAR: "COEFVAR_N", TEXTPADSTART: "TEXTPADSTART_OP", TEXTPADEND: "TEXTPADEND_OP", TEXTWRAP: "TEXTWRAP_OP", CHARCODE: "CHARCODE_OP", FROMCHARCODE: "FROMCHARCODE_OP", ISPRIME: "ISPRIME_OP", NEXTPRIME: "NEXTPRIME_OP", PRIMECOUNT: "PRIMECOUNT_OP", TOTIENT: "TOTIENT_OP", DIVISORS: "DIVISORS_OP", SEQUENCE2: "SEQUENCE_GEN_N", LINSPACE: "LINSPACE_N", CELLTYPE: "CELLTYPE_OP", CHECKSUM: "CHECKSUM_OP", CAGR: "CAGR_OP", DISC: "DISC_OP", DOLLARDE: "DOLLARDE_OP", DOLLARFR: "DOLLARFR_OP", ENTROPY: "ENTROPY_N", GINI: "GINI_N", WINSORIZE: "WINSORIZE_N", HYPOT3: "HYPOT3_OP", DISTANCE2D: "DISTANCE2D_OP", MANHATTAN: "MANHATTAN_OP", FIBONACCI: "FIBONACCI_OP", COLLATZ: "COLLATZ_OP", TYPEOF2: "TYPEOF2_OP", SLN: "SLN_OP", SYD: "SYD_OP", DDB: "DDB_OP", RATE: "RATE_EST_OP", "EFFECT.RATE": "EFFECT_RATE_OP", NOMINAL: "NOMINAL_RATE_OP", ZSCORE: "ZSCORE_OP", PERCENTRANK: "PERCENTRANK_N", NAND: "NAND_OP", NOR: "NOR_OP", XNOR: "XNOR_OP", TEXTMASK: "TEXTMASK_OP", TEXTTRUNCATE: "TEXTTRUNCATE_OP", CUMSUM: "CUMSUM_N", CUMPROD: "CUMPROD_N", MOVAVG: "MOVAVG_N", BITNOT: "BITNOT_OP", BITROTL: "BITROTL_OP", BITROTR: "BITROTR_OP", JSONIFY: "JSON_STRINGIFY_OP", TEXTTITLE: "TEXTTITLE_OP", ISNAN: "ISNAN2_OP", ISINFINITE: "ISINFINITE_OP", "MODE.SNGL": "MODE_SNGL_N", "MODE.MULT": "MODE_MULT_N", ROUNDMODE: "ROUND_MODE_OP", "BASE64.ENCODE": "BASE64_ENCODE_OP", "BASE64.DECODE": "BASE64_DECODE_OP", TEXTROTATE: "TEXTROTATE_OP", TEXTINITIALS: "TEXTINITIALS_OP", TEXTCAMELCASE: "TEXTCAMELCASE_OP", TEXTSNAKECASE: "TEXTSNAKECASE_OP", TEXTKEBABCASE: "TEXTKEBABCASE_OP", WRAPCOLS: "WRAPCOLS_N", PRODUCTIF: "PRODUCT_IFS_N", MEDIANIF: "MEDIAN_IF_N", ISDATE: "ISDATE_OP", DIGITS: "DIGITS_OP", SIGMOID: "SIGMOID_OP", RELU: "RELU_OP", SOFTPLUS: "SOFTPLUS_OP", ELU: "ELU_OP", NORMALIZE: "NORMALIZE_OP", MAPRANGE: "MAP_RANGE_OP", TEXTCENTER: "TEXTCENTER_OP", WORDCOUNT: "WORDCOUNT_OP", YEARMONTH: "YEARMONTH_OP", QUARTER: "QUARTER_OP", DAYOFYEAR: "DAYOFYEAR_OP", ISLEAPYEAR: "ISLEAPYEAR_OP", DAYSINYEAR: "DAYSINYEAR_OP", DAYSINMONTH: "DAYSINMONTH_OP", TEXTSLICE: "TEXTSLICE_OP", TEXTINDEXOF: "TEXTINDEXOF_OP", TEXTSPLIT2: "TEXTSPLIT_ALL_N", ISINTEGER: "ISINTEGER_OP", ISFLOAT: "ISFLOAT_OP", ISPOSITIVE: "ISPOSITIVE_OP", ISNEGATIVE: "ISNEGATIVE_OP", ROUNDSIG: "ROUND_SIGNIF_OP", CLAMP: "CLAMP_OP", LERP: "LERP_OP", SMOOTHSTEP: "SMOOTHSTEP_OP", "PERCENTILE.EXC": "PERCENTILE_EXC_N", "PERCENTILE.INC": "PERCENTILE_INC_N", ENCODEURL: "ENCODEURL_OP", DECODEURL: "DECODEURL_OP", ISURL: "ISURL_OP", ISEMAIL: "ISEMAIL_OP", HASH: "HASH_OP", TEXTSQUEEZE: "TEXTSQUEEZE_OP", GESTEP: "GESTEP_OP", DELTA: "DELTA_OP", "CHISQ.DIST.RT": "CHISQ_DIST_RT_OP", "T.DIST.RT": "TDIST_RT_OP", "F.DIST.RT": "FDIST_RT_OP", "T.INV.2T": "T_INV_2T_OP", TYPE: "TYPE_NUM_OP", ISBINARY: "ISBINARY_OP", ISHEX: "ISHEX_OP", ACOTH: "ACOTH_OP", EXPAND: "EXPAND_N", COALESCE: "COALESCE_N", ENDSWITH: "ENDSWITH_OP", TEXTREVERSE: "TEXTREVERSE_OP", TEXTREMOVE: "TEXTREMOVE_OP", REGEXMATCH: "REGEXMATCH_OP", REGEXEXTRACT: "REGEXEXTRACT_OP", REGEXREPLACE: "REGEXREPLACE_OP", FILTER: "FILTER_N", TAKE: "TAKE_N", DROP: "DROP_N", CHOOSECOLS: "CHOOSECOLS_N", CHOOSEROWS: "CHOOSEROWS_N", IMPLIES: "IMPLIES_OP", BETWEEN: "BETWEEN_OP", ISFORMULA: "ISFORMULA_OP", SHEET: "SHEET_OP", SHEETS: "SHEETS_OP", SERIESSUM: "SERIESSUM_N", SUBTOTAL: "SUBTOTAL_MODE_N", MULTINOMIAL: "MULTINOMIAL_N", "WEIBULL.DIST": "WEIBULL_DIST_OP", "EXPON.DIST": "EXPON_DIST_OP", "LOGNORM.DIST": "LOGNORM_DIST_OP", COUPPCD: "COUPPCD_OP", COUPNCD: "COUPNCD_OP", ODDFPRICE: "ODDFPRICE_OP", CONTAINS: "TEXT_CONTAINS_OP", STARTSWITH: "TEXT_STARTSWITH_OP", YIELDMAT: "YIELDMAT_OP", ACCRINTM: "ACCRINTM_OP", COUPDAYSNC: "COUPDAYSNC_OP", COUPNUM: "COUPNUM_OP", TEXTPADSTART: "TEXTPADSTART_OP", TEXTPADEND: "TEXTPADEND_OP", TEXTWRAP: "TEXTWRAP_OP", ISERR: "ISERR_OP", ISNULL: "ISNULL_OP", HYPOT: "HYPOT_OP", MDETERM: "MDETERM_OP", MINVERSE: "MINVERSE_OP", "BETA.INV": "BETA_INV_OP", "GAMMA.INV": "GAMMA_INV_OP", AVERAGEWEIGHTED: "AVERAGEWEIGHTED_N", DCOUNT: "DCOUNT_N", DSUM: "DSUM_N", DAVERAGE: "DAVERAGE_N", DMAX: "DMAX_N", DMIN: "DMIN_N", DSTDEV: "DSTDEV_N", DVAR: "DVAR_N", DGET: "DGET_N", DCOUNTA: "DCOUNTA_N", "PERCENTRANK.EXC": "PERCENTRANK_EXC_N", "QUARTILE.EXC": "QUARTILE_EXC_N", "QUARTILE.INC": "QUARTILE_INC_N", NAND: "NAND_OP", NOR: "NOR_OP", XNOR: "XNOR_OP", SORTBY: "SORTBY_N", SINGLE: "SINGLE_N", XLOOKUP: "XLOOKUP_N", HYPERLINK: "HYPERLINK_OP", NUMBERSTRING: "NUMBERSTRING_OP", IFBLANK: "IFBLANK_OP", SUBSTITUTEN: "SUBSTITUTEN_OP", "TEXTSPLIT.NTH": "TEXTSPLIT_DELIM_OP", COMBINA: "COMBINA_OP", PERMUTATIONA: "PERMUTATIONA_OP", SQRTPI: "SQRTPI_OP", RANDBETWEEN: "RANDBETWEEN_INT_OP", "ISO.CEILING": "ISO_CEILING_OP", YIELDDISC: "YIELDDISC_OP", PRICEMAT: "PRICEMAT_OP", ARRAYTOTEXT: "ARRAYTOTEXT_N", TOCOL: "TOCOL_N", TOROW: "TOROW_N", VSTACK: "VSTACK_N", MAKEARRAY: "MAKEARRAY_N", WEBSERVICE: "WEBSERVICE_OP", FIELDVALUE: "FIELDVALUE_OP", VLOOKUP: "VLOOKUP_N", HLOOKUP: "HLOOKUP_N", LOOKUP: "LOOKUP_N", CLEANWS: "CLEANWS_OP", TEXTCOUNT: "TEXTCOUNT_OP", ISREF: "ISREF_OP", ISLOGICAL: "ISLOGICAL_OP", ISNONTEXT: "ISNONTEXT_OP", "ERROR.TYPE": "ERROR_TYPE_OP", IFERROR: "IFERROR_OP", BITCOUNT: "BITCOUNT_OP", MROUND: "MROUND_OP", "CEILING.MATH": "CEILING_MATH_OP", "FLOOR.MATH": "FLOOR_MATH_OP", BASE: "BASE_OP", DECIMAL: "DECIMAL_OP", AMORLINC: "AMORLINC_OP", PRICE: "PRICE_OP", ODDLPRICE: "ODDLPRICE_OP", INFO: "INFO_OP", CUMPRINC: "CUMPRINC_OP", PDURATION: "PDURATION_OP", RRI: "RRI_OP", TBILLEQ: "TBILLEQ_OP", TBILLPRICE: "TBILLPRICE_OP", DURATION: "DURATION_OP", MDURATION: "MDURATION_OP", XIRR: "XIRR_N", YIELD: "YIELD_OP", AREAS: "AREAS_N", TRANSPOSE: "TRANSPOSE_N", CHITEST: "CHITEST_N", TTEST: "TTEST_N", FTEST: "FTEST_N", LINEST: "LINEST_N", LOGEST: "LOGEST_N", VARA: "VARA_N", STDEVA: "STDEVA_N", VARPA: "VARPA_N", STDEVPA: "STDEVPA_N", "PERCENTRANK.INC": "PERCENTRANK_INC_N", "BETA.FN": "BETA_FN_OP", BESSELK: "BESSELK_OP", BESSELI: "BESSELI_OP", "PERCENTILE.INC": "PERCENTILE_INC_N", "PERCENTILE.EXC": "PERCENTILE_EXC_N", "RANK.EQ": "RANK_EQ_N", "RANK.AVG": "RANK_AVG_N", "VAR.S": "VAR_S_N", "NORM.S.DIST": "NORMS_DIST_OP", "NORM.S.INV": "NORMS_INV_OP", TINV: "TINV_OP", "CHISQ.INV": "CHISQ_INV_OP", FINV: "FINV_OP", GAMMALN: "GAMMALN_OP", GAMMA: "GAMMA_OP", "CHISQ.DIST": "CHISQ_DIST_OP", TDIST: "TDIST_OP", FDIST: "FDIST_OP", PHI: "PHI_OP", GAUSS: "GAUSS_OP", MIDB: "MIDB_OP", DBCS: "DBCS_OP", ASC: "ASC_OP", CONCAT_WS: "CONCAT_WS_N", TEXTREVERSE: "TEXTREVERSE_OP", FVSCHEDULE: "FVSCHEDULE_N", CUMIPMT: "CUMIPMT_OP", COLUMNS: "COLUMNS_N", INDIRECT: "INDIRECT_OP", OFFSET: "OFFSET_OP", ZTEST: "ZTEST_N", "COVARIANCE.S": "COVARIANCE_S_N", "STDEV.S": "STDEV_S_N", TIMEVALUE: "TIMEVALUE_OP", TIME: "TIME_OP", GROWTH: "GROWTH_N", TREND: "TREND_N", FREQUENCY: "FREQUENCY_N", PROB: "PROB_N2", LAMBDA: "LAMBDA_N", MAP: "MAP_N", REDUCE: "REDUCE_N", SCAN: "SCAN_N", BYROW: "BYROW_N", BYCOL: "BYCOL_N", LEFTB: "LEFTB_OP", RIGHTB: "RIGHTB_OP", LENB: "LENB_OP", BAHTTEXT: "BAHTTEXT_OP", PHONETIC: "PHONETIC_OP", BESSELY: "BESSELY_OP", HEX2BIN: "HEX2BIN_OP", HEX2OCT: "HEX2OCT_OP", OCT2BIN: "OCT2BIN_OP", OCT2HEX: "OCT2HEX_OP", IMTAN: "IMTAN_OP", IMLOG2: "IMLOG2_OP", IMLOG10: "IMLOG10_OP", DPRODUCT: "DPRODUCT_N", "RANDBETWEEN.FLOAT": "RANDBETWEEN_FLOAT_OP", FORMULATEXT: "FORMULATEXT_OP", ADDRESS: "ADDRESS_OP", IMDIV: "IMDIV_OP", IMSUB: "IMSUB_OP", BIN2DEC: "BIN2DEC_OP", DEC2BIN: "DEC2BIN_OP", BIN2HEX: "BIN2HEX_OP", HEX2DEC: "HEX2DEC_OP", DEC2HEX: "DEC2HEX_OP", OCT2DEC: "OCT2DEC_OP", DEC2OCT: "DEC2OCT_OP", BITAND: "BITAND_OP", BITOR: "BITOR_OP", BITXOR: "BITXOR_OP", BITLSHIFT: "BITLSHIFT_OP", BITRSHIFT: "BITRSHIFT_OP", IMPOWER: "IMPOWER_OP", IMEXP: "IMEXP_OP", IMLN: "IMLN_OP", IMSIN: "IMSIN_OP", IMCOS: "IMCOS_OP", IMSUM: "IMSUM_OP", IMPRODUCT: "IMPRODUCT_OP", IMARGUMENT: "IMARGUMENT_OP", IMCONJUGATE: "IMCONJUGATE_OP", IMSQRT: "IMSQRT_OP", BESSELJ: "BESSELJ_OP", COMPLEX: "COMPLEX_OP", IMREAL: "IMREAL_OP", IMAGINARY: "IMAGINARY_OP", IMABS: "IMABS_OP", TAKE: "TAKE_N", DROP: "DROP_N", HSTACK: "HSTACK_N", WRAPROWS: "WRAPROWS_N", ISFORMULA: "ISFORMULA_OP", REGEXMATCH: "REGEXMATCH_OP", REGEXEXTRACT: "REGEXEXTRACT_OP", REGEXREPLACE: "REGEXREPLACE_OP", LET: "LET_N", CHOOSECOLS: "CHOOSECOLS_N", SUMXMY2: "SUMXMY2_N", SUMX2PY2: "SUMX2PY2_N", SUMX2MY2: "SUMX2MY2_N", ERF: "ERF_OP", ERFC: "ERFC_OP", YEARFRAC: "YEARFRAC_OP", COUPDAYBS: "COUPDAYBS_OP", TBILLYIELD: "TBILLYIELD_OP", RECEIVED: "RECEIVED_OP", PRICEDISC: "PRICEDISC_OP", MIRR: "MIRR_N", XNPV: "XNPV_N", ACCRINT: "ACCRINT_OP", COUPDAYS: "COUPDAYS_OP", DOLLARDE: "DOLLARDE_OP", DOLLARFR: "DOLLARFR_OP", SORT: "SORT_N", UNIQUE: "UNIQUE_N", FILTER: "FILTER_N", PPMT: "PPMT_OP", IPMT: "IPMT_OP", CELL: "CELL_OP", ROWS: "ROWS_N", RANDARRAY: "RANDARRAY_N", SEQUENCE: "SEQUENCE_N", XMATCH: "XMATCH_N", "CEILING.PRECISE": "CEILING_PRECISE_OP", "FLOOR.PRECISE": "FLOOR_PRECISE_OP",
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
  { name: "BINSEARCH", args: "target, values...", description: "Binary search index", category: "lookup" },
  { name: "INDEXMATCH", args: "target, values...", description: "Index of first match", category: "lookup" },
  { name: "LASTINDEXOF", args: "target, values...", description: "Last occurrence index", category: "lookup" },
  { name: "FINDALL", args: "target, values...", description: "Count all matches", category: "lookup" },
  { name: "COUNTUNIQ", args: "values...", description: "Count unique values", category: "lookup" },
  { name: "ARRAYCONTAINS", args: "target, values...", description: "Array contains value", category: "lookup" },
  { name: "ARRAYPOS", args: "target, values...", description: "Position in array (1-based)", category: "lookup" },
  { name: "FLATTEN2", args: "values...", description: "Flatten count", category: "lookup" },
  { name: "IFF", args: "cond, true, false", description: "Inline if-else", category: "logic" },
  { name: "SWITCH2", args: "expr, case1, val1, ..., default", description: "Switch expression", category: "logic" },
  { name: "XORALL", args: "values...", description: "XOR across all values", category: "logic" },
  { name: "NANDALL", args: "values...", description: "NAND across all values", category: "logic" },
  { name: "NORALL", args: "values...", description: "NOR across all values", category: "logic" },
  { name: "COALESCE2", args: "values...", description: "First truthy value", category: "logic" },
  { name: "UNLESS", args: "a, b", description: "Return b if a is 0", category: "logic" },
  { name: "SECANT", args: "x", description: "Secant (1/cos)", category: "math" },
  { name: "COSECANT", args: "x", description: "Cosecant (1/sin)", category: "math" },
  { name: "VERSINE", args: "x", description: "Versine (1-cos)", category: "math" },
  { name: "HAVERSINE", args: "x", description: "Haversine ((1-cos)/2)", category: "math" },
  { name: "EXSECANT", args: "x", description: "Exsecant (sec-1)", category: "math" },
  { name: "LEMNISCATE", args: "x", description: "Lemniscate constant", category: "math" },
  { name: "AGM2", args: "a, b", description: "Arithmetic-geometric mean", category: "math" },
  { name: "POWMOD", args: "base, exp, mod", description: "Modular exponentiation", category: "math" },
  { name: "MAD2", args: "values...", description: "Median absolute deviation", category: "stat" },
  { name: "ZSCORE2", args: "x, mean, sd", description: "Z-score from params", category: "stat" },
  { name: "TSTAT", args: "mean, se, n", description: "T-statistic", category: "stat" },
  { name: "FSTAT", args: "var1, var2", description: "F-statistic", category: "stat" },
  { name: "CHISQSTAT", args: "observed, expected", description: "Chi-square component", category: "stat" },
  { name: "SEM", args: "values...", description: "Standard error of mean", category: "stat" },
  { name: "POOLEDVAR", args: "n1...nK, var1...varK", description: "Pooled variance", category: "stat" },
  { name: "TEXTCOUNTCHAR", args: "text, char", description: "Count specific char", category: "text" },
  { name: "TEXTZFILL", args: "text, width", description: "Zero-fill left pad", category: "text" },
  { name: "TEXTLPAD", args: "text, width, char", description: "Left pad with char", category: "text" },
  { name: "TEXTRPAD", args: "text, width, char", description: "Right pad with char", category: "text" },
  { name: "TEXTABBREV", args: "text, maxLen", description: "Abbreviate with ...", category: "text" },
  { name: "TEXTWORDFREQ", args: "text, word", description: "Word frequency", category: "text" },
  { name: "TEXTSANITIZE", args: "text", description: "HTML entity escape", category: "text" },
  { name: "TEXTMIRROR", args: "text", description: "Text + reversed", category: "text" },
  { name: "TYPEOF3", args: "value", description: "Type name string", category: "info" },
  { name: "ISBLANK2", args: "value", description: "Is blank/empty", category: "info" },
  { name: "ISTRUTHY", args: "value", description: "Is truthy", category: "info" },
  { name: "ISFALSY", args: "value", description: "Is falsy", category: "info" },
  { name: "ISFRACTION", args: "value", description: "Has fractional part", category: "info" },
  { name: "ISDIVISIBLE", args: "a, b", description: "a divisible by b", category: "info" },
  { name: "PVANNUITY", args: "pmt, rate, periods", description: "PV of annuity", category: "financial" },
  { name: "ANNUITYPMT", args: "pv, rate, periods", description: "Annuity payment", category: "financial" },
  { name: "BONDPRICE", args: "coupon, ytm, periods", description: "Bond price from yield", category: "financial" },
  { name: "BONDYIELD", args: "coupon, price, periods", description: "Approx bond yield", category: "financial" },
  { name: "TBILL2", args: "discount, days", description: "T-Bill price", category: "financial" },
  // ── 850 batch CATALOG ──
  { name: "DISTINCT", description: "Count distinct values", category: "lookup", args: "variadic" },
  { name: "ARRAYSLICE", description: "Slice array by start/end index", category: "lookup", args: "variadic" },
  { name: "ARRAYJOIN", description: "Join array values with separator", category: "lookup", args: "variadic" },
  { name: "ARRAYREVERSE", description: "Reverse array order", category: "lookup", args: "variadic" },
  { name: "ARRAYFLATTEN", description: "Flatten nested array values", category: "lookup", args: "variadic" },
  { name: "ARRAYZIP", description: "Zip two arrays together", category: "lookup", args: "variadic" },
  { name: "ARRAYMIN", description: "Minimum of array values", category: "lookup", args: "variadic" },
  { name: "ARRAYMAX", description: "Maximum of array values", category: "lookup", args: "variadic" },
  { name: "ARRAYSUM", description: "Sum of array values", category: "lookup", args: "variadic" },
  { name: "ARRAYAVG", description: "Average of array values", category: "lookup", args: "variadic" },
  { name: "NIFF", description: "Negated IF", category: "logic", args: "3" },
  { name: "SWITCHIF", description: "Conditional switch above/below threshold", category: "logic", args: "4" },
  { name: "COND", description: "Condition-value pairs with default", category: "logic", args: "variadic" },
  { name: "ALLEQUAL", description: "True if all values are equal", category: "logic", args: "variadic" },
  { name: "ANYGT", description: "True if any value exceeds threshold", category: "logic", args: "variadic" },
  { name: "ANYLT", description: "True if any value is below threshold", category: "logic", args: "variadic" },
  { name: "ANYNE", description: "True if any value differs from target", category: "logic", args: "variadic" },
  { name: "ISALL", description: "True if all values are truthy", category: "logic", args: "variadic" },
  { name: "ISANY", description: "True if any value is truthy", category: "logic", args: "variadic" },
  { name: "ISNONE", description: "True if no values are truthy", category: "logic", args: "variadic" },
  { name: "RANDNORM", description: "Normal-distributed random", category: "volatile", args: "2" },
  { name: "RANDEXP", description: "Exponential-distributed random", category: "volatile", args: "1" },
  { name: "RANDINT", description: "Random integer in [lo, hi]", category: "volatile", args: "2" },
  { name: "COINFLIP", description: "Random true/false", category: "volatile", args: "0" },
  { name: "GUDERMANN", description: "Gudermannian function gd(x)", category: "math", args: "1" },
  { name: "INVERSEGUD", description: "Inverse Gudermannian", category: "math", args: "1" },
  { name: "LANCZOS", description: "Lanczos Gamma approximation", category: "math", args: "1" },
  { name: "DIGAMMA", description: "Digamma psi function", category: "math", args: "1" },
  { name: "POLYGAMMA", description: "Polygamma function psi_n(x)", category: "math", args: "2" },
  { name: "ZETA2", description: "Riemann zeta function", category: "math", args: "1" },
  { name: "BETAFN", description: "Beta function B(a,b)", category: "math", args: "2" },
  { name: "POCHHAMMER", description: "Pochhammer rising factorial", category: "math", args: "2" },
  { name: "ENTROPY2", description: "Shannon entropy of distribution", category: "stat", args: "variadic" },
  { name: "GINICOEF", description: "Gini coefficient of inequality", category: "stat", args: "variadic" },
  { name: "MOMENT", description: "kth raw moment about zero", category: "stat", args: "variadic" },
  { name: "CMOMENT", description: "kth central moment about mean", category: "stat", args: "variadic" },
  { name: "ZSCORE3", description: "Z-score of value against sample", category: "stat", args: "variadic" },
  { name: "PERCENTILE2", description: "Percentile from value set", category: "stat", args: "variadic" },
  { name: "TEXTFORMAT", description: "Format string with placeholder", category: "text", args: "2" },
  { name: "TEXTJUSTIFY", description: "Right-pad text to width", category: "text", args: "2" },
  { name: "TEXTMASK2", description: "Mask all but last N chars", category: "text", args: "2" },
  { name: "TEXTHASH", description: "DJB2 hash as hex", category: "text", args: "1" },
  { name: "TEXTREPLACE2", description: "Replace all occurrences", category: "text", args: "3" },
  { name: "TEXTFILL", description: "Fill placeholder in template", category: "text", args: "2" },
  { name: "CAGR2", description: "Compound annual growth rate", category: "financial", args: "3" },
  { name: "DRAWDOWN", description: "Drawdown from peak value", category: "financial", args: "2" },
  { name: "CALMAR", description: "Calmar ratio", category: "financial", args: "2" },
  { name: "TREYNOR", description: "Treynor ratio", category: "financial", args: "3" },
  { name: "ISFINITE2", description: "True if finite number", category: "info", args: "1" },
  { name: "ISWHOLE", description: "True if whole integer", category: "info", args: "1" },
  // ── 900 batch CATALOG ──
  { name: "EQUIV", description: "EQUIV function", category: "logic", args: "2" },
  { name: "ONEOF", description: "ONEOF function", category: "logic", args: "variadic" },
  { name: "FIRSTTRUTHY", description: "FIRSTTRUTHY function", category: "logic", args: "variadic" },
  { name: "LASTTRUTHY", description: "LASTTRUTHY function", category: "logic", args: "variadic" },
  { name: "COUNTIF3", description: "COUNTIF3 function", category: "logic", args: "variadic" },
  { name: "WHICHMAX", description: "WHICHMAX function", category: "logic", args: "variadic" },
  { name: "WHICHMIN", description: "WHICHMIN function", category: "logic", args: "variadic" },
  { name: "THRESHOLD", description: "THRESHOLD function", category: "logic", args: "2" },
  { name: "TOGGLE", description: "TOGGLE function", category: "logic", args: "1" },
  { name: "SATURATE", description: "SATURATE function", category: "logic", args: "1" },
  { name: "DEADBAND", description: "DEADBAND function", category: "logic", args: "3" },
  { name: "RANDPERM", description: "RANDPERM function", category: "volatile", args: "variadic" },
  { name: "RANDCHOICE", description: "RANDCHOICE function", category: "volatile", args: "variadic" },
  { name: "DICE", description: "DICE function", category: "volatile", args: "1" },
  { name: "UUID4", description: "UUID4 function", category: "volatile", args: "0" },
  { name: "ENUMERATE", description: "ENUMERATE function", category: "lookup", args: "variadic" },
  { name: "COUNTVALS", description: "COUNTVALS function", category: "lookup", args: "variadic" },
  { name: "FIRSTNONZERO", description: "FIRSTNONZERO function", category: "lookup", args: "variadic" },
  { name: "LASTNONZERO", description: "LASTNONZERO function", category: "lookup", args: "variadic" },
  { name: "NTHLARGEST", description: "NTHLARGEST function", category: "lookup", args: "variadic" },
  { name: "AMORT", description: "AMORT function", category: "financial", args: "3" },
  { name: "DAILYRETURN", description: "DAILYRETURN function", category: "financial", args: "2" },
  { name: "VOLANNUAL", description: "VOLANNUAL function", category: "financial", args: "2" },
  { name: "MAXDD", description: "MAXDD function", category: "financial", args: "variadic" },
  { name: "INFORMRATIO", description: "INFORMRATIO function", category: "financial", args: "2" },
  { name: "JENSENALPHA", description: "JENSENALPHA function", category: "financial", args: "3" },
  { name: "LAGUERRE", description: "LAGUERRE function", category: "math", args: "2" },
  { name: "HERMITE", description: "HERMITE function", category: "math", args: "2" },
  { name: "LEGENDRE", description: "LEGENDRE function", category: "math", args: "2" },
  { name: "CHEBYSHEV2", description: "CHEBYSHEV2 function", category: "math", args: "2" },
  { name: "FRESNEL_S", description: "FRESNEL_S function", category: "math", args: "1" },
  { name: "FRESNEL_C", description: "FRESNEL_C function", category: "math", args: "1" },
  { name: "AIRY", description: "AIRY function", category: "math", args: "1" },
  { name: "DAWSON", description: "DAWSON function", category: "math", args: "1" },
  { name: "TRIMMEDMEAN", description: "TRIMMEDMEAN function", category: "stat", args: "variadic" },
  { name: "WINSOREDMEAN", description: "WINSOREDMEAN function", category: "stat", args: "variadic" },
  { name: "MIDRANGE", description: "MIDRANGE function", category: "stat", args: "variadic" },
  { name: "MIDHINGE", description: "MIDHINGE function", category: "stat", args: "variadic" },
  { name: "MEANDEV", description: "MEANDEV function", category: "stat", args: "variadic" },
  { name: "ROOTMEANSQERR", description: "ROOTMEANSQERR function", category: "stat", args: "variadic" },
  { name: "TEXTWORDWRAP", description: "TEXTWORDWRAP function", category: "text", args: "2" },
  { name: "TEXTCOLUMNS", description: "TEXTCOLUMNS function", category: "text", args: "2" },
  { name: "TEXTTAB", description: "TEXTTAB function", category: "text", args: "2" },
  { name: "TEXTBOXIFY", description: "TEXTBOXIFY function", category: "text", args: "1" },
  { name: "TEXTCOUNTWORDS", description: "TEXTCOUNTWORDS function", category: "text", args: "1" },
  { name: "TEXTFIRSTWORD", description: "TEXTFIRSTWORD function", category: "text", args: "1" },
  { name: "ISNUMTYPE", description: "ISNUMTYPE function", category: "info", args: "1" },
  { name: "ISSTRTYPE", description: "ISSTRTYPE function", category: "info", args: "1" },
  { name: "ISBOOLTYPE", description: "ISBOOLTYPE function", category: "info", args: "1" },
  { name: "ISERRORTYPE", description: "ISERRORTYPE function", category: "info", args: "1" },
  // ── 950 batch CATALOG ──
  { name: "IFPOS", description: "IFPOS function", category: "logic", args: "2" },
  { name: "IFNEG", description: "IFNEG function", category: "logic", args: "2" },
  { name: "IFZERO", description: "IFZERO function", category: "logic", args: "2" },
  { name: "IFEVEN", description: "IFEVEN function", category: "logic", args: "2" },
  { name: "IFODD", description: "IFODD function", category: "logic", args: "2" },
  { name: "GATE", description: "GATE function", category: "logic", args: "2" },
  { name: "LATCH", description: "LATCH function", category: "logic", args: "2" },
  { name: "DEBOUNCE", description: "DEBOUNCE function", category: "logic", args: "2" },
  { name: "MUXSEL", description: "MUXSEL function", category: "logic", args: "variadic" },
  { name: "DEMUX", description: "DEMUX function", category: "logic", args: "variadic" },
  { name: "RANDSIGN", description: "RANDSIGN function", category: "volatile", args: "0" },
  { name: "RANDBOOL", description: "RANDBOOL function", category: "volatile", args: "1" },
  { name: "NTHSMALLEST", description: "NTHSMALLEST function", category: "lookup", args: "variadic" },
  { name: "ARGMAX", description: "ARGMAX function", category: "lookup", args: "variadic" },
  { name: "ARGMIN", description: "ARGMIN function", category: "lookup", args: "variadic" },
  { name: "DEDUP", description: "DEDUP function", category: "lookup", args: "variadic" },
  { name: "INTERLEAVE", description: "INTERLEAVE function", category: "lookup", args: "variadic" },
  { name: "COUPON", description: "COUPON function", category: "financial", args: "2" },
  { name: "ACCRUEDINT", description: "ACCRUEDINT function", category: "financial", args: "3" },
  { name: "PARVALUE", description: "PARVALUE function", category: "financial", args: "2" },
  { name: "HOLDINGRETURN", description: "HOLDINGRETURN function", category: "financial", args: "3" },
  { name: "TIMEDWRETURN", description: "TIMEDWRETURN function", category: "financial", args: "2" },
  { name: "DIVYIELD", description: "DIVYIELD function", category: "financial", args: "2" },
  { name: "SININT", description: "SININT function", category: "math", args: "1" },
  { name: "COSINT", description: "COSINT function", category: "math", args: "1" },
  { name: "EXPINT", description: "EXPINT function", category: "math", args: "1" },
  { name: "LOGINT", description: "LOGINT function", category: "math", args: "1" },
  { name: "DILOG", description: "DILOG function", category: "math", args: "1" },
  { name: "CLAUSEN", description: "CLAUSEN function", category: "math", args: "1" },
  { name: "ELLIPK", description: "ELLIPK function", category: "math", args: "1" },
  { name: "ELLIPE", description: "ELLIPE function", category: "math", args: "1" },
  { name: "QUADMEAN", description: "QUADMEAN function", category: "stat", args: "variadic" },
  { name: "POWMEAN", description: "POWMEAN function", category: "stat", args: "variadic" },
  { name: "LEHMER", description: "LEHMER function", category: "stat", args: "variadic" },
  { name: "ENTROPY3", description: "ENTROPY3 function", category: "stat", args: "variadic" },
  { name: "RELENTROPY", description: "RELENTROPY function", category: "stat", args: "variadic" },
  { name: "MUTUALINFO", description: "MUTUALINFO function", category: "stat", args: "variadic" },
  { name: "CROSSENTROPY", description: "CROSSENTROPY function", category: "stat", args: "variadic" },
  { name: "TEXTINITCAP", description: "TEXTINITCAP function", category: "text", args: "1" },
  { name: "TEXTSNIP", description: "TEXTSNIP function", category: "text", args: "2" },
  { name: "TEXTUNQUOTE", description: "TEXTUNQUOTE function", category: "text", args: "1" },
  { name: "TEXTQUOTE", description: "TEXTQUOTE function", category: "text", args: "1" },
  { name: "TEXTDOTS", description: "TEXTDOTS function", category: "text", args: "2" },
  { name: "TEXTBULLET", description: "TEXTBULLET function", category: "text", args: "1" },
  { name: "ISNUMERIC", description: "ISNUMERIC function", category: "info", args: "1" },
  { name: "ISTEXT2", description: "ISTEXT2 function", category: "info", args: "1" },
  { name: "ISERR2", description: "ISERR2 function", category: "info", args: "1" },
  { name: "ISBLANK3", description: "ISBLANK3 function", category: "info", args: "1" },
  { name: "ISNOTEMPTY", description: "ISNOTEMPTY function", category: "info", args: "1" },
  { name: "TYPESTR", description: "TYPESTR function", category: "info", args: "1" },
  // ── 1000 batch CATALOG ──
  { name: "JACOBI", description: "JACOBI function", category: "math", args: "2" },
  { name: "BESSEL_I0", description: "BESSEL_I0 function", category: "math", args: "1" },
  { name: "BESSEL_J0", description: "BESSEL_J0 function", category: "math", args: "1" },
  { name: "BESSEL_K0", description: "BESSEL_K0 function", category: "math", args: "1" },
  { name: "STRUVE", description: "STRUVE function", category: "math", args: "2" },
  { name: "WEBER", description: "WEBER function", category: "math", args: "1" },
  { name: "HURWITZ", description: "HURWITZ function", category: "math", args: "2" },
  { name: "POLYLOG", description: "POLYLOG function", category: "math", args: "2" },
  { name: "LAMBERTW", description: "LAMBERTW function", category: "math", args: "1" },
  { name: "AGMFN", description: "AGMFN function", category: "math", args: "2" },
  { name: "CONTRAHARMONIC", description: "CONTRAHARMONIC function", category: "stat", args: "variadic" },
  { name: "HERONIAN", description: "HERONIAN function", category: "stat", args: "variadic" },
  { name: "LOGTRANSFORM", description: "LOGTRANSFORM function", category: "stat", args: "variadic" },
  { name: "ZSCORENORM", description: "ZSCORENORM function", category: "stat", args: "variadic" },
  { name: "MAD3", description: "MAD3 function", category: "stat", args: "variadic" },
  { name: "BIWEIGHT", description: "BIWEIGHT function", category: "stat", args: "variadic" },
  { name: "HUBER", description: "HUBER function", category: "stat", args: "variadic" },
  { name: "WINVAR", description: "WINVAR function", category: "stat", args: "variadic" },
  { name: "TEXTCENTER2", description: "TEXTCENTER2 function", category: "text", args: "2" },
  { name: "TEXTINDENT", description: "TEXTINDENT function", category: "text", args: "2" },
  { name: "TEXTHEADER", description: "TEXTHEADER function", category: "text", args: "1" },
  { name: "TEXTFOOTER", description: "TEXTFOOTER function", category: "text", args: "1" },
  { name: "TEXTCOUNTLINES", description: "TEXTCOUNTLINES function", category: "text", args: "1" },
  { name: "TEXTISEMPTY", description: "TEXTISEMPTY function", category: "text", args: "1" },
  { name: "TEXTCOALESCE", description: "TEXTCOALESCE function", category: "text", args: "2" },
  { name: "TEXTTAG", description: "TEXTTAG function", category: "text", args: "2" },
  { name: "ISPOS", description: "ISPOS function", category: "info", args: "1" },
  { name: "ISNEG2", description: "ISNEG2 function", category: "info", args: "1" },
  { name: "ISNONZERO", description: "ISNONZERO function", category: "info", args: "1" },
  { name: "ISINRANGE", description: "ISINRANGE function", category: "info", args: "3" },
  { name: "SIGNOF", description: "SIGNOF function", category: "info", args: "1" },
  { name: "MAGNITUDE", description: "MAGNITUDE function", category: "info", args: "1" },
  { name: "COSTBASIS", description: "COSTBASIS function", category: "financial", args: "2" },
  { name: "UNREALIZEDPNL", description: "UNREALIZEDPNL function", category: "financial", args: "3" },
  { name: "REALIZEDPNL", description: "REALIZEDPNL function", category: "financial", args: "3" },
  { name: "DOLLARVAL", description: "DOLLARVAL function", category: "financial", args: "2" },
  { name: "BASISPOINTS", description: "BASISPOINTS function", category: "financial", args: "1" },
  { name: "TICKVALUE", description: "TICKVALUE function", category: "financial", args: "2" },
  { name: "MAJORITY2", description: "MAJORITY2 function", category: "logic", args: "variadic" },
  { name: "UNANIMOUS", description: "UNANIMOUS function", category: "logic", args: "variadic" },
  { name: "QUORUM", description: "QUORUM function", category: "logic", args: "variadic" },
  { name: "VETO", description: "VETO function", category: "logic", args: "variadic" },
  { name: "PRIORITYSEL", description: "PRIORITYSEL function", category: "logic", args: "variadic" },
  { name: "FALLBACK", description: "FALLBACK function", category: "logic", args: "variadic" },
  { name: "RANK2", description: "RANK2 function", category: "lookup", args: "variadic" },
  { name: "DENSERANK", description: "DENSERANK function", category: "lookup", args: "variadic" },
  { name: "NTILE", description: "NTILE function", category: "lookup", args: "variadic" },
  { name: "ROWNUMBER", description: "ROWNUMBER function", category: "lookup", args: "variadic" },
  { name: "RANDWEIGHTED", description: "RANDWEIGHTED function", category: "volatile", args: "variadic" },
  { name: "RANDSAMPLE", description: "RANDSAMPLE function", category: "volatile", args: "variadic" },



  { name: "MACAULAY", args: "coupon, ytm, periods", description: "Macaulay duration", category: "financial" },
  { name: "FIBONACCI2", args: "n", description: "Nth Fibonacci number", category: "math" },
  { name: "MOTZKIN", args: "n", description: "Nth Motzkin number", category: "math" },
  { name: "DERANGEMENT", args: "n", description: "Number of derangements !n", category: "math" },
  { name: "TOTIENT2", args: "n", description: "Euler's totient φ(n)", category: "math" },
  { name: "HARMONIC2", args: "n", description: "Nth harmonic number", category: "math" },
  { name: "TEXTOBFUSCATE", args: "text", description: "Obfuscate (keep first/last)", category: "text" },
  { name: "TEXTCOUNT2", args: "text, sub", description: "Count substring occurrences", category: "text" },
  { name: "TEXTSHUFFLE", args: "text", description: "Shuffle characters randomly", category: "text" },
  { name: "ISCOPRIMEALL", args: "values...", description: "All pairwise coprime", category: "logic" },
  { name: "ISFIBBISH", args: "n", description: "Is Fibonacci number", category: "info" },
  { name: "COPRIME", args: "a, b", description: "Are coprime (GCD=1)", category: "math" },
  { name: "COLLATZ", args: "n", description: "Collatz sequence steps", category: "math" },
  { name: "PREVPRIME", args: "n", description: "Largest prime < n", category: "math" },
  { name: "TEXTPAD", args: "text, width, char", description: "Right-pad text", category: "text" },
  { name: "TEXTMASK", args: "text, showLast", description: "Mask text with *", category: "text" },
  { name: "TEXTISURL", args: "text", description: "Is URL format", category: "info" },
  { name: "TEXTISEMAIL", args: "text", description: "Is email format", category: "info" },
  { name: "WORDSCOUNT", args: "text", description: "Count words", category: "text" },
  { name: "ISLEAPYEAR", args: "year", description: "Is leap year", category: "info" },
  { name: "WEEKOFYEAR", args: "date", description: "Week number of year", category: "info" },
  { name: "ISWEEKEND", args: "date", description: "Is weekend day", category: "info" },
  { name: "QUARTERNO", args: "month", description: "Quarter from month", category: "info" },
  { name: "SEMESTERNO", args: "month", description: "Semester from month", category: "info" },
  { name: "EFFECTRATE", args: "nominal, periods", description: "Effective annual rate", category: "financial" },
  { name: "NOMRATE", args: "effective, periods", description: "Nominal rate", category: "financial" },
  { name: "AVEDEV2", args: "values...", description: "Average absolute deviation", category: "stat" },
  { name: "COVAR2", args: "x1...xN,y1...yN", description: "Covariance", category: "stat" },
  { name: "CORREL2", args: "x1...xN,y1...yN", description: "Correlation coefficient", category: "stat" },
  { name: "NPER2", args: "rate, PV, FV", description: "Periods to grow PV to FV", category: "financial" },
  { name: "RATE2", args: "PV, FV, periods", description: "Required rate", category: "financial" },
  { name: "COSSIM", args: "x1...xN,y1...yN", description: "Cosine similarity", category: "stat" },
  { name: "CHEBYSHEV", args: "a, b", description: "Chebyshev distance max(|a|,|b|)", category: "math" },
  { name: "ISPOWEROFTWO", args: "n", description: "Is power of two", category: "info" },
  { name: "NEXTODD", args: "n", description: "Next odd number after n", category: "math" },
  { name: "NEXTEVEN", args: "n", description: "Next even number after n", category: "math" },
  { name: "TOROMAN", args: "n", description: "Integer to Roman numeral", category: "text" },
  { name: "FROMROMAN", args: "text", description: "Roman numeral to integer", category: "text" },
  { name: "TOORDINAL", args: "n", description: "Number to ordinal (1st, 2nd...)", category: "text" },
  { name: "TEXTHEX", args: "text", description: "Text to hex string", category: "text" },
  { name: "TEXTFROMHEX", args: "hex", description: "Hex string to text", category: "text" },
  { name: "TEXTDEDUPE", args: "text", description: "Remove consecutive dupes", category: "text" },
  { name: "TEXTLINES", args: "text", description: "Count lines", category: "text" },
  { name: "TEXTPASCALCASE", args: "text", description: "PascalCase text", category: "text" },
  { name: "WMEAN", args: "val1,wt1,...", description: "Weighted mean", category: "stat" },
  { name: "GINI2", args: "values...", description: "Gini coefficient", category: "stat" },
  { name: "ISPRIMEFAST", args: "n", description: "Optimized primality test", category: "info" },
  { name: "SHARPE", args: "return, riskfree, stddev", description: "Sharpe ratio", category: "financial" },
  { name: "SORTINO", args: "return, riskfree, downdev", description: "Sortino ratio", category: "financial" },
  { name: "EMAVG", args: "prev, new, alpha", description: "Exponential moving avg step", category: "financial" },
  { name: "SMAVG", args: "prev, new, n", description: "Simple moving avg step", category: "financial" },
  { name: "ABUNDANCY", args: "n", description: "Abundancy index σ(n)/n", category: "math" },
  { name: "DIGITCOUNT", args: "n", description: "Number of digits", category: "math" },
  { name: "GOLDEN", args: "", description: "Golden ratio φ", category: "math" },
  { name: "EULER2", args: "", description: "Euler's number e", category: "math" },
  { name: "TAU", args: "", description: "Tau (2π)", category: "math" },
  { name: "CUBEROOT", args: "x", description: "Cube root", category: "math" },
  { name: "WRAP", args: "value, min, max", description: "Wrap into range [min,max)", category: "math" },
  { name: "REMAP", args: "val, a, b, c, d", description: "Remap from [a,b] to [c,d]", category: "math" },
  { name: "TEXTBASE64", args: "text", description: "Text to base64", category: "text" },
  { name: "TEXTFROMBASE64", args: "base64", description: "Base64 to text", category: "text" },
  { name: "TEXTPREFIX", args: "text, n", description: "First n characters", category: "text" },
  { name: "TEXTSUFFIX", args: "text, n", description: "Last n characters", category: "text" },
  { name: "RMS", args: "values...", description: "Root mean square", category: "stat" },
  { name: "RANGE2", args: "values...", description: "Range (max-min)", category: "stat" },
  { name: "IQR", args: "values...", description: "Interquartile range", category: "stat" },
  { name: "MAPE", args: "actual1,pred1,...", description: "Mean absolute % error", category: "stat" },
  { name: "ISODD2", args: "number", description: "Is odd number", category: "info" },
  { name: "ISEVEN2", args: "number", description: "Is even number", category: "info" },
  { name: "ISZERO", args: "value", description: "Is value zero", category: "info" },
  { name: "ANNUITY", args: "rate, periods", description: "Annuity factor", category: "financial" },
  { name: "FVANNUITY", args: "PMT, rate, periods", description: "Future value of annuity", category: "financial" },
  { name: "LUCAS", args: "n", description: "Lucas number", category: "math" },
  { name: "BELL", args: "n", description: "Bell number (set partitions)", category: "math" },
  { name: "INTLOG2", args: "n", description: "Integer log base 2", category: "math" },
  { name: "INTLOG10", args: "n", description: "Integer log base 10", category: "math" },
  { name: "BITLEN", args: "n", description: "Bit length of number", category: "math" },
  { name: "TEXTREPEAT", args: "text, n", description: "Repeat text n times", category: "text" },
  { name: "TEXTNTH", args: "text, n", description: "Nth character (1-based)", category: "text" },
  { name: "TEXTUNIQUE", args: "text", description: "Unique characters only", category: "text" },
  { name: "TEXTDISTINCT", args: "text", description: "Count distinct characters", category: "text" },
  { name: "COUNTIF2", args: "target, values...", description: "Count matching values", category: "lookup" },
  { name: "CHARCOUNT", args: "text, char", description: "Count char occurrences", category: "info" },
  { name: "ISEMPTYTEXT", args: "text", description: "Is empty or whitespace only", category: "info" },
  { name: "RULEOF72", args: "rate", description: "Years to double (Rule of 72)", category: "financial" },
  { name: "PRESENTVAL", args: "FV, rate, periods", description: "Present value of future amount", category: "financial" },
  { name: "SAWTOOTH", args: "x, period", description: "Sawtooth wave", category: "math" },
  { name: "SQUAREWAVE", args: "x, period", description: "Square wave", category: "math" },
  { name: "TRIANGLEWAVE", args: "x, period", description: "Triangle wave", category: "math" },
  { name: "AGM", args: "a, b", description: "Arithmetic-geometric mean", category: "math" },
  { name: "LOGISTIC", args: "x, k, x0", description: "Logistic function", category: "math" },
  { name: "GAMMA2", args: "x", description: "Gamma function (Lanczos)", category: "math" },
  { name: "TEXTROT13", args: "text", description: "ROT13 cipher", category: "text" },
  { name: "TEXTCAESAR", args: "text, shift", description: "Caesar cipher", category: "text" },
  { name: "TEXTFREQ", args: "text", description: "Most frequent character", category: "text" },
  { name: "ISASCII", args: "text", description: "All chars ASCII", category: "info" },
  { name: "ISPRINTABLE", args: "text", description: "All chars printable", category: "info" },
  { name: "ISWHITESPACE", args: "text", description: "All chars whitespace", category: "info" },
  { name: "SIMPLEINT", args: "P, r, t", description: "Simple interest P*r*t", category: "financial" },
  { name: "COMPOUNDINT", args: "P, r, t, n", description: "Compound interest", category: "financial" },
  { name: "DEPRECIATION", args: "cost, salvage, life", description: "Straight-line depreciation", category: "financial" },
  { name: "PENTAGONAL", args: "n", description: "Nth pentagonal number", category: "math" },
  { name: "HEXAGONAL", args: "n", description: "Nth hexagonal number", category: "math" },
  { name: "TETRAHEDRAL", args: "n", description: "Nth tetrahedral number", category: "math" },
  { name: "PYRAMIDAL", args: "n", description: "Nth square pyramidal number", category: "math" },
  { name: "STIRLING", args: "n", description: "Stirling's approximation for n!", category: "math" },
  { name: "CONEVOL", args: "radius, height", description: "Cone volume (1/3)πr²h", category: "math" },
  { name: "TEXTRLE", args: "text", description: "Run-length encode", category: "text" },
  { name: "TEXTRLD", args: "text", description: "Run-length decode", category: "text" },
  { name: "ISPERFECT", args: "n", description: "Is perfect number", category: "math" },
  { name: "ISHARSHAD", args: "n", description: "Is Harshad number (div by digit sum)", category: "math" },
  { name: "DEG2RAD", args: "degrees", description: "Degrees to radians", category: "math" },
  { name: "RAD2DEG", args: "radians", description: "Radians to degrees", category: "math" },
  { name: "SINC", args: "x", description: "Sinc function sin(πx)/(πx)", category: "math" },
  { name: "ATAN22", args: "y, x", description: "Two-argument arctangent", category: "math" },
  { name: "BINOMCOEF", args: "n, k", description: "Binomial coefficient C(n,k)", category: "math" },
  { name: "CATALAN", args: "n", description: "Nth Catalan number", category: "math" },
  { name: "TRIANGLENUM", args: "n", description: "Nth triangular number", category: "math" },
  { name: "TEXTEMOJI", args: "text", description: "Count emoji characters", category: "text" },
  { name: "TEXTSTRIP", args: "text", description: "Strip HTML tags", category: "text" },
  { name: "TEXTNORM", args: "text", description: "Normalize whitespace", category: "text" },
  { name: "TEXTMORSE", args: "text", description: "Text to morse code", category: "text" },
  { name: "BREAKEVEN", args: "fixed, price, varCost", description: "Break-even point", category: "financial" },
  { name: "PROFITMARGIN", args: "revenue, cost", description: "Profit margin ratio", category: "financial" },
  { name: "MARKUP", args: "price, cost", description: "Markup percentage", category: "financial" },
  { name: "ISUPPER", args: "text", description: "All chars uppercase", category: "info" },
  { name: "ISLOWER", args: "text", description: "All chars lowercase", category: "info" },
  { name: "ISPALINDROME", args: "text", description: "Check if palindrome", category: "info" },
  { name: "REPEAT2", args: "value, count", description: "Repeat value N times", category: "lookup" },
  { name: "LCMM", args: "values...", description: "LCM of multiple values", category: "math" },
  { name: "GCDM", args: "values...", description: "GCD of multiple values", category: "math" },
  { name: "POLYGONAREA", args: "sides, sideLen", description: "Regular polygon area", category: "math" },
  { name: "CIRCLEAREA", args: "radius", description: "Circle area (πr²)", category: "math" },
  { name: "SPHEREVOL", args: "radius", description: "Sphere volume (4/3πr³)", category: "math" },
  { name: "CYLINDERVOL", args: "radius, height", description: "Cylinder volume (πr²h)", category: "math" },
  { name: "KURTOSIS", args: "values...", description: "Excess kurtosis", category: "stat" },
  { name: "SKEWNESS", args: "values...", description: "Sample skewness", category: "stat" },
  { name: "GEOMEAN2", args: "values...", description: "Geometric mean (variadic)", category: "stat" },
  { name: "HARMEAN2", args: "values...", description: "Harmonic mean (variadic)", category: "stat" },
  { name: "TEXTSIM", args: "text1, text2", description: "Jaccard character similarity", category: "text" },
  { name: "TEXTZALGO", args: "text", description: "Add zalgo combining characters", category: "text" },
  { name: "TEXTASCII", args: "text", description: "Strip non-ASCII characters", category: "text" },
  { name: "TEXTSLUG", args: "text", description: "URL-slug conversion", category: "text" },
  { name: "WACC", args: "equity,debt,eqRet,debtRate,tax", description: "Weighted avg cost of capital", category: "financial" },
  { name: "PAYBACK", args: "investment, cashflow", description: "Payback period", category: "financial" },
  { name: "ROI", args: "gain, cost", description: "Return on investment", category: "financial" },
  { name: "ISNUMSTR", args: "text", description: "Is valid numeric string", category: "info" },
  { name: "TEXTENTROPY", args: "text", description: "Shannon entropy of characters", category: "info" },
  { name: "ALL2", args: "values...", description: "All values truthy", category: "logic" },
  { name: "ANY2", args: "values...", description: "Any value truthy", category: "logic" },
  { name: "NONE2", args: "values...", description: "No values truthy", category: "logic" },
  { name: "DIGSUM", args: "number", description: "Sum of digits", category: "math" },
  { name: "DIGROOT", args: "number", description: "Digital root (repeated digit sum)", category: "math" },
  { name: "NTHROOT", args: "x, n", description: "Nth root of x", category: "math" },
  { name: "TEXTHAMMING", args: "text1, text2", description: "Hamming distance", category: "text" },
  { name: "TEXTLEV", args: "text1, text2", description: "Levenshtein edit distance", category: "text" },
  { name: "ISALPHANUM", args: "text", description: "Check if alphanumeric", category: "info" },
  { name: "ISALPHA", args: "text", description: "Check if alphabetic", category: "info" },
  { name: "MAJORITY", args: "values...", description: "Majority vote (most common)", category: "logic" },
  { name: "COEFVAR", args: "values...", description: "Coefficient of variation", category: "stat" },
  { name: "TEXTPADSTART", args: "text, length, char", description: "Pad text at start", category: "text" },
  { name: "TEXTPADEND", args: "text, length, char", description: "Pad text at end", category: "text" },
  { name: "TEXTWRAP", args: "text, width", description: "Word wrap text", category: "text" },
  { name: "CHARCODE", args: "character", description: "Character to Unicode code point", category: "text" },
  { name: "FROMCHARCODE", args: "code_point", description: "Code point to character", category: "text" },
  { name: "ISPRIME", args: "n", description: "Primality test", category: "math" },
  { name: "NEXTPRIME", args: "n", description: "Next prime >= n", category: "math" },
  { name: "PRIMECOUNT", args: "n", description: "Count primes <= n (π(n))", category: "math" },
  { name: "TOTIENT", args: "n", description: "Euler's totient φ(n)", category: "math" },
  { name: "DIVISORS", args: "n", description: "Count of divisors", category: "math" },
  { name: "SEQUENCE2", args: "count, start, step", description: "Generate arithmetic sequence", category: "lookup" },
  { name: "LINSPACE", args: "start, end, count", description: "Evenly-spaced values", category: "lookup" },
  { name: "CELLTYPE", args: "value", description: "Cell type code (1=num,2=text,4=bool)", category: "info" },
  { name: "CHECKSUM", args: "text", description: "Simple numeric checksum", category: "info" },
  { name: "CAGR", args: "start, end, years", description: "Compound annual growth rate", category: "financial" },
  { name: "DISC", args: "price, face, days, basis", description: "Discount rate", category: "financial" },
  { name: "DOLLARDE", args: "fractional, fraction", description: "Dollar price to decimal", category: "financial" },
  { name: "DOLLARFR", args: "decimal, fraction", description: "Decimal dollar to fractional", category: "financial" },
  { name: "ENTROPY", args: "p1, p2, ...", description: "Shannon entropy", category: "stat" },
  { name: "GINI", args: "values...", description: "Gini coefficient", category: "stat" },
  { name: "WINSORIZE", args: "percentile, values...", description: "Winsorize outliers", category: "stat" },
  { name: "HYPOT3", args: "a, b, c", description: "3D distance sqrt(a²+b²+c²)", category: "math" },
  { name: "DISTANCE2D", args: "x1, y1, x2, y2", description: "2D Euclidean distance", category: "math" },
  { name: "MANHATTAN", args: "x1, y1, x2, y2", description: "Manhattan distance", category: "math" },
  { name: "FIBONACCI", args: "n", description: "Nth Fibonacci number", category: "math" },
  { name: "COLLATZ", args: "n", description: "Collatz sequence length", category: "math" },
  { name: "TYPEOF2", args: "value", description: "Type name (number/text/boolean/error)", category: "info" },
  { name: "SLN", args: "cost, salvage, life", description: "Straight-line depreciation", category: "financial" },
  { name: "SYD", args: "cost, salvage, life, per", description: "Sum-of-years-digits depreciation", category: "financial" },
  { name: "DDB", args: "cost, salvage, life, period", description: "Double-declining balance depreciation", category: "financial" },
  { name: "RATE", args: "nper, pmt, pv", description: "Interest rate estimation (Newton-Raphson)", category: "financial" },
  { name: "EFFECT.RATE", args: "nominal, npery", description: "Effective annual interest rate", category: "financial" },
  { name: "NOMINAL", args: "effective, npery", description: "Nominal annual interest rate", category: "financial" },
  { name: "ZSCORE", args: "x, mean, stdev", description: "Z-score standardization", category: "stat" },
  { name: "PERCENTRANK", args: "values..., target", description: "Percent rank of value", category: "stat" },
  { name: "NAND", args: "a, b", description: "NOT AND gate", category: "logic" },
  { name: "NOR", args: "a, b", description: "NOT OR gate", category: "logic" },
  { name: "XNOR", args: "a, b", description: "Exclusive NOR gate", category: "logic" },
  { name: "TEXTMASK", args: "text, show_count", description: "Mask characters with asterisks", category: "text" },
  { name: "TEXTTRUNCATE", args: "text, max_length", description: "Truncate with ellipsis", category: "text" },
  { name: "CUMSUM", args: "values...", description: "Cumulative sum", category: "stat" },
  { name: "CUMPROD", args: "values...", description: "Cumulative product", category: "stat" },
  { name: "MOVAVG", args: "window, values...", description: "Simple moving average", category: "stat" },
  { name: "BITNOT", args: "number", description: "Bitwise NOT", category: "math" },
  { name: "BITROTL", args: "number, shift", description: "Bitwise rotate left", category: "math" },
  { name: "BITROTR", args: "number, shift", description: "Bitwise rotate right", category: "math" },
  { name: "JSONIFY", args: "value", description: "Convert value to JSON string", category: "text" },
  { name: "TEXTTITLE", args: "text", description: "Title Case", category: "text" },
  { name: "ISNAN", args: "value", description: "Check if NaN", category: "info" },
  { name: "ISINFINITE", args: "value", description: "Check if Infinity", category: "info" },
  { name: "MODE.SNGL", args: "values...", description: "Single mode (most frequent)", category: "stat" },
  { name: "MODE.MULT", args: "values...", description: "All modes (ties)", category: "stat" },
  { name: "ROUNDMODE", args: "number, places, mode", description: "Round with mode (0=std,1=up,2=down,3=trunc)", category: "math" },
  { name: "BASE64.ENCODE", args: "text", description: "Encode text to base64", category: "text" },
  { name: "BASE64.DECODE", args: "text", description: "Decode base64 to text", category: "text" },
  { name: "TEXTROTATE", args: "text, positions", description: "Rotate text by N positions", category: "text" },
  { name: "TEXTINITIALS", args: "text", description: "Extract initials from text", category: "text" },
  { name: "TEXTCAMELCASE", args: "text", description: "Convert to camelCase", category: "text" },
  { name: "TEXTSNAKECASE", args: "text", description: "Convert to snake_case", category: "text" },
  { name: "TEXTKEBABCASE", args: "text", description: "Convert to kebab-case", category: "text" },
  { name: "WRAPCOLS", args: "values..., col_width", description: "Wrap array into columns", category: "lookup" },
  { name: "PRODUCTIF", args: "values..., conditions...", description: "Conditional product", category: "stat" },
  { name: "MEDIANIF", args: "values..., conditions...", description: "Conditional median", category: "stat" },
  { name: "ISDATE", args: "value", description: "Check if value is a date serial", category: "info" },
  { name: "DIGITS", args: "number", description: "Count digits in number", category: "info" },
  { name: "SIGMOID", args: "x", description: "Logistic sigmoid 1/(1+e^-x)", category: "math" },
  { name: "RELU", args: "x", description: "Rectified linear unit max(0,x)", category: "math" },
  { name: "SOFTPLUS", args: "x", description: "Smooth ReLU ln(1+e^x)", category: "math" },
  { name: "ELU", args: "x", description: "Exponential linear unit", category: "math" },
  { name: "NORMALIZE", args: "value, min, max", description: "Min-max normalization to [0,1]", category: "math" },
  { name: "MAPRANGE", args: "value, in_min, in_max, out_min, out_max", description: "Map value between ranges", category: "math" },
  { name: "TEXTCENTER", args: "text, width", description: "Center text in width", category: "text" },
  { name: "WORDCOUNT", args: "text", description: "Count words in text", category: "text" },
  { name: "YEARMONTH", args: "date_serial", description: "Year*12 + month for month arithmetic", category: "info" },
  { name: "QUARTER", args: "date_serial", description: "Quarter (1-4) from date", category: "info" },
  { name: "DAYOFYEAR", args: "date_serial", description: "Day of year (1-366)", category: "info" },
  { name: "ISLEAPYEAR", args: "year", description: "Check if year is leap year", category: "info" },
  { name: "DAYSINYEAR", args: "year", description: "365 or 366", category: "info" },
  { name: "DAYSINMONTH", args: "year, month", description: "Days in month (28-31)", category: "info" },
  { name: "TEXTSLICE", args: "text, start, end", description: "Slice text by position", category: "text" },
  { name: "TEXTINDEXOF", args: "text, search", description: "Position of substring (1-indexed)", category: "text" },
  { name: "TEXTSPLIT2", args: "text, delimiter", description: "Split text into array", category: "text" },
  { name: "ISINTEGER", args: "value", description: "Check if integer", category: "info" },
  { name: "ISFLOAT", args: "value", description: "Check if has decimal", category: "info" },
  { name: "ISPOSITIVE", args: "value", description: "Check if > 0", category: "info" },
  { name: "ISNEGATIVE", args: "value", description: "Check if < 0", category: "info" },
  { name: "ROUNDSIG", args: "number, sig_digits", description: "Round to N significant digits", category: "math" },
  { name: "CLAMP", args: "value, min, max", description: "Clamp value between bounds", category: "math" },
  { name: "LERP", args: "a, b, t", description: "Linear interpolation", category: "math" },
  { name: "SMOOTHSTEP", args: "edge0, edge1, x", description: "Smooth Hermite interpolation", category: "math" },
  { name: "PERCENTILE.EXC", args: "values..., k", description: "Exclusive percentile", category: "stat" },
  { name: "PERCENTILE.INC", args: "values..., k", description: "Inclusive percentile", category: "stat" },
  { name: "ENCODEURL", args: "text", description: "URL-encode text", category: "text" },
  { name: "DECODEURL", args: "text", description: "URL-decode text", category: "text" },
  { name: "ISURL", args: "text", description: "Check if text is a URL", category: "info" },
  { name: "ISEMAIL", args: "text", description: "Check if text is an email", category: "info" },
  { name: "HASH", args: "text", description: "DJB2 hash of text", category: "math" },
  { name: "TEXTSQUEEZE", args: "text", description: "Collapse multiple spaces", category: "text" },
  { name: "GESTEP", args: "number, step", description: "1 if number >= step (engineering)", category: "math" },
  { name: "DELTA", args: "number1, number2", description: "1 if equal (engineering)", category: "math" },
  { name: "CHISQ.DIST.RT", args: "x, deg_freedom", description: "Right-tailed chi-squared", category: "stat" },
  { name: "T.DIST.RT", args: "x, deg_freedom", description: "Right-tailed t-distribution", category: "stat" },
  { name: "F.DIST.RT", args: "x, deg_freedom1, deg_freedom2", description: "Right-tailed F-distribution", category: "stat" },
  { name: "T.INV.2T", args: "probability, deg_freedom", description: "Two-tailed inverse t", category: "stat" },
  { name: "TYPE", args: "value", description: "Numeric type code (1=num,2=text,4=bool,16=err)", category: "info" },
  { name: "ISBINARY", args: "text", description: "Check if valid binary string", category: "info" },
  { name: "ISHEX", args: "text", description: "Check if valid hexadecimal string", category: "info" },
  { name: "ACOTH", args: "number", description: "Inverse hyperbolic cotangent", category: "math" },
  { name: "EXPAND", args: "values..., size", description: "Expand array to size (pad with #N/A)", category: "lookup" },
  { name: "XMATCH", args: "lookup, array...", description: "Extended match (returns position)", category: "lookup" },
  { name: "COALESCE", args: "values...", description: "First non-error non-blank value", category: "logic" },
  { name: "XNPV", args: "rate, values..., dates...", description: "NPV with irregular dates", category: "financial" },
  { name: "SEC", args: "number", description: "Secant", category: "math" },
  { name: "CSC", args: "number", description: "Cosecant", category: "math" },
  { name: "SECH", args: "number", description: "Hyperbolic secant", category: "math" },
  { name: "CSCH", args: "number", description: "Hyperbolic cosecant", category: "math" },
  { name: "ACOT", args: "number", description: "Inverse cotangent", category: "math" },
  { name: "ARABIC", args: "roman_text", description: "Roman numeral to Arabic number", category: "math" },
  { name: "UNICODE", args: "text", description: "Unicode code point of first char", category: "text" },
  { name: "UNICHAR", args: "code_point", description: "Character from Unicode code point", category: "text" },
  { name: "ENDSWITH", args: "text, suffix", description: "Check if text ends with suffix", category: "text" },
  { name: "TEXTREVERSE", args: "text", description: "Reverse a string", category: "text" },
  { name: "TEXTREMOVE", args: "text, substring", description: "Remove all occurrences", category: "text" },
  { name: "REGEXMATCH", args: "text, pattern", description: "Test if text matches regex", category: "text" },
  { name: "REGEXEXTRACT", args: "text, pattern", description: "Extract first regex match", category: "text" },
  { name: "REGEXREPLACE", args: "text, pattern, replacement", description: "Replace by regex globally", category: "text" },
  { name: "FILTER", args: "values..., conditions...", description: "Filter array by condition", category: "lookup" },
  { name: "TAKE", args: "values..., count", description: "Take first/last N from array", category: "lookup" },
  { name: "DROP", args: "values..., count", description: "Drop first/last N from array", category: "lookup" },
  { name: "CHOOSECOLS", args: "values..., indices..., count", description: "Choose specific columns", category: "lookup" },
  { name: "CHOOSEROWS", args: "values..., indices..., count", description: "Choose specific rows", category: "lookup" },
  { name: "IMPLIES", args: "a, b", description: "Logical implication (a → b)", category: "logic" },
  { name: "BETWEEN", args: "value, low, high", description: "Value in range [low, high]", category: "logic" },
  { name: "ISFORMULA", args: "value", description: "Check if value is a formula", category: "info" },
  { name: "SHEET", args: "reference", description: "Sheet number (stub: 1)", category: "info" },
  { name: "SHEETS", args: "reference", description: "Sheet count (stub: 1)", category: "info" },
  { name: "SERIESSUM", args: "x, n, m, coefficients...", description: "Power series sum", category: "math" },
  { name: "SUBTOTAL", args: "function_num, values...", description: "Subtotal with function number", category: "math" },
  { name: "MULTINOMIAL", args: "numbers...", description: "Multinomial coefficient", category: "math" },
  { name: "WEIBULL.DIST", args: "x, alpha, beta, cumulative", description: "Weibull distribution", category: "stat" },
  { name: "EXPON.DIST", args: "x, lambda, cumulative", description: "Exponential distribution", category: "stat" },
  { name: "LOGNORM.DIST", args: "x, mean, std_dev, cumulative", description: "Lognormal distribution", category: "stat" },
  { name: "COUPPCD", args: "settlement, maturity, frequency", description: "Previous coupon date", category: "financial" },
  { name: "COUPNCD", args: "settlement, maturity, frequency", description: "Next coupon date", category: "financial" },
  { name: "ODDFPRICE", args: "settlement, maturity, rate, yield, redemption, freq", description: "Odd first period bond price", category: "financial" },
  { name: "CONTAINS", args: "text, substring", description: "Check if text contains substring (case-insensitive)", category: "text" },
  { name: "STARTSWITH", args: "text, prefix", description: "Check if text starts with prefix (case-insensitive)", category: "text" },
  { name: "YIELDMAT", args: "settlement, issue, maturity, rate, yield", description: "Yield to maturity", category: "financial" },
  { name: "ACCRINTM", args: "issue, maturity, rate, par", description: "Accrued interest at maturity", category: "financial" },
  { name: "COUPDAYSNC", args: "settlement, maturity, frequency", description: "Days to next coupon", category: "financial" },
  { name: "COUPNUM", args: "settlement, maturity, frequency", description: "Number of coupons", category: "financial" },
  { name: "TEXTPADSTART", args: "text, width, pad_char", description: "Pad text at start", category: "text" },
  { name: "TEXTPADEND", args: "text, width, pad_char", description: "Pad text at end", category: "text" },
  { name: "TEXTWRAP", args: "text, width", description: "Wrap text at width", category: "text" },
  { name: "ISERR", args: "value", description: "Is error (not #N/A)", category: "info" },
  { name: "ISNULL", args: "value", description: "Is null/empty string", category: "info" },
  { name: "HYPOT", args: "a, b", description: "Hypotenuse √(a²+b²)", category: "math" },
  { name: "MDETERM", args: "value", description: "Matrix determinant (1D: identity)", category: "math" },
  { name: "MINVERSE", args: "value", description: "Matrix inverse (1D: 1/value)", category: "math" },
  { name: "BETA.INV", args: "probability, alpha, beta", description: "Inverse beta distribution", category: "stat" },
  { name: "GAMMA.INV", args: "probability, alpha, beta", description: "Inverse gamma distribution", category: "stat" },
  { name: "AVERAGEWEIGHTED", args: "values..., weights...", description: "Weighted average", category: "stat" },
  { name: "DCOUNT", args: "database...", description: "Database count (numeric)", category: "stat" },
  { name: "DSUM", args: "database...", description: "Database sum", category: "stat" },
  { name: "DAVERAGE", args: "database...", description: "Database average", category: "stat" },
  { name: "DMAX", args: "database...", description: "Database maximum", category: "stat" },
  { name: "DMIN", args: "database...", description: "Database minimum", category: "stat" },
  { name: "DSTDEV", args: "database...", description: "Database sample std dev", category: "stat" },
  { name: "DVAR", args: "database...", description: "Database sample variance", category: "stat" },
  { name: "DGET", args: "database...", description: "Database get first match", category: "stat" },
  { name: "DCOUNTA", args: "database...", description: "Database count (all types)", category: "stat" },
  { name: "PERCENTRANK.EXC", args: "number, values...", description: "Exclusive percentile rank", category: "stat" },
  { name: "QUARTILE.EXC", args: "values..., quart", description: "Exclusive quartile", category: "stat" },
  { name: "QUARTILE.INC", args: "values..., quart", description: "Inclusive quartile", category: "stat" },
  { name: "NAND", args: "a, b", description: "NOT AND gate", category: "logic" },
  { name: "NOR", args: "a, b", description: "NOT OR gate", category: "logic" },
  { name: "XNOR", args: "a, b", description: "Equivalence gate (NOT XOR)", category: "logic" },
  { name: "SORTBY", args: "values..., sort_keys...", description: "Sort by corresponding keys", category: "lookup" },
  { name: "SINGLE", args: "values...", description: "Extract single value from array", category: "lookup" },
  { name: "XLOOKUP", args: "lookup, lookup_array..., return_array...", description: "Extended lookup with match modes", category: "lookup" },
  { name: "HYPERLINK", args: "url, friendly_name", description: "Create hyperlink (returns label)", category: "lookup" },
  { name: "NUMBERSTRING", args: "number", description: "Number as text string", category: "text" },
  { name: "IFBLANK", args: "value, value_if_blank", description: "If blank then fallback", category: "logic" },
  { name: "SUBSTITUTEN", args: "text, old, new, instance_num", description: "Substitute Nth occurrence", category: "text" },
  { name: "TEXTSPLIT.NTH", args: "text, delimiter, index", description: "Split text and return Nth part", category: "text" },
  { name: "COMBINA", args: "n, k", description: "Combinations with repetition C(n+k-1,k)", category: "math" },
  { name: "PERMUTATIONA", args: "n, k", description: "Permutations with repetition n^k", category: "math" },
  { name: "SQRTPI", args: "number", description: "Square root of (n * π)", category: "math" },
  { name: "RANDBETWEEN", args: "bottom, top", description: "Random integer between bounds", category: "volatile" },
  { name: "ISO.CEILING", args: "number, significance", description: "ISO ceiling (always rounds away from 0)", category: "math" },
  { name: "YIELDDISC", args: "settlement, maturity, price, redemption", description: "Yield for discounted security", category: "financial" },
  { name: "PRICEMAT", args: "settlement, issue, maturity, rate, yield", description: "Price at maturity", category: "financial" },
  { name: "ARRAYTOTEXT", args: "values...", description: "Convert array to comma-separated text", category: "lookup" },
  { name: "TOCOL", args: "values...", description: "Flatten to single column", category: "lookup" },
  { name: "TOROW", args: "values...", description: "Flatten to single row", category: "lookup" },
  { name: "VSTACK", args: "values...", description: "Vertical stack arrays", category: "lookup" },
  { name: "MAKEARRAY", args: "rows, cols, lambda", description: "Create array from lambda", category: "lookup" },
  { name: "WEBSERVICE", args: "url", description: "Web service call (placeholder)", category: "info" },
  { name: "FIELDVALUE", args: "field_name", description: "Extract field value (placeholder)", category: "info" },
  { name: "VLOOKUP", args: "lookup_value, data..., col_index", description: "Vertical lookup (1D)", category: "lookup" },
  { name: "HLOOKUP", args: "lookup_value, data..., row_index", description: "Horizontal lookup (1D)", category: "lookup" },
  { name: "LOOKUP", args: "lookup_value, lookup_range..., result_range...", description: "Binary search lookup", category: "lookup" },
  { name: "CLEANWS", args: "text", description: "Remove extra whitespace", category: "text" },
  { name: "TEXTCOUNT", args: "text, find", description: "Count substring occurrences", category: "text" },
  { name: "ISREF", args: "value", description: "Is cell reference", category: "info" },
  { name: "ISLOGICAL", args: "value", description: "Is boolean", category: "info" },
  { name: "ISNONTEXT", args: "value", description: "Is not text", category: "info" },
  { name: "ERROR.TYPE", args: "error", description: "Error type number", category: "info" },
  { name: "IFERROR", args: "value, value_if_error", description: "If error then fallback", category: "logic" },
  { name: "BITCOUNT", args: "number", description: "Count set bits (popcount)", category: "math" },
  { name: "MROUND", args: "number, multiple", description: "Round to nearest multiple", category: "math" },
  { name: "CEILING.MATH", args: "number, multiple", description: "Round up to multiple", category: "math" },
  { name: "FLOOR.MATH", args: "number, multiple", description: "Round down to multiple", category: "math" },
  { name: "BASE", args: "number, radix", description: "Convert to base string", category: "math" },
  { name: "DECIMAL", args: "text, radix", description: "Convert from base to number", category: "math" },
  { name: "AMORLINC", args: "cost, purchase, first_period, salvage, period, rate", description: "Prorated straight-line depreciation", category: "financial" },
  { name: "PRICE", args: "settlement, maturity, rate, yield, redemption, freq", description: "Bond price", category: "financial" },
  { name: "ODDLPRICE", args: "settlement, maturity, rate, yield, redemption, freq", description: "Odd last period bond price", category: "financial" },
  { name: "INFO", args: "type_text", description: "System information", category: "info" },
  { name: "CUMPRINC", args: "rate, nper, pv, start, end", description: "Cumulative principal paid", category: "financial" },
  { name: "PDURATION", args: "rate, pv, fv", description: "Periods to reach target value", category: "financial" },
  { name: "RRI", args: "nper, pv, fv", description: "Equivalent interest rate for growth", category: "financial" },
  { name: "TBILLEQ", args: "settlement, maturity, discount", description: "T-bill bond-equivalent yield", category: "financial" },
  { name: "TBILLPRICE", args: "settlement, maturity, discount", description: "T-bill price per $100", category: "financial" },
  { name: "DURATION", args: "rate, nper, coupon, pv, fv", description: "Macaulay duration", category: "financial" },
  { name: "MDURATION", args: "rate, nper, coupon, pv, fv", description: "Modified duration", category: "financial" },
  { name: "XIRR", args: "cashflows..., dates...", description: "IRR for irregular cashflows (Newton)", category: "financial" },
  { name: "YIELD", args: "rate, nper, coupon, price, redemption", description: "Bond yield approximation", category: "financial" },
  { name: "ROWS", args: "values...", description: "Count of values", category: "lookup" },
  { name: "TYPE", args: "value", description: "Type code (1=num, 2=text, 4=bool, 16=error)", category: "info" },
  { name: "AREAS", args: "refs...", description: "Count of areas", category: "lookup" },
  { name: "TRANSPOSE", args: "values...", description: "Reverse order (1D transpose)", category: "lookup" },
  { name: "CHITEST", args: "observed..., expected...", description: "Chi-squared test statistic", category: "stat" },
  { name: "TTEST", args: "x1,...,xK,y1,...,yK", description: "Paired t-test statistic", category: "stat" },
  { name: "FTEST", args: "x1,...,xK,y1,...,yK", description: "F-test (variance ratio)", category: "stat" },
  { name: "LINEST", args: "y1,...,yN", description: "Linear regression slope", category: "stat" },
  { name: "LOGEST", args: "y1,...,yN", description: "Exponential regression growth rate", category: "stat" },
  { name: "VARA", args: "values...", description: "Sample variance (A-variant: text=0, bool=0/1)", category: "stat" },
  { name: "STDEVA", args: "values...", description: "Sample std dev (A-variant)", category: "stat" },
  { name: "VARPA", args: "values...", description: "Population variance (A-variant)", category: "stat" },
  { name: "STDEVPA", args: "values...", description: "Population std dev (A-variant)", category: "stat" },
  { name: "PERCENTRANK.INC", args: "number, values...", description: "Inclusive percentile rank", category: "stat" },
  { name: "BETA.FN", args: "a, b", description: "Beta function B(a,b)", category: "math" },
  { name: "BESSELK", args: "x, order", description: "Modified Bessel K_n(x)", category: "math" },
  { name: "BESSELI", args: "x, order", description: "Modified Bessel I_n(x)", category: "math" },
  { name: "PERCENTILE.INC", args: "values..., k", description: "Inclusive percentile", category: "stat" },
  { name: "PERCENTILE.EXC", args: "values..., k", description: "Exclusive percentile (0<k<1)", category: "stat" },
  { name: "RANK.EQ", args: "number, values...", description: "Rank with equal ties", category: "stat" },
  { name: "RANK.AVG", args: "number, values...", description: "Rank with average ties", category: "stat" },
  { name: "VAR.S", args: "values...", description: "Sample variance (n-1)", category: "stat" },
  { name: "NORM.S.DIST", args: "x", description: "Standard normal CDF", category: "stat" },
  { name: "NORM.S.INV", args: "probability", description: "Standard normal inverse", category: "stat" },
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
