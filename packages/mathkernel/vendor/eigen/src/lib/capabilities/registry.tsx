/**
 * Capability Registry
 *
 * ECS-style provider for attaching capabilities to entities.
 * Entity = targetId, Component = capability data
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  CapabilityMap,
  CapabilityName,
  EntityId,
  EntityComponents,
  CapabilityContextValue,
  CapabilityProviderProps,
} from './types'

// =============================================================================
// INTERNAL STATE TYPE
// =============================================================================

type RegistryState = Map<EntityId, EntityComponents>

// =============================================================================
// CONTEXT
// =============================================================================

const CapabilityContext = createContext<CapabilityContextValue | null>(null)

export function useCapabilityContext(): CapabilityContextValue {
  const ctx = useContext(CapabilityContext)
  if (!ctx) {
    throw new Error('useCapabilityContext must be used within CapabilityProvider')
  }
  return ctx
}

export function useCapabilityContextOptional(): CapabilityContextValue | null {
  return useContext(CapabilityContext)
}

// =============================================================================
// PROVIDER
// =============================================================================

export function CapabilityProvider({ children }: CapabilityProviderProps) {
  const [registry, setRegistry] = useState<RegistryState>(() => new Map())

  const getEntity = useCallback(
    (entityId: EntityId): EntityComponents => {
      return registry.get(entityId) ?? {}
    },
    [registry]
  )

  const getCapability = useCallback(
    <K extends CapabilityName>(
      entityId: EntityId,
      capability: K
    ): CapabilityMap[K] | null => {
      const entity = registry.get(entityId)
      if (!entity) return null
      return (entity[capability] as CapabilityMap[K]) ?? null
    },
    [registry]
  )

  const attach = useCallback(
    <K extends CapabilityName>(
      entityId: EntityId,
      capability: K,
      data: CapabilityMap[K]
    ) => {
      setRegistry((prev) => {
        const next = new Map(prev)
        const entity = { ...prev.get(entityId), [capability]: data }
        next.set(entityId, entity)
        return next
      })
    },
    []
  )

  const detach = useCallback((entityId: EntityId, capability: CapabilityName) => {
    setRegistry((prev) => {
      const entity = prev.get(entityId)
      if (!entity || !(capability in entity)) return prev

      const next = new Map(prev)
      const { [capability]: _, ...rest } = entity

      if (Object.keys(rest).length === 0) {
        next.delete(entityId)
      } else {
        next.set(entityId, rest)
      }

      return next
    })
  }, [])

  const detachAll = useCallback((entityId: EntityId) => {
    setRegistry((prev) => {
      if (!prev.has(entityId)) return prev
      const next = new Map(prev)
      next.delete(entityId)
      return next
    })
  }, [])

  const hasCapability = useCallback(
    (entityId: EntityId, capability: CapabilityName): boolean => {
      const entity = registry.get(entityId)
      return entity ? capability in entity : false
    },
    [registry]
  )

  const value = useMemo<CapabilityContextValue>(
    () => ({
      getEntity,
      getCapability,
      attach,
      detach,
      detachAll,
      hasCapability,
    }),
    [getEntity, getCapability, attach, detach, detachAll, hasCapability]
  )

  return (
    <CapabilityContext.Provider value={value}>
      {children}
    </CapabilityContext.Provider>
  )
}

// =============================================================================
// CONSUMER HOOKS
// =============================================================================

/**
 * Get a specific capability for an entity
 *
 * @example
 * function MyComponent({ id }: { id: string }) {
 *   const glow = useCapability(id, 'glowable')
 *   if (glow) {
 *     return <GlowRing {...glow}><Content /></GlowRing>
 *   }
 *   return <Content />
 * }
 */
export function useCapability<K extends CapabilityName>(
  entityId: EntityId,
  capability: K
): CapabilityMap[K] | null {
  const ctx = useCapabilityContextOptional()

  return useMemo(() => {
    if (!ctx) return null
    return ctx.getCapability(entityId, capability)
  }, [ctx, entityId, capability])
}

/**
 * Get multiple capabilities for an entity
 *
 * @example
 * function MyComponent({ id }: { id: string }) {
 *   const caps = useCapabilities(id, ['glowable', 'tooltippable', 'pulsable'])
 *   // caps.glowable, caps.tooltippable, caps.pulsable (each nullable)
 * }
 */
export function useCapabilities<K extends CapabilityName>(
  entityId: EntityId,
  capabilities: readonly K[]
): { [P in K]: CapabilityMap[P] | null } {
  const ctx = useCapabilityContextOptional()

  return useMemo(() => {
    const result = {} as { [P in K]: CapabilityMap[P] | null }

    for (const cap of capabilities) {
      result[cap] = ctx?.getCapability(entityId, cap) ?? null
    }

    return result
  }, [ctx, entityId, capabilities])
}

/**
 * Get all capabilities for an entity
 */
export function useEntity(entityId: EntityId): EntityComponents {
  const ctx = useCapabilityContextOptional()

  return useMemo(() => {
    if (!ctx) return {}
    return ctx.getEntity(entityId)
  }, [ctx, entityId])
}

/**
 * Check if entity has a capability
 */
export function useHasCapability(
  entityId: EntityId,
  capability: CapabilityName
): boolean {
  const ctx = useCapabilityContextOptional()

  return useMemo(() => {
    if (!ctx) return false
    return ctx.hasCapability(entityId, capability)
  }, [ctx, entityId, capability])
}

// =============================================================================
// INJECTOR HOOKS
// =============================================================================

/**
 * Get functions to attach/detach capabilities
 *
 * @example
 * function Parent() {
 *   const { attach, detach } = useAttach()
 *
 *   useEffect(() => {
 *     attach('child-id', 'glowable', { color: 'orange' })
 *     return () => detach('child-id', 'glowable')
 *   }, [])
 * }
 */
export function useAttach() {
  const ctx = useCapabilityContext()

  return useMemo(
    () => ({
      attach: ctx.attach,
      detach: ctx.detach,
      detachAll: ctx.detachAll,
    }),
    [ctx]
  )
}

/**
 * Attach capabilities on mount, detach on unmount
 *
 * @example
 * function Injector({ targetId }: { targetId: string }) {
 *   useAttachOnMount(targetId, {
 *     glowable: { color: 'cyan' },
 *     tooltippable: { text: 'Hello' },
 *   })
 *   return null
 * }
 */
export function useAttachOnMount(
  entityId: EntityId,
  capabilities: Partial<CapabilityMap>
) {
  const ctx = useCapabilityContextOptional()

  useEffect(() => {
    if (!ctx) return

    // Attach all capabilities
    for (const [name, data] of Object.entries(capabilities)) {
      if (data !== undefined) {
        ctx.attach(entityId, name as CapabilityName, data)
      }
    }

    // Cleanup: detach all
    return () => {
      for (const name of Object.keys(capabilities)) {
        ctx.detach(entityId, name as CapabilityName)
      }
    }
  }, [ctx, entityId, capabilities])
}
