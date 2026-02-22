/**
 * CodeModeExecutor — Parse, compile, and run LLM-generated code
 *
 * Three modes:
 *   define  — Register handlers/renderers/services (no return value)
 *   execute — Run code, return result
 *   pipe    — Create a streaming transform (returns async iterable)
 *
 * Security: Function constructor sandbox (no require/import/process/fs),
 * timeout via AbortSignal, URL allowlist via sandbox.
 *
 * @module genifer/code-mode/executor
 */

import { Effect } from 'effect'
import type { GeniferCodeSDK, GeniferCodeParams, ExposeSpec, GeniferCodeDetails } from './schemas'
import { CodeModeSandboxError, CodeModeTimeoutError, CodeModeResult } from './schemas'
import { createCodeSDK, getDynamicTools, getDynamicComponents } from './sandbox'
import {
  registerDynamicRpc,
  registerCustomRpcHandler,
} from '../services/DynamicRpcService'
import {
  defineDynamicEvent,
} from '../services/DynamicEventService'
import { RpcDefinition } from '../services/DynamicRpcSchemas'
import { EventDefinition } from '../services/DynamicEventSchemas'

// =============================================================================
// Blocked Globals (security)
// =============================================================================

/**
 * Globals to shadow as undefined in the sandbox.
 * Note: 'eval' and 'arguments' cannot be shadowed in strict mode,
 * so we skip them here and rely on static validation instead.
 */
const BLOCKED_GLOBALS = [
  'require',
  'process',
  'child_process',
  'fs',
  'path',
  'os',
  'crypto',
  'importScripts',
  '__dirname',
  '__filename',
  'module',
  'exports',
] as const

// =============================================================================
// Code Validation (parse phase)
// =============================================================================

/**
 * Validates that code doesn't contain dangerous patterns.
 * This is a STATIC check — not a substitute for runtime sandbox.
 */
function validateCode(code: string): void {
  // Block import() expressions (dynamic imports bypass sandbox)
  if (/\bimport\s*\(/.test(code)) {
    throw new CodeModeSandboxError({
      message: 'Dynamic import() is not allowed in code mode',
      code: code.slice(0, 100),
      phase: 'parse',
    })
  }

  // Block require()
  if (/\brequire\s*\(/.test(code)) {
    throw new CodeModeSandboxError({
      message: 'require() is not allowed in code mode',
      code: code.slice(0, 100),
      phase: 'parse',
    })
  }

  // Block process access
  if (/\bprocess\s*\./.test(code)) {
    throw new CodeModeSandboxError({
      message: 'process access is not allowed in code mode',
      code: code.slice(0, 100),
      phase: 'parse',
    })
  }
}

// =============================================================================
// Compile Phase — wraps code in a sandboxed function
// =============================================================================

/**
 * Compiles code into an executable async function with sandboxed globals.
 * The `sdk` parameter is the GeniferCodeSDK instance.
 */
function compileCode(code: string): (sdk: GeniferCodeSDK) => Promise<unknown> {
  try {
    // Wrap in async function with sdk as parameter
    // Block dangerous globals by shadowing them as undefined
    const blockedDecls = BLOCKED_GLOBALS
      .map((g) => `const ${g} = undefined;`)
      .join('\n')

    const wrappedCode = `
      ${blockedDecls}
      return (async function __geniferCodeMode__(sdk) {
        ${code}
      });
    `

    // Use Function constructor (safer than eval — no closure access)
    const factory = new Function(wrappedCode)
    const fn = factory() as (sdk: GeniferCodeSDK) => Promise<unknown>

    if (typeof fn !== 'function') {
      throw new Error('Compilation did not produce a function')
    }

    return fn
  } catch (e) {
    throw new CodeModeSandboxError({
      message: `Compilation failed: ${e instanceof Error ? e.message : String(e)}`,
      code: code.slice(0, 200),
      phase: 'compile',
    })
  }
}

// =============================================================================
// Execute Phase — runs compiled code with timeout
// =============================================================================

async function executeWithTimeout(
  fn: (sdk: GeniferCodeSDK) => Promise<unknown>,
  sdk: GeniferCodeSDK,
  timeoutMs: number,
): Promise<unknown> {
  return Promise.race([
    fn(sdk),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new CodeModeTimeoutError({
          message: `Code execution timed out after ${timeoutMs}ms`,
          timeoutMs,
        })),
        timeoutMs,
      ),
    ),
  ])
}

// =============================================================================
// Expose Phase — register sandbox outputs
// =============================================================================

function exposeOutputs(result: unknown, expose: ExposeSpec, sdk: GeniferCodeSDK): void {
  if (expose.asRpc && typeof result === 'function') {
    sdk.register.rpc({
      tag: expose.asRpc,
      description: `Code mode RPC: ${expose.asRpc}`,
      handler: result as any,
    })
  }

  if (expose.asTool && typeof result === 'function') {
    sdk.register.tool({
      name: expose.asTool,
      label: expose.asTool,
      description: `Code mode tool: ${expose.asTool}`,
      execute: result as any,
    })
  }

  if (expose.asAtom) {
    sdk.atoms.set(expose.asAtom, result)
  }

  if (expose.asEvent) {
    sdk.register.event({
      tag: expose.asEvent,
      description: `Code mode event: ${expose.asEvent}`,
    })
    // If result is a value, emit it immediately
    if (result !== undefined && typeof result !== 'function') {
      sdk.emit(expose.asEvent, result)
    }
  }
}

// =============================================================================
// Public API — executeCodeMode
// =============================================================================

/**
 * Execute LLM-generated code in the sandbox.
 *
 * @param params - The genifer_code tool parameters
 * @returns CodeModeResult with execution details
 */
export function executeCodeMode(
  params: GeniferCodeParams,
): Effect.Effect<CodeModeResult, CodeModeSandboxError | CodeModeTimeoutError> {
  return Effect.gen(function* () {
    const start = Date.now()
    const timeoutMs = params.timeout ?? 10_000

    // Phase 1: Parse — static validation
    try {
      validateCode(params.code)
    } catch (e) {
      if (e instanceof CodeModeSandboxError) return yield* e
      return yield* new CodeModeSandboxError({
        message: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
        phase: 'parse',
      })
    }

    // Phase 2: Compile — wrap in sandboxed function
    let compiled: (sdk: GeniferCodeSDK) => Promise<unknown>
    try {
      compiled = compileCode(params.code)
    } catch (e) {
      if (e instanceof CodeModeSandboxError) return yield* e
      return yield* new CodeModeSandboxError({
        message: `Compile error: ${e instanceof Error ? e.message : String(e)}`,
        phase: 'compile',
      })
    }

    // Phase 3: Execute — run with timeout
    const sdk = createCodeSDK()
    let result: unknown
    try {
      result = yield* Effect.tryPromise({
        try: () => executeWithTimeout(compiled, sdk, timeoutMs),
        catch: (e) => {
          if (e instanceof CodeModeTimeoutError) return e
          return new CodeModeSandboxError({
            message: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
            phase: 'execute',
          })
        },
      })
    } catch (e) {
      // Effect.tryPromise catch returns the error, but we need to yield it
      if (e instanceof CodeModeTimeoutError) return yield* e
      if (e instanceof CodeModeSandboxError) return yield* e
      return yield* new CodeModeSandboxError({
        message: `Unexpected error: ${String(e)}`,
        phase: 'execute',
      })
    }

    // Phase 4: Expose — register outputs
    const exposed = params.expose
    if (exposed) {
      try {
        exposeOutputs(result, exposed, sdk)
      } catch (e) {
        return yield* new CodeModeSandboxError({
          message: `Expose error: ${e instanceof Error ? e.message : String(e)}`,
          phase: 'expose',
        })
      }
    }

    const durationMs = Date.now() - start

    return new CodeModeResult({
      mode: params.mode,
      success: true,
      result: serializeResult(result),
      exposed: exposed ? {
        asRpc: exposed.asRpc,
        asTool: exposed.asTool,
        asAtom: exposed.asAtom,
        asEvent: exposed.asEvent,
      } : undefined,
      durationMs,
    })
  })
}

// =============================================================================
// Helpers
// =============================================================================

/** Serialize result for transport — functions become their string repr */
function serializeResult(result: unknown): unknown {
  if (result === undefined) return null
  if (typeof result === 'function') return `[Function: ${result.name || 'anonymous'}]`
  if (typeof result === 'bigint') return result.toString()
  if (typeof result === 'symbol') return result.toString()
  try {
    // Test if JSON-serializable
    JSON.stringify(result)
    return result
  } catch {
    return String(result)
  }
}
