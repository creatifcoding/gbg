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
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Effect, Fiber, Stream } from 'effect'
import type { GeniferSurface } from '../harness/surface'
import { DataSourceBinding, type ActionBinding } from '../harness/surface'
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
// Helpers
// =============================================================================

function extractEventValue(eventPayload: unknown): unknown {
  if (eventPayload && typeof eventPayload === 'object' && 'target' in (eventPayload as any)) {
    return (eventPayload as any).target?.value
  }
  return eventPayload
}

function templateLookup(path: string, data: unknown): unknown {
  const parts = path.split('.').filter(Boolean)
  let current: unknown = data
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function interpolatePayload(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{\s*([^}]+)\s*\}\}$/)
    if (exact) {
      return templateLookup(exact[1], context)
    }

    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr: string) => {
      const resolved = templateLookup(expr, context)
      if (resolved === undefined || resolved === null) return ''
      return typeof resolved === 'string' ? resolved : JSON.stringify(resolved)
    })
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolatePayload(item, context))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolatePayload(v, context)
    }
    return out
  }
  return value
}

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
  const dataBindingEntries = useMemo(
    () => Object.entries(surface.dataBindings) as ReadonlyArray<readonly [string, DataSourceBinding]>,
    [surface.dataBindings],
  )

  // Parse data bindings from surface
  const dataBindingsMap = useMemo(() => {
    const map = new Map<string, DataSourceBinding[]>()
    for (const [bindingKey, binding] of dataBindingEntries) {
      const [elementKey] = bindingKey.split(':')
      if (!map.has(elementKey)) map.set(elementKey, [])
      map.get(elementKey)!.push(binding)
    }
    return map
  }, [dataBindingEntries])

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

  const bindingKeyByRef = useMemo(() => {
    const wm = new WeakMap<object, string>()
    for (const [bindingKey, binding] of dataBindingEntries) {
      wm.set(binding as object, bindingKey)
    }
    return wm
  }, [dataBindingEntries])

  const [bindingValues, setBindingValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    setBindingValues({})
  }, [surface.id])

  useEffect(() => {
    if (!resolver) return
    let cancelled = false
    const fibers: Array<Fiber.RuntimeFiber<unknown, unknown>> = []

    for (const [bindingKey, binding] of dataBindingEntries) {
      const seedFiber = Effect.runFork(
        resolver.resolve(binding).pipe(
          Effect.catchAll(() => Effect.succeed(undefined)),
          Effect.tap((value) => Effect.sync(() => {
            if (cancelled || value === undefined) return
            setBindingValues((prev) => (prev[bindingKey] === value ? prev : { ...prev, [bindingKey]: value }))
          })),
        ),
      )
      fibers.push(seedFiber)

      if (binding.type === 'static') continue

      const subscriptionFiber = Effect.runFork(
        Stream.runForEach(resolver.subscribe(binding), (value) =>
          Effect.sync(() => {
            if (cancelled) return
            setBindingValues((prev) => (prev[bindingKey] === value ? prev : { ...prev, [bindingKey]: value }))
          }),
        ).pipe(Effect.catchAll(() => Effect.void)),
      )
      fibers.push(subscriptionFiber)
    }

    return () => {
      cancelled = true
      for (const fiber of fibers) {
        Effect.runFork(Fiber.interrupt(fiber))
      }
    }
  }, [resolver, dataBindingEntries])

  const resolveBinding = useCallback(
    (binding: DataSourceBinding): unknown | undefined => {
      const bindingKey = bindingKeyByRef.get(binding as object)
      if (bindingKey && bindingKey in bindingValues) {
        return bindingValues[bindingKey]
      }

      if (binding.type === 'static') {
        return binding.staticValue
      }

      return undefined
    },
    [bindingKeyByRef, bindingValues],
  )

  const executeAction = useCallback(
    (binding: ActionBinding, eventPayload?: unknown) => {
      if (binding.confirmPrompt && typeof window !== 'undefined') {
        const confirmed = window.confirm(binding.confirmPrompt)
        if (!confirmed) return
      }

      const extractedEventValue = extractEventValue(eventPayload)
      const stateContext: Record<string, unknown> = {}
      for (const [bindingKey, source] of dataBindingEntries) {
        stateContext[source.targetProp] = bindingValues[bindingKey] ?? source.staticValue
      }

      const resolvedPayload = binding.payload !== undefined
        ? interpolatePayload(binding.payload, {
            event: eventPayload,
            payload: extractedEventValue,
            state: stateContext,
            surface: { id: surface.id, sessionId, threadId: surface.threadId },
          })
        : extractedEventValue

      onActionExecuted?.(surface.id, binding, resolvedPayload)

      switch (binding.type) {
        case 'setState': {
          const targets = dataBindingEntries.filter(([bindingKey, source]) =>
            bindingKey === binding.target || source.key === binding.target,
          )

          for (const [bindingKey, source] of targets) {
            setBindingValues((prev) => ({ ...prev, [bindingKey]: resolvedPayload }))
            if (!resolver) continue
            Effect.runPromise(
              resolver.writeback(source, resolvedPayload).pipe(
                Effect.catchAll((err) => Effect.sync(() => {
                  console.warn('[genifer] setState writeback failed', {
                    surfaceId: surface.id,
                    target: binding.target,
                    sourceKey: source.key,
                    error: err,
                  })
                })),
              ),
            )
          }

          if (targets.length === 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('genifer:setState', {
              detail: { surfaceId: surface.id, target: binding.target, value: resolvedPayload },
            }))
          }
          break
        }

        case 'emitEvent': {
          if (typeof window !== 'undefined') {
            const detail = { surfaceId: surface.id, event: binding.target, payload: resolvedPayload }
            window.dispatchEvent(new CustomEvent('genifer:event', { detail }))
            window.dispatchEvent(new CustomEvent(`genifer:event:${binding.target}`, { detail }))
          }
          break
        }

        case 'callRpc': {
          if (resolver) {
            const rpcBinding = new DataSourceBinding({
              type: 'rpc',
              key: binding.target,
              targetProp: '$rpc',
            })
            Effect.runPromise(
              resolver.writeback(rpcBinding, resolvedPayload).pipe(
                Effect.catchAll((err) => Effect.sync(() => {
                  console.warn('[genifer] callRpc writeback failed', {
                    surfaceId: surface.id,
                    rpc: binding.target,
                    error: err,
                  })
                })),
              ),
            )
          }
          break
        }

        case 'navigate': {
          if (typeof window !== 'undefined') {
            const to = binding.target
            window.dispatchEvent(new CustomEvent('genifer:navigate', {
              detail: { surfaceId: surface.id, to, payload: resolvedPayload },
            }))

            if (to.startsWith('/')) {
              window.history.pushState(resolvedPayload ?? null, '', to)
            } else if (to.startsWith('http://') || to.startsWith('https://')) {
              window.location.assign(to)
            }
          }
          break
        }
      }
    },
    [surface.id, surface.threadId, sessionId, resolver, dataBindingEntries, bindingValues, onActionExecuted],
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
