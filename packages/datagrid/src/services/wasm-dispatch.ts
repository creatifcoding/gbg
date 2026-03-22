/**
 * WASM Dispatch Table
 *
 * Typed recipe objects map VM opcodes → WASM function calls with marshalling.
 * The dispatch layer:
 *   1. Lazy-loads WASM on first invocation (JS fallback until loaded)
 *   2. Marshals StackValue[] ↔ Float64Array
 *   3. Returns results as StackValue (num/vmError)
 *
 * FUNC_MAP entries delegate here via `tryWasmDispatch()`.
 * If WASM isn't loaded yet, returns `null` → caller falls through to JS stub.
 */

// MainModule type is structural — we only need the function call interface.
// The actual WASM module is loaded dynamically to avoid hard dependency.
type MainModule = Record<string, (...args: any[]) => any>;

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Marshalling strategy for converting stack values → WASM args.
 *
 * - `scalar`:      Pop 1 number, pass directly
 * - `scalar2`:     Pop 2 numbers, pass as (a, b)
 * - `scalar3`:     Pop 3 numbers, pass as (a, b, c)
 * - `array_f64`:   Pop N numbers, convert to Float64Array
 * - `matrix`:      Pop flat array + rows + cols → Float64Array + int + int
 * - `two_arrays`:  Pop two arrays (split by half of N) → two Float64Arrays
 * - `array_param`: Pop N values, first is a param (number), rest → Float64Array
 */
type MarshalIn =
  | 'scalar'
  | 'scalar2'
  | 'scalar3'
  | 'array_f64'
  | 'matrix'
  | 'two_arrays'
  | 'array_param'
  | 'poly_coeffs'
  | 'tabulated';

/**
 * Unmarshalling strategy for converting WASM result → stack values.
 *
 * - `scalar`:     Push single number
 * - `f64_array`:  Push first element of returned Float64Array (summary stat)
 * - `object`:     Result is JS object with named fields; push specified field
 * - `passthrough`: Result is already the right shape
 */
type UnmarshalOut =
  | 'scalar'
  | 'f64_first'
  | 'f64_array'
  | { field: string };

/**
 * Arity of the WASM function from the VM's perspective.
 *
 * - number:      Fixed arity (pop exactly N values)
 * - 'variadic':  Arity comes from op.n
 * - 'unary':     Alias for 1
 * - 'binary':    Alias for 2
 * - 'ternary':   Alias for 3
 */
type Arity = number | 'variadic' | 'unary' | 'binary' | 'ternary';

/** A typed recipe describing how to call one WASM function from the VM. */
export interface WasmRecipe {
  /** The WASM function name (must exist on MainModule) */
  readonly wasmFn: string;
  /** How many values to pop from the stack */
  readonly arity: Arity;
  /** How to convert stack values → WASM arguments */
  readonly marshal: MarshalIn;
  /** How to convert WASM result → stack value(s) */
  readonly unmarshal: UnmarshalOut;
}

// ── Recipe Table ─────────────────────────────────────────────────────────────

/**
 * Maps VM opcode _tag → WASM recipe.
 *
 * Organized by tier order (T1→T5) per Prime's directive.
 */
export const WASM_RECIPES: Record<string, WasmRecipe> = {
  // ── T1: Linear Algebra ──────────────────────────────────────────────────
  MDETERM_OP:  { wasmFn: 'det',       arity: 'unary',    marshal: 'scalar',     unmarshal: 'scalar' },
  // Note: MDETERM takes a matrix ref in spreadsheet context but in VM tests
  // it's simplified. Full matrix ops need the matrix marshal path.

  // ── T2: Decompositions — skipping for now (need matrix marshalling) ─────

  // ── T3: Regression Diagnostics ──────────────────────────────────────────
  // These require array marshalling — will be wired in batch 2

  // ── T4: Vectorized — Scalar unary ops ───────────────────────────────────
  SINC_OP:         { wasmFn: 'sinc',       arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  DAWSON_OP:       { wasmFn: 'dawson',     arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  FRESNEL_S_OP:    { wasmFn: 'fresnel_s',  arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  FRESNEL_C_OP:    { wasmFn: 'fresnel_c',  arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  ERF_OP:          { wasmFn: 'erf_fn',     arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  ERFC_OP:         { wasmFn: 'erfc_fn',    arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  GAMMA2_OP:       { wasmFn: 'gamma_fn',   arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  DIGAMMA_OP:      { wasmFn: 'digamma',    arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  ELLIPK_OP:       { wasmFn: 'elliptic_k', arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  ELLIPE_OP:       { wasmFn: 'elliptic_e', arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  BESSEL_J0_OP:    { wasmFn: 'bessel_j0',  arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },
  BESSELJ_OP:      { wasmFn: 'bessel_j0',  arity: 'unary',   marshal: 'scalar',  unmarshal: 'scalar' },

  // Scalar binary ops
  BETAFN_OP:       { wasmFn: 'beta_fn',    arity: 'binary',  marshal: 'scalar2', unmarshal: 'scalar' },

  // ── T4: Vectorized — Variadic (pop N from stack) ───────────────────────
  L1NORM_N:        { wasmFn: 'l1_norm',        arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  L2NORM_N:        { wasmFn: 'l2_norm',        arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  LINFNORM_N:      { wasmFn: 'linf_norm',      arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  ENTROPY_N:       { wasmFn: 'entropy',         arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  ENTROPY2_N:      { wasmFn: 'entropy',         arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  ENTROPY3_N:      { wasmFn: 'entropy',         arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },
  COSINESIM_N:     { wasmFn: 'cosine_similarity', arity: 'variadic', marshal: 'two_arrays', unmarshal: 'scalar' },
  KLDIVERGE_N:     { wasmFn: 'kl_divergence',   arity: 'variadic', marshal: 'two_arrays', unmarshal: 'scalar' },
  JSDIVERGE_N:     { wasmFn: 'js_divergence',   arity: 'variadic', marshal: 'two_arrays', unmarshal: 'scalar' },
  CROSSENTROPY_N:  { wasmFn: 'cross_entropy',   arity: 'variadic', marshal: 'two_arrays', unmarshal: 'scalar' },

  // Rolling stats (first arg = window size)
  EWMA_N:          { wasmFn: 'ewma',            arity: 'variadic', marshal: 'array_param', unmarshal: 'f64_first' },

  // Window functions
  HAMMING_N:       { wasmFn: 'hamming_window',  arity: 'variadic', marshal: 'array_f64',   unmarshal: 'f64_first' },
  HANNING_N:       { wasmFn: 'hann_window',     arity: 'variadic', marshal: 'array_f64',   unmarshal: 'f64_first' },

  // Transforms
  CUMSUM_N:        { wasmFn: 'cumsum',           arity: 'variadic', marshal: 'array_f64',   unmarshal: 'f64_first' },

  // ── T5: Robust Stats & Hypothesis Tests ─────────────────────────────────
  BOOTSTRAPMEAN_N: { wasmFn: 'bootstrap',       arity: 'variadic', marshal: 'array_f64',   unmarshal: { field: 'mean' } },
  JACKKNIFE_N:     { wasmFn: 'jackknife',       arity: 'variadic', marshal: 'array_f64',   unmarshal: { field: 'std_error' } },
  SHAPIRO_N:       { wasmFn: 'shapiro_wilk',    arity: 'variadic', marshal: 'array_f64',   unmarshal: { field: 'W' } },
  KSTEST_N:        { wasmFn: 'ks_test',         arity: 'variadic', marshal: 'array_f64',   unmarshal: { field: 'D' } },
  ANDERSON_N:      { wasmFn: 'anderson_darling', arity: 'variadic', marshal: 'array_f64',  unmarshal: { field: 'A2' } },
  AUTOCORR_N:      { wasmFn: 'autocorrelation', arity: 'variadic', marshal: 'array_param', unmarshal: 'f64_first' },
  CROSSCORR_N:     { wasmFn: 'crosscorrelation', arity: 'variadic', marshal: 'two_arrays', unmarshal: 'f64_first' },
  MAHALANOBIS_N:   { wasmFn: 'mahalanobis',     arity: 'variadic', marshal: 'array_f64',   unmarshal: 'scalar' },

  // ── T5: Time Series ─────────────────────────────────────────────────────
  DETREND_N:       { wasmFn: 'detrend',         arity: 'variadic', marshal: 'array_f64',   unmarshal: 'f64_first' },
};

// ── WASM Module State ────────────────────────────────────────────────────────

let _wasm: MainModule | null = null;
let _loading: Promise<MainModule> | null = null;
let _loadFailed = false;

/**
 * Lazy-load the WASM module. Returns immediately if already loaded.
 * On first call, triggers async load; JS fallback is used for that invocation.
 */
function ensureWasm(): MainModule | null {
  if (_wasm) return _wasm;
  if (_loadFailed) return null;

  if (!_loading) {
    _loading = _doLoad();
    _loading.catch(() => {}); // Fire-and-forget
  }

  return null; // Not loaded yet — caller should use JS fallback
}

async function _doLoad(): Promise<MainModule> {
  try {
    // Try direct WASM glue import first (works when alias configured)
    const createMathKernel = (await import(/* @vite-ignore */ '@tmnl/mathkernel/wasm')).default;
    _wasm = await createMathKernel();
    return _wasm;
  } catch {
    try {
      // Fallback: try the TS wrapper
      const modPath = '@tmnl/mathkernel';
      const mod = await import(/* @vite-ignore */ modPath);
      _wasm = await mod.loadMathKernel();
      return _wasm;
    } catch (e) {
      console.warn('[wasm-dispatch] Failed to load mathkernel WASM:', e);
      _loadFailed = true;
      throw e;
    }
  }
}

/** Explicitly initialize WASM (call during app startup). */
export async function initWasmDispatch(): Promise<boolean> {
  try {
    if (_wasm) return true;
    _wasm = await _doLoad();
    return true;
  } catch {
    _loadFailed = true;
    return false;
  }
}

/** Check if WASM is currently available. */
export function isWasmReady(): boolean {
  return _wasm !== null;
}

// ── Stack Helpers (import from stack-vm internals) ───────────────────────────

// These mirror the stack-vm helpers. We import types but keep the dispatch
// module decoupled from stack-vm's internal implementation.

interface StackValue {
  readonly _tag: string;
  [key: string]: unknown;
}

function isNum(v: StackValue): boolean { return v._tag === 'num'; }
function asNum(v: StackValue): number { return (v as any).value as number; }
function num(n: number): StackValue { return { _tag: 'num', value: n }; }
function vmError(code: string, ctx: string): StackValue {
  return { _tag: 'error', code, context: ctx };
}

// ── Marshalling Engine ───────────────────────────────────────────────────────

function resolveArity(recipe: WasmRecipe, op: any): number {
  switch (recipe.arity) {
    case 'unary': return 1;
    case 'binary': return 2;
    case 'ternary': return 3;
    case 'variadic': return (op as any).n as number;
    default: return recipe.arity;
  }
}

function marshalArgs(
  recipe: WasmRecipe,
  args: StackValue[],
  wasm: MainModule
): unknown[] {
  switch (recipe.marshal) {
    case 'scalar':
      return [asNum(args[0])];

    case 'scalar2':
      return [asNum(args[0]), asNum(args[1])];

    case 'scalar3':
      return [asNum(args[0]), asNum(args[1]), asNum(args[2])];

    case 'array_f64': {
      const vals = args.map(a => asNum(a));
      return [new Float64Array(vals)];
    }

    case 'two_arrays': {
      const half = Math.floor(args.length / 2);
      const a = args.slice(0, half).map(v => asNum(v));
      const b = args.slice(half).map(v => asNum(v));
      return [new Float64Array(a), new Float64Array(b)];
    }

    case 'array_param': {
      // First arg is a scalar parameter, rest are the array
      const param = asNum(args[0]);
      const vals = args.slice(1).map(a => asNum(a));
      return [new Float64Array(vals), param];
    }

    case 'poly_coeffs': {
      const vals = args.map(a => asNum(a));
      return [new Float64Array(vals)];
    }

    case 'tabulated': {
      const vals = args.map(a => asNum(a));
      return [new Float64Array(vals)];
    }

    case 'matrix': {
      // Expect: flat values, then rows, then cols as last two stack values
      const cols = asNum(args[args.length - 1]);
      const rows = asNum(args[args.length - 2]);
      const flat = args.slice(0, -2).map(a => asNum(a));
      return [new Float64Array(flat), rows, cols];
    }

    default:
      return args.map(a => asNum(a));
  }
}

function unmarshalResult(recipe: WasmRecipe, result: unknown, fnName: string): StackValue {
  const unm = recipe.unmarshal;

  if (unm === 'scalar') {
    return num(result as number);
  }

  if (unm === 'f64_first') {
    if (result instanceof Float64Array || Array.isArray(result)) {
      return num((result as any)[0] ?? 0);
    }
    return num(result as number);
  }

  if (unm === 'f64_array') {
    if (result instanceof Float64Array || Array.isArray(result)) {
      return num((result as any)[0] ?? 0);
    }
    return num(result as number);
  }

  if (typeof unm === 'object' && 'field' in unm) {
    const obj = result as Record<string, unknown>;
    const val = obj[unm.field];
    if (typeof val === 'number') return num(val);
    if (val instanceof Float64Array) return num(val[0] ?? 0);
    return vmError('UNMARSHAL_FAILED', `${fnName}.${unm.field}`);
  }

  return num(result as number);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Try to dispatch a VM operation via WASM.
 *
 * Returns `null` if:
 *   - No WASM recipe exists for this opcode
 *   - WASM module isn't loaded yet (triggers lazy load)
 *
 * Returns `{ result: StackValue }` if WASM handled it.
 * The caller (FUNC_MAP) should fall through to JS when this returns null.
 *
 * @param opTag - The _tag of the opcode (e.g. "SINC_OP", "SHAPIRO_N")
 * @param op    - The full opcode object (may contain .n for variadic)
 * @param stack - The VM stack (mutated: pops args, pushes result)
 */
export function tryWasmDispatch(
  opTag: string,
  op: unknown,
  stack: StackValue[]
): { result: StackValue } | null {
  const recipe = WASM_RECIPES[opTag];
  if (!recipe) return null;

  const wasm = ensureWasm();
  if (!wasm) return null; // Not loaded yet — JS fallback

  const arity = resolveArity(recipe, op);

  // Stack underflow check
  if (stack.length < arity) {
    const err = vmError('STACK_UNDERFLOW', opTag);
    stack.push(err);
    return { result: err };
  }

  // Pop args from stack
  const args = stack.splice(stack.length - arity, arity);

  // Validate all args are numbers
  for (const arg of args) {
    if (!isNum(arg)) {
      // Error propagation — push error and return
      const err = (arg._tag === 'error') ? arg : vmError('TYPE_ERROR', opTag);
      stack.push(err);
      return { result: err };
    }
  }

  try {
    // Get the WASM function
    const fn = (wasm as any)[recipe.wasmFn];
    if (typeof fn !== 'function') {
      // Recipe points to non-existent WASM function — fall back to JS
      // Put args back on stack
      stack.push(...args);
      return null;
    }

    // Marshal → Call → Unmarshal
    const wasmArgs = marshalArgs(recipe, args, wasm);
    const rawResult = fn(...wasmArgs);
    const result = unmarshalResult(recipe, rawResult, recipe.wasmFn);

    stack.push(result);
    return { result };
  } catch (e) {
    // WASM threw — return as VM error
    const err = vmError('WASM_ERROR', `${opTag}: ${(e as Error).message}`);
    stack.push(err);
    return { result: err };
  }
}

/**
 * Get all opcode tags that have WASM recipes.
 * Useful for testing and diagnostics.
 */
export function getWasmOpcodes(): string[] {
  return Object.keys(WASM_RECIPES);
}

/**
 * Get the recipe for a specific opcode (for testing/inspection).
 */
export function getRecipe(opTag: string): WasmRecipe | undefined {
  return WASM_RECIPES[opTag];
}
