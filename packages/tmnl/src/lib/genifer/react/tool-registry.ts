/**
 * ToolRegistryService — Client-side tool management for genifer
 *
 * Registry-based (same Atom-as-State pattern as StateSyncService):
 *   - Atoms: registeredToolsAtom, activeCallsAtom, resultsAtom
 *   - register/unregister tools at runtime
 *   - execute dispatches to handler, manages lifecycle state
 *   - Results accumulate for conversation history
 *
 * Bridge to harness:
 *   - GeniferToolDefinition → pi-ai Tool (parametersSchema is TypeBox JSON)
 *   - GeniferToolCall lifecycle → HarnessToolEvent (start/update/end)
 *   - GeniferToolResult → ToolResultMessage shape
 *
 * @module genifer/react/tool-registry
 */

import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { nanoid } from 'nanoid'
import { Schema as S, Either } from 'effect'
import {
  GeniferToolCall,
  GeniferToolResult,
  type GeniferToolDefinition,
  type GeniferToolHandler,
  type ToolInvocationState,
} from '../core/tools.js'

// =============================================================================
// Atoms
// =============================================================================

/** Registered tool definitions keyed by name */
export const registeredToolsAtom = Atom.make<ReadonlyMap<string, GeniferToolDefinition>>(
  new Map(),
).pipe(Atom.keepAlive)

/** Tool handlers are scoped per-service-instance (see createToolRegistryService) */

/** Active tool calls (in-flight) */
export const activeCallsAtom = Atom.make<ReadonlyMap<string, GeniferToolCall>>(
  new Map(),
).pipe(Atom.keepAlive)

/** Completed tool results (append-only log) */
const MAX_RESULTS = 200
export const toolResultsAtom = Atom.make<readonly GeniferToolResult[]>([]).pipe(Atom.keepAlive)

// =============================================================================
// Service Shape
// =============================================================================

export type ToolRegistryServiceShape = {
  /** Register a tool definition with its handler */
  register: (definition: GeniferToolDefinition, handler: GeniferToolHandler) => void
  /** Unregister a tool by name */
  unregister: (name: string) => void
  /** List registered tool definitions */
  list: () => readonly GeniferToolDefinition[]
  /** Execute a tool call. Returns the result. Manages lifecycle atoms. */
  execute: (name: string, args: Record<string, unknown>, options?: {
    callId?: string
    source?: 'llm' | 'user' | 'system'
    signal?: AbortSignal
  }) => Promise<GeniferToolResult>
  /** Get a specific active call */
  getCall: (callId: string) => GeniferToolCall | undefined
  /** Get all results for a given tool name */
  getResults: (toolName?: string) => readonly GeniferToolResult[]
  /** Clear all state */
  reset: () => void
  /** The registry for atom access */
  readonly registry: Registry.Registry
}

// =============================================================================
// Factory
// =============================================================================

export function createToolRegistryService(
  registry: Registry.Registry = Registry.make(),
): ToolRegistryServiceShape {
  // Per-instance handler map — NOT module-global
  const toolHandlers = new Map<string, GeniferToolHandler>()

  // Helper: update a call's state
  function updateCallState(callId: string, state: ToolInvocationState) {
    const calls = new Map(registry.get(activeCallsAtom))
    const existing = calls.get(callId)
    if (existing) {
      calls.set(callId, new GeniferToolCall({ ...existing, state }))
      registry.set(activeCallsAtom, calls)
    }
  }

  return {
    register(definition, handler) {
      const tools = new Map(registry.get(registeredToolsAtom))
      tools.set(definition.name, definition)
      registry.set(registeredToolsAtom, tools)
      toolHandlers.set(definition.name, handler)
    },

    unregister(name) {
      const tools = new Map(registry.get(registeredToolsAtom))
      tools.delete(name)
      registry.set(registeredToolsAtom, tools)
      toolHandlers.delete(name)
    },

    list() {
      return Array.from(registry.get(registeredToolsAtom).values())
    },

    async execute(name, args, options) {
      const callId = options?.callId ?? nanoid()
      const source = options?.source ?? 'user'
      const signal = options?.signal

      // Validate tool exists
      const definition = registry.get(registeredToolsAtom).get(name)
      if (!definition) {
        const result = new GeniferToolResult({
          callId,
          toolName: name,
          content: `Tool not found: '${name}'`,
          isError: true,
          timestamp: Date.now(),
        })
        // Still log the result
        const results = registry.get(toolResultsAtom)
        registry.set(
          toolResultsAtom,
          results.length >= MAX_RESULTS ? [...results.slice(-100), result] : [...results, result],
        )
        return result
      }

      const handler = toolHandlers.get(name)
      if (!handler) {
        const result = new GeniferToolResult({
          callId,
          toolName: name,
          content: `No handler registered for tool: '${name}'`,
          isError: true,
          timestamp: Date.now(),
        })
        const results = registry.get(toolResultsAtom)
        registry.set(
          toolResultsAtom,
          results.length >= MAX_RESULTS ? [...results.slice(-100), result] : [...results, result],
        )
        return result
      }

      // Validate args against parametersSchema if present
      if (definition.parametersSchema) {
        try {
          // parametersSchema is stored as JSON Schema (from TypeBox).
          // For runtime validation, decode as a Record — the schema itself
          // is TypeBox, not Effect Schema, so we validate structurally.
          const schemaObj = definition.parametersSchema as Record<string, unknown>
          if (schemaObj && typeof schemaObj === 'object' && 'properties' in schemaObj) {
            const props = schemaObj.properties as Record<string, { type?: string }>
            const validationErrors: string[] = []
            for (const [key, spec] of Object.entries(props)) {
              if (spec.type && args[key] !== undefined) {
                const actual = typeof args[key]
                if (spec.type === 'number' && actual !== 'number') {
                  validationErrors.push(`${key}: expected number, got ${actual}`)
                } else if (spec.type === 'string' && actual !== 'string') {
                  validationErrors.push(`${key}: expected string, got ${actual}`)
                } else if (spec.type === 'boolean' && actual !== 'boolean') {
                  validationErrors.push(`${key}: expected boolean, got ${actual}`)
                }
              }
            }
            if (validationErrors.length > 0) {
              const result = new GeniferToolResult({
                callId,
                toolName: name,
                content: `Args validation failed: ${validationErrors.join('; ')}`,
                isError: true,
                timestamp: Date.now(),
              })
              const results = registry.get(toolResultsAtom)
              registry.set(
                toolResultsAtom,
                results.length >= MAX_RESULTS ? [...results.slice(-100), result] : [...results, result],
              )
              return result
            }
          }
        } catch {
          // Schema validation setup failed — proceed without validation
        }
      }

      // Create active call (pending)
      const call = new GeniferToolCall({
        id: callId,
        name,
        args,
        state: 'pending',
        timestamp: Date.now(),
        source,
      })
      const calls = new Map(registry.get(activeCallsAtom))
      calls.set(callId, call)
      registry.set(activeCallsAtom, calls)

      // Check approval requirement
      if (definition.requiresApproval) {
        updateCallState(callId, 'approval-required')
        // TODO: hook into approval UI — for now, auto-approve
        updateCallState(callId, 'approved')
      }

      // Execute
      updateCallState(callId, 'running')

      let result: GeniferToolResult
      try {
        const handlerResult = await handler(callId, args, signal)
        result = new GeniferToolResult({
          callId,
          toolName: name,
          content: handlerResult.content,
          isError: handlerResult.isError ?? false,
          data: handlerResult.data,
          timestamp: Date.now(),
        })
        updateCallState(callId, 'completed')
      } catch (error) {
        result = new GeniferToolResult({
          callId,
          toolName: name,
          content: error instanceof Error ? error.message : String(error),
          isError: true,
          timestamp: Date.now(),
        })
        updateCallState(callId, 'error')
      }

      // Remove from active, add to results
      const finalCalls = new Map(registry.get(activeCallsAtom))
      finalCalls.delete(callId)
      registry.set(activeCallsAtom, finalCalls)

      const results = registry.get(toolResultsAtom)
      registry.set(
        toolResultsAtom,
        results.length >= MAX_RESULTS ? [...results.slice(-100), result] : [...results, result],
      )

      return result
    },

    getCall(callId) {
      return registry.get(activeCallsAtom).get(callId)
    },

    getResults(toolName) {
      const all = registry.get(toolResultsAtom)
      return toolName ? all.filter((r) => r.toolName === toolName) : all
    },

    reset() {
      registry.set(registeredToolsAtom, new Map())
      registry.set(activeCallsAtom, new Map())
      registry.set(toolResultsAtom, [])
      toolHandlers.clear()
    },

    get registry() {
      return registry
    },
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: ToolRegistryServiceShape | null = null

export function getToolRegistryService(): ToolRegistryServiceShape {
  if (!_instance) {
    _instance = createToolRegistryService()
  }
  return _instance
}
