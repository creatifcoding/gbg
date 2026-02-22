/**
 * SurfaceProvider — React context for a genifer artifact surface
 *
 * Provides:
 *   - Surface metadata (id, version, thread, quality)
 *   - DataSource resolution (atoms, queries, RPCs)
 *   - Action dispatch (setState, emitEvent, callRpc, navigate)
 *   - Surface-scoped atoms for live binding
 *
 * Each surface gets its own provider → full isolation.
 *
 * @module genifer/react/SurfaceProvider
 */

'use client'

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import type { GeniferSurface } from '../harness/surface'
import type { DataSourceBinding, ActionBinding } from '../harness/surface'
import type { GeniferHarnessServiceShape } from '../harness/GeniferHarnessService'
import type { DataSourceResolverShape } from '../harness/DataSourceResolver'

// =============================================================================
// Surface Context
// =============================================================================

export interface SurfaceContextValue {
  /** The surface being rendered */
  readonly surface: GeniferSurface
  /** Resolve a data binding to its current value */
  readonly resolveBinding: (binding: DataSourceBinding) => unknown | undefined
  /** Execute an action binding */
  readonly executeAction: (binding: ActionBinding, eventPayload?: unknown) => void
  /** Get all data bindings for an element */
  readonly getBindingsForElement: (elementKey: string) => readonly DataSourceBinding[]
  /** Get all action bindings for an element */
  readonly getActionsForElement: (elementKey: string) => readonly ActionBinding[]
  /** Is the surface currently streaming? */
  readonly isStreaming: boolean
  /** Surface quality score */
  readonly qualityScore: number
  /** Refine this surface */
  readonly refine: (instruction: string) => void
  /** Collapse/expand surface */
  readonly toggleCollapse: () => void
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null)

// =============================================================================
// Hook: useSurface
// =============================================================================

/**
 * Access the surface context from any component inside the surface tree.
 * Throws if used outside SurfaceProvider.
 */
export function useSurface(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext)
  if (!ctx) {
    throw new Error('[genifer] useSurface() must be used inside a <SurfaceProvider>')
  }
  return ctx
}

// =============================================================================
// Hook: useDataSource
// =============================================================================

/**
 * Subscribe to a specific data source binding for an element prop.
 *
 * Usage:
 * ```tsx
 * function MyElement({ element }) {
 *   const value = useDataSource(element.key, 'value')
 *   // value is the resolved data from atom/query/rpc/static
 * }
 * ```
 */
export function useDataSource(elementKey: string, targetProp: string): unknown | undefined {
  const ctx = useContext(SurfaceContext)
  if (!ctx) return undefined

  const bindings = ctx.getBindingsForElement(elementKey)
  const binding = bindings.find((b) => b.targetProp === targetProp)
  if (!binding) return undefined

  return ctx.resolveBinding(binding)
}

/**
 * Get all resolved data sources for an element (keyed by targetProp).
 */
export function useDataSources(elementKey: string): Record<string, unknown> {
  const ctx = useContext(SurfaceContext)
  if (!ctx) return {}

  const bindings = ctx.getBindingsForElement(elementKey)
  const result: Record<string, unknown> = {}
  for (const binding of bindings) {
    result[binding.targetProp] = ctx.resolveBinding(binding)
  }
  return result
}

// =============================================================================
// Hook: useAction
// =============================================================================

/**
 * Get action handlers for an element (keyed by trigger event).
 *
 * Usage:
 * ```tsx
 * function MyButton({ element }) {
 *   const { onClick } = useActions(element.key)
 *   return <button onClick={onClick}>Click me</button>
 * }
 * ```
 */
export function useActions(elementKey: string): Record<string, (eventPayload?: unknown) => void> {
  const ctx = useContext(SurfaceContext)

  return useMemo(() => {
    if (!ctx) return {}

    const actions = ctx.getActionsForElement(elementKey)
    const handlers: Record<string, (eventPayload?: unknown) => void> = {}

    for (const action of actions) {
      handlers[action.trigger] = (eventPayload?: unknown) => {
        ctx.executeAction(action, eventPayload)
      }
    }
    return handlers
  }, [ctx, elementKey])
}

// =============================================================================
// SurfaceProvider Component
// =============================================================================

export interface SurfaceProviderProps {
  /** The surface to provide context for */
  surface: GeniferSurface
  /** DataSource resolver for live binding resolution */
  resolver?: DataSourceResolverShape
  /** Harness service for refine/action dispatch */
  harnessService?: GeniferHarnessServiceShape
  /** Session ID for service calls */
  sessionId?: string
  /** Callback when refine is requested */
  onRefine?: (surfaceId: string, instruction: string) => void
  /** Callback when surface collapse is toggled */
  onToggleCollapse?: (surfaceId: string) => void
  /** Callback when an action is executed */
  onActionExecuted?: (surfaceId: string, action: ActionBinding, payload?: unknown) => void
  /** Children */
  children: ReactNode
}

export function SurfaceProvider({
  surface,
  resolver,
  harnessService,
  sessionId,
  onRefine,
  onToggleCollapse,
  onActionExecuted,
  children,
}: SurfaceProviderProps) {
  // Parse data bindings from surface
  const dataBindingsMap = useMemo(() => {
    const map = new Map<string, DataSourceBinding[]>()
    for (const [bindingKey, binding] of Object.entries(surface.dataBindings)) {
      const [elementKey] = bindingKey.split(':')
      if (!map.has(elementKey)) map.set(elementKey, [])
      map.get(elementKey)!.push(binding)
    }
    return map
  }, [surface.dataBindings])

  // Parse action bindings from surface
  const actionBindingsMap = useMemo(() => {
    const map = new Map<string, ActionBinding[]>()
    for (const [actionKey, binding] of Object.entries(surface.actionBindings)) {
      const [elementKey] = actionKey.split(':')
      if (!map.has(elementKey)) map.set(elementKey, [])
      map.get(elementKey)!.push(binding)
    }
    return map
  }, [surface.actionBindings])

  const resolveBinding = useCallback(
    (binding: DataSourceBinding): unknown | undefined => {
      if (binding.type === 'static') {
        return binding.staticValue
      }
      // For live bindings, attempt resolver
      // TODO: Wire to resolver.resolve() with Effect.runSync for synchronous reads
      // For now, return undefined for live bindings (will be hydrated async)
      return undefined
    },
    [resolver],
  )

  const executeAction = useCallback(
    (binding: ActionBinding, eventPayload?: unknown) => {
      onActionExecuted?.(surface.id, binding, eventPayload)

      switch (binding.type) {
        case 'setState':
          // StateSyncService integration
          console.log(`[Surface ${surface.id}] setState: ${binding.target}`, eventPayload)
          break
        case 'emitEvent':
          console.log(`[Surface ${surface.id}] emitEvent: ${binding.target}`, binding.payload)
          break
        case 'callRpc':
          console.log(`[Surface ${surface.id}] callRpc: ${binding.target}`, binding.payload)
          break
        case 'navigate':
          console.log(`[Surface ${surface.id}] navigate: ${binding.target}`)
          break
      }
    },
    [surface.id, harnessService, onActionExecuted],
  )

  const getBindingsForElement = useCallback(
    (elementKey: string): readonly DataSourceBinding[] =>
      dataBindingsMap.get(elementKey) ?? [],
    [dataBindingsMap],
  )

  const getActionsForElement = useCallback(
    (elementKey: string): readonly ActionBinding[] =>
      actionBindingsMap.get(elementKey) ?? [],
    [actionBindingsMap],
  )

  const refine = useCallback(
    (instruction: string) => {
      onRefine?.(surface.id, instruction)
    },
    [surface.id, onRefine],
  )

  const toggleCollapse = useCallback(() => {
    onToggleCollapse?.(surface.id)
  }, [surface.id, onToggleCollapse])

  const value: SurfaceContextValue = useMemo(
    () => ({
      surface,
      resolveBinding,
      executeAction,
      getBindingsForElement,
      getActionsForElement,
      isStreaming: surface.status === 'streaming',
      qualityScore: surface.quality.score,
      refine,
      toggleCollapse,
    }),
    [
      surface,
      resolveBinding,
      executeAction,
      getBindingsForElement,
      getActionsForElement,
      refine,
      toggleCollapse,
    ],
  )

  return (
    <SurfaceContext.Provider value={value}>
      {children}
    </SurfaceContext.Provider>
  )
}
