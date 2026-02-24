/**
 * Code Mode Schemas — TypeBox params + Effect Schema types
 *
 * genifer_code tool: 3 modes (define/execute/pipe), expose outputs,
 * GeniferCodeSDK interface for sandbox runtime.
 *
 * @module genifer/code-mode/schemas
 */

import { Type, type Static } from '@sinclair/typebox'
import { Schema, Effect, Stream, Layer } from 'effect'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

// =============================================================================
// TypeBox Params (for ToolDefinition — constraint D3)
// =============================================================================

export const GeniferCodeParams = Type.Object({
  code: Type.String({
    description: 'Effect-TS code to execute. Has access to genifer services, atoms, and RPCs via the `sdk` global.',
  }),
  mode: Type.Union([
    Type.Literal('define'),
    Type.Literal('execute'),
    Type.Literal('pipe'),
  ], {
    description: 'define: create new handler/renderer. execute: run and return result. pipe: stream transform.',
  }),
  expose: Type.Optional(Type.Object({
    asRpc: Type.Optional(Type.String({
      description: 'Register result as callable RPC with this tag',
    })),
    asTool: Type.Optional(Type.String({
      description: 'Register result as tool with this name',
    })),
    asAtom: Type.Optional(Type.String({
      description: 'Register result as subscribable atom with this key',
    })),
    asEvent: Type.Optional(Type.String({
      description: 'Register result as event emitter with this tag',
    })),
  })),
  timeout: Type.Optional(Type.Number({
    description: 'Execution timeout in milliseconds (default: 10000)',
    default: 10000,
  })),
})
export type GeniferCodeParams = Static<typeof GeniferCodeParams>

// =============================================================================
// Tool Details (returned to harness)
// =============================================================================

export interface GeniferCodeDetails {
  readonly mode: 'define' | 'execute' | 'pipe'
  readonly success: boolean
  readonly result?: unknown
  readonly exposed?: {
    readonly asRpc?: string
    readonly asTool?: string
    readonly asAtom?: string
    readonly asEvent?: string
  }
  readonly durationMs: number
  readonly error?: string
}

// =============================================================================
// Effect Schema — CodeModeResult (for internal pipeline)
// =============================================================================

export class CodeModeResult extends Schema.Class<CodeModeResult>('CodeModeResult')({
  mode: Schema.Literal('define', 'execute', 'pipe'),
  success: Schema.Boolean,
  result: Schema.optional(Schema.Unknown),
  exposed: Schema.optional(Schema.Struct({
    asRpc: Schema.optional(Schema.String),
    asTool: Schema.optional(Schema.String),
    asAtom: Schema.optional(Schema.String),
    asEvent: Schema.optional(Schema.String),
  })),
  durationMs: Schema.Number,
  error: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Errors
// =============================================================================

export class CodeModeSandboxError extends Schema.TaggedError<CodeModeSandboxError>()(
  'CodeModeSandboxError',
  {
    message: Schema.String,
    code: Schema.optional(Schema.String),
    phase: Schema.Literal('parse', 'compile', 'execute', 'expose'),
  },
) {}

export class CodeModeTimeoutError extends Schema.TaggedError<CodeModeTimeoutError>()(
  'CodeModeTimeoutError',
  {
    message: Schema.String,
    timeoutMs: Schema.Number,
  },
) {}

// =============================================================================
// GeniferCodeSDK Interface — what the sandbox code has access to
// =============================================================================

/**
 * The SDK surface available to code executed in the sandbox.
 * Accessed via the `sdk` global inside genifer_code.
 */
export interface GeniferCodeSDK {
  // --- Atoms (read/write/subscribe) ---
  readonly atoms: {
    readonly get: <T>(key: string) => T | undefined
    readonly set: <T>(key: string, value: T) => void
    readonly subscribe: <T>(key: string, fn: (value: T) => void) => () => void
  }

  // --- Registration ---
  readonly register: {
    readonly tool: (spec: {
      name: string
      label: string
      description: string
      execute: (params: any) => Promise<any>
    }) => void
    readonly rpc: (spec: {
      tag: string
      description?: string
      handler: (payload: any) => any | Promise<any>
    }) => void
    readonly event: (spec: {
      tag: string
      description?: string
      payloadSchema?: unknown
    }) => void
    readonly component: (name: string, factory: (props: any) => any) => void
  }

  // --- HTTP Client ---
  readonly http: {
    readonly get: (url: string, options?: { headers?: Record<string, string> }) => Promise<any>
    readonly post: (url: string, body: unknown, options?: { headers?: Record<string, string> }) => Promise<any>
  }

  // --- Events ---
  readonly emit: (tag: string, payload?: unknown) => void
  readonly on: (tag: string, handler: (payload: unknown) => void) => () => void

  // --- RPC ---
  readonly callRpc: (tag: string, payload?: unknown) => any

  // --- Surface Manipulation ---
  readonly surface: {
    /** Get surface info (id, status, prompt, element count) */
    readonly get: (surfaceId: string) => { id: string; status: string; prompt: string; elementCount: number } | undefined
    /** List elements in a surface */
    readonly listElements: (surfaceId: string) => Array<{ key: string; type: string }>
    /** Get a specific element's props */
    readonly getElement: (surfaceId: string, elementKey: string) => Record<string, unknown> | undefined
    /** Update an element's props — triggers re-render */
    readonly updateElement: (surfaceId: string, elementKey: string, props: Record<string, unknown>) => void
    /** Add a child element to a parent */
    readonly addElement: (surfaceId: string, parentKey: string, element: { key: string; type: string; props?: Record<string, unknown>; children?: string[] }) => void
    /** Remove an element from the surface */
    readonly removeElement: (surfaceId: string, elementKey: string) => void
  }

  // --- GEOINT ---
  readonly geoint: {
    readonly spawn: {
      readonly one: (result: unknown) => Promise<unknown>
      readonly batch: (results: ReadonlyArray<unknown>) => Promise<unknown>
    }
    readonly search: (params: {
      mode?: 'all' | 'type' | 'bounds' | 'type+bounds'
      entityType?: 'flight' | 'poi' | 'weather' | 'track' | 'feature' | 'imagery'
      bounds?: { west: number; east: number; south: number; north: number }
      limit?: number
    }) => Promise<unknown>
    readonly summary: (params: {
      scope?: 'entity' | 'all' | 'type' | 'bounds'
      entityId?: string
      entityType?: 'flight' | 'poi' | 'weather' | 'track' | 'feature' | 'imagery'
      bounds?: { west: number; east: number; south: number; north: number }
      includeViewport?: boolean
    }) => Promise<unknown>
    readonly plan: (params: {
      queryId?: string
      text?: string
      bbox?: readonly [number, number, number, number]
      requestedSources?: ReadonlyArray<string>
      strategy?: 'latency-first' | 'coverage-first' | 'trust-first'
      constraints?: {
        filterLanguage?: 'none' | 'cql2-text' | 'cql2-json'
        requiresStreaming?: boolean
        requiresTemporalOrdering?: boolean
        maxSources?: number
      }
    }) => Promise<unknown>
    readonly select: (entityId: string | null) => Promise<void>
    readonly focus: (entityId: string, zoom?: number) => Promise<unknown>
    readonly clear: () => Promise<void>
    readonly viewport: {
      readonly get: () => Promise<unknown>
      readonly set: (viewport: Record<string, unknown>) => Promise<unknown>
      readonly reset: () => Promise<unknown>
    }
  }

  // --- Logging ---
  readonly log: (...args: any[]) => void
  readonly warn: (...args: any[]) => void
  readonly error: (...args: any[]) => void
}

// =============================================================================
// Expose Spec — what to do with sandbox output
// =============================================================================

export interface ExposeSpec {
  readonly asRpc?: string
  readonly asTool?: string
  readonly asAtom?: string
  readonly asEvent?: string
}
