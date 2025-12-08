/**
 * Trait Context & Provider
 *
 * Scoped injection boundaries. Injections only reach descendants.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type {
  Trait,
  TraitRegistry,
  TraitInjections,
  TraitContextValue,
  TraitProviderProps,
} from './types'

// =============================================================================
// CONTEXT
// =============================================================================

const TraitContext = createContext<TraitContextValue | null>(null)

export function useTraitContext(): TraitContextValue {
  const ctx = useContext(TraitContext)
  if (!ctx) {
    throw new Error('useTraitContext must be used within TraitProvider')
  }
  return ctx
}

export function useTraitContextOptional(): TraitContextValue | null {
  return useContext(TraitContext)
}

// =============================================================================
// PROVIDER
// =============================================================================

export function TraitProvider({ children }: TraitProviderProps) {
  const [registry, setRegistry] = useState<TraitRegistry>(() => new Map())

  const getInjections = useCallback(
    <TSlot,>(trait: Trait<TSlot>): TraitInjections<TSlot> => {
      const injections = registry.get(trait.id)
      return (injections as TraitInjections<TSlot>) ?? new Map()
    },
    [registry]
  )

  const inject = useCallback(
    <TSlot,>(trait: Trait<TSlot>, targetId: string, slot: TSlot) => {
      setRegistry((prev) => {
        const next = new Map(prev)
        const traitInjections = new Map(prev.get(trait.id) ?? new Map())
        traitInjections.set(targetId, slot)
        next.set(trait.id, traitInjections)
        return next
      })
    },
    []
  )

  const clear = useCallback(
    <TSlot,>(trait: Trait<TSlot>, targetId: string) => {
      setRegistry((prev) => {
        const traitInjections = prev.get(trait.id)
        if (!traitInjections?.has(targetId)) return prev

        const next = new Map(prev)
        const nextInjections = new Map(traitInjections)
        nextInjections.delete(targetId)

        if (nextInjections.size === 0) {
          next.delete(trait.id)
        } else {
          next.set(trait.id, nextInjections)
        }

        return next
      })
    },
    []
  )

  const clearAll = useCallback(<TSlot,>(trait: Trait<TSlot>) => {
    setRegistry((prev) => {
      if (!prev.has(trait.id)) return prev
      const next = new Map(prev)
      next.delete(trait.id)
      return next
    })
  }, [])

  const value = useMemo<TraitContextValue>(
    () => ({
      getInjections,
      inject,
      clear,
      clearAll,
    }),
    [getInjections, inject, clear, clearAll]
  )

  return <TraitContext.Provider value={value}>{children}</TraitContext.Provider>
}

// =============================================================================
// INJECTION HOOKS
// =============================================================================

/**
 * Hook for injecting traits from any component
 */
export function useInject() {
  const ctx = useTraitContext()

  return useMemo(
    () => ({
      inject: ctx.inject,
      clear: ctx.clear,
      clearAll: ctx.clearAll,
    }),
    [ctx]
  )
}

/**
 * Inject a trait on mount, clear on unmount
 */
export function useInjectOnMount<TSlot>(
  trait: Trait<TSlot>,
  targetId: string,
  slot: TSlot,
  enabled = true
) {
  const ctx = useTraitContextOptional()

  // Use effect would cause issues with the dependency, so we inject immediately
  // and rely on the component lifecycle
  useMemo(() => {
    if (enabled && ctx) {
      ctx.inject(trait, targetId, slot)
    }
    return () => {
      if (ctx) {
        ctx.clear(trait, targetId)
      }
    }
  }, [trait, targetId, slot, enabled, ctx])
}
