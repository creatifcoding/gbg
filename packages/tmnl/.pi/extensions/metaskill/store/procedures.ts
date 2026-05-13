/**
 * @module procedures
 *
 * Stored Procedure Registry for the ms tool.
 *
 * Inspired by Lisp image-based development: define functions interactively,
 * they persist in the RLM store, and any future session can call them.
 *
 * Architecture:
 *   - Procedures stored in `_procedures` collection (system namespace)
 *   - Code stored as fn.toString() — reconstructed via new Function on call
 *   - Input/output validation via JSON Schema (optional)
 *   - Version tracking on redefine
 *   - Dependency declarations for composition
 *   - Proxy-based `ms.fn.name(args)` accessor
 *
 * The agent writes: ms.define('healthCheck', (ms) => ms.where(s => !s.clean, s => s.name))
 * Later:            ms.call('healthCheck') or ms.fn.healthCheck()
 */

// ── Types ────────────────────────────────────────────────────────

export interface ProcedureRecord {
  /** Procedure name — the callable identifier */
  name: string
  /** Human description for discovery */
  description: string
  /** Function source code (fn.toString()) */
  code: string
  /** Categorization tags */
  tags: string[]
  /** Auto-incremented on redefine */
  version: number
  /** Which agent/session created it */
  author: string
  /** ISO timestamp — first creation */
  created: string
  /** ISO timestamp — last update */
  updated: string
  /** Names of other procedures this depends on */
  dependencies: string[]
  /** JSON Schema for input validation (optional) */
  inputSchema?: Record<string, unknown>
  /** JSON Schema for output validation (optional) */
  outputSchema?: Record<string, unknown>
}

export interface DefineOptions {
  /** Human description */
  description?: string
  /** Categorization tags */
  tags?: string[]
  /** Author label */
  author?: string
  /** Names of other procedures this depends on */
  dependencies?: string[]
  /** JSON Schema for input validation */
  inputSchema?: Record<string, unknown>
  /** JSON Schema for output validation */
  outputSchema?: Record<string, unknown>
}

export interface ProcedureSummary {
  name: string
  description: string
  version: number
  tags: string[]
  dependencies: string[]
  hasInputSchema: boolean
  hasOutputSchema: boolean
  updated: string
}

export interface CallResult {
  /** The return value of the procedure */
  value: unknown
  /** Procedure name that was called */
  procedure: string
  /** Execution time in ms */
  duration: number
}

// ── Constants ────────────────────────────────────────────────────

const COLLECTION = '_procedures'

// ── Procedure API Factory ────────────────────────────────────────

export interface ProcedureApi {
  /**
   * Define (or redefine) a stored procedure.
   *
   * @param name - Callable identifier
   * @param fn - Function to store. Gets `ms` as first arg, optional `args` as second.
   *             Stored as fn.toString().
   * @param opts - Description, tags, schemas, dependencies
   */
  define(name: string, fn: Function, opts?: DefineOptions): Promise<ProcedureRecord>

  /**
   * Define from a code string (for inline / agent-generated procedures).
   */
  defineCode(name: string, code: string, opts?: DefineOptions): Promise<ProcedureRecord>

  /**
   * Call a stored procedure by name.
   *
   * @param name - Procedure name
   * @param args - Arguments passed to the procedure (after `ms`)
   * @returns The procedure's return value
   */
  call(name: string, args?: unknown): Promise<unknown>

  /**
   * List all stored procedures with summaries.
   */
  procedures(): Promise<ProcedureSummary[]>

  /**
   * Get full procedure record by name.
   */
  describe(name: string): Promise<ProcedureRecord | null>

  /**
   * Delete a stored procedure.
   */
  remove(name: string): Promise<boolean>

  /**
   * Get procedure source code.
   */
  source(name: string): Promise<string | null>

  /**
   * Proxy object: ms.fn.myProc(args) → ms.call('myProc', args)
   */
  fn: Record<string, (args?: unknown) => Promise<unknown>>
}

/**
 * Create the procedure API.
 *
 * @param storeGet - ms.get bound to store
 * @param storePut - ms.put bound to store
 * @param storeDelete - ms.delete bound to store
 * @param storeQuery - ms.query bound to store
 * @param storeKeys - ms.keys bound to store
 * @param getMsObject - Lazy getter for the full ms object (injected into procedure calls)
 */
export function createProcedureApi(
  storeGet: (ns: string, key: string) => Promise<unknown | null>,
  storePut: (ns: string, key: string, data: Record<string, unknown>, tags?: string[]) => Promise<void>,
  storeDelete: (ns: string, key: string) => Promise<boolean>,
  storeQuery: (ns: string, filter?: any) => Promise<readonly any[]>,
  storeKeys: (ns: string) => Promise<readonly string[]>,
  getMsObject: () => any,
): ProcedureApi {

  // ── define ──────────────────────────────────────────────────

  async function define(name: string, fn: Function, opts?: DefineOptions): Promise<ProcedureRecord> {
    const code = fn.toString()
    return defineCode(name, code, opts)
  }

  async function defineCode(name: string, code: string, opts?: DefineOptions): Promise<ProcedureRecord> {
    if (!name || typeof name !== 'string') throw new Error('Procedure name must be a non-empty string')
    if (!code || typeof code !== 'string') throw new Error('Procedure code must be a non-empty string')

    // Check for existing — increment version if redefine
    const existing = await storeGet(COLLECTION, name) as ProcedureRecord | null
    const version = existing ? (existing.version ?? 0) + 1 : 1
    const now = new Date().toISOString()

    const record: ProcedureRecord = {
      name,
      description: opts?.description ?? '',
      code,
      tags: opts?.tags ?? [],
      version,
      author: opts?.author ?? 'agent',
      created: existing?.created ?? now,
      updated: now,
      dependencies: opts?.dependencies ?? [],
      ...(opts?.inputSchema ? { inputSchema: opts.inputSchema } : {}),
      ...(opts?.outputSchema ? { outputSchema: opts.outputSchema } : {}),
    }

    await storePut(COLLECTION, name, record as unknown as Record<string, unknown>, [
      'procedure',
      ...record.tags,
    ])

    return record
  }

  // ── call ────────────────────────────────────────────────────

  async function call(name: string, args?: unknown): Promise<unknown> {
    const record = await storeGet(COLLECTION, name) as ProcedureRecord | null
    if (!record) throw new Error(`Procedure '${name}' not found. Use ms.procedures() to list available.`)

    const code = record.code
    const ms = getMsObject()
    const start = Date.now()

    try {
      // Reconstruct the function from stored source
      const fn = reconstructFunction(code)
      // Execute with ms as first arg, user args as second
      const result = await fn(ms, args)
      return result
    } catch (err: any) {
      throw new Error(`Procedure '${name}' failed: ${err.message}`)
    }
  }

  // ── list ────────────────────────────────────────────────────

  async function procedures(): Promise<ProcedureSummary[]> {
    const keys = await storeKeys(COLLECTION)
    const summaries: ProcedureSummary[] = []

    for (const key of keys) {
      const record = await storeGet(COLLECTION, key) as ProcedureRecord | null
      if (record) {
        summaries.push({
          name: record.name,
          description: record.description,
          version: record.version,
          tags: record.tags,
          dependencies: record.dependencies,
          hasInputSchema: !!record.inputSchema,
          hasOutputSchema: !!record.outputSchema,
          updated: record.updated,
        })
      }
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name))
  }

  // ── describe ────────────────────────────────────────────────

  async function describeProcedure(name: string): Promise<ProcedureRecord | null> {
    return await storeGet(COLLECTION, name) as ProcedureRecord | null
  }

  // ── remove ──────────────────────────────────────────────────

  async function remove(name: string): Promise<boolean> {
    return storeDelete(COLLECTION, name)
  }

  // ── source ──────────────────────────────────────────────────

  async function source(name: string): Promise<string | null> {
    const record = await storeGet(COLLECTION, name) as ProcedureRecord | null
    return record?.code ?? null
  }

  // ── fn proxy ────────────────────────────────────────────────

  const fnProxy = new Proxy({} as Record<string, (args?: unknown) => Promise<unknown>>, {
    get(_target, prop: string) {
      if (typeof prop !== 'string') return undefined
      // Return a callable that delegates to call()
      return (args?: unknown) => call(prop, args)
    },
    has(_target, prop: string) {
      // Always return true — we can't synchronously check the store
      return typeof prop === 'string'
    },
    ownKeys() {
      // Can't enumerate synchronously — return empty
      // Use ms.procedures() for listing
      return []
    },
  })

  return {
    define,
    defineCode,
    call,
    procedures,
    describe: describeProcedure,
    remove,
    source,
    fn: fnProxy,
  }
}

// ── Function Reconstruction ──────────────────────────────────────

/**
 * Reconstruct a callable function from stored source code.
 *
 * Handles multiple source formats:
 * 1. Arrow function: `(ms, args) => { ... }`
 * 2. Regular function: `function(ms, args) { ... }`
 * 3. Named function: `function myFn(ms, args) { ... }`
 * 4. Async variants of all above
 * 5. Raw code body (no function wrapper)
 */
function reconstructFunction(code: string): (ms: any, args?: unknown) => unknown {
  const trimmed = code.trim()

  // If it looks like a function expression, wrap and evaluate
  if (
    trimmed.startsWith('(') ||
    trimmed.startsWith('function') ||
    trimmed.startsWith('async (') ||
    trimmed.startsWith('async function')
  ) {
    try {
      // Wrap in parens to make it an expression
      const fn = new Function(`"use strict"; return (${trimmed})`)()
      if (typeof fn === 'function') return fn
    } catch {
      // Fall through to body-style reconstruction
    }
  }

  // Arrow with no parens: ms => ms.discover()
  if (/^(?:async\s+)?[a-zA-Z_$]\w*\s*=>/.test(trimmed)) {
    try {
      const fn = new Function(`"use strict"; return (${trimmed})`)()
      if (typeof fn === 'function') return fn
    } catch {
      // Fall through
    }
  }

  // Last resort: treat as function body, wrap with (ms, args) params
  return new Function('ms', 'args', `"use strict"; ${trimmed}`) as (ms: any, args?: unknown) => unknown
}
