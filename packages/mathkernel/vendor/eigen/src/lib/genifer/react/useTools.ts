/**
 * useTool / useToolRegistry — React hooks for genifer tool calling
 *
 * Bridges ToolRegistryService atoms into React via useSyncExternalStore.
 *
 * @module genifer/react/useTools
 */

'use client'

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import {
  registeredToolsAtom,
  activeCallsAtom,
  toolResultsAtom,
  getToolRegistryService,
  type ToolRegistryServiceShape,
} from './tool-registry.js'
import type { GeniferToolDefinition, GeniferToolHandler, GeniferToolResult } from '../core/tools.js'

// =============================================================================
// useToolRegistry — list/register/unregister tools
// =============================================================================

export interface UseToolRegistryReturn {
  /** All registered tool definitions */
  tools: readonly GeniferToolDefinition[]
  /** Register a tool */
  register: (definition: GeniferToolDefinition, handler: GeniferToolHandler) => void
  /** Unregister by name */
  unregister: (name: string) => void
  /** Execute any registered tool */
  execute: ToolRegistryServiceShape['execute']
  /** All completed results */
  results: readonly GeniferToolResult[]
}

export function useToolRegistry(): UseToolRegistryReturn {
  const serviceRef = useRef<ToolRegistryServiceShape | null>(null)
  if (!serviceRef.current) {
    serviceRef.current = getToolRegistryService()
  }
  const service = serviceRef.current
  const r = service.registry

  const tools = useSyncExternalStore(
    (cb) => r.subscribe(registeredToolsAtom, cb),
    () => Array.from(r.get(registeredToolsAtom).values()),
    () => [],
  )

  const results = useSyncExternalStore(
    (cb) => r.subscribe(toolResultsAtom, cb),
    () => r.get(toolResultsAtom),
    () => [] as readonly GeniferToolResult[],
  )

  const register = useCallback(
    (def: GeniferToolDefinition, handler: GeniferToolHandler) => service.register(def, handler),
    [service],
  )

  const unregister = useCallback(
    (name: string) => service.unregister(name),
    [service],
  )

  const execute = useCallback(
    (...a: Parameters<ToolRegistryServiceShape['execute']>) => service.execute(...a),
    [service],
  )

  return { tools, register, unregister, execute, results }
}

// =============================================================================
// useTool — single tool focused hook
// =============================================================================

export interface UseToolReturn {
  /** Call the tool with args */
  call: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<GeniferToolResult>
  /** Whether a call is currently in-flight */
  isPending: boolean
  /** Most recent result (or undefined) */
  lastResult: GeniferToolResult | undefined
  /** All results for this tool */
  results: readonly GeniferToolResult[]
}

export function useTool(toolName: string): UseToolReturn {
  const serviceRef = useRef<ToolRegistryServiceShape | null>(null)
  if (!serviceRef.current) {
    serviceRef.current = getToolRegistryService()
  }
  const service = serviceRef.current
  const r = service.registry

  const isPending = useSyncExternalStore(
    (cb) => r.subscribe(activeCallsAtom, cb),
    () => {
      const calls = r.get(activeCallsAtom)
      return Array.from(calls.values()).some((c) => c.name === toolName)
    },
    () => false,
  )

  const results = useSyncExternalStore(
    (cb) => r.subscribe(toolResultsAtom, cb),
    () => r.get(toolResultsAtom).filter((r) => r.toolName === toolName),
    () => [] as readonly GeniferToolResult[],
  )

  const lastResult = results.length > 0 ? results[results.length - 1] : undefined

  const call = useCallback(
    (args: Record<string, unknown>, signal?: AbortSignal) =>
      service.execute(toolName, args, { source: 'user', signal }),
    [service, toolName],
  )

  return { call, isPending, lastResult, results }
}
